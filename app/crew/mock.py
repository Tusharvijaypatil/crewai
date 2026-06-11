"""Deterministic mock engine: canned structured outputs, zero network, zero cost.

This lets the *entire* pipeline (POST /tickets) and the whole test suite run with no
API key and no spend. Classification is keyword-driven, retrieval is **real** vector
search, and the draft/QA steps are rule-based so the deterministic router produces
sensible auto-resolve vs. escalate decisions.

The heuristics are intentionally transparent and conservative — they are a stand-in
for the LLM, not a second model. Real behaviour comes from ``LLM_PROVIDER=openai``.
"""

from __future__ import annotations

from app.crew.engine import TriageEngine
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
from app.services.llm import RunUsage

# --- keyword sets -----------------------------------------------------------

_SECURITY_INCIDENT = ("leaked", "security incident", "breach", "exposed", "compromis", "vulnerabilit")
_FEATURE = ("terraform", "datadog", "servicenow", "feature request", "please add", "provider for")
_ACCOUNT = (
    "password", "log in", "login", "sign in", "sign-in", "2fa", "two-factor", "authenticator",
    "locked", "lockout", "gdpr", "erase", "right to be forgotten", "article 17",
    "soc 2", "soc2", "dpa", "data processing", "compliance", "hipaa", "baa", "business associate",
    "data residency", "eu data", "delete my", "recover",
)
_BILLING = (
    "invoice", "refund", "charge", "charged", "billing", "payment", "subscription",
    "plan", "pricing", "price", "vat", "downgrade", "double charg", "cancel", "seats", "sso",
)
_TECHNICAL = (
    "rate limit", "429", "api", "deploy", "deployment", "failing", "failed", "error", "timeout",
    "timed out", "times out", "integration", "slack", "github", "gitlab", "webhook", "queued",
    "stuck", "workflow", "runner", "throttl",
)
_TROUBLE = ("error", "429", "timeout", "times out", "timed out", "failing", "failed", "stuck",
            "not working", "can't", "cannot", "reset", "throttl")
_URGENT = ("urgent", "outage", "asap", "immediately", "critical", "costing", "!!",
           "right now", "customers affected", "production")
_ANGRY = _URGENT + ("legal", "unacceptable", "ridiculous", "angry", "frustrat", "terrible")


def _has(text: str, words: tuple[str, ...]) -> bool:
    return any(w in text for w in words)


class MockTriageEngine(TriageEngine):
    """Rule-based stand-in for the LLM agents (deterministic, free)."""

    # -- classify -----------------------------------------------------------

    def classify(self, ticket: TicketInput, usage: RunUsage | None = None) -> Classification:
        t = ticket.text.lower()
        category = self._category(t)
        priority = self._priority(t, category)
        sentiment = Sentiment.NEGATIVE if _has(t, _ANGRY) else Sentiment.NEUTRAL
        rationale = (
            f"Keyword heuristics matched category={category.value} and priority={priority.value}; "
            f"sentiment inferred from tone."
        )
        return Classification(
            category=category, priority=priority, sentiment=sentiment, rationale=rationale
        )

    def _category(self, t: str) -> Category:
        if _has(t, _SECURITY_INCIDENT):
            return Category.OTHER
        if _has(t, _FEATURE):
            return Category.FEATURE_REQUEST
        if _has(t, _ACCOUNT):
            return Category.ACCOUNT
        if _has(t, _TECHNICAL) and not _has(t, ("plan", "pricing", "invoice", "refund", "seats", "sso")):
            return Category.TECHNICAL
        if _has(t, _BILLING):
            return Category.BILLING
        if _has(t, _TECHNICAL):
            return Category.TECHNICAL
        return Category.OTHER

    def _priority(self, t: str, category: Category) -> Priority:
        # P1: genuine emergencies.
        if _has(t, _SECURITY_INCIDENT) or (_has(t, ("outage", "production")) and _has(t, _URGENT)):
            return Priority.P1
        # P2: needs human/account action and is sensitive.
        if self._needs_human(t):
            return Priority.P2
        # P3 vs P4.
        if category is Category.ACCOUNT:
            return Priority.P3
        if category is Category.BILLING and _has(t, ("refund", "cancel")):
            return Priority.P3
        if _has(t, _TROUBLE):
            return Priority.P3
        return Priority.P4

    def _needs_human(self, t: str) -> bool:
        """Sensitive intents that require a human even with KB coverage."""
        if _has(t, ("erase", "right to be forgotten", "article 17")) or (
            "delete" in t and ("data" in t or "account" in t)
        ):
            return True
        if _has(t, ("double charg", "charged twice", "two identical charges", "duplicate charge",
                    "unauthorized charge")):
            return True
        if ("lost" in t and _has(t, ("2fa", "device", "authenticator"))) or "no backup codes" in t:
            return True
        if _has(t, _SECURITY_INCIDENT):
            return True
        return False

    # -- draft --------------------------------------------------------------

    def draft(
        self,
        ticket: TicketInput,
        classification: Classification,
        retrieval: Retrieval,
        usage: RunUsage | None = None,
    ) -> Draft:
        t = ticket.text.lower()
        reason = self._escalation_reason(t, retrieval)
        if reason:
            return Draft(
                reply=(
                    "This request needs a human teammate to handle safely, so I'm routing it to "
                    "our support specialists who will follow up."
                ),
                citations=[],
                can_answer=False,
                escalation_reason=reason,
            )

        # Grounded answer from the top snippets.
        citations: list[str] = []
        for src in retrieval.sources:
            if src not in citations:
                citations.append(src)
            if len(citations) >= 2:
                break
        lead = retrieval.snippets[0].strip().splitlines()
        gist = " ".join(line.strip() for line in lead if line.strip())[:400]
        reply = (
            f"Thanks for reaching out about \"{ticket.subject}\". Based on our documentation: "
            f"{gist} "
            f"You can find more detail in: {', '.join(citations)}."
        )
        return Draft(reply=reply, citations=citations, can_answer=True, escalation_reason=None)

    def _escalation_reason(self, t: str, retrieval: Retrieval) -> str | None:
        if _has(t, ("erase", "right to be forgotten", "article 17")) or (
            "delete" in t and ("data" in t or "account" in t)
        ):
            return "GDPR data-deletion request requires identity verification by a human agent."
        if _has(t, ("double charg", "charged twice", "two identical charges", "duplicate charge")):
            return "Billing dispute / duplicate charge requires account verification and a human refund."
        if ("lost" in t and _has(t, ("2fa", "device", "authenticator"))) or "no backup codes" in t:
            return "Account recovery without 2FA backup codes requires identity verification by support."
        if _has(t, _SECURITY_INCIDENT):
            return "Possible security incident — must be routed to the security on-call team immediately."
        if _has(t, ("hipaa", "baa", "business associate")):
            return "HIPAA/BAA is not covered by the knowledge base and requires legal/sales review."
        if not retrieval.snippets or retrieval.retrieval_confidence < 35:
            return "Insufficient knowledge-base context to answer confidently."
        return None

    # -- qa -----------------------------------------------------------------

    def qa(
        self,
        ticket: TicketInput,
        draft: Draft,
        retrieval: Retrieval,
        usage: RunUsage | None = None,
    ) -> QAVerdict:
        if not draft.can_answer:
            return QAVerdict(
                grounded=False,
                tone_ok=True,
                completeness_ok=False,
                confidence=min(40, retrieval.retrieval_confidence // 2),
                passed=False,
                issues=[draft.escalation_reason or "Cannot be answered from the knowledge base."],
            )

        grounded = bool(draft.citations) and all(c in retrieval.sources for c in draft.citations)
        confidence = retrieval.retrieval_confidence if grounded else min(
            60, retrieval.retrieval_confidence
        )
        issues: list[str] = [] if grounded else ["Some citations are not in the retrieved sources."]
        return QAVerdict(
            grounded=grounded,
            tone_ok=True,
            completeness_ok=True,
            confidence=confidence,
            passed=grounded,
            issues=issues,
        )
