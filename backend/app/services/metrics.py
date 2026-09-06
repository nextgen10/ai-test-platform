"""Prometheus exposition for the orchestrator.

The platform already answers "am I alive" (`/health`) and "can I serve"
(`/ready`). Neither answers the questions an operator actually has at 3am —
*is the queue draining, are jobs failing, is anything stuck waiting on a human* —
and a dashboard that has to poll `/stats` and diff it by hand is not monitoring.

Written by hand rather than with ``prometheus_client``: the numbers all come
from one grouped query the platform already runs, the text format is a few
lines, and a production image is a worse trade for one more dependency to pin,
patch and audit. If histograms or exemplars are ever needed, take the library
then — this is deliberately the smallest thing that a scrape can consume.
"""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.jobs import Job, JobStatus

#: Bumped when a metric changes meaning, so a dashboard can tell.
METRICS_VERSION = "1"


def _escape(value: str) -> str:
    """Escape a label value per the exposition format."""
    return value.replace("\\", r"\\").replace('"', r"\"").replace("\n", r"\n")


class _Doc:
    """Accumulates lines of the text exposition format."""

    def __init__(self) -> None:
        self._lines: list[str] = []

    def metric(
        self,
        name: str,
        kind: str,
        help_text: str,
        samples: list[tuple[dict[str, str], float]],
    ) -> None:
        self._lines.append(f"# HELP {name} {help_text}")
        self._lines.append(f"# TYPE {name} {kind}")
        for labels, value in samples:
            rendered = ",".join(
                f'{key}="{_escape(str(val))}"' for key, val in sorted(labels.items())
            )
            suffix = f"{{{rendered}}}" if rendered else ""
            # Integers as integers: a counter rendered 12.0 reads as a rounding
            # artefact to whoever is staring at the graph.
            number = int(value) if float(value).is_integer() else value
            self._lines.append(f"{name}{suffix} {number}")

    def render(self) -> str:
        return "\n".join(self._lines) + "\n"


def render(db: Session) -> str:
    """Every metric this process can report, in Prometheus text format."""
    from app.services import queue

    doc = _Doc()

    # --- jobs, by state. One row per state that has ever existed, plus a zero
    # for the states that have not: a series that only appears once something
    # fails is a series no alert can be written against.
    counts = dict(
        db.execute(select(Job.status, func.count(Job.id)).group_by(Job.status)).all()
    )
    doc.metric(
        "agent_hub_jobs_total",
        "gauge",
        "Jobs on this platform, by lifecycle state.",
        [
            ({"status": status.value}, counts.get(status, 0))
            for status in JobStatus
        ],
    )

    # --- the queue. `waiting` is the number an autoscaler would scale on;
    # `in_flight` and `active_workers` are how you tell a busy platform from a
    # stalled one, which look identical from job counts alone.
    depth = queue.queue_depth()
    doc.metric(
        "agent_hub_queue_waiting",
        "gauge",
        "Jobs that are claimable right now and have no worker.",
        [({}, depth["waiting"])],
    )
    doc.metric(
        "agent_hub_queue_in_flight",
        "gauge",
        "Jobs currently held by a worker with a live lease.",
        [({}, depth["in_flight"])],
    )
    doc.metric(
        "agent_hub_active_workers",
        "gauge",
        "Distinct workers holding at least one live lease.",
        [({}, depth["active_workers"])],
    )

    # --- how long the work takes. Mean rather than quantiles: without a
    # histogram there is nothing honest to say about p95, and inventing one
    # from the mean is worse than not having it.
    mean_duration = db.scalar(
        select(func.avg(Job.duration_ms)).where(Job.status == JobStatus.COMPLETED)
    )
    doc.metric(
        "agent_hub_job_duration_mean_ms",
        "gauge",
        "Mean wall-clock duration of completed jobs, in milliseconds.",
        [({}, int(mean_duration or 0))],
    )

    # --- what this replica is. Lets a scrape tell two differently configured
    # replicas apart, which is exactly the case that produces a confusing graph.
    doc.metric(
        "agent_hub_build_info",
        "gauge",
        "Static configuration of this replica; always 1.",
        [
            (
                {
                    "executor": settings.executor,
                    "engine": settings.engine,
                    "runner_version": settings.runner_version,
                    "worker": queue.WORKER_ID,
                    "metrics_version": METRICS_VERSION,
                },
                1,
            )
        ],
    )

    return doc.render()
