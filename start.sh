#!/usr/bin/env bash
#
# Start Agent HUB (orchestrator + Vite UI).
# Ports 8100 / 3300 by default.
#
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$ROOT/logs"
mkdir -p "$LOG_DIR"

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

if [[ -f "$ROOT/.env" ]]; then
    load_env_defaults "$ROOT/.env"
    echo "Loaded $ROOT/.env"
fi

: "${EXECUTOR:=local}"
: "${ENGINE:=mock}"
: "${BACKEND_PORT:=8100}"
: "${FRONTEND_PORT:=3300}"
AUTH_MODE=disabled
: "${ENABLE_DOCS:=1}"
export EXECUTOR ENGINE AUTH_MODE ENABLE_DOCS
export CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:${FRONTEND_PORT},http://127.0.0.1:${FRONTEND_PORT},http://localhost:3100,http://127.0.0.1:3100}"

PYTHON="${PYTHON:-python3}"
VENV="$ROOT/.venv"

cleanup() {
    echo ""
    echo "Stopping…"
    [[ -n "${BACKEND_PID:-}" ]] && kill "$BACKEND_PID" 2>/dev/null || true
    [[ -n "${FRONTEND_PID:-}" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
    wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Agent HUB (Vite)"
echo "  executor : $EXECUTOR"
echo "  engine   : $ENGINE"
if [[ "$ENGINE" == "mock" ]]; then
    echo "             (deterministic stand-in — set ENGINE=copilot for real generation)"
fi
echo "  auth     off — no login, no token"
echo ""

if [[ ! -d "$VENV" ]]; then
    echo "Creating Python venv…"
    "$PYTHON" -m venv "$VENV"
fi
# shellcheck disable=SC1091
source "$VENV/bin/activate"
if ! python -c "import fastapi" 2>/dev/null; then
    echo "Installing backend dependencies…"
    pip install -q -r "$ROOT/backend/requirements.txt"
fi

echo "Cleaning up any processes on port $BACKEND_PORT..."
lsof -t -i:"$BACKEND_PORT" | xargs kill -9 2>/dev/null || true

echo "Starting orchestrator on :$BACKEND_PORT"
(
    cd "$ROOT/backend"
    # Do not inherit Vite's PORT from .env — uvicorn must bind BACKEND_PORT.
    unset PORT
    exec python -m uvicorn app.main:app --host 127.0.0.1 --port "$BACKEND_PORT"
) > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!

for _ in $(seq 1 40); do
    if curl -sf "http://127.0.0.1:$BACKEND_PORT/api/v1/health" > /dev/null 2>&1; then
        echo "  orchestrator ready"
        break
    fi
    sleep 0.5
done

if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "Orchestrator failed to start. Last lines:" >&2
    tail -30 "$LOG_DIR/backend.log" >&2
    exit 1
fi

echo "Cleaning up any processes on port $FRONTEND_PORT..."
lsof -t -i:"$FRONTEND_PORT" | xargs kill -9 2>/dev/null || true

if [[ ! -d "$ROOT/node_modules" ]]; then
    echo "  installing frontend dependencies (first run)…"
    (cd "$ROOT" && npm install --no-audit --no-fund) >> "$LOG_DIR/frontend.log" 2>&1
fi

echo "Starting Vite UI on :$FRONTEND_PORT"
(
    cd "$ROOT"
    PORT="$FRONTEND_PORT" API_TARGET="http://127.0.0.1:$BACKEND_PORT" \
        exec npm run dev -- --port "$FRONTEND_PORT" --strictPort
) > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!

sleep 2
echo ""
echo "  UI       http://localhost:$FRONTEND_PORT"
echo "  API docs http://localhost:$BACKEND_PORT/docs"
echo "  logs     $LOG_DIR/"
echo ""
echo "Ctrl-C to stop."

wait
