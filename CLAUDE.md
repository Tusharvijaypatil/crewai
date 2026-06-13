# CLAUDE.md — Nimbus Support Triage Crew

Guidance for working in this repository (architecture, conventions, env, how-to-run, build plan).
This is a **standalone** project — it does not import, reference, or reuse any other codebase.

---

## Session handoff

**Standing rules**
- Portfolio repo — code quality + clean git history matter; **match existing patterns**, don't introduce new styling approaches or heavy deps.
- Everything must build and run **offline in mock mode** (`VITE_USE_MOCKS=true`, default).
- **No connectors, integrations, or deploys.** Local file edits + git commits only. User handles deployment manually.

**Done so far** (frontend hardening; all commits **local, not pushed**)
- Phase 1 — Vitest + RTL unit/component suite (22 tests) — `62a9840`
- Phase 2 — Playwright e2e (submit → auto-resolve, mock build) — `0f32d42`
- Phase 3 — OG image (`public/og.png` + `scripts/generate-og.mjs`) + OG/Twitter meta — `a97d703`
- Phase 4 — `frontend/README.md` rewrite — `64c6b3d`

**Pending**
- Phase 5 — GitHub Actions CI: `frontend/**` triggers; lint + typecheck + `npm run test` + `npm run build`, plus a Playwright e2e job; CI badge at top of `frontend/README.md`. Host-agnostic, **no deploy step**.

**Open TODOs (user-driven)**
- Swap the placeholder `og:url`/`og:image` origin (`https://nimbus-triage.netlify.app`) in `frontend/index.html` for the real deploy URL.
- Drop real screenshots into `frontend/docs/`: `landing.png`, `dashboard.png`, `pipeline.gif` (referenced by the README).

---

## What this is

A multi-agent system that ingests customer support tickets, retrieves answers from a knowledge
base (RAG), drafts a grounded reply, QA-checks it for hallucination, then **deterministically**
routes each ticket: auto-resolve high-confidence tickets, or escalate low-confidence / high-priority
ones to a human review queue (human-in-the-loop).

Fictional product the KB describes: **Nimbus**, a cloud automation SaaS.

---

## Architecture

```
POST /tickets
     │
     ▼
┌──────────────────── TriageFlow (CrewAI Flow) ─────────────────────┐
│  @start  classify   → Triage Classifier Agent  → Classification   │
│  @listen retrieve   → Knowledge Retriever Agent → Retrieval (RAG) │
│  @listen draft      → Response Drafter Agent    → Draft            │
│  @listen qa         → QA / Guardrail Agent      → QAVerdict        │
│  @router route()  ──► deterministic Python (NOT an LLM):          │
│        conf >= THRESHOLD and priority != P1  → RESOLVED            │
│        else                                  → PENDING_REVIEW     │
└───────────────────────────────────────────────────────────────────┘
     │                                    │
     ▼                                    ▼
  tickets table (SQLite)          escalations queue (SQLite)
```

**The Flow is the deterministic spine.** Agents reason; routing is plain Python over their
structured Pydantic outputs. The routing decision is never delegated to an LLM.

### Layering (keep concerns swappable)

| Package | Responsibility |
|---|---|
| `app/api/` | FastAPI routers + request/response DTOs (transport only) |
| `app/flow/` | CrewAI Flow + the deterministic routing function |
| `app/crew/` | Agents, tasks, Pydantic output models, the KB search tool |
| `app/services/` | Vector store, embeddings, LLM factory, storage repo, observability |
| `app/core/` | Config, logging, retry/backoff |

### The four agents (all emit structured Pydantic v2 output)

1. **Triage Classifier** (`CLASSIFIER_MODEL`, cheap) → `Classification{category, priority, sentiment, rationale}`
2. **Knowledge Retriever** (tool-driven RAG over Chroma) → `Retrieval{snippets[], sources[], retrieval_confidence}`
3. **Response Drafter** (`DRAFTER_MODEL`, stronger) → `Draft{reply, citations[], can_answer, escalation_reason?}`
4. **QA / Guardrail** (`DRAFTER_MODEL`) → `QAVerdict{grounded, tone_ok, completeness_ok, confidence, passed, issues[]}`

### Routing logic (`app/flow/routing.py`, pure function)

```
escalate if any of:
  - draft.can_answer is False
  - qa.passed is False
  - classification.priority == "P1"
  - qa.confidence < CONFIDENCE_THRESHOLD
else: auto-resolve (status RESOLVED), return the drafted, source-cited reply
```

---

## Conventions

- **Python 3.11+**, full type hints, docstrings on modules/classes/public functions.
- **Pydantic v2** for every structured agent output and API DTO.
- **Config** is read once via `app.core.config.get_settings()` (a cached `Settings` singleton).
  Never read `os.environ` directly elsewhere.
- **Logging** via `app.core.logging.get_logger(__name__)` → structured `key=value` lines.
- **LLM calls** wrapped with `app.core.retry.with_llm_retry` (exponential backoff + jitter).
- **Cost discipline:** default `LLM_PROVIDER=mock` (zero network, zero cost). Real OpenAI calls
  happen only at explicit run-verify checkpoints, on a few sample tickets — never the whole batch.
  Every agent caps `max_tokens`. Each real run logs token usage + estimated cost.
- **Imports of transitive deps** (e.g. `chromadb`) are allowed since crewai guarantees them present.

---

## Environment variables

Copy `.env.example` → `.env`. Defaults run the whole app with **zero keys, zero cost**.

| Var | Default | Purpose |
|---|---|---|
| `LLM_PROVIDER` | `mock` | `mock` (canned, no cost) or `openai` (real, billable) |
| `OPENAI_API_KEY` | — | Required only when `LLM_PROVIDER=openai` |
| `CLASSIFIER_MODEL` | `gpt-4.1-nano` | Cheap model for classification |
| `DRAFTER_MODEL` | `gpt-4.1-mini` | Stronger model for drafting + QA |
| `CLASSIFIER_MAX_TOKENS` | `300` | Output cap (cost guard) |
| `DRAFTER_MAX_TOKENS` | `700` | Output cap (cost guard) |
| `QA_MAX_TOKENS` | `500` | Output cap (cost guard) |
| `LLM_TEMPERATURE` | `0.1` | Sampling temperature |
| `LLM_MAX_RETRIES` | `3` | Retry attempts on LLM failure |
| `EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | Local sentence-transformers model (no cost, offline) |
| `VECTOR_STORE` | `chroma` | `chroma` (local, default) or `pinecone` |
| `CHROMA_PERSIST_DIR` | `.chroma` | On-disk Chroma path |
| `CHROMA_COLLECTION` | `nimbus_kb` | Chroma collection name |
| `RETRIEVAL_TOP_K` | `4` | Top-k snippets retrieved |
| `PINECONE_API_KEY` | — | Required only when `VECTOR_STORE=pinecone` |
| `PINECONE_INDEX` | `nimbus-kb` | Pinecone index name |
| `PINECONE_CLOUD` / `PINECONE_REGION` | `aws` / `us-east-1` | Pinecone serverless location |
| `DATABASE_URL` | `sqlite:///./nimbus.sqlite3` | SQLAlchemy URL (Postgres/Supabase via override) |
| `CONFIDENCE_THRESHOLD` | `75` | Auto-resolve threshold (0–100) |
| `KNOWLEDGE_BASE_DIR` | `data/knowledge_base` | Source markdown for ingest |
| `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` | — | Tracing activates only if BOTH set |
| `LANGFUSE_HOST` | `https://cloud.langfuse.com` | Langfuse endpoint |
| `LOG_LEVEL` | `INFO` | Root log level |
| `API_HOST` / `API_PORT` | `0.0.0.0` / `8000` | Server bind |

Embeddings are **local only by design** (zero embedding cost, offline ingest) — not switchable to OpenAI.
Langfuse is **optional**; install separately (`pip install langfuse`) — kept out of base deps to avoid
OpenTelemetry pin clashes with crewai. Falls back to structured logging when absent.

---

## How to run

```bash
make install   # create .venv (Python 3.11/3.12) + install pinned deps via uv
make ingest    # build the Chroma vector store from data/knowledge_base/
make run       # start FastAPI on :8000 (uvicorn --reload)
make test      # pytest — fully offline, LLM mocked
make eval      # eval harness → metrics table
make lint      # ruff
make clean     # remove .chroma/, *.sqlite3, caches
```

- Everything except live `/tickets` runs with **no API key**. To exercise the real pipeline,
  set `LLM_PROVIDER=openai` + `OPENAI_API_KEY` in `.env` and POST a sample ticket.
- On Windows the Makefile resolves `.venv/Scripts/python.exe`; on POSIX, `.venv/bin/python`.

### API endpoints (mounted across phases)

| Method | Path | Purpose |
|---|---|---|
| POST | `/tickets` | Submit a ticket, run the full pipeline, return resolved-or-escalated result |
| GET | `/tickets/{id}` | Ticket status + full agent trace |
| GET | `/escalations` | List the human review queue |
| POST | `/escalations/{id}/approve\|reject\|edit` | Human actions on a queued ticket |
| POST | `/ingest` | (Re)build the vector store from the KB |
| GET | `/health` | Liveness + effective config |

---

## Dependency management

- `requirements.in` — human-edited, loose. Only `crewai`/`crewai-tools` are pinned; the rest float.
- `requirements.txt` — **fully pinned lockfile** (167 packages), generated by freezing the uv-resolved
  environment. This is what `make install` installs. To change deps: edit `requirements.in`, reinstall,
  re-freeze.
- Installer is **uv** (much faster + clearer conflict reporting than pip). `make install` bootstraps it.

---

## 10-phase build plan

See `PROGRESS.md` for live status (updated at the end of every phase).

1. **Scaffold + config** — tree, deps, `.env.example`, config/logging/retry, FastAPI skeleton + `/health`.
2. **Sample data** — 9 KB markdown docs (Nimbus), 12 varied sample tickets, 18-row eval dataset.
3. **RAG layer** — embeddings, Chroma + Pinecone vectorstore behind one interface, `ingest.py`, `POST /ingest`, `KnowledgeBaseSearchTool`.
4. **Crew** — Pydantic output models, 4 agents, tasks, LLM factory (mock + openai), token/cost logging.
5. **Flow + routing + storage** — wire the CrewAI Flow, deterministic router, SQLite repo, full `POST /tickets` + `GET /tickets/{id}`.
6. **Escalation endpoints + observability** — `GET /escalations`, approve/reject/edit, Langfuse-or-logging.
7. **Tests** — routing thresholds, Pydantic validation, queue ops, one mocked end-to-end integration test.
8. **Evals** — `evals/run_eval.py` + `make eval`: classification accuracy, retrieval hit@k, answer groundedness (LLM-judge), escalation precision/recall, clean table.
9. **Docs + Docker** — README (problem, mermaid diagram, setup, sample req/resp, eval table, design decisions, limitations), Dockerfile, docker-compose.
10. **Git** — logical scoped commits throughout; no remote until the user asks.

---

## Working agreement

- Build **incrementally, one phase at a time**; ensure the project runs after each phase; show the
  result before continuing.
- **Update `PROGRESS.md` at the end of every phase.**
- Ask before destructive commands. Ask before creating any GitHub remote or pushing.
- Keep total real OpenAI spend for the whole build **under $2** (mock-by-default enforces this).
