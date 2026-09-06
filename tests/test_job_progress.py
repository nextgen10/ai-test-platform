"""The orchestrator must transcribe generic-runner stage lines into events.

Without that, the Workflow Builder and the job page have nothing live to draw
and sit on stage 1 for the whole run.
"""
from pathlib import Path

from app.services.job_service import ProgressWatcher


def _watcher() -> tuple[ProgressWatcher, list]:
    seen: list[tuple[str, dict]] = []
    watcher = ProgressWatcher("job-fixture", Path("/unused"))
    watcher._emit = lambda event_type, message, metadata: seen.append((event_type, metadata))
    return watcher, seen


def test_generic_stage_boundaries_become_started_and_completed():
    watcher, seen = _watcher()
    watcher._consume("[12:00:00] Phase 1/4 workflow-architect")
    watcher._consume("[12:00:01] stage complete: architect (workflow-architect) in 1500ms")
    watcher._consume("[12:00:02] Phase 2/4 architecture-reviewer")

    assert [event for event, _ in seen] == [
        "phase.started",
        "phase.completed",
        "phase.started",
    ]
    assert seen[0][1]["phase"] == "workflow-architect"
    assert seen[1][1]["phase"] == "workflow-architect"
    assert seen[2][1]["phase"] == "architecture-reviewer"


def test_model_stdout_mentioning_phase_does_not_invent_a_stage():
    """Copilot output is dumped into the same log; prose must not look like a runner line."""
    watcher, seen = _watcher()
    watcher._consume("[12:00:00] Phase 1/4 workflow-architect")
    watcher._consume("    | Phase 1 leftover from the model talking about architecture")
    watcher._consume("Phase 2 of the design should introduce a reviewer")

    assert [meta["phase"] for _, meta in seen] == ["workflow-architect"]
    assert seen[0][0] == "phase.started"


def test_a_failed_generic_stage_closes_as_failed():
    watcher, seen = _watcher()
    watcher._consume("[12:00:00] Phase 1/4 workflow-architect")
    watcher._consume(
        "[12:05:00] stage failed: architect (workflow-architect) after 300000ms: "
        "Agent 'workflow-architect' exceeded 300s"
    )

    assert seen[-1][0] == "phase.failed"
    assert seen[-1][1]["phase"] == "workflow-architect"


def test_bespoke_evaluation_line_still_starts_the_evaluator():
    watcher, seen = _watcher()
    watcher._consume("[12:00:00] Evaluation  test-evaluator -> evaluation.json")
    assert seen[0] == (
        "phase.started",
        {"phase": "test-evaluator", "index": 1, "total": 1},
    )
