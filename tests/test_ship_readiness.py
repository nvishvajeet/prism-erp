from __future__ import annotations

import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


def test_ship_readiness_check_exits_zero():
    result = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "ship_readiness_check.py")],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stdout + "\n" + result.stderr
    assert "Summary: 5/5 checks passed" in result.stdout
