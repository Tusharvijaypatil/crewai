"""FastAPI application factory.

Wires configuration, logging, and routers together. Routers for tickets,
escalations, and ingestion are mounted in later build phases; Phase 1 ships the
app skeleton plus a ``/health`` probe so the server is verifiably bootable.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import TYPE_CHECKING

from fastapi import FastAPI

from app import __version__
from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> "AsyncIterator[None]":
    """Application startup/shutdown hook."""
    settings = get_settings()
    logger.info(
        "app_startup",
        extra={
            "llm_provider": settings.llm_provider,
            "vector_store": settings.vector_store,
            "confidence_threshold": settings.confidence_threshold,
            "langfuse": settings.langfuse_enabled,
        },
    )
    yield
    logger.info("app_shutdown")


def create_app() -> FastAPI:
    """Build and configure the FastAPI application instance."""
    settings = get_settings()
    configure_logging(settings.log_level)

    app = FastAPI(
        title="Nimbus Support Triage Crew",
        version=__version__,
        description=(
            "Multi-agent support-ticket triage: classify -> retrieve (RAG) -> "
            "draft -> QA -> deterministic route (auto-resolve or human review)."
        ),
        lifespan=lifespan,
    )

    @app.get("/health", tags=["meta"])
    def health() -> dict[str, object]:
        """Liveness + effective-configuration probe."""
        return {
            "status": "ok",
            "version": __version__,
            "llm_provider": settings.llm_provider,
            "vector_store": settings.vector_store,
            "confidence_threshold": settings.confidence_threshold,
        }

    # Routers mounted in later phases:
    #   app.include_router(routes_tickets.router)
    #   app.include_router(routes_escalations.router)
    #   app.include_router(routes_ingest.router)

    return app


app = create_app()
