"""AI Test Platform — FastAPI orchestrator.

Responsibilities (blueprint §5): validate input, create the job record, dispatch
execution, track status, expose logs, results and artifacts. It performs no
generation itself — that is the runner's job.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.config import settings
from app.database import init_db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
)
logger = logging.getLogger("ai-test-platform")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()

    # Anything still marked active belongs to a process that no longer exists.
    from app.services.job_service import (
        backfill_missing_evaluations,
        reconcile_orphaned_jobs,
    )

    reconcile_orphaned_jobs()
    backfill_missing_evaluations()

    logger.info(
        "Orchestrator ready | executor=%s engine=%s artifacts=%s",
        settings.executor,
        settings.engine,
        settings.artifact_root,
    )
    if settings.engine == "mock":
        logger.warning(
            "ENGINE=mock — jobs produce deterministic stand-in output, not real "
            "Copilot generation. Set ENGINE=copilot with a Copilot-enabled token "
            "for real runs."
        )
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description=(
        "Agentic test-case generation. The UI is a control plane; Kubernetes (or "
        "Docker, or a local subprocess) is the execution layer; Copilot CLI with "
        "SKILL.md and custom agents is the generation layer."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/", tags=["meta"])
def root() -> dict[str, str]:
    return {"service": settings.app_name, "docs": "/docs", "api": settings.api_prefix}
