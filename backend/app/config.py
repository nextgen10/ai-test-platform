"""Runtime configuration for the orchestrator.

Everything is environment-driven so the same image runs locally, in Docker and
in Kubernetes without code changes.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

def _project_root() -> Path:
    """This project's own directory, whatever it is named or wherever it sits.

    Source checkout: <project>/backend/app/config.py -> parents[2] is <project>.
    Container image: the layout is flattened to /srv/app/config.py, which has
    fewer parents, so fall back to the topmost. That is fine because the image
    always sets DATABASE_URL and ARTIFACT_ROOT explicitly.

    Anchoring on this directory rather than its parent is deliberate: it keeps
    the project relocatable and rename-safe, with no hardcoded folder name.
    """
    parents = Path(__file__).resolve().parents
    return parents[2] if len(parents) > 2 else parents[-1]


PROJECT_ROOT = _project_root()


class Settings:
    # --- service
    app_name: str = "AI Test Platform"
    api_prefix: str = "/api/v1"
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8100"))

    # --- persistence. SQLite by default so the stack runs with no extra services;
    # point DATABASE_URL at PostgreSQL for anything shared (blueprint §4).
    database_url: str = os.getenv(
        "DATABASE_URL", f"sqlite:///{PROJECT_ROOT / 'jobs.db'}"
    )

    # --- artifacts. Local filesystem by default; swap for S3/MinIO later.
    artifact_root: Path = Path(
        os.getenv("ARTIFACT_ROOT", str(PROJECT_ROOT / "artifacts"))
    )

    # --- per-job runtime control files (engine override, model, credential).
    # Deliberately NOT under artifact_root: everything in a job workspace is
    # downloadable through the artifacts endpoint, and a GitHub PAT must never
    # be. Cleaned up when the job reaches a terminal state.
    runtime_root: Path = Path(
        os.getenv("JOB_RUNTIME_ROOT", str(PROJECT_ROOT / ".job-runtime"))
    )

    # --- execution
    #   local      run the runner as a subprocess (no container required)
    #   docker     run the runner image via `docker run`
    #   kubernetes create an ephemeral Job through the Kubernetes API
    executor: str = os.getenv("EXECUTOR", "local")

    #   copilot    real GitHub Copilot CLI
    #   mock       deterministic stand-in, for wiring up the platform without a token
    engine: str = os.getenv("ENGINE", "mock")

    runner_dir: Path = Path(
        os.getenv("RUNNER_DIR", str(PROJECT_ROOT / "runner"))
    )
    runner_image: str = os.getenv("RUNNER_IMAGE", "ai-test-runner:dev")
    job_timeout_seconds: int = int(os.getenv("JOB_TIMEOUT_SECONDS", "600"))

    # --- kubernetes
    k8s_namespace: str = os.getenv("K8S_NAMESPACE", "ai-testing")
    k8s_service_account: str = os.getenv("K8S_SERVICE_ACCOUNT", "ai-test-runner")
    k8s_secret_name: str = os.getenv("K8S_SECRET_NAME", "copilot-auth")
    k8s_ttl_seconds: int = int(os.getenv("K8S_TTL_SECONDS", "3600"))
    k8s_cpu_request: str = os.getenv("K8S_CPU_REQUEST", "500m")
    k8s_cpu_limit: str = os.getenv("K8S_CPU_LIMIT", "2")
    k8s_memory_request: str = os.getenv("K8S_MEMORY_REQUEST", "1Gi")
    k8s_memory_limit: str = os.getenv("K8S_MEMORY_LIMIT", "4Gi")

    # --- limits (blueprint §41)
    max_concurrent_jobs_per_user: int = int(os.getenv("MAX_CONCURRENT_JOBS_PER_USER", "5"))
    max_concurrent_jobs_total: int = int(os.getenv("MAX_CONCURRENT_JOBS_TOTAL", "20"))
    max_requirement_chars: int = int(os.getenv("MAX_REQUIREMENT_CHARS", "50000"))

    # --- cors
    cors_origins: list[str] = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:3100").split(",")
        if origin.strip()
    ]

    # --- auth. `token` requires API_TOKENS and is the default, so an
    # unconfigured deployment fails at startup instead of serving an open API.
    # `disabled` is an explicit opt-out for a loopback development run.
    auth_mode: str = os.getenv("AUTH_MODE", "token")
    #: "<token>:<name>:<role>[,<token>:<name>:<role>...]" — mounted from a secret.
    api_tokens: str = os.getenv("API_TOKENS", "")

    # --- agent hub
    agent_hub_dir: Path = Path(
        os.getenv("AGENT_HUB_DIR", str(PROJECT_ROOT / "agent-hub"))
    )

    # --- chat
    chat_max_message_chars: int = int(os.getenv("CHAT_MAX_MESSAGE_CHARS", "50000"))
    chat_stream_timeout: int = int(os.getenv("CHAT_STREAM_TIMEOUT", "300"))

    # --- versioning, recorded on every job for reproducibility (blueprint §49)
    runner_version: str = os.getenv("RUNNER_VERSION", "0.1.0")
    skill_version: str = os.getenv("SKILL_VERSION", "test-case-generation:v1")

    def workspace_for(self, job_id: str) -> Path:
        return self.artifact_root / job_id

    def runtime_for(self, job_id: str) -> Path:
        """Where this job's control files and credential live, off the workspace."""
        return self.runtime_root / job_id


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
