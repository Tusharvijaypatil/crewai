"""Ticket endpoints: submit a ticket (run the pipeline) and fetch its trace."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.api.schemas import TicketRequest, TicketResponse, TicketTraceResponse
from app.core.logging import get_logger
from app.crew.models import TicketInput
from app.flow.triage_flow import run_triage
from app.services.storage import TicketRow, get_storage

logger = get_logger(__name__)

router = APIRouter(tags=["tickets"])


def _to_response(row: TicketRow) -> TicketResponse:
    return TicketResponse(
        id=row.id,
        status=row.status,
        category=row.category,
        priority=row.priority,
        sentiment=row.sentiment,
        escalated=bool(row.escalation_reasons),
        confidence=row.confidence,
        reply=row.reply,
        citations=list(row.citations or []),
        escalation_reasons=list(row.escalation_reasons or []),
        estimated_cost_usd=row.estimated_cost_usd,
    )


@router.post("/tickets", response_model=TicketResponse)
def submit_ticket(payload: TicketRequest) -> TicketResponse:
    """Submit a ticket, run the full triage pipeline, and return the outcome."""
    ticket = TicketInput(
        id=payload.id,
        subject=payload.subject,
        body=payload.body,
        channel=payload.channel,
        customer_tier=payload.customer_tier,
    )
    try:
        row = run_triage(ticket)
    except Exception as exc:  # pragma: no cover - surfaced as 500
        logger.error("ticket_pipeline_failed", extra={"error": repr(exc)})
        raise HTTPException(status_code=500, detail="Triage pipeline failed") from exc
    return _to_response(row)


@router.get("/tickets/{ticket_id}", response_model=TicketTraceResponse)
def get_ticket(ticket_id: str) -> TicketTraceResponse:
    """Return a ticket's status, outcome, and full agent trace."""
    row = get_storage().get_ticket(ticket_id)
    if row is None:
        raise HTTPException(status_code=404, detail=f"Ticket {ticket_id!r} not found")
    base = _to_response(row)
    return TicketTraceResponse(
        **base.model_dump(),
        subject=row.subject,
        body=row.body,
        channel=row.channel,
        customer_tier=row.customer_tier,
        trace=row.trace or {},
        created_at=row.created_at.isoformat() if row.created_at else None,
        updated_at=row.updated_at.isoformat() if row.updated_at else None,
    )
