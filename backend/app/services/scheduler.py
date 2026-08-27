"""Firing scheduled workflows, and delivering webhooks when jobs finish.

Both are background loops in the same process as the worker. Like the queue,
they are lease-safe: a schedule is claimed by advancing ``next_run_at`` in a
conditional UPDATE, so two replicas cannot both fire the same tick.
"""
from __future__ import annotations

import json
import logging
import os
import threading
import urllib.error
import urllib.request
from datetime import datetime, timezone

from sqlalchemy import select, update

from app.database import session_scope
from app.models.automation import Schedule, WebhookDelivery
from app.models.jobs import Job
from app.services import cron

logger = logging.getLogger("ai-test-platform.scheduler")

#: How often to look for due schedules and undelivered webhooks.
TICK_SECONDS = float(os.getenv("SCHEDULER_TICK_SECONDS", "20"))

#: Give up on a webhook after this many attempts.
MAX_WEBHOOK_ATTEMPTS = int(os.getenv("WEBHOOK_MAX_ATTEMPTS", "5"))

WEBHOOK_TIMEOUT = float(os.getenv("WEBHOOK_TIMEOUT_SECONDS", "10"))


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


# ------------------------------------------------------------------ schedules

def compute_next_run(expression: str, after: datetime | None = None) -> datetime | None:
    try:
        return cron.next_run(expression, after)
    except cron.CronError:
        return None


def fire_due_schedules() -> int:
    """Submit a job for every schedule whose time has come."""
    from app.services import job_service

    now = _utcnow()
    fired = 0

    with session_scope() as db:
        due = db.scalars(
            select(Schedule).where(
                Schedule.enabled.is_(True),
                Schedule.next_run_at.is_not(None),
                Schedule.next_run_at <= now,
            )
        ).all()
        due_ids = [s.id for s in due]

    for schedule_id in due_ids:
        # Claim the tick by moving next_run_at forward in a conditional UPDATE.
        # Whichever replica's UPDATE lands first owns this firing.
        with session_scope() as db:
            schedule = db.get(Schedule, schedule_id)
            if schedule is None:
                continue
            claimed_for = _aware(schedule.next_run_at)
            following = compute_next_run(schedule.cron, now)

            result = db.execute(
                update(Schedule)
                .where(Schedule.id == schedule_id, Schedule.next_run_at == schedule.next_run_at)
                .values(next_run_at=following, last_run_at=now)
                .execution_options(synchronize_session=False)
            )
            if not result.rowcount:
                continue  # another replica took this tick

            payload = {
                "workflow": schedule.workflow,
                "requirement": schedule.requirement,
                "created_by": f"schedule:{schedule.name}"[:128],
                "copilot_model": schedule.copilot_model,
                "engine": schedule.engine,
                "webhook_url": schedule.webhook_url,
            }

        try:
            with session_scope() as db:
                job = job_service.create_job(
                    db,
                    workflow=payload["workflow"],
                    requirement=payload["requirement"],
                    created_by=payload["created_by"],
                    copilot_model=payload["copilot_model"],
                    engine=payload["engine"],
                    webhook_url=payload["webhook_url"],
                    schedule_id=schedule_id,
                )
                job_id = job.id

            with session_scope() as db:
                schedule = db.get(Schedule, schedule_id)
                if schedule:
                    schedule.last_job_id = job_id
                    schedule.run_count += 1
                    schedule.last_error = None

            logger.info(
                "schedule %s fired for %s -> job %s", schedule_id, claimed_for, job_id
            )
            fired += 1

        except Exception as exc:  # noqa: BLE001 - one bad schedule must not stop the rest
            logger.exception("schedule %s could not create a job", schedule_id)
            with session_scope() as db:
                schedule = db.get(Schedule, schedule_id)
                if schedule:
                    schedule.last_error = str(exc)[:1000]

    return fired


# ------------------------------------------------------------------- webhooks

def enqueue_webhook(job_id: str, url: str, payload: dict) -> None:
    """Record a delivery to attempt. Sending happens on the scheduler loop."""
    with session_scope() as db:
        db.add(
            WebhookDelivery(job_id=job_id, url=url, payload=payload, status="pending")
        )


def _post(url: str, payload: dict) -> int:
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "agent-hub-webhook/1.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=WEBHOOK_TIMEOUT) as response:
        return int(response.status)


def deliver_pending_webhooks() -> int:
    """Attempt every pending delivery once."""
    delivered = 0

    with session_scope() as db:
        pending = db.scalars(
            select(WebhookDelivery).where(
                WebhookDelivery.status == "pending",
                WebhookDelivery.attempts < MAX_WEBHOOK_ATTEMPTS,
            ).limit(50)
        ).all()
        work = [(d.id, d.url, d.payload or {}) for d in pending]

    for delivery_id, url, payload in work:
        status: int | None = None
        error: str | None = None
        try:
            status = _post(url, payload)
        except urllib.error.HTTPError as exc:
            status = exc.code
            error = f"HTTP {exc.code}: {exc.reason}"
        except Exception as exc:  # noqa: BLE001
            error = str(exc)[:500]

        with session_scope() as db:
            record = db.get(WebhookDelivery, delivery_id)
            if record is None:
                continue
            record.attempts += 1
            record.response_status = status
            record.error = error

            if status is not None and 200 <= status < 300:
                record.status = "delivered"
                record.delivered_at = _utcnow()
                delivered += 1
            elif record.attempts >= MAX_WEBHOOK_ATTEMPTS:
                record.status = "failed"
                logger.warning(
                    "webhook for job %s gave up after %d attempts: %s",
                    record.job_id,
                    record.attempts,
                    error,
                )

    return delivered


def notify_job_finished(job: Job) -> None:
    """Queue a webhook for a job that has reached a terminal state."""
    if not job.webhook_url:
        return

    enqueue_webhook(
        job.id,
        job.webhook_url,
        {
            "event": "job.finished",
            "job_id": job.id,
            "workflow": job.workflow,
            "status": job.status.value,
            "created_by": job.created_by,
            "duration_ms": job.duration_ms,
            "error_message": job.error_message,
            "summary": job.summary,
            "schedule_id": job.schedule_id,
            "finished_at": _utcnow().isoformat(),
        },
    )


# ----------------------------------------------------------------------- loop

class SchedulerLoop:
    """One background thread firing schedules and draining the webhook queue."""

    def __init__(self) -> None:
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        self._thread = threading.Thread(target=self._run, name="scheduler", daemon=True)
        self._thread.start()
        logger.info("scheduler started | tick=%.0fs", TICK_SECONDS)

    def stop(self, timeout: float = 5.0) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=timeout)

    def _run(self) -> None:
        while not self._stop.wait(TICK_SECONDS):
            try:
                fire_due_schedules()
            except Exception:  # noqa: BLE001
                logger.exception("schedule tick failed")
            try:
                deliver_pending_webhooks()
            except Exception:  # noqa: BLE001
                logger.exception("webhook delivery pass failed")


_loop: SchedulerLoop | None = None


def start() -> SchedulerLoop | None:
    global _loop
    if os.getenv("RUN_SCHEDULER", "true").strip().lower() in {"0", "false", "no"}:
        logger.info("RUN_SCHEDULER is off — no schedules will fire from this replica")
        return None
    _loop = SchedulerLoop()
    _loop.start()
    return _loop


def stop() -> None:
    global _loop
    if _loop is not None:
        _loop.stop()
        _loop = None
