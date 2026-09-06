"""Reprocess must keep the engine the job was submitted with.

Completing a job used to rmtree the runtime directory. The executor then fell
back to ``settings.engine`` (mock under start.sh), so a Copilot job silently
gap-closed as mock.
"""
import shutil

from app.config import settings
from app.database import session_scope
from app.executors import runtime as exec_runtime
from app.models.jobs import Job, JobStatus
from app.services import job_service

_REQ = (
    "REQ-REPROCESS Engine stickiness\n\n"
    "A reprocess must use the same engine the original run used.\n"
    "- Copilot jobs must not fall back to mock.\n"
    "- The PAT is dropped only when the job can no longer run."
)


def _submit_copilot(operator) -> str:
    response = operator.post(
        "/api/v1/jobs",
        json={
            "requirement": _REQ,
            "workflow": "test-case-generation",
            "engine": "copilot",
            "copilot_model": "gpt-4o",
            "github_token": "ghp_reprocess_runtime_token",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["job_id"]


def test_executor_reads_the_staged_copilot_engine_not_the_process_default(operator):
    """start.sh defaults ENGINE=mock; a Copilot job must not inherit that."""
    assert settings.engine == "mock"
    job_id = _submit_copilot(operator)
    assert exec_runtime.resolve_job_engine(job_id) == "copilot"
    assert (settings.runtime_for(job_id) / "engine").read_text().strip() == "copilot"


def test_completing_a_copilot_job_keeps_engine_and_token_for_reprocess(operator):
    job_id = _submit_copilot(operator)
    runtime = settings.runtime_for(job_id)

    with session_scope() as db:
        job = db.get(Job, job_id)
        job.status = JobStatus.EVALUATING
        db.commit()
        db.refresh(job)
        job_service.transition(db, job, JobStatus.COMPLETED, "generation finished")

    assert (runtime / "engine").read_text().strip() == "copilot"
    assert (runtime / "copilot_model").read_text().strip() == "gpt-4o"
    assert (runtime / "copilot_token").is_file(), (
        "the one allowed reprocess still needs the PAT"
    )
    assert exec_runtime.resolve_job_engine(job_id) == "copilot"


def test_failing_drops_the_token_but_keeps_the_engine(operator):
    job_id = _submit_copilot(operator)
    runtime = settings.runtime_for(job_id)

    with session_scope() as db:
        job = db.get(Job, job_id)
        job_service.transition(db, job, JobStatus.FAILED, "runner died")

    assert (runtime / "engine").read_text().strip() == "copilot"
    assert not (runtime / "copilot_token").exists()


def test_token_is_purged_once_the_reprocess_slot_is_used(operator):
    job_id = _submit_copilot(operator)
    runtime = settings.runtime_for(job_id)

    with session_scope() as db:
        job = db.get(Job, job_id)
        job.status = JobStatus.EVALUATING
        job.reprocess_count = 1
        db.commit()
        db.refresh(job)
        job_service.transition(db, job, JobStatus.COMPLETED, "reprocess finished")

    assert (runtime / "engine").read_text().strip() == "copilot"
    assert not (runtime / "copilot_token").exists()


def test_reprocess_restages_copilot_after_the_runtime_directory_was_wiped(operator):
    """Jobs completed before this fix have no runtime files left."""
    job_id = _submit_copilot(operator)
    shutil.rmtree(settings.runtime_for(job_id))
    assert exec_runtime.resolve_job_engine(job_id) == "mock"

    with session_scope() as db:
        job = db.get(Job, job_id)
        job.status = JobStatus.COMPLETED
        job.evaluation = {
            "gaps": [{"detail": "No case covers an already-frozen card."}],
            "recommendations": [],
        }
        db.commit()
        db.refresh(job)
        job_service.start_reprocess(db, job)

    runtime = settings.runtime_for(job_id)
    assert (runtime / "engine").read_text().strip() == "copilot"
    assert (runtime / "copilot_model").read_text().strip() == "gpt-4o"
    assert exec_runtime.resolve_job_engine(job_id) == "copilot"
