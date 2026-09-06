"""One place that knows how to invoke the GitHub Copilot CLI.

There were three of these: ``agent_chain.build_copilot_command``,
``generic_runner._invoke_cli`` and the backend's ``agent_lab._copilot_run``.
They drifted, and the drift was not cosmetic — the chain granted ``write`` and
its agents could produce artifacts, while the generic runner passed the agent's
declared tool names straight through as permission patterns. ``write`` happens
to be a real one, so the built-in agents worked; ``read`` is not, so an agent
onboarded through the Registry without a ``tools:`` line was silently denied the
ability to write its own output and failed its contract every single run.

Fixing that in one file and calling it from three is the point of this module.

What it owns:

* **Tool grants** that are actually valid patterns (``copilot help permissions``:
  the kinds are ``shell(...)``, ``write(...)``, ``url(...)`` and
  ``<mcp-server>(...)``; reading is not permission-gated at all).
* **Retry**, so a dropped connection or a busy backend costs three seconds
  rather than a whole run.
* **Model fallback**, remembered for the process, so an account that cannot use
  the configured model pays the rejection once instead of once per stage.
"""
from __future__ import annotations

import hashlib
import os
import random
import re
import shlex
import shutil
import subprocess
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Sequence

try:
    from agent_io import FatalAgentError
except ImportError:  # pytest loads this as runner.copilot_cli
    from runner.agent_io import FatalAgentError  # type: ignore[no-redef]

#: Re-exported deliberately. ``agent_io`` is reachable as both ``agent_io`` (the
#: runner directory is on ``sys.path`` in the container and in the backend) and
#: ``runner.agent_io`` (the test suite), and those are two different module
#: objects holding two different classes of the same name. Anything catching
#: what this module raises must name it from here, so it catches the one that
#: is actually thrown.
__all__ = [
    "FatalAgentError",
    "CliResult",
    "invoke",
    "build_command",
    "allow_tool_flags",
    "classify",
    "effective_model",
    "model_was_rejected",
    "remember_model_rejection",
]

_log: Callable[[str], None] = print


def set_logger(fn: Callable[[str], None]) -> None:
    global _log
    _log = fn


def log(message: str) -> None:
    _log(message)


# ---------------------------------------------------------------- environment

AGENT_TIMEOUT_SECONDS = int(os.getenv("AGENT_TIMEOUT_SECONDS", "300"))

#: How many times one invocation is attempted when the failure looks transient.
#: Three is two retries, which covers a blip without turning a genuine outage
#: into a run that hangs around for a quarter of an hour before admitting it.
MAX_CLI_ATTEMPTS = int(os.getenv("COPILOT_MAX_ATTEMPTS", "3"))

#: How often a still-running invocation writes a line to the job log. Zero
#: disables it. Without this a five-minute Copilot call looks frozen: the
#: runner prints nothing between "exec:" and the agent's exit.
HEARTBEAT_SECONDS = float(os.getenv("COPILOT_HEARTBEAT_SECONDS", "30"))

RETRY_BASE_SECONDS = float(os.getenv("COPILOT_RETRY_BASE_SECONDS", "3"))

#: Too little time left to be worth starting an agent: it would be killed
#: mid-write, leaving a truncated artifact for the next stage to read.
MIN_INVOCATION_SECONDS = 20

#: When the run must be finished, as a monotonic timestamp. None means no limit,
#: which is what the Agent Lab and a hand-run runner want.
_DEADLINE: float | None = None


def set_deadline(seconds: float | None) -> None:
    """Bound the whole run, not just each invocation.

    Every executor kills the runner at ``JOB_TIMEOUT_SECONDS``, and the retry
    budget (attempts x contract corrections x per-agent timeout) can be several
    times that. The run was therefore killed mid-stage with no run record,
    losing both the artifacts it had produced and any account of why — while
    the retries it was promised could never have completed.

    Knowing the deadline lets a run stop starting work it cannot finish and
    fail with its phases intact instead.
    """
    global _DEADLINE
    _DEADLINE = time.monotonic() + seconds if seconds and seconds > 0 else None


def remaining_seconds() -> float | None:
    """Seconds left in the run's budget, or None when it is unbounded."""
    return None if _DEADLINE is None else _DEADLINE - time.monotonic()


def copilot_bin() -> str:
    """Resolved CLI path. On Windows a bare ``copilot`` is not executable."""
    configured = os.getenv("COPILOT_BIN", "copilot")
    return shutil.which(configured) or configured


def sync_github_tokens(explicit: str | None = None) -> str:
    """Put one token in all three variables the CLI may read."""
    token = (
        explicit
        or os.getenv("COPILOT_GITHUB_TOKEN")
        or os.getenv("GH_TOKEN")
        or os.getenv("GITHUB_TOKEN")
        or ""
    ).strip()
    if token:
        os.environ["COPILOT_GITHUB_TOKEN"] = token
        os.environ["GH_TOKEN"] = token
        os.environ["GITHUB_TOKEN"] = token
    return token


# ------------------------------------------------------------- failure kinds

#: Worth another attempt: the request never reached a model, or reached one that
#: was too busy to answer.
_TRANSIENT = re.compile(
    r"\b(429|500|502|503|504)\b|rate.?limit|too many requests|temporarily "
    r"unavailable|service unavailable|overloaded|try again|timed? ?out|timeout|"
    r"ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|socket hang up|network error|"
    r"fetch failed",
    re.I,
)

#: Not worth another attempt: no retry produces a token, a quota, a binary — or
#: an agent definition that was never staged. The last one used to be classified
#: as unknown and retried, so a staging failure cost every stage three
#: invocations and two backoffs before saying so.
_FATAL = re.compile(
    r"authentication failed|no authentication information|not (logged in|"
    r"authenticated)|invalid token|bad credentials|\b401\b|\b403\b|"
    r"quota|no requests left|permission.*denied.*token|"
    r"no such agent|unknown agent|agent .* not found",
    re.I,
)


def classify(message: str) -> str:
    """``fatal``, ``transient`` or ``unknown`` for a CLI failure message.

    ``unknown`` is retried once like a transient — an unrecognised failure is
    more often a blip than a permanent condition, and the cost of being wrong
    is one wasted attempt rather than a dead run.
    """
    text = message or ""
    if _FATAL.search(text):
        return "fatal"
    if _TRANSIENT.search(text):
        return "transient"
    return "unknown"


# ---------------------------------------------------------------- tool grants

#: Names agent definitions use, mapped to what the CLI actually understands.
#: Reading and searching are not permission-gated, so they map to nothing —
#: previously they were passed through verbatim and silently ignored, which
#: looked like a grant and was not one.
_TOOL_PATTERNS: dict[str, str | None] = {
    "read": None,
    "search": None,
    "list": None,
    "write": "write",
    "edit": "write",
    "create": "write",
}

#: Never granted from a definition. Requirement text is untrusted, and blanket
#: shell or network approval is how prompt injection in it becomes execution.
_NEVER_GRANTED = frozenset({"shell", "bash", "run", "execute", "fetch", "url", "network"})


def allow_tool_flags(declared: Sequence[str] | None, *, writes_artifact: bool) -> list[str]:
    """The ``--allow-tool`` flags for an agent's declared tool grant.

    ``writes_artifact`` is the safety net that closes the hole this module
    exists for: an agent that declares an ``output_artifact`` is by definition
    going to write a file, so it gets the grant whether or not someone
    remembered to put ``write`` in its frontmatter. Denying it produces an agent
    that cannot possibly succeed, which is not a useful thing to enforce.
    """
    patterns: list[str] = []
    for name in declared or ():
        key = str(name).strip().lower()
        if key in _NEVER_GRANTED:
            log(f"  note: ignoring declared tool {key!r}; it is never granted from a definition")
            continue
        pattern = _TOOL_PATTERNS.get(key)
        if pattern and pattern not in patterns:
            patterns.append(pattern)

    if writes_artifact and "write" not in patterns:
        patterns.append("write")

    # The `=` form deliberately: CLI 1.0.79+ declares this as
    # `--allow-tool[=tools...]`, where a space-separated value can be parsed as
    # a positional argument instead of as this flag's value.
    return [f"--allow-tool={pattern}" for pattern in patterns]


# ------------------------------------------------------------------- the call

#: ``(model, account)`` pairs already refused. Remembered for the process so the
#: rejection is paid once, not once per stage — the logs used to show the same
#: five-second "[Model Fallback]" dance before every single agent — and paired
#: with the account so it does not outlive the token it belongs to.
_REJECTED_MODELS: set[tuple[str, str]] = set()

_MODEL_ALIASES = {
    "claude-sonnet-4.5": "claude-sonnet-4.5",
    "claude-sonnet-4.6": "claude-sonnet-4.5",           # 4.6 → nearest GA alias
    "claude-sonnet-4.6-thinking": "claude-sonnet-4.5",  # thinking variant
    "claude-sonnet-4": "claude-3.5-sonnet",
    "claude-haiku-4.5": "claude-3.5-haiku",
    "claude-haiku-4.6": "claude-3.5-haiku",
    "claude-opus-4.5": "claude-3.5-sonnet",
    "gpt-5": "gpt-4o",
    "gpt-5.1": "gpt-4o",
    "gpt-5-mini": "gpt-4o-mini",
    "gpt-4.1": "gpt-4o",
    "gemini-3-pro-preview": "claude-3.5-sonnet",
}

_UNSET = {"", "default", "none", "auto"}


def effective_model(model: str | None) -> str | None:
    """The model to actually pass, or None to let the account decide."""
    raw = (model if model is not None else os.getenv("COPILOT_MODEL", "")).strip()
    if raw.lower() in _UNSET:
        return None
    resolved = _MODEL_ALIASES.get(raw.lower(), raw)
    if (resolved, _account()) in _REJECTED_MODELS:
        return None
    return resolved


def is_explicit_model(model: str | None) -> bool:
    """True when a specific model was asked for, rather than the account default.

    Distinguishes "we sent no model" from "the model we sent was refused",
    which :func:`effective_model` cannot: it answers None for both. A run that
    never named a model was being reported as having fallen back from one.
    """
    raw = (model if model is not None else os.getenv("COPILOT_MODEL", "")).strip()
    return bool(raw) and raw.lower() not in _UNSET


def _account() -> str:
    """A short, non-reversible tag for the token in the process environment.

    A model rejection is a fact about an account, not about the platform, so it
    is remembered against one. In the runner that is exact — each job syncs its
    own token before invoking. Callers that hand the token only to the child
    process share one tag, which is still consistent between remembering a
    rejection and reading it back.
    """
    token = os.getenv("COPILOT_GITHUB_TOKEN") or os.getenv("GH_TOKEN") or ""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()[:12] if token else "-"


def _remember_rejection(model: str) -> None:
    _REJECTED_MODELS.add((model, _account()))


def model_was_rejected(message: str) -> bool:
    """Whether a failure message means "this account cannot use that model".

    Public because the chat console needs the same reading: there, a rejected
    model is a retry on the account default, not a failed turn.
    """
    return bool(
        re.search(
            r"from --model flag is not available|"
            r"model .* (is )?not (available|permitted|supported)",
            message,
            re.I,
        )
    )


def remember_model_rejection(model: str) -> None:
    """Stop offering a model the account has already refused.

    Records it the way :func:`effective_model` reads it — against the account
    whose token was refused. A bare model name would never match, so the
    rejection would be remembered and then never consulted.
    """
    if model:
        _remember_rejection(model)


#: Kept as the old private name; several call sites predate the public one.
_model_was_rejected = model_was_rejected


@dataclass
class CliResult:
    stdout: str
    stderr: str
    attempts: int
    model: str | None


def build_command(
    *,
    agent_id: str,
    prompt: str,
    workspace: Path,
    tools: Sequence[str] | None = None,
    writes_artifact: bool = True,
    skill_path: Path | None = None,
    model: str | None = None,
) -> list[str]:
    """The full argv for one agent invocation.

    ``$COPILOT_CMD_TEMPLATE`` still overrides the whole thing, for an installed
    CLI whose syntax has moved on; it accepts {bin}, {agent}, {prompt} and
    {model}.
    """
    template = os.getenv("COPILOT_CMD_TEMPLATE")
    if template:
        return shlex.split(
            template.format(
                bin=copilot_bin(),
                agent=agent_id,
                prompt=shlex.quote(prompt),
                model=effective_model(model) or "default",
            )
        )

    cmd = [copilot_bin(), "--agent", agent_id, "--no-color"]

    resolved = effective_model(model)
    if resolved:
        cmd += ["--model", resolved]

    if skill_path:
        cmd += ["--skill-path", str(skill_path)]

    cmd += allow_tool_flags(tools, writes_artifact=writes_artifact)
    cmd += ["--add-dir", str(workspace)]
    cmd += ["--prompt", prompt]
    return cmd


def invoke(
    *,
    agent_id: str,
    prompt: str,
    workspace: Path,
    tools: Sequence[str] | None = None,
    writes_artifact: bool = True,
    skill_path: Path | None = None,
    model: str | None = None,
    timeout: int | None = None,
    env: dict[str, str] | None = None,
    log_output: bool = True,
) -> CliResult:
    """Run one agent, retrying what a retry can fix.

    Raises :class:`FatalAgentError` for a failure no retry helps with, and a
    plain ``RuntimeError`` when the attempts are exhausted — the caller's
    contract loop decides what to do with that.
    """
    sync_github_tokens()
    environment = os.environ.copy()
    environment["WORKSPACE"] = str(workspace)
    if env:
        environment.update(env)

    configured = timeout or AGENT_TIMEOUT_SECONDS
    last_error = ""
    total = max(1, MAX_CLI_ATTEMPTS)
    attempt = 0
    #: The free pass for dropping a rejected model is given once. Remembering
    #: the rejection already prevents a second one, but a loop that can add
    #: attempts is worth making structurally unable to run away.
    model_dropped = False

    while attempt < total:
        attempt += 1
        seconds = configured
        budget = remaining_seconds()
        if budget is not None:
            if budget < MIN_INVOCATION_SECONDS:
                raise FatalAgentError(
                    f"The job's time budget is exhausted; {agent_id!r} was not "
                    f"started. Raise JOB_TIMEOUT_SECONDS, or narrow the input so "
                    f"there is less work per agent."
                )
            # Better to let the agent be cut short by its own timeout, which is
            # reported, than by the executor killing the process, which is not.
            seconds = int(min(seconds, budget))

        resolved = effective_model(model)
        cmd = build_command(
            agent_id=agent_id,
            prompt=prompt,
            workspace=workspace,
            tools=tools,
            writes_artifact=writes_artifact,
            skill_path=skill_path,
            model=model,
        )
        suffix = f" (model {resolved})" if resolved else ""
        retry = f" [attempt {attempt}/{total}]" if attempt > 1 else ""
        log(f"  exec: {copilot_bin()} --agent {agent_id}{suffix}{retry}")

        try:
            proc = _run_cli(cmd, workspace, environment, seconds, agent_id)
        except FileNotFoundError as exc:
            raise FatalAgentError(
                f"Copilot CLI not found (looked for {copilot_bin()!r}). Install it, "
                f"set $COPILOT_BIN, or run with ENGINE=mock."
            ) from exc
        except subprocess.TimeoutExpired:
            # A full timeout is not a dropped connection. Retrying it used to
            # turn one hung agent into three sequential 300s waits — a builder
            # run of four agents could sit there for the whole job budget
            # looking stuck, then die of TIMEOUT with nothing to show.
            last_error = f"Agent {agent_id!r} exceeded {seconds}s"
            raise FatalAgentError(
                f"{last_error}. The agent was not retried — a full timeout is "
                f"the model not finishing, not a blip."
            ) from None

        if log_output and proc.stdout:
            for line in proc.stdout.splitlines()[-40:]:
                log(f"    | {line}")

        if proc.returncode == 0:
            return CliResult(proc.stdout or "", proc.stderr or "", attempt, resolved)

        last_error = ((proc.stderr or proc.stdout) or "").strip() or (
            f"Agent {agent_id!r} exited {proc.returncode} with no output"
        )

        # A rejected model is not a failed attempt: the same request without
        # --model is a different, cheaper one, and it has not been tried yet.
        # Charging it an attempt meant a run that had spent its budget on
        # transient failures died reporting "model not available" without ever
        # asking for the account default.
        if resolved and _model_was_rejected(last_error):
            _remember_rejection(resolved)
            if not model_dropped:
                model_dropped = True
                attempt -= 1
            log(
                f"  model {resolved!r} is not available on this account; "
                f"falling back to the account default for the rest of this run"
            )
            continue

        kind = classify(last_error)
        if kind == "fatal":
            raise FatalAgentError(_tail(last_error))
        if attempt < total:
            log(f"  {agent_id}: {kind} failure — retrying ({_tail(last_error, 1)})")
            _backoff(attempt)
            continue

    raise RuntimeError(f"Agent {agent_id!r} failed: {_tail(last_error)}")


def _run_cli(
    cmd: list[str],
    workspace: Path,
    environment: dict[str, str],
    seconds: int,
    agent_id: str,
) -> subprocess.CompletedProcess:
    """One CLI invocation, with a heartbeat so a long call is not silent."""
    stop = threading.Event()
    started = time.monotonic()
    interval = HEARTBEAT_SECONDS

    def beat() -> None:
        if interval <= 0:
            return
        while not stop.wait(interval):
            elapsed = int(time.monotonic() - started)
            log(f"  {agent_id}: still running ({elapsed}s)")

    thread = threading.Thread(target=beat, name=f"heartbeat-{agent_id}", daemon=True)
    thread.start()
    try:
        return subprocess.run(
            cmd,
            cwd=str(workspace),
            env=environment,
            capture_output=True,
            text=True,
            timeout=seconds,
        )
    finally:
        stop.set()


def _backoff(attempt: int) -> None:
    """Exponential, with jitter so parallel stages do not retry in lockstep.

    Never sleeps past the run's deadline: waiting out a budget that has already
    expired spends the last of it on nothing.
    """
    delay = RETRY_BASE_SECONDS * (2 ** (attempt - 1)) * (0.5 + random.random())
    budget = remaining_seconds()
    if budget is not None:
        delay = min(delay, max(0.0, budget - MIN_INVOCATION_SECONDS))
    time.sleep(delay)


def _tail(message: str, lines: int = 10) -> str:
    parts = [line for line in (message or "").strip().splitlines() if line.strip()]
    return " / ".join(parts[-lines:]) or "no output"


def reset_model_fallback() -> None:
    """Forget which models were rejected. For tests, and for a long-lived server
    that should not carry one account's rejection into another's run."""
    _REJECTED_MODELS.clear()


# ---------------------------------------------------------------- one identity

# This module is reachable under two names: ``copilot_cli`` (the runner directory is
# on sys.path inside the container, and the backend adds it) and
# ``runner.copilot_cli`` (the test suite imports it as a package). Python treats
# those as two separate modules, each with its own copy of everything at module
# scope — so patching one leaves the other live, an exception raised through one
# is not caught by the other, and module-level state diverges silently.
#
# Registering both names against this single object removes the ambiguity:
# whichever name a caller uses, it gets this module.
import sys as _sys

for _alias in ("copilot_cli", "runner.copilot_cli"):
    _sys.modules.setdefault(_alias, _sys.modules[__name__])
