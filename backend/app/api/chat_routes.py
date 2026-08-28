"""Chat API — session management and SSE streaming endpoints."""
from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, noload

from app.access import http_deny_unless_owner, is_admin
from app.config import settings
from app.database import get_db
from app.models.chat import ChatMessage, ChatRole, ChatSession
from app.schemas.chat import (
    ChatMessageIn,
    ChatMessageOut,
    ChatSessionCreate,
    ChatSessionOut,
    ChatSessionSummary,
    OneShotRequest,
)
from app.security import Principal, require_operator, require_reader
from app.services.chat_orchestrator import ChatConfig, HistoryTurn, execute_streaming

logger = logging.getLogger("chat-api")

router = APIRouter(prefix=f"{settings.api_prefix}/chat", tags=["chat"])

#: How many prior messages to replay to the agent. The orchestrator applies a
#: character budget on top; this bounds the query.
HISTORY_TURNS = 20

#: Appended to a reply the user cut short. The console shows the same text while
#: the turn is still local, so nothing changes under the user on reload.
STOPPED_MARKER = "\n\n_[stopped by the user]_"

#: How many times to re-derive a message sequence before giving up. Collisions
#: need one competing writer to commit first, so a couple of attempts is plenty.
SEQUENCE_RETRIES = 4

_global_chat_slots = asyncio.Semaphore(max(1, settings.chat_max_concurrent_total))


@dataclass
class _UserSlots:
    """One caller's concurrency budget, discarded once they go idle.

    Keying bare semaphores by principal name would grow the registry for the
    life of the process — one permanent entry per name that ever sent a message.
    Tracking outstanding holders lets the entry be dropped when the last one
    finishes.
    """

    name: str
    semaphore: asyncio.Semaphore
    held: int = 0


_user_chat_slots: dict[str, _UserSlots] = {}
_user_chat_lock = asyncio.Lock()


def _forget_if_idle(slots: _UserSlots) -> None:
    """Drop the registry entry once nobody is holding or waiting on it."""
    slots.held -= 1
    if slots.held <= 0 and _user_chat_slots.get(slots.name) is slots:
        del _user_chat_slots[slots.name]


async def _acquire_chat_slot(principal: Principal) -> _UserSlots:
    """Bound concurrent Copilot processes per caller and globally."""
    per_user = max(1, settings.chat_max_concurrent_per_user)
    async with _user_chat_lock:
        slots = _user_chat_slots.get(principal.name)
        if slots is None:
            slots = _UserSlots(principal.name, asyncio.Semaphore(per_user))
            _user_chat_slots[principal.name] = slots
        # Claim the entry before releasing the lock so a concurrent release
        # cannot evict the semaphore this caller is about to wait on.
        slots.held += 1

    try:
        await asyncio.wait_for(_global_chat_slots.acquire(), timeout=0.05)
    except TimeoutError as exc:
        _forget_if_idle(slots)
        raise HTTPException(
            429, "The chat service is busy; retry shortly"
        ) from exc
    try:
        await asyncio.wait_for(slots.semaphore.acquire(), timeout=0.05)
    except TimeoutError as exc:
        _global_chat_slots.release()
        _forget_if_idle(slots)
        raise HTTPException(
            429, "Too many concurrent chat turns for this user"
        ) from exc
    return slots


def _release_chat_slot(slots: _UserSlots) -> None:
    slots.semaphore.release()
    _forget_if_idle(slots)
    _global_chat_slots.release()


# ============================================================ sessions

@router.post("/sessions", response_model=ChatSessionOut, status_code=201)
def create_session(
    payload: ChatSessionCreate,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_operator),
) -> ChatSessionOut:
    session = ChatSession(
        title=payload.title,
        created_by=principal.name,
        agent_id=payload.agent_id,
        skill_id=payload.skill_id,
        workflow_id=payload.workflow_id,
        prompt_id=payload.prompt_id,
        model=payload.model,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return ChatSessionOut.model_validate(session)


@router.get("/sessions", response_model=list[ChatSessionSummary])
def list_sessions(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0, description="Skip this many sessions, for paging."),
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_reader),
) -> list[ChatSessionSummary]:
    query = db.query(ChatSession)
    if not is_admin(principal):
        query = query.filter(ChatSession.created_by == principal.name)
    sessions = (
        query.order_by(ChatSession.last_activity.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return [ChatSessionSummary.model_validate(s) for s in sessions]


@router.get("/sessions/{session_id}", response_model=ChatSessionOut)
def get_session(
    session_id: str,
    message_limit: int = Query(200, ge=1, le=500),
    before_sequence: int | None = Query(
        None,
        ge=1,
        description="Return only messages earlier than this sequence, for paging "
        "backwards through a long transcript.",
    ),
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_reader),
) -> ChatSessionOut:
    session = (
        db.query(ChatSession)
        .options(noload(ChatSession.messages))
        .filter_by(id=session_id)
        .first()
    )
    if not session:
        raise HTTPException(404, f"Session '{session_id}' not found")
    http_deny_unless_owner(principal, session.created_by, kind="Session")
    out = ChatSessionOut.model_validate(session)

    window = db.query(ChatMessage).filter_by(session_id=session_id)
    if before_sequence is not None:
        window = window.filter(ChatMessage.sequence < before_sequence)
    rows = window.order_by(ChatMessage.sequence.desc()).limit(message_limit).all()
    out.messages = [ChatMessageOut.model_validate(m) for m in reversed(rows)]

    # The window is bounded, so the client needs the real total to know it is
    # looking at the tail of a longer conversation rather than all of it.
    out.message_total = db.scalar(
        select(func.count())
        .select_from(ChatMessage)
        .where(ChatMessage.session_id == session_id)
    ) or 0
    return out


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: str,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_operator),
) -> dict:
    session = db.query(ChatSession).filter_by(id=session_id).first()
    if not session:
        raise HTTPException(404, f"Session '{session_id}' not found")
    http_deny_unless_owner(principal, session.created_by, kind="Session")
    db.delete(session)
    db.commit()
    return {"deleted": session_id}


# ============================================================ messages

def _load_history(db: Session, session_id: str, limit: int) -> list[HistoryTurn]:
    """The last `limit` messages in this session, oldest first."""
    rows = (
        db.query(ChatMessage)
        .filter_by(session_id=session_id)
        .order_by(ChatMessage.sequence.desc())
        .limit(limit)
        .all()
    )
    return [
        HistoryTurn(
            role=row.role.value if hasattr(row.role, "value") else str(row.role),
            content=row.content,
        )
        for row in reversed(rows)
    ]


def _next_sequence(db: Session, session_id: str) -> int:
    """One past the highest sequence in this session."""
    highest = db.scalar(
        select(func.max(ChatMessage.sequence)).where(
            ChatMessage.session_id == session_id
        )
    )
    return (highest or 0) + 1


def _apply_session_config(
    session: ChatSession, payload: ChatMessageIn, *, first_turn: bool
) -> None:
    """Fold this message's selections into the session's stored configuration."""
    if payload.agent_id is not None:
        session.agent_id = payload.agent_id or None
    if payload.skill_id is not None:
        session.skill_id = payload.skill_id or None
    if payload.prompt_id is not None:
        session.prompt_id = payload.prompt_id or None
    if payload.workflow_id is not None:
        session.workflow_id = payload.workflow_id or None
    if payload.model is not None:
        session.model = payload.model or None

    # Auto-title from the first thing the user actually said.
    if first_turn and session.title in (None, "", "New Chat", "New Session"):
        session.title = payload.content[:80].strip() or "New Chat"


def _persist_user_turn(
    db: Session, session: ChatSession, payload: ChatMessageIn
) -> ChatMessage:
    """Write the user's turn, retrying if another turn claimed its sequence.

    A sequence is derived from the current maximum, so two concurrent turns in
    one session can compute the same number. The unique constraint turns that
    into an ``IntegrityError`` instead of an interleaved transcript — but only
    re-reading the maximum actually resolves it, so retry rather than 500.
    """
    for attempt in range(SEQUENCE_RETRIES):
        next_seq = _next_sequence(db, session.id)
        user_msg = ChatMessage(
            session_id=session.id,
            sequence=next_seq,
            role=ChatRole.USER,
            content=payload.content,
            agent_id=payload.agent_id,
            model=payload.model,
        )
        db.add(user_msg)
        _apply_session_config(session, payload, first_turn=next_seq == 1)
        try:
            db.commit()
        except IntegrityError:
            # Rolls back the config edits too; the next pass re-applies them
            # against a session that has been reloaded from the database.
            db.rollback()
            if attempt == SEQUENCE_RETRIES - 1:
                raise HTTPException(
                    409,
                    "Another message is being written to this session. Retry in "
                    "a moment.",
                ) from None
            continue
        db.refresh(user_msg)
        return user_msg

    raise AssertionError("unreachable: the retry loop always returns or raises")


@router.post("/sessions/{session_id}/messages")
async def send_message(
    session_id: str,
    payload: ChatMessageIn,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_operator),
):
    """Send a message and stream the assistant's response via SSE."""
    session = db.query(ChatSession).filter_by(id=session_id).first()
    if not session:
        raise HTTPException(404, f"Session '{session_id}' not found")
    http_deny_unless_owner(principal, session.created_by, kind="Session")
    slot = await _acquire_chat_slot(principal)

    try:
        # Read the history *before* persisting this message, so the transcript sent
        # to the agent ends at the previous turn.
        history = _load_history(db, session_id, HISTORY_TURNS)
        _persist_user_turn(db, session, payload)
    except Exception:
        _release_chat_slot(slot)
        raise

    config = ChatConfig(
        content=payload.content,
        agent_id=payload.agent_id or session.agent_id,
        skill_id=payload.skill_id or session.skill_id,
        prompt_id=payload.prompt_id or session.prompt_id,
        model=payload.model or session.model,
        github_token=payload.github_token,
        engine=payload.engine,
        history=history,
    )

    def _persist_reply(text: str, elapsed_ms: int, *, interrupted: bool) -> None:
        """Write the assistant's turn, however the stream ended.

        Persisting only on clean completion loses the whole response when a
        user presses Stop — and leaves a user turn in history with no reply,
        which then corrupts every later prompt.

        Never raises. This runs after the response has already been streamed to
        the caller, so failing here would break a turn the user has read.
        """
        if not text.strip():
            return
        from app.database import SessionLocal

        content = text + (STOPPED_MARKER if interrupted else "")
        try:
            with SessionLocal() as write_db:
                for attempt in range(SEQUENCE_RETRIES):
                    write_db.add(
                        ChatMessage(
                            session_id=session_id,
                            sequence=_next_sequence(write_db, session_id),
                            role=ChatRole.ASSISTANT,
                            content=content,
                            agent_id=config.agent_id,
                            model=config.model,
                            duration_ms=elapsed_ms,
                        )
                    )
                    existing = (
                        write_db.query(ChatSession).filter_by(id=session_id).first()
                    )
                    if existing:
                        existing.last_activity = datetime.now(timezone.utc)
                    try:
                        write_db.commit()
                    except IntegrityError:
                        write_db.rollback()
                        if attempt == SEQUENCE_RETRIES - 1:
                            raise
                        continue
                    return
        except Exception:  # noqa: BLE001
            logger.exception(
                "Could not persist the assistant turn for session %s", session_id
            )

    async def event_stream():
        """SSE stream: yields `data:` lines with JSON payloads."""
        collected: list[str] = []
        start = time.monotonic()

        def elapsed_ms() -> int:
            return int((time.monotonic() - start) * 1000)

        try:
            try:
                async for chunk in execute_streaming(config):
                    collected.append(chunk)
                    yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"

            except (asyncio.CancelledError, GeneratorExit):
                _persist_reply("".join(collected), elapsed_ms(), interrupted=True)
                raise

            except Exception as exc:  # noqa: BLE001
                logger.exception("SSE stream error")
                _persist_reply("".join(collected), elapsed_ms(), interrupted=True)
                yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"
                return

            duration = elapsed_ms()
            _persist_reply("".join(collected), duration, interrupted=False)

            yield "data: " + json.dumps(
                {
                    "type": "done",
                    "duration_ms": duration,
                    "agent_id": config.agent_id,
                    "model": config.model,
                }
            ) + "\n\n"
        finally:
            _release_chat_slot(slot)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ============================================================ one-shot

@router.post("/execute")
async def execute_one_shot(
    payload: OneShotRequest,
    principal: Principal = Depends(require_operator),
):
    """Fire-and-forget single execution — no session persistence, SSE stream."""
    slot = await _acquire_chat_slot(principal)
    config = ChatConfig(
        content=payload.content,
        agent_id=payload.agent_id,
        skill_id=payload.skill_id,
        prompt_id=payload.prompt_id,
        model=payload.model,
        github_token=payload.github_token,
        engine=payload.engine,
    )

    async def event_stream():
        try:
            async for chunk in execute_streaming(config):
                yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"

            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except Exception as exc:  # noqa: BLE001
            logger.exception("One-shot execution error")
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"
        finally:
            _release_chat_slot(slot)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
