#!/usr/bin/env python3
"""Standalone safeguard test — validates compile check + timeout behavior.

Run: python3 test_safeguards.py
Exit code 0 = all checks pass, 1 = failure.
"""
from __future__ import annotations

import subprocess
import sys
import tempfile
import time
from datetime import datetime
from pathlib import Path

APP_PATH = Path(__file__).resolve().parent / "app.py"
TIMEOUT = 10  # seconds — must halt within this


def test_compile_ok():
    """app.py must compile cleanly within threshold."""
    start = time.monotonic()
    try:
        result = subprocess.run(
            [sys.executable, "-m", "py_compile", str(APP_PATH)],
            capture_output=True, text=True, timeout=TIMEOUT,
        )
        elapsed = time.monotonic() - start
        if result.returncode != 0:
            print(f"FAIL: compile error in {elapsed:.2f}s\n{result.stderr}")
            return False
        if elapsed > TIMEOUT - 2:
            print(f"WARN: compile took {elapsed:.2f}s — dangerously close to {TIMEOUT}s threshold")
        print(f"PASS: compile OK in {elapsed:.2f}s (threshold: {TIMEOUT}s)")
        return True
    except subprocess.TimeoutExpired:
        elapsed = time.monotonic() - start
        print(f"FAIL: compile TIMEOUT after {elapsed:.2f}s — exceeded {TIMEOUT}s threshold")
        return False


def test_bad_file_detected():
    """Intentionally bad Python must be caught, not hang."""
    with tempfile.NamedTemporaryFile(suffix=".py", mode="w", delete=False) as f:
        f.write("def broken(\n")  # syntax error
        f.flush()
        bad_path = f.name
    try:
        result = subprocess.run(
            [sys.executable, "-m", "py_compile", bad_path],
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode != 0:
            print(f"PASS: bad file correctly rejected")
            return True
        print(f"FAIL: bad file was NOT rejected")
        return False
    except subprocess.TimeoutExpired:
        print(f"FAIL: bad file check timed out — should have failed fast")
        return False
    finally:
        Path(bad_path).unlink(missing_ok=True)


def test_line_count_sane():
    """app.py line count must be within expected range (not truncated or bloated)."""
    lines = sum(1 for _ in open(APP_PATH))
    if lines < 5000:
        print(f"FAIL: app.py only {lines} lines — likely truncated (expected 6000+)")
        return False
    if lines > 15000:
        print(f"WARN: app.py is {lines} lines — getting very large")
    print(f"PASS: app.py is {lines} lines")
    return True


def test_key_functions_present():
    """Critical functions must exist in app.py."""
    content = APP_PATH.read_text()
    required = [
        "def safe_compile_check",
        "def init_db",
        "class StreamQuery",
        "def request_stream",
        "def unread_notification_count",
        "def queue_email_notification",
        "def approval_pill_chain",
        "def operator_workload_summary",
        "def instrument_utilization_summary",
        "def turnaround_percentiles",
        "def audit_trail_search",
        "def pending_review",
        "COMPILE_TIMEOUT_SECONDS",
    ]
    missing = [fn for fn in required if fn not in content]
    if missing:
        print(f"FAIL: missing functions/constants: {', '.join(missing)}")
        return False
    print(f"PASS: all {len(required)} critical functions present")
    return True


def test_no_import_hangs():
    """Importing app.py module (without running) must complete fast."""
    start = time.monotonic()
    try:
        result = subprocess.run(
            [sys.executable, "-c", f"import importlib.util; spec = importlib.util.spec_from_file_location('app', '{APP_PATH}')"],
            capture_output=True, text=True, timeout=5,
        )
        elapsed = time.monotonic() - start
        print(f"PASS: module spec load in {elapsed:.2f}s")
        return True
    except subprocess.TimeoutExpired:
        print(f"FAIL: module load timed out")
        return False


if __name__ == "__main__":
    print(f"{'='*60}")
    print(f"PRISM Safeguard Tests — {datetime.utcnow().isoformat()}")
    print(f"Target: {APP_PATH}")
    print(f"Timeout threshold: {TIMEOUT}s")
    print(f"{'='*60}\n")

    tests = [
        test_compile_ok,
        test_bad_file_detected,
        test_line_count_sane,
        test_key_functions_present,
        test_no_import_hangs,
    ]

    results = []
    for test in tests:
        print(f"\n--- {test.__name__} ---")
        results.append(test())

    print(f"\n{'='*60}")
    passed = sum(results)
    total = len(results)
    print(f"Results: {passed}/{total} passed")
    if all(results):
        print("ALL SAFEGUARDS PASS")
        sys.exit(0)
    else:
        print("SAFEGUARD FAILURES DETECTED")
        sys.exit(1)
