"""Vector store abstraction with Chroma (default) and Pinecone backends.

Both backends implement the same :class:`VectorStore` interface so the rest of the
app is storage-agnostic. Vectors are supplied by the caller (see
:mod:`app.services.embeddings`) — the store only persists and searches them, which
keeps embeddings identical across backends.

Chroma is local/on-disk and needs no keys (the default). Pinecone is selected with
``VECTOR_STORE=pinecone`` and requires ``PINECONE_API_KEY``.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from pydantic import BaseModel, Field

from app.core.config import Settings, get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class RetrievedChunk(BaseModel):
    """A single search hit: the chunk text, its source doc, and a 0–1 similarity."""

    text: str
    source: str = Field(description="Knowledge-base filename the chunk came from.")
    score: float = Field(description="Cosine similarity in [0, 1]; higher is closer.")
    section: str | None = Field(default=None, description="Nearest heading within the doc.")


class VectorStore(ABC):
    """Minimal persistence + similarity-search interface over embedded chunks."""

    @abstractmethod
    def reset(self) -> None:
        """Drop and recreate the collection/index (used by a full re-ingest)."""

    @abstractmethod
    def add(
        self,
        ids: list[str],
        embeddings: list[list[float]],
        documents: list[str],
        metadatas: list[dict],
    ) -> None:
        """Upsert a batch of embedded chunks."""

    @abstractmethod
    def query(self, embedding: list[float], top_k: int) -> list[RetrievedChunk]:
        """Return the ``top_k`` most similar chunks to a query embedding."""

    @abstractmethod
    def count(self) -> int:
        """Return the number of stored chunks."""


class ChromaVectorStore(VectorStore):
    """Local, on-disk Chroma backend (cosine space)."""

    def __init__(self, settings: Settings) -> None:
        import chromadb

        self._collection_name = settings.chroma_collection
        self._client = chromadb.PersistentClient(path=settings.chroma_persist_dir)
        self._collection = self._client.get_or_create_collection(
            name=self._collection_name,
            metadata={"hnsw:space": "cosine"},
        )
        logger.info(
            "chroma_ready",
            extra={"path": settings.chroma_persist_dir, "collection": self._collection_name},
        )

    def reset(self) -> None:
        try:
            self._client.delete_collection(self._collection_name)
        except Exception:  # collection may not exist yet; that's fine
            pass
        self._collection = self._client.get_or_create_collection(
            name=self._collection_name,
            metadata={"hnsw:space": "cosine"},
        )

    def add(
        self,
        ids: list[str],
        embeddings: list[list[float]],
        documents: list[str],
        metadatas: list[dict],
    ) -> None:
        self._collection.add(
            ids=ids, embeddings=embeddings, documents=documents, metadatas=metadatas
        )

    def query(self, embedding: list[float], top_k: int) -> list[RetrievedChunk]:
        res = self._collection.query(
            query_embeddings=[embedding],
            n_results=top_k,
            include=["documents", "metadatas", "distances"],
        )
        docs = (res.get("documents") or [[]])[0]
        metas = (res.get("metadatas") or [[]])[0]
        dists = (res.get("distances") or [[]])[0]
        hits: list[RetrievedChunk] = []
        for doc, meta, dist in zip(docs, metas, dists, strict=False):
            meta = meta or {}
            hits.append(
                RetrievedChunk(
                    text=doc,
                    source=str(meta.get("source", "unknown")),
                    section=meta.get("section"),
                    score=_distance_to_similarity(dist),
                )
            )
        return hits

    def count(self) -> int:
        return int(self._collection.count())


class PineconeVectorStore(VectorStore):
    """Serverless Pinecone backend (cosine metric). Requires PINECONE_API_KEY."""

    def __init__(self, settings: Settings) -> None:
        if not settings.pinecone_api_key:
            raise ValueError(
                "VECTOR_STORE=pinecone requires PINECONE_API_KEY to be set in the environment."
            )
        from pinecone import Pinecone, ServerlessSpec

        from app.services.embeddings import get_embedder

        self._index_name = settings.pinecone_index
        self._pc = Pinecone(api_key=settings.pinecone_api_key)
        dimension = get_embedder(settings).dimension

        existing = {idx["name"] for idx in self._pc.list_indexes()}
        if self._index_name not in existing:
            logger.info("pinecone_create_index", extra={"index": self._index_name, "dim": dimension})
            self._pc.create_index(
                name=self._index_name,
                dimension=dimension,
                metric="cosine",
                spec=ServerlessSpec(cloud=settings.pinecone_cloud, region=settings.pinecone_region),
            )
        self._index = self._pc.Index(self._index_name)
        logger.info("pinecone_ready", extra={"index": self._index_name})

    def reset(self) -> None:
        # Clear all vectors but keep the index (recreating a serverless index is slow).
        try:
            self._index.delete(delete_all=True)
        except Exception as exc:  # empty index raises on delete_all in some versions
            logger.warning("pinecone_reset_noop", extra={"error": repr(exc)})

    def add(
        self,
        ids: list[str],
        embeddings: list[list[float]],
        documents: list[str],
        metadatas: list[dict],
    ) -> None:
        vectors = [
            {"id": _id, "values": emb, "metadata": {**meta, "text": doc}}
            for _id, emb, doc, meta in zip(ids, embeddings, documents, metadatas, strict=True)
        ]
        # Upsert in modest batches to stay within request-size limits.
        for start in range(0, len(vectors), 100):
            self._index.upsert(vectors=vectors[start : start + 100])

    def query(self, embedding: list[float], top_k: int) -> list[RetrievedChunk]:
        res = self._index.query(vector=embedding, top_k=top_k, include_metadata=True)
        hits: list[RetrievedChunk] = []
        for match in res.get("matches", []):
            meta = match.get("metadata", {}) or {}
            hits.append(
                RetrievedChunk(
                    text=str(meta.get("text", "")),
                    source=str(meta.get("source", "unknown")),
                    section=meta.get("section"),
                    score=float(match.get("score", 0.0)),  # Pinecone cosine score is a similarity
                )
            )
        return hits

    def count(self) -> int:
        try:
            return int(self._index.describe_index_stats().get("total_vector_count", 0))
        except Exception:
            return 0


def _distance_to_similarity(distance: float | None) -> float:
    """Convert a Chroma cosine *distance* to a [0, 1] similarity score."""
    if distance is None:
        return 0.0
    sim = 1.0 - float(distance)
    return max(0.0, min(1.0, sim))


def get_vector_store(settings: Settings | None = None) -> VectorStore:
    """Construct the configured vector store backend."""
    settings = settings or get_settings()
    if settings.vector_store == "pinecone":
        return PineconeVectorStore(settings)
    return ChromaVectorStore(settings)
