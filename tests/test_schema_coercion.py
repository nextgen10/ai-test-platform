"""The deterministic half of "the agent's output is consistent".

Every case here is a real shape a model produces when it understands the task
and gets the transcription wrong. None of them should cost a model round, and
none of them should fail a run.
"""
import json
from pathlib import Path

import pytest

from runner import agent_io
from runner.schema_coerce import coerce_to_schema

ROOT = Path(__file__).resolve().parents[1]
TEST_CASE_SCHEMA = json.loads(
    (ROOT / "schemas" / "test-case.schema.json").read_text(encoding="utf-8")
)


def _case(**overrides):
    case = {
        "id": "TC-001",
        "title": "User resets a password with a registered email",
        "category": "functional",
        "priority": "high",
        "preconditions": ["The account exists"],
        "steps": ["Open the reset page", "Submit the registered email"],
        "expected_result": "A reset link is sent to the registered address.",
        "requirement_reference": "REQ-042",
    }
    case.update(overrides)
    return case


def _suite(*cases):
    return {
        "requirement_reference": "REQ-042",
        "assumptions": [],
        "test_cases": list(cases) or [_case()],
    }


def _validate(document):
    from jsonschema import Draft7Validator

    return [e.message for e in Draft7Validator(TEST_CASE_SCHEMA).iter_errors(document)]


# ----------------------------------------------------------------- the shapes


def test_valid_output_is_left_exactly_as_written():
    document = _suite()
    result, notes = coerce_to_schema(json.loads(json.dumps(document)), TEST_CASE_SCHEMA)
    assert notes == []
    assert result == document


def test_camel_case_keys_are_renamed_to_what_the_schema_declares():
    document = {"requirementReference": "REQ-042", "assumptions": [], "testCases": [_case()]}
    result, notes = coerce_to_schema(document, TEST_CASE_SCHEMA)
    assert _validate(result) == []
    assert any("testCases" in n for n in notes)


def test_a_bare_array_of_cases_is_wrapped_under_the_only_array_property():
    schema = {
        "type": "object",
        "required": ["test_cases"],
        "properties": {"test_cases": {"type": "array", "items": {"type": "object"}}},
    }
    result, notes = coerce_to_schema([_case()], schema)
    assert result == {"test_cases": [_case()]}
    assert any("bare array" in n for n in notes)


def test_an_envelope_around_the_document_is_unwrapped():
    document = {"result": _suite()}
    result, _ = coerce_to_schema(document, TEST_CASE_SCHEMA)
    assert _validate(result) == []


def test_enum_values_are_matched_case_and_punctuation_insensitively():
    document = _suite(_case(category="Functional", priority="HIGH"))
    result, notes = coerce_to_schema(document, TEST_CASE_SCHEMA)
    assert result["test_cases"][0]["category"] == "functional"
    assert result["test_cases"][0]["priority"] == "high"
    assert _validate(result) == []


@pytest.mark.parametrize(
    "written,expected",
    [("P1", "high"), ("P0", "critical"), ("Blocker", "critical"), ("minor", "low")],
)
def test_priority_synonyms_a_model_reaches_for_are_understood(written, expected):
    document = _suite(_case(priority=written))
    result, _ = coerce_to_schema(document, TEST_CASE_SCHEMA)
    assert result["test_cases"][0]["priority"] == expected


@pytest.mark.parametrize(
    "written,expected",
    [("positive", "functional"), ("edge case", "boundary"), ("error handling", "negative")],
)
def test_category_synonyms_are_understood(written, expected):
    document = _suite(_case(category=written))
    result, _ = coerce_to_schema(document, TEST_CASE_SCHEMA)
    assert result["test_cases"][0]["category"] == expected


def test_an_unrecognised_enum_value_is_left_alone_to_fail():
    """A guess that validates is worse than an honest error."""
    document = _suite(_case(category="performance"))
    result, _ = coerce_to_schema(document, TEST_CASE_SCHEMA)
    assert result["test_cases"][0]["category"] == "performance"
    assert _validate(result)


def test_identifiers_are_padded_to_the_width_the_pattern_pins():
    document = _suite(_case(id="TC-1"))
    result, notes = coerce_to_schema(document, TEST_CASE_SCHEMA)
    assert result["test_cases"][0]["id"] == "TC-001"
    assert any("TC-001" in n for n in notes)


def test_a_lone_string_becomes_the_list_the_schema_asked_for():
    document = _suite(_case(preconditions="The account exists"))
    result, _ = coerce_to_schema(document, TEST_CASE_SCHEMA)
    assert result["test_cases"][0]["preconditions"] == ["The account exists"]


def test_steps_written_as_one_block_are_split_back_into_items():
    document = _suite(_case(steps="1. Open the reset page\n2. Submit the email"))
    result, _ = coerce_to_schema(document, TEST_CASE_SCHEMA)
    assert result["test_cases"][0]["steps"] == [
        "Open the reset page",
        "Submit the email",
    ]


def test_a_list_where_the_schema_wants_one_string_is_joined():
    document = _suite(_case(expected_result=["A link is sent.", "The page confirms."]))
    result, _ = coerce_to_schema(document, TEST_CASE_SCHEMA)
    assert result["test_cases"][0]["expected_result"] == (
        "A link is sent. The page confirms."
    )
    assert _validate(result) == []


def test_properties_a_closed_schema_forbids_are_dropped():
    schema = {
        "type": "object",
        "required": ["test_cases"],
        "additionalProperties": False,
        "properties": {"test_cases": {"type": "array", "items": {"type": "object"}}},
    }
    result, notes = coerce_to_schema(
        {"test_cases": [], "notes": "helpful extra"}, schema
    )
    assert "notes" not in result
    assert any("notes" in n for n in notes)


def test_a_null_written_for_an_absent_optional_is_dropped():
    document = _suite()
    document["requirement_reference"] = None
    schema = json.loads(json.dumps(TEST_CASE_SCHEMA))
    schema["required"] = ["test_cases"]
    result, _ = coerce_to_schema(document, schema)
    assert "requirement_reference" not in result


def test_numbers_written_as_strings_are_read_as_numbers():
    schema = {"type": "object", "properties": {"score": {"type": "integer"}}}
    result, _ = coerce_to_schema({"score": "4"}, schema)
    assert result["score"] == 4


def test_a_branching_schema_is_left_alone():
    """anyOf/oneOf means the schema itself does not say which shape was meant."""
    schema = {"anyOf": [{"type": "string"}, {"type": "integer"}]}
    result, notes = coerce_to_schema("7", schema)
    assert result == "7"
    assert notes == []


# ----------------------------------------------- the loop that uses all this


def test_check_contract_fixes_what_it_can_and_rewrites_the_artifact(tmp_path):
    artifact = tmp_path / "draft_test_cases.json"
    artifact.write_text(
        json.dumps(
            {
                "requirementReference": "REQ-042",
                "assumptions": [],
                "testCases": [_case(id="TC-7", category="Positive", priority="P1")],
            }
        ),
        encoding="utf-8",
    )

    result = agent_io.check_contract(artifact, ROOT / "schemas" / "test-case.schema.json")

    assert result.ok, result.errors
    written = json.loads(artifact.read_text(encoding="utf-8"))
    assert written["test_cases"][0]["id"] == "TC-007"
    assert written["test_cases"][0]["category"] == "functional"
    assert written["test_cases"][0]["priority"] == "high"


def test_check_contract_still_fails_output_that_is_genuinely_wrong(tmp_path):
    artifact = tmp_path / "draft_test_cases.json"
    artifact.write_text(json.dumps({"test_cases": []}), encoding="utf-8")

    result = agent_io.check_contract(artifact, ROOT / "schemas" / "test-case.schema.json")

    assert not result.ok
    assert result.errors


def test_the_contract_is_inlined_into_the_prompt():
    prompt = agent_io.contract_prompt(ROOT / "schemas" / "test-case.schema.json")
    assert "OUTPUT CONTRACT" in prompt
    assert "test_cases" in prompt
    assert "you do not need to look for it on disk" in prompt


def test_a_missing_schema_contributes_nothing_to_the_prompt(tmp_path):
    assert agent_io.contract_prompt(None) == ""
    assert agent_io.contract_prompt(tmp_path / "absent.json") == ""


def test_an_oversized_schema_is_summarised_rather_than_dropped(tmp_path):
    schema = tmp_path / "big.schema.json"
    schema.write_text(
        json.dumps(
            {
                "type": "object",
                "required": ["name"],
                "properties": {
                    "name": {"type": "string", "description": "x" * 9000},
                    "kind": {"type": "string", "enum": ["a", "b"]},
                },
            }
        ),
        encoding="utf-8",
    )
    prompt = agent_io.contract_prompt(schema, max_chars=500)
    assert "a summary of the JSON Schema" in prompt
    assert '"enum"' in prompt
    assert "x" * 100 not in prompt


# ------------------------------------------------- the design contract's enums

DESIGN_SCHEMA = json.loads(
    (ROOT / "schemas" / "test-design.schema.json").read_text(encoding="utf-8")
)


@pytest.mark.parametrize(
    "written,expected",
    [
        ("assumed", "inferred"),
        ("implied", "inferred"),
        ("derived", "inferred"),
        ("explicit", "stated"),
        ("Stated", "stated"),
    ],
)
def test_a_business_rule_source_is_read_as_one_of_the_two_the_schema_allows(
    written, expected
):
    """The enum is 'stated' or 'inferred'. Models reach for near-synonyms, and
    the distinction they were making is preserved by every one of them."""
    document = {
        "scenarios": [{"id": "SC-1", "description": "x", "category": "functional"}],
        "business_rules": [{"id": "BR-1", "rule": "Links expire.", "source": written}],
    }
    result, _ = coerce_to_schema(document, DESIGN_SCHEMA)
    assert result["business_rules"][0]["source"] == expected


def test_a_null_written_for_a_required_array_becomes_the_empty_array():
    """`assumptions: null` is the commonest way a good suite fails its contract.

    The key is required, so it cannot be dropped the way an optional null is,
    and the schema's own description for it reads "Empty array if none" — so a
    model with nothing to record has written the one thing null can mean here.
    """
    document = _suite()
    document["assumptions"] = None
    assert _validate(document)

    result, notes = coerce_to_schema(document, TEST_CASE_SCHEMA)

    assert result["assumptions"] == []
    assert _validate(result) == []
    assert any("assumptions" in n for n in notes)


def test_a_null_is_not_invented_into_an_array_that_must_hold_something():
    """`minItems` means an empty array is still wrong, so nothing is gained.

    Coercing here would trade an honest "null is not an array" for a subtler
    "[] is too short", and hide that the agent produced no cases at all.
    """
    document = _suite()
    document["test_cases"] = None

    result, _ = coerce_to_schema(document, TEST_CASE_SCHEMA)

    assert result["test_cases"] is None


def test_a_null_is_left_alone_where_the_schema_allows_one():
    schema = {
        "type": "object",
        "required": ["notes"],
        "properties": {"notes": {"type": ["array", "null"], "items": {"type": "string"}}},
    }
    result, notes = coerce_to_schema({"notes": None}, schema)
    assert result["notes"] is None
    assert notes == []
