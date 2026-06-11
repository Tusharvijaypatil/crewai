"""Tests for Pydantic schema validation (agent outputs + API DTOs)."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.api.schemas import EscalationEditRequest, TicketRequest
from app.crew.models import (
    Category,
    Classification,
    Draft,
    Priority,
    QAVerdict,
    Retrieval,
    Sentiment,
    TicketInput,
)


def test_classification_accepts_valid_enums():
    c = Classification(
        category=Category.BILLING,
        priority=Priority.P2,
        sentiment=Sentiment.NEGATIVE,
        rationale="ok",
    )
    assert c.category is Category.BILLING


def test_classification_rejects_unknown_category():
    with pytest.raises(ValidationError):
        Classification(category="nonsense", priority="P1", sentiment="neutral", rationale="x")


@pytest.mark.parametrize("bad", [-1, 101, 200])
def test_qaverdict_confidence_out_of_range_rejected(bad):
    with pytest.raises(ValidationError):
        QAVerdict(
            grounded=True, tone_ok=True, completeness_ok=True,
            confidence=bad, passed=True, issues=[],
        )


def test_qaverdict_none_issues_coerced_to_empty_list():
    v = QAVerdict(
        grounded=True, tone_ok=True, completeness_ok=True,
        confidence=80, passed=True, issues=None,
    )
    assert v.issues == []


def test_retrieval_confidence_bounds_and_context_property():
    r = Retrieval(
        snippets=["alpha", "beta"],
        sources=["a.md", "b.md"],
        retrieval_confidence=50,
    )
    ctx = r.context
    assert "[a.md] alpha" in ctx and "[b.md] beta" in ctx
    with pytest.raises(ValidationError):
        Retrieval(snippets=[], sources=[], retrieval_confidence=150)


def test_draft_requires_can_answer_and_allows_optional_reason():
    d = Draft(reply="hi", citations=[], can_answer=True)
    assert d.escalation_reason is None
    with pytest.raises(ValidationError):
        Draft(reply="hi", citations=[])  # missing can_answer


def test_ticketinput_requires_nonempty_and_builds_text():
    t = TicketInput(subject="Subj", body="Body")
    assert t.text == "Subj\n\nBody"
    with pytest.raises(ValidationError):
        TicketInput(subject="", body="x")


def test_api_dtos_validate_input():
    assert TicketRequest(subject="s", body="b").id is None
    with pytest.raises(ValidationError):
        TicketRequest(subject="", body="b")
    with pytest.raises(ValidationError):
        EscalationEditRequest(final_reply="")
