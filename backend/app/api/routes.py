"""REST surface (blueprint §25)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.jobs import JobStatus
from app.schemas.jobs import (
    AVAILABLE_MODELS,
    ApprovalRequest,
    JobCreateRequest,
    JobCreateResponse,
    JobDetailOut,
    JobOut,
    LogsResponse,
    OcrExtractRequest,
    OcrExtractResponse,
    ResultResponse,
)
from app.security import Principal, require_operator, require_reader
from app.services import hub_registry, job_service
from app.services.ghcp_ocr import GHCPVisionExtractor
from app.services.job_service import JobError

router = APIRouter(prefix=settings.api_prefix)


def _handle(exc: JobError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=str(exc))


# ------------------------------------------------------------------- meta

@router.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    """Liveness. Deliberately unauthenticated and dependency-free."""
    return {
        "status": "ok",
        "executor": settings.executor,
        "engine": settings.engine,
    }


@router.get("/ready", tags=["meta"])
def ready() -> dict[str, object]:
    """Readiness: can this process actually serve work right now?

    Distinct from `/health` on purpose — a process can be alive with an
    unreachable database or a missing Copilot CLI, and a load balancer needs to
    know the difference.
    """
    checks: dict[str, dict[str, object]] = {}

    # Database
    try:
        from sqlalchemy import text

        from app.database import engine

        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        checks["database"] = {"ok": True}
    except Exception as exc:  # noqa: BLE001 - report, never raise, from a probe
        checks["database"] = {"ok": False, "detail": str(exc)}

    # Artifact storage
    try:
        settings.artifact_root.mkdir(parents=True, exist_ok=True)
        checks["artifacts"] = {"ok": True, "path": str(settings.artifact_root)}
    except Exception as exc:  # noqa: BLE001
        checks["artifacts"] = {"ok": False, "detail": str(exc)}

    # Agent hub
    hub_ok = settings.agent_hub_dir.is_dir()
    checks["agent_hub"] = {
        "ok": hub_ok,
        "path": str(settings.agent_hub_dir),
        "workflows": len(hub_registry.list_workflows()) if hub_ok else 0,
    }

    # Execution engine
    if settings.engine == "mock":
        checks["engine"] = {"ok": True, "engine": "mock", "detail": "stand-in output"}
    else:
        import shutil as _shutil

        copilot = _shutil.which(job_service.copilot_bin())
        checks["engine"] = {
            "ok": bool(copilot),
            "engine": "copilot",
            "detail": copilot or f"{job_service.copilot_bin()!r} not found on PATH",
        }

    ok = all(check["ok"] for check in checks.values())
    if not ok:
        raise HTTPException(status_code=503, detail={"status": "not_ready", "checks": checks})
    return {"status": "ready", "checks": checks}


@router.get("/settings", tags=["meta"])
def get_settings_info(_: Principal = Depends(require_reader)) -> dict[str, object]:
    """Report the platform's configuration.

    Read-only by design. The engine used to be mutable through a POST here,
    which made one user's choice a process-global that silently applied to
    everyone else. Callers now pass `engine` per job or per message instead.
    """
    return {
        "status": "ok",
        "executor": settings.executor,
        "engine": settings.engine,
        "app_name": settings.app_name,
        "auth_mode": settings.auth_mode,
        "server_token_configured": job_service.platform_token_configured(),
    }


@router.get("/models", tags=["meta"])
def models(_: Principal = Depends(require_reader)) -> list[dict[str, str]]:
    """List supported AI models for Copilot generation."""
    return AVAILABLE_MODELS


@router.get("/workflows", tags=["meta"])
def workflows(_: Principal = Depends(require_reader)) -> list[dict[str, object]]:
    """Workflow catalog, read from the hub registry.

    Adding a workflow is a data change: drop a `.workflow.yaml` into
    `agent-hub/workflows/` and it appears here, in the Registry UI, and as a
    valid `workflow` on a job.
    """
    return hub_registry.list_workflows()


@router.get("/skills", tags=["skills"])
def list_skills(_: Principal = Depends(require_reader)) -> list[dict[str, object]]:
    """Loaded skills.

    Deprecated in favour of `/hub/skills`, which returns the same records with
    more metadata. Kept so existing clients keep working; both now read the same
    directory, so they can no longer disagree.
    """
    return [
        {
            "id": skill["id"],
            "name": skill["name"],
            "path": skill["path"],
            "content": skill["content"],
            "version": skill["version"],
            "available": True,
        }
        for skill in hub_registry.list_skills()
    ]


@router.get("/agents", tags=["agents"])
def list_agents(_: Principal = Depends(require_reader)) -> list[dict[str, object]]:
    """Loaded agent profiles.

    Deprecated in favour of `/hub/agents`. The role, stage and artifact fields
    come from each agent's own frontmatter, so an agent onboarded through the
    Registry describes itself here without a code change.
    """
    return [
        {
            "id": agent["id"],
            "name": agent["name"],
            "role": agent["role"],
            # The agent's own one-line summary. Additive: clients that do not
            # know about it are unaffected, and it saves the Docs page keeping a
            # hand-written blurb for every agent in the hub.
            "description": agent["description"],
            "tools": agent["tools"] or ["read"],
            "input_artifact": agent["input_artifact"],
            "output_artifact": agent["output_artifact"],
            "stage": agent["stage"],
            "content": agent["content"],
            "file": agent["file"],
        }
        for agent in hub_registry.list_agents()
    ]


@router.get("/evaluations/benchmarks", tags=["evaluation"])
def get_evaluation_benchmarks(
    db: Session = Depends(get_db),
    _: Principal = Depends(require_reader),
) -> dict[str, object]:
    """Return golden benchmark datasets and platform evaluation metrics."""
    from app.config import PROJECT_ROOT
    samples_dir = PROJECT_ROOT / "samples"
    benchmarks: list[dict[str, object]] = []

    if samples_dir.exists():
        for sample_file in sorted(samples_dir.glob("*.md")):
            benchmarks.append({
                "id": sample_file.stem,
                "title": sample_file.stem.replace("-", " "),
                "filename": sample_file.name,
                "content": sample_file.read_text(encoding="utf-8"),
                "size_bytes": sample_file.stat().st_size,
            })

    stats = job_service.platform_stats(db)

    return {
        "dimensions": [
            {
                "id": "coverage",
                "name": "Coverage",
                "weight": 0.30,
                "description": "5 categories (functional, negative, boundary, validation, data) represented proportionally.",
            },
            {
                "id": "completeness",
                "name": "Completeness",
                "weight": 0.25,
                "description": "Concrete preconditions, specific sequential steps, and verifiable expected results.",
            },
            {
                "id": "traceability",
                "name": "Traceability",
                "weight": 0.20,
                "description": "Valid requirement references mapping every case to stated source business rules.",
            },
            {
                "id": "correctness",
                "name": "Correctness",
                "weight": 0.15,
                "description": "Expected results accurately reflect stated outcomes without hallucinated constraints.",
            },
            {
                "id": "uniqueness",
                "name": "Uniqueness",
                "weight": 0.10,
                "description": "Non-redundant scenarios with duplicate title rate under 10%.",
            },
        ],
        "benchmarks": benchmarks,
        "platform_stats": stats,
    }


@router.get("/stats", tags=["meta"])
def stats(
    db: Session = Depends(get_db),
    _: Principal = Depends(require_reader),
) -> dict[str, object]:
    return job_service.platform_stats(db)


# ------------------------------------------------------------------- jobs

@router.post("/jobs", response_model=JobCreateResponse, status_code=201, tags=["jobs"])
def create_job(
    payload: JobCreateRequest,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_operator),
) -> JobCreateResponse:
    try:
        job = job_service.create_job(
            db,
            workflow=payload.workflow,
            requirement=payload.requirement,
            # The authenticated principal owns the job, not a caller-supplied
            # string — otherwise per-user rate limits are trivially bypassed.
            created_by=principal.name,
            copilot_model=payload.copilot_model,
            github_token=payload.github_token,
            engine=payload.engine,
            used_ocr=payload.used_ocr,
            webhook_url=payload.webhook_url,
        )
    except JobError as exc:
        raise _handle(exc) from exc

    # Nothing is dispatched here. The row is the work item, and a worker claims
    # it from the queue — which is what lets the submitting process restart, or
    # a different replica pick it up, without losing the job.
    return JobCreateResponse(job_id=job.id, status=job.status)


@router.get("/jobs", response_model=list[JobOut], tags=["jobs"])
def list_jobs(
    limit: int = Query(50, ge=1, le=200),
    status: JobStatus | None = None,
    db: Session = Depends(get_db),
    _: Principal = Depends(require_reader),
) -> list[JobOut]:
    jobs = job_service.list_jobs(db, limit=limit, status=status)
    return [JobOut.model_validate(job) for job in jobs]


@router.get("/jobs/{job_id}", response_model=JobDetailOut, tags=["jobs"])
def get_job(
    job_id: str,
    db: Session = Depends(get_db),
    _: Principal = Depends(require_reader),
) -> JobDetailOut:
    try:
        job = job_service.get_job(db, job_id)
    except JobError as exc:
        raise _handle(exc) from exc
    return JobDetailOut.model_validate(job)


@router.get("/jobs/{job_id}/logs", response_model=LogsResponse, tags=["jobs"])
def get_logs(
    job_id: str,
    db: Session = Depends(get_db),
    _: Principal = Depends(require_reader),
) -> LogsResponse:
    try:
        job = job_service.get_job(db, job_id)
    except JobError as exc:
        raise _handle(exc) from exc
    return LogsResponse(job_id=job.id, status=job.status, logs=job_service.read_logs(job))


@router.get("/jobs/{job_id}/result", response_model=ResultResponse, tags=["jobs"])
def get_result(
    job_id: str,
    db: Session = Depends(get_db),
    _: Principal = Depends(require_reader),
) -> ResultResponse:
    try:
        job = job_service.get_job(db, job_id)
        result, validation = job_service.read_result(job)
    except JobError as exc:
        raise _handle(exc) from exc
    return ResultResponse(
        job_id=job.id,
        status=job.status,
        result=result,
        validation=validation,
        summary=job.summary,
    )


@router.get("/jobs/{job_id}/artifacts", tags=["jobs"])
def list_artifacts(
    job_id: str,
    db: Session = Depends(get_db),
    _: Principal = Depends(require_reader),
) -> list[dict[str, object]]:
    try:
        job = job_service.get_job(db, job_id)
    except JobError as exc:
        raise _handle(exc) from exc
    return job_service.list_artifacts(job)


@router.get("/jobs/{job_id}/artifacts/{artifact_path:path}", tags=["jobs"])
def download_artifact(
    job_id: str,
    artifact_path: str,
    db: Session = Depends(get_db),
    _: Principal = Depends(require_reader),
) -> FileResponse:
    try:
        job = job_service.get_job(db, job_id)
    except JobError as exc:
        raise _handle(exc) from exc

    workspace = settings.workspace_for(job.id).resolve()
    target = (workspace / artifact_path).resolve()

    # Path traversal guard: the resolved target must stay inside the workspace.
    if not target.is_relative_to(workspace) or not target.is_file():
        raise HTTPException(status_code=404, detail="Artifact not found")

    # Dotfiles in a workspace are the orchestrator's own control files —
    # .copilot_token above all — never user-facing output. They are excluded
    # from the listing, so serving one here would be a way around that.
    if not job_service.is_public_artifact(target.relative_to(workspace)):
        raise HTTPException(status_code=404, detail="Artifact not found")

    return FileResponse(target, filename=target.name)


@router.post("/jobs/{job_id}/approve", response_model=JobOut, tags=["workflow"])
def approve_job(
    job_id: str,
    payload: ApprovalRequest,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_operator),
) -> JobOut:
    """Accept the requirement quality and release test generation.

    The job moves to RUNNING with no lease, which is the queue's signal that the
    stage after the gate is owed; a worker picks it up from there.
    """
    try:
        job = job_service.get_job(db, job_id)
        job = job_service.approve_job(db, job, principal.name)
    except JobError as exc:
        raise _handle(exc) from exc

    return JobOut.model_validate(job)


@router.post("/jobs/{job_id}/reject", response_model=JobOut, tags=["workflow"])
def reject_job(
    job_id: str,
    payload: ApprovalRequest,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_operator),
) -> JobOut:
    """Stop at the gate: the requirement is not ready to generate from."""
    try:
        job = job_service.get_job(db, job_id)
        job = job_service.reject_job(db, job, principal.name, payload.reason)
    except JobError as exc:
        raise _handle(exc) from exc
    return JobOut.model_validate(job)


@router.post("/jobs/{job_id}/reprocess", response_model=JobOut, tags=["workflow"])
def reprocess_job(
    job_id: str,
    db: Session = Depends(get_db),
    _: Principal = Depends(require_operator),
) -> JobOut:
    """Re-run generation once, feeding the evaluator's recommendations back in."""
    try:
        job = job_service.get_job(db, job_id)
        job = job_service.start_reprocess(db, job)
    except JobError as exc:
        raise _handle(exc) from exc

    return JobOut.model_validate(job)


@router.delete("/jobs/{job_id}", response_model=JobOut, tags=["jobs"])
def cancel_job(
    job_id: str,
    db: Session = Depends(get_db),
    _: Principal = Depends(require_operator),
) -> JobOut:
    try:
        job = job_service.get_job(db, job_id)
        job = job_service.cancel_job(db, job)
    except JobError as exc:
        raise _handle(exc) from exc
    return JobOut.model_validate(job)


# -------------------------------------------------------------------- ocr

@router.post("/ocr/extract", response_model=OcrExtractResponse, tags=["ocr"])
def extract_ocr(
    payload: OcrExtractRequest,
    _: Principal = Depends(require_operator),
) -> OcrExtractResponse:
    """Visually extract structured requirements from image/document bytes using GHCP Vision."""
    import base64
    try:
        image_bytes = base64.b64decode(payload.image_base64, validate=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid base64 payload: {exc}") from exc

    extractor = GHCPVisionExtractor(
        github_token=payload.github_token,
        model=payload.copilot_model or "gpt-4o",
    )
    markdown_content = extractor.extract_from_bytes(
        image_bytes,
        mime_type=payload.mime_type,
        custom_instructions=payload.instructions,
    )

    return OcrExtractResponse(
        markdown=markdown_content,
        filename=payload.filename,
        char_count=len(markdown_content),
        # Callers must be able to tell a real Vision extraction from a canned
        # stand-in (no/invalid token, mock engine, or an API failure) — both
        # paths return 200 with usable Markdown, but only one is real OCR.
        engine="ghcp-vision-fallback" if extractor.used_fallback else "ghcp-vision",
    )
