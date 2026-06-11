"""Local text embeddings via sentence-transformers.

Embeddings are computed **locally** (default model ``all-MiniLM-L6-v2``, 384-dim) so
ingest and retrieval are offline and free. The same :class:`Embedder` is used for
both Chroma and Pinecone so vectors are identical regardless of vector store.

The model is downloaded from Hugging Face once on first use and cached on disk
(``.hf_cache/``); subsequent runs are fully offline.
"""

from __future__ import annotations

from functools import lru_cache

from app.core.config import Settings, get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# Local, on-disk cache so re-runs don't hit the network.
_CACHE_FOLDER = ".hf_cache"


class Embedder:
    """Wraps a sentence-transformers model with a small, stable interface."""

    def __init__(self, model_name: str) -> None:
        # Imported lazily so merely importing this module is cheap and does not
        # pull torch into processes that never embed anything.
        from sentence_transformers import SentenceTransformer

        logger.info("loading_embedding_model", extra={"model": model_name})
        self._model = SentenceTransformer(model_name, cache_folder=_CACHE_FOLDER)
        self._dimension = int(self._model.get_sentence_embedding_dimension())
        logger.info("embedding_model_ready", extra={"model": model_name, "dim": self._dimension})

    @property
    def dimension(self) -> int:
        """Embedding vector dimensionality (e.g. 384 for all-MiniLM-L6-v2)."""
        return self._dimension

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Embed a batch of documents into a list of float vectors."""
        if not texts:
            return []
        vectors = self._model.encode(
            texts,
            batch_size=32,
            show_progress_bar=False,
            normalize_embeddings=True,
            convert_to_numpy=True,
        )
        return [v.tolist() for v in vectors]

    def embed_query(self, text: str) -> list[float]:
        """Embed a single query string into one float vector."""
        return self.embed_texts([text])[0]


@lru_cache(maxsize=1)
def _cached_embedder(model_name: str) -> Embedder:
    return Embedder(model_name)


def get_embedder(settings: Settings | None = None) -> Embedder:
    """Return a process-wide cached :class:`Embedder` for the configured model."""
    settings = settings or get_settings()
    return _cached_embedder(settings.embedding_model)
