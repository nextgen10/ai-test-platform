#!/usr/bin/env bash
#
# Deploy the full stack to a local minikube cluster.
#
#   ./k8s/deploy.sh
#
# Assumes: minikube is running, and the three images are built locally.
# The Copilot PAT is read from ../.env and pushed into a Kubernetes Secret; its
# value is never echoed.
#
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
K8S="$ROOT/k8s"
NS=ai-testing
IMAGES=(ai-test-runner:dev ai-test-orchestrator:dev ai-test-ui:dev)

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

# ---------------------------------------------------------------- preflight

step "Preflight"
command -v kubectl >/dev/null || { echo "kubectl not found" >&2; exit 1; }
command -v minikube >/dev/null || { echo "minikube not found" >&2; exit 1; }

# Container engine for building/exporting images. Either works.
ENGINE_BIN=""
for candidate in docker podman; do
    command -v "$candidate" >/dev/null 2>&1 && { ENGINE_BIN="$candidate"; break; }
done
[[ -n "$ENGINE_BIN" ]] || { echo "Neither docker nor podman found" >&2; exit 1; }
echo "container engine: $ENGINE_BIN"

if ! minikube status --format '{{.Host}}' 2>/dev/null | grep -q Running; then
    echo "minikube is not running. Start it with:" >&2
    case "$(uname -s)" in
        Darwin) echo "  minikube start --driver=vfkit --memory=3600 --cpus=3 --container-runtime=containerd" >&2
                echo "  (do NOT use --driver=podman on macOS: rootless podman has no working CNI)" >&2 ;;
        Linux)  echo "  minikube start --driver=docker --memory=4096 --cpus=3" >&2 ;;
        *)      echo "  minikube start --driver=docker --memory=4096 --cpus=3" >&2 ;;
    esac
    exit 1
fi
echo "minikube running"

# ------------------------------------------------------------- load images

step "Loading images into the cluster"
# minikube cannot always read the local engine's image store, so images go in as
# archives. containerd then records whatever name the archive carries — podman
# writes "localhost/<name>:tag", docker writes "<name>:tag" — while kubelet
# resolves a bare "<name>:tag" to "docker.io/library/<name>:tag". Hence the
# explicit retag; without it pods sit in ImagePullBackOff against Docker Hub.
TMP_IMG_DIR="${TMPDIR:-/tmp}/ai-test-images"
mkdir -p "$TMP_IMG_DIR"

# podman namespaces local builds under localhost/; docker does not.
if [[ "$ENGINE_BIN" == "podman" ]]; then
    LOCAL_PREFIX="localhost/"
else
    LOCAL_PREFIX=""
fi

for image in "${IMAGES[@]}"; do
    name="${image%%:*}"
    echo "  exporting $image …"
    "$ENGINE_BIN" save --format docker-archive -o "$TMP_IMG_DIR/${name}.tar" "${LOCAL_PREFIX}${image}" 2>/dev/null \
        || "$ENGINE_BIN" save -o "$TMP_IMG_DIR/${name}.tar" "${LOCAL_PREFIX}${image}"

    echo "  removing previous $image from cluster …"
    minikube ssh -- "sudo ctr -n k8s.io images rm docker.io/library/${image} localhost/${image} ${image} 2>/dev/null || true" >/dev/null 2>&1 || true

    echo "  loading fresh $image …"
    minikube image load "$TMP_IMG_DIR/${name}.tar"

    # Retag from whichever name actually landed.
    for source in "localhost/${image}" "${image}"; do
        if minikube ssh -- "sudo ctr -n k8s.io images tag --force ${source} docker.io/library/${image}" >/dev/null 2>&1; then
            break
        fi
    done

    rm -f "$TMP_IMG_DIR/${name}.tar"
done

# ---------------------------------------------------------------- manifests

step "Applying manifests"
kubectl apply -f "$K8S/namespace.yaml"
kubectl apply -f "$K8S/rbac.yaml"
kubectl apply -f "$K8S/storage.yaml"

step "Database credentials"
if kubectl -n "$NS" get secret orchestrator-db >/dev/null 2>&1; then
    echo "  reusing existing orchestrator-db secret"
else
    DB_PASS="$("${PYTHON:-python3}" -c 'import secrets; print(secrets.token_urlsafe(24))')"
    kubectl -n "$NS" create secret generic orchestrator-db \
        --from-literal=POSTGRES_USER=aitest \
        --from-literal=POSTGRES_PASSWORD="$DB_PASS" \
        --from-literal=POSTGRES_DB=aitest \
        --from-literal=DATABASE_URL="postgresql+psycopg://aitest:${DB_PASS}@postgres:5432/aitest" \
        >/dev/null
    unset DB_PASS
    echo "  orchestrator-db secret created (password generated)"
fi

kubectl apply -f "$K8S/postgres.yaml"

# NetworkPolicy is applied for parity with production, but note that minikube's
# default CNI does NOT enforce it. Start with `--cni=calico` if you want the
# policy actually enforced locally.
kubectl apply -f "$K8S/networkpolicy.yaml"

# ------------------------------------------------------------------ secret

step "Copilot credentials"
TOKEN=""
if [[ -f "$ROOT/.env" ]]; then
    # Read without printing. First match wins, in the CLI's precedence order.
    for key in COPILOT_GITHUB_TOKEN GH_TOKEN GITHUB_TOKEN; do
        line="$(grep -m1 "^[[:space:]]*${key}=" "$ROOT/.env" 2>/dev/null || true)"
        if [[ -n "$line" ]]; then
            TOKEN="${line#*=}"
            TOKEN="${TOKEN%\"}"; TOKEN="${TOKEN#\"}"
            TOKEN="${TOKEN%\'}"; TOKEN="${TOKEN#\'}"
            [[ -n "$TOKEN" ]] && { echo "  using $key from .env (${#TOKEN} chars)"; break; }
        fi
    done
fi
: "${TOKEN:=${COPILOT_GITHUB_TOKEN:-}}"

# Classic PATs are silently accepted by the secret but rejected by the CLI at
# runtime, which surfaces as an opaque pod failure. Catch it here instead.
if [[ "$TOKEN" == ghp_* ]]; then
    echo "  ERROR: that is a classic PAT (ghp_), which Copilot CLI does not support." >&2
    echo "  Create a fine-grained token (github_pat_) at:" >&2
    echo "    https://github.com/settings/personal-access-tokens/new" >&2
    echo "  Resource owner: your personal account. Permission: Copilot Requests." >&2
    exit 1
fi

if [[ -z "$TOKEN" || "$TOKEN" == *PASTE_YOUR_TOKEN_HERE* ]]; then
    echo "  WARNING: no Copilot token found in .env or the environment." >&2
    echo "  Real generation (ENGINE=copilot) will fail. Set COPILOT_GITHUB_TOKEN" >&2
    echo "  in $ROOT/.env and re-run, or create the secret by hand." >&2
    kubectl -n "$NS" delete secret copilot-auth --ignore-not-found >/dev/null
    kubectl -n "$NS" create secret generic copilot-auth \
        --from-literal=COPILOT_GITHUB_TOKEN="" >/dev/null
else
    kubectl -n "$NS" delete secret copilot-auth --ignore-not-found >/dev/null
    kubectl -n "$NS" create secret generic copilot-auth \
        --from-literal=COPILOT_GITHUB_TOKEN="$TOKEN" >/dev/null
    echo "  secret copilot-auth created"
fi
unset TOKEN

step "Orchestrator API tokens"
if kubectl -n "$NS" get secret orchestrator-auth >/dev/null 2>&1; then
    echo "  reusing existing orchestrator-auth secret"
else
    OP_TOKEN="$("${PYTHON:-python3}" -c 'import secrets; print(secrets.token_urlsafe(32))')"
    AU_TOKEN="$("${PYTHON:-python3}" -c 'import secrets; print(secrets.token_urlsafe(32))')"
    API_TOKENS="${OP_TOKEN}:operator:operator,${AU_TOKEN}:author:author"
    kubectl -n "$NS" create secret generic orchestrator-auth \
        --from-literal=API_TOKENS="$API_TOKENS" \
        >/dev/null
    echo "  orchestrator-auth created. Log in at the UI with one of these tokens:"
    echo "    operator: ${OP_TOKEN}"
    echo "    author:   ${AU_TOKEN}"
    echo "  They are also in the orchestrator-auth secret; this script will not print them again."
    unset OP_TOKEN AU_TOKEN API_TOKENS
fi

# ------------------------------------------------------------- workloads

step "Waiting for PostgreSQL"
kubectl -n "$NS" rollout status deployment/postgres --timeout=180s

step "Deploying orchestrator and UI"
kubectl apply -f "$K8S/backend-deployment.yaml"
kubectl apply -f "$K8S/frontend-deployment.yaml"
kubectl -n "$NS" rollout restart deployment/ai-test-orchestrator
kubectl -n "$NS" rollout restart deployment/ai-test-ui
kubectl -n "$NS" rollout status deployment/ai-test-orchestrator --timeout=180s
kubectl -n "$NS" rollout status deployment/ai-test-ui --timeout=180s

# ------------------------------------------------------------------ done

step "Deployed"
kubectl -n "$NS" get pods -o wide
echo ""
echo "Open the UI with:"
echo "  minikube service ai-test-ui -n $NS"
echo ""
echo "Or port-forward:"
echo "  kubectl -n $NS port-forward svc/ai-test-ui 3100:80"
echo "  kubectl -n $NS port-forward svc/ai-test-orchestrator 8100:80"
