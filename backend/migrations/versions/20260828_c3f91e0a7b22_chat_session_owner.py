"""chat session owner

Revision ID: c3f91e0a7b22
Revises: a270c776cab7
Create Date: 2026-08-28
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "c3f91e0a7b22"
down_revision = "a270c776cab7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("chat_sessions", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "created_by",
                sa.String(length=128),
                nullable=False,
                server_default="anonymous",
            )
        )
        batch_op.create_index(
            batch_op.f("ix_chat_sessions_created_by"), ["created_by"], unique=False
        )


def downgrade() -> None:
    with op.batch_alter_table("chat_sessions", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_chat_sessions_created_by"))
        batch_op.drop_column("created_by")
