"""Regression tests for the knowledge-base search tool's failure handling.

A CrewAI tool must degrade to a descriptive string rather than raise into the
agent executor — a raw exception would abort the whole crew kickoff. This guards
the try/except added to ``KnowledgeBaseSearchTool._run``.
"""

from __future__ import annotations

from app.crew.tools import build_kb_search_tool


class _BoomKB:
    """Stand-in KnowledgeBase whose search always fails."""

    def search(self, *args, **kwargs):
        raise RuntimeError("vector store unavailable")


def test_kb_tool_returns_error_string_when_search_raises():
    tool = build_kb_search_tool()
    # Inject a failing KB so retrieval raises (and we skip the embedding-model load).
    tool._kb = _BoomKB()

    result = tool._run("anything at all")

    assert isinstance(result, str)
    assert result.startswith("ERROR:")
    assert "RuntimeError" in result
