"""What runs cost, how long they took, and which agents are responsible.

The platform's unit of work is a model call, so "what did that cost" and "why
was that slow" are the first two questions anyone asks at scale. Everything here
is derived from what runs already record — per-stage duration and token usage in
``run_metadata.json``, rolled onto the job's provenance — rather than from a
separate metrics pipeline.
"""
from __future__ import annotations

import os
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.jobs import Job, JobStatus

#: USD per million tokens, input/output. Approximate list prices, kept in one
#: place and clearly labelled: a cost figure derived from a stale table is worse
#: than no figure, so the API reports the table's own version alongside it.
#:
#: Override with COST_TABLE_JSON to keep it current without a code change.
PRICING_VERSION = "2026-08"

_DEFAULT_PRICING: dict[str, dict[str, float]] = {
    "claude-3.5-sonnet": {"input": 3.00, "output": 15.00},
    "claude-3.7-sonnet": {"input": 3.00, "output": 15.00},
    "claude-3.5-haiku": {"input": 0.80, "output": 4.00},
    "gpt-4o": {"input": 2.50, "output": 10.00},
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
    "o1": {"input": 15.00, "output": 60.00},
    "o3-mini": {"input": 1.10, "output": 4.40},
}


def _pricing() -> dict[str, dict[str, float]]:
    raw = os.getenv("COST_TABLE_JSON", "").strip()
    if not raw:
        return _DEFAULT_PRICING
    try:
        import json

        table = json.loads(raw)
        if isinstance(table, dict):
            return {**_DEFAULT_PRICING, **table}
    except (ValueError, TypeError):
        pass
    return _DEFAULT_PRICING


def estimate_cost(
    model: str | None, input_tokens: int, output_tokens: int
) -> float | None:
    """USD for a call, or None when the model is not in the table.

    None rather than zero: an unknown model has an unknown cost, and reporting
    zero would quietly understate a total.
    """
    if not model:
        return None
    rates = _pricing().get(model.strip().lower())
    if not rates:
        return None
    return (input_tokens / 1_000_000) * rates["input"] + (
        output_tokens / 1_000_000
    ) * rates["output"]


def _stages_of(job: Job) -> list[dict[str, Any]]:
    """Per-stage records from whichever runner produced them.

    The generic runner writes `stages`; the bespoke chain writes `phases`. They
    describe the same thing, so normalise here rather than at every call site.
    """
    provenance = job.provenance or {}

    stages = provenance.get("stages")
    if isinstance(stages, list):
        return [s for s in stages if isinstance(s, dict)]

    phases = provenance.get("phases")
    if isinstance(phases, list):
        return [
            {
                "agent_id": p.get("name"),
                "stage": p.get("name"),
                "status": p.get("status"),
                "duration_ms": p.get("duration_ms", 0),
                "usage": {},
            }
            for p in phases
            if isinstance(p, dict)
        ]

    return []


def job_breakdown(job: Job) -> dict[str, Any]:
    """Per-stage timing, tokens and cost for one run."""
    model = job.copilot_model or (job.provenance or {}).get("copilot_model")
    rows: list[dict[str, Any]] = []
    any_estimated = False

    total_input = total_output = total_tokens = 0
    total_cost = 0.0
    cost_known = False

    for stage in _stages_of(job):
        usage = stage.get("usage") or {}
        inp = usage.get("input_tokens") or 0
        out = usage.get("output_tokens") or 0
        tot = usage.get("total_tokens") or (inp + out)
        if usage.get("estimated"):
            any_estimated = True

        cost = estimate_cost(model, inp, out)
        if cost is not None:
            total_cost += cost
            cost_known = True

        total_input += inp
        total_output += out
        total_tokens += tot

        rows.append(
            {
                "stage": stage.get("stage") or stage.get("agent_id"),
                "agent_id": stage.get("agent_id"),
                "status": stage.get("status"),
                "duration_ms": stage.get("duration_ms") or 0,
                "attempts": stage.get("attempts", 1),
                "contract": stage.get("contract", ""),
                "input_tokens": inp or None,
                "output_tokens": out or None,
                "total_tokens": tot or None,
                "cost_usd": round(cost, 6) if cost is not None else None,
                "resumed": bool(stage.get("resumed")),
            }
        )

    return {
        "job_id": job.id,
        "workflow": job.workflow,
        "model": model,
        "status": job.status.value,
        "duration_ms": job.duration_ms,
        "stages": rows,
        "totals": {
            "input_tokens": total_input or None,
            "output_tokens": total_output or None,
            "total_tokens": total_tokens or None,
            "cost_usd": round(total_cost, 6) if cost_known else None,
            "stage_duration_ms": sum(r["duration_ms"] for r in rows),
            "tokens_estimated": any_estimated,
            "cost_known": cost_known,
        },
        "pricing_version": PRICING_VERSION,
    }


def agent_leaderboard(db: Session, *, days: int = 30) -> list[dict[str, Any]]:
    """Per-agent totals across recent runs — where the time and money go."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    jobs = db.scalars(
        select(Job).where(Job.created_at >= since, Job.provenance.is_not(None))
    ).all()

    acc: dict[str, dict[str, Any]] = defaultdict(
        lambda: {
            "runs": 0,
            "failures": 0,
            "retries": 0,
            "duration_ms": 0,
            "total_tokens": 0,
            "cost_usd": 0.0,
            "cost_known": False,
        }
    )

    for job in jobs:
        model = job.copilot_model or (job.provenance or {}).get("copilot_model")
        for stage in _stages_of(job):
            agent_id = stage.get("agent_id")
            if not agent_id:
                continue
            row = acc[str(agent_id)]
            row["runs"] += 1
            if stage.get("status") == "failed":
                row["failures"] += 1
            row["retries"] += max(0, int(stage.get("attempts", 1)) - 1)
            row["duration_ms"] += int(stage.get("duration_ms") or 0)

            usage = stage.get("usage") or {}
            inp = usage.get("input_tokens") or 0
            out = usage.get("output_tokens") or 0
            row["total_tokens"] += usage.get("total_tokens") or (inp + out)
            cost = estimate_cost(model, inp, out)
            if cost is not None:
                row["cost_usd"] += cost
                row["cost_known"] = True

    leaderboard = []
    for agent_id, row in acc.items():
        runs = row["runs"] or 1
        leaderboard.append(
            {
                "agent_id": agent_id,
                "runs": row["runs"],
                "failures": row["failures"],
                "failure_rate": round(row["failures"] / runs, 4),
                "retries": row["retries"],
                "total_duration_ms": row["duration_ms"],
                "mean_duration_ms": int(row["duration_ms"] / runs),
                "total_tokens": row["total_tokens"] or None,
                "cost_usd": round(row["cost_usd"], 4) if row["cost_known"] else None,
            }
        )

    leaderboard.sort(key=lambda r: r["total_duration_ms"], reverse=True)
    return leaderboard


def workflow_summary(db: Session, *, days: int = 30) -> list[dict[str, Any]]:
    """Per-workflow run counts, success rate and mean duration."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    rows = db.execute(
        select(
            Job.workflow,
            Job.status,
            func.count(Job.id),
            func.avg(Job.duration_ms),
        )
        .where(Job.created_at >= since)
        .group_by(Job.workflow, Job.status)
    ).all()

    acc: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"total": 0, "completed": 0, "failed": 0, "duration_sum": 0.0, "duration_n": 0}
    )

    for workflow, status, count, mean_duration in rows:
        entry = acc[workflow]
        entry["total"] += count
        if status == JobStatus.COMPLETED:
            entry["completed"] += count
            if mean_duration:
                entry["duration_sum"] += float(mean_duration) * count
                entry["duration_n"] += count
        elif status in (JobStatus.FAILED, JobStatus.TIMEOUT):
            entry["failed"] += count

    summary = []
    for workflow, entry in acc.items():
        finished = entry["completed"] + entry["failed"]
        summary.append(
            {
                "workflow": workflow,
                "total": entry["total"],
                "completed": entry["completed"],
                "failed": entry["failed"],
                "success_rate": round(entry["completed"] / finished, 4) if finished else None,
                "mean_duration_ms": int(entry["duration_sum"] / entry["duration_n"])
                if entry["duration_n"]
                else None,
            }
        )

    summary.sort(key=lambda r: r["total"], reverse=True)
    return summary


def compare_runs(db: Session, left_id: str, right_id: str) -> dict[str, Any]:
    """Two runs side by side — what changed in time, tokens and outcome."""
    left = db.get(Job, left_id)
    right = db.get(Job, right_id)
    if left is None or right is None:
        missing = left_id if left is None else right_id
        raise LookupError(f"Job {missing} not found")

    a = job_breakdown(left)
    b = job_breakdown(right)

    by_stage_a = {r["stage"]: r for r in a["stages"]}
    by_stage_b = {r["stage"]: r for r in b["stages"]}

    stages = []
    for name in sorted(set(by_stage_a) | set(by_stage_b), key=str):
        ra, rb = by_stage_a.get(name), by_stage_b.get(name)
        stages.append(
            {
                "stage": name,
                "left": ra,
                "right": rb,
                "duration_delta_ms": (
                    (rb["duration_ms"] - ra["duration_ms"]) if ra and rb else None
                ),
                "token_delta": (
                    ((rb["total_tokens"] or 0) - (ra["total_tokens"] or 0))
                    if ra and rb
                    else None
                ),
            }
        )

    def delta(x: Any, y: Any) -> Any:
        return (y - x) if isinstance(x, (int, float)) and isinstance(y, (int, float)) else None

    return {
        "left": a,
        "right": b,
        "same_workflow": left.workflow == right.workflow,
        "stages": stages,
        "totals": {
            "duration_delta_ms": delta(a["duration_ms"], b["duration_ms"]),
            "token_delta": delta(
                a["totals"]["total_tokens"], b["totals"]["total_tokens"]
            ),
            "cost_delta_usd": delta(
                a["totals"]["cost_usd"], b["totals"]["cost_usd"]
            ),
        },
    }
