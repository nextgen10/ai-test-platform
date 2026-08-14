import pytest
from fastapi.testclient import TestClient

from app.database import Base, get_db
from app.main import app
from app.models.jobs import Job, JobStatus
from app.services import job_service

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "executor" in data
    assert "engine" in data


def test_models_endpoint():
    response = client.get("/api/v1/models")
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0
    assert any(m["id"] == "claude-sonnet-4.5" for m in data)


def test_workflows_endpoint():
    response = client.get("/api/v1/workflows")
    assert response.status_code == 200
    data = response.json()
    assert any(w["id"] == "test-case-generation" for w in data)


def test_skills_endpoint():
    response = client.get("/api/v1/skills")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["id"] == "test-case-generation"
    assert len(data[0]["content"]) > 0


def test_agents_endpoint():
    response = client.get("/api/v1/agents")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 5
    agent_ids = {a["id"] for a in data}
    assert "requirement-analyst" in agent_ids
    assert "test-designer" in agent_ids
    assert "test-generator" in agent_ids
    assert "test-reviewer" in agent_ids
    assert "test-evaluator" in agent_ids


def test_evaluations_benchmarks_endpoint():
    response = client.get("/api/v1/evaluations/benchmarks")
    assert response.status_code == 200
    data = response.json()
    assert len(data["dimensions"]) == 5
    assert len(data["benchmarks"]) >= 1


def test_job_lifecycle_and_approval():
    req_text = """REQ-999 Email Verification

A newly registered user must verify their email within 24 hours.

- A 6-digit OTP code is sent to the registered email address.
- The OTP code expires after 10 minutes.
- After 3 incorrect attempts, the code is invalidated and a new one must be requested.
- If verified successfully, the account status moves to ACTIVE.
"""
    # 1. Create Job
    create_res = client.post(
        "/api/v1/jobs",
        json={
            "requirement": req_text,
            "workflow": "test-case-generation",
            "created_by": "tester@qualaris.ai",
        },
    )
    assert create_res.status_code == 201
    job_id = create_res.json()["job_id"]
    assert job_id is not None

    # 2. Get Job Details
    job_res = client.get(f"/api/v1/jobs/{job_id}")
    assert job_res.status_code == 200
    job_data = job_res.json()
    assert job_data["id"] == job_id
    assert job_data["created_by"] == "tester@qualaris.ai"

    # 3. Test stats endpoint
    stats_res = client.get("/api/v1/stats")
    assert stats_res.status_code == 200
    assert stats_res.json()["total_jobs"] >= 1
