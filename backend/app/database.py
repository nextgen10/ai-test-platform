"""Database engine and session management."""
from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


_connect_args = (
    {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
)

engine = create_engine(
    settings.database_url,
    connect_args=_connect_args,
    pool_pre_ping=True,
    future=True,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def init_db() -> None:
    from app.models import jobs  # noqa: F401  (register mappings before create_all)

    settings.artifact_root.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    _add_missing_columns()


def _add_missing_columns() -> None:
    """Add columns introduced after a table was first created.

    `create_all` only creates missing *tables*, so a schema change would
    otherwise fail at query time against an existing database. This is a
    deliberately minimal stand-in for a migration tool: it only ever ADDs
    nullable columns, never drops or retypes anything. Reach for Alembic before
    the first change that needs more than this.
    """
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    if "jobs" not in inspector.get_table_names():
        return

    existing = {column["name"] for column in inspector.get_columns("jobs")}
    is_pg = engine.dialect.name == "postgresql"
    additions = {
        "quality_report": "JSON",
        "evaluation": "JSON",
        "approved_at": "TIMESTAMP" if is_pg else "DATETIME",
        "approved_by": "VARCHAR(128)",
        "reprocess_count": "INTEGER DEFAULT 0",
        "copilot_model": "VARCHAR(64)",
        "copilot_token_set": "BOOLEAN DEFAULT FALSE" if is_pg else "BOOLEAN DEFAULT 0",
    }

    with engine.begin() as connection:
        for name, ddl_type in additions.items():
            if name in existing:
                continue
            connection.execute(text(f"ALTER TABLE jobs ADD COLUMN {name} {ddl_type}"))

        # The status column was created as varchar(16), which predates the longer
        # state names ("AWAITING_APPROVAL" is 17). create_all never alters an
        # existing column, so widen it explicitly. SQLite ignores varchar lengths,
        # so this is only needed — and only supported — on PostgreSQL.
        if engine.dialect.name == "postgresql":
            connection.execute(
                text("ALTER TABLE jobs ALTER COLUMN status TYPE VARCHAR(24)")
            )


def get_db() -> Iterator[Session]:
    """FastAPI dependency."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@contextmanager
def session_scope() -> Iterator[Session]:
    """Standalone session for background work, which has no request scope."""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
