#!/usr/bin/env python3
"""Validate a generated test-case suite.

Runs three layers, in order, and stops at the first that fails:

    1. JSON parse
    2. JSON Schema validation (schemas/test-case.schema.json)
    3. Business validation + deterministic quality gate

Usage:
    python validate_output.py <test_cases.json> [--schema PATH] [--report PATH]

Exit codes:
    0  valid
    1  invalid (report written to --report if given)
    2  usage / file error
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter
from pathlib import Path
from typing import Any

try:
    from jsonschema import Draft7Validator
except ImportError:  # pragma: no cover - dependency is declared in requirements.txt
    Draft7Validator = None  # type: ignore[assignment]


# ---------------------------------------------------------------- quality gate

#: Deterministic thresholds. Kept out of the prompt on purpose (blueprint §45):
#: the model must not be able to negotiate its own pass criteria.
GATE = {
    "minimum_test_cases": int(os.getenv("GATE_MIN_TEST_CASES", "5")),
    "max_duplicate_rate": float(os.getenv("GATE_MAX_DUPLICATE_RATE", "0.10")),
    "min_steps_per_case": int(os.getenv("GATE_MIN_STEPS", "2")),
    "required_categories": int(os.getenv("GATE_REQUIRED_CATEGORIES", "3")),
}

VALID_CATEGORIES = {"functional", "negative", "boundary", "validation", "data"}
VALID_PRIORITIES = {"critical", "high", "medium", "low"}


class ValidationReport:
    """Accumulates failures across all validation layers."""

    def __init__(self) -> None:
        self.errors: list[dict[str, str]] = []
        self.warnings: list[dict[str, str]] = []
        self.stats: dict[str, Any] = {}

    def error(self, code: str, detail: str, where: str = "") -> None:
        self.errors.append({"code": code, "detail": detail, "where": where})

    def warn(self, code: str, detail: str, where: str = "") -> None:
        self.warnings.append({"code": code, "detail": detail, "where": where})

    @property
    def valid(self) -> bool:
        return not self.errors

    def to_dict(self) -> dict[str, Any]:
        return {
            "valid": self.valid,
            "errors": self.errors,
            "warnings": self.warnings,
            "stats": self.stats,
            "gate": GATE,
        }


def _normalize_title(title: str) -> str:
    return " ".join(title.lower().split())


def validate_business_rules(doc: dict[str, Any], report: ValidationReport) -> None:
    """Layer 3: semantic checks the JSON Schema cannot express."""
    cases = doc.get("test_cases", [])
    total = len(cases)

    # --- uniqueness of IDs
    ids = [c.get("id", "") for c in cases]
    for dup_id, count in Counter(ids).items():
        if count > 1:
            report.error("duplicate_id", f"ID {dup_id!r} used {count} times", dup_id)

    # --- per-case checks
    for index, case in enumerate(cases):
        where = case.get("id") or f"index[{index}]"

        if not (case.get("title") or "").strip():
            report.error("empty_title", "Title is empty", where)

        if not (case.get("expected_result") or "").strip():
            report.error("missing_expected_result", "Expected result is empty", where)

        steps = [s for s in case.get("steps", []) if str(s).strip()]
        if len(steps) < GATE["min_steps_per_case"]:
            report.error(
                "insufficient_steps",
                f"Has {len(steps)} non-empty step(s), gate requires "
                f"{GATE['min_steps_per_case']}",
                where,
            )

        if not [p for p in case.get("preconditions", []) if str(p).strip()]:
            report.error("missing_preconditions", "No non-empty precondition", where)

        category = str(case.get("category") or "").strip().lower()
        if category not in VALID_CATEGORIES:
            report.error("invalid_category", f"Category {case.get('category')!r} is not valid", where)

        priority = str(case.get("priority") or "").strip().lower()
        if priority not in VALID_PRIORITIES:
            report.error("invalid_priority", f"Priority {case.get('priority')!r} is not valid", where)

        if not (case.get("requirement_reference") or "").strip():
            report.error("orphan_requirement_reference", "No requirement reference", where)

    # --- traceability: every case reference must resolve to a known requirement
    suite_ref = (doc.get("requirement_reference") or "").strip()
    if suite_ref:
        known = {suite_ref}
        for case in cases:
            ref = (case.get("requirement_reference") or "").strip()
            if ref and ref not in known:
                report.warn(
                    "unknown_requirement_reference",
                    f"Case references {ref!r}, suite declares {suite_ref!r}",
                    case.get("id", ""),
                )

    # --- duplicate titles
    titles = [_normalize_title(c.get("title", "")) for c in cases if c.get("title")]
    duplicate_titles = {t: n for t, n in Counter(titles).items() if n > 1}
    duplicate_count = sum(n - 1 for n in duplicate_titles.values())
    duplicate_rate = (duplicate_count / total) if total else 0.0

    for title, count in duplicate_titles.items():
        report.warn("duplicate_title", f"Title appears {count} times: {title!r}")

    if duplicate_rate >= GATE["max_duplicate_rate"]:
        report.error(
            "duplicate_rate_exceeded",
            f"Duplicate title rate {duplicate_rate:.1%} >= gate "
            f"{GATE['max_duplicate_rate']:.0%}",
        )

    # --- suite-level gates
    if total < GATE["minimum_test_cases"]:
        report.error(
            "insufficient_test_cases",
            f"Suite has {total} case(s), gate requires {GATE['minimum_test_cases']}",
        )

    categories_present = {str(c.get("category") or "").strip().lower() for c in cases} & VALID_CATEGORIES
    if len(categories_present) < GATE["required_categories"]:
        report.error(
            "insufficient_category_coverage",
            f"Suite covers {len(categories_present)} categor(ies) "
            f"({', '.join(sorted(categories_present)) or 'none'}), gate requires "
            f"{GATE['required_categories']}",
        )

    report.stats = {
        "total": total,
        "by_category": dict(Counter(str(c.get("category") or "").strip().lower() for c in cases)),
        "by_priority": dict(Counter(str(c.get("priority") or "").strip().lower() for c in cases)),
        "duplicate_title_count": duplicate_count,
        "duplicate_rate": round(duplicate_rate, 4),
        "categories_covered": sorted(categories_present),
        "assumptions": len(doc.get("assumptions", []) or []),
    }


def validate_file(
    path: Path, schema_path: Path, kind: str = "test-cases"
) -> ValidationReport:
    report = ValidationReport()

    # --- Layer 1: parse
    try:
        raw = path.read_text(encoding="utf-8")
    except OSError as exc:
        report.error("unreadable_output", str(exc), str(path))
        return report

    try:
        doc = json.loads(raw)
    except json.JSONDecodeError as exc:
        report.error("invalid_json", f"{exc.msg} at line {exc.lineno} col {exc.colno}")
        return report

    if not isinstance(doc, dict):
        report.error("invalid_root", f"Root must be an object, got {type(doc).__name__}")
        return report

    # --- Layer 2: schema
    if Draft7Validator is None:
        report.warn("schema_skipped", "jsonschema not installed; schema layer skipped")
    else:
        try:
            schema = json.loads(schema_path.read_text(encoding="utf-8"))
        except OSError as exc:
            report.error("schema_unreadable", str(exc), str(schema_path))
            return report

        validator = Draft7Validator(schema)
        for err in sorted(validator.iter_errors(doc), key=lambda e: list(e.path)):
            location = "/".join(str(p) for p in err.path) or "<root>"
            report.error("schema_violation", err.message, location)

        if not report.valid:
            # Business rules assume a schema-shaped document; don't cascade noise.
            return report

    # --- Layer 3: business rules + gate. Only the test-case document has
    # semantic rules; the quality report and evaluation are schema-shaped only.
    if kind == "test-cases":
        validate_business_rules(doc, report)
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate a generated test-case suite.")
    parser.add_argument("output", type=Path, help="Path to test_cases.json")
    parser.add_argument(
        "--schema",
        type=Path,
        default=Path(os.getenv("SCHEMA_PATH", "/app/schemas/test-case.schema.json")),
        help="Path to the JSON Schema",
    )
    parser.add_argument("--report", type=Path, help="Write a JSON validation report here")
    parser.add_argument(
        "--kind",
        choices=["test-cases", "schema-only"],
        default="test-cases",
        help="test-cases applies the business rules and quality gate; "
             "schema-only stops after JSON Schema validation.",
    )
    args = parser.parse_args()

    if not args.output.exists():
        print(f"FAIL: output file not found: {args.output}", file=sys.stderr)
        return 2

    report = validate_file(args.output, args.schema, args.kind)

    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report.to_dict(), indent=2), encoding="utf-8")

    if report.valid:
        if args.kind != "test-cases":
            print(f"PASS: {args.output.name} conforms to {args.schema.name}")
            return 0
        stats = report.stats
        print(
            f"PASS: {stats.get('total', 0)} test cases, "
            f"categories={','.join(stats.get('categories_covered', []))}, "
            f"duplicate_rate={stats.get('duplicate_rate', 0):.1%}"
        )
        for warning in report.warnings:
            print(f"  warn [{warning['code']}] {warning['detail']}")
        return 0

    print(f"FAIL: {len(report.errors)} validation error(s)", file=sys.stderr)
    for err in report.errors:
        where = f" ({err['where']})" if err["where"] else ""
        print(f"  [{err['code']}]{where} {err['detail']}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
