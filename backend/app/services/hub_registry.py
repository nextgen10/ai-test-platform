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
    content, _stripped = strip_denied_tools(content)
    assert_agent_valid(content)
    path = _contained(_agents_dir(), f"{_safe_id(agent_id)}.agent.md")
    if path.exists():
        raise FileExistsError(f"Agent '{agent_id}' already exists")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return _read_agent(path)


def update_agent(agent_id: str, content: str) -> dict[str, Any]:
    content, _stripped = strip_denied_tools(content)
    assert_agent_valid(content)
    path = _contained(_agents_dir(), f"{_safe_id(agent_id)}.agent.md")
    if not path.is_file():
        raise FileNotFoundError(f"Agent '{agent_id}' not found")
    previous = path.read_text(encoding="utf-8")
    path.write_text(content, encoding="utf-8")
    try:
        return _read_agent(path)
    except Exception:
        # Never leave a half-written definition behind: the file *is* the
        # system prompt, and the next job would run whatever landed here.
        path.write_text(previous, encoding="utf-8")
        raise


def delete_agent(agent_id: str) -> bool:
    path = _contained(_agents_dir(), f"{_safe_id(agent_id)}.agent.md")
    if not path.is_file():
        return False
    path.unlink()
    return True


class DeniedTool(ValueError):
    """An agent definition asked for a tool this platform will not grant."""


class InvalidAgentDefinition(ValueError):
    """An agent definition would not work if it were installed.

    Carries every problem at once rather than the first one, so an author fixes
    a definition in one pass instead of resubmitting to discover the next fault.
    """

    def __init__(self, errors: list[str]) -> None:
        self.errors = errors
        super().__init__("; ".join(errors))


#: Tools an agent may declare. The chat orchestrator and generic runner grant
#: exactly these to the CLI. ``shell`` and ``fetch`` are recognised so we can
#: reject them at write time rather than silently honour them.
KNOWN_TOOLS = frozenset({"read", "write", "edit", "search", "shell", "fetch"})
DENIED_TOOLS = frozenset({"shell", "fetch"})
ALLOWED_TOOLS = KNOWN_TOOLS - DENIED_TOOLS

#: Artifact paths an agent may declare. ``workspace`` means "the whole tree";
#: anything else is a path relative to the job workspace root.
_ARTIFACT_DIRS = ("input/", "intermediate/", "output/")



def strip_denied_tools(content: str) -> tuple[str, list[str]]:
    """Remove shell/fetch from agent frontmatter before persist.

    Generators sometimes emit ``tools: ["fetch", ...]`` for URL-shaped
    workflows. Those tools are never granted at runtime; stripping them lets
    the Workflow Builder install the rest of a valid agent instead of failing
    the whole write.
    """
    meta, _body = _parse_frontmatter(content)
    declared = meta.get("tools")
    if not isinstance(declared, list):
        return content, []
    removed = sorted({
        str(t).strip().lower()
        for t in declared
        if str(t).strip().lower() in DENIED_TOOLS
    })
    if not removed:
        return content, []
    kept = [
        str(t).strip().lower()
        for t in declared
        if str(t).strip() and str(t).strip().lower() not in DENIED_TOOLS
    ]
    if not kept:
        kept = ["read", "write"] if meta.get("output_artifact") else ["read"]

    parts = content.split("---", 2)
    if len(parts) < 3:
        return content, list(removed)
    fence_open, frontmatter, rest = parts[0], parts[1], parts[2]
    tools_flow = "[" + ", ".join(f'"{name}"' for name in kept) + "]"
    replaced, n = re.subn(
        r"(?m)^tools:\s*\[[^\]]*\]\s*$",
        f"tools: {tools_flow}",
        frontmatter,
        count=1,
    )
    if n == 0:
        meta_out = dict(meta)
        meta_out["tools"] = kept
        replaced = "\n" + yaml.safe_dump(
            meta_out, sort_keys=False, allow_unicode=True, default_flow_style=False
        )
    return f"{fence_open}---{replaced}---{rest}", list(removed)


def _assert_tools_allowed(content: str) -> None:
    """Refuse to persist an agent that would get shell or fetch at runtime."""
    meta, _ = _parse_frontmatter(content)
    declared = meta.get("tools") or []
    if not isinstance(declared, list):
        return
    bad = [
        str(t).strip().lower()
        for t in declared
        if str(t).strip().lower() in DENIED_TOOLS
    ]
    if bad:
        raise DeniedTool(
            f"Agents may not declare {bad}. shell and fetch are denied on this "
            "platform because they turn prompt injection into host/network access."
        )


def _check_artifact(field: str, value: Any, errors: list[str]) -> None:
    """An artifact path must stay inside the job workspace.

    An absolute path or a ``..`` escape does not fail at write time — it fails
    mid-run, in a container, having already burned a Copilot call.

    A list is allowed: a fan-in agent reads several upstream artifacts. Anything
    else is not. This used to coerce with ``str(value)``, which meant a mapping
    or a number was accepted as a "path" and only surfaced later as a TypeError
    in the browser — validating a stringification is not validating the value.
    """
    if value is None or value == "workspace":
        return

    if isinstance(value, (list, tuple)):
        if not value:
            errors.append(f"'{field}' is an empty list. Remove it, or name a path.")
            return
        for item in value:
            if not isinstance(item, str):
                errors.append(
                    f"'{field}' must contain paths, but one entry is a "
                    f"{type(item).__name__}."
                )
                return
        for item in value:
            _check_artifact(field, item, errors)
        return

    if not isinstance(value, str):
        errors.append(
            f"'{field}' must be a path, or a list of paths — got a "
            f"{type(value).__name__}."
        )
        return

    text = value.strip()
    if not text:
        errors.append(f"'{field}' is empty. Remove it, or give it a path.")
        return
    if text.startswith("/") or (len(text) > 1 and text[1] == ":"):
        errors.append(
            f"'{field}' must be relative to the job workspace, not an absolute "
            f"path ({text!r})."
        )
        return
    if ".." in Path(text).parts:
        errors.append(f"'{field}' may not contain '..' ({text!r}).")


def validate_agent(content: str) -> dict[str, Any]:
    """Check an agent definition before it becomes a system prompt.

    An agent file is executable configuration: whatever is written here is what
    the Copilot CLI is told to be, and the frontmatter decides what it may touch
    and what contract its output is held to. A definition that is merely
    *parseable* can still be broken in ways that only surface as a failed job
    twenty minutes later — no description for the catalog, an output artifact
    pointing outside the workspace, a schema path naming a file that is not
    there.

    Errors block the write. Warnings do not: they describe a definition that
    will run but is missing something worth having, and blocking on them would
    stop the Workflow Builder installing the agents it just generated.
    """
    errors: list[str] = []
    warnings: list[str] = []

    meta, body = _parse_frontmatter(content)

    if not meta:
        errors.append(
            "No YAML frontmatter found. An agent file starts with a '---' fenced "
            "block declaring at least 'description' and 'tools'."
        )

    description = str(meta.get("description") or "").strip()
    if not description:
        errors.append(
            "'description' is required — it is what the Registry, the console "
            "and the agent picker show for this agent."
        )

    declared = meta.get("tools")
    if declared is None:
        warnings.append(
            "No 'tools' declared, so this agent is granted read only. Add "
            "'write' if it has to produce an artifact."
        )
    elif not isinstance(declared, list):
        errors.append("'tools' must be a list, for example: tools: [\"read\", \"write\"]")
    else:
        names = [str(t).strip().lower() for t in declared]
        denied = sorted({t for t in names if t in DENIED_TOOLS})
        if denied:
            errors.append(
                f"Agents may not declare {denied}. shell and fetch are denied on "
                f"this platform because they turn prompt injection into "
                f"host/network access."
            )
        unknown = sorted({t for t in names if t not in KNOWN_TOOLS})
        if unknown:
            errors.append(
                f"Unknown tool(s) {unknown}. Known tools are: "
                f"{', '.join(sorted(KNOWN_TOOLS))}."
            )

    _check_artifact("input_artifact", meta.get("input_artifact"), errors)
    _check_artifact("output_artifact", meta.get("output_artifact"), errors)

    # Normalised the same way the reader does, so a list-valued declaration is
    # checked as a path rather than as its Python repr.
    output_artifact = artifact_list(meta.get("output_artifact"), default="")[0]
    if output_artifact and output_artifact != "workspace":
        if not output_artifact.startswith(_ARTIFACT_DIRS):
            warnings.append(
                f"'output_artifact' is {output_artifact!r}, which is outside "
                f"{', '.join(d.rstrip('/') for d in _ARTIFACT_DIRS)}. The runner "
                f"collects results from those directories."
            )
        if declared is not None and isinstance(declared, list):
            names = [str(t).strip().lower() for t in declared]
            if "write" not in names and "edit" not in names:
                errors.append(
                    f"This agent declares output_artifact {output_artifact!r} but "
                    f"no 'write' tool, so it will be run without permission to "
                    f"create that file and will fail its contract every time."
                )

    schema = meta.get("output_schema")
    schema_text = str(schema).strip() if schema else ""
    if schema_text and schema_text.lower() != "null":
        from app.config import PROJECT_ROOT

        if Path(schema_text).is_absolute() or ".." in Path(schema_text).parts:
            errors.append(
                f"'output_schema' must be a path relative to the project root "
                f"({schema_text!r})."
            )
        elif not (PROJECT_ROOT / schema_text).is_file():
            warnings.append(
                f"'output_schema' points at {schema_text}, which does not exist "
                f"yet. Until it does, this agent's output is not contract-checked."
            )
    elif output_artifact.endswith(".json"):
        warnings.append(
            "This agent writes JSON but declares no 'output_schema', so nothing "
            "validates its output. Add one to have the runner check the contract "
            "and give the agent a chance to correct itself."
        )

    if not body.strip():
        errors.append(
            "The body is empty. Everything after the frontmatter is the agent's "
            "system prompt — without it the agent has no instructions."
        )
    elif len(body.strip()) < 120:
        warnings.append(
            "The body is very short. It becomes the agent's entire system "
            "prompt, so state its role, its input, its output and its rules."
        )

    lowered = body.lower()
    if body.strip() and "untrusted" not in lowered and "trust boundary" not in lowered:
        warnings.append(
            "The prompt does not say that its input is untrusted data. Every "
            "shipped agent carries a 'Trust boundary' section telling it never "
            "to follow instructions found in the content it is given."
        )

    return {"ok": not errors, "errors": errors, "warnings": warnings}


def assert_agent_valid(content: str) -> list[str]:
    """Validate, raising on anything that would break the agent. Returns warnings."""
    result = validate_agent(content)
    if not result["ok"]:
        raise InvalidAgentDefinition(list(result["errors"]))
    return list(result["warnings"])


def seed_hub() -> None:
    """Copy the image's baked hub onto an empty volume once.

    Kubernetes mounts a PVC at AGENT_HUB_DIR so Registry writes reach runner
    Jobs. The first boot of an empty volume would otherwise serve an empty
    catalog. AGENT_HUB_SEED points at the copy baked into the image.
    """
    dest = _hub_root()
    dest.mkdir(parents=True, exist_ok=True)
    seed = settings.agent_hub_seed
    if seed is None or not seed.is_dir():
        return
    if (dest / "agents").is_dir() and any((dest / "agents").glob("*.agent.md")):
        return
    import logging

    logging.getLogger("ai-test-platform").info(
        "Seeding agent hub at %s from %s", dest, seed
    )
    shutil.copytree(seed, dest, dirs_exist_ok=True)


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
    allowed = [t for t in allowed if t in ALLOWED_TOOLS]
    return allowed or ["read"]


def _schema_or_none(value: Any) -> str | None:
    """The declared output schema path, or None.

    ``output_schema: null`` is how an agent that writes prose says it has no
    contract, and YAML hands that back as None — but a definition written by a
    generator can also carry the string ``"null"``, which is not a path either.
    """
    if value is None:
        return None
    text = str(value).strip()
    return text if text and text.lower() != "null" else None


def artifact_list(value: Any, default: str = "workspace") -> list[str]:
    """Every artifact path a field declares, as a list of strings.

    A fan-in agent legitimately reads more than one upstream artifact, and YAML
    lets an author write that as a list::

        input_artifact:
          - intermediate/contributing-factors_result.md
          - intermediate/customer-impact_result.md

    Nothing in the platform expected that shape, so it reached the browser and
    crashed the whole console on ``.trim()``, threw in the Agent Lab on
    ``workspace / [...]``, and rendered as a Python repr inside a runner prompt.
    Normalising here means every consumer sees one predictable type.
    """
    if value is None:
        return [default]
    if isinstance(value, (list, tuple)):
        paths = [str(item).strip() for item in value if str(item).strip()]
        return paths or [default]
    text = str(value).strip()
    return [text] if text else [default]


def _read_agent(path: Path) -> dict[str, Any]:
    content = path.read_text(encoding="utf-8")
    meta, body = _parse_frontmatter(content)
    agent_id = path.name.replace(".agent.md", "")
    inputs = artifact_list(meta.get("input_artifact"))
    outputs = artifact_list(meta.get("output_artifact"))
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
        # Always a string, so no consumer has to guess the shape. An agent that
        # declares several inputs reports its first here and the whole set in
        # `input_artifacts` — which is what anything chaining agents should read.
        "input_artifact": inputs[0],
        "input_artifacts": inputs,
        "output_artifact": outputs[0],
        "output_artifacts": outputs,
        # The contract, surfaced rather than left for each caller to re-parse
        # out of the raw frontmatter. The Agent Lab used to do exactly that,
        # which is one more place for the two readings to disagree.
        "output_schema": _schema_or_none(meta.get("output_schema")),
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


def skill_dir(skill_id: str) -> Path:
    """The validated on-disk directory for a skill.

    Anything that hands a skill path to a subprocess should come through here
    rather than joining onto the hub root itself, so validation cannot be lost
    by a caller reordering its own guards.
    """
    return _contained(_skills_dir(), _safe_id(skill_id))


def get_skill(skill_id: str) -> dict[str, Any] | None:
    directory = skill_dir(skill_id)
    if not directory.is_dir():
        return None
    if not (directory / "SKILL.md").is_file():
        return None
    return _read_skill(directory)


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
