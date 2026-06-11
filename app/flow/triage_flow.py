"""The CrewAI Flow spine: classify → retrieve → draft → qa → deterministic route.

The Flow orchestrates the four triage steps and then hands off to the pure
:func:`app.flow.routing.decide` function in an ``@router``. Agents reason; the
routing decision is plain Python. ``run_triage`` drives one ticket through the Flow
and persists the outcome.
"""

from __future__ import annotations

from uuid import uuid4

from crewai.flow.flow import Flow, listen, router, start
from pydantic import BaseModel, Field, PrivateAttr

from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.crew.engine import TriageEngine, get_triage_engine
from app.crew.models import (
    Classification,
    Draft,
    QAVerdict,
    Retrieval,
    TicketInput,
    TicketStatus,
)
from app.flow.routing import RoutingDecision, decide
from app.services.llm import RunUsage
from app.services.storage import Storage, TicketRow, get_storage

logger = get_logger(__name__)


def _silence_crewai_console() -> None:
    """Turn off CrewAI's decorative flow/console panels (kept for server cleanliness).

    The default event listener is a singleton with a hardcoded ``verbose=True``
    console formatter; flipping it off removes the per-method banner spam without
    affecting our own structured logging.
    """
    try:
        from crewai.events.event_listener import EventListener

        listener = EventListener()
        listener.formatter.verbose = False
        # Silence the remaining flow-level panels and the "Flow started" line by
        # making the formatter's rich console (and the listener logger) quiet.
        console = getattr(listener.formatter, "console", None)
        if console is not None:
            console.quiet = True
        logger_obj = getattr(listener, "logger", None)
        if logger_obj is not None and hasattr(logger_obj, "verbose"):
            logger_obj.verbose = False
    except Exception:  # pragma: no cover - never let logging cosmetics break the app
        pass


_silence_crewai_console()


class TriageState(BaseModel):
    """Flow state. All fields default so CrewAI can construct it argless."""

    ticket: TicketInput | None = None
    classification: Classification | None = None
    retrieval: Retrieval | None = None
    draft: Draft | None = None
    qa: QAVerdict | None = None
    status: str | None = None
    escalate: bool = False
    reasons: list[str] = Field(default_factory=list)
    usage: RunUsage = Field(default_factory=RunUsage)


class TriageFlow(Flow[TriageState]):
    """Deterministic spine wiring the four agents and the router."""

    _engine: TriageEngine = PrivateAttr()

    def __init__(self, engine: TriageEngine, **kwargs: object) -> None:
        super().__init__(**kwargs)
        self._engine = engine

    @start()
    def classify(self) -> None:
        ticket = self._ticket()
        self.state.classification = self._engine.classify(ticket, self.state.usage)

    @listen(classify)
    def retrieve(self) -> None:
        self.state.retrieval = self._engine.retrieve(self._ticket(), self.state.classification)

    @listen(retrieve)
    def draft(self) -> None:
        self.state.draft = self._engine.draft(
            self._ticket(), self.state.classification, self.state.retrieval, self.state.usage
        )

    @listen(draft)
    def qa(self) -> None:
        self.state.qa = self._engine.qa(
            self._ticket(), self.state.draft, self.state.retrieval, self.state.usage
        )

    @router(qa)
    def route(self) -> str:
        decision = decide(
            self.state.classification,
            self.state.draft,
            self.state.qa,
            self._engine.settings.confidence_threshold,
        )
        self.state.status = decision.status.value
        self.state.escalate = decision.escalate
        self.state.reasons = decision.reasons
        return "escalated" if decision.escalate else "resolved"

    @listen("resolved")
    def on_resolved(self) -> str:
        return "resolved"

    @listen("escalated")
    def on_escalated(self) -> str:
        return "escalated"

    def _ticket(self) -> TicketInput:
        """Return the ticket as a TicketInput (kickoff may store it as a dict)."""
        t = self.state.ticket
        return t if isinstance(t, TicketInput) else TicketInput.model_validate(t)

    def decision(self) -> RoutingDecision:
        """Reconstruct the routing decision from final state."""
        return RoutingDecision(
            status=TicketStatus(self.state.status),
            escalate=self.state.escalate,
            reasons=list(self.state.reasons),
        )


def run_triage(
    ticket: TicketInput,
    settings: Settings | None = None,
    engine: TriageEngine | None = None,
    storage: Storage | None = None,
) -> TicketRow:
    """Run one ticket through the Flow, persist the result, and return the row."""
    settings = settings or get_settings()
    engine = engine or get_triage_engine(settings)
    storage = storage or get_storage(settings)

    if not ticket.id:
        ticket = ticket.model_copy(update={"id": uuid4().hex[:12]})

    flow = TriageFlow(engine)
    flow.kickoff(inputs={"ticket": ticket.model_dump()})

    st = flow.state
    decision = flow.decision()
    st.usage.log(ticket.id or "unknown")

    row = storage.save_result(
        ticket=ticket,
        classification=st.classification,
        retrieval=st.retrieval,
        draft=st.draft,
        qa=st.qa,
        decision=decision,
        usage=st.usage,
    )
    return row
