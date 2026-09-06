"""In-process registry of running executor work, so cancel can actually stop it.

Local and Docker runs are child processes of this orchestrator. Kubernetes runs
are Jobs the API created. Both need a handle the cancel path can reach.
"""
from __future__ import annotations

import logging
import subprocess
import threading

from app.config import settings

logger = logging.getLogger("ai-test-platform.executors")

_lock = threading.Lock()
_procs: dict[str, subprocess.Popen] = {}


def runtime_value(job_id: str, name: str) -> str | None:
    """Read one per-job control file from the runtime directory.

    These live outside the workspace on purpose: everything inside a workspace
    is downloadable through the artifacts endpoint, and one of these is a
    credential.
    """
    path = settings.runtime_for(job_id) / name
    if not path.is_file():
        return None
    value = path.read_text(encoding="utf-8").strip()
    return value or None


def resolve_job_engine(job_id: str) -> str:
    """Engine this job was submitted with.

    The process default is only used when no per-job engine was staged. A
    completed Copilot job must not pick up ``ENGINE=mock`` on reprocess.
    """
    override = runtime_value(job_id, "engine")
    if override in {"mock", "copilot"}:
        return override
    return settings.engine


def register_process(job_id: str, proc: subprocess.Popen) -> None:
    with _lock:
        _procs[job_id] = proc


def unregister_process(job_id: str) -> None:
    with _lock:
        _procs.pop(job_id, None)


def kill_process(job_id: str) -> bool:
    """Terminate a registered local/docker child. True if a process was signalled."""
    with _lock:
        proc = _procs.get(job_id)
    if proc is None or proc.poll() is not None:
        return False
    try:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=5)
        logger.info("killed executor process for job %s", job_id)
        return True
    except OSError:
        logger.exception("could not kill executor process for job %s", job_id)
        return False
