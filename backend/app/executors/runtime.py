"""In-process registry of running executor work, so cancel can actually stop it.

Local and Docker runs are child processes of this orchestrator. Kubernetes runs
are Jobs the API created. Both need a handle the cancel path can reach.
"""
from __future__ import annotations

import logging
import subprocess
import threading

logger = logging.getLogger("ai-test-platform.executors")

_lock = threading.Lock()
_procs: dict[str, subprocess.Popen] = {}


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
