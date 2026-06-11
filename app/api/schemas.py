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
