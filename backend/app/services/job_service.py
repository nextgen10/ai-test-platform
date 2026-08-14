"""Job orchestration: state machine, execution, artifact collection.

This module owns every job state change. Executors report success or failure;
only this layer decides what that means for the job record.
"""
from __future__ import annotations

import json
import logging
import os
import re
import threading
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import session_scope
from app.executors import get_executor
from app.models.jobs import (
    ALLOWED_TRANSITIONS,
    Job,
    JobEvent,
    JobStatus,
    utcnow,
)

logger = logging.getLogger(__name__)

#: Not finished, for rate limiting and dashboard counts. Includes the human gate.
ACTIVE_STATES = (
    JobStatus.QUEUED,
    JobStatus.STARTING,
    JobStatus.ANALYZING,
    JobStatus.AWAITING_APPROVAL,
    JobStatus.RUNNING,
    JobStatus.VALIDATING,
    JobStatus.EVALUATING,
)

#: Driven by a background task, so abandoned if the process dies. Deliberately
#: excludes AWAITING_APPROVAL: that state is waiting on a person, not a process,
#: and must survive a restart rather than being failed as orphaned.
IN_FLIGHT_STATES = (
    JobStatus.QUEUED,
    JobStatus.STARTING,
    JobStatus.ANALYZING,
    JobStatus.RUNNING,
    JobStatus.VALIDATING,
    JobStatus.EVALUATING,
)

#: Reprocessing exists to close named gaps once, not to iterate indefinitely.
MAX_REPROCESS = int(os.getenv("MAX_REPROCESS", "1"))


class JobError(Exception):
    """Raised for caller-visible orchestration errors."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.status_code = status_code


# ----------------------------------------------------------------- transitions


def record_event(
    db: Session,
    job: Job,
    event_type: str,
    message: str = "",
    metadata: dict[str, Any] | None = None,
) -> None:
    db.add(
        JobEvent(
            job_id=job.id,
            event_type=event_type,
            message=message,
            event_metadata=metadata,
        )
    )


def transition(
    db: Session,
    job: Job,
    target: JobStatus,
    message: str = "",
    metadata: dict[str, Any] | None = None,
) -> None:
    """Move a job to `target`, rejecting transitions the state machine forbids."""
    current = job.status
    if target not in ALLOWED_TRANSITIONS[current]:
        raise JobError(
            f"Illegal transition {current.value} -> {target.value} for job {job.id}",
            status_code=409,
        )

    job.status = target

    if target is JobStatus.STARTING and job.started_at is None:
        job.started_at = utcnow()

    if target.is_terminal:
        job.completed_at = utcnow()
        if job.started_at:
            started = job.started_at
            if started.tzinfo is None:
                started = started.replace(tzinfo=timezone.utc)
            job.duration_ms = int(
                (datetime.now(timezone.utc) - started).total_seconds() * 1000
            )

    record_event(db, job, f"status.{target.value.lower()}", message, metadata)
    db.commit()


# --------------------------------------------------------------------- create


def enforce_rate_limits(db: Session, created_by: str) -> None:
    """Stop one user (or the platform) from flooding the executor (blueprint §41)."""
    total_active = db.scalar(
        select(func.count(Job.id)).where(Job.status.in_(ACTIVE_STATES))
    )
    if (total_active or 0) >= settings.max_concurrent_jobs_total:
        raise JobError(
            f"Platform concurrency limit reached "
            f"({settings.max_concurrent_jobs_total} active jobs). Try again shortly.",
            status_code=429,
        )

    user_active = db.scalar(
        select(func.count(Job.id)).where(
            Job.status.in_(ACTIVE_STATES), Job.created_by == created_by
        )
    )
    if (user_active or 0) >= settings.max_concurrent_jobs_per_user:
        raise JobError(
            f"You already have {user_active} active jobs "
            f"(limit {settings.max_concurrent_jobs_per_user}).",
            status_code=429,
        )


def create_job(
    db: Session,
    *,
    workflow: str,
    requirement: str,
    created_by: str,
    copilot_model: str | None = None,
    github_token: str | None = None,
) -> Job:
    """Persist the job and stage its input. Execution is kicked off separately."""
    enforce_rate_limits(db, created_by)

    job = Job(
        workflow=workflow,
        created_by=created_by,
        status=JobStatus.QUEUED,
        copilot_model=copilot_model,
        copilot_token_set=bool(github_token and github_token.strip()),
    )
    db.add(job)
    db.flush()  # assign the id before we build paths from it

    workspace = settings.workspace_for(job.id)
    (workspace / "input").mkdir(parents=True, exist_ok=True)
    (workspace / "intermediate").mkdir(parents=True, exist_ok=True)
    (workspace / "output").mkdir(parents=True, exist_ok=True)

    # The requirement is written to a file and referenced by path. It is never
    # interpolated into a shell command (blueprint §21).
    requirement_path = workspace / "input" / "requirement.md"
    requirement_path.write_text(requirement, encoding="utf-8")

    if copilot_model and copilot_model.strip():
        (workspace / "input" / ".copilot_model").write_text(copilot_model.strip(), encoding="utf-8")

    if github_token and github_token.strip():
        token_path = workspace / "input" / ".copilot_token"
        token_path.write_text(github_token.strip(), encoding="utf-8")
        try:
            token_path.chmod(0o600)
        except OSError:
            pass

    job.input_location = str(requirement_path)
    job.output_location = str(workspace / "output")

    event_metadata = {
        "executor": settings.executor,
        "engine": settings.engine,
        "requirement_chars": len(requirement),
    }
    if copilot_model:
        event_metadata["copilot_model"] = copilot_model
    if job.copilot_token_set:
        event_metadata["copilot_token_set"] = True

    record_event(
        db,
        job,
        "job.created",
        f"Job accepted for workflow {workflow}",
        event_metadata,
    )
    db.commit()
    db.refresh(job)
    return job


# ------------------------------------------------------------ live progress

#: Lines the runner emits that mark a phase boundary. The runner is the single
#: source of truth for progress; the orchestrator only transcribes it.
_PHASE_START = re.compile(r"(?:Phase\s+(\d+)/(\d+)|Evaluation)\s+([a-zA-Z0-9_-]+)")
_PHASE_DONE = {
    "requirement-analyst": re.compile(r"quality:\s*(.+)"),
    "test-designer": re.compile(r"design ready:\s*(.+)"),
    "test-generator": re.compile(r"draft ready:\s*(.+)"),
    "test-reviewer": re.compile(r"PASS:\s*(.+)"),
    "test-evaluator": re.compile(r"evaluation:\s*(.+)"),
    "gap-closer": re.compile(r"gap closure complete:\s*(.+)"),
}

#: How often to re-read the runner's log while a job is in flight.
PROGRESS_POLL_SECONDS = float(os.getenv("PROGRESS_POLL_SECONDS", "2"))


class ProgressWatcher(threading.Thread):
    """Transcribe the runner's phase transitions into job_events as they happen.

    Without this a four-minute run shows no movement at all: phase timings are
    only written once the runner exits. The runner already logs each transition,
    so this tails that log rather than inventing a second progress channel.

    Runs as a daemon: it must never keep the process alive or block job
    completion, and a failure here is cosmetic, not fatal.
    """

    def __init__(self, job_id: str, log_path: Path) -> None:
        super().__init__(name=f"progress-{job_id}", daemon=True)
        self.job_id = job_id
        self.log_path = log_path
        # NOT `_stop`: that shadows Thread._stop, which join() calls internally.
        self._stop_event = threading.Event()
        self._offset = 0
        self._seen: set[str] = set()
        self._current: str | None = None

    def stop(self) -> None:
        self._stop_event.set()

    def run(self) -> None:  # noqa: D102 - Thread.run
        while not self._stop_event.is_set():
            try:
                self._drain()
            except Exception:  # noqa: BLE001 - progress must never break a job
                logger.debug("progress watcher error for %s", self.job_id, exc_info=True)
            self._stop_event.wait(PROGRESS_POLL_SECONDS)
        # One final pass so the last phase is not lost to the polling gap.
        try:
            self._drain()
        except Exception:  # noqa: BLE001
            logger.debug("progress watcher final drain failed", exc_info=True)

    def _drain(self) -> None:
        if not self.log_path.exists():
            return

        with self.log_path.open("r", encoding="utf-8", errors="replace") as handle:
            handle.seek(self._offset)
            new_text = handle.read()
            self._offset = handle.tell()

        for line in new_text.splitlines():
            self._consume(line)

    def _consume(self, line: str) -> None:
        start = _PHASE_START.search(line)
        if start:
            index_str, total_str, name = start.group(1), start.group(2), start.group(3)
            index = int(index_str) if index_str else 1
            total = int(total_str) if total_str else 1
            key = f"start:{name}:{index}"
            if key not in self._seen:
                self._seen.add(key)
                self._current = name
                self._emit(
                    "phase.started",
                    f"{name} running",
                    {"phase": name, "index": index, "total": total},
                )
            return

        if self._current:
            pattern = _PHASE_DONE.get(self._current)
            if pattern:
                done = pattern.search(line)
                if done:
                    key = f"done:{self._current}"
                    if key not in self._seen:
                        self._seen.add(key)
                        self._emit(
                            "phase.completed",
                            f"{self._current} — {done.group(1).strip()}",
                            {"phase": self._current, "detail": done.group(1).strip()},
                        )

    def _emit(self, event_type: str, message: str, metadata: dict[str, Any]) -> None:
        with session_scope() as db:
            job = db.get(Job, self.job_id)
            if job is None:
                return
            record_event(db, job, event_type, message, metadata)


# -------------------------------------------------------------------- execute


def _summarize(result_doc: dict[str, Any]) -> dict[str, Any]:
    cases = result_doc.get("test_cases", [])
    return {
        "total": len(cases),
        "by_category": dict(Counter(c.get("category") for c in cases)),
        "by_priority": dict(Counter(c.get("priority") for c in cases)),
        "requirement_reference": result_doc.get("requirement_reference"),
        "assumptions": len(result_doc.get("assumptions", []) or []),
    }


def _read_json(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def _guarded(job_id: str, work) -> None:
    """Run one orchestration step, guaranteeing the job ends somewhere terminal.

    An orchestration bug that escaped would otherwise leave the row mid-flight
    with the runner long since finished and nobody watching.
    """
    try:
        work(job_id)
    except Exception as exc:  # noqa: BLE001 - last line of defence
        logger.exception("Unhandled orchestration error for job %s", job_id)
        try:
            with session_scope() as db:
                job = db.get(Job, job_id)
                if job is not None and not job.status.is_terminal:
                    job.error_message = f"Orchestration error: {exc}"
                    transition(db, job, JobStatus.FAILED, "Unhandled orchestration error")
        except Exception:  # noqa: BLE001
            logger.exception("Could not mark job %s as failed", job_id)


def _run_stage(job_id: str, stage: str, reprocess: bool = False, attempt: int = 0):
    """Dispatch one runner stage and stream its progress into job_events."""
    workspace = settings.workspace_for(job_id)
    executor = get_executor()

    external = None
    getter = getattr(executor, "external_name", None)
    if getter:
        try:
            external = getter(job_id, stage, attempt)
        except TypeError:  # executors without a stage-aware signature
            external = getter(job_id)

    if external:
        with session_scope() as db:
            job = db.get(Job, job_id)
            if job:
                job.kubernetes_job_name = external

    # Each stage writes a fresh log, so the watcher never replays a prior stage.
    log_path = workspace / "output" / "execution.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_path.write_text("", encoding="utf-8")

    watcher = ProgressWatcher(job_id, log_path)
    watcher.start()
    try:
        return executor.run(job_id, workspace, stage, reprocess, attempt)
    finally:
        watcher.stop()
        watcher.join(timeout=PROGRESS_POLL_SECONDS * 2)


def _fail(job_id: str, message: str, status: JobStatus = JobStatus.FAILED) -> None:
    with session_scope() as db:
        job = db.get(Job, job_id)
        if job is None or job.status.is_terminal:
            return
        job.error_message = message
        transition(db, job, status, message)


# ------------------------------------------------------------ stage 1: quality


def run_job(job_id: str) -> None:
    """Entry point after submission: score the requirement, then stop for a human."""
    _guarded(job_id, _analyze_requirement)


def _analyze_requirement(job_id: str) -> None:
    workspace = settings.workspace_for(job_id)

    with session_scope() as db:
        job = db.get(Job, job_id)
        if job is None or job.status is not JobStatus.QUEUED:
            logger.warning("skipping analysis for %s", job_id)
            return
        transition(db, job, JobStatus.STARTING, f"Dispatching to {settings.executor} executor")

    with session_scope() as db:
        transition(
            db, db.get(Job, job_id), JobStatus.ANALYZING, "Scoring requirement quality"
        )

    result = _run_stage(job_id, "quality")

    if result.exit_code == 124:
        _fail(job_id, result.detail, JobStatus.TIMEOUT)
        return

    report = _read_json(workspace / "output" / "quality_report.json")
    if not result.succeeded or report is None:
        _fail(job_id, result.detail or "Requirement analysis produced no report")
        return

    with session_scope() as db:
        job = db.get(Job, job_id)
        job.quality_report = report
        overall = report.get("overall", {})
        record_event(
            db,
            job,
            "quality.scored",
            f"Requirement rated {overall.get('rating')} ({overall.get('score')}/4)",
            {"score": overall.get("score"), "rating": overall.get("rating")},
        )
        transition(
            db,
            job,
            JobStatus.AWAITING_APPROVAL,
            "Awaiting human approval of requirement quality",
        )


# ------------------------------------------------- stage 2: generate + evaluate


def run_generation(job_id: str, reprocess: bool = False) -> None:
    """Generate the suite and evaluate it. Runs only after human approval."""
    _guarded(job_id, lambda jid: _generate_and_evaluate(jid, reprocess))


def _generate_and_evaluate(job_id: str, reprocess: bool) -> None:
    workspace = settings.workspace_for(job_id)

    with session_scope() as db:
        job = db.get(Job, job_id)
        attempt = job.reprocess_count if job else 0

    result = _run_stage(job_id, "generate", reprocess, attempt)

    with session_scope() as db:
        job = db.get(Job, job_id)
        if job is None:
            return
        # Respect a concurrent cancellation: the user may have cancelled while
        # the runner was still executing. Do not overwrite a terminal state.
        if job.status.is_terminal:
            logger.info("job %s already terminal (%s), skipping post-run", job_id, job.status.value)
            return
        if result.exit_code == 124:
            job.error_message = result.detail
            transition(db, job, JobStatus.TIMEOUT, result.detail)
            return
        transition(db, job, JobStatus.VALIDATING, "Runner finished, validating output")

    output_dir = workspace / "output"
    validation = _read_json(output_dir / "validation.json")
    metadata = _read_json(output_dir / "run_metadata.json")
    result_doc = _read_json(output_dir / "test_cases.json")

    with session_scope() as db:
        job = db.get(Job, job_id)
        if job is None:
            return
        if job.status.is_terminal:
            logger.info("job %s already terminal (%s), skipping validation", job_id, job.status.value)
            return

        if metadata:
            job.provenance = {
                key: metadata.get(key)
                for key in (
                    "engine", "stage", "reprocess", "skill", "agents", "skill_version",
                    "runner_version", "copilot_cli_version", "input_hash",
                    "output_hash", "review_attempts", "phases", "model_fallback",
                )
                if key in metadata
            }

        if not result.succeeded or result_doc is None:
            detail = result.detail or "Runner produced no test_cases.json"
            if validation and validation.get("errors"):
                first = validation["errors"][0]
                detail = f"{detail}: [{first['code']}] {first['detail']}"
            job.error_message = detail
            record_event(db, job, "validation.failed", detail, validation)
            transition(db, job, JobStatus.FAILED, detail)
            return

        if validation and not validation.get("valid", False):
            job.error_message = "Output failed validation"
            record_event(db, job, "validation.failed", job.error_message, validation)
            transition(db, job, JobStatus.FAILED, job.error_message)
            return

        job.summary = _summarize(result_doc)
        record_event(
            db, job, "validation.passed",
            f"{job.summary['total']} test cases validated",
            validation.get("stats") if validation else None,
        )
        transition(db, job, JobStatus.EVALUATING, "Evaluating the generated suite")

    evaluation = _read_json(output_dir / "evaluation.json")

    with session_scope() as db:
        job = db.get(Job, job_id)
        if job is None:
            return
        if job.status.is_terminal:
            logger.info("job %s already terminal (%s), skipping evaluation", job_id, job.status.value)
            return
        if evaluation is not None:
            job.evaluation = evaluation
            overall = evaluation.get("overall", {})
            record_event(
                db, job, "evaluation.scored",
                f"Suite rated {overall.get('rating')} ({overall.get('score')}/100), "
                f"{len(evaluation.get('gaps', []))} gap(s)",
                {"score": overall.get("score"), "rating": overall.get("rating")},
            )
        else:
            # The suite is valid and usable; only the scoring is missing.
            record_event(db, job, "evaluation.missing", "No evaluation.json was produced")

        transition(db, job, JobStatus.COMPLETED, "Job completed successfully")


# --------------------------------------------------------------- human actions


def approve_job(db: Session, job: Job, approved_by: str) -> Job:
    """Accept the requirement quality and release the generation stage."""
    if job.status is not JobStatus.AWAITING_APPROVAL:
        raise JobError(
            f"Job {job.id} is {job.status.value}, not awaiting approval", status_code=409
        )
    job.approved_at = utcnow()
    job.approved_by = approved_by
    transition(db, job, JobStatus.RUNNING, f"Requirement approved by {approved_by}")
    return job


def reject_job(db: Session, job: Job, rejected_by: str, reason: str = "") -> Job:
    """Stop at the gate: the requirement is not good enough to generate from."""
    if job.status is not JobStatus.AWAITING_APPROVAL:
        raise JobError(
            f"Job {job.id} is {job.status.value}, not awaiting approval", status_code=409
        )
    job.error_message = reason or "Requirement quality rejected"
    transition(db, job, JobStatus.REJECTED, f"Rejected by {rejected_by}: {job.error_message}")
    return job


def start_reprocess(db: Session, job: Job) -> Job:
    """Re-run generation once, feeding the evaluator's recommendations back in."""
    if job.status is not JobStatus.COMPLETED:
        raise JobError(
            f"Job {job.id} is {job.status.value}; only a completed job can be reprocessed",
            status_code=409,
        )
    if job.reprocess_count >= MAX_REPROCESS:
        raise JobError(
            f"Job {job.id} has already been reprocessed {job.reprocess_count} time(s); "
            f"the limit is {MAX_REPROCESS}.",
            status_code=409,
        )
    if not job.evaluation:
        raise JobError("No evaluation to reprocess against", status_code=409)

    job.reprocess_count += 1
    job.error_message = None
    transition(
        db, job, JobStatus.RUNNING,
        f"Reprocessing to close {len(job.evaluation.get('gaps', []))} gap(s)",
        {"attempt": job.reprocess_count},
    )
    return job



# --------------------------------------------------------------------- reads


def reconcile_orphaned_jobs() -> int:
    """Fail jobs left mid-flight by a previous process, at startup.

    Execution is driven by an in-process background task, so a restart abandons
    whatever was running: the runner may well finish, but nothing is left to
    record the result and the row would sit in RUNNING forever.

    This assumes a single orchestrator replica — with more than one, this would
    wrongly fail jobs another replica is actively running. The deployment pins
    replicas to 1 for exactly this reason; a real work queue is the fix before
    scaling out.
    """
    orphaned = 0
    with session_scope() as db:
        for job in db.scalars(select(Job).where(Job.status.in_(IN_FLIGHT_STATES))):
            job.error_message = (
                "Orchestrator restarted while this job was in flight; "
                "its result was not recorded. Re-run the requirement."
            )
            transition(db, job, JobStatus.FAILED, "Orphaned by orchestrator restart")
            orphaned += 1

    if orphaned:
        logger.warning("Reconciled %d orphaned job(s) at startup", orphaned)
    return orphaned


def backfill_missing_evaluations() -> int:
    """Load evaluations that exist on disk but never reached the job row.

    `_add_missing_columns` can only ADD the `evaluation` column — it cannot
    populate it for jobs that completed before the column existed. Those rows
    keep a NULL evaluation even though the runner wrote evaluation.json into the
    workspace, and `start_reprocess` then refuses them with "No evaluation to
    reprocess against" forever. The artifact is the source of truth here, so
    adopt it rather than leaving the row permanently unreprocessable.
    """
    backfilled = 0
    with session_scope() as db:
        stmt = select(Job).where(
            Job.status == JobStatus.COMPLETED, Job.evaluation.is_(None)
        )
        for job in db.scalars(stmt):
            evaluation = _read_json(
                settings.workspace_for(job.id) / "output" / "evaluation.json"
            )
            if evaluation is None:
                continue  # genuinely never evaluated; leave it alone
            job.evaluation = evaluation
            record_event(
                db,
                job,
                "evaluation.backfilled",
                "Adopted evaluation.json from the workspace",
                {"score": evaluation.get("overall", {}).get("score")},
            )
            backfilled += 1

    if backfilled:
        logger.info("Backfilled evaluation for %d completed job(s)", backfilled)
    return backfilled


def get_job(db: Session, job_id: str) -> Job:
    job = db.get(Job, job_id)
    if job is None:
        raise JobError(f"Job {job_id} not found", status_code=404)
    return job


def list_jobs(db: Session, *, limit: int = 50, status: JobStatus | None = None) -> list[Job]:
    stmt = select(Job).order_by(Job.created_at.desc()).limit(limit)
    if status is not None:
        stmt = stmt.where(Job.status == status)
    return list(db.scalars(stmt))


def read_logs(job: Job) -> str:
    log_path = settings.workspace_for(job.id) / "output" / "execution.log"
    if not log_path.exists():
        return ""
    try:
        return log_path.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        return f"[orchestrator] could not read logs: {exc}\n"


def read_result(job: Job) -> tuple[dict[str, Any], dict[str, Any] | None]:
    output_dir = settings.workspace_for(job.id) / "output"
    result_doc = _read_json(output_dir / "test_cases.json")
    if result_doc is None:
        raise JobError(f"No result available for job {job.id}", status_code=404)
    return result_doc, _read_json(output_dir / "validation.json")


def list_artifacts(job: Job) -> list[dict[str, Any]]:
    workspace = settings.workspace_for(job.id)
    if not workspace.exists():
        return []
    artifacts: list[dict[str, Any]] = []
    for path in sorted(workspace.rglob("*")):
        if path.is_file():
            artifacts.append(
                {
                    "path": str(path.relative_to(workspace)),
                    "size_bytes": path.stat().st_size,
                }
            )
    return artifacts


def cancel_job(db: Session, job: Job) -> Job:
    if job.status.is_terminal:
        raise JobError(
            f"Job {job.id} is already {job.status.value}", status_code=409
        )
    job.error_message = "Cancelled by user"
    transition(db, job, JobStatus.CANCELLED, "Cancelled by user")
    return job


def platform_stats(db: Session) -> dict[str, Any]:
    """Dashboard counters (blueprint §44)."""
    rows = db.execute(select(Job.status, func.count(Job.id)).group_by(Job.status)).all()
    by_status = {status.value: count for status, count in rows}

    total = sum(by_status.values())
    completed = by_status.get(JobStatus.COMPLETED.value, 0)
    failed = by_status.get(JobStatus.FAILED.value, 0)
    finished = completed + failed

    mean_duration = db.scalar(
        select(func.avg(Job.duration_ms)).where(Job.status == JobStatus.COMPLETED)
    )
    completed_jobs = db.scalars(
        select(Job).where(Job.status == JobStatus.COMPLETED, Job.summary.is_not(None))
    ).all()
    case_counts = [
        (job.summary or {}).get("total", 0)
        for job in completed_jobs
        if isinstance(job.summary, dict)
    ]

    return {
        "total_jobs": total,
        "by_status": by_status,
        "active_jobs": sum(by_status.get(s.value, 0) for s in ACTIVE_STATES),
        "awaiting_approval": by_status.get(JobStatus.AWAITING_APPROVAL.value, 0),
        "success_rate": round(completed / finished, 4) if finished else None,
        "mean_duration_ms": int(mean_duration) if mean_duration else None,
        "mean_test_cases": round(sum(case_counts) / len(case_counts), 1)
        if case_counts
        else None,
        "total_test_cases": sum(case_counts),
        "executor": settings.executor,
        "engine": settings.engine,
    }
