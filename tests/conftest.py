import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
RUNNER_DIR = ROOT / "runner"

for p in (ROOT, BACKEND_DIR, RUNNER_DIR):
    str_p = str(p)
    if str_p not in sys.path:
        sys.path.insert(0, str_p)
