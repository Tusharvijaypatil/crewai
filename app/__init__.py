"""Nimbus Support Triage Crew — application package.

Importing this package applies two early, process-wide bootstraps *before* any
CrewAI import:

1. Disable CrewAI's remote tracing/telemetry so runs are fully offline and quiet.
2. Force UTF-8 stdio so CrewAI's emoji-laden console output doesn't crash on
   Windows code pages (cp1252 ``charmap`` encode errors).

These set framework env flags only; application config still flows through
``app.core.config``.
"""

import os as _os
import sys as _sys

_os.environ.setdefault("CREWAI_TRACING_ENABLED", "false")
_os.environ.setdefault("CREWAI_TELEMETRY_OPT_OUT", "true")
_os.environ.setdefault("OTEL_SDK_DISABLED", "true")

for _stream in (_sys.stdout, _sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
    except (AttributeError, ValueError):  # non-reconfigurable stream (e.g. captured)
        pass

__version__ = "0.1.0"
