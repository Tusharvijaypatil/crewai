"""Deterministic routing — the heart of the human-in-the-loop gate.

This is plain Python over the agents' structured outputs. **No LLM is involved.**
A ticket auto-resolves only when the drafter could answer, QA passed, the priority
is not P1, and QA confidence clears the configured threshold. Any failing condition
routes the ticket to the human review queue, with explicit reasons recorded.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.crew.models import Classification, Draft, Priority, QAVerdict, TicketStatus


class RoutingDecision(BaseModel):
    """Outcome of the deterministic router."""

    status: TicketStatus
    escalate: bool
    reasons: list[str] = Field(
        default_factory=list,
        description="Why the ticket escalated (empty when auto-resolved).",
    )


def decide(
    classification: Classification,
    draft: Draft,
    qa: QAVerdict,
    confidence_threshold: int,
) -> RoutingDecision:
    """Decide whether to auto-resolve or escalate a triaged ticket.

    Escalate if ANY of:
      - the drafter could not answer (``draft.can_answer`` is False),
      - QA failed (``qa.passed`` is False),
      - the ticket is P1,
      - QA confidence is below ``confidence_threshold``.

    Otherwise auto-resolve. Reasons are accumulated so the review queue and the API
    can show exactly why a ticket was held.
    """
    reasons: list[str] = []

    if not draft.can_answer:
        reasons.append(
            f"drafter_cannot_answer:{draft.escalation_reason or 'insufficient context'}"
        )
    if not qa.passed:
        reasons.append("qa_failed")
    if classification.priority == Priority.P1:
        reasons.append("priority_P1")
    if qa.confidence < confidence_threshold:
        reasons.append(f"confidence_below_threshold:{qa.confidence}<{confidence_threshold}")

    escalate = bool(reasons)
    status = TicketStatus.PENDING_REVIEW if escalate else TicketStatus.RESOLVED
    return RoutingDecision(status=status, escalate=escalate, reasons=reasons)
