"""Hub Registry API — CRUD endpoints for the Agent Hub catalog.

All entities live on disk under ``agent-hub/``; this router is a thin REST
facade over :mod:`app.services.hub_registry`.

Reads need the ``reader`` role.  Writes need ``author``: the Markdown written
here becomes the system prompt the Copilot CLI runs, so registry write access is
effectively execution access and is gated accordingly.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel, Field

from app.config import settings
from app.security import Principal, require_author, require_reader
from app.services import hub_registry
from app.services.hub_registry import DeniedTool, InvalidEntityId

router = APIRouter(prefix=f"{settings.api_prefix}/hub", tags=["hub"])

#: The shape an entity ID may take, applied to *path* parameters. The request
#: body is validated separately on create; these are the routes that take an ID
#: straight out of the URL.
_ID_PATTERN = r"^[a-z0-9][a-z0-9\-]*$"

#: An Annotated alias, not a bare `Path(...)` instance: FastAPI binds a Path
#: object to the first parameter name it sees, so sharing one instance across
#: routes makes every later route look for that first name.
EntityId = Annotated[
    str, Path(min_length=1, max_length=128, pattern=_ID_PATTERN)
]


# ----------------------------------------------------------------- schemas

class EntityCreateRequest(BaseModel):
    """Create or update an entity by ID + raw file content."""
    id: str = Field(..., min_length=1, max_length=128, pattern=_ID_PATTERN)
    content: str = Field(..., min_length=10, max_length=1_000_000)


class WorkflowCreateRequest(BaseModel):
    id: str = Field(..., min_length=1, max_length=128, pattern=_ID_PATTERN)
    content: str = Field(
        ..., min_length=10, max_length=1_000_000, description="Raw YAML content"
    )


def _bad_id(exc: InvalidEntityId) -> HTTPException:
    return HTTPException(400, str(exc))


# ================================================================== agents

@router.get("/agents")
def list_agents(_: Principal = Depends(require_reader)) -> list[dict]:
    return hub_registry.list_agents()


@router.get("/agents/{agent_id}")
def get_agent(
    agent_id: EntityId,
    _: Principal = Depends(require_reader),
) -> dict:
    try:
        agent = hub_registry.get_agent(agent_id)
    except InvalidEntityId as exc:
        raise _bad_id(exc) from exc
    if not agent:
        raise HTTPException(404, f"Agent '{agent_id}' not found")
    return agent


@router.post("/agents", status_code=201)
def create_agent(
    payload: EntityCreateRequest,
    _: Principal = Depends(require_author),
) -> dict:
    try:
        return hub_registry.create_agent(payload.id, payload.content)
    except InvalidEntityId as exc:
        raise _bad_id(exc) from exc
    except DeniedTool as exc:
        raise HTTPException(400, str(exc)) from exc
    except FileExistsError as exc:
        raise HTTPException(409, str(exc)) from exc


@router.put("/agents/{agent_id}")
def update_agent(
    agent_id: EntityId,
    payload: EntityCreateRequest,
    _: Principal = Depends(require_author),
) -> dict:
    try:
        return hub_registry.update_agent(agent_id, payload.content)
    except InvalidEntityId as exc:
        raise _bad_id(exc) from exc
    except DeniedTool as exc:
        raise HTTPException(400, str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc


@router.delete("/agents/{agent_id}")
def delete_agent(
    agent_id: EntityId,
    _: Principal = Depends(require_author),
) -> dict:
    try:
        deleted = hub_registry.delete_agent(agent_id)
    except InvalidEntityId as exc:
        raise _bad_id(exc) from exc
    if not deleted:
        raise HTTPException(404, f"Agent '{agent_id}' not found")
    return {"deleted": agent_id}


# ================================================================== skills

@router.get("/skills")
def list_skills(_: Principal = Depends(require_reader)) -> list[dict]:
    return hub_registry.list_skills()


@router.get("/skills/{skill_id}")
def get_skill(
    skill_id: EntityId,
    _: Principal = Depends(require_reader),
) -> dict:
    try:
        skill = hub_registry.get_skill(skill_id)
    except InvalidEntityId as exc:
        raise _bad_id(exc) from exc
    if not skill:
        raise HTTPException(404, f"Skill '{skill_id}' not found")
    return skill


@router.post("/skills", status_code=201)
def create_skill(
    payload: EntityCreateRequest,
    _: Principal = Depends(require_author),
) -> dict:
    try:
        return hub_registry.create_skill(payload.id, payload.content)
    except InvalidEntityId as exc:
        raise _bad_id(exc) from exc
    except FileExistsError as exc:
        raise HTTPException(409, str(exc)) from exc


@router.put("/skills/{skill_id}")
def update_skill(
    skill_id: EntityId,
    payload: EntityCreateRequest,
    _: Principal = Depends(require_author),
) -> dict:
    try:
        return hub_registry.update_skill(skill_id, payload.content)
    except InvalidEntityId as exc:
        raise _bad_id(exc) from exc
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc


@router.delete("/skills/{skill_id}")
def delete_skill(
    skill_id: EntityId,
    _: Principal = Depends(require_author),
) -> dict:
    try:
        deleted = hub_registry.delete_skill(skill_id)
    except InvalidEntityId as exc:
        raise _bad_id(exc) from exc
    if not deleted:
        raise HTTPException(404, f"Skill '{skill_id}' not found")
    return {"deleted": skill_id}


# ================================================================= prompts

@router.get("/prompts")
def list_prompts(_: Principal = Depends(require_reader)) -> list[dict]:
    return hub_registry.list_prompts()


@router.get("/prompts/{prompt_id}")
def get_prompt(
    prompt_id: EntityId,
    _: Principal = Depends(require_reader),
) -> dict:
    try:
        prompt = hub_registry.get_prompt(prompt_id)
    except InvalidEntityId as exc:
        raise _bad_id(exc) from exc
    if not prompt:
        raise HTTPException(404, f"Prompt '{prompt_id}' not found")
    return prompt


@router.post("/prompts", status_code=201)
def create_prompt(
    payload: EntityCreateRequest,
    _: Principal = Depends(require_author),
) -> dict:
    try:
        return hub_registry.create_prompt(payload.id, payload.content)
    except InvalidEntityId as exc:
        raise _bad_id(exc) from exc
    except FileExistsError as exc:
        raise HTTPException(409, str(exc)) from exc


@router.put("/prompts/{prompt_id}")
def update_prompt(
    prompt_id: EntityId,
    payload: EntityCreateRequest,
    _: Principal = Depends(require_author),
) -> dict:
    try:
        return hub_registry.update_prompt(prompt_id, payload.content)
    except InvalidEntityId as exc:
        raise _bad_id(exc) from exc
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc


@router.delete("/prompts/{prompt_id}")
def delete_prompt(
    prompt_id: EntityId,
    _: Principal = Depends(require_author),
) -> dict:
    try:
        deleted = hub_registry.delete_prompt(prompt_id)
    except InvalidEntityId as exc:
        raise _bad_id(exc) from exc
    if not deleted:
        raise HTTPException(404, f"Prompt '{prompt_id}' not found")
    return {"deleted": prompt_id}


# =============================================================== workflows

@router.get("/workflows")
def list_workflows(_: Principal = Depends(require_reader)) -> list[dict]:
    return hub_registry.list_workflows()


@router.get("/workflows/{workflow_id}")
def get_workflow(
    workflow_id: EntityId,
    _: Principal = Depends(require_reader),
) -> dict:
    try:
        wf = hub_registry.get_workflow(workflow_id)
    except InvalidEntityId as exc:
        raise _bad_id(exc) from exc
    if not wf:
        raise HTTPException(404, f"Workflow '{workflow_id}' not found")
    return wf


@router.post("/workflows", status_code=201)
def create_workflow(
    payload: WorkflowCreateRequest,
    _: Principal = Depends(require_author),
) -> dict:
    try:
        return hub_registry.create_workflow(payload.id, payload.content)
    except InvalidEntityId as exc:
        raise _bad_id(exc) from exc
    except FileExistsError as exc:
        raise HTTPException(409, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.put("/workflows/{workflow_id}")
def update_workflow(
    workflow_id: EntityId,
    payload: WorkflowCreateRequest,
    _: Principal = Depends(require_author),
) -> dict:
    try:
        return hub_registry.update_workflow(workflow_id, payload.content)
    except InvalidEntityId as exc:
        raise _bad_id(exc) from exc
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.delete("/workflows/{workflow_id}")
def delete_workflow(
    workflow_id: EntityId,
    _: Principal = Depends(require_author),
) -> dict:
    try:
        deleted = hub_registry.delete_workflow(workflow_id)
    except InvalidEntityId as exc:
        raise _bad_id(exc) from exc
    if not deleted:
        raise HTTPException(404, f"Workflow '{workflow_id}' not found")
    return {"deleted": workflow_id}


# ============================================================ unified catalog

@router.get("/catalog")
def get_catalog(_: Principal = Depends(require_reader)) -> dict:
    """Full catalog: all agents, skills, prompts, and workflows."""
    return hub_registry.get_catalog()


@router.get("/templates/{entity_type}")
def get_template(
    entity_type: str,
    _: Principal = Depends(require_reader),
) -> dict:
    """Starter content for a new entity of `entity_type`.

    The hub ships ``_template.*`` files for exactly this purpose; serving them
    means the onboarding form starts from a working skeleton rather than from a
    placeholder string the author has to retype.
    """
    templates = {
        "agent": ("agents", "_template.agent.md"),
        "workflow": ("workflows", "_template.workflow.yaml"),
        "prompt": ("prompts", "_template.prompt.md"),
    }
    if entity_type not in templates and entity_type != "skill":
        raise HTTPException(
            400,
            f"Unknown entity type {entity_type!r}. "
            f"Expected one of: agent, workflow, skill, prompt.",
        )

    if entity_type == "skill":
        # Skills are directories, so there is no _template file to read; this is
        # the minimal SKILL.md the loader accepts.
        return {
            "type": "skill",
            "content": (
                "---\n"
                "name: My Skill\n"
                "description: What this skill teaches an agent to do.\n"
                "---\n\n"
                "# My Skill\n\n"
                "## When to use this\n\n"
                "Describe the situations this skill applies to.\n\n"
                "## Instructions\n\n"
                "1. Step one\n"
                "2. Step two\n\n"
                "## Output contract\n\n"
                "Describe exactly what the agent must produce.\n"
            ),
        }

    subdir, filename = templates[entity_type]
    path = settings.agent_hub_dir / subdir / filename
    if not path.is_file():
        raise HTTPException(404, f"No template found at agent-hub/{subdir}/{filename}")
    return {"type": entity_type, "content": path.read_text(encoding="utf-8")}


@router.get("/models")
def list_models(_: Principal = Depends(require_reader)) -> list[dict]:
    """Available GHCP models — delegates to the existing model list."""
    from app.schemas.jobs import AVAILABLE_MODELS
    return AVAILABLE_MODELS
