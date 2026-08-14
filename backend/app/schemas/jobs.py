"""Request/response contracts."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.config import settings
from app.models.jobs import JobStatus

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
    workflow: Literal["test-case-generation"] = "test-case-generation"
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
