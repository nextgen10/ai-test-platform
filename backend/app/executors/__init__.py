"""Execution backend registry."""
from __future__ import annotations

from app.config import settings
from app.executors.base import ExecutionResult, Executor
from app.executors.docker import DockerExecutor
from app.executors.local import LocalExecutor

__all__ = ["ExecutionResult", "Executor", "get_executor"]


def get_executor(name: str | None = None) -> Executor:
    chosen = (name or settings.executor).lower()

    if chosen == "local":
        return LocalExecutor()
    if chosen == "docker":
        return DockerExecutor()
    if chosen in {"kubernetes", "k8s"}:
        # Imported lazily: the module pulls in the optional kubernetes client.
        from app.executors.kubernetes_exec import KubernetesExecutor

        return KubernetesExecutor()

    raise ValueError(
        f"Unknown EXECUTOR {chosen!r}. Expected one of: local, docker, kubernetes."
    )
