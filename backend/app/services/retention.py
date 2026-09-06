"""Artifact retention.

Every job leaves a workspace behind — the requirement, the intermediate
artifacts, the output, the execution log. Nothing ever removed them, so the
volume grew monotonically for the life of the deployment and the only answer to
"what happens when it fills" was "jobs start failing in whatever way a full disk
happens to break them".

The policy is deliberately conservative, because artifacts are the evidence
behind a result someone may have shipped:

* a workspace is only removed once its job has been terminal for
  ``ARTIFACT_RETENTION_DAYS``;
* a job still running, queued, or waiting at the approval gate is never touched,
  whatever its age;
* the most recent ``ARTIFACT_RETENTION_MIN_JOBS`` runs are always kept, so a
  quiet platform does not delete the only examples it has;
* a directory with no matching job row is left alone rather than guessed at.

Set ``ARTIFACT_RETENTION_DAYS=0`` to disable pruning entirely.
"""
from __future__ import annotations

import logging
import os
import shutil
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.config import settings
from app.database import session_scope
from app.models.jobs import Job, JobStatus

logger = logging.getLogger("ai-test-platform.retention")

#: How long a finished job's workspace is kept. 0 disables pruning.
RETENTION_DAYS = int(os.getenv("ARTIFACT_RETENTION_DAYS", "30"))

#: Never prune below this many of the most recent runs, regardless of age.
MIN_JOBS_KEPT = int(os.getenv("ARTIFACT_RETENTION_MIN_JOBS", "20"))


def _aware(value: datetime | None) -> datetime | None:
    """SQLite hands back naive datetimes; compare them as UTC."""
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def prunable_job_ids(*, now: datetime | None = None) -> list[str]:
    """Jobs whose artifacts may be removed, oldest first.

    Pure with respect to the filesystem: it decides, it does not delete. That
    keeps the policy testable without a directory tree to set up.
    """
    if RETENTION_DAYS <= 0:
        return []

    now = now or datetime.now(timezone.utc)
    cutoff = now - timedelta(days=RETENTION_DAYS)

    with session_scope() as db:
        terminal = [
            status for status in JobStatus if status.is_terminal
        ]
        rows = db.execute(
            select(Job.id, Job.completed_at, Job.created_at)
            .where(Job.status.in_(terminal))
            .order_by(Job.created_at.desc())
        ).all()

    # The newest N are protected whatever their age, so a platform that ran a
    # handful of jobs a year ago still has them to look at.
    protected = {row[0] for row in rows[:MIN_JOBS_KEPT]}

    prunable: list[tuple[datetime, str]] = []
    for job_id, completed_at, created_at in rows:
        if job_id in protected:
            continue
        finished = _aware(completed_at) or _aware(created_at)
        if finished is None or finished >= cutoff:
            continue
        prunable.append((finished, job_id))

    prunable.sort()
    return [job_id for _, job_id in prunable]


def prune(*, dry_run: bool = False) -> dict[str, object]:
    """Remove the workspaces of jobs past their retention window."""
    candidates = prunable_job_ids()
    removed: list[str] = []
    freed_bytes = 0

    for job_id in candidates:
        workspace = settings.workspace_for(job_id)
        if not workspace.is_dir():
            continue
        try:
            size = sum(f.stat().st_size for f in workspace.rglob("*") if f.is_file())
        except OSError:
            size = 0
        if dry_run:
            removed.append(job_id)
            freed_bytes += size
            continue
        try:
            shutil.rmtree(workspace)
        except OSError:
            logger.exception("could not remove the workspace for job %s", job_id)
            continue
        removed.append(job_id)
        freed_bytes += size

    if removed:
        logger.info(
            "%s %d job workspace(s), %.1f MB%s",
            "would remove" if dry_run else "removed",
            len(removed),
            freed_bytes / 1_048_576,
            " (dry run)" if dry_run else "",
        )
    return {
        "removed": len(removed),
        "job_ids": removed,
        "freed_bytes": freed_bytes,
        "retention_days": RETENTION_DAYS,
        "min_jobs_kept": MIN_JOBS_KEPT,
        "dry_run": dry_run,
    }
