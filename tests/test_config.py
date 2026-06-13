"""Regression tests for Settings environment handling.

An env var that is *set but empty* (e.g. ``LLM_PROVIDER=`` in a .env, or a CI
secret that resolves blank) must not crash boot — it should fall back to the
typed default. This guards ``env_ignore_empty=True`` on the Settings config.
"""

from __future__ import annotations

from app.core.config import Settings


def test_empty_env_var_falls_back_to_default(monkeypatch):
    # Set the var but leave it blank. Without env_ignore_empty this fails the
    # Literal["mock","openai"] validation and raises at construction.
    monkeypatch.setenv("LLM_PROVIDER", "")

    settings = Settings(_env_file=None)  # read only the (empty) env var, not .env

    assert settings.llm_provider == "mock"
