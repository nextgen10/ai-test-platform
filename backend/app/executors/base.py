"""Execution backend protocol.

The orchestrator does not care *how* a runner runs — only that it produces the
agreed artifacts in the job workspace and reports an exit status. That keeps the
platform generic (blueprint §55): swapping local -> docker -> kubernetes changes
no orchestration logic.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol


@dataclass
class ExecutionResult:
    succeeded: bool
    exit_code: int
    detail: str = ""
    #: Set by the Kubernetes executor so the job row can record the K8s object.
    external_name: str | None = None


class Executor(Protocol):
    name: str

    def external_name(
        self, job_id: str, stage: str = "generate", attempt: int = 0
    ) -> str | None:
        """Name of the external object this executor will create, if any.

        Known *before* execution starts so the job row can record it while the
        job is still running — that is when an operator most needs it. Executors
        with no external object return None.
        """
        ...

    def run(
        self, job_id: str, workspace: Path, stage: str = "generate",
        reprocess: bool = False, attempt: int = 0
    ) -> ExecutionResult:
        """Execute one runner stage for a job. Blocking.

        `stage` is "quality" (score the requirement) or "generate" (design,
        generate, review and evaluate). `reprocess` feeds the previous
        evaluation's recommendations back into generation.

        `workspace/input/requirement.md` is already staged by the caller. The
        implementation must arrange for the runner's stdout/stderr to end up in
        `workspace/output/execution.log`.
        """
        ...
