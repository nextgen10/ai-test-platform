#!/usr/bin/env bash
#
# Cluster lifecycle helper.
#
#   ./k8s/cluster.sh up        start the cluster, wait for pods, open port-forwards
#   ./k8s/cluster.sh down      close port-forwards and stop the cluster (keeps data)
#   ./k8s/cluster.sh status    cluster, pods, jobs and port-forward state
#   ./k8s/cluster.sh forward   (re)open port-forwards only
#   ./k8s/cluster.sh logs      tail the orchestrator log
#   ./k8s/cluster.sh destroy   delete the cluster entirely (loses Postgres + artifacts)
#
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NS=ai-testing
RUN_DIR="$ROOT/logs"
mkdir -p "$RUN_DIR"

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

stop_forwards() {
    # Match on the full command so we never kill an unrelated port-forward.
    pkill -f "port-forward svc/ai-test-ui" 2>/dev/null || true
    pkill -f "port-forward svc/ai-test-orchestrator" 2>/dev/null || true
}

start_forwards() {
    stop_forwards
    sleep 1
    nohup kubectl -n "$NS" port-forward svc/ai-test-ui 3100:80 \
        > "$RUN_DIR/pf-ui.log" 2>&1 &
    nohup kubectl -n "$NS" port-forward svc/ai-test-orchestrator 8100:80 \
        > "$RUN_DIR/pf-api.log" 2>&1 &

    # Wait for the UI forward to actually answer before claiming success.
    for _ in $(seq 1 45); do
        if curl -sf -o /dev/null http://localhost:3100/dashboard 2>/dev/null; then
            echo "  UI   http://localhost:3100"
            echo "  API  http://localhost:8100/docs"
            return 0
        fi
        sleep 1
    done
    echo "  port-forwards started but the UI did not answer yet; check $RUN_DIR/pf-ui.log" >&2
}

case "${1:-status}" in

up)
    step "Starting cluster"
    # Driver, memory and runtime are remembered in the minikube profile.
    minikube start

    step "Waiting for workloads"
    # Postgres first: the orchestrator exits on startup if the database is not
    # reachable yet, so it restarts once if we race it.
    kubectl -n "$NS" rollout status deployment/postgres --timeout=180s
    kubectl -n "$NS" rollout status deployment/ai-test-orchestrator --timeout=240s
    kubectl -n "$NS" rollout status deployment/ai-test-ui --timeout=180s

    # rollout status can return while a pod is still flapping; wait for Ready.
    kubectl -n "$NS" wait --for=condition=Ready pod \
        -l app=ai-test-orchestrator --timeout=180s
    kubectl -n "$NS" wait --for=condition=Ready pod \
        -l app=ai-test-ui --timeout=180s

    step "Opening port-forwards"
    start_forwards
    ;;

down)
    step "Closing port-forwards"
    stop_forwards
    echo "  closed"

    step "Stopping cluster"
    # `stop` preserves the VM, the PVCs and every object. `up` brings it back.
    minikube stop
    ;;

forward)
    step "Opening port-forwards"
    start_forwards
    ;;

status)
    step "Cluster"
    minikube status 2>&1 | head -5 || echo "  not running"

    step "Pods"
    kubectl -n "$NS" get pods 2>/dev/null || echo "  unreachable"

    step "Generation jobs"
    kubectl -n "$NS" get jobs 2>/dev/null | head -8 || true

    step "Port-forwards"
    if pgrep -f "port-forward svc/ai-test" >/dev/null 2>&1; then
        curl -sf -o /dev/null http://localhost:3100/dashboard 2>/dev/null \
            && echo "  running — http://localhost:3100" \
            || echo "  processes alive but not answering; try: $0 forward"
    else
        echo "  none — start with: $0 forward"
    fi
    ;;

logs)
    kubectl -n "$NS" logs -f deployment/ai-test-orchestrator
    ;;

destroy)
    step "Deleting cluster"
    echo "This removes the cluster, the Postgres data and all job artifacts."
    read -r -p "Type 'delete' to confirm: " confirm
    [[ "$confirm" == "delete" ]] || { echo "Aborted."; exit 1; }
    stop_forwards
    minikube delete
    ;;

*)
    echo "usage: $0 {up|down|forward|status|logs|destroy}" >&2
    exit 1
    ;;
esac
