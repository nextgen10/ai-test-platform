#!/usr/bin/env bash
#
# Domino / RiskLab notebook-session entrypoint for agent-hub-vite.
#
# Single public process on PORT (default 8080):
#   1. Build the Vite UI with VITE_BASE_PATH under the Domino proxy prefix
#   2. Copy dist into the backend tree
#   3. Run uvicorn — FastAPI serves /api/v1 and the SPA
#
# IMPORTANT: browser API calls must stay under the notebookSession proxy URL.
# Do NOT point the UI at a raw /api path; Domino returns Unauthorized HTML.
#
set -Eeuo pipefail

echo "az login"
az login || true

# Prefer the Domino clone path; fall back to this script's directory.
REPO_ROOT="${REPO_ROOT:-/repos/${DOMINO_PROJECT_OWNER}/${DOMINO_PROJECT_NAME}}"
if [[ ! -f "${REPO_ROOT}/package.json" || ! -d "${REPO_ROOT}/backend" ]]; then
    REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

rm -rf /mnt/frontend_src /mnt/backend_src /mnt/agent-hub /mnt/schemas /mnt/runner
mkdir -p /mnt/frontend_src

# Frontend is the Vite app at the repo root (not a frontend/ subfolder).
# Skip heavy / runtime dirs — npm install and build run fresh on /mnt.
if command -v rsync >/dev/null 2>&1; then
    rsync -a         --exclude '.git/'         --exclude '.venv/'         --exclude 'node_modules/'         --exclude 'dist/'         --exclude 'backend/'         --exclude 'logs/'         --exclude 'artifacts/'         --exclude '.job-runtime/'         --exclude 'jobs.db'         --exclude 'jobs.db-*'         "${REPO_ROOT}/" /mnt/frontend_src/
else
    cp -Rtf "${REPO_ROOT}/." /mnt/frontend_src/
    rm -rf /mnt/frontend_src/.venv /mnt/frontend_src/node_modules /mnt/frontend_src/dist            /mnt/frontend_src/backend /mnt/frontend_src/logs /mnt/frontend_src/artifacts            /mnt/frontend_src/.job-runtime
fi

cp -Rtf "${REPO_ROOT}/backend" /mnt/backend_src
cp -Rtf "${REPO_ROOT}/agent-hub" /mnt/agent-hub
[[ -d "${REPO_ROOT}/schemas" ]] && cp -Rtf "${REPO_ROOT}/schemas" /mnt/schemas
[[ -d "${REPO_ROOT}/runner" ]] && cp -Rtf "${REPO_ROOT}/runner" /mnt/runner

LOG_DIR="/mnt/logs"
mkdir -p "$LOG_DIR" /mnt/data /mnt/artifacts

# Load .env as *defaults*: anything already in the environment wins.
load_env_defaults() {
    local file="$1" line key value
    while IFS= read -r line || [[ -n "$line" ]]; do
        line="${line#"${line%%[![:space:]]*}"}"
        [[ -z "$line" || "$line" == \#* ]] && continue
        line="${line#export }"
        [[ "$line" != *=* ]] && continue
        key="${line%%=*}"
        value="${line#*=}"
        key="${key%"${key##*[![:space:]]}"}"
        [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
        value="${value%\"}"; value="${value#\"}"
        value="${value%\'}"; value="${value#\'}"
        [[ -n "${!key+x}" ]] && continue
        export "$key=$value"
    done < "$file"
}

if [[ -f "${REPO_ROOT}/.env" ]]; then
    load_env_defaults "${REPO_ROOT}/.env"
    echo "Loaded ${REPO_ROOT}/.env"
fi

: "${EXECUTOR:=local}"
: "${ENGINE:=mock}"
: "${PORT:=8080}"
: "${BACKEND_PORT:=${PORT}}"
# Demo is open even if .env still has AUTH_MODE=token.
AUTH_MODE=disabled
: "${ENABLE_DOCS:=1}"
export EXECUTOR ENGINE AUTH_MODE ENABLE_DOCS PORT BACKEND_PORT
export AGENT_HUB_DIR="/mnt/agent-hub"
export AGENT_HUB_SEED="/mnt/agent-hub"
export PYTHONPATH="/mnt/backend_src${PYTHONPATH:+:$PYTHONPATH}"
export STATIC_DIR="/mnt/backend_src/dist"
export DATABASE_URL="${DATABASE_URL:-sqlite:////mnt/data/jobs.db}"
export ARTIFACT_ROOT="${ARTIFACT_ROOT:-/mnt/artifacts}"

# Domino notebook-session URLs — same shape as TestGenie.
# Domino strips /proxy/${PORT} when forwarding; the app sees / and /api/v1.
export BASE_URL="${RISKLAB_HOST_NAME}${DOMINO_PROJECT_OWNER}/${DOMINO_PROJECT_NAME}/r/notebookSession/${DOMINO_RUN_ID}/"
export SERVER_URL="${RISKLAB_HOST_NAME}${DOMINO_PROJECT_OWNER}/${DOMINO_PROJECT_NAME}/r/notebookSession/${DOMINO_RUN_ID}/proxy/${PORT}/"
# Baked into the Vite build for asset URLs + same-origin /api/v1 calls.
export VITE_BASE_PATH="/${DOMINO_PROJECT_OWNER}/${DOMINO_PROJECT_NAME}/r/notebookSession/${DOMINO_RUN_ID}/proxy/${PORT}"
export CORS_ORIGINS="${CORS_ORIGINS:-*}"

echo "REPO_ROOT: $REPO_ROOT"
echo "BASE_URL: $BASE_URL"
echo "SERVER_URL: $SERVER_URL"
echo "VITE_BASE_PATH: $VITE_BASE_PATH"
echo "STATIC_DIR: $STATIC_DIR"

if [[ -z "${PYTHON:-}" ]]; then
    if [[ -x /opt/conda/envs/py311/bin/python ]]; then
        PYTHON=/opt/conda/envs/py311/bin/python
    else
        PYTHON=python3
    fi
fi

if [[ "$AUTH_MODE" == "token" && -z "${API_TOKENS:-}" ]]; then
    DEV_TOKEN="$("$PYTHON" -c 'import secrets; print(secrets.token_urlsafe(32))')"
    export API_TOKENS="${DEV_TOKEN}:local-dev:admin"
    export API_TOKEN="$DEV_TOKEN"
    echo "  auth     token mode, dev credential generated for this run"
elif [[ "$AUTH_MODE" == "disabled" ]]; then
    unset API_TOKEN || true
    echo "  auth     off — no login, no token"
else
    : "${API_TOKEN:=}"
    echo "  auth     token mode, using API_TOKENS from the environment"
fi
export API_TOKEN="${API_TOKEN:-}"

echo "Agent HUB (Vite) — Domino"
echo "  executor : $EXECUTOR"
echo "  engine   : $ENGINE"
echo "  port     : $PORT (UI + API)"
if [[ "$ENGINE" == "mock" ]]; then
    echo "             (deterministic stand-in — set ENGINE=copilot for real generation)"
fi
echo ""

# -------------------------
# Frontend build
# -------------------------
cd /mnt/frontend_src
node -v || true
npm -v || true
npm config set registry "https://nexus-write.ldn.swissbank.com/nexus/content/groups/public-npm/" || true

# -------------------------
# Copilot CLI (real generation only)
# Domino compute envs do not use our Docker images, so install here when needed.
# -------------------------
if [[ "${ENGINE}" == "copilot" ]]; then
    echo "Installing GitHub Copilot CLI globally…"
    npm install -g @github/copilot >> "$LOG_DIR/frontend.log" 2>&1
    export PATH="$(npm root -g)/../bin:${PATH}"
    if ! command -v copilot >/dev/null 2>&1; then
        echo "copilot not on PATH after install" >&2
        exit 1
    fi
    echo "  copilot  $(command -v copilot) ($(copilot --version 2>/dev/null | head -1 || echo installed))"
    if [[ -z "${COPILOT_GITHUB_TOKEN:-}${GH_TOKEN:-}${GITHUB_TOKEN:-}" ]]; then
        echo "  warning: ENGINE=copilot but no COPILOT_GITHUB_TOKEN/GH_TOKEN/GITHUB_TOKEN set" >&2
    fi
fi

echo "Installing frontend dependencies…"
npm install --no-audit --no-fund >> "$LOG_DIR/frontend.log" 2>&1

echo "Building Vite UI (base=$VITE_BASE_PATH)…"
VITE_BASE_PATH="$VITE_BASE_PATH" \
VITE_AUTH_ENABLED="${VITE_AUTH_ENABLED:-false}" \
    npm run build >> "$LOG_DIR/frontend.log" 2>&1

# Copy React/Vite build into backend so FastAPI can serve it
rm -rf /mnt/backend_src/dist
cp -RTf /mnt/frontend_src/dist /mnt/backend_src/dist

# -------------------------
# Backend deps
# -------------------------
cd /mnt/backend_src
"$PYTHON" -m pip install -U pip
"$PYTHON" -m pip install -r requirements.txt

echo "Cleaning up any processes on port $PORT..."
lsof -t -i:"$PORT" | xargs kill -9 2>/dev/null || true

echo "Starting Agent HUB on 0.0.0.0:$PORT (SPA + /api/v1)…"
echo "  UI  $SERVER_URL"
echo "  API ${SERVER_URL}api/v1/health"
echo "  logs $LOG_DIR/"
echo ""

exec "$PYTHON" -m uvicorn app.main:app --host 0.0.0.0 --port "${PORT}"
