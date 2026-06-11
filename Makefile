# Nimbus Support Triage Crew — developer task runner.
# Cross-platform: PY resolves to the venv interpreter on Windows or POSIX.

ifeq ($(OS),Windows_NT)
	PY := .venv/Scripts/python.exe
	PIP := .venv/Scripts/pip.exe
else
	PY := .venv/bin/python
	PIP := .venv/bin/pip
endif

.DEFAULT_GOAL := help
.PHONY: help venv install ingest run test eval lint clean

help: ## Show this help.
	@echo "Nimbus Support Triage Crew — make targets:"
	@echo "  make install   Create venv and install pinned dependencies"
	@echo "  make ingest    Build the vector store from data/knowledge_base/"
	@echo "  make run       Start the FastAPI server (uvicorn)"
	@echo "  make test      Run pytest (fully offline, LLM mocked)"
	@echo "  make eval      Run the eval harness and print the metrics table"
	@echo "  make lint      Run ruff"
	@echo "  make clean     Remove caches, vector store, and local DB"

venv: ## Create the virtual environment.
	python -m venv .venv

install: venv ## Create venv and install pinned dependencies (via uv resolver).
	$(PIP) install --upgrade pip uv
	$(PY) -m uv pip install --python $(PY) -r requirements.txt
	@echo "Installed. Optional observability: $(PIP) install langfuse"

ingest: ## (Re)build the vector store from the knowledge base.
	$(PY) -m app.ingest

run: ## Start the API server.
	$(PY) -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

test: ## Run the test suite (offline, mocked LLM).
	$(PY) -m pytest

eval: ## Run the eval harness and print metrics.
	$(PY) -m evals.run_eval

lint: ## Lint the codebase.
	$(PY) -m ruff check app evals tests

clean: ## Remove caches and local stores.
	$(PY) -c "import shutil,glob,os; [shutil.rmtree(p,ignore_errors=True) for p in ['.chroma','.pytest_cache','.ruff_cache']]; [os.remove(f) for f in glob.glob('*.sqlite3')]"
