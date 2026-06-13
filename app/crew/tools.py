"""CrewAI tool exposing knowledge-base retrieval to the Retriever agent.

The tool wraps :class:`~app.services.knowledge_base.KnowledgeBase` so the agent gets
deterministic RAG: it returns the top-k chunks formatted with their **source
filenames** and similarity scores, which the agent then distils into a structured
``Retrieval`` output (snippets, sources, retrieval_confidence).
"""

from __future__ import annotations

import json

from crewai.tools import BaseTool
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.core.logging import get_logger
from app.services.knowledge_base import KnowledgeBase, get_knowledge_base

logger = get_logger(__name__)


class KBSearchInput(BaseModel):
    """Arguments for the knowledge-base search tool."""

    query: str = Field(description="The search query — usually the customer's question or its key terms.")


class KnowledgeBaseSearchTool(BaseTool):
    """Semantic search over the Nimbus knowledge base (RAG retrieval)."""

    name: str = "knowledge_base_search"
    description: str = (
        "Search the Nimbus product knowledge base for passages relevant to a support "
        "question. Returns the most relevant snippets, each with its SOURCE filename "
        "and a similarity score. Use the returned text ONLY — do not invent facts."
    )
    args_schema: type[BaseModel] = KBSearchInput

    # Lazily-constructed KB (loads the embedding model on first use). Excluded from
    # the tool's serialized schema.
    _kb: KnowledgeBase | None = None

    def _ensure_kb(self) -> KnowledgeBase:
        if self._kb is None:
            self._kb = get_knowledge_base(get_settings())
        return self._kb

    def _run(self, query: str) -> str:
        """Execute retrieval and return a readable, source-attributed result string.

        Any failure (embedding model load, vector-store error, an un-ingested
        collection) is caught and returned as a descriptive ``ERROR:`` string. A
        CrewAI tool must never raise into the agent executor — a raw exception would
        abort the whole crew kickoff; a string lets the agent react (escalate) instead.
        """
        try:
            settings = get_settings()
            kb = self._ensure_kb()
            hits = kb.search(query, settings.retrieval_top_k)
        except Exception as exc:  # noqa: BLE001 - tools degrade gracefully, never raise
            logger.error("kb_search_failed", extra={"query": query[:80], "error": repr(exc)})
            return (
                f"ERROR: the knowledge base search failed ({type(exc).__name__}). No "
                "passages could be retrieved. Treat this ticket as having no supporting "
                "documentation and escalate rather than guessing at an answer."
            )

        logger.info("kb_search", extra={"query": query[:80], "hits": len(hits)})

        if not hits:
            return (
                "NO_RESULTS: the knowledge base returned no relevant passages for this "
                "query. There is likely no documentation covering it."
            )

        blocks: list[str] = []
        for i, h in enumerate(hits, start=1):
            blocks.append(
                f"[{i}] source={h.source} section=\"{h.section or ''}\" "
                f"similarity={h.score:.2f}\n{h.text}"
            )
        # A machine-readable footer makes it easy for the agent to cite sources and
        # gauge retrieval confidence consistently.
        summary = {
            "sources": [h.source for h in hits],
            "top_similarity": round(hits[0].score, 4),
            "mean_similarity": round(sum(h.score for h in hits) / len(hits), 4),
        }
        return "\n\n".join(blocks) + "\n\nRETRIEVAL_SUMMARY=" + json.dumps(summary)


def build_kb_search_tool() -> KnowledgeBaseSearchTool:
    """Factory for the KB search tool (keeps construction in one place)."""
    return KnowledgeBaseSearchTool()
