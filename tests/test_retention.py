"""Artifact retention: what gets deleted, and — more importantly — what does not.

Artifacts are the evidence behind a result somebody may have shipped, so the
dangerous failure here is not "the disk filled" but "the run someone needed is
gone". Every test below is about the second one.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.database import session_scope
from app.models.jobs import Job, JobStatus
from app.services import retention


@pytest.fixture
def jobs_factory():
    """Create job rows and remove them again, whatever the test does."""
    created: list[str] = []

    def make(status: JobStatus, age_days: float) -> str:
        when = datetime.now(timezone.utc) - timedelta(days=age_days)
        with session_scope() as db:
            job = Job(
                workflow="test-case-generation",
                created_by="test-operator",
                status=status,
                created_at=when,
                completed_at=when if status.is_terminal else None,
            )
            db.add(job)
            db.flush()
            created.append(job.id)
            return job.id

    yield make

    with session_scope() as db:
        for job_id in created:
            row = db.get(Job, job_id)
            if row is not None:
                db.delete(row)


def test_work_in_flight_is_never_pruned(jobs_factory, monkeypatch):
    """Age is irrelevant to a job that has not finished.

    A job queued behind a long backlog, or parked at the approval gate over a
    weekend, is older than the window and still very much wanted.
    """
    monkeypatch.setattr(retention, "MIN_JOBS_KEPT", 0)
    monkeypatch.setattr(retention, "RETENTION_DAYS", 1)

    ancient_but_live = [
        jobs_factory(JobStatus.QUEUED, age_days=400),
        jobs_factory(JobStatus.RUNNING, age_days=400),
        jobs_factory(JobStatus.AWAITING_APPROVAL, age_days=400),
    ]

    prunable = retention.prunable_job_ids()
    for job_id in ancient_but_live:
        assert job_id not in prunable


def test_a_finished_job_inside_the_window_is_kept(jobs_factory, monkeypatch):
    monkeypatch.setattr(retention, "MIN_JOBS_KEPT", 0)
    monkeypatch.setattr(retention, "RETENTION_DAYS", 30)

    recent = jobs_factory(JobStatus.COMPLETED, age_days=5)
    assert recent not in retention.prunable_job_ids()


def test_a_finished_job_past_the_window_is_prunable(jobs_factory, monkeypatch):
    monkeypatch.setattr(retention, "MIN_JOBS_KEPT", 0)
    monkeypatch.setattr(retention, "RETENTION_DAYS", 30)

    old = jobs_factory(JobStatus.COMPLETED, age_days=90)
    assert old in retention.prunable_job_ids()


def test_the_most_recent_runs_survive_whatever_their_age(jobs_factory, monkeypatch):
    """A quiet platform must not delete the only examples it has.

    Without this floor, a deployment that ran ten jobs a year ago and nothing
    since would wake up one day with an empty artifact tree and no way to show
    anyone what it does.
    """
    monkeypatch.setattr(retention, "RETENTION_DAYS", 1)
    monkeypatch.setattr(retention, "MIN_JOBS_KEPT", 50)

    old_but_recent_enough = jobs_factory(JobStatus.COMPLETED, age_days=365)
    assert old_but_recent_enough not in retention.prunable_job_ids()


def test_retention_can_be_switched_off(jobs_factory, monkeypatch):
    monkeypatch.setattr(retention, "MIN_JOBS_KEPT", 0)
    monkeypatch.setattr(retention, "RETENTION_DAYS", 0)

    jobs_factory(JobStatus.COMPLETED, age_days=999)
    assert retention.prunable_job_ids() == []


def test_a_dry_run_deletes_nothing(jobs_factory, monkeypatch, tmp_path):
    """The reporting path must be safe to run against production."""
    monkeypatch.setattr(retention, "MIN_JOBS_KEPT", 0)
    monkeypatch.setattr(retention, "RETENTION_DAYS", 1)
    monkeypatch.setattr(retention.settings, "artifact_root", tmp_path)

    job_id = jobs_factory(JobStatus.COMPLETED, age_days=90)
    workspace = tmp_path / job_id
    (workspace / "output").mkdir(parents=True)
    (workspace / "output" / "test_cases.json").write_text('{"cases": []}')

    result = retention.prune(dry_run=True)

    assert job_id in result["job_ids"]
    assert result["dry_run"] is True
    assert workspace.is_dir(), "a dry run must not remove anything"

    # And the real pass does remove it.
    retention.prune()
    assert not workspace.exists()
