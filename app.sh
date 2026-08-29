#!/usr/bin/env bash
#
# Domino / RiskLab notebook-session entrypoint.
# Paths follow TestGenie: copy /repos/... into /mnt, then run from /mnt.
# Next is the public process on 8080; the orchestrator stays on loopback 8100.
# Browser calls stay same-origin under the session proxy prefix.
#
set -Eeuo pipefail

echo "az login"
az login

# Same layout as TestGenie. Override REPO_ROOT if the Hub is nested in a monorepo.
REPO_ROOT="${REPO_ROOT:-/repos/${DOMINO_PROJECT_OWNER}/${DOMINO_PROJECT_NAME}}"
if [[ ! -d "${REPO_ROOT}/frontend" ]]; then
    REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

rm -rf /mnt/frontend_src /mnt/backend_src /mnt/agent-hub /mnt/schemas /mnt/runner
cp -Rtf "${REPO_ROOT}/frontend" /mnt/frontend_src
cp -Rtf "${REPO_ROOT}/backend" /mnt/backend_src
cp -Rtf "${REPO_ROOT}/agent-hub" /mnt/agent-hub
[[ -d "${REPO_ROOT}/schemas" ]] && cp -Rtf "${REPO_ROOT}/schemas" /mnt/schemas
[[ -d "${REPO_ROOT}/runner" ]] && cp -Rtf "${REPO_ROOT}/runner" /mnt/runner

LOG_DIR="/mnt/logs"
mkdir -p "$LOG_DIR"

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
: "${BACKEND_PORT:=8100}"
: "${FRONTEND_PORT:=8080}"
: "${AUTH_MODE:=token}"
: "${ENABLE_DOCS:=1}"
export EXECUTOR ENGINE AUTH_MODE ENABLE_DOCS
export PORT="$FRONTEND_PORT"
export AGENT_HUB_DIR="/mnt/agent-hub"
export AGENT_HUB_SEED="/mnt/agent-hub"
export PYTHONPATH="/mnt/backend_src${PYTHONPATH:+:$PYTHONPATH}"

# Domino notebook-session URLs — same shape as TestGenie.
# Do NOT point the browser at a raw /api path; Domino returns Unauthorized HTML.
# Next serves the UI on FRONTEND_PORT and proxies /api/v1 to loopback.
export BASE_URL="${RISKLAB_HOST_NAME}${DOMINO_PROJECT_OWNER}/${DOMINO_PROJECT_NAME}/r/notebookSession/${DOMINO_RUN_ID}/"
export SERVER_URL="${RISKLAB_HOST_NAME}${DOMINO_PROJECT_OWNER}/${DOMINO_PROJECT_NAME}/r/notebookSession/${DOMINO_RUN_ID}/proxy/${FRONTEND_PORT}/"
export NEXT_PUBLIC_BASE_PATH="/${DOMINO_PROJECT_OWNER}/${DOMINO_PROJECT_NAME}/r/notebookSession/${DOMINO_RUN_ID}/proxy/${FRONTEND_PORT}"
export API_TARGET="http://127.0.0.1:${BACKEND_PORT}"

echo "REPO_ROOT: $REPO_ROOT"
echo "BASE_URL: $BASE_URL"
echo "SERVER_URL: $SERVER_URL"
echo "NEXT_PUBLIC_BASE_PATH: $NEXT_PUBLIC_BASE_PATH"
echo "API_TARGET: $API_TARGET"

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
    export ALLOW_INSECURE_AUTH=1
    echo "  auth     DISABLED — every endpoint is open. Loopback only."
else
    : "${API_TOKEN:=}"
    echo "  auth     token mode, using API_TOKENS from the environment"
    if [[ -z "$API_TOKEN" ]]; then
        echo "           warning: API_TOKEN is unset, so the UI cannot authenticate." >&2
        echo "           Set it to one of the tokens listed in API_TOKENS." >&2
    fi
fi
export API_TOKEN

cleanup() {
    echo ""
    echo "Stopping…"
    [[ -n "${BACKEND_PID:-}" ]] && kill "$BACKEND_PID" 2>/dev/null || true
    [[ -n "${FRONTEND_PID:-}" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
    wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "AI Test Platform"
echo "  executor : $EXECUTOR"
echo "  engine   : $ENGINE"
if [[ "$ENGINE" == "mock" ]]; then
    echo "             (deterministic stand-in — set ENGINE=copilot for real generation)"
fi
echo ""

# --------------------------
# Frontend deps (Next.js, not Vite — no dist/ copy into FastAPI)
# --------------------------
cd /mnt/frontend_src
node -v || true
npm -v || true
npm config set registry "https://nexus-write.ldn.swissbank.com/nexus/content/groups/public-npm/" || true
if [[ ! -d /mnt/frontend_src/node_modules ]]; then
    echo "  installing frontend dependencies…"
    npm install --no-audit --no-fund >> "$LOG_DIR/frontend.log" 2>&1
fi

# --------------------------
# Backend deps
# --------------------------
cd /mnt/backend_src
"$PYTHON" -m pip install -U pip
"$PYTHON" -m pip install -r requirements.txt

echo "Cleaning up any processes on port $BACKEND_PORT..."
lsof -t -i:"$BACKEND_PORT" | xargs kill -9 2>/dev/null || true

echo "Starting orchestrator on 127.0.0.1:$BACKEND_PORT"
(
    cd /mnt/backend_src
    exec "$PYTHON" -m uvicorn app.main:app --host 127.0.0.1 --port "$BACKEND_PORT"
) > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!

for _ in $(seq 1 30); do
    if curl -sf "http://127.0.0.1:$BACKEND_PORT/api/v1/health" > /dev/null 2>&1; then
        echo "  orchestrator ready"
        break
    fi
    sleep 0.5
done

if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "Orchestrator failed to start. Last lines:" >&2
    tail -20 "$LOG_DIR/backend.log" >&2
    exit 1
fi

echo "Cleaning up any processes on port $FRONTEND_PORT..."
lsof -t -i:"$FRONTEND_PORT" | xargs kill -9 2>/dev/null || true

echo "Starting UI on :$FRONTEND_PORT"
(
    cd /mnt/frontend_src
    PORT="$FRONTEND_PORT" \
        API_TARGET="$API_TARGET" \
        API_TOKEN="$API_TOKEN" \
        UI_AUTH_MODE=shared \
        NEXT_PUBLIC_BASE_PATH="$NEXT_PUBLIC_BASE_PATH" \
        exec npm run dev
) > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!

sleep 3
echo ""
echo "  UI       $SERVER_URL"
echo "  API      $API_TARGET  (loopback; Next proxies /api/v1)"
echo "  logs     $LOG_DIR/"
echo ""
echo "Ctrl-C to stop."

wait
