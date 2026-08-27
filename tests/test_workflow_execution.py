"""A workflow onboarded as data must actually run.

This is the loop that was broken: the Registry wrote `.workflow.yaml` files that
nothing could execute, because the generic runner was never wired to an
executor and the job pipeline was hardcoded to the test-generation chain.
"""
import time

import pytest

from app.config import settings
from app.services import hub_registry

AGENT = """---
name: zz-echo-agent
description: A throwaway agent for the workflow execution test.
tools: ["read", "write"]
role: "Test Fixture"
stage: echo
input_artifact: input/requirement.md
output_artifact: output/zz-echo-agent.md
---

# Echo Agent

Read `input/requirement.md` and write it back to `output/zz-echo-agent.md`.
"""

WORKFLOW = """id: zz-echo-workflow
name: Echo Workflow
description: A single-stage declarative workflow used by the test suite.
version: "1.0"
runner: generic
approval_gate: false
available: true
has_custom_ui: false
agents:
  - id: zz-echo-agent
    stage: echo
    optional: false
    description: Echo the input
output:
  type: markdown
  primary_artifact: output/zz-echo-agent.md
"""


@pytest.fixture
def echo_workflow(author):
    """Onboard an agent and a workflow, then clean both up."""
    author.delete("/api/v1/hub/workflows/zz-echo-workflow")
    author.delete("/api/v1/hub/agents/zz-echo-agent")

    assert author.post(
        "/api/v1/hub/agents", json={"id": "zz-echo-agent", "content": AGENT}
    ).status_code == 201
    assert author.post(
        "/api/v1/hub/workflows", json={"id": "zz-echo-workflow", "content": WORKFLOW}
    ).status_code == 201

    yield "zz-echo-workflow"

    author.delete("/api/v1/hub/workflows/zz-echo-workflow")
    author.delete("/api/v1/hub/agents/zz-echo-agent")


def _wait_for_terminal(client, job_id, timeout=40.0):
    deadline = time.monotonic() + timeout
    job = client.get(f"/api/v1/jobs/{job_id}").json()
    while time.monotonic() < deadline:
        if job["status"] in ("COMPLETED", "FAILED", "TIMEOUT", "CANCELLED", "REJECTED"):
            return job
        time.sleep(0.2)
        job = client.get(f"/api/v1/jobs/{job_id}").json()
    return job


def test_a_newly_onboarded_workflow_appears_in_every_catalog(echo_workflow, reader):
    """One registry: the hub, /workflows and the console picker cannot diverge."""
    hub_ids = {w["id"] for w in reader.get("/api/v1/hub/workflows").json()}
    api_ids = {w["id"] for w in reader.get("/api/v1/workflows").json()}
    assert echo_workflow in hub_ids
    assert hub_ids == api_ids


def test_a_declarative_workflow_runs_end_to_end(echo_workflow, operator, worker):
    """The generic runner executes it, and the job records what happened."""
    response = operator.post(
        "/api/v1/jobs",
        json={
            "workflow": echo_workflow,
            "requirement": "REQ-ECHO Something worth echoing back to the caller.",
            "engine": "mock",
        },
    )
    assert response.status_code == 201
    job = _wait_for_terminal(operator, response.json()["job_id"])

    assert job["status"] == "COMPLETED", job.get("error_message")

    # Provenance comes from the runner's own run_metadata.json.
    stages = (job["provenance"] or {}).get("stages") or []
    assert [s["agent_id"] for s in stages] == ["zz-echo-agent"]
    assert stages[0]["status"] == "completed"

    # The workflow's declared primary artifact was produced and summarised.
    paths = {a["path"] for a in operator.get(f"/api/v1/jobs/{job['id']}/artifacts").json()}
    assert "output/zz-echo-agent.md" in paths
    assert (job["summary"] or {}).get("artifact") == "output/zz-echo-agent.md"


def test_a_declarative_workflow_skips_the_approval_gate(echo_workflow, operator, worker):
    """`approval_gate: false` means it runs straight through, with no human stop."""
    response = operator.post(
        "/api/v1/jobs",
        json={
            "workflow": echo_workflow,
            "requirement": "REQ-ECHO-2 No approval needed for this one.",
            "engine": "mock",
        },
    )
    job = _wait_for_terminal(operator, response.json()["job_id"])
    assert job["status"] == "COMPLETED"
    assert job["approved_at"] is None

    statuses = [e["event_type"] for e in job["events"]]
    assert "status.awaiting_approval" not in statuses
    assert "status.running" in statuses


def test_the_bespoke_workflow_still_gates_on_a_human(operator, worker):
    """Generalising the pipeline must not remove the INVEST gate."""
    response = operator.post(
        "/api/v1/jobs",
        json={
            "workflow": "test-case-generation",
            "requirement": (
                "REQ-GATE A user must be able to reset a forgotten password.\n"
                "- The reset link expires after 15 minutes.\n"
                "- The new password must differ from the previous three."
            ),
            "engine": "mock",
        },
    )
    assert response.status_code == 201
    job_id = response.json()["job_id"]

    deadline = time.monotonic() + 40
    job = operator.get(f"/api/v1/jobs/{job_id}").json()
    while time.monotonic() < deadline and job["status"] not in (
        "AWAITING_APPROVAL",
        "FAILED",
        "TIMEOUT",
    ):
        time.sleep(0.2)
        job = operator.get(f"/api/v1/jobs/{job_id}").json()

    assert job["status"] == "AWAITING_APPROVAL", job.get("error_message")
    assert job["quality_report"] is not None

    approved = operator.post(f"/api/v1/jobs/{job_id}/approve", json={"actor": "ignored"})
    assert approved.status_code == 200
    # The approver is the authenticated principal, not whatever the body claimed.
    assert approved.json()["approved_by"] == "test-operator"

    final = _wait_for_terminal(operator, job_id)
    assert final["status"] == "COMPLETED", final.get("error_message")
    assert (final["summary"] or {})["total"] > 0


def test_the_runner_choice_comes_from_the_workflow(echo_workflow):
    """`runner:` decides which engine drives a job — it is not hardcoded."""
    from app.services import job_service

    assert job_service.resolve_workflow(echo_workflow)["runner"] == "generic"
    assert job_service.resolve_workflow("test-case-generation")["runner"] == "bespoke"


def test_generic_runner_refuses_a_workflow_with_a_missing_agent(tmp_path):
    """It fails before running anything, rather than halfway through."""
    from generic_runner import GenericWorkflowRunner, WorkflowError

    hub = tmp_path / "hub"
    (hub / "workflows").mkdir(parents=True)
    (hub / "agents").mkdir(parents=True)
    (hub / "workflows" / "broken.workflow.yaml").write_text(
        "id: broken\nname: Broken\nagents:\n  - id: nonexistent\n    stage: s\n"
    )

    runner = GenericWorkflowRunner("broken", tmp_path / "ws", hub)
    # Mock mode does not resolve agents, so force the real path for this check.
    import generic_runner

    original = generic_runner.ENGINE
    generic_runner.ENGINE = "copilot"
    try:
        assert runner.run() is False
    finally:
        generic_runner.ENGINE = original

    with pytest.raises(WorkflowError):
        GenericWorkflowRunner("does-not-exist", tmp_path / "ws", hub)
