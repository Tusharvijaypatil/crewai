"""Tests for storage + the escalation queue operations."""

from __future__ import annotations

from app.crew.models import Priority, TicketStatus
from app.flow.routing import RoutingDecision
from app.services.storage import Storage
from tests.conftest import (
    make_classification,
    make_draft,
    make_qa,
    make_retrieval,
    make_ticket,
)


def _save(storage: Storage, *, escalate: bool, ticket_id: str = "t-1"):
    decision = RoutingDecision(
        status=TicketStatus.PENDING_REVIEW if escalate else TicketStatus.RESOLVED,
        escalate=escalate,
        reasons=["priority_P1"] if escalate else [],
    )
    ticket = make_ticket()
    ticket.id = ticket_id
    return storage.save_result(
        ticket=ticket,
        classification=make_classification(
            priority=Priority.P1 if escalate else Priority.P3
        ),
        retrieval=make_retrieval(),
        draft=make_draft(can_answer=not escalate),
        qa=make_qa(passed=not escalate),
        decision=decision,
    )


def test_resolved_ticket_has_no_escalation(storage: Storage):
    row = _save(storage, escalate=False)
    assert row.status == "RESOLVED"
    assert row.reply is not None
    assert storage.list_escalations() == []


def test_escalated_ticket_creates_queue_row(storage: Storage):
    _save(storage, escalate=True, ticket_id="t-esc")
    queue = storage.list_escalations()
    assert len(queue) == 1
    assert queue[0].ticket_id == "t-esc"
    assert queue[0].status == "PENDING_REVIEW"
    assert "priority_P1" in queue[0].reasons


def test_escalated_ticket_reply_is_withheld(storage: Storage):
    row = _save(storage, escalate=True)
    assert row.status == "PENDING_REVIEW"
    assert row.reply is None


def test_get_ticket_roundtrip_and_missing(storage: Storage):
    _save(storage, escalate=False, ticket_id="t-get")
    assert storage.get_ticket("t-get").id == "t-get"
    assert storage.get_ticket("does-not-exist") is None


def test_list_escalations_status_filter(storage: Storage):
    _save(storage, escalate=True, ticket_id="t-a")
    rows = storage.list_escalations()
    storage.update_escalation(rows[0].id, status="APPROVED")
    assert len(storage.list_escalations(status="PENDING_REVIEW")) == 0
    assert len(storage.list_escalations(status="APPROVED")) == 1


def test_approve_resolves_ticket(storage: Storage):
    _save(storage, escalate=True, ticket_id="t-app")
    esc = storage.list_escalations()[0]
    storage.update_escalation(esc.id, status="APPROVED")
    assert storage.get_ticket("t-app").status == "RESOLVED"


def test_reject_keeps_ticket_pending(storage: Storage):
    _save(storage, escalate=True, ticket_id="t-rej")
    esc = storage.list_escalations()[0]
    updated = storage.update_escalation(esc.id, status="REJECTED", human_note="not ok")
    assert updated.status == "REJECTED"
    assert updated.human_note == "not ok"
    assert storage.get_ticket("t-rej").status == "PENDING_REVIEW"


def test_edit_sets_reply_and_resolves(storage: Storage):
    _save(storage, escalate=True, ticket_id="t-edit")
    esc = storage.list_escalations()[0]
    storage.update_escalation(esc.id, status="EDITED", final_reply="Human-written reply.")
    ticket = storage.get_ticket("t-edit")
    assert ticket.status == "RESOLVED"
    assert ticket.reply == "Human-written reply."


def test_update_missing_escalation_returns_none(storage: Storage):
    assert storage.update_escalation(99999, status="APPROVED") is None
