"""REST surface (blueprint §25)."""
from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
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
    ResultResponse,
)
from app.services import job_service
from app.services.job_service import JobError

router = APIRouter(prefix=settings.api_prefix)


def _handle(exc: JobError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=str(exc))


@router.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "executor": settings.executor,
        "engine": settings.engine,
    }


@router.get("/models", tags=["meta"])
def models() -> list[dict[str, str]]:
    """List supported AI models for Copilot generation."""
    return AVAILABLE_MODELS


@router.get("/workflows", tags=["meta"])
def workflows() -> list[dict[str, object]]:
    """Workflow catalog. Adding a workflow is a data change, not a platform change."""
    return [
        {
            "id": "test-case-generation",
            "name": "Test Generator",
            "description": (
                "Generate functional, negative, boundary, validation and data test "
                "cases from a business requirement, with traceability."
            ),
            "available": True,
            "skill": "test-case-generation",
            "agents": ["test-designer", "test-generator", "test-reviewer"],
        },
        {
            "id": "requirement-analysis",
            "name": "Analytic Genie (Requirement Analysis)",
            "description": "Extract actors, business rules, and assess INVEST quality criteria before test design.",
            "available": True,
            "skill": "test-case-generation",
            "agents": ["requirement-analyst"],
        },
        {
            "id": "test-evaluation",
            "name": "Test Suite Evaluation",
            "description": "Independently score test suites against requirements across 5 quality dimensions.",
            "available": True,
            "skill": "test-case-generation",
            "agents": ["test-evaluator"],
        },
    ]


@router.get("/skills", tags=["skills"])
def list_skills() -> list[dict[str, object]]:
    """List loaded Copilot skills with instructions and metadata."""
    from app.config import PROJECT_ROOT
    skills_dir = PROJECT_ROOT / "copilot" / ".github" / "skills"
    results: list[dict[str, object]] = []

    if skills_dir.exists():
        for skill_path in sorted(skills_dir.iterdir()):
            if skill_path.is_dir():
                skill_md = skill_path / "SKILL.md"
                content = skill_md.read_text(encoding="utf-8") if skill_md.exists() else ""
                results.append({
                    "id": skill_path.name,
                    "name": skill_path.name.replace("-", " ").title(),
                    "path": f".github/skills/{skill_path.name}/SKILL.md",
                    "content": content,
                    "version": settings.skill_version,
                    "available": True,
                })

    if not results:
        results.append({
            "id": "test-case-generation",
            "name": "Test Case Generation",
            "path": ".github/skills/test-case-generation/SKILL.md",
            "content": "# Test Case Generation\n\nGenerate comprehensive, traceable test cases.",
            "version": settings.skill_version,
            "available": True,
        })
    return results


@router.get("/agents", tags=["agents"])
def list_agents() -> list[dict[str, object]]:
    """List loaded Copilot agent profiles and reasoning workflows."""
    from app.config import PROJECT_ROOT
    agents_dir = PROJECT_ROOT / "copilot" / ".github" / "agents"
    agents: list[dict[str, object]] = []

    agent_roles = {
        "requirement-analyst": {
            "role": "Analytic Genie — INVEST Quality Gatekeeper",
            "input": "input/requirement.md",
            "output": "output/quality_report.json",
            "stage": "quality",
        },
        "test-designer": {
            "role": "QA Architect & Scenario Strategist",
            "input": "input/requirement.md",
            "output": "intermediate/test_design.json",
            "stage": "generate (Phase 1)",
        },
        "test-generator": {
            "role": "Concrete Test Author",
            "input": "intermediate/test_design.json",
            "output": "intermediate/draft_test_cases.json",
            "stage": "generate (Phase 2)",
        },
        "test-reviewer": {
            "role": "Independent Critic & Gate Enforcer",
            "input": "intermediate/draft_test_cases.json",
            "output": "output/test_cases.json",
            "stage": "generate (Phase 3)",
        },
        "test-evaluator": {
            "role": "Suite Quality Scorer & Recommendation Engine",
            "input": "output/test_cases.json",
            "output": "output/evaluation.json",
            "stage": "evaluate",
        },
        "gap-closer": {
            "role": "Suite Amendment & Gap Remediation",
            "input": "output/evaluation.json + output/test_cases.json",
            "output": "output/test_cases.json",
            "stage": "reprocess",
        },
    }

    if agents_dir.exists():
        for agent_file in sorted(agents_dir.glob("*.agent.md")):
            name = agent_file.name.replace(".agent.md", "")
            content = agent_file.read_text(encoding="utf-8")
            meta = agent_roles.get(name, {
                "role": "Custom Agent",
                "input": "workspace",
                "output": "workspace",
                "stage": "chain",
            })
            agents.append({
                "id": name,
                "name": name.replace("-", " ").title(),
                "role": meta["role"],
                "tools": ["read", "write"],
                "input_artifact": meta["input"],
                "output_artifact": meta["output"],
                "stage": meta["stage"],
                "content": content,
                "file": f".github/agents/{agent_file.name}",
            })

    return agents


@router.get("/evaluations/benchmarks", tags=["evaluation"])
def get_evaluation_benchmarks(db: Session = Depends(get_db)) -> dict[str, object]:
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
def stats(db: Session = Depends(get_db)) -> dict[str, object]:
    return job_service.platform_stats(db)


@router.post("/jobs", response_model=JobCreateResponse, status_code=201, tags=["jobs"])
def create_job(
    payload: JobCreateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> JobCreateResponse:
    try:
        job = job_service.create_job(
            db,
            workflow=payload.workflow,
            requirement=payload.requirement,
            created_by=payload.created_by,
            copilot_model=payload.copilot_model,
            github_token=payload.github_token,
        )
    except JobError as exc:
        raise _handle(exc) from exc

    # Hand off to a background worker so the request returns immediately with a
    # job id. Application state lives in the DB, not in this process's memory.
    background_tasks.add_task(job_service.run_job, job.id)
    return JobCreateResponse(job_id=job.id, status=job.status)


@router.get("/jobs", response_model=list[JobOut], tags=["jobs"])
def list_jobs(
    limit: int = Query(50, ge=1, le=200),
    status: JobStatus | None = None,
    db: Session = Depends(get_db),
) -> list[JobOut]:
    jobs = job_service.list_jobs(db, limit=limit, status=status)
    return [JobOut.model_validate(job) for job in jobs]


@router.get("/jobs/{job_id}", response_model=JobDetailOut, tags=["jobs"])
def get_job(job_id: str, db: Session = Depends(get_db)) -> JobDetailOut:
    try:
        job = job_service.get_job(db, job_id)
    except JobError as exc:
        raise _handle(exc) from exc
    return JobDetailOut.model_validate(job)


@router.get("/jobs/{job_id}/logs", response_model=LogsResponse, tags=["jobs"])
def get_logs(job_id: str, db: Session = Depends(get_db)) -> LogsResponse:
    try:
        job = job_service.get_job(db, job_id)
    except JobError as exc:
        raise _handle(exc) from exc
    return LogsResponse(job_id=job.id, status=job.status, logs=job_service.read_logs(job))


@router.get("/jobs/{job_id}/result", response_model=ResultResponse, tags=["jobs"])
def get_result(job_id: str, db: Session = Depends(get_db)) -> ResultResponse:
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
def list_artifacts(job_id: str, db: Session = Depends(get_db)) -> list[dict[str, object]]:
    try:
        job = job_service.get_job(db, job_id)
    except JobError as exc:
        raise _handle(exc) from exc
    return job_service.list_artifacts(job)


@router.get("/jobs/{job_id}/artifacts/{artifact_path:path}", tags=["jobs"])
def download_artifact(
    job_id: str, artifact_path: str, db: Session = Depends(get_db)
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

    return FileResponse(target, filename=target.name)


@router.post("/jobs/{job_id}/approve", response_model=JobOut, tags=["workflow"])
def approve_job(
    job_id: str,
    payload: ApprovalRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> JobOut:
    """Accept the requirement quality and release test generation."""
    try:
        job = job_service.get_job(db, job_id)
        job = job_service.approve_job(db, job, payload.actor)
    except JobError as exc:
        raise _handle(exc) from exc

    background_tasks.add_task(job_service.run_generation, job.id, False)
    return JobOut.model_validate(job)


@router.post("/jobs/{job_id}/reject", response_model=JobOut, tags=["workflow"])
def reject_job(
    job_id: str, payload: ApprovalRequest, db: Session = Depends(get_db)
) -> JobOut:
    """Stop at the gate: the requirement is not ready to generate from."""
    try:
        job = job_service.get_job(db, job_id)
        job = job_service.reject_job(db, job, payload.actor, payload.reason)
    except JobError as exc:
        raise _handle(exc) from exc
    return JobOut.model_validate(job)


@router.post("/jobs/{job_id}/reprocess", response_model=JobOut, tags=["workflow"])
def reprocess_job(
    job_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> JobOut:
    """Re-run generation once, feeding the evaluator's recommendations back in."""
    try:
        job = job_service.get_job(db, job_id)
        job = job_service.start_reprocess(db, job)
    except JobError as exc:
        raise _handle(exc) from exc

    background_tasks.add_task(job_service.run_generation, job.id, True)
    return JobOut.model_validate(job)


@router.delete("/jobs/{job_id}", response_model=JobOut, tags=["jobs"])
def cancel_job(job_id: str, db: Session = Depends(get_db)) -> JobOut:
    try:
        job = job_service.get_job(db, job_id)
        job = job_service.cancel_job(db, job)
    except JobError as exc:
        raise _handle(exc) from exc
    return JobOut.model_validate(job)
