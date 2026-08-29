#!/usr/bin/env bash
#
# Start Agent HUB locally (orchestrator + UI).
# Ports 8100/3100 run the backend orchestrator and Next.js frontend.
#
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$ROOT/logs"
mkdir -p "$LOG_DIR"

# Load .env as *defaults*: anything already in the environment wins, so
# `ENGINE=copilot ./start.sh` still overrides the file.
load_env_defaults() {
    local file="$1" line key value
    while IFS= read -r line || [[ -n "$line" ]]; do
        line="${line#"${line%%[![:space:]]*}"}"     # strip leading whitespace
        [[ -z "$line" || "$line" == \#* ]] && continue
        line="${line#export }"
        [[ "$line" != *=* ]] && continue
        key="${line%%=*}"
        value="${line#*=}"
        key="${key%"${key##*[![:space:]]}"}"        # strip trailing whitespace
        [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
        value="${value%\"}"; value="${value#\"}"    # strip surrounding quotes
        value="${value%\'}"; value="${value#\'}"
        [[ -n "${!key+x}" ]] && continue            # already set: environment wins
        export "$key=$value"
    done < "$file"
}

if [[ -f "$ROOT/.env" ]]; then
    load_env_defaults "$ROOT/.env"
    echo "Loaded $ROOT/.env"
fi

: "${EXECUTOR:=local}"
: "${ENGINE:=mock}"
: "${BACKEND_PORT:=8100}"
: "${FRONTEND_PORT:=3100}"
: "${AUTH_MODE:=token}"
: "${ENABLE_DOCS:=1}"
export EXECUTOR ENGINE AUTH_MODE ENABLE_DOCS

# The orchestrator refuses to start in token mode with no credentials, so that
# an unconfigured deployment can never serve an open API. For a local run we
# mint one here and hand it to both processes: the browser talks to Next, Next
# attaches the token, and nothing sensitive reaches the client.
if [[ "$AUTH_MODE" == "token" && -z "${API_TOKENS:-}" ]]; then
    DEV_TOKEN="$("${PYTHON:-python3}" -c 'import secrets; print(secrets.token_urlsafe(32))')"
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

PYTHON="${PYTHON:-python3}"

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

echo "Cleaning up any processes on port $BACKEND_PORT..."
lsof -t -i:"$BACKEND_PORT" | xargs kill -9 2>/dev/null || true

echo "Starting orchestrator on :$BACKEND_PORT"
(
    cd "$ROOT/backend"
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
if [[ ! -d "$ROOT/frontend/node_modules" ]]; then
    echo "  installing frontend dependencies (first run)…"
    (cd "$ROOT/frontend" && npm install --no-audit --no-fund) >> "$LOG_DIR/frontend.log" 2>&1
fi

(
    cd "$ROOT/frontend"
    PORT="$FRONTEND_PORT" API_TARGET="http://127.0.0.1:$BACKEND_PORT" \
        API_TOKEN="$API_TOKEN" UI_AUTH_MODE=shared exec npm run dev
) > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!

sleep 3
echo ""
echo "  UI       http://localhost:$FRONTEND_PORT"
echo "  API docs http://localhost:$BACKEND_PORT/docs"
echo "  logs     $LOG_DIR/"
echo ""
echo "Ctrl-C to stop."

wait
