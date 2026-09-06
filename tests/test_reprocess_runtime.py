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


# ------------------------------------------------- reprocess without re-scoring

def _completed_job_with_an_evaluation():
    from app.database import session_scope
    from app.models.jobs import Job, JobStatus

    with session_scope() as db:
        job = Job(
            workflow="test-case-generation",
            created_by="test-operator",
            status=JobStatus.COMPLETED,
            evaluation={"overall": {"score": 83.5}, "gaps": ["boundary cases"]},
        )
        db.add(job)
        db.flush()
        return job.id


def test_reprocess_re_scores_by_default(operator):
    """The evaluator is the only check that the gap-closer closed the gaps."""
    from app.config import settings

    job_id = _completed_job_with_an_evaluation()
    assert operator.post(f"/api/v1/jobs/{job_id}/reprocess").status_code == 200

    assert not (settings.runtime_for(job_id) / "skip_evaluation").exists()

    body = operator.get(f"/api/v1/jobs/{job_id}").json()
    assert body["evaluation"].get("stale") is not True


def test_reprocess_can_amend_and_stop(operator):
    """`evaluate: false` skips the second model call."""
    from app.config import settings

    job_id = _completed_job_with_an_evaluation()
    res = operator.post(f"/api/v1/jobs/{job_id}/reprocess", json={"evaluate": False})
    assert res.status_code == 200

    # The runner learns about it through the same per-job control directory the
    # engine and model travel in.
    assert (settings.runtime_for(job_id) / "skip_evaluation").read_text() == "1"


def test_skipping_the_re_score_marks_the_old_score_stale(operator):
    """An unmarked stale score is worse than no score.

    `job.evaluation` drives the 5-D tab and is what the *next* reprocess reads to
    decide which gaps to close. Left unmarked it reports a number for a suite
    that no longer exists.
    """
    job_id = _completed_job_with_an_evaluation()
    operator.post(f"/api/v1/jobs/{job_id}/reprocess", json={"evaluate": False})

    evaluation = operator.get(f"/api/v1/jobs/{job_id}").json()["evaluation"]
    assert evaluation["stale"] is True
    assert "pre-amendment" in evaluation["stale_reason"] or "amended" in evaluation["stale_reason"]
    # The original score is preserved, not discarded — it is still the last
    # thing anyone actually measured.
    assert evaluation["overall"]["score"] == 83.5


def test_the_runner_only_skips_the_evaluator_when_told_to(monkeypatch):
    """The stage list is what decides whether a model call happens."""
    import importlib

    import agent_chain

    monkeypatch.setenv("SKIP_EVALUATION", "1")
    reloaded = importlib.reload(agent_chain)
    assert reloaded.SKIP_EVALUATION is True

    monkeypatch.delenv("SKIP_EVALUATION", raising=False)
    reloaded = importlib.reload(agent_chain)
    assert reloaded.SKIP_EVALUATION is False
