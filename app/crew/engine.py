"""Triage execution engine: the layer the Flow calls to run each agent step.

Two interchangeable implementations sit behind :class:`TriageEngine`:

* :class:`RealTriageEngine` — runs the CrewAI agents (classify / draft / QA) with
  real LLM calls and accumulates token + cost usage. Retrieval is deterministic
  vector search.
* :class:`MockTriageEngine` (see :mod:`app.crew.mock`) — canned, deterministic
  structured outputs with zero network and zero cost; retrieval is still real.

``get_triage_engine`` picks one based on ``LLM_PROVIDER``.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.crew.models import Classification, Draft, QAVerdict, Retrieval, TicketInput
from app.services.knowledge_base import KnowledgeBase, get_knowledge_base
from app.services.llm import RunUsage

logger = get_logger(__name__)


def _retrieval_confidence(top: float, mean: float) -> int:
    """Map cosine similarities to a calibrated 0–100 KB-coverage confidence.

    MiniLM similarities for relevant matches sit roughly in 0.4–0.85, so a relevant
    top hit maps comfortably above the auto-resolve threshold while weak/no-coverage
    hits stay low.
    """
    score = 55.0 + top * 55.0
    # Nudge down if the spread between top and mean is large (a single lucky hit).
    score -= max(0.0, (top - mean)) * 15.0
    return int(max(0, min(100, round(score))))


class TriageEngine(ABC):
    """Interface the Flow uses to run the four triage steps."""

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self._kb: KnowledgeBase | None = None

    @property
    def kb(self) -> KnowledgeBase:
        """Lazily-constructed knowledge base (shared by retrieve())."""
        if self._kb is None:
            self._kb = get_knowledge_base(self.settings)
        return self._kb

    @abstractmethod
    def classify(self, ticket: TicketInput, usage: RunUsage | None = None) -> Classification: ...

    @abstractmethod
    def draft(
        self,
        ticket: TicketInput,
        classification: Classification,
        retrieval: Retrieval,
        usage: RunUsage | None = None,
    ) -> Draft: ...

    @abstractmethod
    def qa(
        self,
        ticket: TicketInput,
        draft: Draft,
        retrieval: Retrieval,
        usage: RunUsage | None = None,
    ) -> QAVerdict: ...

    def retrieve(self, ticket: TicketInput, classification: Classification | None = None) -> Retrieval:
        """Deterministic RAG: vector-search the KB and assemble a Retrieval.

        Shared by both engines — retrieval never depends on an LLM.
        """
        hits = self.kb.search(ticket.text, self.settings.retrieval_top_k)
        if not hits:
            return Retrieval(snippets=[], sources=[], retrieval_confidence=0)
        top = hits[0].score
        mean = sum(h.score for h in hits) / len(hits)
        return Retrieval(
            snippets=[h.text for h in hits],
            sources=[h.source for h in hits],
            retrieval_confidence=_retrieval_confidence(top, mean),
        )


class RealTriageEngine(TriageEngine):
    """Runs the CrewAI agents with real LLM calls (OpenAI)."""

    def classify(self, ticket: TicketInput, usage: RunUsage | None = None) -> Classification:
        from app.crew.agents import build_classifier_agent
        from app.crew.tasks import build_classification_task

        agent = build_classifier_agent(self.settings)
        task = build_classification_task(agent, ticket)
        result = self._kickoff(agent, task, step="classify", model=self.settings.classifier_model, usage=usage)
        return result

    def draft(
        self,
        ticket: TicketInput,
        classification: Classification,
        retrieval: Retrieval,
        usage: RunUsage | None = None,
    ) -> Draft:
        from app.crew.agents import build_drafter_agent
        from app.crew.tasks import build_draft_task

        agent = build_drafter_agent(self.settings)
        task = build_draft_task(agent, ticket, retrieval.context)
        return self._kickoff(agent, task, step="draft", model=self.settings.drafter_model, usage=usage)

    def qa(
        self,
        ticket: TicketInput,
        draft: Draft,
        retrieval: Retrieval,
        usage: RunUsage | None = None,
    ) -> QAVerdict:
        from app.crew.agents import build_qa_agent
        from app.crew.tasks import build_qa_task

        agent = build_qa_agent(self.settings)
        task = build_qa_task(agent, ticket, draft.reply, retrieval.context)
        return self._kickoff(agent, task, step="qa", model=self.settings.drafter_model, usage=usage)

    def _kickoff(self, agent, task, step: str, model: str, usage: RunUsage | None):  # noqa: ANN001, ANN201
        """Run a one-agent/one-task crew and record token usage."""
        from crewai import Crew, Process

        from app.core.retry import with_llm_retry

        crew = Crew(agents=[agent], tasks=[task], process=Process.sequential, verbose=False)

        @with_llm_retry
        def _run():  # noqa: ANN202
            return crew.kickoff()

        result = _run()
        if usage is not None:
            tu = getattr(result, "token_usage", None)
            usage.add(
                step=step,
                model=model,
                prompt_tokens=int(getattr(tu, "prompt_tokens", 0) or 0),
                completion_tokens=int(getattr(tu, "completion_tokens", 0) or 0),
            )
        return result.pydantic


def get_triage_engine(settings: Settings | None = None) -> TriageEngine:
    """Return the engine matching ``LLM_PROVIDER`` (mock by default)."""
    settings = settings or get_settings()
    if settings.llm_provider == "openai":
        return RealTriageEngine(settings)
    from app.crew.mock import MockTriageEngine

    return MockTriageEngine(settings)
