"""Regression tests for the authorisation and containment fixes.

One test per finding that let an unauthenticated caller read a credential,
delete a directory, or execute code. These exist so none of them can come back
silently.
"""
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.services import hub_registry, job_service
from app.services.hub_registry import InvalidEntityId
# anonymous / reader / operator / author are role-scoped clients from conftest.


# ------------------------------------------------------------ authentication

@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/api/v1/hub/catalog"),
        ("get", "/api/v1/hub/agents"),
        ("get", "/api/v1/jobs"),
        ("get", "/api/v1/stats"),
        ("get", "/api/v1/settings"),
        ("get", "/api/v1/workflows"),
        ("post", "/api/v1/hub/agents"),
        ("delete", "/api/v1/hub/skills/test-case-generation"),
        ("post", "/api/v1/chat/sessions"),
        ("post", "/api/v1/jobs"),
        ("post", "/api/v1/ocr/extract"),
    ],
)
def test_endpoints_reject_anonymous_callers(anonymous, method, path):
    kwargs = {"json": {}} if method in ("post", "put") else {}
    response = getattr(anonymous, method)(path, **kwargs)
    # 401 before 422: authentication must be decided before the body is parsed,
    # or an unauthenticated caller learns the shape of the API from its errors.
    assert response.status_code == 401, f"{method.upper()} {path} was open"
    assert "bearer" in response.headers.get("www-authenticate", "").lower()


def test_health_stays_open_for_probes(anonymous):
    """A liveness probe cannot carry a credential."""
    assert anonymous.get("/api/v1/health").status_code == 200


def test_a_bad_token_is_rejected():
    bad = TestClient(app, headers={"Authorization": "Bearer not-a-real-token-at-all"})
    assert bad.get("/api/v1/hub/catalog").status_code == 401


# ------------------------------------------------------------- authorisation

def test_reader_cannot_write_to_the_registry(reader, author):
    """Registry content becomes an agent's system prompt, so writes need author."""
    response = reader.post(
        "/api/v1/hub/agents",
        json={"id": "zz-should-not-exist", "content": "---\nname: x\n---\n\nbody here"},
    )
    assert response.status_code == 403
    assert "author" in response.json()["detail"]
    assert reader.get("/api/v1/hub/agents/zz-should-not-exist").status_code == 404


def test_reader_cannot_submit_a_job(reader):
    response = reader.post(
        "/api/v1/jobs",
        json={"requirement": "x" * 40, "workflow": "test-case-generation"},
    )
    assert response.status_code == 403


def test_operator_cannot_write_to_the_registry(reader, operator):
    response = operator.delete("/api/v1/hub/skills/test-case-generation")
    assert response.status_code == 403
    # And the skill is still there.
    assert reader.get("/api/v1/hub/skills/test-case-generation").status_code == 200


# ------------------------------------------------------------- path handling

@pytest.mark.parametrize(
    "entity_id",
    ["..", "../etc", "....", "-leading-dash", "UPPER", "with space", "with/slash", ""],
)
def test_registry_rejects_unsafe_entity_ids(entity_id):
    """`skills/..` used to resolve to the hub root and get rmtree'd."""
    with pytest.raises(InvalidEntityId):
        hub_registry._safe_id(entity_id)


def test_delete_skill_cannot_escape_the_skills_directory():
    hub_root = settings.agent_hub_dir
    assert hub_root.is_dir(), "precondition: the hub exists"

    for attempt in ("..", "../agents", "../../backend"):
        with pytest.raises(InvalidEntityId):
            hub_registry.delete_skill(attempt)

    # Everything it might have deleted is still present.
    assert hub_root.is_dir()
    assert (hub_root / "agents").is_dir()
    assert (hub_root / "skills").is_dir()


def test_delete_skill_refuses_a_directory_that_is_not_a_skill():
    """rmtree only ever runs against a directory holding a SKILL.md."""
    stray = settings.agent_hub_dir / "skills" / "zz-not-a-skill"
    stray.mkdir(parents=True, exist_ok=True)
    try:
        assert hub_registry.delete_skill("zz-not-a-skill") is False
        assert stray.is_dir()
    finally:
        stray.rmdir()


def test_path_parameters_are_validated_at_the_route(author):
    """A malformed ID is a 400 from the router, never a filesystem operation."""
    for bad in ("UPPER", "-dash", "with.dot"):
        assert author.delete(f"/api/v1/hub/agents/{bad}").status_code == 422


# ------------------------------------------------------------- credentials

def test_a_job_credential_never_lands_in_the_workspace(operator):
    """The PAT used to be written to input/.copilot_token and served as an artifact."""
    response = operator.post(
        "/api/v1/jobs",
        json={
            "requirement": (
                "REQ-SEC-1 Credential handling\n\n"
                "The platform must never expose a user credential.\n"
                "- Tokens are held outside the artifact workspace.\n"
                "- Artifact listings exclude control files."
            ),
            "workflow": "test-case-generation",
            "github_token": "ghp_averysecretvalue123456",
            "engine": "mock",
        },
    )
    assert response.status_code == 201
    job_id = response.json()["job_id"]

    workspace = settings.workspace_for(job_id)
    leaked = [p for p in workspace.rglob("*") if "token" in p.name.lower()]
    assert leaked == [], f"credential written into the workspace: {leaked}"

    # It is reachable to the executor, just not through the API.
    runtime_token = settings.runtime_for(job_id) / "copilot_token"
    if runtime_token.exists():
        assert runtime_token.read_text().strip() == "ghp_averysecretvalue123456"

    listing = operator.get(f"/api/v1/jobs/{job_id}/artifacts")
    assert listing.status_code == 200
    assert all("token" not in item["path"] for item in listing.json())


def test_dotfiles_are_neither_listed_nor_downloadable(operator):
    """Defence in depth: even a hand-placed dotfile stays out of the API."""
    response = operator.post(
        "/api/v1/jobs",
        json={
            "requirement": (
                "REQ-SEC-2 Artifact visibility\n\n"
                "Only real output artifacts are downloadable.\n"
                "- Hidden control files are excluded from listings."
            ),
            "workflow": "test-case-generation",
            "engine": "mock",
        },
    )
    job_id = response.json()["job_id"]
    workspace = settings.workspace_for(job_id)
    (workspace / "input").mkdir(parents=True, exist_ok=True)
    (workspace / "input" / ".secret").write_text("should never be served")

    listing = operator.get(f"/api/v1/jobs/{job_id}/artifacts").json()
    assert all(".secret" not in item["path"] for item in listing)

    download = operator.get(f"/api/v1/jobs/{job_id}/artifacts/input/.secret")
    assert download.status_code == 404


@pytest.mark.parametrize(
    "relative,expected",
    [
        ("output/test_cases.json", True),
        ("input/requirement.md", True),
        (".copilot_token", False),
        ("input/.copilot_token", False),
        (".git/config", False),
        ("output/../.hidden", False),
    ],
)
def test_is_public_artifact(relative, expected):
    assert job_service.is_public_artifact(Path(relative)) is expected


# --------------------------------------------------------------- workflows

def test_an_unregistered_workflow_is_rejected_at_submit(operator):
    """It used to create a job that quietly ran the test-generation chain."""
    response = operator.post(
        "/api/v1/jobs",
        json={"requirement": "x" * 40, "workflow": "no-such-workflow"},
    )
    assert response.status_code == 400
    assert "no-such-workflow" in response.json()["detail"]


def test_an_unavailable_workflow_refuses_to_run(reader, operator):
    """Document OCR is catalogued but cannot work until its endpoint is repointed."""
    catalogued = {w["id"]: w for w in reader.get("/api/v1/workflows").json()}
    assert catalogued["document-extraction"]["available"] is False

    response = operator.post(
        "/api/v1/jobs",
        json={"requirement": "x" * 40, "workflow": "document-extraction"},
    )
    assert response.status_code == 409
    assert "retired" in response.json()["detail"].lower()


def test_settings_endpoint_is_read_only(operator):
    """Mutating the engine used to change it for every user on the process."""
    assert operator.post("/api/v1/settings", json={"engine": "mock"}).status_code == 405


def test_rate_limits_are_per_authenticated_principal(operator, monkeypatch):
    """The limit keys off the principal, not a caller-supplied created_by.

    Before, a client could send a different `created_by` on every request and
    never hit the per-user ceiling.
    """
    from app.config import settings as app_settings

    monkeypatch.setattr(app_settings, "max_concurrent_jobs_per_user", 0)
    response = operator.post(
        "/api/v1/jobs",
        json={
            "requirement": "x" * 40,
            "workflow": "test-case-generation",
            "created_by": "someone-else-entirely@example.com",
            "engine": "mock",
        },
    )
    assert response.status_code == 429
