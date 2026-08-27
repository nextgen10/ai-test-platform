# AI Test Platform

> **Production-Grade Agentic Test-Case Generation Platform**  
> Transform unstructured requirements into verified, requirement-traced test suites using GitHub Copilot multi-agent chains, automated validation gates, INVEST quality checks, and 5-D test suite evaluations.

```
┌─────────────────┐      ┌─────────────────────────┐      ┌─────────────────────────┐      ┌─────────────────────────┐
│   Next.js UI    │ ───> │   FastAPI Orchestrator  │ ───> │    Ephemeral Runner     │ ───> │   GitHub Copilot CLI    │
│  (Port :3100)   │      │      (Port :8100)       │      │  (local / docker / k8s) │      │   (Agents + SKILL.md)   │
└─────────────────┘      └─────────────────────────┘      └─────────────────────────┘      └─────────────────────────┘
         │                            │                                │                                │
         │                            ▼                                ▼                                ▼
  Interactive UI            PostgreSQL / SQLite Storage       JSON Schema Validation           Test Design & Test Cases
  • INVEST Quality Gate     • Audit Trail Stream              • Coverage Rules                 • Requirement Tracing
  • 5-D Evaluation (85%)    • Provenance & Model Fallback     • Deduplication Gate             • Multi-Scenario Design
  • Excel Export (.csv)     • State Machine Engine            • Error Diagnostics              • Expected Results
```

---

## 1. Software Prerequisites

Before setting up on a brand new machine, ensure you have the required tools installed for your operating system.

### Prerequisites Matrix

| Software | Version | Purpose | Verification Command |
| :--- | :--- | :--- | :--- |
| **Python** | `3.11+` (3.12 recommended) | FastAPI orchestrator & runner execution | `python3 --version` |
| **Node.js** | `20.x` or `22.x LTS` | Next.js frontend web interface | `node --version` |
| **npm** | `10.x+` | Frontend package manager | `npm --version` |
| **Container Engine** | **Podman** or **Docker Desktop** | Building runner, backend & UI container images | `podman --version` or `docker --version` |
| **Kubernetes CLI** | `kubectl` v1.28+ | Cluster orchestration and inspection | `kubectl version --client` |
| **Local Cluster** | **Minikube** v1.34+ | Local single-node Kubernetes cluster | `minikube version` |
| **GitHub PAT** | Fine-grained token | GitHub Copilot CLI model execution (`ENGINE=copilot`) | — |

---

## 2. OS-Specific Installation Guide

---

### Linux (Ubuntu / Debian / AWS EC2 / GCP / Azure VM)

For a fresh Linux instance (Ubuntu 22.04 / 24.04 LTS or Debian 12), run these commands to install everything in one go:

```bash
# 1. Update system & install base development tools
sudo apt update && sudo apt install -y curl wget git build-essential python3 python3-pip python3-venv

# 2. Install Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Install Docker Engine (Recommended container runtime on Linux)
sudo apt install -y docker.io
sudo usermod -aG docker $USER
# Activate group changes immediately (or log out and back in):
newgrp docker

# 4. Install kubectl CLI
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
rm kubectl

# 5. Install Minikube
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube
rm minikube-linux-amd64

# 6. Verify all software versions
python3 --version
node --version
docker --version
kubectl version --client
minikube version
```

---

### Linux (RHEL / Rocky Linux / Fedora / AlmaLinux)

```bash
# 1. Install base utilities & Python
sudo dnf install -y curl git gcc make python3 python3-pip python3-devel

# 2. Install Node.js 22 LTS
sudo dnf module enable -y nodejs:22 || curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo dnf install -y nodejs

# 3. Install Podman & Container Tools
sudo dnf install -y podman

# 4. Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
rm kubectl

# 5. Install Minikube
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube
rm minikube-linux-amd64
```

---

### Remote Headless Linux Server Access (AWS / GCP / Azure)

If deploying on a remote cloud Linux server without a local web browser, you can access the UI from your local computer using either:

1. **SSH Port Forwarding (Most Secure)**:
   ```bash
   # From your laptop/local machine:
   ssh -L 3100:localhost:3100 -L 8100:localhost:8100 user@your-linux-server-ip
   ```
   Then open `http://localhost:3100` in your local laptop browser!

2. **Public Binding**:
   ```bash
   # On the Linux server:
   kubectl -n ai-testing port-forward --address 0.0.0.0 svc/ai-test-ui 3100:80 &
   kubectl -n ai-testing port-forward --address 0.0.0.0 svc/ai-test-orchestrator 8100:80 &
   ```
   *(Ensure ports `3100` and `8100` are allowed in your cloud security group/firewall).*

---

### macOS (Apple Silicon & Intel)

Install all dependencies via [Homebrew](https://brew.sh):

```bash
# 1. Install CLI tools & runtimes
brew install python@3.12 node@22 kubectl minikube vfkit

# 2. Install Container Engine (Podman recommended, or Docker Desktop)
brew install podman
podman machine init
podman machine start

# 3. Verify installations
python3 --version
node --version
podman --version
kubectl version --client
minikube version
```

> [!IMPORTANT]
> **macOS Driver Rule**: Always use `--driver=vfkit` when starting Minikube on macOS. Never use `--driver=podman` for Minikube on macOS because rootless Podman lacks bridge CNI networking and will cause cluster DNS failures.

---

### Windows (WSL2)

Run inside **WSL2 (Ubuntu 22.04 / 24.04)**:

```powershell
# In Windows PowerShell (Run as Administrator):
wsl --install -d Ubuntu
```

Once inside your WSL Ubuntu shell, follow the **Linux (Ubuntu / Debian)** instructions above. If using Docker Desktop, enable **WSL2 Integration** in Docker Desktop Settings → Resources → WSL Integration.

---

## 3. Environment & Authentication Setup

### Create GitHub Copilot Personal Access Token (PAT)

If you intend to run real AI generation (`ENGINE=copilot`):
1. Navigate to: [https://github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)
2. **Token Type**: Fine-grained Personal Access Token.
3. **Resource Owner**: Your personal account.
4. **Repository Access**: Public repositories (or None).
5. **Account Permissions**: Set **Copilot Requests** to `Read and write`.
6. Generate and copy your token (`github_pat_...`).

### Configure `.env`

```bash
# Clone or navigate to the project root:
cd ai-test-platform

# Create local environment file:
cp .env.example .env
```

Edit `.env` and configure your settings:

```dotenv
# Execution Engine: "mock" (offline standalone simulation) or "copilot" (real AI agents)
ENGINE=copilot

# Orchestrator Runner Mode: "local", "docker", or "kubernetes"
EXECUTOR=local

# GitHub Copilot Token (required when ENGINE=copilot)
COPILOT_GITHUB_TOKEN=github_pat_YOUR_TOKEN_HERE

# AI Model override (optional: claude-3.5-sonnet, gpt-4o, etc. Empty = account default)
COPILOT_MODEL=claude-3.5-sonnet
```

---

## 4. Deployment Modes

### Mode 1: Local Native Stack (Fastest for Development)

Runs the FastAPI backend and Next.js frontend with hot reload directly on your machine without containers or Kubernetes.

```bash
# 1. Install Backend Dependencies
cd backend
python3 -m pip install -r requirements.txt
cd ..

# 2. Install Frontend Dependencies
cd frontend
npm install
cd ..

# 3. Launch both Orchestrator (:8100) and UI (:3100)
./start.sh
```

- **Web Dashboard**: [http://localhost:3100](http://localhost:3100)
- **API Swagger Docs**: [http://localhost:8100/docs](http://localhost:8100/docs)
- **Log Outputs**: `logs/backend.log` and `logs/frontend.log`

---

### Mode 2: Kubernetes Cluster Deployment (Production Simulation)

Deploys PostgreSQL, FastAPI orchestrator with `EXECUTOR=kubernetes`, Next.js UI, RBAC rules, and PVC storage into a local Minikube cluster.

#### Step 1: Start Minikube
```bash
# On macOS:
minikube start --driver=vfkit --memory=4096 --cpus=3 --container-runtime=containerd

# On Linux / WSL:
minikube start --driver=docker --memory=4096 --cpus=3
```

#### Step 2: Build Container Images
```bash
# 1. Test runner agent container
podman build -t ai-test-runner:dev -f runner/Dockerfile .

# 2. Orchestrator backend container
podman build -t ai-test-orchestrator:dev -f backend/Dockerfile .

# 3. Next.js UI frontend container
podman build -t ai-test-ui:dev -f frontend/Dockerfile frontend/
```

*(If using Docker, replace `podman` with `docker` in the commands above).*

#### Step 3: Deploy Stack to Cluster
```bash
./k8s/deploy.sh
```
*This loads all images into Minikube, provisions the `ai-testing` namespace, starts PostgreSQL, applies RBAC & storage claims, and deploys the services.*

#### Step 4: Open Port-Forwards & Access Platform
```bash
./k8s/cluster.sh up
```

- **Web UI**: [http://localhost:3100](http://localhost:3100)
- **API Docs**: [http://localhost:8100/docs](http://localhost:8100/docs)

---

## 5. Cluster Management Commands

The `./k8s/cluster.sh` helper manages the Kubernetes environment lifecycle:

| Command | Action | Data Preserved? |
| :--- | :--- | :---: |
| `./k8s/cluster.sh up` | Starts Minikube, waits for pods to become `Ready`, and establishes port-forwards (`:3100`, `:8100`). | Yes |
| `./k8s/cluster.sh down` | Closes port-forward tunnels and pauses the Minikube cluster VM. | Yes |
| `./k8s/cluster.sh status` | Displays cluster health, pod statuses, active K8s generation jobs, and tunnel status. | Yes |
| `./k8s/cluster.sh logs` | Tails live log streams from the orchestrator deployment. | Yes |
| `./k8s/cluster.sh forward` | Re-establishes background port-forwards if disconnected. | Yes |
| `kubectl delete namespace ai-testing` | Wipes all pods, jobs, PostgreSQL tables, and PVC volumes for a 100% clean redeploy. | No |
| `./k8s/cluster.sh destroy` | Deletes the Minikube cluster VM entirely. | No |

---

## 6. Key Platform Capabilities

### 1. Two-Phase Quality Gates
- **Phase 1: Requirement Quality (INVEST)**: Analyzes source requirements across 8 INVEST criteria (Independent, Negotiable, Valuable, Estimable, Small, Testable, Acceptance Criteria, Assumptions).
- **Human Approval Gate**: Interactive approval prompt directly below the score card. Requires reviewer sign-off before triggering test generation.

### 2. 5-D Test Suite Evaluation
- Evaluates completed test suites across **Coverage**, **Completeness**, **Traceability**, **Correctness**, and **Uniqueness**.
- Standardized **1–4 Scale Arithmetic Mean (85%)** unified across the frontend score cards and runner agent execution logs.

### 3. One-Click Excel Export (.csv)
- Located above the Test Cases table in the **Generated Test Cases** tab.
- Generates Microsoft Excel-compatible UTF-8 BOM CSV files (`test_cases_<job_id>.csv`) formatted with test case IDs, priorities, categories, preconditions, numbered steps, and expected results.

### 4. Resilient Model Fallback & Provenance
- If a custom model flag (`--model`) is restricted on a GitHub token, the runner automatically falls back to the Copilot account default model without crashing the job.
- Full transparency recorded in the **Reproducibility & Provenance** card with an amber `⚠️ Model Fallback: <requested> ➔ <effective>` badge.

---

## 7. Troubleshooting & FAQ

### 1. `ImagePullBackOff` in Kubernetes
- **Cause**: Image was not loaded into Minikube's internal containerd store.
- **Fix**: Re-run `./k8s/deploy.sh`, which automatically exports local images and loads them into Minikube.

### 2. Database Migration / Column Errors
- If upgrading from an older deployment, run `kubectl delete namespace ai-testing && ./k8s/deploy.sh` to initialize fresh PostgreSQL tables.

### 3. macOS DNS / Port-Forward Hanging
- Ensure you started Minikube with `--driver=vfkit`. If Minikube was previously started with `--driver=podman`, wipe it with `minikube delete` and start with `minikube start --driver=vfkit --memory=4096 --cpus=3 --container-runtime=containerd`.

---

## 8. Repository Structure

```
ai-test-platform/
├── frontend/                  # Next.js 15 + React 19 + MUI dashboard
│   ├── src/app/               # App Router pages (/dashboard, /generate, /jobs, /settings)
│   ├── src/components/        # QualityReportPanel, EvaluationPanel, WorkflowStepper
│   └── src/lib/               # API client, TypeScript models & settings storage
├── backend/                   # FastAPI orchestrator service
│   ├── app/api/               # REST API endpoints (/api/v1/jobs, /health, /models)
│   ├── app/executors/         # Local, Docker, and Kubernetes job executors
│   ├── app/models/            # SQLAlchemy database models (PostgreSQL & SQLite)
│   └── app/services/          # Job state machine, validation & event streaming
├── runner/                    # Disposable agent runners
│   ├── agent_chain.py         # Bespoke test-gen chain (Designer -> Generator -> Reviewer)
│   ├── generic_runner.py      # Declarative engine for any *.workflow.yaml
│   └── validate_output.py     # JSON schema validator & quality heuristics
├── agent-hub/                 # The registry: agents, skills, prompts, workflows
│   ├── agents/*.agent.md      # Agent definitions (also the CLI's system prompts)
│   ├── skills/<id>/SKILL.md   # Domain instruction bundles
│   ├── prompts/*.prompt.md    # Reusable prompt templates
│   └── workflows/*.yaml       # Declarative pipelines — drop one in to onboard it
├── schemas/                   # JSON schemas (test-case, quality-report, evaluation)
├── k8s/                       # Kubernetes deployment manifests & shell automation
│   ├── deploy.sh              # Automatic cluster builder & manifest deployer
│   ├── cluster.sh             # Cluster lifecycle controller (up, down, status, logs)
│   └── *.yaml                 # Deployments, Services, RBAC, Storage & NetworkPolicies
├── start.sh                   # Instant native runner for local development
└── .env.example               # Template environment configuration
```
