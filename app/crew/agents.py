"""CrewAI agent factories for the triage crew.

Three agents make LLM calls and are built here: the Triage Classifier (cheap
model), the Response Drafter, and the QA / Guardrail (both the stronger model).

The fourth logical agent — the Knowledge Retriever — is **tool-driven and
deterministic**: it runs a vector search over Chroma (see
:class:`~app.crew.tools.KnowledgeBaseSearchTool` and the engine's ``retrieve``
step) and computes a confidence score from similarity. Keeping retrieval out of the
LLM removes a hallucination surface and costs nothing, while still returning
snippets with their source filenames.
"""

from __future__ import annotations

from app.core.config import Settings, get_settings
from app.crew.tools import build_kb_search_tool


def build_classifier_agent(settings: Settings | None = None):  # noqa: ANN201
    """Triage Classifier — labels category, priority, and sentiment (cheap model)."""
    from crewai import Agent

    from app.services.llm import get_llm

    settings = settings or get_settings()
    llm = get_llm(settings.classifier_model, settings.classifier_max_tokens, settings)
    return Agent(
        role="Support Triage Classifier",
        goal=(
            "Read a customer support ticket and classify it precisely into a category, "
            "a priority (P1–P4), and a sentiment, with a brief rationale."
        ),
        backstory=(
            "You are a meticulous front-line support lead. You never overreact, but you "
            "flag genuine emergencies (outages, security incidents, legal threats) as P1. "
            "You output only the structured fields requested."
        ),
        llm=llm,
        allow_delegation=False,
        verbose=False,
    )


def build_drafter_agent(settings: Settings | None = None):  # noqa: ANN201
    """Response Drafter — grounded reply using ONLY retrieved context (stronger model)."""
    from crewai import Agent

    from app.services.llm import get_llm

    settings = settings or get_settings()
    llm = get_llm(settings.drafter_model, settings.drafter_max_tokens, settings)
    return Agent(
        role="Support Response Drafter",
        goal=(
            "Draft a helpful, accurate reply grounded ONLY in the retrieved knowledge-base "
            "context. Cite the source filenames you used. If the context is insufficient, or "
            "the request needs human action (refunds, account changes, data deletion, security "
            "incidents), set can_answer to false and give an escalation_reason instead of guessing."
        ),
        backstory=(
            "You are a senior support engineer who refuses to invent facts. Every claim you make "
            "must trace to the provided context. You would rather escalate than hallucinate."
        ),
        llm=llm,
        allow_delegation=False,
        verbose=False,
    )


def build_qa_agent(settings: Settings | None = None):  # noqa: ANN201
    """QA / Guardrail — verifies grounding, tone, completeness; scores confidence."""
    from crewai import Agent

    from app.services.llm import get_llm

    settings = settings or get_settings()
    llm = get_llm(settings.drafter_model, settings.qa_max_tokens, settings)
    return Agent(
        role="Support QA and Guardrail Reviewer",
        goal=(
            "Critically review a drafted reply against the retrieved context. Verify every claim "
            "is grounded, check tone and completeness, list concrete issues, and assign an overall "
            "0–100 confidence with a pass/fail. Fail anything that hallucinates or is unsafe to "
            "auto-send."
        ),
        backstory=(
            "You are an exacting quality reviewer and the last line of defense before a reply is "
            "auto-sent to a customer. You are skeptical and precise, and you do not rubber-stamp."
        ),
        llm=llm,
        allow_delegation=False,
        verbose=False,
    )


def build_kb_tool():  # noqa: ANN201
    """Expose the KB search tool (used by the retriever step / real-mode showcase)."""
    return build_kb_search_tool()
