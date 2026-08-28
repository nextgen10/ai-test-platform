"""Schedules, webhooks, bulk submission and queue visibility.

The endpoints that let something other than a person drive the platform.
"""
from __future__ import annotations

from datetime import datetime

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.access import http_deny_unless_owner, is_admin
from app.config import settings
from app.database import get_db
from app.models.automation import Schedule, WebhookDelivery
from app.models.jobs import Job
from app.security import Principal, require_author, require_operator, require_reader
from app.services import cron, job_service, queue, scheduler
from app.services.job_service import JobError
from app.services.url_guard import redact_url

router = APIRouter(prefix=f"{settings.api_prefix}", tags=["automation"])

#: An Annotated alias, not a shared `Path(...)` instance: FastAPI binds a Path
#: object to the first parameter name it sees, so reusing one instance across
#: routes makes every later route look for that first name.
EntityId = Annotated[str, Path(min_length=1, max_length=32, pattern=r"^[a-z0-9]+$")]


# ----------------------------------------------------------------- schemas

class ScheduleIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    workflow: str = Field(..., min_length=1, max_length=64)
    cron: str = Field(..., min_length=1, max_length=120)
    requirement: str = Field(..., min_length=20, max_length=50_000)
    enabled: bool = True
    copilot_model: str | None = Field(default=None, max_length=64)
    engine: str | None = Field(default=None, max_length=32)
    webhook_url: str | None = Field(default=None, max_length=2048)

    @field_validator("cron")
    @classmethod
    def _valid_cron(cls, value: str) -> str:
        try:
            cron.validate(value)
        except cron.CronError as exc:
            raise ValueError(str(exc)) from exc
        return value

    @field_validator("webhook_url")
    @classmethod
    def _public_https_webhook(cls, value: str | None) -> str | None:
        from app.services.url_guard import UnsafeURL, optional_https_webhook

        try:
            return optional_https_webhook(value)
        except UnsafeURL as exc:
            raise ValueError(str(exc)) from exc


class ScheduleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    workflow: str
    cron: str
    requirement: str
    enabled: bool
    created_at: datetime
    created_by: str
    copilot_model: str | None = None
    engine: str | None = None
    webhook_url: str | None = None
    next_run_at: datetime | None = None
    last_run_at: datetime | None = None
    last_job_id: str | None = None
    run_count: int = 0
    last_error: str | None = None
    #: Plain-English gloss, so a wrong expression is obvious before it fires.
    cron_description: str = ""


class BulkItem(BaseModel):
    requirement: str = Field(..., min_length=20, max_length=50_000)
    #: Optional label carried into the job's `created_by`, for traceability.
    reference: str | None = Field(default=None, max_length=120)


class BulkRequest(BaseModel):
    workflow: str = Field(default="test-case-generation", max_length=128)
    items: list[BulkItem] = Field(..., min_length=1, max_length=200)
    copilot_model: str | None = Field(default=None, max_length=64)
    engine: str | None = Field(default=None, max_length=32)
    github_token: str | None = Field(default=None, max_length=256)
    webhook_url: str | None = Field(default=None, max_length=2048)

    @field_validator("webhook_url")
    @classmethod
    def _public_https_webhook(cls, value: str | None) -> str | None:
        from app.services.url_guard import UnsafeURL, optional_https_webhook

        try:
            return optional_https_webhook(value)
        except UnsafeURL as exc:
            raise ValueError(str(exc)) from exc


def _out(schedule: Schedule) -> ScheduleOut:
    payload = ScheduleOut.model_validate(schedule)
    payload.cron_description = cron.describe(schedule.cron)
    return payload


# --------------------------------------------------------------- schedules

@router.post("/schedules", response_model=ScheduleOut, status_code=201)
def create_schedule(
    payload: ScheduleIn,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_author),
) -> ScheduleOut:
    """Register a workflow to run on a cron expression."""
    try:
        job_service.resolve_workflow(payload.workflow)
    except JobError as exc:
        raise HTTPException(exc.status_code, str(exc)) from exc

    schedule = Schedule(
        name=payload.name,
        workflow=payload.workflow,
        cron=payload.cron,
        requirement=payload.requirement,
        enabled=payload.enabled,
        created_by=principal.name,
        copilot_model=payload.copilot_model,
        engine=payload.engine,
        webhook_url=payload.webhook_url,
        next_run_at=scheduler.compute_next_run(payload.cron) if payload.enabled else None,
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return _out(schedule)


@router.get("/schedules", response_model=list[ScheduleOut])
def list_schedules(
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_reader),
) -> list[ScheduleOut]:
    stmt = select(Schedule).order_by(Schedule.created_at.desc())
    if not is_admin(principal):
        stmt = stmt.where(Schedule.created_by == principal.name)
    schedules = db.scalars(stmt).all()
    return [_out(s) for s in schedules]


@router.get("/schedules/{schedule_id}", response_model=ScheduleOut)
def get_schedule(
    schedule_id: EntityId,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_reader),
) -> ScheduleOut:
    schedule = db.get(Schedule, schedule_id)
    if schedule is None:
        raise HTTPException(404, f"Schedule '{schedule_id}' not found")
    http_deny_unless_owner(principal, schedule.created_by, kind="Schedule")
    return _out(schedule)


@router.put("/schedules/{schedule_id}", response_model=ScheduleOut)
def update_schedule(
    schedule_id: EntityId,
    payload: ScheduleIn,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_author),
) -> ScheduleOut:
    schedule = db.get(Schedule, schedule_id)
    if schedule is None:
        raise HTTPException(404, f"Schedule '{schedule_id}' not found")
    http_deny_unless_owner(principal, schedule.created_by, kind="Schedule")

    try:
        job_service.resolve_workflow(payload.workflow)
    except JobError as exc:
        raise HTTPException(exc.status_code, str(exc)) from exc

    schedule.name = payload.name
    schedule.workflow = payload.workflow
    schedule.cron = payload.cron
    schedule.requirement = payload.requirement
    schedule.enabled = payload.enabled
    schedule.copilot_model = payload.copilot_model
    schedule.engine = payload.engine
    schedule.webhook_url = payload.webhook_url
    # Recompute from now, so an edit cannot leave a stale time in the past that
    # fires immediately for reasons nobody intended.
    schedule.next_run_at = (
        scheduler.compute_next_run(payload.cron) if payload.enabled else None
    )
    db.commit()
    db.refresh(schedule)
    return _out(schedule)


@router.delete("/schedules/{schedule_id}")
def delete_schedule(
    schedule_id: EntityId,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_author),
) -> dict:
    schedule = db.get(Schedule, schedule_id)
    if schedule is None:
        raise HTTPException(404, f"Schedule '{schedule_id}' not found")
    http_deny_unless_owner(principal, schedule.created_by, kind="Schedule")
    db.delete(schedule)
    db.commit()
    return {"deleted": schedule_id}


@router.post("/schedules/{schedule_id}/run", status_code=201)
def run_schedule_now(
    schedule_id: EntityId,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_operator),
) -> dict:
    """Fire a schedule immediately, without waiting for its next tick."""
    schedule = db.get(Schedule, schedule_id)
    if schedule is None:
        raise HTTPException(404, f"Schedule '{schedule_id}' not found")

    http_deny_unless_owner(principal, schedule.created_by, kind="Schedule")

    try:
        job = job_service.create_job(
            db,
            workflow=schedule.workflow,
            requirement=schedule.requirement,
            created_by=principal.name,
            copilot_model=schedule.copilot_model,
            engine=schedule.engine,
            webhook_url=schedule.webhook_url,
            schedule_id=schedule.id,
        )
    except JobError as exc:
        raise HTTPException(exc.status_code, str(exc)) from exc

    schedule.last_job_id = job.id
    schedule.run_count += 1
    db.commit()
    return {"job_id": job.id, "status": job.status.value, "schedule_id": schedule_id}


@router.post("/cron/preview")
def preview_cron(
    payload: dict,
    _: Principal = Depends(require_reader),
) -> dict:
    """Explain an expression and show its next few firings, before committing it."""
    expression = str(payload.get("cron", "")).strip()
    if not expression:
        raise HTTPException(400, "Provide a 'cron' expression.")

    try:
        schedule = cron.validate(expression)
    except cron.CronError as exc:
        raise HTTPException(400, str(exc)) from exc

    upcoming: list[str] = []
    moment = None
    for _index in range(5):
        moment = schedule.next_after(moment)
        if moment is None:
            break
        upcoming.append(moment.isoformat())

    return {
        "cron": expression,
        "description": cron.describe(expression),
        "next_runs": upcoming,
    }


# -------------------------------------------------------------------- bulk

@router.post("/jobs/bulk", status_code=201)
def submit_bulk(
    payload: BulkRequest,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_operator),
) -> dict:
    """Submit many runs of one workflow in a single call.

    Partial success is reported rather than rolled back: one malformed item out
    of forty should not discard the thirty-nine that were fine.
    """
    try:
        job_service.resolve_workflow(payload.workflow)
    except JobError as exc:
        raise HTTPException(exc.status_code, str(exc)) from exc

    accepted: list[dict] = []
    rejected: list[dict] = []

    for index, item in enumerate(payload.items):
        try:
            job = job_service.create_job(
                db,
                workflow=payload.workflow,
                requirement=item.requirement,
                created_by=principal.name,
                copilot_model=payload.copilot_model,
                github_token=payload.github_token,
                engine=payload.engine,
                webhook_url=payload.webhook_url,
            )
            accepted.append(
                {"index": index, "job_id": job.id, "reference": item.reference}
            )
        except JobError as exc:
            rejected.append(
                {"index": index, "reference": item.reference, "detail": str(exc)}
            )

    return {
        "submitted": len(accepted),
        "rejected": len(rejected),
        "jobs": accepted,
        "errors": rejected,
    }


# ---------------------------------------------------------------- webhooks

@router.get("/webhooks/deliveries")
def list_deliveries(
    job_id: str | None = None,
    status: str | None = Query(default=None, pattern="^(pending|delivered|failed)$"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_reader),
) -> list[dict]:
    """Webhook attempts, so a silently failing endpoint is visible."""
    stmt = (
        select(WebhookDelivery)
        .join(Job, Job.id == WebhookDelivery.job_id)
        .order_by(WebhookDelivery.created_at.desc())
        .limit(limit)
    )
    if not is_admin(principal):
        stmt = stmt.where(Job.created_by == principal.name)
    if job_id:
        stmt = stmt.where(WebhookDelivery.job_id == job_id)
    if status:
        stmt = stmt.where(WebhookDelivery.status == status)

    return [
        {
            "id": d.id,
            "job_id": d.job_id,
            "url": redact_url(d.url),
            "status": d.status,
            "attempts": d.attempts,
            "response_status": d.response_status,
            "error": d.error,
            "created_at": d.created_at.isoformat() if d.created_at else None,
            "delivered_at": d.delivered_at.isoformat() if d.delivered_at else None,
        }
        for d in db.scalars(stmt)
    ]


@router.post("/webhooks/deliveries/{delivery_id}/retry")
def retry_delivery(
    delivery_id: EntityId,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_operator),
) -> dict:
    """Put a failed delivery back in the queue after fixing the receiving end."""
    delivery = db.get(WebhookDelivery, delivery_id)
    if delivery is None:
        raise HTTPException(404, f"Delivery '{delivery_id}' not found")
    job = db.get(Job, delivery.job_id)
    if job is None:
        raise HTTPException(404, f"Delivery '{delivery_id}' not found")
    http_deny_unless_owner(principal, job.created_by, kind="Delivery")

    delivery.status = "pending"
    delivery.attempts = 0
    delivery.error = None
    db.commit()
    return {"id": delivery_id, "status": "pending"}


# ------------------------------------------------------------------- queue

@router.get("/queue")
def queue_status(_: Principal = Depends(require_reader)) -> dict:
    """What the work queue is doing right now."""
    depth = queue.queue_depth()
    return {
        **depth,
        "worker_id": queue.WORKER_ID,
        "lease_seconds": queue.LEASE_SECONDS,
        "concurrency": queue.WORKER_CONCURRENCY,
        "max_attempts": queue.MAX_ATTEMPTS,
    }
