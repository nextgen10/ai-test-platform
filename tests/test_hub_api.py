"""Tests for the Agent Hub registry endpoints."""
# `reader` and `author` are the role-scoped clients from conftest.


def test_list_agents(reader):
    res = reader.get("/api/v1/hub/agents")
    assert res.status_code == 200
    agents = res.json()
    assert isinstance(agents, list)
    assert len(agents) >= 7
    ids = {a["id"] for a in agents}
    assert "test-designer" in ids
    assert "requirement-analyst" in ids
    assert "ocr-extractor" in ids


def test_get_agent(reader):
    res = reader.get("/api/v1/hub/agents/test-designer")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == "test-designer"
    assert "tools" in data
    assert "content" in data


def test_agent_describes_its_own_role(reader):
    """Role, stage and artifacts come from frontmatter, not a table in the API.

    An agent onboarded through the Registry has to describe itself, or the
    legacy /agents view has to be edited in code for every new agent.
    """
    res = reader.get("/api/v1/hub/agents/test-designer")
    data = res.json()
    assert data["role"] == "QA Architect & Scenario Strategist"
    assert data["stage"] == "design"
    assert data["input_artifact"] == "input/requirement.md"
    assert data["output_artifact"] == "intermediate/test_design.json"


def test_list_workflows(reader):
    res = reader.get("/api/v1/hub/workflows")
    assert res.status_code == 200
    workflows = res.json()
    assert isinstance(workflows, list)
    ids = {w["id"] for w in workflows}
    assert "test-case-generation" in ids


def test_workflow_carries_its_raw_yaml(reader):
    """The Registry previews the definition, so it needs the source, not JSON."""
    res = reader.get("/api/v1/hub/workflows/test-case-generation")
    assert res.status_code == 200
    data = res.json()
    assert data["content"].lstrip().startswith("id: test-case-generation")
    assert data["runner"] == "bespoke"
    assert data["approval_gate"] is True


def test_list_skills(reader):
    res = reader.get("/api/v1/hub/skills")
    assert res.status_code == 200
    ids = {s["id"] for s in res.json()}
    assert "test-case-generation" in ids


def test_list_prompts(reader):
    res = reader.get("/api/v1/hub/prompts")
    assert res.status_code == 200
    ids = {p["id"] for p in res.json()}
    assert "code-review" in ids


def test_catalog_unified(reader):
    res = reader.get("/api/v1/hub/catalog")
    assert res.status_code == 200
    cat = res.json()
    assert "agents" in cat
    assert "workflows" in cat
    assert "skills" in cat
    assert "prompts" in cat


def test_templates_are_served_for_every_entity_type(reader):
    """The onboarding form starts from these, so a missing one is a broken form."""
    for entity_type in ("agent", "workflow", "skill", "prompt"):
        res = reader.get(f"/api/v1/hub/templates/{entity_type}")
        assert res.status_code == 200, entity_type
        assert len(res.json()["content"]) > 50, entity_type

    assert reader.get("/api/v1/hub/templates/nonsense").status_code == 400


# ------------------------------------------------------------------ CRUD

AGENT_BODY = """---
name: temp-test-agent
description: A throwaway agent used by the test suite.
tools: ["read"]
---

# Temp Test Agent

Does nothing in particular.
"""


def test_agent_crud_round_trip(reader, author):
    """Create, read, update, delete — the flow the Registry UI now drives."""
    agent_id = "zz-temp-test-agent"
    author.delete(f"/api/v1/hub/agents/{agent_id}")  # leftover from a failed run

    created = author.post(
        "/api/v1/hub/agents", json={"id": agent_id, "content": AGENT_BODY}
    )
    assert created.status_code == 201
    assert created.json()["id"] == agent_id

    # Creating it twice is a conflict, not a silent overwrite.
    assert author.post(
        "/api/v1/hub/agents", json={"id": agent_id, "content": AGENT_BODY}
    ).status_code == 409

    updated = author.put(
        f"/api/v1/hub/agents/{agent_id}",
        json={"id": agent_id, "content": AGENT_BODY.replace("nothing", "something")},
    )
    assert updated.status_code == 200
    assert "something" in updated.json()["content"]

    assert author.delete(f"/api/v1/hub/agents/{agent_id}").status_code == 200
    assert reader.get(f"/api/v1/hub/agents/{agent_id}").status_code == 404
    assert author.delete(f"/api/v1/hub/agents/{agent_id}").status_code == 404


def test_workflow_referencing_an_unknown_agent_is_rejected(reader, author):
    """Catch it at write time, not halfway through a run."""
    res = author.post(
        "/api/v1/hub/workflows",
        json={
            "id": "zz-broken-workflow",
            "content": (
                "id: zz-broken-workflow\n"
                "name: Broken\n"
                "agents:\n"
                "  - id: no-such-agent\n"
                "    stage: nowhere\n"
            ),
        },
    )
    assert res.status_code == 400
    assert "no-such-agent" in res.json()["detail"]
    # And nothing was left behind on disk.
    assert reader.get("/api/v1/hub/workflows/zz-broken-workflow").status_code == 404


def test_workflow_id_must_match_its_filename(author):
    res = author.post(
        "/api/v1/hub/workflows",
        json={
            "id": "zz-mismatch",
            "content": "id: something-else\nname: X\nagents:\n  - id: test-designer\n    stage: s\n",
        },
    )
    assert res.status_code == 400
