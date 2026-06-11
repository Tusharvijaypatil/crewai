"""Knowledge base facade: chunk markdown, ingest into a vector store, and search.

This ties :class:`~app.services.embeddings.Embedder` and
:class:`~app.services.vectorstore.VectorStore` together behind one object so every
caller — the ingest CLI, the ``/ingest`` endpoint, the retriever tool, and the eval
harness — shares identical chunking, embedding, and retrieval behaviour.
"""

from __future__ import annotations

import re
from pathlib import Path

from pydantic import BaseModel

from app.core.config import Settings, get_settings
from app.core.logging import get_logger
from app.services.embeddings import Embedder, get_embedder
from app.services.vectorstore import RetrievedChunk, VectorStore, get_vector_store

logger = get_logger(__name__)

# Chunking targets (characters). KB docs are short; section-aware chunks keep each
# snippet self-contained and citable to a single heading.
_MAX_CHUNK_CHARS = 1100
_MIN_CHUNK_CHARS = 60


class Chunk(BaseModel):
    """A chunk of a KB document, ready to embed and store."""

    id: str
    text: str
    source: str
    section: str


class IngestResult(BaseModel):
    """Summary returned after (re)building the vector store."""

    documents: int
    chunks: int
    collection: str
    vector_store: str


class KnowledgeBase:
    """Embeds, stores, and searches the knowledge base."""

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._embedder: Embedder = get_embedder(self._settings)
        self._store: VectorStore = get_vector_store(self._settings)

    # -- ingest -------------------------------------------------------------

    def ingest_dir(self, kb_dir: str | None = None) -> IngestResult:
        """Chunk every markdown doc under ``kb_dir`` and (re)build the store."""
        directory = Path(kb_dir or self._settings.knowledge_base_dir)
        docs = sorted(directory.glob("*.md"))
        if not docs:
            raise FileNotFoundError(f"No markdown documents found in {directory!s}")

        chunks: list[Chunk] = []
        for doc in docs:
            chunks.extend(_chunk_markdown(doc))

        logger.info("ingest_start", extra={"docs": len(docs), "chunks": len(chunks)})
        embeddings = self._embedder.embed_texts([c.text for c in chunks])

        self._store.reset()
        self._store.add(
            ids=[c.id for c in chunks],
            embeddings=embeddings,
            documents=[c.text for c in chunks],
            metadatas=[{"source": c.source, "section": c.section} for c in chunks],
        )
        result = IngestResult(
            documents=len(docs),
            chunks=len(chunks),
            collection=self._settings.chroma_collection,
            vector_store=self._settings.vector_store,
        )
        logger.info("ingest_complete", extra=result.model_dump())
        return result

    # -- search -------------------------------------------------------------

    def search(self, query: str, top_k: int | None = None) -> list[RetrievedChunk]:
        """Return the top-k most relevant chunks for ``query``."""
        k = top_k or self._settings.retrieval_top_k
        embedding = self._embedder.embed_query(query)
        return self._store.query(embedding, k)

    def count(self) -> int:
        """Number of chunks currently stored."""
        return self._store.count()


def _chunk_markdown(path: Path) -> list[Chunk]:
    """Split one markdown file into heading-aware, size-bounded chunks."""
    source = path.name
    text = path.read_text(encoding="utf-8")
    sections = _split_by_headings(text)

    chunks: list[Chunk] = []
    for section_title, body in sections:
        for piece in _split_long(body):
            piece = piece.strip()
            if len(piece) < _MIN_CHUNK_CHARS:
                continue
            idx = len(chunks)
            chunks.append(
                Chunk(
                    id=f"{source}::{idx}",
                    text=piece,
                    source=source,
                    section=section_title,
                )
            )
    return chunks


def _split_by_headings(text: str) -> list[tuple[str, str]]:
    """Group markdown into (heading, body-including-heading) sections.

    Splits on ``#``/``##`` headings; content before the first heading (if any) is
    kept under a synthetic "Overview" section.
    """
    lines = text.splitlines()
    sections: list[tuple[str, list[str]]] = []
    current_title = "Overview"
    current: list[str] = []

    heading_re = re.compile(r"^#{1,3}\s+(.*)$")
    for line in lines:
        m = heading_re.match(line)
        if m:
            if current:
                sections.append((current_title, current))
            current_title = m.group(1).strip()
            current = [line]
        else:
            current.append(line)
    if current:
        sections.append((current_title, current))

    return [(title, "\n".join(body).strip()) for title, body in sections if "".join(body).strip()]


def _split_long(body: str) -> list[str]:
    """Split a section body into <= _MAX_CHUNK_CHARS pieces on paragraph boundaries."""
    if len(body) <= _MAX_CHUNK_CHARS:
        return [body]

    paragraphs = re.split(r"\n\s*\n", body)
    pieces: list[str] = []
    buf = ""
    for para in paragraphs:
        if not buf:
            buf = para
        elif len(buf) + len(para) + 2 <= _MAX_CHUNK_CHARS:
            buf = f"{buf}\n\n{para}"
        else:
            pieces.append(buf)
            buf = para
    if buf:
        pieces.append(buf)
    return pieces


def get_knowledge_base(settings: Settings | None = None) -> KnowledgeBase:
    """Construct a :class:`KnowledgeBase` for the given (or default) settings."""
    return KnowledgeBase(settings)
