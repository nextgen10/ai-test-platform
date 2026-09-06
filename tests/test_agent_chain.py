import json
import os
import shutil
import tempfile
from pathlib import Path

import pytest

from runner.agent_chain import (
    _repair_strings,
    _strip_fences,
    agent_json,
    ensure_workspace_github,
    mock_design,
    mock_draft,
    mock_evaluation,
    mock_quality_report,
    mock_review,
    read_json,
    run_chain,
    run_quality_stage,
    sync_github_tokens,
    write_json,
)

SAMPLE_REQUIREMENT = """REQ-1042 Password Reset

A registered user should be able to reset their password using a registered email address.

- The system sends a reset link to the email address if it is registered.
- The reset link expires after 30 minutes.
- The new password must be at least 12 characters.
- After three failed reset attempts within an hour, further attempts are blocked.
"""


def test_repair_strings_and_strip_fences():
    raw_with_fences = """```json
{
  "key": "value \\d regex and \n raw newline"
}
```"""
    stripped = _strip_fences(raw_with_fences)
    assert not stripped.startswith("```")
    repaired, repairs = _repair_strings(stripped)
    data = json.loads(repaired)
    assert data["key"] == "value \\d regex and \n raw newline"


def test_mock_design():
    design = mock_design(SAMPLE_REQUIREMENT)
    assert design["requirement_reference"] == "REQ-1042"
    assert len(design["scenarios"]) >= 8
    assert "functional" in design["coverage_dimensions"]
    assert "negative" in design["coverage_dimensions"]
    assert "boundary" in design["coverage_dimensions"]


def test_mock_draft():
    design = mock_design(SAMPLE_REQUIREMENT)
    draft = mock_draft(design)
    assert draft["requirement_reference"] == "REQ-1042"
    assert len(draft["test_cases"]) >= 8
    for case in draft["test_cases"]:
        assert case["id"].startswith("TC-")
        assert len(case["steps"]) >= 2
        assert len(case["preconditions"]) >= 1
        assert len(case["expected_result"]) > 0


def test_mock_review_deduplication():
    draft = {
        "requirement_reference": "REQ-001",
        "assumptions": ["test"],
        "test_cases": [
            {
                "id": "TC-001",
                "title": "Duplicate Case",
                "category": "functional",
                "priority": "high",
                "preconditions": ["p1"],
                "steps": ["s1", "s2"],
                "expected_result": "r1",
                "requirement_reference": "REQ-001",
            },
            {
                "id": "TC-002",
                "title": "Duplicate Case",
                "category": "functional",
                "priority": "high",
                "preconditions": ["p1"],
                "steps": ["s1", "s2"],
                "expected_result": "r1",
                "requirement_reference": "REQ-001",
            },
            {
                "id": "TC-003",
                "title": "Unique Case",
                "category": "negative",
                "priority": "medium",
                "preconditions": ["p1"],
                "steps": ["s1", "s2"],
                "expected_result": "r2",
                "requirement_reference": "REQ-001",
            },
        ],
    }
    review, final = mock_review(draft)
    assert review["verdict"] == "pass"
    assert len(review["duplicates_removed"]) == 1
    assert len(final["test_cases"]) == 2
    assert final["test_cases"][0]["id"] == "TC-001"
    assert final["test_cases"][1]["id"] == "TC-002"


def test_mock_quality_report():
    report = mock_quality_report(SAMPLE_REQUIREMENT)
    assert report["requirement_reference"] == "REQ-1042"
    assert len(report["criteria"]) == 8
    assert 1.0 <= report["overall"]["score"] <= 4.0
    assert report["overall"]["rating"] in {"bad", "average", "good", "very_good"}


def test_mock_evaluation():
    design = mock_design(SAMPLE_REQUIREMENT)
    draft = mock_draft(design)
    _, final = mock_review(draft)
    eval_result = mock_evaluation(final, None)
    assert len(eval_result["scores"]) == 5
    assert 0.0 <= eval_result["overall"]["score"] <= 100.0


def test_sync_github_tokens(monkeypatch):
    monkeypatch.setenv("COPILOT_GITHUB_TOKEN", "test-token-123")
    monkeypatch.delenv("GH_TOKEN", raising=False)
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    sync_github_tokens()
    assert os.getenv("GH_TOKEN") == "test-token-123"
    assert os.getenv("GITHUB_TOKEN") == "test-token-123"


def test_ensure_workspace_github(tmp_path):
    app_dir = Path(__file__).resolve().parents[1] / "runner"
    workspace = tmp_path / "ws"
    workspace.mkdir()
    result = ensure_workspace_github(workspace, app_dir)
    assert result is not None
    assert (workspace / ".github").exists()
    assert (workspace / "schemas" / "test-case.schema.json").is_file()
    assert (workspace / "schemas" / "test-design.schema.json").is_file()


def test_full_chain_mock_execution(tmp_path):
    app_dir = Path(__file__).resolve().parents[1] / "runner"
    workspace = tmp_path / "ws_chain"
    (workspace / "input").mkdir(parents=True)
    (workspace / "intermediate").mkdir(parents=True)
    (workspace / "output").mkdir(parents=True)
    (workspace / "input" / "requirement.md").write_text(SAMPLE_REQUIREMENT, encoding="utf-8")

    # Quality stage
    q_result = run_quality_stage(workspace, app_dir, engine="mock")
    assert q_result.engine == "mock"
    assert (workspace / "output" / "quality_report.json").exists()

    # Generate stage
    g_result = run_chain(workspace, app_dir, engine="mock")
    assert g_result.engine == "mock"
    assert (workspace / "output" / "test_cases.json").exists()
    assert (workspace / "output" / "validation.json").exists()

    # Validate output document
    test_cases_doc = read_json(workspace / "output" / "test_cases.json")
    assert len(test_cases_doc["test_cases"]) >= 5


VALID_CASE = {
    "id": "TC-001",
    "title": "Reset link is sent to a registered email",
    "category": "functional",
    "priority": "high",
    "preconditions": ["An account exists for user@example.com"],
    "steps": [
        "Open the Forgot Password page",
        "Enter user@example.com and submit",
    ],
    "expected_result": "A reset email is delivered to user@example.com.",
    "requirement_reference": "REQ-042",
}


def test_agent_json_rewrites_when_draft_misses_the_schema(tmp_path, monkeypatch):
    """A structurally invalid first draft must not ship; the agent gets one fix."""
    schema = Path(__file__).resolve().parents[1] / "schemas" / "test-case.schema.json"
    artifact = tmp_path / "intermediate" / "draft_test_cases.json"
    artifact.parent.mkdir()
    calls = {"n": 0}

    def fake_run(agent, prompt, cwd):
        calls["n"] += 1
        if calls["n"] == 1:
            artifact.write_text('{"test_cases": []}', encoding="utf-8")
            return ""
        write_json(
            artifact,
            {
                "requirement_reference": "REQ-042",
                "assumptions": ["Generic confirmation to avoid enumeration."],
                "test_cases": [VALID_CASE],
            },
        )
        return ""

    monkeypatch.setattr("runner.agent_chain.run_copilot_agent", fake_run)
    draft = agent_json("test-generator", "write the suite", tmp_path, artifact, schema)
    assert calls["n"] == 2
    assert draft["test_cases"][0]["id"] == "TC-001"


def test_agent_json_accepts_a_schema_valid_first_draft(tmp_path, monkeypatch):
    schema = Path(__file__).resolve().parents[1] / "schemas" / "test-case.schema.json"
    artifact = tmp_path / "intermediate" / "draft_test_cases.json"
    artifact.parent.mkdir()
    calls = {"n": 0}

    def fake_run(agent, prompt, cwd):
        calls["n"] += 1
        write_json(
            artifact,
            {
                "requirement_reference": "REQ-042",
                "assumptions": ["Generic confirmation to avoid enumeration."],
                "test_cases": [VALID_CASE],
            },
        )
        return ""

    monkeypatch.setattr("runner.agent_chain.run_copilot_agent", fake_run)
    draft = agent_json("test-generator", "write the suite", tmp_path, artifact, schema)
    assert calls["n"] == 1
    assert len(draft["test_cases"]) == 1

