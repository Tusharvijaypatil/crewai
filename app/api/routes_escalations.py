"""Escalation queue endpoints (human-in-the-loop review actions).

List the review queue and apply human actions: approve (send as-is / resolve),
reject (keep held), or edit (provide a corrected reply and resolve). Each action
updates both the escalation row and its parent ticket, and is recorded by the
observability layer.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.api.schemas import (
    EscalationActionRequest,
    EscalationEditRequest,
    EscalationResponse,
)
from app.core.logging import get_logger
from app.services.observability import get_observability
from app.services.storage import EscalationRow, Storage, TicketRow, get_storage

logger = get_logger(__name__)

router = APIRouter(tags=["escalations"])


def _to_response(esc: EscalationRow, ticket: TicketRow | None) -> EscalationResponse:
    return EscalationResponse(
        id=esc.id,
        ticket_id=esc.ticket_id,
        status=esc.status,
        reasons=list(esc.reasons or []),
        human_note=esc.human_note,
        final_reply=esc.final_reply,
        created_at=esc.created_at.isoformat() if esc.created_at else None,
        ticket_subject=ticket.subject if ticket else None,
        ticket_category=ticket.category if ticket else None,
        ticket_priority=ticket.priority if ticket else None,
        ticket_confidence=ticket.confidence if ticket else None,
    )


@router.get("/escalations", response_model=list[EscalationResponse])
def list_escalations(
    status: str | None = Query(default=None, description="Filter by status, e.g. PENDING_REVIEW."),
) -> list[EscalationResponse]:
    """List the human review queue (optionally filtered by status)."""
    storage = get_storage()
    rows = storage.list_escalations(status)
    return [_to_response(esc, storage.get_ticket(esc.ticket_id)) for esc in rows]


def _apply_action(
    storage: Storage,
    escalation_id: int,
    *,
    status: str,
    note: str | None,
    final_reply: str | None,
    action: str,
) -> EscalationResponse:
    esc = storage.update_escalation(
        escalation_id, status=status, human_note=note, final_reply=final_reply
    )
    if esc is None:
        raise HTTPException(status_code=404, detail=f"Escalation {escalation_id} not found")
    get_observability().record_human_action(escalation_id, action, esc.ticket_id)
    return _to_response(esc, storage.get_ticket(esc.ticket_id))


@router.post("/escalations/{escalation_id}/approve", response_model=EscalationResponse)
def approve_escalation(
    escalation_id: int, payload: EscalationActionRequest | None = None
) -> EscalationResponse:
    """Approve a queued ticket: mark APPROVED and resolve the ticket."""
    note = payload.note if payload else None
    return _apply_action(
        get_storage(), escalation_id, status="APPROVED", note=note, final_reply=None, action="approve"
    )


@router.post("/escalations/{escalation_id}/reject", response_model=EscalationResponse)
def reject_escalation(
    escalation_id: int, payload: EscalationActionRequest | None = None
) -> EscalationResponse:
    """Reject a queued ticket: mark REJECTED and keep it held for review."""
    note = payload.note if payload else None
    return _apply_action(
        get_storage(), escalation_id, status="REJECTED", note=note, final_reply=None, action="reject"
    )


@router.post("/escalations/{escalation_id}/edit", response_model=EscalationResponse)
def edit_escalation(escalation_id: int, payload: EscalationEditRequest) -> EscalationResponse:
    """Edit a queued ticket: store the human reply, mark EDITED, and resolve."""
    return _apply_action(
        get_storage(),
        escalation_id,
        status="EDITED",
        note=payload.note,
        final_reply=payload.final_reply,
        action="edit",
    )
