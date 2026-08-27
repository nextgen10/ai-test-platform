"""Schedules and webhook deliveries — the platform driven by something other than a person."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_id() -> str:
    return uuid.uuid4().hex[:12]


class Schedule(Base):
    """A workflow that runs on a cron expression rather than on demand."""

    __tablename__ = "schedules"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_new_id)
    name: Mapped[str] = mapped_column(String(200))
    workflow: Mapped[str] = mapped_column(String(64), index=True)

    #: Standard five-field cron, evaluated in UTC.
    cron: Mapped[str] = mapped_column(String(120))

    #: The input every run of this schedule receives.
    requirement: Mapped[str] = mapped_column(Text)

    enabled: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    created_by: Mapped[str] = mapped_column(String(128), default="anonymous")

    #: Per-run overrides, mirroring the job submission fields.
    copilot_model: Mapped[str | None] = mapped_column(String(64), nullable=True)
    engine: Mapped[str | None] = mapped_column(String(32), nullable=True)
    webhook_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    #: Computed on save and after every fire, so the due check is a simple
    #: comparison rather than a cron parse per row per tick.
    next_run_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_job_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
    run_count: Mapped[int] = mapped_column(Integer, default=0)

    #: Why the last fire failed, if it did. Cleared on the next success.
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)


class WebhookDelivery(Base):
    """One attempt to notify an external system that a job finished.

    Persisted rather than fire-and-forget: a webhook nobody can see failing is
    indistinguishable from one that was never configured.
    """

    __tablename__ = "webhook_deliveries"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_new_id)
    job_id: Mapped[str] = mapped_column(
        ForeignKey("jobs.id", ondelete="CASCADE"), index=True
    )
    url: Mapped[str] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    #: pending | delivered | failed
    status: Mapped[str] = mapped_column(String(16), default="pending", index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    response_status: Mapped[int | None] = mapped_column(Integer, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
