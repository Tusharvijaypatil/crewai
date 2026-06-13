"""Structured outputs and shared enums for the triage crew (Pydantic v2).

Every agent step emits one of these models, and the deterministic router consumes
them. Keeping the schemas here (separate from API DTOs) lets the agent contract and
the wire contract evolve independently.
"""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field, field_validator


class Category(StrEnum):
    """Support ticket category."""

    BILLING = "billing"
    TECHNICAL = "technical"
    ACCOUNT = "account"
    FEATURE_REQUEST = "feature_request"
    OTHER = "other"


class Priority(StrEnum):
    """Ticket priority. P1 is the most urgent and always escalates."""

    P1 = "P1"
    P2 = "P2"
    P3 = "P3"
    P4 = "P4"


class Sentiment(StrEnum):
    """Customer sentiment expressed in the ticket."""

    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"


class TicketStatus(StrEnum):
    """Lifecycle status of a ticket after the pipeline runs."""

    RESOLVED = "RESOLVED"
    PENDING_REVIEW = "PENDING_REVIEW"


class TicketInput(BaseModel):
    """An inbound support ticket to triage."""

    id: str | None = Field(default=None, description="Optional caller-supplied id; generated if absent.")
    subject: str = Field(min_length=1, description="Short ticket subject line.")
    body: str = Field(min_length=1, description="Full ticket body / customer message.")
    channel: str | None = Field(default=None, description="email | chat | phone, if known.")
    customer_tier: str | None = Field(default=None, description="free | starter | pro | enterprise, if known.")

    @property
    def text(self) -> str:
        """Subject + body as a single string for classification/retrieval."""
        return f"{self.subject}\n\n{self.body}".strip()


class Classification(BaseModel):
    """Output of the Triage Classifier agent."""

    category: Category
    priority: Priority
    sentiment: Sentiment
    rationale: str = Field(description="One or two sentences justifying the labels.")


class Retrieval(BaseModel):
    """Output of the Knowledge Retriever step (tool-driven RAG)."""

    snippets: list[str] = Field(default_factory=list, description="Top-k retrieved passages.")
    sources: list[str] = Field(default_factory=list, description="Source filenames, aligned to snippets.")
    retrieval_confidence: int = Field(
        ge=0, le=100, description="0–100 confidence that the KB covers this ticket."
    )

    @property
    def context(self) -> str:
        """Render snippets with source labels for prompting the drafter/QA."""
        return "\n\n".join(
            f"[{src}] {snippet}" for src, snippet in zip(self.sources, self.snippets, strict=False)
        )


class Draft(BaseModel):
    """Output of the Response Drafter agent."""

    reply: str = Field(description="The grounded draft reply to the customer.")
    citations: list[str] = Field(
        default_factory=list, description="Source filenames the reply is grounded in."
    )
    can_answer: bool = Field(
        description="False when context is insufficient or the request needs human action."
    )
    escalation_reason: str | None = Field(
        default=None, description="Why this should be escalated, when can_answer is False."
    )


class QAVerdict(BaseModel):
    """Output of the QA / Guardrail agent."""

    grounded: bool = Field(description="Every claim in the reply is supported by retrieved context.")
    tone_ok: bool = Field(description="Tone is professional and appropriate.")
    completeness_ok: bool = Field(description="The reply actually addresses the customer's question.")
    confidence: int = Field(ge=0, le=100, description="Overall 0–100 confidence in the reply.")
    passed: bool = Field(description="Overall pass/fail gate for auto-resolution.")
    issues: list[str] = Field(default_factory=list, description="Specific problems found, if any.")

    @field_validator("issues", mode="before")
    @classmethod
    def _none_to_empty(cls, v: object) -> object:
        return v or []
