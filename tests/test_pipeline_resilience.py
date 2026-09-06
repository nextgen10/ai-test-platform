"""What has to hold for *every* agent, not just the four in the happy path.

The chain's own tests cover the shape of what each agent produces. These cover
the ways a run goes wrong around that: an agent that writes nothing, an agent
that leaves the previous run's file in place, a stage whose failure should not
be allowed to discard work that already passed the quality gate, and a failure
that has to be reportable afterwards.

Each test here corresponds to a way a real run has broken or could break
silently — which is worse, because a silently wrong suite gets shipped.
"""
import json
import subprocess
import sys
from pathlib import Path

import pytest

from runner import agent_chain, agent_io, copilot_cli

ROOT = Path(__file__).resolve().parents[1]
RUNNER = ROOT / "runner"
SCHEMAS = ROOT / "schemas"

REQUIREMENT = """REQ-2200 Card freeze

A cardholder can freeze a debit card from the mobile app.

- Freezing takes effect immediately and blocks new authorisations.
- A frozen card can be unfrozen by the same cardholder.
- Freezing does not cancel standing instructions already in flight.
"""

VALID_SUITE = {
    "requirement_reference": "REQ-2200",
    "assumptions": ["The cardholder is authenticated in the mobile app."],
    "test_cases": [
        {
            "id": "TC-001",
            "title": "Freezing a card blocks a new authorisation",
            "category": "functional",
            "priority": "high",
            "preconditions": ["The cardholder holds an active debit card"],
            "steps": ["Open the card in the app", "Select Freeze card"],
            "expected_result": "A new authorisation on the card is declined.",
            "requirement_reference": "REQ-2200",
        }
    ],
}


@pytest.fixture
def workspace(tmp_path):
    ws = tmp_path / "ws"
    for sub in ("input", "intermediate", "output"):
        (ws / sub).mkdir(parents=True)
    (ws / "input" / "requirement.md").write_text(REQUIREMENT, encoding="utf-8")
    return ws


# ------------------------------------------------- the artifact was not written


def test_an_agent_that_leaves_the_previous_artifact_untouched_fails_its_contract(
    tmp_path,
):
    """The gap-closer amends output/test_cases.json in place.

    That file already exists and already passed the gate, so an agent that
    silently does nothing leaves behind a document that validates perfectly.
    Without noticing the file was never touched, the run reports a successful
    gap closure that closed nothing.
    """
    artifact = tmp_path / "test_cases.json"
    agent_io.write_json(artifact, VALID_SUITE)

    calls = {"n": 0}

    def invoke(_prompt: str) -> None:
        calls["n"] += 1  # the agent "runs" but writes nothing

    contract = agent_io.run_with_contract(
        agent_id="gap-closer",
        prompt="amend the suite",
        artifact=artifact,
        schema_path=SCHEMAS / "test-case.schema.json",
        invoke=invoke,
        attempts=2,
    )

    assert not contract.ok, "an untouched artifact must not pass as fresh output"
    assert calls["n"] == 2, "and the agent should have been asked again"


def test_a_declared_artifact_that_was_never_written_fails_even_without_a_schema():
    """Agents that produce prose declare no schema — ocr-extractor, agent-writer.

    They still owe the workflow the file they declare, because the next stage
    reads it. A missing artifact was previously reported as a satisfied
    contract, so the stage passed and the next one failed on a missing input.
    """
    contract = agent_io.check_contract(Path("/nonexistent/extracted.md"), None)
    assert not contract.ok
    assert "not written" in contract.as_feedback()


# ------------------------------------------------------ one stage, one blast radius


def test_a_failed_evaluation_does_not_discard_a_suite_that_passed_the_gate(
    workspace, monkeypatch
):
    """The evaluator scores the suite; it does not produce it.

    The suite has been through the deterministic gate by the time evaluation
    runs, and the backend already treats a missing evaluation.json as a
    complete job with no score. The runner failing the whole run over it threw
    away a valid deliverable.
    """
    def boom(*_args, **_kwargs):
        raise RuntimeError("evaluation did not match its contract")

    monkeypatch.setattr(agent_chain, "run_evaluation", boom)
    monkeypatch.setattr(
        sys, "argv",
        ["agent_chain", "--workspace", str(workspace), "--app-dir", str(RUNNER),
         "--engine", "mock"],
    )

    assert agent_chain.main() == 0

    metadata = json.loads(
        (workspace / "output" / "run_metadata.json").read_text(encoding="utf-8")
    )
    assert metadata["status"] == "completed"
    assert (workspace / "output" / "test_cases.json").is_file()

    phases = {p["name"]: p["status"] for p in metadata["phases"]}
    assert phases["test-reviewer"] == "completed"
    assert phases["test-evaluator"] == "failed", "the failure is reported, not hidden"


def test_a_failed_run_still_reports_the_phases_it_completed(workspace, monkeypatch):
    """A run that dies in phase 3 has to be able to say phases 1 and 2 worked.

    The failure path wrote status and error only, so the UI's timeline was
    empty for exactly the runs someone needed to debug.
    """
    monkeypatch.setattr(
        agent_chain, "validate_document", lambda *a, **k: (False, "gate says no")
    )
    monkeypatch.setattr(
        sys, "argv",
        ["agent_chain", "--workspace", str(workspace), "--app-dir", str(RUNNER),
         "--engine", "mock"],
    )

    assert agent_chain.main() == 1

    metadata = json.loads(
        (workspace / "output" / "run_metadata.json").read_text(encoding="utf-8")
    )
    assert metadata["status"] == "failed"
    phases = {p["name"]: p["status"] for p in metadata.get("phases", [])}
    assert phases.get("test-designer") == "completed"
    assert phases.get("test-generator") == "completed"
    assert phases.get("test-reviewer") == "failed"


# --------------------------------------------------------- every agent, not four


def _declared_schemas() -> list[tuple[str, str]]:
    """(agent id, declared output_schema) for every agent in the hub."""
    declared = []
    for path in sorted((ROOT / "agent-hub" / "agents").glob("*.agent.md")):
        if path.name.startswith("_"):
            continue
        for line in path.read_text(encoding="utf-8").splitlines()[:30]:
            if line.startswith("output_schema:"):
                value = line.split(":", 1)[1].strip()
                if value and value != "null":
                    declared.append((path.name, value))
                break
    return declared


@pytest.mark.parametrize("agent_file,declared", _declared_schemas())
def test_every_declared_output_schema_resolves_to_a_real_file(agent_file, declared):
    """A typo here is invisible until the run: a schema that cannot be found is
    a contract that is never enforced and never inlined into the prompt, so the
    agent guesses the shape and the stage fails on something unrelated."""
    assert (ROOT / declared).is_file(), f"{agent_file} declares a missing {declared}"


def test_schemas_reach_the_workspace_even_when_the_hub_cannot_be_found(
    tmp_path, monkeypatch
):
    """Staging agents and staging contracts are independent failures.

    They were sequential: no hub meant an early return, which meant no schemas
    either, which meant every agent in that run guessing at its output shape.
    """
    monkeypatch.setattr(agent_chain, "_project_hub_dir", lambda _app_dir: None)
    ws = tmp_path / "ws"
    ws.mkdir()

    agent_chain.ensure_workspace_github(ws, RUNNER)

    assert (ws / "schemas" / "test-case.schema.json").is_file()


# ------------------------------------------------- the whole chain, badly behaved


def _sloppy_suite(count: int, *, camel: bool) -> dict:
    """A suite written the way models actually write them.

    `TC-1` instead of `TC-003`, `P1` instead of `high`, steps as one newline
    string, an extra root key the schema closed — each has exactly one sensible
    reading, and none of them should cost a model round to fix.
    """
    categories = ["functional", "negative", "boundary", "validation", "data"]
    cases = []
    for i in range(1, count + 1):
        cases.append(
            {
                "id": f"TC-{i}",
                "title": f"Card freeze behaviour case {i} is handled",
                "category": categories[(i - 1) % len(categories)].upper(),
                "priority": "P1" if i % 2 else "P2",
                "preconditions": ["The cardholder holds an active debit card"],
                "steps": f"Open the card in the app\nSelect Freeze card {i}",
                "expected_result": f"Authorisation {i} is declined for the frozen card.",
                "requirement_reference": "REQ-2200",
            }
        )
    key = "testCases" if camel else "test_cases"
    return {
        "requirementReference" if camel else "requirement_reference": "REQ-2200",
        "assumptions": ["The cardholder is authenticated."],
        key: cases,
        "notes": "extra key the schema does not allow at the root",
    }


def test_the_chain_survives_agents_that_get_the_shape_wrong(workspace, monkeypatch):
    """An end-to-end run where every agent misbehaves in a way models really do.

    The designer wraps its answer in a Markdown fence and an envelope, the
    generator explains itself instead of writing a file on its first attempt and
    then uses camelCase keys and `P1` priorities, and the evaluator writes
    `Very Good` for its rating. None of that is a disagreement about the answer,
    so the run must finish with a valid, gated suite rather than fail.
    """
    calls: dict[str, int] = {}

    def fake_agent(agent: str, prompt: str, cwd) -> str:
        calls[agent] = calls.get(agent, 0) + 1
        n = calls[agent]

        if agent == "test-designer":
            # Fenced, enveloped, and one scenario category in the wrong case.
            design = {
                "result": {
                    "requirement_reference": "REQ-2200",
                    "summary": "Cardholders can freeze a debit card.",
                    "scenarios": [
                        {"description": "Freeze blocks a new authorisation",
                         "category": "Functional", "priority": "P1"},
                        {"description": "Unfreeze restores authorisations",
                         "category": "functional", "priority": "p2"},
                    ],
                }
            }
            (workspace / "intermediate" / "test_design.json").write_text(
                "```json\n" + json.dumps(design) + "\n```", encoding="utf-8"
            )
            return "wrote the design"

        if agent == "test-generator":
            if n == 1:
                # The classic: the agent describes the file instead of writing it.
                return "I have prepared 6 test cases covering the requirement."
            agent_io.write_json(
                workspace / "intermediate" / "draft_test_cases.json",
                _sloppy_suite(6, camel=True),
            )
            return "wrote the draft"

        if agent == "test-reviewer":
            agent_io.write_json(
                workspace / "intermediate" / "review.json", {"verdict": "revised"}
            )
            agent_io.write_json(
                workspace / "output" / "test_cases.json", _sloppy_suite(6, camel=False)
            )
            return "wrote the final suite"

        if agent == "test-evaluator":
            agent_io.write_json(
                workspace / "output" / "evaluation.json",
                {
                    "requirement_reference": "REQ-2200",
                    "scores": [
                        {"id": dimension, "score": "82",
                         "rationale": "Sufficient for the stated requirement."}
                        for dimension in ("coverage", "completeness", "traceability",
                                          "correctness", "uniqueness")
                    ],
                    "overall": {"score": 82, "rating": "Very Good"},
                    "gaps": [],
                    "recommendations": [],
                },
            )
            return "wrote the evaluation"

        raise AssertionError(f"unexpected agent {agent}")

    monkeypatch.setattr(agent_chain, "run_copilot_agent", fake_agent)
    agent_chain.ensure_workspace_schemas(workspace, RUNNER)

    result = agent_chain.run_chain(workspace, RUNNER, engine="copilot")
    error = agent_chain.evaluate_best_effort(workspace, RUNNER, "copilot", result)

    assert error is None, f"evaluation should have been salvageable: {error}"
    assert [p.status for p in result.phases] == ["completed"] * 4
    assert calls["test-generator"] == 2, "the missing file cost exactly one retry"
    assert calls["test-reviewer"] == 1, "and the reviewer needed no correction"

    suite = agent_io.read_json(workspace / "output" / "test_cases.json")
    assert suite["test_cases"][0]["id"] == "TC-001", "identifiers renumbered"
    assert suite["test_cases"][0]["priority"] == "high", "P1 read as high"
    assert suite["test_cases"][0]["category"] == "functional", "case normalised"
    assert len(suite["test_cases"][0]["steps"]) == 2, "one string split into steps"
    assert "notes" not in suite, "the root key the schema forbids was dropped"

    validation = json.loads(
        (workspace / "output" / "validation.json").read_text(encoding="utf-8")
    )
    assert validation["valid"], validation["errors"]

    evaluation = agent_io.read_json(workspace / "output" / "evaluation.json")
    assert evaluation["overall"]["rating"] == "very_good"


def test_a_reprocess_whose_agent_does_nothing_is_not_reported_as_a_closure(
    workspace, monkeypatch
):
    """The reprocess path amends a suite that already exists and already passes.

    So an agent that writes nothing leaves a perfectly valid file behind, the
    gate passes, and the run reports "12 -> 12 cases" as a successful gap
    closure. Nothing anywhere says the gaps are still open.
    """
    suite = dict(VALID_SUITE)
    suite["test_cases"] = [
        {**VALID_SUITE["test_cases"][0], "id": f"TC-00{i}", "title": f"Freeze case {i} holds"}
        for i in range(1, 6)
    ]
    agent_io.write_json(workspace / "output" / "test_cases.json", suite)
    agent_io.write_json(
        workspace / "output" / "evaluation.json",
        {
            "scores": [
                {"id": d, "score": 70} for d in
                ("coverage", "completeness", "traceability", "correctness", "uniqueness")
            ],
            "overall": {"score": 70, "rating": "good"},
            "gaps": [{"detail": "No case covers freezing a card already frozen."}],
            "recommendations": [],
        },
    )

    monkeypatch.setattr(
        agent_chain, "run_copilot_agent",
        lambda agent, prompt, cwd: "I reviewed the suite and it is already complete.",
    )
    agent_chain.ensure_workspace_schemas(workspace, RUNNER)

    with pytest.raises(RuntimeError, match="test_cases.json"):
        agent_chain.run_gap_closing(workspace, RUNNER, engine="copilot")

    phases = {p.name: p.status for p in agent_chain.ACTIVE_RESULT.phases}
    assert phases["gap-closer"] == "failed"
    # And the suite the user already had is still intact.
    assert len(agent_io.read_json(workspace / "output" / "test_cases.json")["test_cases"]) == 5


def _gated_suite() -> dict:
    """A previous suite that already passed the quality gate."""
    categories = ["functional", "negative", "boundary", "validation", "data"]
    cases = []
    for i, category in enumerate(categories, start=1):
        cases.append(
            {
                **VALID_SUITE["test_cases"][0],
                "id": f"TC-{i:03d}",
                "title": f"Freeze case {i} for {category} holds",
                "category": category,
            }
        )
    return {**VALID_SUITE, "test_cases": cases}


def _reprocess_inputs(workspace, extra_eval=None):
    agent_io.write_json(workspace / "output" / "test_cases.json", _gated_suite())
    evaluation = {
        "scores": [
            {"id": d, "score": 70} for d in
            ("coverage", "completeness", "traceability", "correctness", "uniqueness")
        ],
        "overall": {"score": 70, "rating": "good"},
        "gaps": [{"detail": "No case covers freezing a card already frozen."}],
        "recommendations": [],
    }
    if extra_eval:
        evaluation.update(extra_eval)
    agent_io.write_json(workspace / "output" / "evaluation.json", evaluation)


def test_reprocess_survives_a_gap_closer_that_gets_the_shape_wrong(workspace, monkeypatch):
    """The same sloppy-output path the generate chain already survives.

    Reprocess used to skip that treatment: the closer wrote camelCase / P1 /
    TC-1 into a file that already existed, the gate read a different schema
    than the prompt, and the run failed even though every miss had one reading.
    """
    _reprocess_inputs(workspace)
    calls: dict[str, int] = {}

    def fake_agent(agent: str, prompt: str, cwd) -> str:
        calls[agent] = calls.get(agent, 0) + 1
        if agent == "gap-closer":
            (workspace / "output" / "test_cases.json").write_text(
                "```json\n" + json.dumps(_sloppy_suite(6, camel=True)) + "\n```",
                encoding="utf-8",
            )
            agent_io.write_json(
                workspace / "intermediate" / "gap_closure.json",
                {
                    "gaps_addressed": [{"area": "negative", "detail": "already-frozen card",
                                        "resolution": "Added a case.", "case_ids": ["TC-006"]}],
                    "gaps_not_addressed": [],
                    "cases_added": ["TC-006"],
                    "cases_modified": [],
                    "cases_removed": [],
                    "cases_preserved": 5,
                },
            )
            return "amended the suite"
        if agent == "test-evaluator":
            agent_io.write_json(
                workspace / "output" / "evaluation.json",
                {
                    "requirement_reference": "REQ-2200",
                    "scores": [
                        {"id": dimension, "score": "82",
                         "rationale": "Sufficient for the stated requirement."}
                        for dimension in ("coverage", "completeness", "traceability",
                                          "correctness", "uniqueness")
                    ],
                    "overall": {"score": 82, "rating": "Very Good"},
                    "gaps": [],
                    "recommendations": [],
                },
            )
            return "wrote the evaluation"
        raise AssertionError(f"unexpected agent {agent}")

    monkeypatch.setattr(agent_chain, "run_copilot_agent", fake_agent)

    result = agent_chain.run_gap_closing(workspace, RUNNER, engine="copilot")
    error = agent_chain.evaluate_best_effort(workspace, RUNNER, "copilot", result)

    assert error is None, error
    assert [p.status for p in result.phases] == ["completed", "completed"]
    assert calls["gap-closer"] == 1

    suite = agent_io.read_json(workspace / "output" / "test_cases.json")
    assert suite["test_cases"][0]["id"] == "TC-001"
    assert suite["test_cases"][0]["priority"] == "high"
    assert suite["test_cases"][0]["category"] == "functional"
    assert len(suite["test_cases"][0]["steps"]) == 2
    assert "notes" not in suite
    assert "testCases" not in suite

    validation = json.loads(
        (workspace / "output" / "validation.json").read_text(encoding="utf-8")
    )
    assert validation["valid"], validation["errors"]

    evaluation = agent_io.read_json(workspace / "output" / "evaluation.json")
    assert evaluation["overall"]["rating"] == "very_good"


def test_reprocess_gate_enforces_the_same_schema_the_gap_closer_was_shown(
    workspace, tmp_path, monkeypatch
):
    """SCHEMA_PATH must move the gate, not just the prompt.

    A closer that satisfies the override would fail the stock contract on the
    extra key, which is how this used to break: prompt and gate were two files.
    """
    override = tmp_path / "reprocess.schema.json"
    stock = json.loads((SCHEMAS / "test-case.schema.json").read_text(encoding="utf-8"))
    stock["required"] = [*stock["required"], "sign_off"]
    stock["properties"]["sign_off"] = {"type": "string", "minLength": 1}
    override.write_text(json.dumps(stock), encoding="utf-8")
    monkeypatch.setenv("SCHEMA_PATH", str(override))
    _reprocess_inputs(workspace)

    def fake_agent(agent: str, prompt: str, cwd) -> str:
        assert "sign_off" in prompt, "the closer was not shown the override"
        amended = _sloppy_suite(6, camel=True)
        amended["sign_off"] = "reviewed"
        agent_io.write_json(workspace / "output" / "test_cases.json", amended)
        return "wrote"

    monkeypatch.setattr(agent_chain, "run_copilot_agent", fake_agent)

    result = agent_chain.run_gap_closing(workspace, RUNNER, engine="copilot")
    assert result.phases[0].status == "completed"
    suite = agent_io.read_json(workspace / "output" / "test_cases.json")
    assert suite["sign_off"] == "reviewed"
    assert suite["test_cases"][0]["id"] == "TC-001"


def test_a_gap_closer_that_writes_unusable_json_restores_the_previous_suite(
    workspace, monkeypatch
):
    _reprocess_inputs(workspace)

    def fake_agent(agent: str, prompt: str, cwd) -> str:
        (workspace / "output" / "test_cases.json").write_text(
            "{this is not json", encoding="utf-8"
        )
        return "wrote garbage"

    monkeypatch.setattr(agent_chain, "run_copilot_agent", fake_agent)
    agent_chain.ensure_workspace_schemas(workspace, RUNNER)

    with pytest.raises(RuntimeError, match="test_cases.json"):
        agent_chain.run_gap_closing(workspace, RUNNER, engine="copilot")

    restored = agent_io.read_json(workspace / "output" / "test_cases.json")
    assert restored == _gated_suite()


def test_a_generator_that_never_writes_the_file_fails_the_phase_not_the_next_one(
    workspace, monkeypatch
):
    """The failure has to name the agent that caused it.

    An unwritten draft used to reach the reviewer, which then failed on a
    missing input — so the run blamed the wrong agent.
    """
    def fake_agent(agent: str, prompt: str, cwd) -> str:
        if agent == "test-designer":
            agent_io.write_json(
                workspace / "intermediate" / "test_design.json",
                {"scenarios": [{"description": "Freeze blocks a payment",
                                "category": "functional"}]},
            )
            return "ok"
        return "I would rather explain than write a file."

    monkeypatch.setattr(agent_chain, "run_copilot_agent", fake_agent)
    agent_chain.ensure_workspace_schemas(workspace, RUNNER)

    with pytest.raises(RuntimeError, match="draft_test_cases.json"):
        agent_chain.run_chain(workspace, RUNNER, engine="copilot")

    phases = {p.name: p.status for p in agent_chain.ACTIVE_RESULT.phases}
    assert phases["test-designer"] == "completed"
    assert phases["test-generator"] == "failed"
    assert "test-reviewer" not in phases


# ------------------------------------------------------------------- the model


def test_no_model_fallback_is_reported_when_no_model_was_requested(monkeypatch):
    """`COPILOT_MODEL=default` asks for the account default.

    Getting it is not a fallback, and reporting one puts a "your model was not
    permitted" warning on the run record of a job that never named a model.
    """
    monkeypatch.setattr(agent_chain, "COPILOT_MODEL", "default")
    monkeypatch.setattr(agent_chain, "MODEL_FALLBACK_TRIGGERED", False)
    # Patched via agent_chain's own reference, so this holds whether or not the
    # module is reachable under a second name.
    monkeypatch.setattr(
        agent_chain.copilot_cli, "invoke",
        lambda **_kw: agent_chain.copilot_cli.CliResult("ok", "", 1, None),
    )

    agent_chain.run_copilot_agent("test-designer", "prompt", Path("/tmp"))

    assert agent_chain.MODEL_FALLBACK_TRIGGERED is False


def test_a_model_rejected_on_the_final_attempt_still_falls_back(monkeypatch, tmp_path):
    """Dropping the model is not a retry — it is a different, cheaper request.

    Counting it as one meant a run that had already spent its attempts on
    transient failures died reporting "model not available" without ever having
    tried the account default.
    """
    calls = []

    def fake_run(cmd, **_kwargs):
        calls.append(cmd)
        if len(calls) < copilot_cli.MAX_CLI_ATTEMPTS:
            return subprocess.CompletedProcess([], 1, "", "503 Service Unavailable")
        if "--model" in cmd:
            return subprocess.CompletedProcess(
                [], 1, "", "The requested model from --model flag is not available"
            )
        return subprocess.CompletedProcess([], 0, "done", "")

    monkeypatch.setattr(subprocess, "run", fake_run)
    monkeypatch.setattr(copilot_cli, "_backoff", lambda _attempt: None)
    copilot_cli.reset_model_fallback()

    result = copilot_cli.invoke(
        agent_id="test-designer", prompt="p", workspace=tmp_path, model="gpt-4o"
    )

    assert result.stdout == "done"
    assert "--model" not in calls[-1]
    copilot_cli.reset_model_fallback()


# --------------------------------------------- one contract, one scale, one model


def test_the_schema_path_override_is_what_the_agent_is_actually_shown(
    workspace, tmp_path, monkeypatch
):
    """The gate and the prompt must enforce the same document.

    ``$SCHEMA_PATH`` repoints the quality gate via ``resolve_schema_path``,
    while the prompt and the contract check read the copy staged into the
    workspace. Those used to be two different schemas: the reviewer was shown
    the stock contract, passed it, and was then failed by a gate enforcing one
    it had never seen — with no way to learn what it had missed.
    """
    override = tmp_path / "house-style.schema.json"
    override.write_text(
        json.dumps(
            {
                "type": "object",
                "required": ["requirement_reference", "assumptions", "test_cases", "sign_off"],
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setenv("SCHEMA_PATH", str(override))

    agent_chain.ensure_workspace_schemas(workspace, RUNNER)

    gate = agent_chain.resolve_schema_path(RUNNER)
    shown = agent_chain.workspace_schema(workspace, RUNNER, "test-case.schema.json")

    assert json.loads(gate.read_text(encoding="utf-8")) == json.loads(
        shown.read_text(encoding="utf-8")
    ), "the agent is prompted with a different contract than the gate enforces"


def test_staging_without_an_override_leaves_the_stock_contract_alone(workspace, monkeypatch):
    monkeypatch.delenv("SCHEMA_PATH", raising=False)

    agent_chain.ensure_workspace_schemas(workspace, RUNNER)

    staged = workspace / "schemas" / "test-case.schema.json"
    assert json.loads(staged.read_text(encoding="utf-8")) == json.loads(
        (SCHEMAS / "test-case.schema.json").read_text(encoding="utf-8")
    )


@pytest.mark.parametrize(
    "dimension_score, expected_pct",
    [
        (3, 3),      # 3 out of 100 is the worst the evaluator can say...
        (100, 100),  # ...and must never read as 3.0/4, a good one.
        (88, 88),    # not snapped to 4.0/100% the way the buckets did
        (70, 70),
    ],
)
def test_an_evaluation_score_is_read_on_the_scale_its_schema_declares(
    workspace, monkeypatch, dimension_score, expected_pct
):
    """evaluation.schema.json declares 0-100, so 0-100 is what it means."""
    (workspace / "output" / "test_cases.json").write_text(
        json.dumps(VALID_SUITE), encoding="utf-8"
    )
    evaluation = {
        "scores": [
            {"id": i, "name": i, "score": dimension_score, "rationale": "A stated reason."}
            for i in ("coverage", "completeness", "traceability", "correctness", "uniqueness")
        ],
        "overall": {"score": dimension_score, "rating": "good", "verdict": "A verdict."},
        "gaps": [],
        "recommendations": [],
    }
    (workspace / "output" / "evaluation.json").write_text(
        json.dumps(evaluation), encoding="utf-8"
    )

    monkeypatch.setattr(agent_chain, "validate_document", lambda *a, **k: (True, ""))
    monkeypatch.setattr(agent_chain, "agent_json", lambda *a, **k: evaluation)

    result = agent_chain.ChainResult(engine="copilot")
    agent_chain.run_evaluation(workspace, RUNNER, "copilot", result)

    detail = next(p.detail for p in result.phases if p.name == "test-evaluator")
    assert f"({expected_pct}%)" in detail, detail


def test_the_run_record_names_the_model_that_actually_ran(workspace, monkeypatch):
    """An alias is a different model, and the record exists to be reproducible."""
    (workspace / "input" / ".copilot_model").write_text("claude-opus-4.5", encoding="utf-8")
    monkeypatch.setattr(
        sys, "argv",
        ["agent_chain", "--workspace", str(workspace), "--app-dir", str(RUNNER),
         "--engine", "mock"],
    )

    assert agent_chain.main() == 0

    metadata = json.loads(
        (workspace / "output" / "run_metadata.json").read_text(encoding="utf-8")
    )
    assert metadata["copilot_model"] == "claude-opus-4.5", "what was asked for"
    assert metadata["copilot_model_effective"] == copilot_cli.effective_model(
        "claude-opus-4.5"
    ), "what the CLI was actually given"
