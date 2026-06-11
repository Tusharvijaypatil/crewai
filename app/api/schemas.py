"""Request/response DTOs for the HTTP API (transport layer only).

These are deliberately separate from the crew's structured-output models so the
wire contract can evolve independently of internal agent schemas.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class IngestResponse(BaseModel):
    """Result of (re)building the vector store from the knowledge base."""

    status: str = Field(default="ok")
    documents: int
    chunks: int
    collection: str
    vector_store: str


class RetrievedSnippet(BaseModel):
    """A single retrieval hit returned by the search endpoint / debug views."""

    source: str
    section: str | None = None
    score: float
    text: str


class TicketRequest(BaseModel):
    """Inbound ticket submission."""

    subject: str = Field(min_length=1)
    body: str = Field(min_length=1)
    channel: str | None = None
    customer_tier: str | None = None
    id: str | None = Field(default=None, description="Optional client-supplied id.")


class TicketResponse(BaseModel):
    """Result of running a ticket through the pipeline."""

    id: str
    status: str
    category: str
    priority: str
    sentiment: str
    escalated: bool
    confidence: int
    reply: str | None = None
    citations: list[str] = Field(default_factory=list)
    escalation_reasons: list[str] = Field(default_factory=list)
    estimated_cost_usd: float = 0.0


class TicketTraceResponse(TicketResponse):
    """Full ticket record including the per-agent trace."""

    subject: str
    body: str
    channel: str | None = None
    customer_tier: str | None = None
    trace: dict = Field(default_factory=dict)
    created_at: str | None = None
    updated_at: str | None = None


class EscalationResponse(BaseModel):
    """An item in the human review queue, enriched with its ticket context."""

    id: int
    ticket_id: str
    status: str
    reasons: list[str] = Field(default_factory=list)
    human_note: str | None = None
    final_reply: str | None = None
    created_at: str | None = None
    # Ticket context (for a useful queue view without a second request).
    ticket_subject: str | None = None
    ticket_category: str | None = None
    ticket_priority: str | None = None
    ticket_confidence: int | None = None


class EscalationActionRequest(BaseModel):
    """Body for approve / reject. ``note`` is an optional reviewer comment."""

    note: str | None = None


class EscalationEditRequest(BaseModel):
    """Body for edit: the human-authored final reply (plus optional note)."""

    final_reply: str = Field(min_length=1, description="The reply to send after human editing.")
    note: str | None = None
