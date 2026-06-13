"""Centralized application configuration.

All runtime configuration is read from the environment (or a local ``.env``)
exactly once and exposed as a cached :class:`Settings` singleton. Nothing in the
codebase should read ``os.environ`` directly — import :func:`get_settings`
instead so that defaults, validation, and typing live in one place.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

LLMProvider = Literal["mock", "openai"]
VectorStoreKind = Literal["chroma", "pinecone"]


class Settings(BaseSettings):
    """Strongly-typed application settings sourced from env / ``.env``.

    Defaults are chosen so the application boots and runs end-to-end with **zero**
    API keys and **zero** cost (``LLM_PROVIDER=mock`` + local Chroma + SQLite).
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        # Treat empty-string env values (e.g. ``LLM_PROVIDER=`` in a .env or a CI
        # secret that resolves blank) as *unset* so they fall back to the typed
        # defaults below, instead of failing validation and crashing boot.
        env_ignore_empty=True,
    )

    # ---- LLM ----
    llm_provider: LLMProvider = Field(default="mock", alias="LLM_PROVIDER")
    openai_api_key: str | None = Field(default=None, alias="OPENAI_API_KEY")
    classifier_model: str = Field(default="gpt-4.1-nano", alias="CLASSIFIER_MODEL")
    drafter_model: str = Field(default="gpt-4.1-mini", alias="DRAFTER_MODEL")
    classifier_max_tokens: int = Field(default=300, alias="CLASSIFIER_MAX_TOKENS")
    drafter_max_tokens: int = Field(default=700, alias="DRAFTER_MAX_TOKENS")
    qa_max_tokens: int = Field(default=500, alias="QA_MAX_TOKENS")
    llm_temperature: float = Field(default=0.1, alias="LLM_TEMPERATURE")
    llm_max_retries: int = Field(default=3, alias="LLM_MAX_RETRIES")

    # ---- Embeddings (local only, by design) ----
    embedding_model: str = Field(default="all-MiniLM-L6-v2", alias="EMBEDDING_MODEL")

    # ---- Vector store ----
    vector_store: VectorStoreKind = Field(default="chroma", alias="VECTOR_STORE")
    chroma_persist_dir: str = Field(default=".chroma", alias="CHROMA_PERSIST_DIR")
    chroma_collection: str = Field(default="nimbus_kb", alias="CHROMA_COLLECTION")
    retrieval_top_k: int = Field(default=4, alias="RETRIEVAL_TOP_K")

    pinecone_api_key: str | None = Field(default=None, alias="PINECONE_API_KEY")
    pinecone_index: str = Field(default="nimbus-kb", alias="PINECONE_INDEX")
    pinecone_cloud: str = Field(default="aws", alias="PINECONE_CLOUD")
    pinecone_region: str = Field(default="us-east-1", alias="PINECONE_REGION")

    # ---- Storage ----
    database_url: str = Field(default="sqlite:///./nimbus.sqlite3", alias="DATABASE_URL")

    # ---- Routing ----
    confidence_threshold: int = Field(default=75, alias="CONFIDENCE_THRESHOLD")

    # ---- Knowledge base ----
    knowledge_base_dir: str = Field(default="data/knowledge_base", alias="KNOWLEDGE_BASE_DIR")

    # ---- Observability ----
    langfuse_public_key: str | None = Field(default=None, alias="LANGFUSE_PUBLIC_KEY")
    langfuse_secret_key: str | None = Field(default=None, alias="LANGFUSE_SECRET_KEY")
    langfuse_host: str = Field(default="https://cloud.langfuse.com", alias="LANGFUSE_HOST")

    # ---- App ----
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    api_host: str = Field(default="0.0.0.0", alias="API_HOST")
    api_port: int = Field(default=8000, alias="API_PORT")

    @field_validator("confidence_threshold")
    @classmethod
    def _validate_threshold(cls, v: int) -> int:
        if not 0 <= v <= 100:
            raise ValueError("CONFIDENCE_THRESHOLD must be between 0 and 100")
        return v

    @field_validator("retrieval_top_k")
    @classmethod
    def _validate_top_k(cls, v: int) -> int:
        if v < 1:
            raise ValueError("RETRIEVAL_TOP_K must be >= 1")
        return v

    @property
    def langfuse_enabled(self) -> bool:
        """Tracing activates only when both Langfuse keys are present."""
        return bool(self.langfuse_public_key and self.langfuse_secret_key)

    @property
    def uses_real_llm(self) -> bool:
        """True when real (billable) LLM calls will be made."""
        return self.llm_provider == "openai"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the process-wide :class:`Settings` singleton."""
    return Settings()
