"""Agent testing and run insights.

Two things that make a growing catalog of agents tractable: a way to try one
before wiring it in, and a way to see what the ones already wired in are costing
you.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.security import Principal, require_operator, require_reader
from app.services import agent_lab, insights, job_service
from app.services.job_service import JobError

router = APIRouter(prefix=settings.api_prefix, tags=["lab"])

_AGENT_ID = Path(..., min_length=1, max_length=128, pattern=r"^[a-z0-9][a-z0-9\-]*$")


class AgentTestRequest(BaseModel):
    """Run one agent against sample input, in a throwaway workspace."""

    input: str = Field(..., min_length=1, max_length=50_000)
    engine: str | None = Field(default=None, max_length=32)
    model: str | None = Field(default=None, max_length=64)
    skill_id: str | None = Field(default=None, max_length=128)
    github_token: str | None = Field(default=None, max_length=256)


@router.post("/agents/{agent_id}/test")
def test_agent(
    payload: AgentTestRequest,
    agent_id: str = _AGENT_ID,
    _: Principal = Depends(require_operator),
) -> dict:
    """Try an agent and report whether its output matched its contract.

    Runs outside the job system entirely: no row, no workspace kept, no place in
    the queue. The point is a fast loop while writing the agent.
    """
    try:
        result = agent_lab.run_agent_test(
            agent_id,
            payload.input,
            engine=payload.engine,
            model=payload.model,
            github_token=payload.github_token,
            skill_id=payload.skill_id,
        )
    except agent_lab.AgentTestError as exc:
        raise HTTPException(400, str(exc)) from exc

    return result.as_dict()


@router.get("/agents/{agent_id}/fingerprint")
def agent_fingerprint(
    agent_id: str = _AGENT_ID,
    _: Principal = Depends(require_reader),
) -> dict:
    """A content hash of the agent definition, for tracing a result to a version."""
    fingerprint = agent_lab.agent_fingerprint(agent_id)
    if fingerprint is None:
        raise HTTPException(404, f"Agent '{agent_id}' not found")
    return {"agent_id": agent_id, "fingerprint": fingerprint}


# ---------------------------------------------------------------- insights

@router.get("/insights/jobs/{job_id}")
def job_insights(
    job_id: str,
    db: Session = Depends(get_db),
    _: Principal = Depends(require_reader),
) -> dict:
    """Per-stage timing, tokens and cost for one run."""
    try:
        job = job_service.get_job(db, job_id)
    except JobError as exc:
        raise HTTPException(exc.status_code, str(exc)) from exc
    return insights.job_breakdown(job)


@router.get("/insights/agents")
def agent_insights(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    _: Principal = Depends(require_reader),
) -> dict:
    """Where time and money go, per agent, over a window."""
    return {
        "days": days,
        "agents": insights.agent_leaderboard(db, days=days),
        "pricing_version": insights.PRICING_VERSION,
    }


@router.get("/insights/workflows")
def workflow_insights(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    _: Principal = Depends(require_reader),
) -> dict:
    """Run counts, success rate and mean duration, per workflow."""
    return {"days": days, "workflows": insights.workflow_summary(db, days=days)}


@router.get("/insights/compare")
def compare_runs(
    left: str = Query(..., min_length=1, max_length=32),
    right: str = Query(..., min_length=1, max_length=32),
    db: Session = Depends(get_db),
    _: Principal = Depends(require_reader),
) -> dict:
    """Two runs side by side — what changed in time, tokens and outcome."""
    try:
        return insights.compare_runs(db, left, right)
    except LookupError as exc:
        raise HTTPException(404, str(exc)) from exc
