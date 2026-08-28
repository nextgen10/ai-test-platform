#!/usr/bin/env bash
#
# Copilot runner entrypoint.
#
# Contract with the orchestrator:
#   in   $WORKSPACE/input/requirement.md   (written by the caller before start)
#   out  $WORKSPACE/output/<the workflow's declared primary artifact>
#        $WORKSPACE/output/run_metadata.json
#        $WORKSPACE/output/execution.log
#   exit 0 = COMPLETED, non-zero = FAILED
#
# $RUNNER_KIND selects the engine, and both executors that create this container
# already set it:
#   bespoke  agent_chain.py     — the hand-written test-case-generation chain
#   generic  generic_runner.py  — any workflow declared in agent-hub/workflows
#
set -Eeuo pipefail

WORKSPACE="${WORKSPACE:-/workspace}"
APP_DIR="${APP_DIR:-/app}"
AGENT_HUB_DIR="${AGENT_HUB_DIR:-$APP_DIR/agent-hub}"
ENGINE="${ENGINE:-copilot}"
JOB_ID="${JOB_ID:-local}"
RUNNER_KIND="${RUNNER_KIND:-bespoke}"
WORKFLOW_ID="${WORKFLOW_ID:-test-case-generation}"
STAGE="${STAGE:-generate}"
REPROCESS="${REPROCESS:-0}"

mkdir -p "$WORKSPACE/input" "$WORKSPACE/intermediate" "$WORKSPACE/output"

# Everything the chain prints is teed to a file the API can serve as job logs.
LOG_FILE="$WORKSPACE/output/execution.log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "Starting Agent Hub runner"
echo "  job:       $JOB_ID"
echo "  workflow:  $WORKFLOW_ID"
echo "  runner:    $RUNNER_KIND"
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
# directory. Both runners stage that into the workspace themselves, copying from
# $AGENT_HUB_DIR at start-up so a definition onboarded through the Registry is
# picked up. There used to be a symlink to $APP_DIR/.github here; it pointed at
# a directory that no longer ships, and a dangling one makes the staging step
# fail outright.

cd "$WORKSPACE"

if [[ "$RUNNER_KIND" == "generic" ]]; then
    python3 "$APP_DIR/generic_runner.py" \
        --workflow "$WORKFLOW_ID" \
        --workspace "$WORKSPACE" \
        --hub-dir "$AGENT_HUB_DIR"
else
    # A full if/fi, not `[[ ... ]] && x=y`: under `set -e` a false test makes
    # that one-liner the failing last command of the script.
    reprocess_flag=()
    if [[ "$REPROCESS" == "1" ]]; then
        reprocess_flag=(--reprocess)
    fi

    # `${a[@]+"${a[@]}"}` rather than `"${a[@]}"`: expanding an empty array is
    # an unbound-variable error under `set -u` on bash 3.2, which is what a
    # developer on macOS runs this with.
    python3 "$APP_DIR/agent_chain.py" \
        --workspace "$WORKSPACE" \
        --app-dir "$APP_DIR" \
        --engine "$ENGINE" \
        --stage "$STAGE" \
        ${reprocess_flag[@]+"${reprocess_flag[@]}"}
fi

echo "Runner completed"
