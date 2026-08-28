# syntax=docker/dockerfile:1
#
# Orchestrator image. Build from the repository root:
#     docker build -f backend/Dockerfile -t ai-test-orchestrator:dev .
FROM python:3.12-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /srv

COPY backend/requirements.txt /srv/requirements.txt
RUN pip install --no-cache-dir -r /srv/requirements.txt \
    # Required for EXECUTOR=kubernetes and for a PostgreSQL DATABASE_URL.
    # Both are the production configuration, so both are in the image.
    && pip install --no-cache-dir kubernetes==31.0.0 "psycopg[binary]==3.2.3"

COPY backend/app /srv/app
COPY backend/migrations /srv/migrations
COPY schemas /srv/schemas
COPY agent-hub /srv/agent-hub

ENV PYTHONPATH=/srv \
    AGENT_HUB_DIR=/srv/agent-hub \
    AGENT_HUB_SEED=/srv/agent-hub

RUN useradd --create-home --uid 10001 orchestrator \
    && mkdir -p /artifacts \
    && chown -R orchestrator:orchestrator /artifacts /srv

USER orchestrator

EXPOSE 8100

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8100"]
