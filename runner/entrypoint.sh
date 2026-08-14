#!/usr/bin/env bash
#
# Copilot runner entrypoint.
#
# Contract with the orchestrator:
#   in   $WORKSPACE/input/requirement.md   (written by the caller before start)
#   out  $WORKSPACE/output/test_cases.json
#        $WORKSPACE/output/validation.json
#        $WORKSPACE/output/run_metadata.json
#        $WORKSPACE/output/execution.log
#   exit 0 = COMPLETED, non-zero = FAILED
#
set -Eeuo pipefail

WORKSPACE="${WORKSPACE:-/workspace}"
APP_DIR="${APP_DIR:-/app}"
ENGINE="${ENGINE:-copilot}"
JOB_ID="${JOB_ID:-local}"

mkdir -p "$WORKSPACE/input" "$WORKSPACE/intermediate" "$WORKSPACE/output"

# Everything the chain prints is teed to a file the API can serve as job logs.
LOG_FILE="$WORKSPACE/output/execution.log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "Starting AI test generation"
echo "  job:       $JOB_ID"
echo "  engine:    $ENGINE"
echo "  workspace: $WORKSPACE"

# Seed the requirement if the caller staged it next to the app instead of in the
# workspace (the local docker-run path in the README does this).
if [[ ! -f "$WORKSPACE/input/requirement.md" && -f "$APP_DIR/requirement.md" ]]; then
    cp "$APP_DIR/requirement.md" "$WORKSPACE/input/requirement.md"
fi

if [[ ! -f "$WORKSPACE/input/requirement.md" ]]; then
    echo "FATAL: no requirement at $WORKSPACE/input/requirement.md" >&2
    exit 2
fi

# Copilot discovers skills and agents from .github/ relative to the working
# directory, so expose them inside the workspace rather than moving the runner.
if [[ -d "$APP_DIR/.github" && ! -e "$WORKSPACE/.github" ]]; then
    ln -s "$APP_DIR/.github" "$WORKSPACE/.github"
fi

cd "$WORKSPACE"

python3 "$APP_DIR/agent_chain.py" \
    --workspace "$WORKSPACE" \
    --app-dir "$APP_DIR" \
    --engine "$ENGINE"

echo "Generation completed"
