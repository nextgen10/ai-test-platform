"""Request/response schemas for the chat API."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.config import settings

#: Read once at import so ``CHAT_MAX_MESSAGE_CHARS`` actually reaches validation
#: instead of the limit being duplicated as a literal here.
MAX_MESSAGE_CHARS = settings.chat_max_message_chars


class ChatMessageIn(BaseModel):
    """User sends a message to a chat session."""
    content: str = Field(..., min_length=1, max_length=MAX_MESSAGE_CHARS)
    agent_id: str | None = Field(default=None, max_length=128)
    workflow_id: str | None = Field(default=None, max_length=128)
    skill_id: str | None = Field(default=None, max_length=128)
    prompt_id: str | None = Field(default=None, max_length=128)
    model: str | None = Field(default=None, max_length=64)
    github_token: str | None = Field(default=None, max_length=256)
    engine: str | None = Field(default=None, max_length=32)


class ChatSessionCreate(BaseModel):
    """Create a new chat session with optional pre-configuration."""
    title: str = Field(default="New Chat", max_length=256)
    agent_id: str | None = None
    skill_id: str | None = None
    workflow_id: str | None = None
    prompt_id: str | None = None
    model: str | None = None


class ChatMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: str
    sequence: int
    role: str
    content: str
    created_at: datetime
    agent_id: str | None = None
    model: str | None = None
    duration_ms: int | None = None


class ChatSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    created_at: datetime
    last_activity: datetime
    created_by: str | None = None
    agent_id: str | None = None
    skill_id: str | None = None
    workflow_id: str | None = None
    prompt_id: str | None = None
    model: str | None = None
    #: A bounded window, newest last. Compare with ``message_total`` to tell
    #: whether this is the whole conversation or only its tail.
    messages: list[ChatMessageOut] = []
    message_total: int = 0


class ChatSessionSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    created_at: datetime
    last_activity: datetime
    created_by: str | None = None
    agent_id: str | None = None
    model: str | None = None


class OneShotRequest(BaseModel):
    """Fire-and-forget single execution — no session.

    Exposed for scripted callers; the Agent Console itself always works through
    a session so the transcript survives a reload.
    """
    content: str = Field(..., min_length=1, max_length=MAX_MESSAGE_CHARS)
    agent_id: str | None = None
    skill_id: str | None = None
    prompt_id: str | None = None
    model: str | None = None
    github_token: str | None = Field(default=None, max_length=256)
    engine: str | None = None
