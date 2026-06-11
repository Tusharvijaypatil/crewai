"""CLI entrypoint to (re)build the vector store from the knowledge base.

Usage::

    python -m app.ingest            # ingest data/knowledge_base/ (or KNOWLEDGE_BASE_DIR)
    python -m app.ingest data/kb    # ingest a specific directory

Fully local and offline after the embedding model is cached — no API key required.
"""

from __future__ import annotations

import sys

from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger
from app.services.knowledge_base import get_knowledge_base

logger = get_logger(__name__)


def main(argv: list[str] | None = None) -> int:
    """Run a full ingest and print a short summary. Returns a process exit code."""
    argv = argv if argv is not None else sys.argv[1:]
    settings = get_settings()
    configure_logging(settings.log_level)

    kb_dir = argv[0] if argv else settings.knowledge_base_dir
    kb = get_knowledge_base(settings)

    try:
        result = kb.ingest_dir(kb_dir)
    except FileNotFoundError as exc:
        logger.error("ingest_failed", extra={"error": str(exc)})
        print(f"ERROR: {exc}")
        return 1

    print(
        f"Ingested {result.documents} documents -> {result.chunks} chunks "
        f"into '{result.collection}' ({result.vector_store}). "
        f"Store now holds {kb.count()} chunks."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
