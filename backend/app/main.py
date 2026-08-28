"""AI Test Platform — FastAPI orchestrator.

Responsibilities (blueprint §5): validate input, create the job record, dispatch
execution, track status, expose logs, results and artifacts. It performs no
generation itself — that is the runner's job.
"""
from __future__ import annotations

import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import router
from app.api.hub_routes import router as hub_router
from app.api.chat_routes import router as chat_router
from app.api.automation_routes import router as automation_router
from app.api.lab_routes import router as lab_router
from app.config import settings
from app.database import init_db
from app.logging_config import configure_logging, request_id_var
from app.security import configure_auth

configure_logging()
logger = logging.getLogger("ai-test-platform")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auth first: a misconfigured deployment must fail before it touches the
    # database or accepts a single request.
    configure_auth()

    init_db()

    from app.services import hub_registry, queue, scheduler
    from app.services.job_service import backfill_missing_evaluations

    hub_registry.seed_hub()

    # Jobs abandoned by a worker that stopped renewing its lease go back in the
    # pool. This is no longer "fail everything in flight": with leases, another
    # replica's work is not mistaken for wreckage.
    queue.reclaim_expired()
    backfill_missing_evaluations()

    worker = queue.start_worker()
    scheduler.start()

    logger.info(
        "Orchestrator ready | executor=%s engine=%s auth=%s worker=%s artifacts=%s",
        settings.executor,
        settings.engine,
        settings.auth_mode,
        "on" if worker else "off",
        settings.artifact_root,
    )
    if settings.engine == "mock":
        logger.warning(
            "ENGINE=mock — jobs produce deterministic stand-in output, not real "
            "Copilot generation. Set ENGINE=copilot with a Copilot-enabled token "
            "for real runs."
        )
    try:
        yield
    finally:
        scheduler.stop()
        queue.stop_worker()
        if worker:
            logger.info("worker stopped")


_docs = "/docs" if settings.enable_docs or settings.auth_mode == "disabled" else None

app = FastAPI(
    title="Agent Hub",
    version="0.3.0",
    description=(
        "Agent Hub — GHCP-driven multi-agent platform. Browse, manage, and "
        "trigger agents, workflows, skills, and prompts through a unified "
        "chatbot interface or dedicated custom UIs."
    ),
    lifespan=lifespan,
    docs_url=_docs,
    redoc_url="/redoc" if _docs else None,
    openapi_url="/openapi.json" if _docs else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def correlate_requests(request: Request, call_next):
    """Give every request an ID and thread it through the logs and the response.

    Without this, diagnosing a failed run in production means reading a
    workspace on disk and guessing which log lines belong to it.
    """
    incoming = request.headers.get("x-request-id", "").strip()
    request_id = incoming[:64] if incoming else uuid.uuid4().hex[:12]
    token = request_id_var.set(request_id)
    try:
        response = await call_next(request)
    finally:
        request_id_var.reset(token)
    response.headers["X-Request-ID"] = request_id
    return response


app.include_router(router)
app.include_router(hub_router)
app.include_router(chat_router)
app.include_router(automation_router)
app.include_router(lab_router)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception during request")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error. Please contact support if the issue persists."},
    )


@app.get("/", tags=["meta"])
def root() -> dict[str, str]:
    payload = {"service": settings.app_name, "api": settings.api_prefix}
    if _docs:
        payload["docs"] = "/docs"
    return payload
