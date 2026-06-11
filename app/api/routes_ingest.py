"""Ingestion endpoint: (re)build the vector store from the knowledge base."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.api.schemas import IngestResponse
from app.core.logging import get_logger
from app.services.knowledge_base import get_knowledge_base

logger = get_logger(__name__)

router = APIRouter(tags=["ingest"])


@router.post("/ingest", response_model=IngestResponse)
def ingest() -> IngestResponse:
    """Chunk the knowledge base, embed it, and rebuild the vector store."""
    kb = get_knowledge_base()
    try:
        result = kb.ingest_dir()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - surfaced as 500 to the caller
        logger.error("ingest_endpoint_failed", extra={"error": repr(exc)})
        raise HTTPException(status_code=500, detail="Ingestion failed") from exc

    return IngestResponse(
        documents=result.documents,
        chunks=result.chunks,
        collection=result.collection,
        vector_store=result.vector_store,
    )
