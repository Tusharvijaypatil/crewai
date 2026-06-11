# syntax=docker/dockerfile:1
# Nimbus Support Triage Crew — container image.
# Runs fully offline by default (LLM_PROVIDER=mock); the vector store is built at
# startup so the image stays reproducible and key-free.

FROM python:3.11-slim AS base

# - PYTHONUNBUFFERED: stream logs immediately
# - PIP_NO_CACHE_DIR: smaller image
# - HF_HOME: cache the embedding model inside the app dir (persisted via volume)
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/app/.hf_cache \
    LLM_PROVIDER=mock

WORKDIR /app

# System deps kept minimal; sentence-transformers/torch wheels are self-contained.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps first (better layer caching). uv resolves fast.
COPY requirements.txt ./
RUN pip install --upgrade pip uv \
    && uv pip install --system -r requirements.txt

# App source + data.
COPY app ./app
COPY data ./data
COPY evals ./evals
COPY .env.example ./.env.example

EXPOSE 8000

# Build the vector store, then serve. Ingest is idempotent and offline.
CMD ["sh", "-c", "python -m app.ingest && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"]
