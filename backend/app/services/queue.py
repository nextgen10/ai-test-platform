"""The work queue.

Jobs used to run as FastAPI ``BackgroundTasks``, which meant execution lived in
whichever process happened to accept the request. That pinned the platform to a
single replica — a second one would see the first's in-flight jobs as orphaned
and fail them — and a restart abandoned everything running.

A job is now a row that any worker may *claim*. Claiming is a conditional
UPDATE, so exactly one worker wins:

    UPDATE jobs SET lease_owner = :me, lease_expires_at = :deadline
     WHERE id = :job AND (lease_owner IS NULL OR lease_expires_at < :now)

That statement is atomic on both SQLite and PostgreSQL, which is why this needs
no broker, no Redis and no second image. A worker renews its lease while it
works; one that dies stops renewing, and the job becomes claimable again.
Reconciliation therefore keys off an expired lease rather than process start,
which is what makes more than one replica safe.
"""
from __future__ import annotations

import logging
import os
import socket
import threading
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update

from app.config import settings
from app.database import session_scope
from app.logging_config import job_id_var
from app.models.jobs import Job, JobStatus

logger = logging.getLogger("ai-test-platform.queue")

#: Identifies this worker in `lease_owner`. Host plus a random suffix, so two
#: replicas on one host still differ and the value is legible in the database.
WORKER_ID = f"{socket.gethostname()[:40]}-{uuid.uuid4().hex[:8]}"

#: How long a claim is good for. A worker renews well inside this; anything
#: longer than one renewal interval past it is presumed dead.
LEASE_SECONDS = int(os.getenv("JOB_LEASE_SECONDS", "120"))

#: How often a working worker extends its claim.
RENEW_SECONDS = int(os.getenv("JOB_LEASE_RENEW_SECONDS", "30"))

#: How often an idle worker looks for something to do.
POLL_SECONDS = float(os.getenv("JOB_POLL_SECONDS", "2"))

#: How many jobs one worker runs at once.
WORKER_CONCURRENCY = int(os.getenv("WORKER_CONCURRENCY", "2"))

#: How many times a job whose worker died is retried before it is failed for
#: good. Bounded so a job that reliably kills its worker cannot loop forever.
MAX_ATTEMPTS = int(os.getenv("JOB_MAX_ATTEMPTS", "2"))


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _aware(value: datetime | None) -> datetime | None:
    """SQLite hands back naive datetimes; compare them as UTC."""
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


# --------------------------------------------------------------------- claim

#: States a worker may pick up.
#:
#: QUEUED is a job nobody has started. RUNNING is one that owes the stage after
#: the human gate — a person approved it, or asked for a reprocess — or one a
#: dead worker abandoned. Both want the same thing, so they need no separate
#: state; the lease condition is what distinguishes "owed" from "in progress".
#:
#: AWAITING_APPROVAL is excluded on purpose: it is waiting on a person.
CLAIMABLE_STATES = (JobStatus.QUEUED, JobStatus.RUNNING)


def claim(job_id: str, *, worker: str = WORKER_ID) -> bool:
    """Try to take ownership of one job. True if this worker won it."""
    now = _utcnow()
    deadline = now + timedelta(seconds=LEASE_SECONDS)

    with session_scope() as db:
        result = db.execute(
            update(Job)
            .where(
                Job.id == job_id,
                (Job.lease_owner.is_(None)) | (Job.lease_expires_at < now),
            )
            .values(lease_owner=worker, lease_expires_at=deadline)
            .execution_options(synchronize_session=False)
        )
        return bool(result.rowcount)


def claim_next(*, worker: str = WORKER_ID) -> str | None:
    """Claim the oldest claimable job, or return None if there is nothing to do."""
    now = _utcnow()

    with session_scope() as db:
        candidates = db.scalars(
            select(Job.id)
            .where(
                Job.status.in_(CLAIMABLE_STATES),
                (Job.lease_owner.is_(None)) | (Job.lease_expires_at < now),
            )
            .order_by(Job.created_at)
            .limit(10)
        ).all()

    # Try each in turn: another worker may take one between the read and the
    # UPDATE, which is exactly the race the conditional UPDATE exists to settle.
    for job_id in candidates:
        if claim(job_id, worker=worker):
            return job_id
    return None


def renew(job_id: str, *, worker: str = WORKER_ID) -> bool:
    """Extend this worker's claim. False if it no longer holds the job."""
    with session_scope() as db:
        result = db.execute(
            update(Job)
            .where(Job.id == job_id, Job.lease_owner == worker)
            .values(lease_expires_at=_utcnow() + timedelta(seconds=LEASE_SECONDS))
            .execution_options(synchronize_session=False)
        )
        return bool(result.rowcount)


def release(job_id: str, *, worker: str = WORKER_ID) -> None:
    """Give up a claim, so another worker can pick the job up immediately."""
    with session_scope() as db:
        db.execute(
            update(Job)
            .where(Job.id == job_id, Job.lease_owner == worker)
            .values(lease_owner=None, lease_expires_at=None)
            .execution_options(synchronize_session=False)
        )


class LeaseHeartbeat:
    """Renews a job's lease for as long as the work is running.

    Without this, any job outlasting LEASE_SECONDS would be reclaimed by another
    worker while the first is still working on it.
    """

    def __init__(self, job_id: str, worker: str = WORKER_ID) -> None:
        self.job_id = job_id
        self.worker = worker
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        #: Set when the lease was lost — the work should be abandoned.
        self.lost = threading.Event()

    def __enter__(self) -> LeaseHeartbeat:
        self._thread = threading.Thread(
            target=self._run, name=f"lease-{self.job_id}", daemon=True
        )
        self._thread.start()
        return self

    def __exit__(self, *exc: object) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=RENEW_SECONDS)

    def _run(self) -> None:
        while not self._stop.wait(RENEW_SECONDS):
            try:
                if not renew(self.job_id, worker=self.worker):
                    logger.warning(
                        "lost the lease on job %s — another worker has taken it",
                        self.job_id,
                    )
                    self.lost.set()
                    return
            except Exception:  # noqa: BLE001 - a renewal failure must not kill the run
                logger.exception("could not renew the lease on job %s", self.job_id)


# --------------------------------------------------------------- reconcile

def reclaim_expired() -> int:
    """Return jobs whose worker stopped renewing to the claimable pool.

    This replaces the old "fail everything in flight at startup" reconciliation,
    which was only correct because there was exactly one replica.
    """
    now = _utcnow()
    reclaimed = 0
    exhausted = 0

    with session_scope() as db:
        stale = db.scalars(
            select(Job).where(
                Job.status.in_(
                    (
                        JobStatus.QUEUED,
                        JobStatus.STARTING,
                        JobStatus.ANALYZING,
                        JobStatus.RUNNING,
                        JobStatus.VALIDATING,
                        JobStatus.EVALUATING,
                    )
                ),
                Job.lease_owner.is_not(None),
                Job.lease_expires_at < now,
            )
        ).all()

        for job in stale:
            if job.attempt >= MAX_ATTEMPTS:
                # Retried enough. Fail it rather than let it cycle forever.
                job.lease_owner = None
                job.lease_expires_at = None
                job.error_message = (
                    f"Execution was attempted {job.attempt} time(s); each worker "
                    f"handling it stopped before finishing. Not retrying again."
                )
                job.status = JobStatus.FAILED
                job.completed_at = now
                exhausted += 1
                continue

            # Only the lease is cleared. Status is left alone: a RUNNING job
            # that was approved must stay RUNNING, or it would be knocked back
            # to QUEUED and re-run the stage the person already approved.
            # Stages that already completed are skipped by the runner's
            # checkpoint, so the retry costs only what actually failed.
            job.lease_owner = None
            job.lease_expires_at = None
            job.error_message = None
            reclaimed += 1

    if reclaimed:
        logger.warning("reclaimed %d job(s) from workers that stopped responding", reclaimed)
    if exhausted:
        logger.warning("failed %d job(s) that exhausted their retry budget", exhausted)
    return reclaimed


# ------------------------------------------------------------------ worker

class Worker:
    """Polls for claimable jobs and runs them. One per replica."""

    def __init__(self, concurrency: int = WORKER_CONCURRENCY) -> None:
        self.concurrency = max(1, concurrency)
        self._stop = threading.Event()
        self._threads: list[threading.Thread] = []
        self._reconciler: threading.Thread | None = None

    def start(self) -> None:
        for index in range(self.concurrency):
            thread = threading.Thread(
                target=self._loop, name=f"worker-{index}", daemon=True
            )
            thread.start()
            self._threads.append(thread)

        self._reconciler = threading.Thread(
            target=self._reconcile_loop, name="reconciler", daemon=True
        )
        self._reconciler.start()

        logger.info(
            "worker %s started | concurrency=%d lease=%ds poll=%.1fs",
            WORKER_ID,
            self.concurrency,
            LEASE_SECONDS,
            POLL_SECONDS,
        )

    def stop(self, timeout: float = 5.0) -> None:
        self._stop.set()
        for thread in self._threads:
            thread.join(timeout=timeout)

    def _reconcile_loop(self) -> None:
        """Periodically return abandoned jobs to the pool."""
        while not self._stop.wait(max(LEASE_SECONDS / 2, 15)):
            try:
                reclaim_expired()
            except Exception:  # noqa: BLE001
                logger.exception("reconciliation pass failed")

    def _loop(self) -> None:
        while not self._stop.is_set():
            job_id = None
            try:
                job_id = claim_next()
            except Exception:  # noqa: BLE001
                logger.exception("could not poll for work")

            if job_id is None:
                self._stop.wait(POLL_SECONDS)
                continue

            self._run_claimed(job_id)

    def _run_claimed(self, job_id: str) -> None:
        """Execute a job this worker holds the lease on."""
        # Imported here: job_service imports this module for enqueue(), and a
        # module-level import either way would be circular.
        from app.services import job_service

        token = job_id_var.set(job_id)
        try:
            with session_scope() as db:
                job = db.get(Job, job_id)
                if job is None or job.status.is_terminal:
                    return
                job.attempt += 1
                attempt = job.attempt
                status = job.status.value

            logger.info("picked up job %s (%s, attempt %d)", job_id, status, attempt)

            with LeaseHeartbeat(job_id) as heartbeat:
                job_service.execute_claimed(job_id)
                if heartbeat.lost.is_set():
                    logger.warning(
                        "job %s finished but its lease had already been taken", job_id
                    )
        except Exception:  # noqa: BLE001 - a worker must survive any single job
            logger.exception("job %s raised out of the worker loop", job_id)
        finally:
            job_id_var.reset(token)
            try:
                release(job_id)
            except Exception:  # noqa: BLE001
                logger.exception("could not release the lease on job %s", job_id)


_worker: Worker | None = None


def start_worker() -> Worker | None:
    """Start this process's worker, unless it is configured not to run one.

    Set ``RUN_WORKER=false`` to run an API-only replica — useful when API and
    execution should scale independently.
    """
    global _worker

    if os.getenv("RUN_WORKER", "true").strip().lower() in {"0", "false", "no"}:
        logger.info("RUN_WORKER is off — this replica serves the API only")
        return None

    _worker = Worker()
    _worker.start()
    return _worker


def stop_worker() -> None:
    global _worker
    if _worker is not None:
        _worker.stop()
        _worker = None


def queue_depth() -> dict[str, int]:
    """How much work is waiting and how much is in flight, for the dashboard."""
    from sqlalchemy import func

    now = _utcnow()
    with session_scope() as db:
        waiting_count = db.scalar(
            select(func.count(Job.id)).where(
                Job.status == JobStatus.QUEUED,
                (Job.lease_owner.is_(None)) | (Job.lease_expires_at < now),
            )
        )
        running_count = db.scalar(
            select(func.count(Job.id)).where(
                Job.lease_owner.is_not(None),
                Job.lease_expires_at >= now,
            )
        )
        workers = db.scalar(
            select(func.count(func.distinct(Job.lease_owner))).where(
                Job.lease_owner.is_not(None), Job.lease_expires_at >= now
            )
        )

    return {
        "waiting": int(waiting_count or 0),
        "in_flight": int(running_count or 0),
        "active_workers": int(workers or 0),
    }
