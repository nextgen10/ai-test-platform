"""Normalising model output into the shape its schema declares.

An agent that produces substantively correct content and gets the *shape*
slightly wrong is the single most common way a run fails: `"testCases"` instead
of `"test_cases"`, `"P1"` instead of `"high"`, `"TC-1"` instead of `"TC-001"`, a
lone string where the contract wants a list, a helpful extra key on an object
the schema closed. None of these are disagreements about the answer. They are
transcription differences with exactly one sensible reading, and the schema
itself says what that reading is.

So they are fixed here, deterministically, before validation — the same
principle :func:`agent_io.repair_strings` applies to malformed JSON syntax,
carried up to the document's structure. What is left after this pass is a real
contract failure worth spending a model round on.

The rule for everything in this module: **only transform where the schema makes
the intent unambiguous.** A value that could plausibly mean two things is left
exactly as the agent wrote it and allowed to fail validation, because a wrong
guess that validates is worse than an honest error.
"""
from __future__ import annotations

import re
from typing import Any, Callable

#: Set by whichever runner imports this so notes land in the job log.
_log: Callable[[str], None] = lambda _msg: None


def set_logger(fn: Callable[[str], None]) -> None:
    global _log
    _log = fn


# ------------------------------------------------------------------ helpers

#: Keys the models reach for when they wrap the answer in an envelope. Only
#: unwrapped when the wrapper holds the whole document and the root does not.
_ENVELOPE_KEYS = ("result", "output", "data", "response", "document", "json", "content")

#: Enum values a model substitutes for another, where the intent is not in
#: doubt. Keyed by the normalised form of what the model wrote. Deliberately
#: short: every entry is a claim about what someone meant, and a wrong claim
#: here produces output that validates while saying the wrong thing.
_ENUM_SYNONYMS: dict[str, tuple[str, ...]] = {
    # test categories
    "positive": ("functional",),
    "happypath": ("functional",),
    "smoke": ("functional",),
    "edge": ("boundary",),
    "edgecase": ("boundary",),
    "limit": ("boundary",),
    "negativetest": ("negative",),
    "error": ("negative",),
    "errorhandling": ("negative",),
    "invalid": ("negative",),
    "datadriven": ("data",),
    "dataintegrity": ("data",),
    "fieldvalidation": ("validation",),
    "inputvalidation": ("validation",),
    # priorities
    "p0": ("critical",),
    "p1": ("high",),
    "p2": ("medium",),
    "p3": ("low",),
    "blocker": ("critical",),
    "urgent": ("critical",),
    "highest": ("critical",),
    "major": ("high",),
    "must": ("high",),
    "normal": ("medium",),
    "moderate": ("medium",),
    "should": ("medium",),
    "minor": ("low",),
    "trivial": ("low",),
    "could": ("low",),
    "lowest": ("low",),
    # where a business rule came from
    "explicit": ("stated",),
    "stated in requirement": ("stated",),
    "statedinrequirement": ("stated",),
    "documented": ("stated",),
    "assumed": ("inferred",),
    "implied": ("inferred",),
    "implicit": ("inferred",),
    "derived": ("inferred",),
    "reasoned": ("inferred",),
    # ratings
    "excellent": ("very_good",),
    "verygood": ("very_good",),
    "great": ("very_good",),
    "ok": ("average",),
    "okay": ("average",),
    "fair": ("average",),
    "medium": ("average",),
    "poor": ("bad",),
    "weak": ("bad",),
}


def _norm(value: str) -> str:
    """Casefold and strip punctuation, so `"Very Good"`, `"very-good"` and
    `"VERY_GOOD"` all reduce to the same key."""
    return re.sub(r"[^a-z0-9]", "", str(value).lower())


def _types(schema: dict[str, Any]) -> set[str]:
    declared = schema.get("type")
    if isinstance(declared, str):
        return {declared}
    if isinstance(declared, list):
        return {str(t) for t in declared}
    return set()


def _subschema(schema: dict[str, Any]) -> dict[str, Any]:
    """Flatten the one composition form worth following.

    A single-branch ``allOf`` is just the branch; anything with real choice
    (``anyOf``, ``oneOf``, multi-branch ``allOf``) is left alone, because
    picking a branch to coerce towards is exactly the kind of guess this module
    refuses to make.
    """
    branches = schema.get("allOf")
    if isinstance(branches, list) and len(branches) == 1 and isinstance(branches[0], dict):
        merged = {k: v for k, v in schema.items() if k != "allOf"}
        merged.update(branches[0])
        return merged
    return schema


# ----------------------------------------------------------------- coercions


class _Coercer:
    """Walks a document alongside its schema, recording every change made."""

    def __init__(self, *, drop_unknown: bool = True) -> None:
        self.notes: list[str] = []
        self.drop_unknown = drop_unknown

    def note(self, where: str, what: str) -> None:
        self.notes.append(f"{where or '(root)'}: {what}")

    # -- entry point

    def coerce(self, value: Any, schema: Any, where: str = "") -> Any:
        if not isinstance(schema, dict) or not schema:
            return value
        schema = _subschema(schema)

        if "enum" in schema:
            return self._enum(value, schema, where)

        types = _types(schema)
        if "object" in types or ("properties" in schema and not types):
            return self._object(value, schema, where)
        if "array" in types or ("items" in schema and not types):
            return self._array(value, schema, where)
        if "string" in types:
            return self._string(value, schema, where)
        if types & {"integer", "number"}:
            return self._number(value, types, where)
        if "boolean" in types:
            return self._boolean(value, where)
        return value

    # -- objects

    def _object(self, value: Any, schema: dict[str, Any], where: str) -> Any:
        properties = schema.get("properties")
        properties = properties if isinstance(properties, dict) else {}
        required = [r for r in schema.get("required", []) if isinstance(r, str)]

        value = self._unwrap_envelope(value, required, where)
        value = self._wrap_bare_array(value, schema, required, where)

        if not isinstance(value, dict):
            return value

        value = self._rename_keys(value, properties, where)

        result: dict[str, Any] = {}
        for key, item in value.items():
            child = f"{where}/{key}" if where else key
            subschema = properties.get(key)

            if subschema is None:
                extra = schema.get("additionalProperties")
                if extra is False and self.drop_unknown and key not in required:
                    self.note(where, f"dropped {key!r}, which the schema does not allow")
                    continue
                if isinstance(extra, dict):
                    item = self.coerce(item, extra, child)
                result[key] = item
                continue

            if item is None and key not in required:
                # A model writing `null` for something it had nothing to say
                # about means "absent"; the schema rarely allows null explicitly.
                if "null" not in _types(_subschema(subschema)):
                    self.note(where, f"dropped {key!r}, which was null")
                    continue

            result[key] = self.coerce(item, subschema, child)

        return result

    def _unwrap_envelope(self, value: Any, required: list[str], where: str) -> Any:
        """`{"result": {...}}` where the document itself was wanted."""
        if not isinstance(value, dict) or not required:
            return value
        if all(key in value for key in required):
            return value
        for key in _ENVELOPE_KEYS:
            inner = value.get(key)
            if isinstance(inner, dict) and all(r in inner for r in required):
                self.note(where, f"unwrapped the {key!r} envelope")
                return inner
        if len(value) == 1:
            (only_key, inner), = value.items()
            if isinstance(inner, dict) and all(r in inner for r in required):
                self.note(where, f"unwrapped the {only_key!r} envelope")
                return inner
        return value

    def _wrap_bare_array(
        self, value: Any, schema: dict[str, Any], required: list[str], where: str
    ) -> Any:
        """A bare list where the object was wanted, e.g. the test cases alone.

        Only when the schema leaves no choice about where the list belongs:
        exactly one required property, and it is an array.

        Deliberately not extended to schemas requiring several arrays. The
        test-case suite requires ``assumptions`` and ``test_cases`` both, and
        element type would single out the right one — but wrapping still leaves
        ``requirement_reference`` missing, so the document fails either way and
        the only thing gained is a guess to be wrong about.
        """
        if not isinstance(value, list) or len(required) != 1:
            return value
        key = required[0]
        target = schema.get("properties", {}).get(key)
        if isinstance(target, dict) and "array" in _types(_subschema(target)):
            self.note(where, f"wrapped a bare array as {key!r}")
            return {key: value}
        return value

    def _rename_keys(
        self, value: dict[str, Any], properties: dict[str, Any], where: str
    ) -> dict[str, Any]:
        """`testCases` -> `test_cases`, `Priority` -> `priority`.

        Matched on the punctuation-and-case-free form, and only when it names
        exactly one declared property that is not already present.
        """
        if not properties:
            return value
        by_norm: dict[str, list[str]] = {}
        for name in properties:
            by_norm.setdefault(_norm(name), []).append(name)

        renamed: dict[str, Any] = {}
        for key, item in value.items():
            if key not in properties:
                matches = by_norm.get(_norm(key), [])
                if len(matches) == 1 and matches[0] not in value:
                    self.note(where, f"renamed {key!r} to {matches[0]!r}")
                    renamed[matches[0]] = item
                    continue
            renamed[key] = item
        return renamed

    # -- arrays

    def _array(self, value: Any, schema: dict[str, Any], where: str) -> Any:
        items = schema.get("items")
        items = items if isinstance(items, dict) else {}

        if not isinstance(value, list):
            if value is None:
                # A *required* array written as null. `_object` already drops a
                # null optional as meaning "absent", but a required key cannot
                # be dropped, and the schema leaves one reading: an array with
                # nothing in it. `assumptions` is where this shows up — its own
                # description says "Empty array if none", and a model with no
                # assumptions to record writes null about half the time.
                #
                # Not attempted where the schema declares null a legal value in
                # its own right, nor where it demands at least one item: there,
                # an empty array is either a real answer already or still wrong,
                # and inventing one would only trade a true error for a subtler.
                if "null" not in _types(schema) and not schema.get("minItems"):
                    self.note(where, "read a null as the empty array the schema requires")
                    return []
                return value
            if isinstance(value, str) and "string" in _types(_subschema(items)):
                lines = _split_list_prose(value)
                if len(lines) > 1:
                    self.note(where, f"split a single string into {len(lines)} items")
                    return [self.coerce(line, items, where) for line in lines]
            if isinstance(value, (str, int, float, bool, dict)):
                self.note(where, "wrapped a single value as a one-item array")
                return [self.coerce(value, items, where)]
            return value

        return [self.coerce(item, items, f"{where}/{i}") for i, item in enumerate(value)]

    # -- scalars

    def _string(self, value: Any, schema: dict[str, Any], where: str) -> Any:
        if isinstance(value, list) and all(isinstance(v, str) for v in value):
            self.note(where, f"joined {len(value)} strings the schema wants as one")
            value = " ".join(v.strip() for v in value if v.strip())
        elif isinstance(value, bool):
            value = "true" if value else "false"
        elif isinstance(value, (int, float)):
            self.note(where, "rendered a number as the string the schema declares")
            value = str(value)

        if not isinstance(value, str):
            return value
        return self._pattern(value, schema, where)

    def _pattern(self, value: str, schema: dict[str, Any], where: str) -> str:
        """Zero-pad an identifier whose schema pins its width.

        Confined to the one pattern shape agents get wrong — `^TC-[0-9]{3,}$`
        and its relatives — because it is the only one where the correction is
        forced rather than chosen.
        """
        pattern = schema.get("pattern")
        if not isinstance(pattern, str) or re.fullmatch(pattern, value):
            return value
        shape = re.fullmatch(r"\^([A-Za-z]+-)\[0-9\]\{(\d+),?\d*\}\$", pattern)
        if not shape:
            return value
        prefix, width = shape.group(1), int(shape.group(2))
        digits = re.fullmatch(rf"\s*{re.escape(prefix)}?0*(\d+)\s*", value, re.I)
        if not digits:
            return value
        padded = f"{prefix}{int(digits.group(1)):0{width}d}"
        if padded != value and re.fullmatch(pattern, padded):
            self.note(where, f"renumbered {value!r} as {padded!r}")
            return padded
        return value

    def _number(self, value: Any, types: set[str], where: str) -> Any:
        if isinstance(value, bool) or not isinstance(value, str):
            return value
        text = value.strip().rstrip("%")
        try:
            number: Any = int(text) if "integer" in types else float(text)
        except ValueError:
            return value
        self.note(where, f"read {value!r} as the number the schema declares")
        return number

    def _boolean(self, value: Any, where: str) -> Any:
        if isinstance(value, bool) or not isinstance(value, str):
            return value
        lowered = value.strip().lower()
        if lowered in ("true", "yes"):
            self.note(where, f"read {value!r} as true")
            return True
        if lowered in ("false", "no"):
            self.note(where, f"read {value!r} as false")
            return False
        return value

    # -- enums

    def _enum(self, value: Any, schema: dict[str, Any], where: str) -> Any:
        options = schema.get("enum")
        if not isinstance(options, list) or value in options:
            return value
        if not isinstance(value, str):
            return value

        normalised = {_norm(o): o for o in options if isinstance(o, str)}
        key = _norm(value)

        if key in normalised:
            chosen = normalised[key]
            if chosen != value:
                self.note(where, f"matched {value!r} to {chosen!r}")
            return chosen

        for candidate in _ENUM_SYNONYMS.get(key, ()):
            if _norm(candidate) in normalised:
                chosen = normalised[_norm(candidate)]
                self.note(where, f"read {value!r} as {chosen!r}")
                return chosen
        return value


def _split_list_prose(text: str) -> list[str]:
    """Break prose the model wrote as one string back into list items.

    Newlines only, with list markers and `1.` numbering stripped. Sentence
    splitting is deliberately not attempted: a step containing "e.g." would be
    torn in half, and half a step is worse than one long one.
    """
    lines = [line.strip() for line in text.splitlines()]
    cleaned = [re.sub(r"^(?:[-*•]|\d+[.)])\s+", "", line) for line in lines if line]
    return [line for line in cleaned if line]


def coerce_to_schema(
    document: Any, schema: dict[str, Any] | None, *, drop_unknown: bool = True
) -> tuple[Any, list[str]]:
    """Normalise ``document`` towards ``schema``. Returns (document, notes).

    ``notes`` is empty when nothing needed changing, which is the common case
    for a well-behaved agent — the pass is free when it is not needed.
    """
    if not isinstance(schema, dict) or not schema:
        return document, []
    coercer = _Coercer(drop_unknown=drop_unknown)
    result = coercer.coerce(document, schema)
    return result, coercer.notes


# ---------------------------------------------------------------- one identity

# This module is reachable under two names: ``schema_coerce`` (the runner directory is
# on sys.path inside the container, and the backend adds it) and
# ``runner.schema_coerce`` (the test suite imports it as a package). Python treats
# those as two separate modules, each with its own copy of everything at module
# scope — so patching one leaves the other live, an exception raised through one
# is not caught by the other, and module-level state diverges silently.
#
# Registering both names against this single object removes the ambiguity:
# whichever name a caller uses, it gets this module.
import sys as _sys

for _alias in ("schema_coerce", "runner.schema_coerce"):
    _sys.modules.setdefault(_alias, _sys.modules[__name__])
