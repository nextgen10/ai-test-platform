"""Docker executor — one disposable container per job.

The container gets the job workspace bind-mounted and nothing else: no docker
socket, no host network, non-root, dropped capabilities (blueprint §19).
"""
from __future__ import annotations

import os
import subprocess
from pathlib import Path

from app.config import settings
from app.executors.base import ExecutionResult


class DockerExecutor:
    name = "docker"

    def external_name(self, job_id: str, stage: str = "generate", attempt: int = 0) -> None:
        """Container is `--rm` and short-lived, so there is no object to record."""
        return None

    def run(
        self, job_id: str, workspace: Path, stage: str = "generate",
        reprocess: bool = False, attempt: int = 0
    ) -> ExecutionResult:
        log_path = workspace / "output" / "execution.log"
        log_path.parent.mkdir(parents=True, exist_ok=True)

        command = [
            "docker",
            "run",
            "--rm",
            "--name",
            f"ai-test-runner-{job_id}",
            "--user",
            "10001:10001",
            "--cap-drop",
            "ALL",
            "--security-opt",
            "no-new-privileges",
            "--memory",
            settings.k8s_memory_limit,
            "--cpus",
            settings.k8s_cpu_limit,
            "-v",
            f"{workspace}:/workspace",
            "-e",
            f"JOB_ID={job_id}",
            "-e",
            f"ENGINE={settings.engine}",
            "-e",
            f"STAGE={stage}",
            "-e",
            f"REPROCESS={'1' if reprocess else '0'}",
            "-e",
            "WORKSPACE=/workspace",
            "-e",
            f"RUNNER_VERSION={settings.runner_version}",
            "-e",
            f"SKILL_VERSION={settings.skill_version}",
        ]

        # Job-specific overrides win over global env
        model_file = workspace / "input" / ".copilot_model"
        if model_file.exists():
            command += ["-e", f"COPILOT_MODEL={model_file.read_text(encoding='utf-8').strip()}"]

        token_file = workspace / "input" / ".copilot_token"
        if token_file.exists():
            tok_val = token_file.read_text(encoding="utf-8").strip()
            command += [
                "-e", f"COPILOT_GITHUB_TOKEN={tok_val}",
                "-e", f"GH_TOKEN={tok_val}",
                "-e", f"GITHUB_TOKEN={tok_val}",
            ]
        elif any(os.getenv(k) for k in ("COPILOT_GITHUB_TOKEN", "GH_TOKEN", "GITHUB_TOKEN")):
            token = os.getenv("COPILOT_GITHUB_TOKEN") or os.getenv("GH_TOKEN") or os.getenv("GITHUB_TOKEN")
            command += [
                "-e", f"COPILOT_GITHUB_TOKEN={token}",
                "-e", f"GH_TOKEN={token}",
                "-e", f"GITHUB_TOKEN={token}",
            ]

        command.append(settings.runner_image)

        with log_path.open("w", encoding="utf-8") as log_file:
            try:
                proc = subprocess.run(
                    command,
                    stdout=log_file,
                    stderr=subprocess.STDOUT,
                    timeout=settings.job_timeout_seconds,
                    check=False,
                )
            except FileNotFoundError:
                return ExecutionResult(
                    succeeded=False,
                    exit_code=127,
                    detail="docker CLI not found on the orchestrator host",
                )
            except subprocess.TimeoutExpired:
                subprocess.run(
                    ["docker", "kill", f"ai-test-runner-{job_id}"],
                    capture_output=True,
                    check=False,
                )
                return ExecutionResult(
                    succeeded=False,
                    exit_code=124,
                    detail=f"Container exceeded {settings.job_timeout_seconds}s timeout",
                )

        if proc.returncode == 0:
            return ExecutionResult(succeeded=True, exit_code=0)

        return ExecutionResult(
            succeeded=False,
            exit_code=proc.returncode,
            detail=f"Container exited with code {proc.returncode}",
        )
