"""Reading, repairing and validating what an agent wrote.

This is the machinery that makes an agent run survive contact with a real model:
JSON that is substantively right but syntactically malformed gets repaired, what
cannot be repaired gets handed back to the agent with the specific failure, and
the result is checked against the contract the agent declares.

It lives here rather than inside ``agent_chain.py`` because every agent needs it,
not just the four in the test-generation chain. An agent onboarded as data gets
the same treatment as one that was hand-wired.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

try:
    import schema_coerce
except ImportError:  # pytest loads this as runner.agent_io
    from runner import schema_coerce  # type: ignore[no-redef]

# ------------------------------------------------------------------ logging

#: Injected by whichever runner imports this, so its output lands in the same
#: log stream the orchestrator's progress watcher is reading.
_log: Callable[[str], None] = print


def set_logger(fn: Callable[[str], None]) -> None:
    global _log
    _log = fn
    schema_coerce.set_logger(fn)


def log(message: str) -> None:
    _log(message)


# --------------------------------------------------------------- json repair

_JSON_ESCAPES = frozenset('"\\/bfnrtu')
_HEX = frozenset("0123456789abcdefABCDEF")
_CONTROL_ESCAPES = {"\n": "\\n", "\r": "\\r", "\t": "\\t", "\b": "\\b", "\f": "\\f"}


def repair_strings(raw: str) -> tuple[str, dict[str, int]]:
    """Fix the two ways agents malform JSON strings. Both have one reading.

    *Stray backslashes* — models write regexes and Windows paths into string
    values and under-escape them: ``\\d`` is a regex to the model but an illegal
    escape to JSON. JSON's escape set is closed, so a backslash opening no valid
    escape can only have been meant literally.

    Runs are normalised rather than patched one backslash at a time: the model
    that wrote ``\\\\\\d`` was aiming at a single literal backslash and simply
    over-doubled, so an odd run before an invalid escape collapses to two —
    which renders as the ``\\d`` the model meant. Even runs are already legal and
    are left untouched.

    *Raw control characters* — usually a newline the model let fall inside a
    string while formatting prose. JSON forbids these unescaped, so again there
    is exactly one thing they can have meant.

    Both are confined to string literals; structural whitespace between tokens
    is untouched.
    """
    out: list[str] = []
    in_string = False
    index = 0
    repairs = {"escape": 0, "control": 0}
    length = len(raw)

    while index < length:
        char = raw[index]

        if not in_string:
            in_string = char == '"'
            out.append(char)
            index += 1
            continue

        if char == '"':
            in_string = False
            out.append(char)
            index += 1
            continue

        if char != "\\":
            if ord(char) < 0x20:
                out.append(_CONTROL_ESCAPES.get(char, f"\\u{ord(char):04x}"))
                repairs["control"] += 1
            else:
                out.append(char)
            index += 1
            continue

        run_end = index
        while run_end < length and raw[run_end] == "\\":
            run_end += 1
        run = run_end - index
        following = raw[run_end] if run_end < length else ""

        # An even run is self-contained; only a trailing odd backslash can bind
        # to the next character and turn it into an escape.
        valid = following in _JSON_ESCAPES and not (
            following == "u" and not (
                len(raw[run_end + 1:run_end + 5]) == 4
                and all(c in _HEX for c in raw[run_end + 1:run_end + 5])
            )
        )

        if run % 2 == 0 or valid:
            out.append("\\" * run)
        else:
            out.append("\\\\")
            repairs["escape"] += 1

        index = run_end

    return "".join(out), repairs


def strip_fences(raw: str) -> str:
    """Drop ```json fences the agents are told not to emit but sometimes do."""
    text = raw.strip()
    if not text.startswith("```"):
        return raw
    lines = text.splitlines()
    if len(lines) < 2:
        return raw
    if lines[-1].strip().startswith("```"):
        lines = lines[:-1]
    return "\n".join(lines[1:])


def read_json(path: Path) -> dict[str, Any]:
    """Parse an agent's JSON artifact, repairing what has a single reading."""
    if not path.exists():
        raise RuntimeError(f"Expected artifact was not produced: {path}")

    raw = path.read_text(encoding="utf-8")
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        # Rebound deliberately: Python clears the `as` name when the block exits.
        first_error = exc

    # Salvage rather than discard: reaching here means an agent already spent
    # minutes producing content that is substantively fine but syntactically
    # malformed in a way with exactly one sensible reading.
    fenced = strip_fences(raw)
    candidate, repairs = repair_strings(fenced)
    try:
        document = json.loads(candidate)
    except json.JSONDecodeError:
        raise RuntimeError(
            f"Agent wrote invalid JSON to {path.name}: {first_error.msg} "
            f"(line {first_error.lineno}, column {first_error.colno})"
        ) from None

    fixed = [f"{count} {kind}" for kind, count in repairs.items() if count]
    if fenced != raw:
        fixed.append("Markdown fences")
    log(f"  repaired {path.name}: {', '.join(fixed) or 'trailing content'}")
    path.write_text(json.dumps(document, indent=2), encoding="utf-8")
    return document


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


# ------------------------------------------------------------- schema checks

@dataclass
class ContractResult:
    """Whether an agent honoured the contract it declares."""

    ok: bool
    #: Human-readable failures, ready to hand back to the agent verbatim.
    errors: list[str] = field(default_factory=list)
    #: What was checked, for the run record.
    checked: str = ""

    def as_feedback(self, limit: int = 8) -> str:
        """The failures, phrased for a model that has to fix them."""
        if not self.errors:
            return ""
        shown = self.errors[:limit]
        more = len(self.errors) - len(shown)
        lines = "\n".join(f"  - {e}" for e in shown)
        tail = f"\n  ...and {more} more." if more > 0 else ""
        return f"Your output did not match its contract:\n{lines}{tail}"


def _load_schema(schema_path: Path) -> dict[str, Any] | None:
    try:
        return json.loads(schema_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        log(f"  warning: could not read schema {schema_path}: {exc}")
        return None


def check_contract(artifact: Path, schema_path: Path | None) -> ContractResult:
    """Validate an artifact against the schema its agent declares.

    A missing schema is not a failure — plenty of agents legitimately produce
    prose. What matters is that when an agent *does* declare a contract, the
    platform enforces it rather than trusting the model.
    """
    if schema_path is None:
        return ContractResult(ok=True, checked="no schema declared")

    if not artifact.exists():
        return ContractResult(
            ok=False,
            errors=[f"The declared output artifact {artifact.name} was not written."],
            checked=schema_path.name,
        )

    if not schema_path.is_file():
        # Declared but absent: worth saying, but not worth failing a run over.
        log(f"  warning: declared schema not found at {schema_path}")
        return ContractResult(ok=True, checked=f"{schema_path.name} (missing)")

    try:
        document = read_json(artifact)
    except RuntimeError as exc:
        return ContractResult(ok=False, errors=[str(exc)], checked=schema_path.name)

    schema = _load_schema(schema_path)
    if schema is None:
        return ContractResult(ok=True, checked=f"{schema_path.name} (unreadable)")

    try:
        from jsonschema import Draft7Validator
    except ImportError:
        log("  note: jsonschema not installed; contract check limited to JSON validity")
        return ContractResult(ok=True, checked=f"{schema_path.name} (parser only)")

    validator = Draft7Validator(schema)
    errors = _errors(validator, document)
    if not errors:
        return ContractResult(ok=True, checked=schema_path.name)

    # The document is wrong somewhere. Before spending a model round on it, try
    # the corrections the schema itself makes unambiguous — a renamed key, a
    # value the schema wants as a list, an enum written in the wrong case. Most
    # "the agent failed" runs are one of these, and none of them need a model.
    coerced, notes = schema_coerce.coerce_to_schema(document, schema)
    if notes:
        coerced_errors = _errors(validator, coerced)
        if len(coerced_errors) < len(errors):
            artifact.write_text(json.dumps(coerced, indent=2), encoding="utf-8")
            log(f"  normalised {artifact.name} against {schema_path.name}:")
            for note in notes[:6]:
                log(f"    - {note}")
            if len(notes) > 6:
                log(f"    ...and {len(notes) - 6} more.")
            errors = coerced_errors

    return ContractResult(ok=not errors, errors=errors, checked=schema_path.name)


def _errors(validator: Any, document: Any) -> list[str]:
    """Validation failures as lines an agent can act on, most-shallow first."""
    return [
        f"{'/'.join(str(p) for p in error.path) or '(root)'}: {error.message}"
        for error in sorted(validator.iter_errors(document), key=lambda e: list(e.path))
    ]


# ---------------------------------------------------------- contract prompting

#: Rules that apply to every JSON artifact, restated in the prompt because the
#: schema cannot express them. Kept in one place so all four runners say the
#: same thing — an agent told different rules by different callers is exactly
#: how output stops being consistent.
_JSON_RULES = (
    "Write the file as strict JSON and nothing else: no Markdown fences, no "
    "prose before or after, no comments, no trailing commas. Inside string "
    "values escape every newline as \\n, every tab as \\t and every "
    "backslash as \\\\ — a regex like \\d must be written \\\\d. Use "
    "exactly the property names, types and enum values the contract lists, and "
    "add no properties it does not define."
)


def contract_prompt(schema_path: Path | None, *, max_chars: int = 8000) -> str:
    """The output contract, inlined into the prompt.

    Agents used to be *pointed* at their schema and told to read it. Every run
    where that read was denied or the file had not been staged produced an
    agent guessing at the shape, which is where inconsistent output comes from:
    the contract was only advisory at the moment the model needed it. Putting
    the schema in the prompt makes it unconditional — the model cannot fail to
    find it, and the prompt is identical on every attempt.

    A schema too large to inline is summarised down to what an agent actually
    has to get right: required properties, types, enums and patterns.
    """
    if schema_path is None or not schema_path.is_file():
        return ""

    schema = _load_schema(schema_path)
    if schema is None:
        return ""

    body = json.dumps(schema, separators=(",", ":"))
    if len(body) > max_chars:
        body = json.dumps(_summarize_schema(schema), indent=1)
        heading = "a summary of the JSON Schema your output must satisfy"
    else:
        heading = "the JSON Schema your output must satisfy, in full"

    return (
        f"\n\n--- OUTPUT CONTRACT ---\n"
        f"This is {heading} ({schema_path.name}). It is authoritative; you do "
        f"not need to look for it on disk.\n\n{body}\n\n{_JSON_RULES}"
    )


def _summarize_schema(schema: Any, depth: int = 0) -> Any:
    """Keep the parts of a schema an agent must obey, drop the prose.

    Descriptions, ``$id`` and ``title`` are what make a schema long and are the
    parts a model least needs — it already has the task. Constraints are what it
    gets wrong, so those are what survive.
    """
    if not isinstance(schema, dict):
        return schema
    if depth > 6:
        return "..."

    keep = (
        "type", "enum", "const", "required", "pattern", "format",
        "minItems", "maxItems", "minLength", "maxLength", "minimum", "maximum",
        "additionalProperties",
    )
    out: dict[str, Any] = {k: schema[k] for k in keep if k in schema}

    if isinstance(schema.get("properties"), dict):
        out["properties"] = {
            name: _summarize_schema(sub, depth + 1)
            for name, sub in schema["properties"].items()
        }
    if isinstance(schema.get("items"), dict):
        out["items"] = _summarize_schema(schema["items"], depth + 1)
    return out


def _schema_reminder(schema_path: Path | None) -> str:
    """A compact structural reminder for the correction prompt.

    The full contract is already in the original prompt. On a correction attempt
    what helps most is a concise restatement of the *counts and enum values* the
    agent got wrong, not the full schema again. This surfaces the most commonly
    mis-set constraints — array sizes and allowed string values — without
    repeating all the prose.
    """
    if schema_path is None or not schema_path.is_file():
        return ""

    schema = _load_schema(schema_path)
    if not isinstance(schema, dict):
        return ""

    reminders: list[str] = []

    def _walk(obj: Any, path: str = "") -> None:
        if not isinstance(obj, dict):
            return
        if "enum" in obj and isinstance(obj["enum"], list):
            reminders.append(
                f"  • {path or 'value'} must be one of: {', '.join(repr(v) for v in obj['enum'])}"
            )
        if "minItems" in obj or "maxItems" in obj:
            lo = obj.get("minItems", "")
            hi = obj.get("maxItems", "")
            if lo == hi and lo != "":
                reminders.append(f"  • {path or 'array'} must contain exactly {lo} items")
            elif lo and hi:
                reminders.append(f"  • {path or 'array'} must have {lo}–{hi} items")
            elif lo:
                reminders.append(f"  • {path or 'array'} must have at least {lo} items")
        if "required" in obj and isinstance(obj["required"], list):
            reminders.append(
                f"  • {path or 'object'} required fields: {', '.join(obj['required'])}"
            )
        if isinstance(obj.get("properties"), dict):
            for name, sub in obj["properties"].items():
                _walk(sub, f"{path}/{name}" if path else name)
        if isinstance(obj.get("items"), dict):
            _walk(obj["items"], f"{path}[]")

    _walk(schema)
    if not reminders:
        return ""
    return "Key constraints to satisfy:\n" + "\n".join(reminders[:20])


# ------------------------------------------------------- self-correcting run

#: How many times an agent may be asked to fix its own output before the stage
#: is called failed. Three gives two correction attempts: the first often fixes
#: the primary error but introduces a secondary one; the second cleans that up.
#: Returns fall off sharply after three so a fourth attempt is not worth the cost.
MAX_CONTRACT_ATTEMPTS = 3


class FatalAgentError(RuntimeError):
    """A failure no retry can fix — a bad token, a missing CLI, no quota.

    Raised by an ``invoke`` implementation to say "stop now". Everything else
    an invocation raises is treated as worth one more try, because most of what
    goes wrong between here and a model is a network that will be fine in three
    seconds.
    """


def run_with_contract(
    *,
    agent_id: str,
    prompt: str,
    artifact: Path,
    schema_path: Path | None,
    invoke: Callable[[str], Any],
    attempts: int = MAX_CONTRACT_ATTEMPTS,
) -> ContractResult:
    """Run an agent, then let it correct output that misses its contract.

    ``invoke`` takes the prompt and runs the agent; this function owns deciding
    whether what came back is acceptable and, if not, what to tell the agent.

    Three things make a stage survive a real model:

    * The contract goes **into** the prompt (see :func:`contract_prompt`), so
      the agent is never guessing at the shape it owes.
    * Output that misses in a way the schema makes unambiguous is corrected
      here, without a model round (see :mod:`schema_coerce`).
    * What is left is handed back to the agent with the specific failures. That
      costs one extra round against a run that has already spent minutes of
      real work — much cheaper than failing the stage, and the agent is the
      only thing that knows what it meant.

    An invocation that *raises* no longer takes the stage down with it: a
    dropped connection on attempt one is retried, and only a
    :class:`FatalAgentError` — or the last attempt — ends it.
    """
    contract = contract_prompt(schema_path)
    result = ContractResult(ok=False, errors=["Agent was never invoked."])
    total = max(1, attempts)

    for attempt in range(1, total + 1):
        hint = ""
        if attempt > 1:
            structured_reminder = _schema_reminder(schema_path)
            hint = (
                f"\n\n--- CORRECTION REQUIRED (attempt {attempt}/{total}) ---\n"
                f"Your previous output failed schema validation. Fix EVERY error below "
                f"before writing — a partial fix that introduces a new error still fails.\n\n"
                f"{result.as_feedback()}\n\n"
                f"{structured_reminder}\n\n"
                f"Overwrite {artifact.name} completely. Rules:\n"
                f"  • Emit strict JSON only — no Markdown fences, no prose before or after.\n"
                f"  • Inside string values, escape newlines as \\n, tabs as \\t, "
                f"backslashes as \\\\ (a regex \\d must be \\\\d).\n"
                f"  • Do not add, remove or rename top-level keys.\n"
                f"  • Satisfy every constraint listed above; do not fix one error by "
                f"introducing another."
            )

        try:
            invoke(prompt + contract + hint)
        except FatalAgentError:
            raise
        except Exception as exc:  # noqa: BLE001 - the next attempt may well work
            result = ContractResult(
                ok=False,
                errors=[f"The agent did not complete: {exc}"],
                checked=schema_path.name if schema_path else "no schema declared",
            )
            if attempt < total:
                log(f"  {agent_id}: invocation failed ({exc}) — retrying")
                continue
            log(f"  {agent_id}: invocation failed on the final attempt ({exc})")
            return result

        result = check_contract(artifact, schema_path)

        if result.ok:
            if attempt > 1:
                log(f"  {agent_id}: contract satisfied on attempt {attempt}")
            return result

        if attempt < total:
            first = result.errors[0] if result.errors else "unknown failure"
            log(f"  {agent_id}: output missed its contract ({first}) — asking it to fix")

    log(f"  {agent_id}: still not matching its contract after {total} attempts")
    return result


# ------------------------------------------------------------- token accounting

#: The Copilot CLI reports usage inconsistently across versions, so several
#: shapes are tried. Anything unrecognised simply yields no numbers rather than
#: a wrong one — a missing cost is honest, an invented one is not.
_USAGE_PATTERNS = [
    re.compile(r"(?:total\s+)?tokens?\s*[:=]\s*([\d,]+)", re.I),
    re.compile(r"(\d[\d,]*)\s+tokens?\s+used", re.I),
    re.compile(r"input[_\s]tokens?\s*[:=]\s*([\d,]+)", re.I),
    re.compile(r"output[_\s]tokens?\s*[:=]\s*([\d,]+)", re.I),
]


@dataclass
class Usage:
    """What one agent invocation consumed, as far as it can be determined."""

    input_tokens: int | None = None
    output_tokens: int | None = None
    total_tokens: int | None = None
    #: True when the numbers were estimated from character counts rather than
    #: reported by the CLI. Callers must not present an estimate as measured.
    estimated: bool = False

    def as_dict(self) -> dict[str, Any]:
        return {
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "total_tokens": self.total_tokens,
            "estimated": self.estimated,
        }


#: Rough characters-per-token for English prose and JSON. Only used for the
#: estimate path, and always flagged as an estimate.
_CHARS_PER_TOKEN = 4


def parse_usage(cli_output: str) -> Usage:
    """Pull token counts out of CLI output, if it reported any."""
    usage = Usage()

    for line in cli_output.splitlines():
        if "token" not in line.lower():
            continue
        for pattern in _USAGE_PATTERNS:
            match = pattern.search(line)
            if not match:
                continue
            value = int(match.group(1).replace(",", ""))
            lowered = pattern.pattern.lower()
            if "input" in lowered:
                usage.input_tokens = value
            elif "output" in lowered:
                usage.output_tokens = value
            else:
                usage.total_tokens = value

    if usage.total_tokens is None and (usage.input_tokens or usage.output_tokens):
        usage.total_tokens = (usage.input_tokens or 0) + (usage.output_tokens or 0)

    return usage


def estimate_usage(prompt: str, output: str) -> Usage:
    """Approximate usage when the CLI reported none.

    Explicitly flagged as an estimate: a run record that quietly mixes measured
    and guessed numbers is worse than one that admits which is which.
    """
    return Usage(
        input_tokens=max(1, len(prompt) // _CHARS_PER_TOKEN),
        output_tokens=max(1, len(output) // _CHARS_PER_TOKEN),
        total_tokens=max(1, (len(prompt) + len(output)) // _CHARS_PER_TOKEN),
        estimated=True,
    )


def usage_for(prompt: str, cli_output: str) -> Usage:
    """Reported usage if the CLI gave any, otherwise a flagged estimate."""
    reported = parse_usage(cli_output)
    if reported.total_tokens is not None:
        return reported
    return estimate_usage(prompt, cli_output)
