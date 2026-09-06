"""Loading the runner's shared modules from the backend.

The runner is a separate deployable — it ships as its own image with its own
requirements — so the backend does not import it at module load time. But three
backend paths need the parts of it that decide what an agent invocation looks
like: the Agent Lab runs agents, the chat console runs agents, and both must
agree with the job runner about tool grants, model fallback and output
contracts. Re-deriving any of that in the backend is how they drifted apart.

So: one loader, imported lazily, cached, with a clear error when the runner tree
is not where the settings say it is.
"""
from __future__ import annotations

import sys
from functools import lru_cache
from typing import Any

from app.config import settings


class RunnerUnavailable(RuntimeError):
    """The runner tree could not be imported."""


def _load(module_name: str) -> Any:
    runner = str(settings.runner_dir)
    if runner not in sys.path:
        sys.path.insert(0, runner)
    try:
        return __import__(module_name)
    except ImportError as exc:  # pragma: no cover - only if the runner is absent
        raise RunnerUnavailable(
            f"Could not load the runner's {module_name} from {runner}: {exc}"
        ) from exc


@lru_cache(maxsize=1)
def agent_io() -> Any:
    """Artifact reading, contract checking and the self-correction loop."""
    return _load("agent_io")


@lru_cache(maxsize=1)
def copilot_cli() -> Any:
    """Command construction, tool grants, model fallback and failure classes."""
    return _load("copilot_cli")


@lru_cache(maxsize=1)
def generic_runner() -> Any:
    """The declarative engine — and the canned documents mock mode stands in with.

    The console reads its mock payloads from here so that a mock run through
    chat, through the Agent Lab and through a job all produce the same document
    for the same agent.
    """
    return _load("generic_runner")
