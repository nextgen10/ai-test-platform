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

import os
import random
import re
import shlex
import shutil
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Sequence

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
__all__ = ["FatalAgentError", "CliResult", "invoke", "build_command", "allow_tool_flags"]

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

RETRY_BASE_SECONDS = float(os.getenv("COPILOT_RETRY_BASE_SECONDS", "3"))


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

#: Not worth another attempt: no retry produces a token, a quota or a binary.
_FATAL = re.compile(
    r"authentication failed|no authentication information|not (logged in|"
    r"authenticated)|invalid token|bad credentials|\b401\b|\b403\b|"
    r"quota|no requests left|permission.*denied.*token",
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

#: Models an account has already rejected. Remembered for the process so the
#: rejection is paid once, not once per stage — the logs used to show the same
#: five-second "[Model Fallback]" dance before every single agent.
_REJECTED_MODELS: set[str] = set()

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
    if resolved in _REJECTED_MODELS:
        return None
    return resolved


def _model_was_rejected(message: str) -> bool:
    return bool(
        re.search(r"from --model flag is not available|model .* (is )?not (available|permitted|supported)", message, re.I)
    )


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

    seconds = timeout or AGENT_TIMEOUT_SECONDS
    last_error = ""

    for attempt in range(1, max(1, MAX_CLI_ATTEMPTS) + 1):
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
        retry = f" [attempt {attempt}/{MAX_CLI_ATTEMPTS}]" if attempt > 1 else ""
        log(f"  exec: {copilot_bin()} --agent {agent_id}{suffix}{retry}")

        try:
            proc = subprocess.run(
                cmd,
                cwd=str(workspace),
                env=environment,
                capture_output=True,
                text=True,
                timeout=seconds,
            )
        except FileNotFoundError as exc:
            raise FatalAgentError(
                f"Copilot CLI not found (looked for {copilot_bin()!r}). Install it, "
                f"set $COPILOT_BIN, or run with ENGINE=mock."
            ) from exc
        except subprocess.TimeoutExpired:
            last_error = f"Agent {agent_id!r} exceeded {seconds}s"
            if attempt < MAX_CLI_ATTEMPTS:
                log(f"  {last_error} — retrying")
                _backoff(attempt)
                continue
            raise RuntimeError(last_error) from None

        if log_output and proc.stdout:
            for line in proc.stdout.splitlines()[-40:]:
                log(f"    | {line}")

        if proc.returncode == 0:
            return CliResult(proc.stdout or "", proc.stderr or "", attempt, resolved)

        last_error = ((proc.stderr or proc.stdout) or "").strip() or (
            f"Agent {agent_id!r} exited {proc.returncode} with no output"
        )

        # A rejected model is not a failed run: drop it and go again immediately.
        if resolved and _model_was_rejected(last_error):
            _REJECTED_MODELS.add(resolved)
            log(
                f"  model {resolved!r} is not available on this account; "
                f"falling back to the account default for the rest of this run"
            )
            continue

        kind = classify(last_error)
        if kind == "fatal":
            raise FatalAgentError(_tail(last_error))
        if attempt < MAX_CLI_ATTEMPTS:
            log(f"  {agent_id}: {kind} failure — retrying ({_tail(last_error, 1)})")
            _backoff(attempt)
            continue

    raise RuntimeError(f"Agent {agent_id!r} failed: {_tail(last_error)}")


def _backoff(attempt: int) -> None:
    """Exponential, with jitter so parallel stages do not retry in lockstep."""
    time.sleep(RETRY_BASE_SECONDS * (2 ** (attempt - 1)) * (0.5 + random.random()))


def _tail(message: str, lines: int = 10) -> str:
    parts = [line for line in (message or "").strip().splitlines() if line.strip()]
    return " / ".join(parts[-lines:]) or "no output"


def reset_model_fallback() -> None:
    """Forget which models were rejected. For tests, and for a long-lived server
    that should not carry one account's rejection into another's run."""
    _REJECTED_MODELS.clear()
