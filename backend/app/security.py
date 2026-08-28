"""Authentication and authorisation for the orchestrator API.

Every route sits behind one of the role dependencies below.  Roles are ordered,
so a dependency asks for a *minimum*:

    reader   read the catalog, jobs, artifacts, logs
    operator + submit, approve, reject, cancel and reprocess jobs; use chat
    author   + create, update and delete hub entities
    admin    + everything

Credentials are bearer tokens supplied through ``API_TOKENS``, which the
deployment mounts from a secret::

    API_TOKENS="tok_abc:ci-pipeline:operator,tok_def:qa-lead:author"

That is deliberately a small mechanism, not an identity provider.  It gives the
platform a real authorisation boundary today and leaves one seam — swap
:func:`_principal_for_token` for an OIDC token check — when an IdP arrives.

Running with no tokens at all is possible (``AUTH_MODE=disabled``) but must be
chosen explicitly: the default refuses to start rather than serving an open
registry that can write agent prompts.
"""
from __future__ import annotations

import hmac
import logging
import os
from dataclasses import dataclass
from enum import IntEnum

from fastapi import Depends, HTTPException, Request, status

from app.config import settings

logger = logging.getLogger("ai-test-platform.security")


class Role(IntEnum):
    """Ordered privilege levels — compare with ``>=``."""

    READER = 10
    OPERATOR = 20
    AUTHOR = 30
    ADMIN = 40


_ROLE_NAMES = {
    "reader": Role.READER,
    "operator": Role.OPERATOR,
    "author": Role.AUTHOR,
    "admin": Role.ADMIN,
}


@dataclass(frozen=True)
class Principal:
    """Who is making this request."""

    name: str
    role: Role

    @property
    def role_name(self) -> str:
        return self.role.name.lower()


#: Used when AUTH_MODE=disabled, so downstream code always has a principal and
#: never has to branch on whether auth is on.
ANONYMOUS = Principal(name="anonymous", role=Role.ADMIN)


class AuthConfigError(RuntimeError):
    """The auth configuration is unusable, so the process must not serve traffic."""


def _parse_tokens(raw: str) -> dict[str, Principal]:
    """Parse ``API_TOKENS`` into a token → principal map."""
    principals: dict[str, Principal] = {}
    for index, entry in enumerate(raw.split(","), start=1):
        entry = entry.strip()
        if not entry:
            continue
        parts = [p.strip() for p in entry.split(":")]
        if len(parts) != 3:
            raise AuthConfigError(
                f"API_TOKENS entry {index} is malformed. "
                f"Expected '<token>:<name>:<role>', got {entry!r}."
            )
        token, name, role_name = parts
        if len(token) < 16:
            raise AuthConfigError(
                f"API_TOKENS entry {index} ({name!r}) has a token shorter than "
                f"16 characters. Use a generated random value."
            )
        role = _ROLE_NAMES.get(role_name.lower())
        if role is None:
            raise AuthConfigError(
                f"API_TOKENS entry {index} ({name!r}) has unknown role "
                f"{role_name!r}. Expected one of: {', '.join(_ROLE_NAMES)}."
            )
        principals[token] = Principal(name=name, role=role)
    return principals


_TOKENS: dict[str, Principal] = {}


def configure_auth() -> None:
    """Validate the auth configuration at startup.

    Called from the lifespan handler so a misconfigured deployment fails loudly
    on boot rather than at the first request.
    """
    global _TOKENS

    mode = settings.auth_mode.strip().lower()

    if mode == "disabled":
        allow = os.getenv("ALLOW_INSECURE_AUTH", "").strip().lower() in {
            "1",
            "true",
            "yes",
        }
        if not allow:
            raise AuthConfigError(
                "AUTH_MODE=disabled requires ALLOW_INSECURE_AUTH=1. Refusing to "
                "start an open API. For a loopback run, set that flag, or leave "
                "AUTH_MODE=token and let start.sh mint a credential."
            )
        _TOKENS = {}
        logger.warning(
            "AUTH_MODE=disabled — every endpoint is open, including hub writes "
            "that become agent prompts. Acceptable for a loopback dev run only; "
            "never for a deployment reachable by anyone else."
        )
        return

    if mode != "token":
        raise AuthConfigError(
            f"Unknown AUTH_MODE {settings.auth_mode!r}. Expected 'token' or 'disabled'."
        )

    if not settings.api_tokens.strip():
        raise AuthConfigError(
            "AUTH_MODE=token but API_TOKENS is empty, so no request could ever "
            "be authorised. Set API_TOKENS='<token>:<name>:<role>[,...]', or set "
            "AUTH_MODE=disabled to run open on loopback for development."
        )

    _TOKENS = _parse_tokens(settings.api_tokens)
    if not _TOKENS:
        raise AuthConfigError("API_TOKENS parsed to zero usable credentials.")

    by_role: dict[str, int] = {}
    for principal in _TOKENS.values():
        by_role[principal.role_name] = by_role.get(principal.role_name, 0) + 1
    logger.info(
        "Auth enabled | %d credential(s): %s",
        len(_TOKENS),
        ", ".join(f"{count}x {role}" for role, count in sorted(by_role.items())),
    )


def _principal_for_token(token: str) -> Principal | None:
    """Look up a bearer token in constant time with respect to the secret."""
    for known, principal in _TOKENS.items():
        if hmac.compare_digest(known, token):
            return principal
    return None


def _unauthenticated(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def current_principal(request: Request) -> Principal:
    """Resolve the caller, or reject the request."""
    if settings.auth_mode.strip().lower() == "disabled":
        return ANONYMOUS

    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise _unauthenticated(
            "Missing bearer token. Send 'Authorization: Bearer <token>'."
        )

    principal = _principal_for_token(token.strip())
    if principal is None:
        raise _unauthenticated("The supplied token is not valid.")
    return principal


def require(minimum: Role):
    """Build a dependency that admits principals at or above `minimum`."""

    def _dependency(principal: Principal = Depends(current_principal)) -> Principal:
        if principal.role < minimum:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"This action needs the '{minimum.name.lower()}' role; "
                    f"'{principal.name}' has '{principal.role_name}'."
                ),
            )
        return principal

    return _dependency


require_reader = require(Role.READER)
require_operator = require(Role.OPERATOR)
require_author = require(Role.AUTHOR)
require_admin = require(Role.ADMIN)
