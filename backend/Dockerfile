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
    && pip install --no-cache-dir kubernetes==31.0.0 "psycopg[binary]==3.2.3" jsonschema==4.23.0

ARG COPILOT_CLI_VERSION=1.0.79
COPY --from=node:22-bookworm-slim /usr/local/bin/node /usr/local/bin/node
COPY --from=node:22-bookworm-slim /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
    && npm install -g "@github/copilot@${COPILOT_CLI_VERSION}" \
    && npm cache clean --force

COPY backend/app /srv/app
COPY backend/migrations /srv/migrations
COPY schemas /srv/schemas
COPY agent-hub /srv/agent-hub
COPY runner /srv/runner

ENV PYTHONPATH=/srv \
    AGENT_HUB_DIR=/srv/agent-hub \
    AGENT_HUB_SEED=/srv/agent-hub

RUN useradd --create-home --uid 10001 orchestrator \
    && mkdir -p /artifacts \
    && chown -R orchestrator:orchestrator /artifacts /srv

USER orchestrator

EXPOSE 8100

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8100"]
