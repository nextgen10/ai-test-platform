"""Ownership checks so a reader cannot list another principal's work.

Admin sees everything. Everyone else sees only rows they created.
"""
from __future__ import annotations

from fastapi import HTTPException

from app.security import Principal, Role
from app.services.job_service import JobError


def is_admin(principal: Principal) -> bool:
    return principal.role >= Role.ADMIN


def can_access(principal: Principal, owner: str | None) -> bool:
    if is_admin(principal):
        return True
    return bool(owner) and owner == principal.name


def deny_unless_owner(principal: Principal, owner: str | None, *, kind: str = "resource") -> None:
    """404 rather than 403 so a guessed id does not confirm that the row exists."""
    if can_access(principal, owner):
        return
    raise JobError(f"{kind} not found", status_code=404)


def http_deny_unless_owner(
    principal: Principal, owner: str | None, *, kind: str = "resource"
) -> None:
    if can_access(principal, owner):
        return
    raise HTTPException(status_code=404, detail=f"{kind} not found")
