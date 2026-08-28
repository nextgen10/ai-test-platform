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
    AGENT_HUB_DIR=/app/agent-hub \
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

# The hub: agent profiles, skills, prompts and workflow definitions. This is the
# same tree the Registry API reads and writes, so an agent onboarded through the
# UI is visible to a containerised run. Both runners stage `.github/` into the
# job workspace themselves at start-up, which is why none is baked in here.
#
# The subdirectories are copied individually on purpose: `agent-hub/.github`
# holds relative symlinks for local Copilot CLI discovery, and a symlink is not
# something to carry into an image.
COPY agent-hub/agents    /app/agent-hub/agents
COPY agent-hub/skills    /app/agent-hub/skills
COPY agent-hub/prompts   /app/agent-hub/prompts
COPY agent-hub/workflows /app/agent-hub/workflows

COPY schemas /app/schemas

# Both engines ship: agent_chain.py drives test-case-generation, and
# generic_runner.py (with agent_io + workflow_graph) drives every workflow
# onboarded as data. entrypoint.sh picks between them on $RUNNER_KIND — shipping
# only one of the two is how the container executors ended up silently running
# the bespoke chain for every workflow.
COPY runner/agent_chain.py runner/generic_runner.py runner/agent_io.py \
     runner/workflow_graph.py runner/validate_output.py runner/entrypoint.sh /app/

RUN chmod +x /app/entrypoint.sh \
    && useradd --create-home --uid 10001 runner \
    && mkdir -p /workspace \
    && chown -R runner:runner /workspace /app

USER runner

ENTRYPOINT ["/app/entrypoint.sh"]
