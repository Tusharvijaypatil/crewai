"""Shared pytest fixtures and factories.

The whole suite runs offline: ``LLM_PROVIDER`` defaults to ``mock`` (no network,
no cost) and retrieval uses the local Chroma store, which is (re)built once per
session if empty. Storage tests use a throwaway SQLite file per test.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings, get_settings
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
from app.flow.routing import RoutingDecision
from app.services.knowledge_base import get_knowledge_base
from app.services.storage import Storage


@pytest.fixture(scope="session")
def settings() -> Settings:
    return get_settings()


@pytest.fixture(scope="session", autouse=True)
def ensure_kb(settings: Settings) -> None:
    """Make sure the vector store has content for retrieval-dependent tests."""
    kb = get_knowledge_base(settings)
    if kb.count() == 0:
        kb.ingest_dir()


@pytest.fixture
def storage(tmp_path) -> Storage:
    """A fresh, isolated SQLite storage per test."""
    return Storage(f"sqlite:///{tmp_path / 'test.sqlite3'}")


@pytest.fixture
def client() -> TestClient:
    """A FastAPI test client over the real app (mock LLM, default DB)."""
    from app.main import app

    return TestClient(app)


# --- factories: build valid structured outputs with sensible defaults --------


def make_classification(
    category: Category = Category.TECHNICAL,
    priority: Priority = Priority.P3,
    sentiment: Sentiment = Sentiment.NEUTRAL,
) -> Classification:
    return Classification(
        category=category, priority=priority, sentiment=sentiment, rationale="test"
    )


def make_retrieval(confidence: int = 90) -> Retrieval:
    return Retrieval(
        snippets=["Pro allows 1,200 requests/minute."],
        sources=["06-api-rate-limits.md"],
        retrieval_confidence=confidence,
    )


def make_draft(can_answer: bool = True, reason: str | None = None) -> Draft:
    return Draft(
        reply="Here is the grounded answer.",
        citations=["06-api-rate-limits.md"],
        can_answer=can_answer,
        escalation_reason=reason,
    )


def make_qa(confidence: int = 90, passed: bool = True) -> QAVerdict:
    return QAVerdict(
        grounded=passed,
        tone_ok=True,
        completeness_ok=True,
        confidence=confidence,
        passed=passed,
        issues=[],
    )


def make_ticket(subject: str = "Rate limits?", body: str = "What is the Pro limit?") -> TicketInput:
    return TicketInput(id="t-test", subject=subject, body=body)


@pytest.fixture
def decision_factory():
    """Build a RoutingDecision quickly in assertions if needed."""
    return RoutingDecision
