"""Structured logging setup.

Provides a single :func:`configure_logging` entry point plus a :func:`get_logger`
helper. Logs are emitted as compact key=value lines so they are greppable in a
terminal and parseable by log shippers, without pulling in a heavy dependency.
"""

from __future__ import annotations

import logging
import sys
from typing import Any

_CONFIGURED = False


class KeyValueFormatter(logging.Formatter):
    """Render log records as ``ts level logger msg key=value ...`` lines."""

    _RESERVED = set(
        logging.LogRecord("", 0, "", 0, "", (), None).__dict__.keys()
    ) | {"message", "asctime"}

    def format(self, record: logging.LogRecord) -> str:
        base = f"{self.formatTime(record, '%Y-%m-%dT%H:%M:%S')} " \
               f"{record.levelname:<5} {record.name} {record.getMessage()}"
        extras = {
            k: v for k, v in record.__dict__.items() if k not in self._RESERVED
        }
        if extras:
            kv = " ".join(f"{k}={_render(v)}" for k, v in extras.items())
            base = f"{base} {kv}"
        if record.exc_info:
            base = f"{base}\n{self.formatException(record.exc_info)}"
        return base


def _render(value: Any) -> str:
    text = str(value)
    return f'"{text}"' if " " in text else text


def configure_logging(level: str = "INFO") -> None:
    """Configure root logging once; subsequent calls are no-ops."""
    global _CONFIGURED
    if _CONFIGURED:
        return
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(KeyValueFormatter())
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level.upper())
    # Quiet noisy third-party loggers.
    for noisy in ("httpx", "chromadb", "sentence_transformers", "urllib3"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    _CONFIGURED = True


def get_logger(name: str) -> logging.Logger:
    """Return a namespaced logger (configures logging on first use)."""
    if not _CONFIGURED:
        configure_logging()
    return logging.getLogger(name)
