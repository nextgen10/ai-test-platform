"""Chat API — session management and SSE streaming endpoints."""
from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.access import http_deny_unless_owner, is_admin
from app.config import settings
from app.database import get_db
from app.models.chat import ChatMessage, ChatRole, ChatSession
from app.schemas.chat import (
    ChatMessageIn,
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

_global_chat_slots = asyncio.Semaphore(max(1, settings.chat_max_concurrent_total))
_user_chat_slots: dict[str, asyncio.Semaphore] = {}
_user_chat_lock = asyncio.Lock()


async def _acquire_chat_slot(principal: Principal) -> asyncio.Semaphore:
    """Bound concurrent Copilot processes per caller and globally."""
    per_user = max(1, settings.chat_max_concurrent_per_user)
    async with _user_chat_lock:
        slot = _user_chat_slots.setdefault(principal.name, asyncio.Semaphore(per_user))
    try:
        await asyncio.wait_for(_global_chat_slots.acquire(), timeout=0.05)
    except TimeoutError as exc:
        raise HTTPException(
            429, "The chat service is busy; retry shortly"
        ) from exc
    try:
        await asyncio.wait_for(slot.acquire(), timeout=0.05)
    except TimeoutError as exc:
        _global_chat_slots.release()
        raise HTTPException(
            429, "Too many concurrent chat turns for this user"
        ) from exc
    return slot


def _release_chat_slot(slot: asyncio.Semaphore) -> None:
    slot.release()
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
    limit: int = 50,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_reader),
) -> list[ChatSessionSummary]:
    query = db.query(ChatSession)
    if not is_admin(principal):
        query = query.filter(ChatSession.created_by == principal.name)
    sessions = (
        query.order_by(ChatSession.last_activity.desc())
        .limit(max(1, min(limit, 200)))
        .all()
    )
    return [ChatSessionSummary.model_validate(s) for s in sessions]


@router.get("/sessions/{session_id}", response_model=ChatSessionOut)
def get_session(
    session_id: str,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_reader),
) -> ChatSessionOut:
    session = db.query(ChatSession).filter_by(id=session_id).first()
    if not session:
        raise HTTPException(404, f"Session '{session_id}' not found")
    http_deny_unless_owner(principal, session.created_by, kind="Session")
    return ChatSessionOut.model_validate(session)


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

        next_seq = _next_sequence(db, session_id)

        user_msg = ChatMessage(
            session_id=session_id,
            sequence=next_seq,
            role=ChatRole.USER,
            content=payload.content,
            agent_id=payload.agent_id,
            model=payload.model,
        )
        db.add(user_msg)

        # Update session config if changed
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
        if next_seq == 1 and session.title in (None, "", "New Chat", "New Session"):
            session.title = payload.content[:80].strip() or "New Chat"

        db.commit()
        db.refresh(user_msg)
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
        """
        if not text.strip():
            return
        from app.database import SessionLocal

        with SessionLocal() as write_db:
            write_db.add(
                ChatMessage(
                    session_id=session_id,
                    sequence=_next_sequence(write_db, session_id),
                    role=ChatRole.ASSISTANT,
                    content=text + ("\n\n_[stopped by the user]_" if interrupted else ""),
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
            write_db.commit()

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
