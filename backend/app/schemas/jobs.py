"""Request/response contracts."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.config import settings
from app.models.jobs import JobStatus

# Legacy constant for backward compatibility; the real set is now dynamic via
# hub_registry.get_registered_workflow_ids().
WORKFLOWS = {"test-case-generation"}

#: Models known to work with the Copilot CLI as of v0.0.365+.
AVAILABLE_MODELS = [
    {"id": "claude-3.5-sonnet", "name": "Claude 3.5 Sonnet", "provider": "Anthropic"},
    {"id": "claude-3.7-sonnet", "name": "Claude 3.7 Sonnet", "provider": "Anthropic"},
    {"id": "claude-3.5-haiku", "name": "Claude 3.5 Haiku", "provider": "Anthropic"},
    {"id": "gpt-4o", "name": "GPT-4o", "provider": "OpenAI"},
    {"id": "gpt-4o-mini", "name": "GPT-4o Mini", "provider": "OpenAI"},
    {"id": "o1", "name": "o1", "provider": "OpenAI"},
    {"id": "o3-mini", "name": "o3-mini", "provider": "OpenAI"},
]


class JobCreateRequest(BaseModel):
    workflow: str = Field(
        default="test-case-generation",
        max_length=128,
        description="Workflow ID from the agent-hub registry.",
    )
    requirement: str = Field(..., min_length=20)
    output_format: Literal["json"] = "json"
    created_by: str = Field(default="anonymous", max_length=128)
    copilot_model: str | None = Field(
        default=None,
        max_length=64,
        description="Override the model the agents use. None = platform default.",
    )
    github_token: str | None = Field(
        default=None,
        max_length=256,
        description="Per-user GitHub PAT for Copilot. Never stored — used for this job only.",
    )
    engine: Literal["mock", "copilot"] | None = Field(
        default=None,
        description="Override the execution engine (mock or copilot). None = platform default.",
    )
    webhook_url: str | None = Field(
        default=None,
        max_length=2048,
        description=(
            "POSTed a JSON summary when this job reaches a terminal state. "
            "Must be https to a public host — private, link-local and metadata "
            "addresses are rejected."
        ),
    )
    used_ocr: bool = Field(
        default=False,
        description=(
            "True when the requirement text was produced by the client-side "
            "document-ocr extraction step rather than typed/pasted directly. "
            "Recorded so job progress/provenance can reflect it."
        ),
    )

    @field_validator("requirement")
    @classmethod
    def _bounded(cls, value: str) -> str:
        text = value.strip()
        if not text:
            raise ValueError("requirement must not be blank")
        if len(text) > settings.max_requirement_chars:
            raise ValueError(
                f"requirement exceeds {settings.max_requirement_chars} characters"
            )
        return text

    @field_validator("webhook_url")
    @classmethod
    def _public_https_webhook(cls, value: str | None) -> str | None:
        from app.services.url_guard import UnsafeURL, optional_https_webhook

        try:
            return optional_https_webhook(value)
        except UnsafeURL as exc:
            raise ValueError(str(exc)) from exc


class JobEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    timestamp: datetime
    event_type: str
    message: str
    event_metadata: dict[str, Any] | None = None


class ApprovalRequest(BaseModel):
    actor: str = Field(default="anonymous", max_length=128)
    reason: str = Field(default="", max_length=1000)


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workflow: str
    status: JobStatus
    created_by: str
    created_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None
    error_message: str | None = None
    duration_ms: int | None = None
    retry_count: int = 0
    kubernetes_job_name: str | None = None
    summary: dict[str, Any] | None = None
    provenance: dict[str, Any] | None = None
    quality_report: dict[str, Any] | None = None
    evaluation: dict[str, Any] | None = None
    approved_at: datetime | None = None
    approved_by: str | None = None
    reprocess_count: int = 0
    copilot_model: str | None = None
    copilot_token_set: bool = False
    #: Queue state, so an operator can see whether a job is owed or in progress.
    lease_owner: str | None = None
    attempt: int = 0
    schedule_id: str | None = None


class JobDetailOut(JobOut):
    events: list[JobEventOut] = []


class JobCreateResponse(BaseModel):
    job_id: str
    status: JobStatus


class LogsResponse(BaseModel):
    job_id: str
    status: JobStatus
    logs: str


class ResultResponse(BaseModel):
    job_id: str
    status: JobStatus
    result: dict[str, Any]
    validation: dict[str, Any] | None = None
    summary: dict[str, Any] | None = None


class OcrExtractRequest(BaseModel):
    image_base64: str = Field(
        ...,
        # ~20M base64 chars =~ 15MB of raw image bytes — generous for a
        # scanned document/photo while bounding memory use per request; every
        # other field on this model is already length-limited.
        max_length=4_000_000,
        description="Base64 encoded image or document page",
    )
    mime_type: str = Field(default="image/png", max_length=64)
    filename: str | None = Field(default=None, max_length=256)
    copilot_model: str | None = Field(default="gpt-4o", max_length=64)
    github_token: str | None = Field(default=None, max_length=256)
    instructions: str | None = Field(default=None, max_length=1000)


class OcrExtractResponse(BaseModel):
    markdown: str
    filename: str | None = None
    char_count: int
    engine: str = "ghcp-vision"

