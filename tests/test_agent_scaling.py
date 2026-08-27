"""What makes a new agent cheap to add: contracts, graphs, and a test harness.

The machinery that made the bespoke chain reliable — JSON repair, self-
correction, schema validation — used to be reachable only from `agent_chain.py`.
These tests pin it to the shared path every agent now takes.
"""
import json

import pytest

import agent_io
from workflow_graph import (
    WorkflowGraphError,
    build_stages,
    has_explicit_dependencies,
    plan_waves,
    should_run,
)

# --------------------------------------------------------------- json repair


@pytest.mark.parametrize(
    "raw,expected",
    [
        # A regex the model under-escaped. \d is not a legal JSON escape, so the
        # backslash can only have been meant literally.
        (r'{"pattern": "\d+"}', {"pattern": r"\d+"}),
        # An over-doubled run aiming at one literal backslash: three backslashes
        # before an invalid escape collapse to two, which renders as one.
        (r'{"pattern": "\\\d"}', {"pattern": r"\d"}),
        # Legal escapes must survive untouched.
        (r'{"quote": "she said \"hi\"", "tab": "a\tb"}',
         {"quote": 'she said "hi"', "tab": "a\tb"}),
    ],
)
def test_repair_fixes_what_has_one_reading(raw, expected):
    repaired, _ = agent_io.repair_strings(raw)
    assert json.loads(repaired) == expected


def test_repair_cannot_disambiguate_a_legal_escape():
    """A Windows path is the case repair deliberately does not touch.

    In `C:\\Users\\test`, `\\U` is not a legal JSON escape so it is repaired to a
    literal backslash — but `\\t` *is* legal, and means a tab. Repair only fixes
    what has exactly one reading, and this has two. The agent is told to escape
    its backslashes; where it does not, the contract check catches the result.
    """
    repaired, _ = agent_io.repair_strings(r'{"path": "C:\Users\test"}')
    assert json.loads(repaired) == {"path": "C:\\Users\test"}


def test_repair_handles_a_raw_newline_inside_a_string():
    repaired, counts = agent_io.repair_strings('{"prose": "line one\nline two"}')
    assert json.loads(repaired) == {"prose": "line one\nline two"}
    assert counts["control"] == 1


def test_read_json_strips_fences_and_rewrites_the_file(tmp_path):
    path = tmp_path / "out.json"
    path.write_text('```json\n{"pattern": "\\d+"}\n```')

    assert agent_io.read_json(path) == {"pattern": r"\d+"}
    # The repaired form is written back, so the next reader gets clean JSON.
    assert json.loads(path.read_text()) == {"pattern": r"\d+"}


def test_read_json_gives_up_readably_on_genuine_nonsense(tmp_path):
    path = tmp_path / "bad.json"
    path.write_text('{"unterminated": ')
    with pytest.raises(RuntimeError, match="invalid JSON"):
        agent_io.read_json(path)


# ----------------------------------------------------------------- contracts

SCHEMA = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "required": ["title", "items"],
    "properties": {
        "title": {"type": "string", "minLength": 1},
        "items": {"type": "array", "minItems": 1},
    },
}


@pytest.fixture
def schema_file(tmp_path):
    path = tmp_path / "thing.schema.json"
    path.write_text(json.dumps(SCHEMA))
    return path


def test_contract_passes_valid_output(tmp_path, schema_file):
    artifact = tmp_path / "out.json"
    artifact.write_text(json.dumps({"title": "ok", "items": [1]}))

    result = agent_io.check_contract(artifact, schema_file)
    assert result.ok
    assert result.errors == []


def test_contract_reports_every_violation_readably(tmp_path, schema_file):
    artifact = tmp_path / "out.json"
    artifact.write_text(json.dumps({"items": []}))

    result = agent_io.check_contract(artifact, schema_file)
    assert not result.ok
    assert any("title" in e for e in result.errors)
    assert any("items" in e for e in result.errors)
    # The feedback is what gets handed back to the model, so it has to read.
    assert "did not match its contract" in result.as_feedback()


def test_a_missing_artifact_fails_its_contract(tmp_path, schema_file):
    result = agent_io.check_contract(tmp_path / "never-written.json", schema_file)
    assert not result.ok
    assert "not written" in result.errors[0]


def test_no_declared_schema_is_not_a_failure(tmp_path):
    """Plenty of agents legitimately produce prose."""
    artifact = tmp_path / "notes.md"
    artifact.write_text("# Some prose")
    assert agent_io.check_contract(artifact, None).ok


def test_an_agent_gets_one_chance_to_fix_its_output(tmp_path, schema_file):
    """The self-correction loop: bad output, specific feedback, corrected output."""
    artifact = tmp_path / "out.json"
    calls: list[str] = []

    def invoke(prompt: str) -> None:
        calls.append(prompt)
        if len(calls) == 1:
            artifact.write_text(json.dumps({"items": []}))  # violates the schema
        else:
            artifact.write_text(json.dumps({"title": "fixed", "items": [1]}))

    result = agent_io.run_with_contract(
        agent_id="fixer",
        prompt="do the thing",
        artifact=artifact,
        schema_path=schema_file,
        invoke=invoke,
    )

    assert result.ok
    assert len(calls) == 2
    # The retry told the agent what was actually wrong, not just "try again".
    assert "CORRECTION REQUIRED" in calls[1]
    assert "title" in calls[1]


def test_correction_gives_up_after_its_budget(tmp_path, schema_file):
    artifact = tmp_path / "out.json"
    calls: list[str] = []

    def invoke(prompt: str) -> None:
        calls.append(prompt)
        artifact.write_text(json.dumps({"items": []}))  # never improves

    result = agent_io.run_with_contract(
        agent_id="stubborn",
        prompt="do the thing",
        artifact=artifact,
        schema_path=schema_file,
        invoke=invoke,
    )

    assert not result.ok
    assert len(calls) == agent_io.MAX_CONTRACT_ATTEMPTS


# ------------------------------------------------------------ workflow graph


def test_a_workflow_without_dependencies_stays_sequential():
    """Every definition written before dependencies existed must still work."""
    stages = build_stages(
        {"agents": [{"id": "a", "stage": "one"}, {"id": "b", "stage": "two"}]}
    )
    assert not has_explicit_dependencies(stages)
    assert [[s.stage for s in w] for w in plan_waves(stages)] == [["one"], ["two"]]


def test_independent_stages_share_a_wave():
    stages = build_stages(
        {
            "agents": [
                {"id": "x", "stage": "extract"},
                {"id": "s", "stage": "security", "depends_on": ["extract"]},
                {"id": "p", "stage": "perf", "depends_on": ["extract"]},
                {"id": "m", "stage": "merge", "depends_on": ["security", "perf"]},
            ]
        }
    )
    waves = [sorted(s.stage for s in w) for w in plan_waves(stages)]
    assert waves == [["extract"], ["perf", "security"], ["merge"]]


@pytest.mark.parametrize(
    "definition,message",
    [
        ({"agents": [{"id": "a", "stage": "x", "depends_on": ["ghost"]}]}, "not"),
        (
            {
                "agents": [
                    {"id": "a", "stage": "x", "depends_on": ["y"]},
                    {"id": "b", "stage": "y", "depends_on": ["x"]},
                ]
            },
            "cycle",
        ),
        ({"agents": [{"id": "a", "stage": "dup"}, {"id": "b", "stage": "dup"}]}, "unique"),
        ({"agents": [{"id": "a", "stage": "x", "when": "perhaps"}]}, "condition"),
        ({"agents": []}, "no agents"),
    ],
)
def test_unrunnable_graphs_are_rejected_before_anything_runs(definition, message):
    with pytest.raises(WorkflowGraphError, match=message):
        build_stages(definition)


def test_conditions_decide_whether_a_stage_runs():
    stages = {
        s.stage: s
        for s in build_stages(
            {
                "agents": [
                    {"id": "a", "stage": "one"},
                    {"id": "b", "stage": "two"},
                    {"id": "m", "stage": "any", "depends_on": ["one", "two"], "when": "any_succeeded"},
                    {"id": "s", "stage": "all", "depends_on": ["one", "two"]},
                    {"id": "c", "stage": "always", "depends_on": ["one"], "when": "always"},
                ]
            }
        )
    }

    mixed = {"one": "completed", "two": "failed"}
    assert should_run(stages["any"], mixed)[0] is True
    assert should_run(stages["all"], mixed)[0] is False
    assert should_run(stages["always"], {"one": "failed"})[0] is True

    # A skip explains itself, so the run record has no unexplained holes.
    runs, reason = should_run(stages["all"], mixed)
    assert not runs and "two" in reason


# ------------------------------------------------------------- test harness


def test_an_agent_can_be_tried_without_a_job(operator):
    """The onboarding loop: does this agent produce output matching its contract?"""
    response = operator.post(
        "/api/v1/agents/test-designer/test",
        json={"input": "REQ-1 A user can export a report to CSV.", "engine": "mock"},
    )
    assert response.status_code == 200
    body = response.json()

    assert body["agent_id"] == "test-designer"
    assert body["ok"] is True
    assert body["contract_ok"] is True
    assert body["output_artifact"] == "intermediate/test_design.json"
    # It reports which contract it checked, not just that it passed.
    assert body["contract_checked"].endswith(".json")
    assert json.loads(body["output"])["scenarios"]


def test_testing_an_unknown_agent_is_a_clear_error(operator):
    response = operator.post(
        "/api/v1/agents/no-such-agent/test", json={"input": "hello", "engine": "mock"}
    )
    assert response.status_code == 400
    assert "not registered" in response.json()["detail"]


def test_an_agent_has_a_fingerprint(operator, author):
    """A result must be traceable to the definition that produced it."""
    first = operator.get("/api/v1/agents/test-designer/fingerprint").json()["fingerprint"]
    assert len(first) == 12

    original = author.get("/api/v1/hub/agents/test-designer").json()["content"]
    try:
        author.put(
            "/api/v1/hub/agents/test-designer",
            json={"id": "test-designer", "content": original + "\n<!-- edited -->\n"},
        )
        second = operator.get("/api/v1/agents/test-designer/fingerprint").json()["fingerprint"]
        assert second != first, "editing an agent must change its fingerprint"
    finally:
        author.put(
            "/api/v1/hub/agents/test-designer",
            json={"id": "test-designer", "content": original},
        )
