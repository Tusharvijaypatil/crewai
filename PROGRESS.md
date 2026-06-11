# PROGRESS — Nimbus Support Triage Crew

Live build status. **Updated at the end of every phase.** See `CLAUDE.md` for the full plan.

**Real OpenAI spend so far: $0.00** (mock-by-default; no live calls yet).

**Current phase: 9 of 10 complete.**

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

## ✅ Phase 4 — Crew — COMPLETE

Pydantic output models, agents + tasks, LLM factory (openai), and a deterministic mock engine.

**Delivered**
- `app/crew/models.py` — `TicketInput` + `Classification`, `Retrieval`, `Draft`, `QAVerdict` (Pydantic v2, validated) + enums (`Category`, `Priority`, `Sentiment`, `TicketStatus`).
- `app/services/llm.py` — `get_llm()` (OpenAI provider, per-agent `max_tokens` cap), `MODEL_PRICING` + `estimate_cost()` (gpt-4.1-nano $0.10/$0.40, gpt-4.1-mini $0.40/$1.60 per Mtok), `RunUsage` accumulator with structured per-run cost logging.
- `app/crew/agents.py` + `tasks.py` — Classifier (nano), Drafter + QA (mini) CrewAI agents with grounding/escalation instructions and `output_pydantic` tasks. Retriever is tool-driven/deterministic by design.
- `app/crew/engine.py` — `TriageEngine` interface + `RealTriageEngine` (runs the crews, records tokens/cost) + `get_triage_engine()` factory. Deterministic `retrieve()` shared by both engines.
- `app/crew/mock.py` — `MockTriageEngine`: keyword classification, **real** RAG retrieval, rule-based grounded/escalating drafts, calibrated QA. Zero network, zero cost.

**Verified** (mock mode, offline)
- Against the 18 labeled rows: **category 18/18 (100%)**, **priority 18/18 (100%)**, **escalation 18/18 (100%)** (applying the Phase-5 routing rule).
- Cost math correct ($0.00022 nano / $0.00088 mini for 1000in/300out; example 3-step run 4,520 tok ≈ $0.00226).
- Factory guards raise clearly: mock provider refuses to build an LLM; `openai` without `OPENAI_API_KEY` errors. `RealTriageEngine` imports clean; default engine is `MockTriageEngine`.

**Key decisions**
- **Retrieval is deterministic in both modes** (vector search → calibrated confidence), removing a hallucination/cost surface; the "4th agent" is tool-driven, matching CLAUDE.md.
- Mock heuristics are a transparent LLM stand-in (not a second model). Substring pitfalls fixed (e.g. "download"→"down", "failure"→"fail", bare "account").
- Sensitive intents (GDPR erasure, billing disputes, account recovery, security incidents) set `can_answer=false` so the router escalates them even when the KB has partial coverage.

## ✅ Phase 5 — Flow + routing + storage — COMPLETE

CrewAI Flow spine, deterministic router, SQLite repo, full `POST /tickets` + `GET /tickets/{id}`.

**Delivered**
- `app/flow/routing.py` — pure `decide()` (escalate if can't-answer / qa-failed / P1 / conf<threshold).
- `app/flow/triage_flow.py` — `TriageFlow(Flow[TriageState])` wiring `@start classify → @listen retrieve → draft → qa → @router route`; engine injected via `PrivateAttr`; `run_triage()` orchestrator persists + logs cost.
- `app/services/storage.py` — SQLAlchemy 2.0 `TicketRow` + `EscalationRow`, `Storage` repo (save_result, get_ticket, list/get/update escalation), JSON trace, cached by DB URL.
- `app/api/routes_tickets.py` + DTOs — `POST /tickets`, `GET /tickets/{id}`; mounted in `main.py`.

**Verified** (mock, offline, $0)
- Answerable → `RESOLVED` P4 conf 93, cited `06-api-rate-limits.md`. P1 outage → `PENDING_REVIEW` (`priority_P1`). GDPR delete → `PENDING_REVIEW` P2 (3 reasons, reply null). Invoice download → `RESOLVED` P4 (substring bug stays fixed).
- Escalation queue persists (2 rows); `GET /tickets/{id}` returns all 6 trace steps; missing id → 404; `nimbus.sqlite3` written.

**Key decisions**
- Engine on the Flow via `PrivateAttr` (Flow is a pydantic model); state is all-default so CrewAI can construct + wrap it with an `id`; ticket passed through `kickoff(inputs=...)`.
- Bootstrap in `app/__init__.py` forces UTF-8 stdio + disables CrewAI tracing/telemetry; flow module silences CrewAI's verbose console panels (clean server logs on Windows).

## ✅ Phase 6 — Escalation endpoints + observability — COMPLETE

Human-in-the-loop review queue endpoints + Langfuse-or-logging observability.

**Delivered**
- `app/services/observability.py` — `Observability` (structured-logging default) + `LangfuseObservability` (used only when both keys set **and** `langfuse` importable; falls back safely). `record_triage()` + `record_human_action()`; cached by `langfuse_enabled`.
- `app/api/routes_escalations.py` — `GET /escalations` (optional `?status=` filter, enriched with ticket subject/category/priority/confidence), `POST /escalations/{id}/approve|reject|edit`. Approve/edit resolve the ticket; reject keeps it held; edit stores the human reply. Mounted in `main.py`.
- DTOs: `EscalationResponse`, `EscalationActionRequest`, `EscalationEditRequest`.
- `run_triage()` now records each run via the observability layer.

**Verified** (mock, offline, $0 — against the two persisted escalations)
- Backend = `logging` (Langfuse absent, as expected).
- `GET /escalations` → 2 rows with ticket context; `?status=PENDING_REVIEW` filter works.
- **approve** P1 → escalation `APPROVED`, ticket `RESOLVED`. **edit** GDPR → escalation `EDITED`, ticket `RESOLVED` with the human reply set. Pending queue then → 0.
- Action on missing id → 404. All four `/escalations*` routes mounted.

**Key decisions**
- Escalation responses are enriched with ticket context so a reviewer sees why an item is queued without a second request.
- Observability is a tiny interface the app depends on; Langfuse stays optional and never breaks a request (trace failures are caught and logged).

## ✅ Phase 7 — Tests — COMPLETE

pytest suite: routing thresholds, schema validation, queue ops, mocked end-to-end. Fully offline.

**Delivered**
- `tests/conftest.py` — fixtures (`settings`, session-autouse `ensure_kb`, per-test temp-SQLite `storage`, `client`) + factories for valid structured outputs.
- `tests/test_routing.py` (7) — resolve-when-all-good, each escalation trigger, inclusive threshold boundary (74/75/76), reason accumulation.
- `tests/test_schemas.py` (8) — enum validation, confidence 0–100 bounds, `issues` None→[], required fields, `.text`/`.context` properties, API DTO min-length.
- `tests/test_queue.py` (9) — resolved-vs-escalated persistence, reply withheld on escalate, get/list/filter, approve→RESOLVED, reject→PENDING_REVIEW, edit→reply+RESOLVED, missing-id→None.
- `tests/test_integration.py` (7) — default engine is mock; answerable→RESOLVED+citations+6-step trace; P1→queue; GDPR→`can_answer:false`; HTTP resolve+trace, 404, 422.

**Verified**
- `pytest` → **35 passed** (≈70s; the embedding model loads once for retrieval tests). Only a third-party Starlette/httpx deprecation warning remains.
- Fixed a `get_sentence_embedding_dimension` FutureWarning in `embeddings.py` (prefer the renamed `get_embedding_dimension`).

**Key decisions**
- Unit tests are hermetic (temp DB, no network); the integration test runs the real Flow with the mock engine, so it covers routing + persistence without cost.

## ✅ Phase 8 — Evals — COMPLETE

`evals/run_eval.py` + `make eval`: four metrics, clean table, mock-by-default with real opt-in.

**Delivered**
- `evals/run_eval.py` (+ `evals/__init__.py`) — runs the pipeline over the 18 labeled rows and reports: **classification accuracy** (category + priority), **retrieval hit@1 / hit@k**, **answer groundedness** (LLM-as-judge rubric in `openai`; deterministic proxy in `mock`), **escalation precision / recall / f1 / accuracy**. Per-ticket compact table + summary with progress bars + per-run estimated cost.
- CLI: `--provider mock|openai` (clears settings cache), `--limit N` (caps tickets so a real run stays under budget). `make eval` runs the no-arg mock default.

**Verified** (`make eval`, mock)
- category **100% (18/18)**, priority **100% (18/18)**, hit@1 **88.9% (16/18)**, hit@4 **100% (18/18)**, groundedness **100% (13/13** answerable, heuristic**)**, escalation **precision/recall/f1/accuracy all 100%** (tp=6, fp=0, fn=0, tn=12). Cost **$0.00000**.
- `--limit 3` works (smaller sample; precision/recall correctly 0 when the sample has no positives).

**Key decisions**
- Eval runs the engine steps directly (no DB writes) so it's side-effect-free and reproducible.
- Groundedness is an honest LLM-judge in real mode and a clearly-labeled deterministic proxy in mock mode — the table prints which judge was used.
- Mock numbers reflect the deterministic heuristic (calibrated to the labels); real accuracy comes from `--provider openai` at a paid checkpoint.

## ✅ Phase 9 — Docs + Docker — COMPLETE

README (mermaid + samples + eval table + design decisions), Dockerfile, docker-compose, .dockerignore.

**Delivered**
- `README.md` — problem statement, **mermaid** architecture diagram, agent/routing tables, quickstart, full API reference with **real** sample request/response (resolve + escalate, captured from mock runs), the `make eval` results table, project layout, **Design decisions** (why CrewAI Flows; when to reach for LangGraph; deterministic routing/retrieval; local embeddings; mock-first cost discipline; pluggable provider/store/db), cost discipline, and limitations.
- `Dockerfile` — `python:3.11-slim`, uv-installed pinned deps, copies app/data/evals, builds the vector store at startup then serves uvicorn; offline (`LLM_PROVIDER=mock`) by default.
- `docker-compose.yml` — API on :8000, env overrides for real-LLM use, persistent volumes (chroma/hf-cache/data), healthcheck on `/health`.
- `.dockerignore` — excludes `.venv`, caches, local state, and secrets from the build context.
- `CLAUDE.md` already current from Phase 1 (architecture, conventions, env, how-to-run, plan).

**Verified**
- `docker compose config` validates (parses, interpolates env, expands volumes).
- Sample request/response in the README are captured from live mock runs (truthful).
- *Not run:* a full `docker build` — the Docker daemon/engine was not running, and a build pulls ~2 GB (torch). The Dockerfile is standard and compose is validated; a live build just needs the daemon started.

**Key decisions**
- README is honest about mock-vs-real: the 100% mock metrics measure the harness/routing, not a model; it documents the `--provider openai` checkpoint for real numbers.
- The container builds the Chroma store at startup (idempotent, offline) so the image is reproducible and key-free.

## ⬜ Phase 10 — Git — PENDING
Logical scoped commits throughout. No GitHub remote / push until explicitly approved.

---

## ✅ Phase 11 — Frontend (React + Vite + TS + Tailwind) — COMPLETE

A portfolio-grade web app in `frontend/` — marketing landing + product dashboard — built against the **real** API contract with a mock-data layer so it demos fully offline.

**Delivered**
- **Design system** (`src/index.css`): Tailwind v4 `@theme` tokens — deep ink base, iris→aqua signature gradient, emerald/amber/rose semantics; Space Grotesk + Geist + Geist Mono (fontsource, offline). Dark-first. Custom utilities (gradient text, glass, grid-bg, aurora, shimmer). `prefers-reduced-motion` respected.
- **Data layer**: typed client mirroring the Pydantic DTOs (`lib/types.ts`), a `VITE_USE_MOCKS` switch (`lib/api.ts`), an in-memory mock pipeline mirroring the backend (`lib/mocks.ts`), TanStack Query hooks with optimistic queue updates (`lib/queries.ts`). Vite proxies `/api → :8000`.
- **Landing** (`/`): hero + animated product mock, the signature **5-stage animated pipeline diagram**, metrics strip, feature grid, how-it-works, pricing, FAQ, footer.
- **Dashboard** (`/app`): Overview (KPIs + recent tickets + SVG confidence trend), Submit (form + live pipeline animation + result), **Ticket detail** (the hero — full agent-trace stepper: classify → retrieve → draft → QA → route with the human-readable routing reason), Review queue (approve/reject/edit via Radix dialog, optimistic + sonner toasts), Health & KB (config cards + ingest with progress).
- Loading skeletons, empty states, error states throughout; responsive mobile→desktop; keyboard/focus states; animated route transitions.
- `make web` target; `frontend/.env.example`.

**Verified**: `npm run build` (tsc typecheck + vite production bundle) passes clean. Runs at `make web` (Vite :5173) — fully in mock mode with the backend off, or live via the `/api` proxy.

**Deploy-ready (static demo)**: route-level code-splitting (entry 207→123 kB gzip; dashboard screens lazy chunks), template files removed, mock fixtures/copy content pass (metrics match the real eval: 67% resolve), `netlify.toml` at repo root (base `frontend/`, SPA redirect, `VITE_USE_MOCKS=true`), README deploy section.

**Note:** backend logic untouched.

---

## Resume note
Next session in this folder: **resume from Phase 10 (git checkpoint)**. Read `CLAUDE.md` + this file first.
The `.venv` is already built and dependencies installed; `make ingest`/`make run` are wired and the
Chroma store + `nimbus.sqlite3` are populated. Phases 1–6 are complete; no git commits since Phase 3
work was last staged (no commits were ever finalized — the repo has 3 commits through Phase 3).
