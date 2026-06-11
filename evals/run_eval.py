"""Evaluation harness — metrics + a clean results table.

Runs the triage pipeline over the labeled dataset (``evals/dataset.jsonl``) and
reports four metrics:

* **Classification accuracy** — category and priority vs. the gold labels.
* **Retrieval hit@k** — whether the labeled ``expected_source`` is in the top-k.
* **Answer groundedness** — is the drafted reply supported by retrieved context?
  An LLM-as-judge rubric in ``openai`` mode; a deterministic proxy in ``mock`` mode.
* **Escalation precision / recall** — predicted escalate vs. ``should_escalate``.

Defaults to ``LLM_PROVIDER=mock`` (free, reproducible). For a real checkpoint::

    python -m evals.run_eval --provider openai --limit 4

``--limit`` caps the number of tickets so a real run stays well under budget.
Per-run token cost is accumulated and printed.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass, field
from pathlib import Path

from app.core.config import Settings, get_settings
from app.core.logging import configure_logging, get_logger
from app.crew.engine import TriageEngine, get_triage_engine
from app.crew.models import Draft, Retrieval, TicketInput
from app.flow.routing import decide
from app.services.knowledge_base import get_knowledge_base
from app.services.llm import RunUsage

logger = get_logger(__name__)

DATASET = Path("evals/dataset.jsonl")


@dataclass
class Tally:
    """Accumulates correct/total for a simple accuracy metric."""

    correct: int = 0
    total: int = 0

    def add(self, ok: bool) -> None:
        self.total += 1
        self.correct += int(ok)

    @property
    def pct(self) -> float:
        return 100.0 * self.correct / self.total if self.total else 0.0


@dataclass
class Confusion:
    """Binary confusion counts for the escalation decision (positive = escalate)."""

    tp: int = 0
    fp: int = 0
    tn: int = 0
    fn: int = 0

    def add(self, predicted: bool, actual: bool) -> None:
        if predicted and actual:
            self.tp += 1
        elif predicted and not actual:
            self.fp += 1
        elif not predicted and actual:
            self.fn += 1
        else:
            self.tn += 1

    @property
    def precision(self) -> float:
        denom = self.tp + self.fp
        return self.tp / denom if denom else 0.0

    @property
    def recall(self) -> float:
        denom = self.tp + self.fn
        return self.tp / denom if denom else 0.0

    @property
    def accuracy(self) -> float:
        total = self.tp + self.fp + self.tn + self.fn
        return (self.tp + self.tn) / total if total else 0.0

    @property
    def f1(self) -> float:
        p, r = self.precision, self.recall
        return 2 * p * r / (p + r) if (p + r) else 0.0


@dataclass
class EvalResults:
    category: Tally = field(default_factory=Tally)
    priority: Tally = field(default_factory=Tally)
    hit_at_1: Tally = field(default_factory=Tally)
    hit_at_k: Tally = field(default_factory=Tally)
    groundedness: Tally = field(default_factory=Tally)
    escalation: Confusion = field(default_factory=Confusion)
    rows: list[dict] = field(default_factory=list)
    total_cost_usd: float = 0.0
    top_k: int = 4
    judge: str = "heuristic"


def _groundedness(
    draft: Draft, retrieval: Retrieval, settings: Settings
) -> bool:
    """Judge whether a drafted reply is grounded in the retrieved context.

    Real mode uses an LLM-as-judge rubric; mock mode uses a deterministic proxy
    (the reply must cite only retrieved sources and contain content).
    """
    if settings.llm_provider == "openai":
        return _llm_groundedness(draft, retrieval, settings)
    # Deterministic proxy: every citation is a retrieved source and the reply is
    # non-trivial. (Mock only answers when it can ground a reply.)
    cited = set(draft.citations)
    return bool(draft.reply.strip()) and bool(cited) and cited.issubset(set(retrieval.sources))


def _llm_groundedness(draft: Draft, retrieval: Retrieval, settings: Settings) -> bool:
    """LLM-as-judge groundedness (openai). Returns True if the reply is grounded."""
    from app.services.llm import get_llm

    llm = get_llm(settings.drafter_model, 150, settings)
    rubric = (
        "You are a strict grounding judge. Given CONTEXT and a REPLY, answer with a single "
        "JSON object {\"grounded\": true|false}. 'grounded' is true ONLY if every factual claim "
        "in the REPLY is supported by the CONTEXT. Do not reward fluent but unsupported claims.\n\n"
        f"CONTEXT:\n{retrieval.context}\n\nREPLY:\n{draft.reply}\n\nJSON:"
    )
    try:
        raw = llm.call([{"role": "user", "content": rubric}])
        start, end = raw.find("{"), raw.rfind("}")
        verdict = json.loads(raw[start : end + 1])
        return bool(verdict.get("grounded", False))
    except Exception as exc:  # pragma: no cover - judge failures fall back conservatively
        logger.warning("groundedness_judge_failed", extra={"error": repr(exc)})
        return False


def evaluate(settings: Settings, limit: int | None = None) -> EvalResults:
    """Run the pipeline over the dataset and compute all metrics."""
    rows = [json.loads(line) for line in DATASET.read_text(encoding="utf-8").splitlines() if line.strip()]
    if limit:
        rows = rows[:limit]

    kb = get_knowledge_base(settings)
    if kb.count() == 0:
        kb.ingest_dir()

    engine: TriageEngine = get_triage_engine(settings)
    results = EvalResults(top_k=settings.retrieval_top_k)
    results.judge = "LLM-judge" if settings.llm_provider == "openai" else "heuristic"

    for r in rows:
        ticket = TicketInput(id=r["id"], subject=r["subject"], body=r["body"])
        usage = RunUsage()

        classification = engine.classify(ticket, usage)
        retrieval = engine.retrieve(ticket, classification)
        draft = engine.draft(ticket, classification, retrieval, usage)
        qa = engine.qa(ticket, draft, retrieval, usage)
        decision = decide(classification, draft, qa, settings.confidence_threshold)
        results.total_cost_usd += usage.total_cost_usd

        # classification
        results.category.add(classification.category.value == r["expected_category"])
        results.priority.add(classification.priority.value == r["expected_priority"])

        # retrieval hit@k
        expected_source = r.get("expected_source")
        if expected_source:
            sources = retrieval.sources
            results.hit_at_1.add(bool(sources) and sources[0] == expected_source)
            results.hit_at_k.add(expected_source in sources[: results.top_k])

        # groundedness (only meaningful for answerable replies)
        grounded = None
        if draft.can_answer:
            grounded = _groundedness(draft, retrieval, settings)
            results.groundedness.add(grounded)

        # escalation
        results.escalation.add(decision.escalate, bool(r["should_escalate"]))

        results.rows.append(
            {
                "id": r["id"],
                "cat": f"{classification.category.value[:4]}/{r['expected_category'][:4]}",
                "pri": f"{classification.priority.value}/{r['expected_priority']}",
                "hit": "Y" if (expected_source and expected_source in retrieval.sources[: results.top_k]) else "-",
                "grnd": "Y" if grounded else ("-" if grounded is None else "N"),
                "esc": f"{int(decision.escalate)}/{int(bool(r['should_escalate']))}",
            }
        )

    return results


def _bar(pct: float, width: int = 20) -> str:
    filled = round(pct / 100 * width)
    return "#" * filled + "." * (width - filled)


def print_report(results: EvalResults, settings: Settings, n: int) -> None:
    """Print a clean, aligned results table."""
    line = "=" * 64
    print(line)
    print(f"NIMBUS TRIAGE — EVAL RESULTS   provider={settings.llm_provider}  n={n}")
    print(line)

    # per-ticket compact table
    print(f"{'id':<6} {'cat(got/exp)':<13} {'pri':<7} {'hit@k':<5} {'grnd':<4} {'esc(g/e)':<8}")
    print("-" * 64)
    for row in results.rows:
        print(
            f"{row['id']:<6} {row['cat']:<13} {row['pri']:<7} "
            f"{row['hit']:<5} {row['grnd']:<4} {row['esc']:<8}"
        )
    print(line)

    def metric(label: str, value: float, extra: str = "") -> None:
        print(f"  {label:<26} {_bar(value)}  {value:5.1f}%  {extra}")

    print("CLASSIFICATION")
    metric("category accuracy", results.category.pct, f"{results.category.correct}/{results.category.total}")
    metric("priority accuracy", results.priority.pct, f"{results.priority.correct}/{results.priority.total}")
    print("RETRIEVAL")
    metric("hit@1", results.hit_at_1.pct, f"{results.hit_at_1.correct}/{results.hit_at_1.total}")
    metric(f"hit@{results.top_k}", results.hit_at_k.pct, f"{results.hit_at_k.correct}/{results.hit_at_k.total}")
    print(f"GROUNDEDNESS  ({results.judge}, answerable replies only)")
    metric("grounded rate", results.groundedness.pct, f"{results.groundedness.correct}/{results.groundedness.total}")
    print("ESCALATION  (positive = escalate)")
    metric("precision", results.escalation.precision * 100, f"tp={results.escalation.tp} fp={results.escalation.fp}")
    metric("recall", results.escalation.recall * 100, f"fn={results.escalation.fn} tn={results.escalation.tn}")
    metric("f1", results.escalation.f1 * 100)
    metric("accuracy", results.escalation.accuracy * 100)
    print(line)
    print(f"estimated LLM cost this run: ${results.total_cost_usd:.5f}  (mock = $0.00000)")
    print(line)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run the Nimbus triage eval harness.")
    parser.add_argument("--provider", choices=["mock", "openai"], default=None,
                        help="Override LLM_PROVIDER for this run.")
    parser.add_argument("--limit", type=int, default=None,
                        help="Evaluate only the first N tickets (use to cap real-LLM cost).")
    args = parser.parse_args(argv)

    if args.provider:
        import os

        os.environ["LLM_PROVIDER"] = args.provider
        get_settings.cache_clear()

    settings = get_settings()
    # Keep the table clean; metrics are the output. Force the level down even if
    # logging was already configured at import time.
    import logging

    configure_logging("WARNING")
    logging.getLogger().setLevel(logging.WARNING)

    rows_n = len(
        [ln for ln in DATASET.read_text(encoding="utf-8").splitlines() if ln.strip()]
    )
    n = min(rows_n, args.limit) if args.limit else rows_n

    results = evaluate(settings, args.limit)
    print_report(results, settings, n)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
