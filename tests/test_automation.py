"""Schedules, webhooks, bulk submission and cost insight."""
from datetime import datetime, timezone

import pytest

from app.services import cron

REQUIREMENT = (
    "REQ-AUTO Weekly regression sweep\n\n"
    "Generate a regression suite from the current backlog.\n"
    "- Every open story is covered.\n"
    "- The suite is reproducible."
)


# ---------------------------------------------------------------------- cron


@pytest.mark.parametrize(
    "expression,description",
    [
        ("0 6 * * 1", "Every Monday at 06:00 UTC"),
        ("*/15 * * * *", "Every 15 minutes"),
        ("0 0 * * *", "Daily at 00:00 UTC"),
        ("@daily", "Daily at 00:00 UTC"),
    ],
)
def test_cron_describes_itself(expression, description):
    """A wrong expression should be obvious before it fires, not after."""
    assert cron.describe(expression) == description


def test_cron_computes_the_next_firing():
    schedule = cron.validate("0 6 * * 1")  # Mondays at 06:00
    after = datetime(2026, 8, 27, 12, 0, tzinfo=timezone.utc)  # a Thursday
    nxt = schedule.next_after(after)
    assert nxt.weekday() == 0  # Monday
    assert (nxt.hour, nxt.minute) == (6, 0)
    assert nxt > after


def test_cron_handles_sunday_as_both_0_and_7():
    assert cron.validate("0 0 * * 0").weekdays == cron.validate("0 0 * * 7").weekdays


@pytest.mark.parametrize(
    "bad", ["", "* * * *", "60 * * * *", "* 25 * * *", "a * * * *", "*/0 * * * *"]
)
def test_bad_cron_is_rejected_with_a_reason(bad):
    with pytest.raises(cron.CronError):
        cron.validate(bad)


def test_cron_preview_endpoint(operator):
    response = operator.post("/api/v1/cron/preview", json={"cron": "0 9 * * 1-5"})
    assert response.status_code == 200
    body = response.json()
    assert len(body["next_runs"]) == 5
    assert body["description"]

    assert operator.post("/api/v1/cron/preview", json={"cron": "nonsense"}).status_code == 400


# ----------------------------------------------------------------- schedules


@pytest.fixture
def schedule(author):
    response = author.post(
        "/api/v1/schedules",
        json={
            "name": "Weekly sweep",
            "workflow": "test-case-generation",
            "cron": "0 6 * * 1",
            "requirement": REQUIREMENT,
            "engine": "mock",
        },
    )
    assert response.status_code == 201, response.text
    schedule_id = response.json()["id"]
    yield response.json()
    author.delete(f"/api/v1/schedules/{schedule_id}")


def test_a_schedule_records_when_it_next_fires(schedule):
    assert schedule["next_run_at"] is not None
    assert schedule["cron_description"] == "Every Monday at 06:00 UTC"
    assert schedule["run_count"] == 0


def test_a_schedule_for_an_unknown_workflow_is_rejected(author):
    response = author.post(
        "/api/v1/schedules",
        json={
            "name": "Nope",
            "workflow": "does-not-exist",
            "cron": "0 6 * * 1",
            "requirement": REQUIREMENT,
        },
    )
    assert response.status_code == 400


def test_a_schedule_with_bad_cron_is_rejected(author):
    response = author.post(
        "/api/v1/schedules",
        json={
            "name": "Nope",
            "workflow": "test-case-generation",
            "cron": "not cron at all",
            "requirement": REQUIREMENT,
        },
    )
    assert response.status_code == 422


def test_a_schedule_can_be_fired_by_hand(author, schedule):
    """Useful for checking a schedule works without waiting for its window."""
    response = author.post(f"/api/v1/schedules/{schedule['id']}/run")
    assert response.status_code == 201
    assert response.json()["schedule_id"] == schedule["id"]

    job = author.get(f"/api/v1/jobs/{response.json()['job_id']}").json()
    assert job["schedule_id"] == schedule["id"]


def test_a_due_schedule_fires_once_even_with_several_replicas(author, operator):
    """Two replicas ticking together must not double-submit."""
    from app.database import session_scope
    from app.models.automation import Schedule
    from app.services import scheduler

    created = author.post(
        "/api/v1/schedules",
        json={
            "name": "Due now",
            "workflow": "test-case-generation",
            "cron": "*/5 * * * *",
            "requirement": REQUIREMENT,
            "engine": "mock",
        },
    ).json()

    try:
        # Backdate it so this tick is due.
        with session_scope() as db:
            record = db.get(Schedule, created["id"])
            record.next_run_at = datetime(2020, 1, 1, tzinfo=timezone.utc)

        first = scheduler.fire_due_schedules()
        second = scheduler.fire_due_schedules()  # a second replica, same moment

        assert first == 1
        assert second == 0, "the same tick fired twice"

        after = author.get(f"/api/v1/schedules/{created['id']}").json()
        assert after["run_count"] == 1
        assert after["last_job_id"]
        # next_run_at moved forward, so it will not fire again immediately.
        assert after["next_run_at"] > datetime.now(timezone.utc).isoformat()
    finally:
        author.delete(f"/api/v1/schedules/{created['id']}")


def test_only_an_author_can_create_a_schedule(operator):
    response = operator.post(
        "/api/v1/schedules",
        json={
            "name": "Nope",
            "workflow": "test-case-generation",
            "cron": "0 6 * * 1",
            "requirement": REQUIREMENT,
        },
    )
    assert response.status_code == 403


# ------------------------------------------------------------------- bulk


def test_bulk_submission_accepts_many_at_once(operator):
    response = operator.post(
        "/api/v1/jobs/bulk",
        json={
            "workflow": "test-case-generation",
            "engine": "mock",
            "items": [
                {"requirement": f"REQ-BULK-{i} Something worth testing here.", "reference": f"S-{i}"}
                for i in range(3)
            ],
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["submitted"] == 3
    assert body["rejected"] == 0
    assert [j["reference"] for j in body["jobs"]] == ["S-0", "S-1", "S-2"]


def test_bulk_reports_partial_success(operator, monkeypatch):
    """One bad item must not discard the good ones."""
    from app.config import settings as app_settings
    from app.services import job_service

    real = job_service.create_job
    calls = {"n": 0}

    def flaky(*args, **kwargs):
        calls["n"] += 1
        if calls["n"] == 2:
            raise job_service.JobError("simulated failure", status_code=400)
        return real(*args, **kwargs)

    monkeypatch.setattr(job_service, "create_job", flaky)

    response = operator.post(
        "/api/v1/jobs/bulk",
        json={
            "workflow": "test-case-generation",
            "engine": "mock",
            "items": [
                {"requirement": f"REQ-PARTIAL-{i} Something worth testing here."}
                for i in range(3)
            ],
        },
    )
    body = response.json()
    assert body["submitted"] == 2
    assert body["rejected"] == 1
    assert body["errors"][0]["index"] == 1


def test_bulk_rejects_an_unknown_workflow_outright(operator):
    response = operator.post(
        "/api/v1/jobs/bulk",
        json={
            "workflow": "not-a-workflow",
            "items": [{"requirement": "REQ-X Something worth testing here."}],
        },
    )
    assert response.status_code == 400


# ---------------------------------------------------------------- webhooks


def test_a_job_with_a_webhook_queues_a_delivery(operator, worker):
    import time

    response = operator.post(
        "/api/v1/jobs",
        json={
            "workflow": "test-case-generation",
            "requirement": REQUIREMENT,
            "engine": "mock",
            "webhook_url": "https://example.invalid/hook",
        },
    )
    job_id = response.json()["job_id"]

    # Reject at the gate: a fast route to a terminal state.
    deadline = time.monotonic() + 40
    while time.monotonic() < deadline:
        if operator.get(f"/api/v1/jobs/{job_id}").json()["status"] == "AWAITING_APPROVAL":
            break
        time.sleep(0.1)
    operator.post(f"/api/v1/jobs/{job_id}/reject", json={"actor": "x", "reason": "no"})

    deliveries = operator.get(f"/api/v1/webhooks/deliveries?job_id={job_id}").json()
    assert len(deliveries) == 1
    assert deliveries[0]["status"] == "pending"
    assert deliveries[0]["url"] == "https://example.invalid/hook"


def test_a_failed_delivery_can_be_retried(operator):
    """After fixing the receiving end, without re-running the job."""
    from app.database import session_scope
    from app.models.automation import WebhookDelivery

    job_id = operator.post(
        "/api/v1/jobs",
        json={
            "workflow": "test-case-generation",
            "requirement": REQUIREMENT,
            "engine": "mock",
        },
    ).json()["job_id"]

    with session_scope() as db:
        record = WebhookDelivery(
            job_id=job_id,
            url="https://example.invalid/hook",
            status="failed",
            attempts=5,
            error="connection refused",
        )
        db.add(record)
        db.flush()
        delivery_id = record.id

    response = operator.post(f"/api/v1/webhooks/deliveries/{delivery_id}/retry")
    assert response.status_code == 200

    listed = operator.get("/api/v1/webhooks/deliveries?status=pending").json()
    assert any(d["id"] == delivery_id and d["attempts"] == 0 for d in listed)


# ---------------------------------------------------------------- insights


def test_a_run_reports_where_its_time_went(operator, worker):
    import time

    response = operator.post(
        "/api/v1/jobs",
        json={
            "workflow": "test-case-generation",
            "requirement": REQUIREMENT,
            "engine": "mock",
        },
    )
    job_id = response.json()["job_id"]

    deadline = time.monotonic() + 40
    while time.monotonic() < deadline:
        if operator.get(f"/api/v1/jobs/{job_id}").json()["status"] == "AWAITING_APPROVAL":
            break
        time.sleep(0.1)

    body = operator.get(f"/api/v1/insights/jobs/{job_id}").json()
    assert body["job_id"] == job_id
    assert "totals" in body
    assert body["pricing_version"]


def test_cost_is_none_for_an_unpriced_model():
    """An unknown model has an unknown cost. Reporting zero would understate it."""
    from app.services import insights

    assert insights.estimate_cost("some-model-nobody-priced", 1000, 1000) is None
    priced = insights.estimate_cost("gpt-4o", 1_000_000, 1_000_000)
    assert priced == pytest.approx(12.50)


def test_agent_and_workflow_leaderboards_are_available(operator):
    agents = operator.get("/api/v1/insights/agents?days=30").json()
    assert "agents" in agents and "pricing_version" in agents

    workflows = operator.get("/api/v1/insights/workflows?days=30").json()
    assert "workflows" in workflows


def test_two_runs_can_be_compared(operator, worker):
    import time

    ids = []
    for _ in range(2):
        response = operator.post(
            "/api/v1/jobs",
            json={
                "workflow": "test-case-generation",
                "requirement": REQUIREMENT,
                "engine": "mock",
            },
        )
        ids.append(response.json()["job_id"])

    deadline = time.monotonic() + 40
    while time.monotonic() < deadline:
        statuses = [operator.get(f"/api/v1/jobs/{i}").json()["status"] for i in ids]
        if all(s == "AWAITING_APPROVAL" for s in statuses):
            break
        time.sleep(0.1)

    body = operator.get(f"/api/v1/insights/compare?left={ids[0]}&right={ids[1]}").json()
    assert body["same_workflow"] is True
    assert "totals" in body

    missing = operator.get(f"/api/v1/insights/compare?left={ids[0]}&right=nope")
    assert missing.status_code == 404
