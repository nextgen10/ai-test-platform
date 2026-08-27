"""Local subprocess executor.

Runs the runner directly on the host. No isolation — intended for development
and for proving the vertical slice before containers exist (blueprint §8 phase 1).
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from app.config import settings
from app.executors.base import ExecutionResult


def _runtime_value(job_id: str, name: str) -> str | None:
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


class LocalExecutor:
    name = "local"

    def external_name(self, job_id: str, stage: str = "generate", attempt: int = 0) -> None:
        """No external object: the runner is a child process of this host."""
        return None

    def run(
        self, job_id: str, workspace: Path, stage: str = "generate",
        reprocess: bool = False, attempt: int = 0,
        workflow: str = "test-case-generation", runner: str = "bespoke",
    ) -> ExecutionResult:
        log_path = workspace / "output" / "execution.log"
        log_path.parent.mkdir(parents=True, exist_ok=True)

        job_engine = settings.engine
        override_engine = _runtime_value(job_id, "engine")
        if override_engine in {"mock", "copilot"}:
            job_engine = override_engine

        env = os.environ.copy()
        env.update(
            {
                "JOB_ID": job_id,
                "ENGINE": job_engine,
                "WORKSPACE": str(workspace),
                "APP_DIR": str(settings.runner_dir),
                "AGENT_HUB_DIR": str(settings.agent_hub_dir),
                "RUNNER_VERSION": settings.runner_version,
                "SKILL_VERSION": settings.skill_version,
                "PYTHONUNBUFFERED": "1",
                "STAGE": stage,
                "REPROCESS": "1" if reprocess else "0",
            }
        )

        model = _runtime_value(job_id, "copilot_model")
        if model:
            env["COPILOT_MODEL"] = model

        token = _runtime_value(job_id, "copilot_token") or (
            env.get("COPILOT_GITHUB_TOKEN") or env.get("GH_TOKEN") or env.get("GITHUB_TOKEN")
        )
        if token:
            env["COPILOT_GITHUB_TOKEN"] = token
            env["GH_TOKEN"] = token
            env["GITHUB_TOKEN"] = token

        if runner == "generic":
            command = [
                sys.executable,
                str(settings.runner_dir / "generic_runner.py"),
                "--workflow",
                workflow,
                "--workspace",
                str(workspace),
                "--hub-dir",
                str(settings.agent_hub_dir),
            ]
        else:
            command = [
                sys.executable,
                str(settings.runner_dir / "agent_chain.py"),
                "--workspace",
                str(workspace),
                "--app-dir",
                str(settings.runner_dir),
                "--engine",
                job_engine,
                "--stage",
                stage,
            ]
            if reprocess:
                command.append("--reprocess")

        with log_path.open("w", encoding="utf-8") as log_file:
            try:
                proc = subprocess.run(
                    command,
                    env=env,
                    stdout=log_file,
                    stderr=subprocess.STDOUT,
                    timeout=settings.job_timeout_seconds,
                    check=False,
                )
            except subprocess.TimeoutExpired:
                log_file.write(
                    f"\nTIMEOUT: exceeded {settings.job_timeout_seconds}s\n"
                )
                return ExecutionResult(
                    succeeded=False,
                    exit_code=124,
                    detail=f"Runner exceeded {settings.job_timeout_seconds}s timeout",
                )

        if proc.returncode == 0:
            return ExecutionResult(succeeded=True, exit_code=0)

        return ExecutionResult(
            succeeded=False,
            exit_code=proc.returncode,
            detail=f"Runner exited with code {proc.returncode}",
        )
