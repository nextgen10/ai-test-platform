"""Chat orchestration engine.

Routes user messages to the appropriate GHCP CLI invocation based on the
selected agent, skill, prompt, or workflow configuration.  Supports both
streaming (SSE) and blocking execution modes.
"""
from __future__ import annotations

import asyncio
import codecs
import logging
import os
import shlex
import shutil
import tempfile
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from pathlib import Path

from app.config import settings
from app.services import cli_errors, hub_registry, runner_bridge
from app.services.job_service import resolve_copilot_bin

logger = logging.getLogger("chat-orchestrator")

#: How much prior conversation to replay. The CLI is invoked fresh per message,
#: so history has to be re-sent; this bounds how large that gets.
MAX_HISTORY_CHARS = int(os.getenv("CHAT_MAX_HISTORY_CHARS", "24000"))

#: stdout read size. Bytes, not characters — see the incremental decoder below.
_READ_CHUNK = 1024


@dataclass
class HistoryTurn:
    """One prior message in the session, as replayed to the model."""

    role: str
    content: str


@dataclass
class ChatConfig:
    """Resolved configuration for a single chat invocation.

    Note there is no ``workflow_id`` here. A workflow is a multi-stage pipeline
    with artifacts and (sometimes) a human gate; it is submitted as a job and
    runs through an executor, not squeezed into one CLI call. The session still
    records the selection so the console can restore it.
    """
    content: str
    agent_id: str | None = None
    skill_id: str | None = None
    prompt_id: str | None = None
    model: str | None = None
    github_token: str | None = None
    engine: str | None = None
    #: Prior turns, oldest first, excluding the message being sent now.
    history: list[HistoryTurn] = field(default_factory=list)


@dataclass
class ChatResponse:
    """Complete response from a chat execution."""
    content: str
    agent_id: str | None = None
    model: str | None = None
    duration_ms: int = 0
    engine: str = "copilot"


def _render_history(history: list[HistoryTurn]) -> str:
    """Render prior turns as a transcript, dropping the oldest if too large.

    Without this each message is an independent one-shot and the agent cannot
    see anything the user said before — which is not what a chat window
    promises.
    """
    if not history:
        return ""

    rendered: list[str] = []
    budget = MAX_HISTORY_CHARS
    dropped = 0

    # Walk backwards so the most recent turns are the ones that survive.
    newest_first = list(reversed(history))
    for index, turn in enumerate(newest_first):
        label = "User" if turn.role == "user" else "Assistant"
        block = f"{label}: {turn.content.strip()}"
        if len(block) > budget:
            # Stop at the first turn that will not fit rather than skipping it.
            # Carrying on would keep older turns that happen to be smaller,
            # leaving a hole mid-conversation — and a gap reads to the model as
            # though those exchanges never happened, which is worse than a
            # transcript that simply starts later.
            dropped = len(newest_first) - index
            break
        rendered.append(block)
        budget -= len(block) + 2

    rendered.reverse()
    if not rendered:
        return ""

    header = "--- CONVERSATION SO FAR ---"
    if dropped:
        header += f"\n({dropped} earlier turn(s) omitted to fit the context budget.)"
    return f"{header}\n\n" + "\n\n".join(rendered) + "\n\n--- END OF HISTORY ---\n\n"


def _console_framing(agent_id: str | None) -> str:
    """Tell an artifact-writing agent how to answer in a console.

    Agent definitions are written for a job workspace: the designer's own prompt
    says *"Write JSON only — no Markdown fences, no prose — to
    intermediate/test_design.json"*. The console grants no ``write`` tool and has
    no workspace, so an agent obeying its contract has nowhere to put the
    document and improvises — typically emitting the payload once bare (obeying
    "no fences"), then narrating and emitting it a second time inside a fence
    for the human. That duplicate is not a streaming glitch; it is an agent
    given two incompatible instructions and satisfying both.

    Naming the situation costs one paragraph and removes the contradiction. The
    Agent Lab already frames its runs this way, which is why it never produced
    the doubled output.

    Prepended rather than appended: everything after the user's message is, by
    this platform's own trust boundary, untrusted data. Instructions belong
    before it.
    """
    if not agent_id:
        return ""
    try:
        agent = hub_registry.get_agent(agent_id)
    except hub_registry.InvalidEntityId:
        return ""
    if not agent:
        return ""

    artifact = str(agent.get("output_artifact") or "").strip()
    if not artifact or artifact == "workspace":
        # A conversational agent writes no artifact and needs no reframing.
        return ""

    return (
        "--- HOW TO REPLY IN THIS CONSOLE ---\n"
        "You are running interactively, not inside a job workspace. There is no "
        f"filesystem here: you cannot create {artifact}, and no later stage will "
        "read it.\n"
        "Your reply IS the artifact. Return exactly the content you would have "
        f"written to {artifact} — once — as your entire reply, in a single "
        "fenced code block of the appropriate language.\n"
        "Do not describe what you are about to do, do not summarise afterwards, "
        "and never repeat the content a second time.\n"
        "--- END ---\n"
    )


def _resolve_prompt_content(config: ChatConfig) -> str:
    """Build the full prompt: framing, template, history, then the new message."""
    parts: list[str] = []

    framing = _console_framing(config.agent_id)
    if framing:
        parts.append(framing)

    if config.prompt_id:
        try:
            prompt = hub_registry.get_prompt(config.prompt_id)
        except hub_registry.InvalidEntityId:
            prompt = None
        if prompt:
            parts.append(prompt["body"])
            parts.append("---")

    history = _render_history(config.history)
    if history:
        parts.append(history.rstrip())

    parts.append(f"User Input:\n{config.content}" if config.prompt_id else config.content)
    return "\n\n".join(parts)


def _agent_exists(agent_id: str) -> bool:
    """Whether the registry has an agent by this name."""
    try:
        return hub_registry.get_agent(agent_id) is not None
    except hub_registry.InvalidEntityId:
        return False


def _stage_hub_context(work: Path) -> None:
    """Copy the hub's agents and skills to where the CLI will look for them.

    This is what the console was missing. The CLI discovers agents from
    ``.github/agents`` **relative to its working directory**, and chat runs in a
    fresh empty temp directory — so no agent was discoverable and every turn
    died on ``No such agent: test-designer, available:`` with an empty list.
    The registry knew the agent; the CLI was never told where to find it.

    ``COPILOT_CUSTOM_INSTRUCTIONS_DIRS`` and ``--add-dir`` do not fix this: the
    first supplies custom instructions and the second grants file access.
    Neither is agent discovery.

    Copied rather than symlinked, matching what both job runners do: a symlink
    into the host tree does not survive a container mount.
    """
    target = work / ".github"
    target.mkdir(parents=True, exist_ok=True)

    for kind in ("agents", "skills"):
        source = settings.agent_hub_dir / kind
        if not source.is_dir():
            logger.warning("Hub has no %s directory at %s", kind, source)
            continue
        try:
            # `symlinks=False` deliberately: agent-hub/.github/{agents,skills}
            # are symlinks into the hub, and copying them as links would leave
            # the container pointing at a path that does not exist there.
            shutil.copytree(source, target / kind, dirs_exist_ok=True, symlinks=False)
        except OSError as exc:
            logger.warning("Could not stage %s for the chat session: %s", kind, exc)


def _discoverable_agents() -> list[str]:
    """Agent ids the CLI will be able to resolve once the hub is staged."""
    source = settings.agent_hub_dir / "agents"
    if not source.is_dir():
        return []
    return sorted(p.name.replace(".agent.md", "") for p in source.glob("*.agent.md"))


def _build_copilot_cmd(
    config: ChatConfig, prompt_text: str, *, work: Path, model: str | None
) -> list[str]:
    """Construct the ``copilot`` CLI command with the right flags.

    ``model`` is passed in rather than read from ``config`` so a retry can drop
    a model the account has rejected without rebuilding the whole config.
    """
    cmd = [resolve_copilot_bin(), "-s", "--no-color"]

    if config.agent_id:
        cmd.extend(["--agent", config.agent_id])
        # Chat never grants write/edit/shell/fetch against the hub. Hub writes
        # are an author action through the Registry API, not a side effect of
        # an operator chatting with an agent that declared `write`.
        tools = [
            t
            for t in hub_registry.agent_tools(config.agent_id)
            if t in {"read", "search"}
        ]
    else:
        tools = ["read"]

    # Translated into patterns the CLI actually understands rather than passed
    # through verbatim. `read` and `search` are not permission kinds — reading
    # is not gated at all — so this correctly yields no grant, where the old
    # `--allow-tool read` looked like one and was silently discarded.
    cmd.extend(
        runner_bridge.copilot_cli().allow_tool_flags(tools, writes_artifact=False)
    )

    # Agents may read hub files; they write only into the throwaway cwd.
    cmd.extend(["--add-dir", str(settings.agent_hub_dir), "--add-dir", str(work)])

    if config.skill_id:
        # Skills load via --skill-path pointing at the skill directory. Ask the
        # registry for that path instead of rebuilding it from the hub root:
        # re-deriving it here is what put a traversal check one refactor away.
        try:
            directory = hub_registry.skill_dir(config.skill_id)
        except hub_registry.InvalidEntityId:
            directory = None
        if directory is not None and (directory / "SKILL.md").is_file():
            cmd.extend(["--skill-path", str(directory)])

    if model:
        cmd.extend(["--model", model])

    # Pass the prompt via -p for non-interactive execution
    cmd.extend(["-p", prompt_text])
    return cmd


def _build_env(config: ChatConfig) -> dict[str, str]:
    """Build the environment for the subprocess."""
    env = os.environ.copy()
    token = (
        config.github_token
        or os.getenv("COPILOT_GITHUB_TOKEN")
        or os.getenv("GH_TOKEN")
        or os.getenv("GITHUB_TOKEN")
        or ""
    ).strip()
    if token:
        env["COPILOT_GITHUB_TOKEN"] = token
        env["GH_TOKEN"] = token
        env["GITHUB_TOKEN"] = token

    # Point Copilot custom instruction dirs to both agent-hub and copilot directories
    custom_dirs = [
        str(settings.agent_hub_dir),
        str(settings.agent_hub_dir / ".github"),
    ]
    env["COPILOT_CUSTOM_INSTRUCTIONS_DIRS"] = ",".join(custom_dirs)
    return env


def _friendly_stderr(err_msg: str) -> str:
    """Turn a CLI failure into something a user can act on.

    Delegates to :mod:`app.services.cli_errors` so a job and a chat turn explain
    the same failure the same way.
    """
    return cli_errors.as_markdown(err_msg)


async def _drain(stream: asyncio.StreamReader | None, sink: list[bytes]) -> None:
    """Read a pipe to EOF into `sink`.

    stderr has to be drained *concurrently* with stdout. Reading it only after
    `wait()` deadlocks as soon as the child writes more than one pipe buffer
    (~64KB) — and Copilot writes progress to stderr on a long run.
    """
    if stream is None:
        return
    while True:
        chunk = await stream.read(_READ_CHUNK)
        if not chunk:
            return
        sink.append(chunk)


#: How many times one chat turn is attempted. A retry only happens when the
#: attempt failed *before* emitting anything, so the user never sees a partial
#: answer replaced by a second one.
MAX_CHAT_ATTEMPTS = 3


class _Attempt:
    """What one invocation did, so the caller can decide whether to try again."""

    def __init__(self) -> None:
        self.emitted = False
        self.failure = ""
        self.timed_out = False


async def _stream_once(
    cmd: list[str], env: dict[str, str], cwd: str, state: _Attempt, deadline: float
) -> AsyncIterator[str]:
    """One CLI invocation, streamed. Records the failure rather than raising.

    ``deadline`` is the budget for the *turn*, not for this attempt, so a retry
    cannot multiply the time a user waits by the number of attempts.
    """
    process: asyncio.subprocess.Process | None = None
    stderr_chunks: list[bytes] = []

    try:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
            cwd=cwd,
        )
    except FileNotFoundError:
        state.failure = (
            f"The GitHub Copilot CLI (`{resolve_copilot_bin()}`) is not installed or "
            f"not on PATH. Install it, or set `ENGINE=mock` (Settings -> Mock) to work "
            f"offline.\n\n`npm install -g @github/copilot`"
        )
        return
    except Exception as exc:  # noqa: BLE001
        logger.exception("Could not start the Copilot CLI")
        state.failure = f"Could not start the agent: {exc}"
        return

    stdout = process.stdout
    if stdout is None:  # pragma: no cover - stdout=PIPE guarantees a reader
        state.failure = "The agent produced no output stream."
        return

    stderr_task = asyncio.create_task(_drain(process.stderr, stderr_chunks))
    # A stateful decoder: a UTF-8 sequence split across two reads would
    # otherwise be replaced with U+FFFD at both ends of the boundary, which
    # mangles every emoji and every non-Latin character the agents emit.
    decoder = codecs.getincrementaldecoder("utf-8")("replace")

    try:
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                state.timed_out = True
                break
            try:
                chunk = await asyncio.wait_for(
                    stdout.read(_READ_CHUNK), timeout=remaining
                )
            except asyncio.TimeoutError:
                state.timed_out = True
                break
            if not chunk:
                break
            text = decoder.decode(chunk)
            if text:
                state.emitted = True
                yield text

        tail = decoder.decode(b"", final=True)
        if tail:
            state.emitted = True
            yield tail

        if state.timed_out:
            process.kill()
            await process.wait()
            yield (
                f"\n\nThe agent was stopped after "
                f"{settings.chat_stream_timeout}s without finishing. Try a "
                f"narrower question, or raise `CHAT_STREAM_TIMEOUT`."
            )
            return

        await process.wait()
        await stderr_task

        if process.returncode != 0:
            err_msg = b"".join(stderr_chunks).decode("utf-8", errors="replace").strip()
            state.failure = err_msg or (
                f"The agent exited with code {process.returncode}."
            )

    except asyncio.CancelledError:
        # The client disconnected (they pressed Stop). Kill the child rather
        # than letting it run to completion against a quota nobody will read.
        logger.info("Chat stream cancelled; terminating the agent process")
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("Chat execution failed")
        state.failure = f"Execution error: {exc}"
    finally:
        if not stderr_task.done():
            stderr_task.cancel()
        if process is not None and process.returncode is None:
            try:
                process.kill()
                await process.wait()
            except ProcessLookupError:
                pass


async def execute_streaming(config: ChatConfig) -> AsyncIterator[str]:
    """Execute a GHCP CLI call and yield output chunks as they arrive.

    This is the primary interface for the SSE chat endpoint.  Each yielded
    string is a chunk of the assistant's response.
    """
    prompt_text = _resolve_prompt_content(config)
    start = time.monotonic()

    effective_engine = (config.engine or settings.engine or "mock").strip().lower()

    if effective_engine == "mock":
        # Mock mode: return a canned response for development/testing
        async for chunk in _mock_streaming(config, prompt_text):
            yield chunk
        return

    # Passing an unknown name straight to `--agent` surfaces a raw CLI error
    # that says nothing about the Registry being where agents come from.
    if config.agent_id and not _agent_exists(config.agent_id):
        available = _discoverable_agents()
        listed = ", ".join(f"`{a}`" for a in available) if available else "none"
        yield (
            f"No agent named `{config.agent_id}` is onboarded, so there is "
            f"nothing to route this to. Available: {listed}. Pick one from the "
            f"Agent list, or add it in the Registry."
        )
        return

    cli = runner_bridge.copilot_cli()
    work = Path(tempfile.mkdtemp(prefix="hub-chat-"))
    cwd = str(work)

    # One budget for the whole turn. Retries share it rather than each getting
    # a fresh one, so the worst case a user waits stays CHAT_STREAM_TIMEOUT
    # instead of multiplying by the attempt count.
    deadline = time.monotonic() + settings.chat_stream_timeout

    # Before anything else: put the agents where the CLI looks for them.
    _stage_hub_context(work)

    env = _build_env(config)
    model = cli.effective_model(config.model)

    try:
        for attempt in range(1, MAX_CHAT_ATTEMPTS + 1):
            cmd = _build_copilot_cmd(config, prompt_text, work=work, model=model)

            # The prompt can contain anything the user typed, so log the shape
            # of the call without its contents.
            logger.info(
                "Chat exec: %s (cwd=%s, prompt=%d chars, history=%d turns, attempt=%d)",
                " ".join(shlex.quote(c) for c in cmd[:-1]),
                cwd,
                len(prompt_text),
                len(config.history),
                attempt,
            )

            state = _Attempt()
            async for chunk in _stream_once(cmd, env, cwd, state, deadline):
                yield chunk

            if not state.failure:
                return

            # Never retry over the top of a partial answer: the user has
            # already read it, and a second one appended to it is nonsense.
            if state.emitted or attempt == MAX_CHAT_ATTEMPTS:
                yield _friendly_stderr(state.failure)
                return

            # No point starting another attempt with no time left to run it.
            if time.monotonic() >= deadline:
                yield _friendly_stderr(state.failure)
                return

            # A model this account cannot use is not a failed turn — drop it
            # and go again. Remembered process-wide, so the next turn does not
            # pay for the same rejection.
            if model and cli.model_was_rejected(state.failure):
                logger.info("Model %s rejected by the account; retrying on default", model)
                cli.remember_model_rejection(model)
                model = None
                continue

            kind = cli.classify(state.failure)
            if kind == "fatal":
                yield _friendly_stderr(state.failure)
                return

            logger.info("Chat attempt %d failed (%s); retrying", attempt, kind)
            await asyncio.sleep(min(2 ** (attempt - 1), 4))
    finally:
        shutil.rmtree(work, ignore_errors=True)
        elapsed = int((time.monotonic() - start) * 1000)
        logger.info("Chat completed in %dms", elapsed)


async def execute_blocking(config: ChatConfig) -> ChatResponse:
    """Execute and collect the full response (non-streaming)."""
    chunks: list[str] = []
    start = time.monotonic()

    async for chunk in execute_streaming(config):
        chunks.append(chunk)

    elapsed = int((time.monotonic() - start) * 1000)
    return ChatResponse(
        content="".join(chunks),
        agent_id=config.agent_id,
        model=config.model,
        duration_ms=elapsed,
        engine=(config.engine or settings.engine),
    )


_MOCK_YIELD = 32


async def _yield_pieces(text: str, *, pause_every: int = 2) -> AsyncIterator[str]:
    """Yield readable chunks instead of one SSE frame per character.

    Character-at-a-time frames force the console to setState thousands of
    times per mock reply, which React reports as a nested-update overflow.
    """
    if not text:
        return
    n = 0
    for i in range(0, len(text), _MOCK_YIELD):
        yield text[i : i + _MOCK_YIELD]
        n += 1
        if n % pause_every == 0:
            await asyncio.sleep(0.01)


async def _mock_streaming(config: ChatConfig, prompt_text: str) -> AsyncIterator[str]:
    """Mock streaming response for development without GHCP CLI."""
    agent_name = config.agent_id or "general assistant"
    model_name = config.model or "default model"
    skill_name = config.skill_id or "none"

    header = (
        f"**Agent Hub response** (mock mode)\n\n"
        f"**Agent**: `{agent_name}` | **Model**: `{model_name}` | "
        f"**Skill**: `{skill_name}` | **History**: {len(config.history)} turn(s)"
        f"\n\n---\n\n"
    )

    async for piece in _yield_pieces(header):
        yield piece

    # An agent under contract must answer in the shape of its contract, even in
    # mock mode. It used to reply with a hand-written Markdown table while the
    # real agent returned schema-valid JSON — so mock, which is what CI and every
    # first run use, exercised a different output shape than production and left
    # the whole structured path (the Structured view, `extractJson`, every
    # downstream consumer) untested in the only mode that always runs.
    contract_reply = _mock_contract_reply(config.agent_id)
    if contract_reply is not None:
        response = contract_reply
    elif config.agent_id == "ocr-extractor":
        response = _mock_ocr_response(config.content)
    else:
        response = _mock_general_response(config.content)

    async for piece in _yield_pieces(response):
        yield piece

    yield (
        "\n\n---\n*Mock response — set `ENGINE=copilot` with a valid token "
        "for real GHCP generation.*"
    )


def _mock_contract_reply(agent_id: str | None) -> str | None:
    """The canned document for an agent that declares an output schema.

    Sourced from the runner's own mock table rather than written again here:
    the job path, the Agent Lab and the console then all stand in for the same
    agent with the same payload, and a fixture that drifts drifts everywhere at
    once instead of in one place quietly.

    Returns None for an agent with no contract — those legitimately reply in
    prose, and inventing JSON for them would be its own kind of wrong.
    """
    if not agent_id:
        return None
    try:
        agent = hub_registry.get_agent(agent_id)
    except hub_registry.InvalidEntityId:
        return None
    if not agent or not agent.get("output_schema"):
        return None

    try:
        generic_runner = runner_bridge.generic_runner()
    except runner_bridge.RunnerUnavailable:
        return None

    canned = {
        "requirement-analyst": getattr(generic_runner, "_MOCK_QUALITY", None),
        "test-designer": getattr(generic_runner, "_MOCK_DESIGN", None),
        "test-generator": getattr(generic_runner, "_MOCK_SUITE", None),
        "test-reviewer": getattr(generic_runner, "_MOCK_SUITE", None),
        "test-evaluator": getattr(generic_runner, "_MOCK_EVALUATION", None),
        "gap-closer": getattr(generic_runner, "_MOCK_SUITE", None),
    }.get(agent_id)

    if canned is None:
        # An agent onboarded later has a contract but no canned document. Say so
        # rather than emitting prose that looks like it satisfied the schema.
        return (
            f"```json\n"
            f'{{"mock": true, "agent": "{agent_id}", '
            f'"note": "No canned document for this agent. Set ENGINE=copilot '
            f'for real output."}}\n'
            f"```"
        )

    import json

    return f"```json\n{json.dumps(canned, indent=2)}\n```"


def _mock_test_designer_response(prompt: str) -> str:
    snippet = prompt[:120].replace("\n", " ")
    return (
        f"## Test Design Analysis\n\n"
        f"Based on the requirement: *\"{snippet}...\"*\n\n"
        f"### Identified Scenarios\n\n"
        f"| ID | Scenario | Category | Priority |\n"
        f"|---|---------|----------|----------|\n"
        f"| SC-1 | Happy path flow | functional | high |\n"
        f"| SC-2 | Invalid input handling | negative | high |\n"
        f"| SC-3 | Boundary value limits | boundary | medium |\n"
        f"| SC-4 | Required field validation | validation | medium |\n"
        f"| SC-5 | Data state variations | data | low |\n\n"
        f"### Coverage Dimensions\n"
        f"- **Functional**: Primary user flows and documented behaviors\n"
        f"- **Negative**: Error paths, unauthorized access, invalid states\n"
        f"- **Boundary**: Min/max limits, empty inputs, overflow conditions\n"
        f"- **Validation**: Field-level format and constraint checks\n"
        f"- **Data**: Cross-role, cross-locale, volume variations\n"
    )


def _mock_analyst_response(prompt: str) -> str:
    snippet = prompt[:100].replace("\n", " ")
    return (
        f"## INVEST Quality Assessment\n\n"
        f"Analyzing requirement: *\"{snippet}...\"*\n\n"
        f"| Criterion | Rating | Rationale |\n"
        f"|-----------|--------|----------|\n"
        f"| Independent | Good | Self-contained feature |\n"
        f"| Negotiable | Good | States what, not how |\n"
        f"| Valuable | Very Good | Clear business benefit |\n"
        f"| Estimable | Average | Scope could be clearer |\n"
        f"| Small | Good | Single coherent capability |\n"
        f"| Testable | Good | Observable outcomes present |\n"
        f"| Acceptance Criteria | Average | Implicit, not explicit |\n"
        f"| Unambiguous | Good | Specific terminology used |\n\n"
        f"**Overall Score**: 3.00 / 4.00 — **Good**\n"
    )


def _mock_ocr_response(prompt: str) -> str:
    return (
        "## Extracted Requirement\n\n"
        "### Overview\n"
        "Feature extracted from the provided document image.\n\n"
        "### Business Rules & Logic\n"
        "- **BR-1**: [Extracted rule from document]\n\n"
        "### Assumptions & Notes\n"
        "- Document processed in mock mode; no actual OCR performed.\n"
    )


def _mock_general_response(prompt: str) -> str:
    snippet = prompt[:150].replace("\n", " ")
    return (
        f"I've analyzed your request: *\"{snippet}...\"*\n\n"
        f"Here's my analysis:\n\n"
        f"1. **Understanding**: I've parsed the key requirements from your input.\n"
        f"2. **Recommendations**: Based on the analysis, here are my suggestions.\n"
        f"3. **Next Steps**: Consider using a specific agent or workflow for "
        f"deeper analysis.\n\n"
        f"**Tip**: Select an agent from the configuration bar for specialized "
        f"analysis — test-designer, requirement-analyst, and more.\n"
    )
