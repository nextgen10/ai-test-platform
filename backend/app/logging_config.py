"""Logging setup.

Two formats, chosen by ``LOG_FORMAT``:

    text  human-readable, the default for a local run
    json  one JSON object per line, for a log pipeline that indexes fields

Both carry the current request ID, so every line emitted while handling a
request — including from the job service and the chat orchestrator — can be
grouped back together.
"""
from __future__ import annotations

import json
import logging
import os
import sys
from contextvars import ContextVar

#: Set by the HTTP middleware for the duration of a request, and by the job
#: service for the duration of a background stage.
request_id_var: ContextVar[str] = ContextVar("request_id", default="-")

#: Set alongside `request_id_var` when the work belongs to a specific job.
job_id_var: ContextVar[str] = ContextVar("job_id", default="-")


class ContextFilter(logging.Filter):
    """Attach the current request and job IDs to every record."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()
        record.job_id = job_id_var.get()
        return True


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", "-"),
            "job_id": getattr(record, "job_id", "-"),
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


_TEXT_FORMAT = "%(asctime)s %(levelname)-8s %(name)s [%(request_id)s/%(job_id)s]: %(message)s"


def configure_logging() -> None:
    """Install handlers on the root logger. Safe to call more than once."""
    root = logging.getLogger()
    for handler in list(root.handlers):
        root.removeHandler(handler)

    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(ContextFilter())

    from app.config import settings

    default_format = "json" if settings.executor != "local" else "text"
    if os.getenv("LOG_FORMAT", default_format).strip().lower() == "json":
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(logging.Formatter(_TEXT_FORMAT))

    root.addHandler(handler)
    root.setLevel(os.getenv("LOG_LEVEL", "INFO").upper())
