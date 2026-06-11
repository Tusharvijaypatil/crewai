"""Tests for the deterministic router — the human-in-the-loop gate."""

from __future__ import annotations

import pytest

from app.crew.models import Priority, TicketStatus
from app.flow.routing import decide
from tests.conftest import make_classification, make_draft, make_qa

THRESHOLD = 75


def test_auto_resolves_when_all_conditions_met():
    decision = decide(
        make_classification(priority=Priority.P3),
        make_draft(can_answer=True),
        make_qa(confidence=90, passed=True),
        THRESHOLD,
    )
    assert decision.status is TicketStatus.RESOLVED
    assert decision.escalate is False
    assert decision.reasons == []


def test_escalates_when_drafter_cannot_answer():
    decision = decide(
        make_classification(priority=Priority.P3),
        make_draft(can_answer=False, reason="needs a human"),
        make_qa(confidence=90, passed=True),
        THRESHOLD,
    )
    assert decision.escalate is True
    assert decision.status is TicketStatus.PENDING_REVIEW
    assert any("drafter_cannot_answer" in r for r in decision.reasons)


def test_escalates_when_qa_failed():
    decision = decide(
        make_classification(priority=Priority.P3),
        make_draft(can_answer=True),
        make_qa(confidence=90, passed=False),
        THRESHOLD,
    )
    assert decision.escalate is True
    assert "qa_failed" in decision.reasons


def test_escalates_on_p1_even_if_everything_else_is_fine():
    decision = decide(
        make_classification(priority=Priority.P1),
        make_draft(can_answer=True),
        make_qa(confidence=99, passed=True),
        THRESHOLD,
    )
    assert decision.escalate is True
    assert "priority_P1" in decision.reasons


def test_escalates_when_confidence_below_threshold():
    decision = decide(
        make_classification(priority=Priority.P3),
        make_draft(can_answer=True),
        make_qa(confidence=74, passed=True),
        THRESHOLD,
    )
    assert decision.escalate is True
    assert any("confidence_below_threshold" in r for r in decision.reasons)


@pytest.mark.parametrize(
    "confidence,expected_escalate",
    [(74, True), (75, False), (76, False)],
)
def test_confidence_threshold_is_inclusive(confidence, expected_escalate):
    decision = decide(
        make_classification(priority=Priority.P3),
        make_draft(can_answer=True),
        make_qa(confidence=confidence, passed=True),
        THRESHOLD,
    )
    assert decision.escalate is expected_escalate


def test_reasons_accumulate_when_multiple_conditions_fail():
    decision = decide(
        make_classification(priority=Priority.P1),
        make_draft(can_answer=False, reason="sensitive"),
        make_qa(confidence=10, passed=False),
        THRESHOLD,
    )
    assert decision.escalate is True
    # all four conditions tripped
    assert len(decision.reasons) == 4
