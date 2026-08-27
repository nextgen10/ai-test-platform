"""Agent Hub registry service.

Reads the ``agent-hub/`` directory tree and provides CRUD operations for agents,
skills, prompts, and workflows.  Every entity is a file on disk — the database
is the filesystem itself.  Frontmatter (YAML between ``---`` fences) carries
metadata; the body is the content.

Entity IDs become filesystem paths, so every public function validates its ID
and resolves the target under its own directory.  Validating only the request
body on create is not enough: the read, update and delete routes take the ID
from the URL path, where nothing else constrains it.
"""
from __future__ import annotations

import re
import shutil
from pathlib import Path
from typing import Any

import yaml

from app.config import settings


# ------------------------------------------------------------------- safety

#: The one shape an entity ID may take. Mirrors the pattern on
#: ``EntityCreateRequest.id`` so body-validated and path-supplied IDs agree.
_SAFE_ID = re.compile(r"^[a-z0-9][a-z0-9-]*$")

_MAX_ID_LEN = 128


class InvalidEntityId(ValueError):
    """An entity ID was missing, malformed, or could escape its directory."""


def _safe_id(entity_id: str) -> str:
    """Reject anything that is not a plain kebab-case identifier.

    ``..`` is the case that matters: ``skills/..`` resolves to the hub root, and
    ``delete_skill`` calls ``shutil.rmtree`` on whatever it is handed.
    """
    if not entity_id or len(entity_id) > _MAX_ID_LEN or not _SAFE_ID.fullmatch(entity_id):
        raise InvalidEntityId(
            f"Invalid entity id {entity_id!r}: expected kebab-case "
            f"[a-z0-9][a-z0-9-]* of at most {_MAX_ID_LEN} characters"
        )
    return entity_id


def _contained(base: Path, *parts: str) -> Path:
    """Resolve ``parts`` under ``base``, refusing any result outside it.

    Belt and braces behind :func:`_safe_id` — a validated ID cannot escape, but
    this holds even if a future caller reaches these helpers by another route.
    """
    base_resolved = base.resolve()
    target = (base_resolved / Path(*parts)).resolve()
    if not target.is_relative_to(base_resolved):
        raise InvalidEntityId(f"Path {target} escapes {base_resolved}")
    return target


# ------------------------------------------------------------------- helpers

def _parse_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    """Split ``---`` YAML frontmatter from the Markdown body.

    Returns (metadata_dict, body_str).  If no frontmatter is present the
    metadata dict is empty.
    """
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n?(.*)", text, re.DOTALL)
    if match:
        try:
            meta = yaml.safe_load(match.group(1)) or {}
        except yaml.YAMLError:
            meta = {}
        if not isinstance(meta, dict):
            meta = {}
        return meta, match.group(2)
    return {}, text


def _display_name(slug: str) -> str:
    """``test-designer`` → ``Test Designer``, with common acronym fixes."""
    _FIXES = {"Ocr": "OCR", "Ghcp": "GHCP", "Ui": "UI", "Api": "API"}
    name = slug.replace("-", " ").title()
    for mangled, fixed in _FIXES.items():
        name = re.sub(rf"\b{mangled}\b", fixed, name)
    return name


def _safe_slug(name: str) -> str:
    """Turn a human-readable name into a safe kebab-case slug."""
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "unnamed"


# ------------------------------------------------------------------- paths

def _hub_root() -> Path:
    return settings.agent_hub_dir


def _agents_dir() -> Path:
    return _hub_root() / "agents"


def _skills_dir() -> Path:
    return _hub_root() / "skills"


def _prompts_dir() -> Path:
    return _hub_root() / "prompts"


def _workflows_dir() -> Path:
    return _hub_root() / "workflows"


# =================================================================== agents

def list_agents() -> list[dict[str, Any]]:
    """Return metadata for every ``*.agent.md`` file (excluding templates)."""
    agents: list[dict[str, Any]] = []
    d = _agents_dir()
    if not d.exists():
        return agents

    for path in sorted(d.glob("*.agent.md")):
        if path.name.startswith("_"):
            continue
        agents.append(_read_agent(path))
    return agents


def get_agent(agent_id: str) -> dict[str, Any] | None:
    path = _contained(_agents_dir(), f"{_safe_id(agent_id)}.agent.md")
    if not path.is_file():
        return None
    return _read_agent(path)


def create_agent(agent_id: str, content: str) -> dict[str, Any]:
    """Write a new agent file.  Raises ``FileExistsError`` if it already exists."""
    path = _contained(_agents_dir(), f"{_safe_id(agent_id)}.agent.md")
    if path.exists():
        raise FileExistsError(f"Agent '{agent_id}' already exists")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return _read_agent(path)


def update_agent(agent_id: str, content: str) -> dict[str, Any]:
    path = _contained(_agents_dir(), f"{_safe_id(agent_id)}.agent.md")
    if not path.is_file():
        raise FileNotFoundError(f"Agent '{agent_id}' not found")
    path.write_text(content, encoding="utf-8")
    return _read_agent(path)


def delete_agent(agent_id: str) -> bool:
    path = _contained(_agents_dir(), f"{_safe_id(agent_id)}.agent.md")
    if not path.is_file():
        return False
    path.unlink()
    return True


#: Tools an agent may declare. The chat orchestrator grants exactly these to the
#: CLI, so an unknown name must not silently widen the grant.
KNOWN_TOOLS = frozenset({"read", "write", "edit", "search", "shell", "fetch"})


def agent_tools(agent_id: str) -> list[str]:
    """The tool grant an agent declares, filtered to names we recognise.

    Returns ``["read"]`` for an agent that declares nothing — the least
    privilege that still lets an agent do useful work.
    """
    try:
        agent = get_agent(agent_id)
    except InvalidEntityId:
        return ["read"]
    if not agent:
        return ["read"]
    declared = agent.get("tools") or []
    if not isinstance(declared, list):
        return ["read"]
    allowed = [str(t).strip().lower() for t in declared]
    allowed = [t for t in allowed if t in KNOWN_TOOLS]
    return allowed or ["read"]


def _read_agent(path: Path) -> dict[str, Any]:
    content = path.read_text(encoding="utf-8")
    meta, body = _parse_frontmatter(content)
    agent_id = path.name.replace(".agent.md", "")
    return {
        "id": agent_id,
        "type": "agent",
        "name": meta.get("name", _display_name(agent_id)),
        "description": meta.get("description", ""),
        "tools": meta.get("tools", []),
        # Declared in the agent's own frontmatter so a newly onboarded agent
        # describes itself, rather than needing an entry in a table in the API
        # layer. Defaults keep older definitions renderable.
        "role": meta.get("role", "Custom Agent"),
        "stage": meta.get("stage", "chain"),
        "input_artifact": meta.get("input_artifact", "workspace"),
        "output_artifact": meta.get("output_artifact", "workspace"),
        "content": content,
        "body": body.strip(),
        "file": f"agent-hub/agents/{path.name}",
    }


# =================================================================== skills

def list_skills() -> list[dict[str, Any]]:
    skills: list[dict[str, Any]] = []
    d = _skills_dir()
    if not d.exists():
        return skills

    for skill_dir in sorted(d.iterdir()):
        if not skill_dir.is_dir() or skill_dir.name.startswith("_"):
            continue
        skill_md = skill_dir / "SKILL.md"
        if skill_md.is_file():
            skills.append(_read_skill(skill_dir))
    return skills


def get_skill(skill_id: str) -> dict[str, Any] | None:
    skill_dir = _contained(_skills_dir(), _safe_id(skill_id))
    if not skill_dir.is_dir():
        return None
    if not (skill_dir / "SKILL.md").is_file():
        return None
    return _read_skill(skill_dir)


def create_skill(skill_id: str, content: str) -> dict[str, Any]:
    skill_dir = _contained(_skills_dir(), _safe_id(skill_id))
    if skill_dir.exists():
        raise FileExistsError(f"Skill '{skill_id}' already exists")
    skill_dir.mkdir(parents=True, exist_ok=True)
    (skill_dir / "SKILL.md").write_text(content, encoding="utf-8")
    return _read_skill(skill_dir)


def update_skill(skill_id: str, content: str) -> dict[str, Any]:
    skill_dir = _contained(_skills_dir(), _safe_id(skill_id))
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.is_file():
        raise FileNotFoundError(f"Skill '{skill_id}' not found")
    skill_md.write_text(content, encoding="utf-8")
    return _read_skill(skill_dir)


def delete_skill(skill_id: str) -> bool:
    # This is the one destructive recursive operation in the module, so the
    # target must be a real skill directory, not merely something inside the
    # skills folder.
    skill_dir = _contained(_skills_dir(), _safe_id(skill_id))
    if not skill_dir.is_dir() or not (skill_dir / "SKILL.md").is_file():
        return False
    shutil.rmtree(skill_dir)
    return True


def _read_skill(skill_dir: Path) -> dict[str, Any]:
    skill_md = skill_dir / "SKILL.md"
    content = skill_md.read_text(encoding="utf-8")
    meta, body = _parse_frontmatter(content)
    return {
        "id": skill_dir.name,
        "type": "skill",
        "name": meta.get("name", _display_name(skill_dir.name)),
        "description": meta.get("description", ""),
        "content": content,
        "body": body.strip(),
        "path": f"agent-hub/skills/{skill_dir.name}/SKILL.md",
        "version": settings.skill_version,
    }


# ================================================================== prompts

def list_prompts() -> list[dict[str, Any]]:
    prompts: list[dict[str, Any]] = []
    d = _prompts_dir()
    if not d.exists():
        return prompts

    for path in sorted(d.glob("*.prompt.md")):
        if path.name.startswith("_"):
            continue
        prompts.append(_read_prompt(path))
    return prompts


def get_prompt(prompt_id: str) -> dict[str, Any] | None:
    path = _contained(_prompts_dir(), f"{_safe_id(prompt_id)}.prompt.md")
    if not path.is_file():
        return None
    return _read_prompt(path)


def create_prompt(prompt_id: str, content: str) -> dict[str, Any]:
    path = _contained(_prompts_dir(), f"{_safe_id(prompt_id)}.prompt.md")
    if path.exists():
        raise FileExistsError(f"Prompt '{prompt_id}' already exists")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return _read_prompt(path)


def update_prompt(prompt_id: str, content: str) -> dict[str, Any]:
    path = _contained(_prompts_dir(), f"{_safe_id(prompt_id)}.prompt.md")
    if not path.is_file():
        raise FileNotFoundError(f"Prompt '{prompt_id}' not found")
    path.write_text(content, encoding="utf-8")
    return _read_prompt(path)


def delete_prompt(prompt_id: str) -> bool:
    path = _contained(_prompts_dir(), f"{_safe_id(prompt_id)}.prompt.md")
    if not path.is_file():
        return False
    path.unlink()
    return True


def _read_prompt(path: Path) -> dict[str, Any]:
    content = path.read_text(encoding="utf-8")
    meta, body = _parse_frontmatter(content)
    prompt_id = path.name.replace(".prompt.md", "")
    return {
        "id": prompt_id,
        "type": "prompt",
        "name": meta.get("name", _display_name(prompt_id)),
        "description": meta.get("description", ""),
        "tags": meta.get("tags", []),
        "content": content,
        "body": body.strip(),
        "file": f"agent-hub/prompts/{path.name}",
    }


# ================================================================ workflows

def list_workflows() -> list[dict[str, Any]]:
    workflows: list[dict[str, Any]] = []
    d = _workflows_dir()
    if not d.exists():
        return workflows

    for path in sorted(d.glob("*.workflow.yaml")):
        if path.name.startswith("_"):
            continue
        wf = _read_workflow(path)
        if wf:
            workflows.append(wf)
    return workflows


def get_workflow(workflow_id: str) -> dict[str, Any] | None:
    path = _contained(_workflows_dir(), f"{_safe_id(workflow_id)}.workflow.yaml")
    if not path.is_file():
        return None
    return _read_workflow(path)


def create_workflow(workflow_id: str, content: str) -> dict[str, Any]:
    path = _contained(_workflows_dir(), f"{_safe_id(workflow_id)}.workflow.yaml")
    if path.exists():
        raise FileExistsError(f"Workflow '{workflow_id}' already exists")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    try:
        _validate_workflow_content(path, workflow_id)
    except ValueError:
        path.unlink()
        raise
    wf = _read_workflow(path)
    if not wf:  # pragma: no cover — _validate_workflow_content already caught it
        path.unlink()
        raise ValueError("Invalid workflow YAML")
    return wf


def update_workflow(workflow_id: str, content: str) -> dict[str, Any]:
    path = _contained(_workflows_dir(), f"{_safe_id(workflow_id)}.workflow.yaml")
    if not path.is_file():
        raise FileNotFoundError(f"Workflow '{workflow_id}' not found")
    previous = path.read_text(encoding="utf-8")
    path.write_text(content, encoding="utf-8")
    try:
        _validate_workflow_content(path, workflow_id)
    except ValueError:
        path.write_text(previous, encoding="utf-8")  # never leave it broken
        raise
    wf = _read_workflow(path)
    if not wf:  # pragma: no cover
        path.write_text(previous, encoding="utf-8")
        raise ValueError("Invalid workflow YAML")
    return wf


def delete_workflow(workflow_id: str) -> bool:
    path = _contained(_workflows_dir(), f"{_safe_id(workflow_id)}.workflow.yaml")
    if not path.is_file():
        return False
    path.unlink()
    return True


def _validate_workflow_content(path: Path, workflow_id: str) -> None:
    """Reject a workflow that would fail at execution time rather than at write.

    A workflow naming an agent that does not exist parses fine and then dies
    mid-run, after the job row and workspace already exist. Catching it here
    turns a failed job into a 400 on the request that caused it.
    """
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        raise ValueError(f"Invalid workflow YAML: {exc}") from exc

    if not isinstance(data, dict):
        raise ValueError("Workflow YAML must be a mapping")
    if data.get("id") != workflow_id:
        raise ValueError(
            f"Workflow 'id' must match the filename: expected {workflow_id!r}, "
            f"found {data.get('id')!r}"
        )

    agents = data.get("agents") or []
    if not isinstance(agents, list) or not agents:
        raise ValueError("Workflow must declare at least one agent under 'agents'")

    known = {a["id"] for a in list_agents()}
    for entry in agents:
        if not isinstance(entry, dict) or "id" not in entry:
            raise ValueError("Each entry under 'agents' needs an 'id'")
        if entry["id"] not in known:
            raise ValueError(
                f"Workflow references unknown agent {entry['id']!r}. "
                f"Onboard it before referencing it."
            )

    skill_id = data.get("skill")
    if skill_id and not (_skills_dir() / str(skill_id)).is_dir():
        raise ValueError(f"Workflow references unknown skill {skill_id!r}")


def _read_workflow(path: Path) -> dict[str, Any] | None:
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError:
        return None
    if not isinstance(data, dict) or "id" not in data:
        return None
    data["type"] = "workflow"
    data["file"] = f"agent-hub/workflows/{path.name}"
    #: The raw YAML, so the UI can show what the author actually wrote rather
    #: than a JSON rendering of the parsed form.
    data["content"] = path.read_text(encoding="utf-8")
    data.setdefault("name", _display_name(data["id"]))
    data.setdefault("description", "")
    data.setdefault("agents", [])
    data.setdefault("has_custom_ui", False)
    data.setdefault("custom_ui_route", None)
    data.setdefault("tags", [])
    #: Whether the bespoke test-generation runner drives this workflow, or the
    #: declarative generic runner. Set explicitly by the test-gen workflow;
    #: everything onboarded later gets the generic engine.
    data.setdefault("runner", "generic")
    #: Whether the workflow pauses for a human before its main stage.
    data.setdefault("approval_gate", False)
    data.setdefault("available", True)
    return data


# ============================================================ unified catalog

def get_catalog() -> dict[str, list[dict[str, Any]]]:
    """Return every entity in the hub grouped by type."""
    return {
        "agents": list_agents(),
        "skills": list_skills(),
        "prompts": list_prompts(),
        "workflows": list_workflows(),
    }


def get_registered_workflow_ids() -> set[str]:
    """Return the set of workflow IDs currently on disk."""
    return {w["id"] for w in list_workflows()}
