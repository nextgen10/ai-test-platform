"""The invocation half of "the agent does not fail".

Two things are being pinned here. First, that a declared tool grant turns into
permission patterns the CLI actually understands — the bug this module was
written for was an agent being denied the ability to write the artifact it was
being judged on. Second, that a failure which a retry can fix gets one.
"""
import subprocess
from pathlib import Path

import pytest

from runner import copilot_cli

# From copilot_cli, not agent_io: see the re-export note there. Importing it by
# the other path yields a different class object and the `raises` never matches.
FatalAgentError = copilot_cli.FatalAgentError


@pytest.fixture(autouse=True)
def _forget_model_rejections():
    copilot_cli.reset_model_fallback()
    yield
    copilot_cli.reset_model_fallback()


# ---------------------------------------------------------------- tool grants


def test_an_agent_that_declares_write_gets_a_pattern_the_cli_understands():
    assert copilot_cli.allow_tool_flags(["read", "write"], writes_artifact=True) == [
        "--allow-tool=write"
    ]


def test_read_is_not_passed_through_because_reading_is_not_gated():
    """`--allow-tool read` is not a permission pattern; it was silently ignored."""
    assert "--allow-tool=read" not in copilot_cli.allow_tool_flags(
        ["read"], writes_artifact=False
    )


def test_an_agent_owing_an_artifact_can_write_even_if_its_tools_line_is_missing():
    """The regression this module exists for: no `tools:` meant no write grant,
    so the agent could not produce the output its contract demanded."""
    assert copilot_cli.allow_tool_flags(None, writes_artifact=True) == [
        "--allow-tool=write"
    ]
    assert copilot_cli.allow_tool_flags([], writes_artifact=True) == [
        "--allow-tool=write"
    ]


def test_shell_and_fetch_are_never_granted_from_a_definition():
    """Requirement text is untrusted; a definition must not be able to widen this."""
    flags = copilot_cli.allow_tool_flags(
        ["shell", "fetch", "write"], writes_artifact=False
    )
    assert flags == ["--allow-tool=write"]


def test_the_grant_uses_the_equals_form():
    """A space-separated value can be parsed as a positional by CLI 1.0.79+."""
    for flag in copilot_cli.allow_tool_flags(["write"], writes_artifact=True):
        assert flag.startswith("--allow-tool=")


# ------------------------------------------------------------------ the model


def test_an_unset_model_is_not_passed_at_all():
    for value in ("", "default", "auto", "none", None):
        assert copilot_cli.effective_model(value) is None


def test_a_rejected_model_is_dropped_for_the_rest_of_the_process():
    assert copilot_cli.effective_model("gpt-4o") == "gpt-4o"
    copilot_cli._remember_rejection("gpt-4o")
    assert copilot_cli.effective_model("gpt-4o") is None


def test_a_rejection_belongs_to_the_account_that_was_refused(monkeypatch):
    """One user's token lacking a model must not downgrade everyone's runs.

    The Agent Lab invokes the CLI inside the long-lived server process, so a
    rejection remembered by model name alone outlived the request that earned
    it and silently ignored the next user's chosen model.
    """
    monkeypatch.setenv("COPILOT_GITHUB_TOKEN", "token-for-account-a")
    copilot_cli._remember_rejection("gpt-4o")
    assert copilot_cli.effective_model("gpt-4o") is None

    monkeypatch.setenv("COPILOT_GITHUB_TOKEN", "token-for-account-b")
    assert copilot_cli.effective_model("gpt-4o") == "gpt-4o"


def test_the_command_carries_the_agent_workspace_and_prompt(tmp_path):
    cmd = copilot_cli.build_command(
        agent_id="test-generator",
        prompt="do the thing",
        workspace=tmp_path,
        tools=["read", "write"],
    )
    assert "--agent" in cmd and "test-generator" in cmd
    assert "--add-dir" in cmd and str(tmp_path) in cmd
    assert cmd[-2:] == ["--prompt", "do the thing"]
    assert "--allow-tool=write" in cmd


# ----------------------------------------------------------- failure handling


@pytest.mark.parametrize(
    "message,expected",
    [
        ("Error: Authentication failed (Request ID: ...)", "fatal"),
        ("No authentication information found.", "fatal"),
        ("You have exceeded your monthly quota", "fatal"),
        # A definition that was not staged will not appear on a retry either,
        # and every stage would pay three invocations and two backoffs to learn
        # the same thing.
        ("No such agent: test-generator, available:", "fatal"),
        ("429 Too Many Requests", "transient"),
        ("503 Service Unavailable", "transient"),
        ("socket hang up", "transient"),
        ("something nobody has seen before", "unknown"),
    ],
)
def test_failures_are_classified_by_whether_a_retry_could_help(message, expected):
    assert copilot_cli.classify(message) == expected


# ---------------------------------------------------------------- the deadline


@pytest.fixture(autouse=True)
def _clear_deadline():
    yield
    copilot_cli.set_deadline(None)


def test_an_agent_is_not_started_when_the_run_budget_is_spent(monkeypatch, tmp_path):
    """Being killed by the executor produces no run record at all.

    Stopping first turns a silent kill into a reported failure with the
    artifacts and phases the run had already produced.
    """
    run = _fake_run([_proc(0, stdout="done")])
    monkeypatch.setattr(subprocess, "run", run)
    copilot_cli.set_deadline(1)

    with pytest.raises(FatalAgentError, match="time budget"):
        copilot_cli.invoke(agent_id="a", prompt="p", workspace=tmp_path)

    assert run.seen == [], "the CLI should not have been invoked at all"


def test_an_invocation_is_capped_by_what_is_left_of_the_budget(monkeypatch, tmp_path):
    """A 300s agent with 100s left gets 100s, and reports its own timeout."""
    seen = {}

    def run(cmd, **kwargs):
        seen["timeout"] = kwargs.get("timeout")
        return _proc(0, stdout="done")

    monkeypatch.setattr(subprocess, "run", run)
    copilot_cli.set_deadline(100)

    copilot_cli.invoke(agent_id="a", prompt="p", workspace=tmp_path, timeout=300)

    assert 90 <= seen["timeout"] <= 100


def _fake_run(results):
    """Hand back one CompletedProcess per call, recording the commands seen."""
    seen = []

    def run(cmd, **kwargs):
        seen.append(cmd)
        item = results[min(len(seen) - 1, len(results) - 1)]
        if isinstance(item, Exception):
            raise item
        return item

    run.seen = seen
    return run


def _proc(returncode=0, stdout="", stderr=""):
    return subprocess.CompletedProcess([], returncode, stdout, stderr)


def test_a_transient_failure_is_retried_and_can_succeed(monkeypatch, tmp_path):
    run = _fake_run([_proc(1, stderr="503 Service Unavailable"), _proc(0, stdout="done")])
    monkeypatch.setattr(subprocess, "run", run)
    monkeypatch.setattr(copilot_cli, "_backoff", lambda attempt: None)

    result = copilot_cli.invoke(agent_id="a", prompt="p", workspace=tmp_path)

    assert result.stdout == "done"
    assert result.attempts == 2


def test_an_authentication_failure_is_not_retried(monkeypatch, tmp_path):
    run = _fake_run([_proc(1, stderr="Error: Authentication failed")])
    monkeypatch.setattr(subprocess, "run", run)
    monkeypatch.setattr(copilot_cli, "_backoff", lambda attempt: None)

    with pytest.raises(FatalAgentError):
        copilot_cli.invoke(agent_id="a", prompt="p", workspace=tmp_path)

    assert len(run.seen) == 1


def test_a_missing_cli_is_fatal_rather_than_retried(monkeypatch, tmp_path):
    run = _fake_run([FileNotFoundError()])
    monkeypatch.setattr(subprocess, "run", run)

    with pytest.raises(FatalAgentError, match="not found"):
        copilot_cli.invoke(agent_id="a", prompt="p", workspace=tmp_path)


def test_a_rejected_model_is_retried_immediately_without_it(monkeypatch, tmp_path):
    run = _fake_run(
        [
            _proc(1, stderr="The requested model from --model flag is not available"),
            _proc(0, stdout="done"),
        ]
    )
    monkeypatch.setattr(subprocess, "run", run)
    monkeypatch.setattr(copilot_cli, "_backoff", lambda attempt: None)

    result = copilot_cli.invoke(
        agent_id="a", prompt="p", workspace=tmp_path, model="gpt-4o"
    )

    assert result.stdout == "done"
    assert "--model" in run.seen[0]
    assert "--model" not in run.seen[1], "the rejected model must not be sent again"
    assert copilot_cli.effective_model("gpt-4o") is None, "and not on the next stage"


def test_exhausted_attempts_raise_rather_than_return_empty(monkeypatch, tmp_path):
    run = _fake_run([_proc(1, stderr="503 Service Unavailable")])
    monkeypatch.setattr(subprocess, "run", run)
    monkeypatch.setattr(copilot_cli, "_backoff", lambda attempt: None)

    with pytest.raises(RuntimeError):
        copilot_cli.invoke(agent_id="a", prompt="p", workspace=tmp_path)

    assert len(run.seen) == copilot_cli.MAX_CLI_ATTEMPTS


def test_a_full_timeout_is_fatal_and_is_not_retried(monkeypatch, tmp_path):
    """Retrying a 300s hang used to turn one stuck agent into three."""
    seen = []

    def boom(*args, **kwargs):
        seen.append(kwargs.get("timeout"))
        raise subprocess.TimeoutExpired(cmd="copilot", timeout=kwargs.get("timeout") or 1)

    monkeypatch.setattr(subprocess, "run", boom)

    with pytest.raises(FatalAgentError, match="exceeded"):
        copilot_cli.invoke(agent_id="a", prompt="p", workspace=tmp_path, timeout=5)

    assert len(seen) == 1
