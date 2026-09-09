"""AI Test Platform — FastAPI orchestrator.

Responsibilities (blueprint §5): validate input, create the job record, dispatch
execution, track status, expose logs, results and artifacts. It performs no
generation itself — that is the runner's job.
"""
from __future__ import annotations

import logging
import os
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import router
from app.api.hub_routes import router as hub_router
from app.api.chat_routes import router as chat_router
from app.api.automation_routes import router as automation_router
from app.api.lab_routes import router as lab_router
from app.config import PROJECT_ROOT, settings
from app.database import init_db
from app.logging_config import configure_logging, request_id_var
from app.security import configure_auth

configure_logging()
logger = logging.getLogger("ai-test-platform")


def _resolve_static_dir() -> Path | None:
    """Vite build output for Domino / single-process deploys.

    Prefers STATIC_DIR, then backend/dist (app.sh copy target), then repo dist/.
    """
    candidates: list[Path] = []
    env = os.getenv("STATIC_DIR", "").strip()
    if env:
        candidates.append(Path(env))
    candidates.append(Path(__file__).resolve().parents[1] / "dist")
    candidates.append(PROJECT_ROOT / "dist")
    for path in candidates:
        if (path / "index.html").is_file():
            return path.resolve()
    return None


STATIC_DIR = _resolve_static_dir()


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
        "Orchestrator ready | executor=%s engine=%s auth=%s worker=%s artifacts=%s static=%s",
        settings.executor,
        settings.engine,
        settings.auth_mode,
        "on" if worker else "off",
        settings.artifact_root,
        STATIC_DIR or "off",
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
    """Never leak an internal error to a caller — but do give them the thread.

    The request id is already on every log line for this request, so quoting it
    back turns "it broke" into a support ticket someone can actually grep for.
    The exception itself stays in the log where it belongs.
    """
    logger.exception("Unhandled exception during request")
    # "-" is the contextvar's default, meaning nothing set an id for this
    # request. Quoting that back would send someone hunting for a log line
    # that says nothing about them.
    request_id = request_id_var.get()
    known = request_id not in ("", "-")
    detail = "Internal Server Error."
    if known:
        detail += f" Quote request {request_id} when reporting this."
    else:
        detail += " Please contact support if the issue persists."

    return JSONResponse(
        status_code=500,
        content={"detail": detail, "request_id": request_id if known else None},
        headers={"X-Request-ID": request_id} if known else None,
    )


@app.get("/", tags=["meta"])
def root():
    """Serve the Vite SPA when a build is present; otherwise a small service map."""
    if STATIC_DIR is not None:
        return FileResponse(STATIC_DIR / "index.html")
    payload = {"service": settings.app_name, "api": settings.api_prefix}
    if _docs:
        payload["docs"] = "/docs"
    return payload


# Domino / single-port: FastAPI serves the Vite build next to /api/v1.
if STATIC_DIR is not None:
    assets_dir = STATIC_DIR / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa_fallback(full_path: str):
        """Client-side routes and public files from dist/ (favicon, etc.)."""
        # Never shadow the API or OpenAPI surfaces.
        if full_path == "api" or full_path.startswith("api/"):
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        if full_path in {"docs", "redoc", "openapi.json"} or full_path.startswith(
            ("docs/", "redoc/")
        ):
            return JSONResponse({"detail": "Not Found"}, status_code=404)

        candidate = (STATIC_DIR / full_path).resolve()
        try:
            candidate.relative_to(STATIC_DIR)
        except ValueError:
            return FileResponse(STATIC_DIR / "index.html")
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(STATIC_DIR / "index.html")
