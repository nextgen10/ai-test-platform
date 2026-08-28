"""Kubernetes executor — one ephemeral Job per request (blueprint §28, §29).

Artifacts are exchanged through a ReadWriteMany PVC that both the orchestrator
and the runner mount, with the job id as a subPath so jobs cannot see each
other's workspaces. For multi-node clusters without RWX storage, replace the
volume with object storage and have the runner upload on completion.

The orchestrator talks to the Kubernetes API directly. It never shells out to
kubectl as its production mechanism.
"""
from __future__ import annotations

import os
import time
from pathlib import Path

from app.config import settings
from app.executors.base import ExecutionResult


def _runtime_value(job_id: str, name: str) -> str | None:
    path = settings.runtime_for(job_id) / name
    if not path.is_file():
        return None
    return path.read_text(encoding="utf-8").strip() or None

ARTIFACT_PVC = os.getenv("K8S_ARTIFACT_PVC", "ai-test-artifacts")


def _load_client():
    """Import and configure the Kubernetes client lazily.

    Keeping this out of module import means the local and docker executors work
    on a machine with no cluster and no kubernetes package installed.
    """
    try:
        from kubernetes import client, config
    except ImportError as exc:  # pragma: no cover - depends on optional extra
        raise RuntimeError(
            "EXECUTOR=kubernetes requires the 'kubernetes' package "
            "(pip install kubernetes)"
        ) from exc

    try:
        config.load_incluster_config()
    except config.ConfigException:
        try:
            config.load_kube_config()
        except config.ConfigException as exc:
            raise RuntimeError(
                "No Kubernetes credentials found (neither in-cluster nor kubeconfig)"
            ) from exc

    return client


class KubernetesExecutor:
    name = "kubernetes"

    def external_name(self, job_id: str, stage: str = "generate", attempt: int = 0) -> str:
        """Deterministic, so the orchestrator can record it before creating the Job.

        The name must be unique per *attempt* as well as per stage: a reprocess
        run reusing the first run's name is rejected by the API with a Conflict,
        because the original Job still exists until its TTL expires.
        """
        suffix = {"quality": "-quality", "generate": ""}.get(stage, f"-{stage}")
        if attempt:
            suffix += f"-r{attempt}"
        return f"testgen-{job_id}{suffix}"

    def build_manifest(
        self, job_id: str, k8s_job_name: str, stage: str = "generate",
        reprocess: bool = False, workflow: str = "test-case-generation",
        runner: str = "bespoke",
        engine: str | None = None,
        token_secret: str | None = None,
    ) -> dict:
        """Build the Job manifest. Pure function — unit-testable without a cluster."""
        engine = engine or settings.engine
        token_secret = token_secret or settings.k8s_secret_name
        hub_pvc = settings.k8s_hub_pvc
        return {
            "apiVersion": "batch/v1",
            "kind": "Job",
            "metadata": {
                "name": k8s_job_name,
                "namespace": settings.k8s_namespace,
                "labels": {
                    "app": "ai-test-runner",
                    "workflow": workflow,
                    "job-id": job_id,
                },
            },
            "spec": {
                "backoffLimit": 0,  # retries are classified by the orchestrator, not blind
                "ttlSecondsAfterFinished": settings.k8s_ttl_seconds,
                "activeDeadlineSeconds": settings.job_timeout_seconds,
                "template": {
                    "metadata": {
                        "labels": {"app": "ai-test-runner", "job-id": job_id},
                    },
                    "spec": {
                        "restartPolicy": "Never",
                        "serviceAccountName": settings.k8s_service_account,
                        "automountServiceAccountToken": False,
                        "securityContext": {
                            "runAsNonRoot": True,
                            "runAsUser": 10001,
                            "fsGroup": 10001,
                            "seccompProfile": {"type": "RuntimeDefault"},
                        },
                        "containers": [
                            {
                                "name": "runner",
                                "image": settings.runner_image,
                                "imagePullPolicy": "IfNotPresent",
                                "securityContext": {
                                    "allowPrivilegeEscalation": False,
                                    "readOnlyRootFilesystem": True,
                                    "capabilities": {"drop": ["ALL"]},
                                },
                                "env": [
                                    {"name": "JOB_ID", "value": job_id},
                                    {"name": "ENGINE", "value": engine},
                                    {"name": "STAGE", "value": stage},
                                    {"name": "WORKFLOW_ID", "value": workflow},
                                    {"name": "RUNNER_KIND", "value": runner},
                                    {"name": "REPROCESS", "value": "1" if reprocess else "0"},
                                    {"name": "WORKSPACE", "value": "/workspace"},
                                    {
                                        "name": "RUNNER_VERSION",
                                        "value": settings.runner_version,
                                    },
                                    {
                                        "name": "SKILL_VERSION",
                                        "value": settings.skill_version,
                                    },
                                    {
                                        "name": "COPILOT_GITHUB_TOKEN",
                                        "valueFrom": {
                                            "secretKeyRef": {
                                                "name": token_secret,
                                                "key": "COPILOT_GITHUB_TOKEN",
                                                "optional": True,
                                            }
                                        },
                                    },
                                ],
                                "resources": {
                                    "requests": {
                                        "cpu": settings.k8s_cpu_request,
                                        "memory": settings.k8s_memory_request,
                                    },
                                    "limits": {
                                        "cpu": settings.k8s_cpu_limit,
                                        "memory": settings.k8s_memory_limit,
                                    },
                                },
                                "volumeMounts": [
                                    {
                                        "name": "artifacts",
                                        "mountPath": "/workspace",
                                        "subPath": job_id,
                                    },
                                    {
                                        "name": "hub",
                                        "mountPath": "/app/agent-hub",
                                        "readOnly": True,
                                    },
                                    {"name": "tmp", "mountPath": "/tmp"},
                                    {"name": "home", "mountPath": "/home/runner"},
                                ],
                            }
                        ],
                        "volumes": [
                            {
                                "name": "artifacts",
                                "persistentVolumeClaim": {"claimName": ARTIFACT_PVC},
                            },
                            {
                                "name": "hub",
                                "persistentVolumeClaim": {"claimName": hub_pvc},
                            },
                            {"name": "tmp", "emptyDir": {}},
                            {"name": "home", "emptyDir": {}},
                        ],
                    },
                },
            },
        }

    def cancel(self, job_id: str, external_name: str | None = None) -> None:
        """Delete the Kubernetes Job so the runner pod stops."""
        name = external_name or self.external_name(job_id)
        client = _load_client()
        batch = client.BatchV1Api()
        try:
            batch.delete_namespaced_job(
                name=name,
                namespace=settings.k8s_namespace,
                body=client.V1DeleteOptions(propagation_policy="Background"),
            )
        except client.exceptions.ApiException:
            pass
        self._delete_job_token_secret(client.CoreV1Api(), job_id)

    def _job_token_secret_name(self, job_id: str) -> str:
        return f"copilot-job-{job_id}"[:63]

    def _ensure_job_token_secret(self, core, client, job_id: str) -> str:
        token = _runtime_value(job_id, "copilot_token")
        if not token:
            return settings.k8s_secret_name
        name = self._job_token_secret_name(job_id)
        body = client.V1Secret(
            metadata=client.V1ObjectMeta(
                name=name,
                namespace=settings.k8s_namespace,
                labels={"app": "ai-test-runner", "job-id": job_id},
            ),
            string_data={"COPILOT_GITHUB_TOKEN": token},
            type="Opaque",
        )
        try:
            core.create_namespaced_secret(settings.k8s_namespace, body)
        except client.exceptions.ApiException as exc:
            if exc.status != 409:
                raise
            core.replace_namespaced_secret(name, settings.k8s_namespace, body)
        return name

    def _delete_job_token_secret(self, core, job_id: str) -> None:
        name = self._job_token_secret_name(job_id)
        if name == settings.k8s_secret_name:
            return
        try:
            core.delete_namespaced_secret(name, settings.k8s_namespace)
        except Exception:  # noqa: BLE001
            pass

    def _should_stop(self, job_id: str) -> str | None:
        """Return a reason if this worker should drop the Kubernetes Job."""
        from app.database import session_scope
        from app.models.jobs import Job, JobStatus
        from app.services import queue as work_queue

        lost = work_queue.lease_lost.get()
        if lost is not None and lost.is_set():
            return "lease lost"
        with session_scope() as db:
            job = db.get(Job, job_id)
            if job is not None and job.status is JobStatus.CANCELLED:
                return "cancelled"
        return None

    def run(
        self, job_id: str, workspace: Path, stage: str = "generate",
        reprocess: bool = False, attempt: int = 0,
        workflow: str = "test-case-generation", runner: str = "bespoke",
    ) -> ExecutionResult:
        client = _load_client()
        batch = client.BatchV1Api()
        core = client.CoreV1Api()

        k8s_job_name = self.external_name(job_id, stage, attempt)
        engine = _runtime_value(job_id, "engine") or settings.engine
        token_secret = self._ensure_job_token_secret(core, client, job_id)
        manifest = self.build_manifest(
            job_id, k8s_job_name, stage, reprocess, workflow, runner,
            engine=engine, token_secret=token_secret,
        )

        try:
            batch.create_namespaced_job(namespace=settings.k8s_namespace, body=manifest)
        except client.exceptions.ApiException as exc:
            self._delete_job_token_secret(core, job_id)
            return ExecutionResult(
                succeeded=False,
                exit_code=1,
                detail=f"Failed to create Job: {exc.reason}",
                external_name=k8s_job_name,
            )

        deadline = time.monotonic() + settings.job_timeout_seconds
        succeeded: bool | None = None
        stop_reason: str | None = None

        while time.monotonic() < deadline:
            stop_reason = self._should_stop(job_id)
            if stop_reason:
                break
            try:
                status = batch.read_namespaced_job_status(
                    name=k8s_job_name, namespace=settings.k8s_namespace
                ).status
            except client.exceptions.ApiException as exc:
                self._delete_job_token_secret(core, job_id)
                return ExecutionResult(
                    False, 1, f"Lost track of Job: {exc.reason}", k8s_job_name
                )

            if status.succeeded:
                succeeded = True
                break
            if status.failed:
                succeeded = False
                break
            time.sleep(3)

        if stop_reason or succeeded is None:
            try:
                batch.delete_namespaced_job(
                    name=k8s_job_name,
                    namespace=settings.k8s_namespace,
                    body=client.V1DeleteOptions(propagation_policy="Background"),
                )
            except client.exceptions.ApiException:
                pass

        self._collect_logs(core, client, job_id, k8s_job_name, workspace)
        self._delete_job_token_secret(core, job_id)

        if stop_reason:
            return ExecutionResult(
                False, 130, f"Runner stopped ({stop_reason})", k8s_job_name
            )

        if succeeded is None:
            return ExecutionResult(
                False,
                124,
                f"Job exceeded {settings.job_timeout_seconds}s timeout",
                k8s_job_name,
            )

        if succeeded:
            return ExecutionResult(True, 0, external_name=k8s_job_name)
        return ExecutionResult(False, 1, "Runner pod reported failure", k8s_job_name)

    def _collect_logs(self, core, client, job_id: str, k8s_job_name: str, workspace: Path) -> None:
        """Persist pod logs into the workspace so /logs works after Job TTL expiry."""
        log_path = workspace / "output" / "execution.log"
        if log_path.exists() and log_path.stat().st_size > 0:
            return  # runner already wrote them to the shared volume

        try:
            pods = core.list_namespaced_pod(
                namespace=settings.k8s_namespace, label_selector=f"job-id={job_id}"
            )
            if not pods.items:
                return
            logs = core.read_namespaced_pod_log(
                name=pods.items[0].metadata.name, namespace=settings.k8s_namespace
            )
        except client.exceptions.ApiException as exc:
            logs = f"[orchestrator] could not read pod logs: {exc.reason}\n"

        log_path.parent.mkdir(parents=True, exist_ok=True)
        log_path.write_text(logs, encoding="utf-8")
