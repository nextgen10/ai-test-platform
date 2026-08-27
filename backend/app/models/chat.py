"""Chat session and message persistence models."""
from __future__ import annotations

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_id() -> str:
    return uuid.uuid4().hex[:12]


class ChatRole(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String(32), primary_key=True, default=_new_id)
    title = Column(String(256), default="New Chat")
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    last_activity = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    # Configuration snapshot — what agent/skill/model was selected
    agent_id = Column(String(128), nullable=True)
    skill_id = Column(String(128), nullable=True)
    workflow_id = Column(String(128), nullable=True)
    prompt_id = Column(String(128), nullable=True)
    model = Column(String(64), nullable=True)

    messages = relationship(
        "ChatMessage",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ChatMessage.sequence",
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    #: Two concurrent sends to one session would otherwise both read the same
    #: highest sequence and write it twice, interleaving the transcript.
    __table_args__ = (
        UniqueConstraint("session_id", "sequence", name="uq_chat_message_sequence"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(
        String(32),
        ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sequence = Column(Integer, nullable=False)
    role = Column(Enum(ChatRole), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    # Optional metadata: which agent/model actually handled this message
    agent_id = Column(String(128), nullable=True)
    model = Column(String(64), nullable=True)
    duration_ms = Column(Integer, nullable=True)

    session = relationship("ChatSession", back_populates="messages")
