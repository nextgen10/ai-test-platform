"""Turning a Copilot CLI failure into something a person can act on.

A run that dies because the account is out of quota and a run that dies because
the agent wrote bad JSON are the same thing to the orchestrator — a non-zero
exit — and were reported the same way: ``Runner exited with code 1``. That tells
the person watching nothing, and the reason is only in the log, which is the one
place they have to already suspect a problem to go looking.

The chat path has classified these for a while. Jobs did not, so the same
failure was legible in one half of the product and opaque in the other. This
module holds the classification so both halves agree.
"""
from __future__ import annotations

import re

#: Ordered because the patterns overlap: a quota message often mentions a token
#: too, and the quota reading is the more specific one.
_PATTERNS: list[tuple[re.Pattern[str], str, str]] = [
    (
        re.compile(r"exceeded your (monthly |premium )?quota|quota exceeded|rate limit", re.I),
        "Copilot quota exceeded",
        "The account behind this run has no requests left. Use a different "
        "GitHub token, wait for the quota to reset, or set ENGINE=mock to work "
        "offline.",
    ),
    (
        re.compile(r"not (logged in|authenticated)|unauthorized|401|invalid token|bad credentials", re.I),
        "Copilot authentication failed",
        "The GitHub token was missing, expired or lacks Copilot access. Supply "
        "one for this run, or configure one on the server.",
    ),
    (
        re.compile(r"copilot cli not found|command not found|no such file or directory.*copilot", re.I),
        "The Copilot CLI is not installed",
        "Install the CLI, point COPILOT_BIN at it, or set ENGINE=mock.",
    ),
    (
        re.compile(r"exceeded \d+s|timed? ?out", re.I),
        "The agent ran out of time",
        "Raise AGENT_TIMEOUT_SECONDS, or narrow the input so there is less work "
        "to do in one stage.",
    ),
    (
        re.compile(r"did not match its contract|was not written|invalid JSON", re.I),
        "The agent's output did not match its contract",
        "It was given a chance to correct itself and did not. The stage detail "
        "below quotes the exact validation failures.",
    ),
]


def diagnose(message: str) -> tuple[str, str] | None:
    """Classify a CLI failure as (headline, what to do), or None if unrecognised.

    Returning None rather than guessing is deliberate: an invented explanation
    for an unfamiliar failure sends someone down the wrong path, which is worse
    than handing them the raw message.
    """
    if not message:
        return None
    for pattern, headline, remedy in _PATTERNS:
        if pattern.search(message):
            return headline, remedy
    return None


def summarize(message: str, *, context: str = "") -> str:
    """One line for `job.error_message`, leading with the reason.

    `context` names where it happened — a stage or an agent — and is prefixed
    rather than appended so the reason is what a truncated column shows.
    """
    text = " ".join((message or "").split())
    diagnosis = diagnose(text)
    where = f" ({context})" if context else ""

    if diagnosis:
        headline, remedy = diagnosis
        return f"{headline}{where}. {remedy}"

    if not text:
        return f"The run failed{where} without reporting a reason."
    return f"{text[:400]}{where}"


def as_markdown(message: str) -> str:
    """The same classification, formatted for the chat transcript."""
    text = (message or "").strip()
    diagnosis = diagnose(text)
    if diagnosis:
        headline, remedy = diagnosis
        return f"\n\n> **{headline}**\n>\n> `{text}`\n>\n> {remedy}"
    return f"\n\n**The agent reported an error:**\n```\n{text}\n```"
