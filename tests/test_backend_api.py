import io
import logging

import pytest

# `client` is the operator-authenticated fixture from conftest. Authorisation
# itself is exercised in test_security.py.


def test_health_endpoint(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "executor" in data
    assert "engine" in data


def test_models_endpoint(client):
    response = client.get("/api/v1/models")
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0
    # Pin the ids the UI and runner actually select on, so dropping or renaming
    # a model in AVAILABLE_MODELS fails here instead of silently shipping a
    # model picker whose options the Copilot CLI no longer accepts.
    ids = {m["id"] for m in data}
    assert {"claude-3.7-sonnet", "gpt-4o"} <= ids, ids
    assert all(m["name"] and m["provider"] for m in data)


def test_workflows_endpoint(client):
    response = client.get("/api/v1/workflows")
    assert response.status_code == 200
    data = response.json()
    assert any(w["id"] == "test-case-generation" for w in data)


def test_skills_endpoint(client):
    response = client.get("/api/v1/skills")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    skill_ids = {s["id"] for s in data}
    assert "test-case-generation" in skill_ids
    assert "document-ocr" in skill_ids
    for skill in data:
        assert len(skill["content"]) > 0, f"{skill['id']} loaded empty SKILL.md content"
        # "document-ocr" must not be mangled to "Document Ocr" by naive title-casing.
        assert "Ocr" not in skill["name"].split(), skill["name"]


def test_agents_endpoint(client):
    response = client.get("/api/v1/agents")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 5
    agent_ids = {a["id"] for a in data}
    assert "ocr-extractor" in agent_ids
    assert "requirement-analyst" in agent_ids
    assert "test-designer" in agent_ids
    assert "test-generator" in agent_ids
    assert "test-reviewer" in agent_ids
    assert "test-evaluator" in agent_ids


def test_ocr_extract_endpoint(client, monkeypatch):
    import base64
    # No token supplied and ENGINE forced to mock, so this deterministically
    # takes the fallback path regardless of the ambient environment/.env.
    monkeypatch.setenv("ENGINE", "mock")
    fake_png = base64.b64encode(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01").decode("utf-8")
    response = client.post(
        "/api/v1/ocr/extract",
        json={
            "image_base64": fake_png,
            "mime_type": "image/png",
            "filename": "sample_architecture_spec.png",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "markdown" in data
    assert len(data["markdown"]) > 20
    # No token was supplied, so this must be honestly labeled as a fallback,
    # not reported as a real "ghcp-vision" extraction.
    assert data["engine"] == "ghcp-vision-fallback"


def test_ocr_extract_reports_api_failure_as_fallback(client, monkeypatch, caplog):
    """A failed Vision call must never be presented as a real extraction.

    Every error path returns canned placeholder Markdown with HTTP 200, so the
    engine label is the only thing telling a caller that the text it is about
    to feed into test generation did not come from their document.
    """
    import base64
    import urllib.error
    import urllib.request

    monkeypatch.setenv("ENGINE", "copilot")

    def _raise_401(*args, **kwargs):
        raise urllib.error.HTTPError(
            url="https://models.inference.ai.azure.com/chat/completions",
            code=401,
            msg="Unauthorized",
            hdrs=None,
            fp=io.BytesIO(b'{"error":"bad credentials"}'),
        )

    monkeypatch.setattr(urllib.request, "urlopen", _raise_401)

    fake_png = base64.b64encode(b"\x89PNG\r\n\x1a\n").decode("utf-8")
    with caplog.at_level(logging.WARNING):
        response = client.post(
            "/api/v1/ocr/extract",
            json={
                "image_base64": fake_png,
                "mime_type": "image/png",
                "github_token": "ghp_expired_token",
            },
        )

    assert response.status_code == 200
    assert response.json()["engine"] == "ghcp-vision-fallback"
    # HTTPError subclasses URLError. If the handlers are ever reordered so the
    # URLError branch wins, the response body explaining *why* auth failed is
    # swallowed and this assertion catches it.
    assert "bad credentials" in caplog.text


def test_ocr_extract_endpoint_rejects_invalid_base64(client):
    response = client.post(
        "/api/v1/ocr/extract",
        json={
            "image_base64": "not-valid-base64!!!",
            "mime_type": "image/png",
        },
    )
    assert response.status_code == 400


@pytest.mark.parametrize("used_ocr", [True, False])
def test_job_records_ocr_phase_only_when_ocr_was_used(client, used_ocr):
    """The OCR phase row on the job page is driven purely by this event.

    OCR runs client-side via /ocr/extract before the job exists, so the runner
    never sees an image and never emits its own ocr-extractor phase. Without
    this event the job page shows "skipped" even for jobs that did use OCR.
    """
    import uuid

    res = client.post(
        "/api/v1/jobs",
        json={
            "requirement": (
                "REQ-OCR-777 Document Extraction\n\n"
                "The system must transcribe uploaded specification images.\n"
                "- Extracted text must preserve table structure.\n"
                "- Unreadable regions must be flagged for review."
            ),
            "workflow": "test-case-generation",
            "created_by": f"ocr-tester-{uuid.uuid4().hex[:6]}@agenthub.ai",
            "used_ocr": used_ocr,
        },
    )
    assert res.status_code == 201

    detail = client.get(f"/api/v1/jobs/{res.json()['job_id']}")
    assert detail.status_code == 200
    phases = {
        (e.get("event_metadata") or {}).get("phase")
        for e in detail.json()["events"]
    }
    assert ("ocr-extractor" in phases) is used_ocr


def test_evaluations_benchmarks_endpoint(client):
    response = client.get("/api/v1/evaluations/benchmarks")
    assert response.status_code == 200
    data = response.json()
    assert len(data["dimensions"]) == 5
    assert len(data["benchmarks"]) >= 1


def test_job_lifecycle_and_approval(client):
    import uuid
    user_id = f"tester-{uuid.uuid4().hex[:6]}@agenthub.ai"
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
            "created_by": user_id,
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
    # The job is owned by the authenticated principal, not by whatever the
    # request body claimed — otherwise per-user rate limits mean nothing.
    assert job_data["created_by"] == "test-operator"

    # 3. Test stats endpoint
    stats_res = client.get("/api/v1/stats")
    assert stats_res.status_code == 200
    assert stats_res.json()["total_jobs"] >= 1
