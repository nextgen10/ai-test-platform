"""Turning a workflow's ``agents:`` list into an execution graph.

A workflow used to be a list run top to bottom. Most real pipelines are not
linear: three analysts can read the same input at once, and a merge step waits
for all of them. Expressing that as a sequence wastes wall-clock time and makes
the dependency implicit in list order, where it cannot be checked.

Stages declare ``depends_on``; anything with no unmet dependency is ready, and
everything ready runs together. A workflow that declares no dependencies at all
still runs in list order, so existing definitions keep working unchanged.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


class WorkflowGraphError(ValueError):
    """The workflow's dependencies cannot be satisfied as written."""


#: When a stage runs, relative to how its dependencies turned out.
#:
#:   all_succeeded  every dependency completed cleanly (the default)
#:   any_succeeded  at least one did — for a merge over optional branches
#:   always         run regardless, e.g. a cleanup or notification step
CONDITIONS = frozenset({"all_succeeded", "any_succeeded", "always"})


@dataclass
class Stage:
    """One agent invocation in a workflow."""

    id: str
    agent_id: str
    stage: str
    optional: bool = False
    description: str = ""
    depends_on: list[str] = field(default_factory=list)
    when: str = "all_succeeded"

    @property
    def key(self) -> str:
        """What other stages name in `depends_on` — the stage name, not the agent.

        Two stages can use the same agent, so the stage name is the identity
        that matters here.
        """
        return self.stage


def build_stages(definition: dict[str, Any]) -> list[Stage]:
    """Read the workflow's `agents:` list into Stage records, validating as we go."""
    raw = definition.get("agents") or []
    if not isinstance(raw, list) or not raw:
        raise WorkflowGraphError("Workflow declares no agents.")

    stages: list[Stage] = []
    seen: set[str] = set()

    for index, entry in enumerate(raw, start=1):
        if not isinstance(entry, dict) or not entry.get("id"):
            raise WorkflowGraphError(f"Entry {index} under 'agents' needs an 'id'.")

        agent_id = str(entry["id"])
        stage_name = str(entry.get("stage") or f"stage-{index}")

        if stage_name in seen:
            raise WorkflowGraphError(
                f"Two stages are both named {stage_name!r}. Stage names are how "
                f"'depends_on' refers to them, so they must be unique."
            )
        seen.add(stage_name)

        when = str(entry.get("when") or "all_succeeded")
        if when not in CONDITIONS:
            raise WorkflowGraphError(
                f"Stage {stage_name!r} has unknown condition {when!r}. "
                f"Expected one of: {', '.join(sorted(CONDITIONS))}."
            )

        depends = entry.get("depends_on") or []
        if isinstance(depends, str):
            depends = [depends]
        if not isinstance(depends, list):
            raise WorkflowGraphError(
                f"Stage {stage_name!r} has a 'depends_on' that is not a list."
            )

        stages.append(
            Stage(
                id=f"{stage_name}",
                agent_id=agent_id,
                stage=stage_name,
                optional=bool(entry.get("optional", False)),
                description=str(entry.get("description") or ""),
                depends_on=[str(d) for d in depends],
                when=when,
            )
        )

    _validate_dependencies(stages)
    return stages


def _validate_dependencies(stages: list[Stage]) -> None:
    """Reject unknown dependencies and cycles before anything runs."""
    known = {s.key for s in stages}

    for stage in stages:
        for dependency in stage.depends_on:
            if dependency not in known:
                raise WorkflowGraphError(
                    f"Stage {stage.key!r} depends on {dependency!r}, which is not "
                    f"a stage in this workflow. Known stages: "
                    f"{', '.join(sorted(known))}."
                )
            if dependency == stage.key:
                raise WorkflowGraphError(f"Stage {stage.key!r} depends on itself.")

    # Kahn's algorithm: whatever is left when no node has zero in-degree is a cycle.
    remaining = {s.key: set(s.depends_on) for s in stages}
    while remaining:
        ready = [key for key, deps in remaining.items() if not deps]
        if not ready:
            raise WorkflowGraphError(
                f"The workflow's dependencies form a cycle involving: "
                f"{', '.join(sorted(remaining))}."
            )
        for key in ready:
            del remaining[key]
        for deps in remaining.values():
            deps.difference_update(ready)


def has_explicit_dependencies(stages: list[Stage]) -> bool:
    """Whether any stage declares a dependency.

    A workflow with none is treated as a plain sequence, which is what every
    definition written before dependencies existed means.
    """
    return any(stage.depends_on for stage in stages)


def plan_waves(stages: list[Stage]) -> list[list[Stage]]:
    """Group stages into waves that can each run concurrently.

    Wave *n* contains every stage whose dependencies are all satisfied by waves
    before it. Sequential workflows yield one stage per wave, which is exactly
    the old behaviour.
    """
    if not has_explicit_dependencies(stages):
        return [[stage] for stage in stages]

    by_key = {stage.key: stage for stage in stages}
    pending = {stage.key: set(stage.depends_on) for stage in stages}
    done: set[str] = set()
    waves: list[list[Stage]] = []

    while pending:
        ready = sorted(key for key, deps in pending.items() if deps <= done)
        if not ready:  # pragma: no cover — _validate_dependencies rejects cycles
            raise WorkflowGraphError("Unsatisfiable dependencies remain.")
        waves.append([by_key[key] for key in ready])
        for key in ready:
            del pending[key]
        done.update(ready)

    return waves


def should_run(stage: Stage, outcomes: dict[str, str]) -> tuple[bool, str]:
    """Whether `stage` runs, given how its dependencies turned out.

    Returns (run, reason); `reason` explains a skip so the run record says why a
    stage did not execute rather than leaving a hole.
    """
    if stage.when == "always":
        return True, ""

    if not stage.depends_on:
        return True, ""

    results = [outcomes.get(dep, "skipped") for dep in stage.depends_on]

    if stage.when == "any_succeeded":
        if any(r == "completed" for r in results):
            return True, ""
        return False, (
            f"no dependency of {stage.key!r} succeeded "
            f"({', '.join(f'{d}={outcomes.get(d, 'skipped')}' for d in stage.depends_on)})"
        )

    # all_succeeded
    failed = [
        dep for dep in stage.depends_on if outcomes.get(dep, "skipped") != "completed"
    ]
    if failed:
        return False, (
            f"{stage.key!r} needs {', '.join(failed)} to succeed "
            f"({', '.join(f'{d}={outcomes.get(d, 'skipped')}' for d in failed)})"
        )
    return True, ""
