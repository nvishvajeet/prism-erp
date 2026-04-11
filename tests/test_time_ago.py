"""Regression test for the `time_ago()` humanisation helper.

Shipped in `36fe93f` as part of W1.4.1 c1a to drive the
`.row-time-hint` muted spans under queue row timestamps. The
function is intentionally forgiving on input (accepts ISO 8601,
common SQLite formats, `datetime` objects, and returns "" on
anything unparseable) but must produce stable, grammatical output
for the happy paths so the UI never shows "just now ago" or
similar. That bug existed in the first draft and was fixed
mid-session before `36fe93f` landed — this test locks the fix.

Run directly:

    .venv/bin/python tests/test_time_ago.py

Exits 0 on success, 1 on any failure with a one-line summary per
failure. Pure function, no DB, no Flask context — so it also
runs fine as part of any future `tests` wave in the crawler
harness.
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

os.environ.setdefault("LAB_SCHEDULER_DEMO_MODE", "1")
os.environ.setdefault("LAB_SCHEDULER_CSRF", "0")
os.environ.setdefault("OWNER_EMAILS", "admin@lab.local")

import app as prism_app  # noqa: E402

time_ago = prism_app.time_ago


def build_cases() -> list[tuple[str, object, str]]:
    """Construct cases against a fresh `now` sampled at call time.

    Each past/future timedelta carries a 30-second buffer past the
    bucket boundary so the microsecond drift between case
    construction and the function's internal `datetime.now()` cannot
    flip the floor (e.g. 4h exactly rounding down to 3h).
    """
    now = datetime.now()
    buf = timedelta(seconds=30)
    return [
        ("None",                    None,                                       ""),
        ("empty string",            "",                                         ""),
        ("dash sentinel",           "-",                                        ""),
        ("unparseable garbage",     "not-a-date",                               ""),
        ("just now (datetime)",     now - timedelta(seconds=2),                 "just now"),
        ("~5 minutes ago",          now - (timedelta(minutes=5) + buf),         "5m ago"),
        ("~2 hours ago",            now - (timedelta(hours=2) + buf),           "2h ago"),
        ("~3 days ago",             now - (timedelta(days=3) + buf),            "3d ago"),
        ("~2 months ago",           now - (timedelta(days=65) + buf),           "2mo ago"),
        ("~1 year ago",             now - (timedelta(days=400) + buf),          "1y ago"),
        ("4 hours in the future",   now + (timedelta(hours=4) + buf),           "in 4h"),
        ("2 minutes in the future", now + (timedelta(minutes=2) + buf),         "in 2m"),
        ("just-now future",         now + timedelta(seconds=5),                 "in moments"),
    ]


def main() -> int:
    cases = build_cases()
    failures: list[str] = []
    for label, raw, expected in cases:
        got = time_ago(raw)
        if got != expected:
            failures.append(f"{label}: expected {expected!r}, got {got!r}")

    # Extra: parseable ISO-8601 string input.
    iso_past = (datetime.now() - (timedelta(hours=1) + timedelta(seconds=30))).isoformat()
    got_iso = time_ago(iso_past)
    if got_iso != "1h ago":
        failures.append(f"ISO string 1h ago: expected '1h ago', got {got_iso!r}")

    # Extra: non-grammatical regression — "just now ago" was a bug in
    # the first draft. This assertion locks the fix.
    bug_probe = time_ago(datetime.now() - timedelta(seconds=1))
    if bug_probe.endswith(" ago") and "just now" in bug_probe:
        failures.append(f"'just now ago' regression: got {bug_probe!r}")

    if failures:
        print(f"time_ago: {len(failures)} failure(s):")
        for f in failures:
            print(f"  - {f}")
        return 1

    total = len(cases) + 2
    print(f"time_ago: {total}/{total} cases passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
