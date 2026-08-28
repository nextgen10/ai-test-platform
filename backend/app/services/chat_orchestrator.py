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
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass, field

from app.config import settings
from app.services import cli_errors, hub_registry

logger = logging.getLogger("chat-orchestrator")

COPILOT_BIN = os.getenv("COPILOT_BIN", "copilot")

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
    for turn in reversed(history):
        label = "User" if turn.role == "user" else "Assistant"
        block = f"{label}: {turn.content.strip()}"
        if len(block) > budget:
            dropped += 1
            continue
        rendered.append(block)
        budget -= len(block) + 2

    rendered.reverse()
    if not rendered:
        return ""

    header = "--- CONVERSATION SO FAR ---"
    if dropped:
        header += f"\n({dropped} earlier turn(s) omitted to fit the context budget.)"
    return f"{header}\n\n" + "\n\n".join(rendered) + "\n\n--- END OF HISTORY ---\n\n"


def _resolve_prompt_content(config: ChatConfig) -> str:
    """Build the full prompt: template, then history, then the new message."""
    parts: list[str] = []

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


def _build_copilot_cmd(config: ChatConfig, prompt_text: str) -> list[str]:
    """Construct the ``copilot`` CLI command with the right flags."""
    cmd = [COPILOT_BIN, "-s", "--no-color"]

    if config.agent_id:
        cmd.extend(["--agent", config.agent_id])
        # Grant exactly what the agent declares. This used to be --allow-all,
        # which handed every tool to a profile that the (previously open)
        # registry API could write — effectively remote code execution.
        tools = hub_registry.agent_tools(config.agent_id)
    else:
        # No agent selected means a free-form question, which needs no tools.
        tools = ["read"]

    for tool in tools:
        cmd.extend(["--allow-tool", tool])

    if config.skill_id:
        # Skills are loaded via --skill-path pointing at the skill directory
        try:
            skill = hub_registry.get_skill(config.skill_id)
        except hub_registry.InvalidEntityId:
            skill = None
        if skill:
            skill_dir = settings.agent_hub_dir / "skills" / config.skill_id
            if skill_dir.is_dir():
                cmd.extend(["--skill-path", str(skill_dir)])

    if config.model:
        model_clean = config.model.strip().lower()
        if model_clean not in {"default", "none", "auto"}:
            cmd.extend(["--model", config.model.strip()])

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

    cmd = _build_copilot_cmd(config, prompt_text)
    env = _build_env(config)
    cwd = str(settings.agent_hub_dir)

    # The prompt can contain anything the user typed, so log the shape of the
    # call without its contents.
    logger.info(
        "Chat exec: %s (cwd=%s, prompt=%d chars, history=%d turns)",
        " ".join(shlex.quote(c) for c in cmd[:-1]),
        cwd,
        len(prompt_text),
        len(config.history),
    )

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
        yield (
            f"The GitHub Copilot CLI (`{COPILOT_BIN}`) is not installed or not on "
            f"PATH. Install it, or set `ENGINE=mock` to work offline.\n\n"
            f"`npm install -g @github/copilot`"
        )
        return
    except Exception as exc:  # noqa: BLE001
        logger.exception("Could not start the Copilot CLI")
        yield f"\n\nCould not start the agent: {exc}"
        return

    stdout = process.stdout
    if stdout is None:  # pragma: no cover — stdout=PIPE guarantees a reader
        yield "\n\nThe agent produced no output stream."
        return

    stderr_task = asyncio.create_task(_drain(process.stderr, stderr_chunks))
    # A stateful decoder: a UTF-8 sequence split across two reads would
    # otherwise be replaced with U+FFFD at both ends of the boundary, which
    # mangles every emoji and every non-Latin character the agents emit.
    decoder = codecs.getincrementaldecoder("utf-8")("replace")
    deadline = time.monotonic() + settings.chat_stream_timeout
    timed_out = False

    try:
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                timed_out = True
                break
            try:
                chunk = await asyncio.wait_for(
                    stdout.read(_READ_CHUNK), timeout=remaining
                )
            except asyncio.TimeoutError:
                timed_out = True
                break
            if not chunk:
                break
            text = decoder.decode(chunk)
            if text:
                yield text

        tail = decoder.decode(b"", final=True)
        if tail:
            yield tail

        if timed_out:
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
            if err_msg:
                yield _friendly_stderr(err_msg)
            else:
                yield f"\n\nThe agent exited with code {process.returncode}."

    except asyncio.CancelledError:
        # The client disconnected (they pressed Stop). Kill the child rather
        # than letting it run to completion against a quota nobody will read.
        logger.info("Chat stream cancelled; terminating the agent process")
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("Chat execution failed")
        yield f"\n\nExecution error: {exc}"
    finally:
        if not stderr_task.done():
            stderr_task.cancel()
        if process is not None and process.returncode is None:
            try:
                process.kill()
                await process.wait()
            except ProcessLookupError:
                pass

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

    for char in header:
        yield char
        if char in (".", "\n", "|"):
            await asyncio.sleep(0.01)

    if config.agent_id == "test-designer":
        response = _mock_test_designer_response(config.content)
    elif config.agent_id == "requirement-analyst":
        response = _mock_analyst_response(config.content)
    elif config.agent_id == "ocr-extractor":
        response = _mock_ocr_response(config.content)
    else:
        response = _mock_general_response(config.content)

    for i, char in enumerate(response):
        yield char
        if i % 3 == 0:
            await asyncio.sleep(0.005)

    yield (
        "\n\n---\n*Mock response — set `ENGINE=copilot` with a valid token "
        "for real GHCP generation.*"
    )


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
