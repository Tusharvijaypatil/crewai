"""End-to-end integration tests with the LLM mocked (LLM_PROVIDER=mock).

These exercise the full spine — classify → retrieve (real RAG) → draft → qa →
deterministic route → persist — with zero network and zero cost.
"""

from __future__ import annotations

from app.core.config import Settings
from app.crew.engine import get_triage_engine
from app.crew.mock import MockTriageEngine
from app.crew.models import TicketInput
from app.flow.triage_flow import run_triage
from app.services.storage import Storage


def _run(ticket: TicketInput, settings: Settings, storage: Storage):
    engine = get_triage_engine(settings)
    return run_triage(ticket, settings=settings, engine=engine, storage=storage)


def test_default_engine_is_mock(settings: Settings):
    assert settings.llm_provider == "mock"
    assert isinstance(get_triage_engine(settings), MockTriageEngine)


def test_answerable_ticket_resolves_with_citations(settings: Settings, storage: Storage):
    ticket = TicketInput(
        id="int-resolve",
        subject="What are the API rate limits on Pro?",
        body="Per-minute limit and burst for Pro, and which headers show remaining quota?",
    )
    row = _run(ticket, settings, storage)
    assert row.status == "RESOLVED"
    assert row.reply
    assert row.citations
    assert storage.list_escalations() == []
    assert set(row.trace.keys()) == {
        "classification", "retrieval", "draft", "qa", "decision", "usage"
    }


def test_p1_outage_escalates(settings: Settings, storage: Storage):
    ticket = TicketInput(
        id="int-p1",
        subject="URGENT production is DOWN",
        body="Every workflow failing in production, customers affected, Enterprise SLA, fix now.",
    )
    row = _run(ticket, settings, storage)
    assert row.status == "PENDING_REVIEW"
    assert row.priority == "P1"
    assert row.reply is None
    queue = storage.list_escalations()
    assert len(queue) == 1 and queue[0].ticket_id == "int-p1"


def test_out_of_scope_request_escalates_with_cannot_answer(settings: Settings, storage: Storage):
    ticket = TicketInput(
        id="int-gdpr",
        subject="Delete all my data",
        body="Under GDPR Article 17 erase all personal data and delete my account.",
    )
    row = _run(ticket, settings, storage)
    assert row.status == "PENDING_REVIEW"
    assert row.trace["draft"]["can_answer"] is False
    assert row.escalation_reasons


def test_http_pipeline_resolve_and_trace(client):
    resp = client.post(
        "/tickets",
        json={
            "subject": "What are the API rate limits on Pro?",
            "body": "Per-minute limit and burst for Pro?",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "RESOLVED"
    assert body["citations"]

    trace = client.get(f"/tickets/{body['id']}")
    assert trace.status_code == 200
    assert "classification" in trace.json()["trace"]


def test_http_missing_ticket_returns_404(client):
    assert client.get("/tickets/nope-not-here").status_code == 404


def test_http_rejects_empty_subject(client):
    assert client.post("/tickets", json={"subject": "", "body": "x"}).status_code == 422
