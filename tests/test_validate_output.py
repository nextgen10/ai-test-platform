import json
from pathlib import Path

import pytest

from runner.validate_output import validate_business_rules, validate_file, ValidationReport

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = PROJECT_ROOT / "schemas" / "test-case.schema.json"
QUALITY_SCHEMA_PATH = PROJECT_ROOT / "schemas" / "quality-report.schema.json"
EVAL_SCHEMA_PATH = PROJECT_ROOT / "schemas" / "evaluation.schema.json"


def valid_suite_payload():
    return {
        "requirement_reference": "REQ-101",
        "assumptions": ["Valid test suite"],
        "test_cases": [
            {
                "id": "TC-001",
                "title": "Primary happy path authentication",
                "category": "functional",
                "priority": "high",
                "preconditions": ["System is deployed"],
                "steps": ["Enter username", "Enter password", "Click Submit"],
                "expected_result": "User dashboard is displayed",
                "requirement_reference": "REQ-101",
            },
            {
                "id": "TC-002",
                "title": "Invalid password rejection",
                "category": "negative",
                "priority": "high",
                "preconditions": ["User exists"],
                "steps": ["Enter username", "Enter wrong password", "Click Submit"],
                "expected_result": "Error 'Invalid credentials' is shown",
                "requirement_reference": "REQ-101",
            },
            {
                "id": "TC-003",
                "title": "Password boundary 12 characters",
                "category": "boundary",
                "priority": "medium",
                "preconditions": ["Registration open"],
                "steps": ["Enter 12 char password", "Click register"],
                "expected_result": "Password accepted",
                "requirement_reference": "REQ-101",
            },
            {
                "id": "TC-004",
                "title": "Email format validation",
                "category": "validation",
                "priority": "medium",
                "preconditions": ["Form open"],
                "steps": ["Enter malformed email 'test@'", "Click Next"],
                "expected_result": "Validation error 'Invalid email format' displayed",
                "requirement_reference": "REQ-101",
            },
            {
                "id": "TC-005",
                "title": "Different data states across roles",
                "category": "data",
                "priority": "low",
                "preconditions": ["Admin and user accounts present"],
                "steps": ["Login as Admin", "Verify admin menu visible"],
                "expected_result": "Admin menu items are rendered",
                "requirement_reference": "REQ-101",
            },
        ],
    }


def test_validate_file_valid_suite(tmp_path):
    output_file = tmp_path / "test_cases.json"
    output_file.write_text(json.dumps(valid_suite_payload()), encoding="utf-8")

    report = validate_file(output_file, SCHEMA_PATH, kind="test-cases")
    assert report.valid is True
    assert len(report.errors) == 0
    assert report.stats["total"] == 5
    assert len(report.stats["categories_covered"]) == 5


def test_validate_file_insufficient_cases(tmp_path):
    doc = valid_suite_payload()
    doc["test_cases"] = doc["test_cases"][:2]  # Only 2 cases, gate requires 5
    output_file = tmp_path / "test_cases.json"
    output_file.write_text(json.dumps(doc), encoding="utf-8")

    report = validate_file(output_file, SCHEMA_PATH, kind="test-cases")
    assert report.valid is False
    assert any(e["code"] == "insufficient_test_cases" for e in report.errors)


def test_validate_file_duplicate_ids(tmp_path):
    doc = valid_suite_payload()
    doc["test_cases"][1]["id"] = "TC-001"  # duplicate ID
    output_file = tmp_path / "test_cases.json"
    output_file.write_text(json.dumps(doc), encoding="utf-8")

    report = validate_file(output_file, SCHEMA_PATH, kind="test-cases")
    assert report.valid is False
    assert any(e["code"] == "duplicate_id" for e in report.errors)


def test_validate_file_insufficient_steps(tmp_path):
    doc = valid_suite_payload()
    doc["test_cases"][0]["steps"] = ["Only one step"]
    output_file = tmp_path / "test_cases.json"
    output_file.write_text(json.dumps(doc), encoding="utf-8")

    report = validate_file(output_file, SCHEMA_PATH, kind="test-cases")
    assert report.valid is False
    # Schema check or business rule will fail
    assert len(report.errors) > 0


def test_quality_report_schema_validation(tmp_path):
    payload = {
        "requirement_reference": "REQ-001",
        "summary": "Summary of requirement",
        "criteria": [
            {"id": "independent", "name": "Independent", "rating": "good", "rationale": "Independent scope."},
            {"id": "negotiable", "name": "Negotiable", "rating": "good", "rationale": "Negotiable."},
            {"id": "valuable", "name": "Valuable", "rating": "good", "rationale": "Clear user value."},
            {"id": "estimable", "name": "Estimable", "rating": "good", "rationale": "Scope is clear."},
            {"id": "small", "name": "Small", "rating": "good", "rationale": "Single feature."},
            {"id": "testable", "name": "Testable", "rating": "good", "rationale": "Observable outcomes."},
            {"id": "acceptance_criteria", "name": "Acceptance Criteria", "rating": "good", "rationale": "Given/When/Then."},
            {"id": "unambiguous", "name": "Unambiguous", "rating": "good", "rationale": "No vague terms."},
        ],
        "overall": {"score": 3.0, "rating": "good", "verdict": "Ready for generation."},
        "blocking_issues": [],
        "missing_information": [],
    }
    output_file = tmp_path / "quality_report.json"
    output_file.write_text(json.dumps(payload), encoding="utf-8")

    report = validate_file(output_file, QUALITY_SCHEMA_PATH, kind="schema-only")
    assert report.valid is True


def test_evaluation_schema_validation(tmp_path):
    payload = {
        "requirement_reference": "REQ-001",
        "scores": [
            {"id": "coverage", "name": "Coverage", "score": 90, "rationale": "All categories present."},
            {"id": "completeness", "name": "Completeness", "score": 85, "rationale": "Steps are detailed."},
            {"id": "traceability", "name": "Traceability", "score": 100, "rationale": "All mapped to REQ-001."},
            {"id": "correctness", "name": "Correctness", "score": 90, "rationale": "Expected results valid."},
            {"id": "uniqueness", "name": "Uniqueness", "score": 95, "rationale": "No duplicates."},
        ],
        "overall": {"score": 91.0, "rating": "very_good", "verdict": "Solid test suite."},
        "gaps": [],
        "recommendations": [],
    }
    output_file = tmp_path / "evaluation.json"
    output_file.write_text(json.dumps(payload), encoding="utf-8")

    report = validate_file(output_file, EVAL_SCHEMA_PATH, kind="schema-only")
    assert report.valid is True
