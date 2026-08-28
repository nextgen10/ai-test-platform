"""Request/response schemas for the chat API."""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ChatMessageIn(BaseModel):
    """User sends a message to a chat session."""
    content: str = Field(..., min_length=1, max_length=50_000)
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
    messages: list[ChatMessageOut] = []


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
    """Fire-and-forget single execution — no session."""
    content: str = Field(..., min_length=1, max_length=50_000)
    agent_id: str | None = None
    skill_id: str | None = None
    prompt_id: str | None = None
    model: str | None = None
    github_token: str | None = Field(default=None, max_length=256)
    engine: str | None = None
