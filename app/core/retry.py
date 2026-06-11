"""Resilience helpers: retry-with-backoff for flaky LLM / network calls.

Thin wrapper over :mod:`tenacity` so call sites get consistent retry behaviour
(exponential backoff + jitter) and logging without repeating boilerplate.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import TypeVar

from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential_jitter,
)

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)

T = TypeVar("T")


def with_llm_retry(func: Callable[..., T]) -> Callable[..., T]:
    """Decorate a callable with exponential-backoff retries.

    Retries on any :class:`Exception` (LLM/SDK errors are not always typed
    consistently) up to ``LLM_MAX_RETRIES`` attempts, with jittered exponential
    backoff between 1s and 10s.
    """
    settings = get_settings()

    def _before_sleep(retry_state) -> None:  # type: ignore[no-untyped-def]
        logger.warning(
            "llm_call_retry",
            extra={
                "attempt": retry_state.attempt_number,
                "fn": func.__name__,
                "error": repr(retry_state.outcome.exception()) if retry_state.outcome else "",
            },
        )

    decorated = retry(
        stop=stop_after_attempt(max(1, settings.llm_max_retries)),
        wait=wait_exponential_jitter(initial=1, max=10),
        retry=retry_if_exception_type(Exception),
        before_sleep=_before_sleep,
        reraise=True,
    )(func)
    return decorated
