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
        self, job_id: str, k8s_job_name: str, stage: str = "generate", reprocess: bool = False
    ) -> dict:
        """Build the Job manifest. Pure function — unit-testable without a cluster."""
        return {
            "apiVersion": "batch/v1",
            "kind": "Job",
            "metadata": {
                "name": k8s_job_name,
                "namespace": settings.k8s_namespace,
                "labels": {
                    "app": "ai-test-runner",
                    "workflow": "test-case-generation",
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
                                    "readOnlyRootFilesystem": False,
                                    "capabilities": {"drop": ["ALL"]},
                                },
                                "env": [
                                    {"name": "JOB_ID", "value": job_id},
                                    {"name": "ENGINE", "value": settings.engine},
                                    {"name": "STAGE", "value": stage},
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
                                                "name": settings.k8s_secret_name,
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
                                    }
                                ],
                            }
                        ],
                        "volumes": [
                            {
                                "name": "artifacts",
                                "persistentVolumeClaim": {"claimName": ARTIFACT_PVC},
                            }
                        ],
                    },
                },
            },
        }

    def run(
        self, job_id: str, workspace: Path, stage: str = "generate",
        reprocess: bool = False, attempt: int = 0
    ) -> ExecutionResult:
        client = _load_client()
        batch = client.BatchV1Api()
        core = client.CoreV1Api()

        # One Job per stage, so a reprocess does not collide with the first run.
        k8s_job_name = self.external_name(job_id, stage, attempt)
        manifest = self.build_manifest(job_id, k8s_job_name, stage, reprocess)

        try:
            batch.create_namespaced_job(namespace=settings.k8s_namespace, body=manifest)
        except client.exceptions.ApiException as exc:
            return ExecutionResult(
                succeeded=False,
                exit_code=1,
                detail=f"Failed to create Job: {exc.reason}",
                external_name=k8s_job_name,
            )

        deadline = time.monotonic() + settings.job_timeout_seconds
        succeeded: bool | None = None

        while time.monotonic() < deadline:
            try:
                status = batch.read_namespaced_job_status(
                    name=k8s_job_name, namespace=settings.k8s_namespace
                ).status
            except client.exceptions.ApiException as exc:
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

        self._collect_logs(core, client, job_id, k8s_job_name, workspace)

        if succeeded is None:
            try:
                batch.delete_namespaced_job(
                    name=k8s_job_name,
                    namespace=settings.k8s_namespace,
                    body=client.V1DeleteOptions(propagation_policy="Background"),
                )
            except client.exceptions.ApiException:
                pass
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
