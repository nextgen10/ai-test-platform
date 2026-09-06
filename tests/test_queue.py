"""The work queue: claims, leases, and what happens when a worker dies.

These are the properties that make more than one replica safe. If any of them
regress, the platform silently goes back to being single-replica — and the way
you find out is two workers running the same job.
"""
from datetime import datetime, timedelta, timezone

import pytest

from app.database import session_scope
from app.models.jobs import Job, JobStatus
from app.services import queue

REQUIREMENT = (
    "REQ-QUEUE Queue behaviour\n\n"
    "The platform must survive a worker dying mid-job.\n"
    "- A claim is exclusive.\n"
    "- An expired lease returns the job to the pool."
)


@pytest.fixture
def queued_job():
    """A queued job row, parked so a live worker cannot claim it.

    These tests exercise the lease primitives directly, and the suite's shared
    worker would otherwise race them for the row. The lease is held by a
    sentinel with a far-future expiry; tests that need contention clear it
    themselves.
    """
    from app.models.jobs import Job

    with session_scope() as db:
        job = Job(
            workflow="test-case-generation",
            created_by="test-operator",
            status=JobStatus.QUEUED,
            lease_owner="parked-for-test",
            lease_expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )
        db.add(job)
        db.flush()
        job_id = job.id

    yield job_id

    with session_scope() as db:
        stale = db.get(Job, job_id)
        if stale is not None:
            db.delete(stale)


def _unpark(job_id: str) -> None:
    """Release the sentinel lease so the job becomes genuinely claimable."""
    queue.release(job_id, worker="parked-for-test")


def test_submitting_does_not_dispatch(operator):
    """The row is the work item. Nothing runs on the request that created it."""
    response = operator.post(
        "/api/v1/jobs",
        json={
            "workflow": "test-case-generation",
            "requirement": REQUIREMENT,
            "engine": "mock",
        },
    )
    assert response.status_code == 201
    # The response is the claim being tested: accepted and queued, not started.
    assert response.json()["status"] == "QUEUED"


def test_exactly_one_worker_wins_a_contested_claim(queued_job):
    """The whole design rests on this being atomic."""
    _unpark(queued_job)
    results = [queue.claim(queued_job, worker=f"worker-{i}") for i in range(8)]
    assert sum(results) == 1, "more than one worker claimed the same job"


def test_only_the_holder_can_renew(queued_job):
    _unpark(queued_job)
    assert queue.claim(queued_job, worker="holder")
    assert queue.renew(queued_job, worker="holder") is True
    assert queue.renew(queued_job, worker="someone-else") is False


def test_releasing_makes_a_job_claimable_again(queued_job):
    _unpark(queued_job)
    assert queue.claim(queued_job, worker="first")
    assert queue.claim(queued_job, worker="second") is False

    queue.release(queued_job, worker="first")
    assert queue.claim(queued_job, worker="second") is True
    queue.release(queued_job, worker="second")


def test_an_expired_lease_is_reclaimed_rather_than_failed(operator, queued_job):
    """A worker that dies must not cost the job.

    The old behaviour failed everything in flight at startup, which is why the
    platform could only ever run one replica.
    """
    _unpark(queued_job)
    with session_scope() as db:
        job = db.get(Job, queued_job)
        job.lease_owner = "a-worker-that-died"
        job.lease_expires_at = datetime.now(timezone.utc) - timedelta(minutes=10)

    assert queue.reclaim_expired() >= 1

    after = operator.get(f"/api/v1/jobs/{queued_job}").json()
    assert after["status"] == "QUEUED", "a reclaimed job must not be failed"
    assert after["lease_owner"] is None
    assert queue.claim(queued_job, worker="a-live-worker") is True
    queue.release(queued_job, worker="a-live-worker")


def test_an_analyzing_job_is_requeued_when_its_lease_expires(operator, queued_job):
    """ANALYZING used to be reclaimed into a state that claim_next would skip."""
    _unpark(queued_job)
    with session_scope() as db:
        job = db.get(Job, queued_job)
        job.status = JobStatus.ANALYZING
        job.lease_owner = "a-worker-that-died"
        job.lease_expires_at = datetime.now(timezone.utc) - timedelta(minutes=10)

    assert queue.reclaim_expired() >= 1
    after = operator.get(f"/api/v1/jobs/{queued_job}").json()
    assert after["status"] == "QUEUED"
    assert after["lease_owner"] is None
    assert queue.claim(queued_job, worker="a-live-worker") is True
    queue.release(queued_job, worker="a-live-worker")


def test_a_live_lease_is_left_alone(queued_job):
    """Reconciliation must not touch work another replica is actively doing."""
    _unpark(queued_job)
    assert queue.claim(queued_job, worker="busy-worker")
    queue.reclaim_expired()

    with session_scope() as db:
        job = db.get(Job, queued_job)
        assert job.lease_owner == "busy-worker"

    queue.release(queued_job, worker="busy-worker")


def test_a_job_that_keeps_killing_its_worker_is_eventually_failed(operator, queued_job):
    """Bounded retry: a poison job must not cycle forever."""
    _unpark(queued_job)
    with session_scope() as db:
        job = db.get(Job, queued_job)
        job.attempt = queue.MAX_ATTEMPTS
        job.lease_owner = "dead"
        job.lease_expires_at = datetime.now(timezone.utc) - timedelta(minutes=10)

    queue.reclaim_expired()

    after = operator.get(f"/api/v1/jobs/{queued_job}").json()
    assert after["status"] == "FAILED"
    assert "attempted" in (after["error_message"] or "")


def _drive(job_id: str) -> None:
    """Run whatever the job owes next, here and now.

    Tests used to start a worker and poll for a status change with a wall-clock
    deadline. That makes the suite's result depend on how busy the machine is —
    one run reported a failure that sixteen reruns could not reproduce, which is
    the worst kind of test: it costs a real investigation and yields nothing.

    Claiming and executing synchronously exercises exactly the same code the
    worker loop calls, and it either works or it does not.
    """
    from app.services import job_service

    assert queue.claim(job_id), f"job {job_id} was not claimable"
    try:
        job_service.execute_claimed(job_id)
    finally:
        queue.release(job_id)


def test_reclamation_does_not_rewind_an_approved_job(operator):
    """An approved job knocked back to QUEUED would re-run its analysis stage.

    Reclamation therefore clears only the lease and leaves status alone.
    """
    response = operator.post(
        "/api/v1/jobs",
        json={
            "workflow": "test-case-generation",
            "requirement": REQUIREMENT,
            "engine": "mock",
        },
    )
    job_id = response.json()["job_id"]

    _drive(job_id)  # QUEUED -> analysis -> AWAITING_APPROVAL
    assert operator.get(f"/api/v1/jobs/{job_id}").json()["status"] == "AWAITING_APPROVAL"

    operator.post(f"/api/v1/jobs/{job_id}/approve", json={"actor": "x"})

    # Simulate the worker dying immediately after approval.
    with session_scope() as db:
        job = db.get(Job, job_id)
        if job.status is JobStatus.RUNNING:
            job.lease_owner = "died-right-after-approval"
            job.lease_expires_at = datetime.now(timezone.utc) - timedelta(minutes=10)
            job.attempt = 0

    queue.reclaim_expired()

    with session_scope() as db:
        job = db.get(Job, job_id)
        # RUNNING, not QUEUED: the gate has already been passed.
        assert job.status in (JobStatus.RUNNING, JobStatus.COMPLETED)


def test_shutdown_hands_in_flight_work_straight_back(queued_job):
    """A rolling update must not park a job for a whole lease period.

    A replica going away stops renewing, so without this the job waits out
    JOB_LEASE_SECONDS before any healthy replica may touch it — a planned
    deploy would be slower to recover from than a crash.
    """
    with session_scope() as db:
        job = db.get(Job, queued_job)
        job.status = JobStatus.ANALYZING
        job.lease_owner = queue.WORKER_ID
        job.lease_expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

    assert queue.abandon_in_flight() >= 1

    with session_scope() as db:
        job = db.get(Job, queued_job)
        # Back to a state `claim_next` actually looks at, with no owner. Left
        # ANALYZING-with-no-lease it would be invisible to both the claimer and
        # the reconciler, and would sit there for good.
        assert job.status is JobStatus.QUEUED
        assert job.lease_owner is None

    assert queue.claim(queued_job, worker="a-healthy-replica")


def test_shutdown_leaves_another_replica_s_work_alone(queued_job):
    """Only this worker's jobs are handed back — never a peer's live work."""
    with session_scope() as db:
        job = db.get(Job, queued_job)
        job.status = JobStatus.RUNNING
        job.lease_owner = "another-replica"
        job.lease_expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

    queue.abandon_in_flight()

    with session_scope() as db:
        job = db.get(Job, queued_job)
        assert job.lease_owner == "another-replica"


def test_queue_endpoint_reports_depth(operator, queued_job):
    _unpark(queued_job)
    body = operator.get("/api/v1/queue").json()
    assert body["waiting"] >= 1
    assert "worker_id" in body
    assert body["lease_seconds"] > 0


def test_a_normal_gated_lifecycle_does_not_spend_the_crash_budget(operator):
    """Succeeding must not exhaust the retry budget.

    `attempt` is how many times a worker took this row without finishing the
    work it was taken for. A gated workflow needs two claims to succeed —
    analyse, then generate after approval — which is exactly MAX_ATTEMPTS. With
    nothing resetting the counter, a healthy job hit its crash limit by working
    correctly, and the next claim was refused before it ran. Reprocess was the
    visible casualty; a worker dying during generation was the silent one.
    """
    job_id = operator.post(
        "/api/v1/jobs",
        json={"workflow": "test-case-generation", "requirement": REQUIREMENT, "engine": "mock"},
    ).json()["job_id"]

    _drive(job_id)  # analysis, up to the gate
    assert operator.get(f"/api/v1/jobs/{job_id}").json()["status"] == "AWAITING_APPROVAL"

    operator.post(f"/api/v1/jobs/{job_id}/approve", json={"actor": "tester"})

    # Approval releases new work, so the budget starts again rather than
    # carrying the analysis claim forward into generation.
    with session_scope() as db:
        assert db.get(Job, job_id).attempt == 0

    _drive(job_id)  # generation, after the gate

    with session_scope() as db:
        job = db.get(Job, job_id)
        assert job.status is JobStatus.COMPLETED, job.error_message
        # One claim for generation, not a row sitting at its ceiling.
        assert job.attempt < queue.MAX_ATTEMPTS


def test_reprocess_starts_with_a_full_budget(operator):
    """A reprocess is work a person asked for, not a retry of a crash."""
    with session_scope() as db:
        job = Job(
            workflow="test-case-generation",
            created_by="test-operator",
            status=JobStatus.COMPLETED,
            attempt=queue.MAX_ATTEMPTS,  # where a normal completed job sits
            evaluation={"gaps": ["missing boundary cases"], "score": 0.7},
        )
        db.add(job)
        db.flush()
        job_id = job.id

    try:
        res = operator.post(f"/api/v1/jobs/{job_id}/reprocess", json={"actor": "tester"})
        assert res.status_code == 200, res.text

        with session_scope() as db:
            job = db.get(Job, job_id)
            assert job.status is JobStatus.RUNNING
            # Without this the very next claim fails the job before it runs.
            assert job.attempt == 0
            assert job.attempt < queue.MAX_ATTEMPTS
    finally:
        with session_scope() as db:
            stale = db.get(Job, job_id)
            if stale is not None:
                db.delete(stale)


def test_a_genuine_crash_loop_is_still_capped(queued_job):
    """Releasing the budget must not remove it."""
    with session_scope() as db:
        job = db.get(Job, queued_job)
        job.attempt = queue.MAX_ATTEMPTS
        job.lease_owner = None
        job.lease_expires_at = None

    queue.Worker(concurrency=1)._run_claimed(queued_job)

    with session_scope() as db:
        job = db.get(Job, queued_job)
        assert job.status is JobStatus.FAILED
        assert "MAX_ATTEMPTS" in (job.error_message or "")
