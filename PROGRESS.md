# PROGRESS — Nimbus Support Triage Crew

Live build status. **Updated at the end of every phase.** See `CLAUDE.md` for the full plan.

**Real OpenAI spend so far: $0.00** (mock-by-default; no live calls yet).

**Current phase: 3 of 10 complete.**

---

## ✅ Phase 1 — Scaffold + config — COMPLETE

Tree, pinned deps, `.env.example`, config/logging/retry, FastAPI skeleton + `/health`.

**Delivered**
- Project tree: `app/` (`core/`, `api/`), `requirements.in`, `requirements.txt`, `pyproject.toml`, `Makefile`, `.env.example`, `.env`, `.gitignore`, `CLAUDE.md`, `PROGRESS.md`.
- `app/core/config.py` — pydantic-settings `Settings` singleton (every env var, validated).
- `app/core/logging.py` — structured `key=value` logging.
- `app/core/retry.py` — tenacity exponential-backoff decorator for LLM calls.
- `app/main.py` — FastAPI app factory + lifespan + `/health`.

**Verified**
- Python **3.11.5** in `.venv`.
- All key imports OK: crewai + Flow decorators, chromadb, sentence-transformers, pinecone, fastapi, sqlalchemy, tenacity.
- `GET /health` → **200** `{"status":"ok","version":"0.1.0","llm_provider":"mock","vector_store":"chroma","confidence_threshold":75}`.

**Key decisions**
- **CrewAI pinned to latest `1.14.6`** (with `crewai-tools 1.14.6` — the matching pair). Initial guesses (`0.130.0`) were incompatible with current tooling.
- **Dependency strategy:** `requirements.in` (loose, only crewai pinned) → install → freeze → `requirements.txt` (**167 exact pins**). Reproducible pins, generated not guessed.
- **Switched pip → uv** after pip backtracked through a chain of conflicts (chromadb, pydantic-settings). uv resolved cleanly; `make install` now bootstraps uv.
- **Langfuse moved out of base deps** (its OpenTelemetry pins clash with crewai). Optional `pip install langfuse`, lazy import, falls back to structured logging.
- Notable resolved versions: `chromadb 1.1.1`, `pydantic 2.12.5`, `fastapi 0.136.3`, `openai 2.41.1`, `sentence-transformers 5.5.1`.

---

## ✅ Phase 2 — Sample data — COMPLETE

9 KB markdown docs, 12 sample tickets, 18-row labeled eval dataset.

**Delivered**
- `data/knowledge_base/` — 9 internally-consistent Nimbus docs: getting-started, password-reset-and-login, plan-tiers-and-pricing, billing-and-invoices, refund-policy, api-rate-limits, integrations, security-and-data-privacy, troubleshooting-deployments.
- `data/sample_tickets.json` — 12 tickets (`id`, `subject`, `body`, `channel`, `customer_tier`) spanning clearly-answerable, ambiguous, and should-escalate (P1 outage, GDPR erasure, double-charge, out-of-scope).
- `evals/dataset.jsonl` — 18 labeled rows (`expected_category`, `expected_priority`, `should_escalate`, `expected_source`, `reference_answer`).

**Verified** (validation script)
- Categories: account 6, technical 5, billing 4, feature_request 2, other 1.
- Priorities: P1 2, P2 3, P3 7, P4 6.
- should_escalate: 12 resolve / 6 escalate.
- Every `expected_source` maps to a real KB file; `reference_answer` present iff not escalating; all enums valid; no duplicate IDs.

**Key decisions**
- KB facts are fixed and self-consistent (plan prices, rate limits, 60-min reset link, 14-day annual refund, SOC 2 Type II) so groundedness/QA evals have a single source of truth.
- Escalation labels reflect desired business outcome (sensitive/P1/billing-dispute/no-KB-coverage), which is what the deterministic router + agents are measured against in Phase 8.

## ✅ Phase 3 — RAG layer — COMPLETE

Local embeddings, Chroma + Pinecone behind one interface, ingest CLI + endpoint, KB search tool.

**Delivered**
- `app/services/embeddings.py` — `Embedder` over sentence-transformers `all-MiniLM-L6-v2` (384-dim), local `.hf_cache/`, normalized vectors, cached singleton.
- `app/services/vectorstore.py` — `VectorStore` ABC + `ChromaVectorStore` (default, cosine) + `PineconeVectorStore` (serverless, guarded on `PINECONE_API_KEY`) + `get_vector_store()` factory; `RetrievedChunk` model.
- `app/services/knowledge_base.py` — `KnowledgeBase` facade: heading-aware markdown chunker (≤1100 chars, section metadata), `ingest_dir()`, `search()`, `count()`.
- `app/ingest.py` — `python -m app.ingest` CLI.
- `app/crew/tools.py` — `KnowledgeBaseSearchTool` (crewai `BaseTool`) returning source-attributed snippets + a `RETRIEVAL_SUMMARY` footer (sources, top/mean similarity).
- `app/api/routes_ingest.py` + `app/api/schemas.py` — `POST /ingest`; mounted in `main.py`.

**Verified**
- `make ingest` → **9 documents → 53 chunks** into `nimbus_kb` (chroma). First run downloads the model (~88 MB) to `.hf_cache/`; every later run is offline.
- Retrieval vs. labeled `expected_source`: **hit@1 = 16/18 (89%)**, **hit@3 = 18/18 (100%)**. The 2 top@1 misses (Datadog, leaked-keys) still rank the correct doc in top-3.
- `POST /ingest` → 200 `{documents:9, chunks:53, ...}`. Tool output is source-attributed and parseable.

**Key decisions**
- Embeddings computed by us and passed to whichever store, so Chroma and Pinecone index **identical** vectors — embeddings stay provider-agnostic.
- Chunking is heading-aware so each snippet cites a single section (`source` + `section` metadata), which feeds clean citations and groundedness checks downstream.
- Chroma cosine *distance* → `[0,1]` *similarity*; `retrieval_confidence` will derive from top/mean similarity.

## ⬜ Phase 4 — Crew — PENDING
Pydantic output models (`Classification`, `Retrieval`, `Draft`, `QAVerdict`), 4 agents, tasks, LLM factory (mock + openai providers) with per-run token + estimated-cost logging.

## ⬜ Phase 5 — Flow + routing + storage — PENDING
Wire the CrewAI Flow (classify→retrieve→draft→qa→route), deterministic `routing.py`, SQLAlchemy/SQLite repo (tickets + escalations), full `POST /tickets` and `GET /tickets/{id}`.

## ⬜ Phase 6 — Escalation endpoints + observability — PENDING
`GET /escalations`, `POST /escalations/{id}/approve|reject|edit`, Langfuse-or-logging observability layer.

## ⬜ Phase 7 — Tests — PENDING
pytest: routing thresholds, Pydantic schema validation, queue ops, one end-to-end integration test with the LLM mocked. Fully offline.

## ⬜ Phase 8 — Evals — PENDING
`evals/run_eval.py` + `make eval`: classification accuracy, retrieval hit@k, answer groundedness (LLM-as-judge rubric), escalation precision/recall — printed as a clean table.

## ⬜ Phase 9 — Docs + Docker — PENDING
README (problem, mermaid architecture diagram, setup/run, sample request/response, eval results table, design decisions — CrewAI vs LangGraph, limitations), Dockerfile, docker-compose.

## ⬜ Phase 10 — Git — PENDING
Logical scoped commits throughout. No GitHub remote / push until explicitly approved.

---

## Resume note
Next session in this folder: **resume from Phase 2**. Read `CLAUDE.md` + this file first.
The `.venv` is already built and dependencies installed; `make ingest`/`make run`/`make test` are wired.
