"""LLM factory and cost accounting.

Builds configured CrewAI ``LLM`` instances for the OpenAI provider with a hard
``max_tokens`` cap per agent (a cost guard), and provides per-run token + estimated
cost accounting. In ``mock`` mode no LLM is constructed at all — the mock engine
produces canned structured outputs with zero network and zero cost.

Pricing is USD per 1M tokens (input / output), current as of this build:
    gpt-4.1-nano  $0.10 / $0.40
    gpt-4.1-mini  $0.40 / $1.60
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.core.config import Settings, get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# USD per 1,000,000 tokens: model -> (input_rate, output_rate).
MODEL_PRICING: dict[str, tuple[float, float]] = {
    "gpt-4.1-nano": (0.10, 0.40),
    "gpt-4.1-mini": (0.40, 1.60),
    "gpt-4.1": (2.00, 8.00),
    "gpt-4o-mini": (0.15, 0.60),
}


def estimate_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    """Estimate USD cost for a call given a model and its token counts.

    Unknown models fall back to gpt-4.1-mini rates so cost is never silently zero.
    """
    in_rate, out_rate = MODEL_PRICING.get(model, MODEL_PRICING["gpt-4.1-mini"])
    return (prompt_tokens / 1_000_000) * in_rate + (completion_tokens / 1_000_000) * out_rate


class UsageRecord(BaseModel):
    """Token + cost usage for a single LLM step."""

    step: str
    model: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    estimated_cost_usd: float = 0.0


class RunUsage(BaseModel):
    """Accumulated usage across all LLM steps in one pipeline run."""

    records: list[UsageRecord] = Field(default_factory=list)

    def add(self, step: str, model: str, prompt_tokens: int, completion_tokens: int) -> UsageRecord:
        """Record one step's usage and return it."""
        rec = UsageRecord(
            step=step,
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
            estimated_cost_usd=round(estimate_cost(model, prompt_tokens, completion_tokens), 6),
        )
        self.records.append(rec)
        return rec

    @property
    def total_tokens(self) -> int:
        return sum(r.total_tokens for r in self.records)

    @property
    def total_cost_usd(self) -> float:
        return round(sum(r.estimated_cost_usd for r in self.records), 6)

    def log(self, ticket_id: str) -> None:
        """Emit a structured per-run cost line."""
        logger.info(
            "llm_run_usage",
            extra={
                "ticket": ticket_id,
                "steps": len(self.records),
                "total_tokens": self.total_tokens,
                "estimated_cost_usd": self.total_cost_usd,
                "breakdown": ",".join(
                    f"{r.step}:{r.model}:{r.total_tokens}t:${r.estimated_cost_usd:.5f}"
                    for r in self.records
                ),
            },
        )


def get_llm(model: str, max_tokens: int, settings: Settings | None = None):  # noqa: ANN201
    """Construct a CrewAI ``LLM`` for the OpenAI provider.

    Raises if the provider is ``openai`` but no API key is configured. ``max_tokens``
    caps the completion length (a per-agent cost guard).
    """
    settings = settings or get_settings()
    if settings.llm_provider != "openai":
        raise RuntimeError(
            f"get_llm called with LLM_PROVIDER={settings.llm_provider!r}; "
            "real LLMs are only built for the 'openai' provider (mock mode bypasses LLMs)."
        )
    if not settings.openai_api_key:
        raise RuntimeError(
            "LLM_PROVIDER=openai requires OPENAI_API_KEY to be set in the environment."
        )

    from crewai import LLM

    return LLM(
        model=f"openai/{model}",
        temperature=settings.llm_temperature,
        max_tokens=max_tokens,
        api_key=settings.openai_api_key,
    )
