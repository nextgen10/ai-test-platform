"""Shared test setup.

The suite runs against a real app instance, so the environment has to be set up
*before* `app.config` is imported — its Settings class reads os.environ at class
definition time.

Authenticated clients are exposed as fixtures rather than importable constants:
a `tests` package on sys.path from site-packages would otherwise shadow this
module and break `from tests.conftest import ...`.
"""
import os
import sys
import tempfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
RUNNER_DIR = ROOT / "runner"

for p in (ROOT, BACKEND_DIR, RUNNER_DIR):
    str_p = str(p)
    if str_p not in sys.path:
        sys.path.insert(0, str_p)

# --- credentials the suite authenticates with --------------------------------
# One token per role, so tests can assert that authorisation actually bites
# rather than only that the happy path works.
READER_TOKEN = "test-reader-token-0000000000"
OPERATOR_TOKEN = "test-operator-token-000000000"
OPERATOR_B_TOKEN = "test-operator-b-token-00000"
AUTHOR_TOKEN = "test-author-token-00000000000"
ADMIN_TOKEN = "test-admin-token-000000000000"

# Assignment, not setdefault: a developer's shell (or a sourced .env) otherwise
# decides how the suite runs, and the results stop being reproducible.
os.environ["AUTH_MODE"] = "token"
os.environ["ENABLE_DOCS"] = ""
os.environ["API_TOKENS"] = ",".join(
    [
        f"{READER_TOKEN}:test-reader:reader",
        f"{OPERATOR_TOKEN}:test-operator:operator",
        f"{OPERATOR_B_TOKEN}:test-operator-b:operator",
        f"{AUTHOR_TOKEN}:test-author:author",
        f"{ADMIN_TOKEN}:test-admin:admin",
    ]
)

# A hermetic run: its own database, artifact tree and credential directory, so
# the suite neither reads nor corrupts the developer's working state.
_TMP = Path(tempfile.mkdtemp(prefix="agent-hub-tests-"))
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP / 'test-jobs.db'}"
os.environ["ARTIFACT_ROOT"] = str(_TMP / "artifacts")
os.environ["JOB_RUNTIME_ROOT"] = str(_TMP / "runtime")

# Jobs are owned by the authenticated principal, so every test that submits one
# shares an identity and they accumulate against the per-user limit. Raise it
# here; the limit itself is exercised directly in test_security.py.
os.environ["MAX_CONCURRENT_JOBS_PER_USER"] = "500"
os.environ["MAX_CONCURRENT_JOBS_TOTAL"] = "1000"

# Never invoke a real Copilot CLI from a test.
os.environ["ENGINE"] = "mock"

# The app's own worker and scheduler are off; the suite starts a worker itself
# (see the `worker` fixture) so it controls the lifecycle, and drives the
# scheduler explicitly where a test needs a tick.
os.environ["RUN_WORKER"] = "false"
os.environ["RUN_SCHEDULER"] = "false"

# Tighter than production: a test should not wait 2s to notice new work.
os.environ["JOB_POLL_SECONDS"] = "0.1"

from fastapi.testclient import TestClient  # noqa: E402

from app.database import init_db  # noqa: E402
from app.main import app  # noqa: E402
from app.security import configure_auth  # noqa: E402

init_db()
configure_auth()


def _client(token: str | None) -> TestClient:
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return TestClient(app, headers=headers)


@pytest.fixture(scope="session")
def anonymous() -> TestClient:
    """No credential at all — used to prove endpoints are actually closed."""
    return _client(None)


@pytest.fixture(scope="session")
def reader() -> TestClient:
    return _client(READER_TOKEN)


@pytest.fixture(scope="session")
def operator() -> TestClient:
    return _client(OPERATOR_TOKEN)


@pytest.fixture(scope="session")
def operator_b() -> TestClient:
    return _client(OPERATOR_B_TOKEN)


@pytest.fixture(scope="session")
def author() -> TestClient:
    return _client(AUTHOR_TOKEN)


@pytest.fixture(scope="session")
def admin() -> TestClient:
    return _client(ADMIN_TOKEN)


@pytest.fixture(scope="session")
def client(operator: TestClient) -> TestClient:
    """Default client for tests that only care about the happy path."""
    return operator


@pytest.fixture(scope="session")
def worker():
    """A running queue worker, for tests that expect jobs to actually execute.

    Execution no longer rides on the request that submitted it, so a test that
    wants a job to progress has to let something claim it.
    """
    from app.services import queue

    running = queue.Worker(concurrency=2)
    running.start()
    yield running
    running.stop()
