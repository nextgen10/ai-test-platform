"""Job and JobEvent persistence models (blueprint §26, §27)."""
from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return uuid.uuid4().hex[:12]


class JobStatus(str, enum.Enum):
    """Explicit job states. Application state lives here, never only in the UI."""

    QUEUED = "QUEUED"
    STARTING = "STARTING"
    ANALYZING = "ANALYZING"                  # scoring the requirement
    AWAITING_APPROVAL = "AWAITING_APPROVAL"  # human gate on requirement quality
    RUNNING = "RUNNING"                      # generating test cases
    VALIDATING = "VALIDATING"                # schema + deterministic gate
    EVALUATING = "EVALUATING"                # scoring the generated suite
    COMPLETED = "COMPLETED"
    REJECTED = "REJECTED"                    # requirement quality refused by a human
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    TIMEOUT = "TIMEOUT"

    @property
    def is_terminal(self) -> bool:
        return self in _TERMINAL_STATES


_TERMINAL_STATES = frozenset(
    {
        JobStatus.COMPLETED,
        JobStatus.REJECTED,
        JobStatus.FAILED,
        JobStatus.CANCELLED,
        JobStatus.TIMEOUT,
    }
)

#: States where the job is progressing on its own and no human input is expected.
_FAILABLE = frozenset({JobStatus.FAILED, JobStatus.CANCELLED, JobStatus.TIMEOUT})

#: Legal transitions. Enforced in the service layer so an out-of-order executor
#: callback can never silently corrupt job history.
ALLOWED_TRANSITIONS: dict[JobStatus, frozenset[JobStatus]] = {
    JobStatus.QUEUED: frozenset({JobStatus.STARTING}) | _FAILABLE,
    JobStatus.STARTING: frozenset({JobStatus.ANALYZING}) | _FAILABLE,
    JobStatus.ANALYZING: frozenset({JobStatus.AWAITING_APPROVAL}) | _FAILABLE,
    # The human gate: approve to generate, reject to stop here.
    JobStatus.AWAITING_APPROVAL: frozenset({JobStatus.RUNNING, JobStatus.REJECTED}) | _FAILABLE,
    JobStatus.RUNNING: frozenset({JobStatus.VALIDATING}) | _FAILABLE,
    JobStatus.VALIDATING: frozenset({JobStatus.EVALUATING}) | _FAILABLE,
    JobStatus.EVALUATING: frozenset({JobStatus.COMPLETED}) | _FAILABLE,
    # Reprocess re-opens a completed job exactly once; the count is enforced by
    # the service layer, not by this table.
    JobStatus.COMPLETED: frozenset({JobStatus.RUNNING}),
    JobStatus.REJECTED: frozenset(),
    JobStatus.FAILED: frozenset(),
    JobStatus.CANCELLED: frozenset(),
    JobStatus.TIMEOUT: frozenset(),
}


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    workflow: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[JobStatus] = mapped_column(
        Enum(JobStatus, native_enum=False, length=24),  # AWAITING_APPROVAL is 17
        default=JobStatus.QUEUED,
        index=True,
    )

    created_by: Mapped[str] = mapped_column(String(128), default="anonymous", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    input_location: Mapped[str | None] = mapped_column(Text, nullable=True)
    output_location: Mapped[str | None] = mapped_column(Text, nullable=True)
    kubernetes_job_name: Mapped[str | None] = mapped_column(String(128), nullable=True)

    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    #: Result summary (counts by category/priority) — small enough to keep in the
    #: row. The generated files themselves live in artifact storage (blueprint §33).
    summary: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    #: Reproducibility record (blueprint §49).
    provenance: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    #: INVEST assessment of the requirement, produced before the approval gate.
    quality_report: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    #: Independent scoring of the generated suite, with gaps and recommendations.
    evaluation: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    approved_by: Mapped[str | None] = mapped_column(String(128), nullable=True)

    #: Reprocessing is allowed once, to close gaps the evaluator named.
    reprocess_count: Mapped[int] = mapped_column(Integer, default=0)

    #: Per-job model override. None means use the platform default (COPILOT_MODEL env).
    copilot_model: Mapped[str | None] = mapped_column(String(64), nullable=True)

    #: Whether a user-supplied token was used. The token itself is NEVER stored.
    copilot_token_set: Mapped[bool] = mapped_column(Boolean, default=False)

    events: Mapped[list["JobEvent"]] = relationship(
        back_populates="job",
        cascade="all, delete-orphan",
        order_by="JobEvent.timestamp",
    )


class JobEvent(Base):
    """Append-only audit trail. One row per meaningful state change."""

    __tablename__ = "job_events"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    job_id: Mapped[str] = mapped_column(
        ForeignKey("jobs.id", ondelete="CASCADE"), index=True
    )
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    event_type: Mapped[str] = mapped_column(String(64))
    message: Mapped[str] = mapped_column(Text, default="")
    event_metadata: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)

    job: Mapped[Job] = relationship(back_populates="events")
