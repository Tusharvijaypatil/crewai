"""Observability: Langfuse tracing when configured, structured logging otherwise.

Langfuse is **optional** and kept out of the base dependencies (its OpenTelemetry
pins clash with crewai). If both ``LANGFUSE_PUBLIC_KEY`` and ``LANGFUSE_SECRET_KEY``
are set *and* the ``langfuse`` package is importable, triage runs are also sent to
Langfuse; otherwise everything falls back to structured ``key=value`` logging. The
rest of the app depends only on the small :class:`Observability` interface.
"""

from __future__ import annotations

from functools import lru_cache

from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.crew.models import Classification, Draft, QAVerdict, Retrieval
from app.flow.routing import RoutingDecision
from app.services.llm import RunUsage

logger = get_logger(__name__)


def _summary(
    ticket_id: str,
    classification: Classification,
    retrieval: Retrieval,
    draft: Draft,
    qa: QAVerdict,
    decision: RoutingDecision,
    usage: RunUsage | None,
) -> dict[str, object]:
    """Flatten a triage run into a compact, serializable summary."""
    return {
        "ticket": ticket_id,
        "category": classification.category.value,
        "priority": classification.priority.value,
        "sentiment": classification.sentiment.value,
        "retrieval_confidence": retrieval.retrieval_confidence,
        "sources": list(dict.fromkeys(retrieval.sources)),
        "can_answer": draft.can_answer,
        "qa_confidence": qa.confidence,
        "qa_passed": qa.passed,
        "status": decision.status.value,
        "escalated": decision.escalate,
        "reasons": decision.reasons,
        "estimated_cost_usd": usage.total_cost_usd if usage else 0.0,
    }


class Observability:
    """Structured-logging observability backend (the always-available default)."""

    backend = "logging"

    def record_triage(
        self,
        ticket_id: str,
        classification: Classification,
        retrieval: Retrieval,
        draft: Draft,
        qa: QAVerdict,
        decision: RoutingDecision,
        usage: RunUsage | None = None,
    ) -> None:
        """Emit a structured trace for one triage run."""
        logger.info("triage_trace", extra=_summary(
            ticket_id, classification, retrieval, draft, qa, decision, usage
        ))

    def record_human_action(self, escalation_id: int, action: str, ticket_id: str) -> None:
        """Emit a structured event for a human review action."""
        logger.info(
            "human_action",
            extra={"escalation": escalation_id, "action": action, "ticket": ticket_id},
        )


class LangfuseObservability(Observability):
    """Langfuse-backed observability; still logs structurally as a base layer."""

    backend = "langfuse"

    def __init__(self, settings: Settings) -> None:
        from langfuse import Langfuse  # imported only when enabled + installed

        self._client = Langfuse(
            public_key=settings.langfuse_public_key,
            secret_key=settings.langfuse_secret_key,
            host=settings.langfuse_host,
        )
        logger.info("observability_backend", extra={"backend": "langfuse", "host": settings.langfuse_host})

    def record_triage(
        self,
        ticket_id: str,
        classification: Classification,
        retrieval: Retrieval,
        draft: Draft,
        qa: QAVerdict,
        decision: RoutingDecision,
        usage: RunUsage | None = None,
    ) -> None:
        super().record_triage(ticket_id, classification, retrieval, draft, qa, decision, usage)
        try:
            self._client.trace(
                name="triage",
                input={"ticket": ticket_id},
                output=_summary(ticket_id, classification, retrieval, draft, qa, decision, usage),
                metadata={"escalated": decision.escalate, "status": decision.status.value},
            )
        except Exception as exc:  # pragma: no cover - never break the request on tracing
            logger.warning("langfuse_trace_failed", extra={"error": repr(exc)})


@lru_cache(maxsize=1)
def _cached_observability(enabled: bool) -> Observability:
    settings = get_settings()
    if enabled:
        try:
            return LangfuseObservability(settings)
        except Exception as exc:
            logger.warning(
                "langfuse_unavailable_fallback_logging",
                extra={"error": repr(exc)},
            )
    logger.info("observability_backend", extra={"backend": "logging"})
    return Observability()


def get_observability(settings: Settings | None = None) -> Observability:
    """Return the configured observability backend (Langfuse if available, else logging)."""
    settings = settings or get_settings()
    return _cached_observability(settings.langfuse_enabled)
