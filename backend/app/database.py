"""Database engine and session management."""
from __future__ import annotations

import logging
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    pass


_engine_args = {
    "pool_pre_ping": True,
    "future": True,
}

if settings.database_url.startswith("sqlite"):
    _engine_args["connect_args"] = {"check_same_thread": False}
else:
    # Production-grade connection pooling for PostgreSQL/MySQL
    _engine_args["pool_size"] = 10
    _engine_args["max_overflow"] = 20
    _engine_args["pool_recycle"] = 1800

engine = create_engine(settings.database_url, **_engine_args)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def init_db() -> None:
    """Bring the database up to the current schema.

    Migrations are Alembic's job. This used to be `create_all` plus a hand-rolled
    column adder that could only ever ADD nullable columns — which is why
    `backfill_missing_evaluations` had to exist: that mechanism could create a
    column but never populate it.
    """
    from app.models import jobs  # noqa: F401  (register mappings)
    from app.models import chat  # noqa: F401  (register chat session/message tables)
    from app.models import automation  # noqa: F401  (schedules, webhook deliveries)

    settings.artifact_root.mkdir(parents=True, exist_ok=True)
    _run_migrations()


#: The first Alembic revision. A database created before migrations existed is
#: stamped with this rather than re-created.
_BASELINE_REVISION = "4bfa179c3a31"


def _alembic_config():
    from alembic.config import Config

    migrations_dir = Path(__file__).resolve().parents[1] / "migrations"
    config = Config()
    config.set_main_option("script_location", str(migrations_dir))
    config.set_main_option("sqlalchemy.url", settings.database_url)
    return config


def _run_migrations() -> None:
    from alembic import command
    from sqlalchemy import inspect

    config = _alembic_config()
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    if tables and "alembic_version" not in tables:
        # A database from before migrations were introduced. Its schema already
        # matches the baseline, so record that rather than trying to re-create
        # tables that exist.
        logger.info("Stamping pre-migration database at the baseline revision")
        command.stamp(config, _BASELINE_REVISION)

    command.upgrade(config, "head")


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
