# syntax=docker/dockerfile:1
#
# Copilot runner image. Disposable, minimal, non-root.
# Build from the repository root so the copilot/ and schemas/ trees are in scope:
#     docker build -f runner/Dockerfile -t ai-test-runner:dev .
#
# Pin these digests/versions before any production build (blueprint §16).
FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    APP_DIR=/app \
    WORKSPACE=/workspace

# python3 for the chain driver and validator; ca-certificates for TLS to the
# Copilot endpoint. No compilers, no cloud CLIs, no docker, no kubectl.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# GitHub Copilot CLI. Pinned: this is the version the runner's flag usage in
# agent_chain.py was verified against (`copilot help permissions`). Bump
# deliberately and re-verify — CLI syntax has changed between releases.
ARG COPILOT_CLI_VERSION=1.0.79
RUN npm install -g "@github/copilot@${COPILOT_CLI_VERSION}" \
    && npm cache clean --force

WORKDIR /app

COPY runner/requirements.txt /app/requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r /app/requirements.txt

# Skills and agent profiles — Copilot resolves these from .github/ in the cwd.
COPY copilot/.github /app/.github
COPY schemas /app/schemas
COPY runner/agent_chain.py runner/validate_output.py runner/entrypoint.sh /app/

RUN chmod +x /app/entrypoint.sh \
    && useradd --create-home --uid 10001 runner \
    && mkdir -p /workspace \
    && chown -R runner:runner /workspace /app

USER runner

ENTRYPOINT ["/app/entrypoint.sh"]
