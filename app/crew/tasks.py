"""CrewAI task factories.

Each task renders a fully-formed prompt for its agent and binds an
``output_pydantic`` schema so CrewAI returns a validated structured object. Tasks
are built per-ticket (with context already interpolated) by the real engine.
"""

from __future__ import annotations

from app.crew.models import Classification, Draft, QAVerdict, TicketInput


def build_classification_task(agent, ticket: TicketInput):  # noqa: ANN001, ANN201
    """Task: classify a ticket into category / priority / sentiment."""
    from crewai import Task

    return Task(
        description=(
            "Classify the following support ticket.\n\n"
            f"SUBJECT: {ticket.subject}\n"
            f"BODY: {ticket.body}\n\n"
            "Choose:\n"
            "- category: one of billing, technical, account, feature_request, other\n"
            "- priority: P1 (urgent: outage, security incident, legal/credit risk), P2 (important, "
            "needs human/account action), P3 (normal), P4 (low/info)\n"
            "- sentiment: positive, neutral, or negative\n"
            "Give a one- or two-sentence rationale."
        ),
        expected_output=(
            "A structured classification with category, priority, sentiment, and rationale."
        ),
        agent=agent,
        output_pydantic=Classification,
    )


def build_draft_task(agent, ticket: TicketInput, context: str):  # noqa: ANN001, ANN201
    """Task: draft a grounded reply from retrieved context only."""
    from crewai import Task

    context_block = context.strip() or "(no relevant knowledge-base context was retrieved)"
    return Task(
        description=(
            "Draft a reply to the customer using ONLY the knowledge-base context below. "
            "Do not invent facts, prices, limits, or policies that are not in the context. "
            "Cite the source filenames you used in `citations`.\n\n"
            "If the context does not contain enough information to answer, OR the request requires "
            "human action (refunds, billing disputes, account or data deletion, identity recovery, "
            "security incidents), set `can_answer` to false and provide an `escalation_reason`.\n\n"
            f"TICKET SUBJECT: {ticket.subject}\n"
            f"TICKET BODY: {ticket.body}\n\n"
            f"KNOWLEDGE-BASE CONTEXT:\n{context_block}"
        ),
        expected_output=(
            "A structured draft with reply, citations (source filenames), can_answer, and "
            "escalation_reason when can_answer is false."
        ),
        agent=agent,
        output_pydantic=Draft,
    )


def build_qa_task(agent, ticket: TicketInput, reply: str, context: str):  # noqa: ANN001, ANN201
    """Task: QA-check a drafted reply against the retrieved context."""
    from crewai import Task

    context_block = context.strip() or "(no relevant knowledge-base context was retrieved)"
    return Task(
        description=(
            "Review the drafted reply against the knowledge-base context. Verify that EVERY factual "
            "claim in the reply is supported by the context (grounded). Check tone and completeness. "
            "List concrete issues. Assign an overall confidence from 0 to 100 and a pass/fail. Fail "
            "(passed=false) if anything is ungrounded, unsafe to auto-send, or incomplete.\n\n"
            f"ORIGINAL TICKET: {ticket.subject} — {ticket.body}\n\n"
            f"DRAFTED REPLY:\n{reply}\n\n"
            f"KNOWLEDGE-BASE CONTEXT:\n{context_block}"
        ),
        expected_output=(
            "A structured QA verdict with grounded, tone_ok, completeness_ok, confidence (0–100), "
            "passed, and issues."
        ),
        agent=agent,
        output_pydantic=QAVerdict,
    )
