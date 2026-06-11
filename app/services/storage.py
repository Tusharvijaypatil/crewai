"""Persistence: tickets table + escalation queue (SQLAlchemy 2.0, SQLite default).

A thin repository over two tables. SQLite is the zero-config default; any
SQLAlchemy URL (e.g. Postgres) works via ``DATABASE_URL``. The full agent trace is
stored as JSON on the ticket so ``GET /tickets/{id}`` can return it.
"""

from __future__ import annotations

from datetime import datetime, timezone
from functools import lru_cache
from typing import Any

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.crew.models import Classification, Draft, QAVerdict, Retrieval, TicketInput, TicketStatus
from app.flow.routing import RoutingDecision
from app.services.llm import RunUsage

logger = get_logger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    """Declarative base for ORM models."""


class TicketRow(Base):
    """A triaged ticket and its outcome."""

    __tablename__ = "tickets"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    subject: Mapped[str] = mapped_column(Text)
    body: Mapped[str] = mapped_column(Text)
    channel: Mapped[str | None] = mapped_column(String(32), nullable=True)
    customer_tier: Mapped[str | None] = mapped_column(String(32), nullable=True)

    status: Mapped[str] = mapped_column(String(32))
    category: Mapped[str] = mapped_column(String(32))
    priority: Mapped[str] = mapped_column(String(8))
    sentiment: Mapped[str] = mapped_column(String(16))

    can_answer: Mapped[bool] = mapped_column(default=False)
    reply: Mapped[str | None] = mapped_column(Text, nullable=True)
    citations: Mapped[list] = mapped_column(JSON, default=list)
    confidence: Mapped[int] = mapped_column(default=0)
    escalation_reasons: Mapped[list] = mapped_column(JSON, default=list)

    trace: Mapped[dict] = mapped_column(JSON, default=dict)
    estimated_cost_usd: Mapped[float] = mapped_column(default=0.0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, onupdate=_utcnow)


class EscalationRow(Base):
    """An entry in the human review queue."""

    __tablename__ = "escalations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    ticket_id: Mapped[str] = mapped_column(ForeignKey("tickets.id"), index=True)
    reasons: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(32), default=TicketStatus.PENDING_REVIEW.value)
    human_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    final_reply: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, onupdate=_utcnow)


class Storage:
    """Repository for tickets and the escalation queue."""

    def __init__(self, database_url: str) -> None:
        connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
        self._engine = create_engine(database_url, connect_args=connect_args, future=True)
        self._session_factory = sessionmaker(bind=self._engine, expire_on_commit=False)
        Base.metadata.create_all(self._engine)
        logger.info("storage_ready", extra={"url": database_url})

    def session(self) -> Session:
        """Open a new ORM session."""
        return self._session_factory()

    # -- writes -------------------------------------------------------------

    def save_result(
        self,
        ticket: TicketInput,
        classification: Classification,
        retrieval: Retrieval,
        draft: Draft,
        qa: QAVerdict,
        decision: RoutingDecision,
        usage: RunUsage | None = None,
    ) -> TicketRow:
        """Persist a triaged ticket (and an escalation row if it was held)."""
        trace = _build_trace(classification, retrieval, draft, qa, decision, usage)
        row = TicketRow(
            id=ticket.id or "",
            subject=ticket.subject,
            body=ticket.body,
            channel=ticket.channel,
            customer_tier=ticket.customer_tier,
            status=decision.status.value,
            category=classification.category.value,
            priority=classification.priority.value,
            sentiment=classification.sentiment.value,
            can_answer=draft.can_answer,
            reply=draft.reply if decision.status is TicketStatus.RESOLVED else None,
            citations=list(draft.citations),
            confidence=qa.confidence,
            escalation_reasons=list(decision.reasons),
            trace=trace,
            estimated_cost_usd=(usage.total_cost_usd if usage else 0.0),
        )
        with self.session() as s:
            s.merge(row)
            if decision.escalate:
                s.add(EscalationRow(ticket_id=row.id, reasons=list(decision.reasons)))
            s.commit()
        logger.info(
            "ticket_saved",
            extra={"ticket": row.id, "status": row.status, "escalated": decision.escalate},
        )
        return row

    # -- reads --------------------------------------------------------------

    def get_ticket(self, ticket_id: str) -> TicketRow | None:
        with self.session() as s:
            return s.get(TicketRow, ticket_id)

    def list_escalations(self, status: str | None = None) -> list[EscalationRow]:
        stmt = select(EscalationRow).order_by(EscalationRow.created_at.desc())
        if status:
            stmt = stmt.where(EscalationRow.status == status)
        with self.session() as s:
            return list(s.scalars(stmt).all())

    def get_escalation(self, escalation_id: int) -> EscalationRow | None:
        with self.session() as s:
            return s.get(EscalationRow, escalation_id)

    def update_escalation(
        self,
        escalation_id: int,
        *,
        status: str,
        human_note: str | None = None,
        final_reply: str | None = None,
    ) -> EscalationRow | None:
        """Apply a human action to a queued escalation and sync the ticket status."""
        with self.session() as s:
            esc = s.get(EscalationRow, escalation_id)
            if esc is None:
                return None
            esc.status = status
            if human_note is not None:
                esc.human_note = human_note
            if final_reply is not None:
                esc.final_reply = final_reply
            ticket = s.get(TicketRow, esc.ticket_id)
            if ticket is not None:
                if status == "APPROVED" or status == "EDITED":
                    ticket.status = TicketStatus.RESOLVED.value
                    if final_reply is not None:
                        ticket.reply = final_reply
                elif status == "REJECTED":
                    ticket.status = TicketStatus.PENDING_REVIEW.value
            s.commit()
            return esc


def _build_trace(
    classification: Classification,
    retrieval: Retrieval,
    draft: Draft,
    qa: QAVerdict,
    decision: RoutingDecision,
    usage: RunUsage | None,
) -> dict[str, Any]:
    """Assemble the full agent trace for GET /tickets/{id}."""
    return {
        "classification": classification.model_dump(),
        "retrieval": retrieval.model_dump(),
        "draft": draft.model_dump(),
        "qa": qa.model_dump(),
        "decision": decision.model_dump(),
        "usage": usage.model_dump() if usage else None,
    }


@lru_cache(maxsize=4)
def _cached_storage(database_url: str) -> Storage:
    return Storage(database_url)


def get_storage(settings: Settings | None = None) -> Storage:
    """Return a process-wide cached :class:`Storage` for the configured DB URL."""
    settings = settings or get_settings()
    return _cached_storage(settings.database_url)
