"""Regression test for format_dt() and format_date() helpers.

Both are exposed via inject_globals and render every timestamp
in the CATALYST UI. Silent drift in their output would ripple
across every tile — lock the behavior once so a change is
obvious in CI.

Run directly:

    .venv/bin/python tests/test_format_dt.py

Exits 0 on success, 1 on any failure with a one-line summary
per failure. Pure functions, no DB, no Flask context.
"""
from __future__ import annotations

import os
import sys
from datetime import date, datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

os.environ.setdefault("LAB_SCHEDULER_DEMO_MODE", "1")
os.environ.setdefault("LAB_SCHEDULER_CSRF", "0")
os.environ.setdefault("OWNER_EMAILS", "admin@lab.local")

import app as catalyst_app  # noqa: E402

format_dt = catalyst_app.format_dt
format_date = catalyst_app.format_date


def _check(failures: list[str], label: str, got: str, expected: str) -> None:
    if got != expected:
        failures.append(f"{label}: got {got!r}, expected {expected!r}")


def main() -> int:
    failures: list[str] = []

    # ---- format_dt: empty / sentinel inputs -------------------------
    _check(failures, "format_dt(None)", format_dt(None), "-")
    _check(failures, "format_dt('')", format_dt(""), "-")
    _check(failures, "format_dt('-')", format_dt("-"), "-")
    _check(failures, "format_dt('   ') (whitespace)", format_dt("   "), "-")

    # ---- format_dt: datetime object ---------------------------------
    dt_obj = datetime(2026, 4, 11, 8, 30, 5)
    _check(failures, "format_dt(datetime)", format_dt(dt_obj), "11/04/2026 08:30:05")

    # zero-padded single-digit month / day / hour / minute / second
    dt_pad = datetime(2026, 1, 2, 3, 4, 5)
    _check(failures, "format_dt(datetime zero-pad)", format_dt(dt_pad), "02/01/2026 03:04:05")

    # ---- format_dt: ISO-8601 with Z suffix --------------------------
    _check(
        failures,
        "format_dt(ISO Z)",
        format_dt("2026-04-11T08:30:00Z"),
        "11/04/2026 08:30:00",
    )

    # ---- format_dt: ISO-8601 with explicit offset -------------------
    _check(
        failures,
        "format_dt(ISO +00:00)",
        format_dt("2026-04-11T08:30:00+00:00"),
        "11/04/2026 08:30:00",
    )

    # ---- format_dt: common SQLite formats ---------------------------
    _check(
        failures,
        "format_dt('YYYY-MM-DD HH:MM:SS')",
        format_dt("2026-04-11 08:30:00"),
        "11/04/2026 08:30:00",
    )
    _check(
        failures,
        "format_dt('YYYY-MM-DD HH:MM')",
        format_dt("2026-04-11 08:30"),
        "11/04/2026 08:30:00",
    )
    _check(
        failures,
        "format_dt('YYYY-MM-DDTHH:MM')",
        format_dt("2026-04-11T08:30"),
        "11/04/2026 08:30:00",
    )
    _check(
        failures,
        "format_dt('YYYY-MM-DD')",
        format_dt("2026-04-11"),
        "11/04/2026 00:00:00",
    )

    # ---- format_dt: garbage falls through to input ------------------
    _check(
        failures,
        "format_dt('not-a-date')",
        format_dt("not-a-date"),
        "not-a-date",
    )
    _check(
        failures,
        "format_dt('2026-13-99')",
        format_dt("2026-13-99"),
        "2026-13-99",
    )

    # ---- format_date: empty / sentinel inputs -----------------------
    _check(failures, "format_date(None)", format_date(None), "-")
    _check(failures, "format_date('')", format_date(""), "-")
    _check(failures, "format_date('-')", format_date("-"), "-")
    _check(failures, "format_date('   ') (whitespace)", format_date("   "), "-")

    # ---- format_date: datetime object -> date part ------------------
    _check(
        failures,
        "format_date(datetime)",
        format_date(datetime(2026, 4, 11, 23, 59, 59)),
        "11/04/2026",
    )

    # ---- format_date: date object -----------------------------------
    _check(
        failures,
        "format_date(date)",
        format_date(date(2026, 4, 11)),
        "11/04/2026",
    )

    # ---- format_date: ISO-8601 with Z -------------------------------
    _check(
        failures,
        "format_date(ISO Z)",
        format_date("2026-04-11T08:30:00Z"),
        "11/04/2026",
    )

    # ---- format_date: plain YYYY-MM-DD ------------------------------
    _check(
        failures,
        "format_date('2026-04-11')",
        format_date("2026-04-11"),
        "11/04/2026",
    )

    # zero-padding sanity
    _check(
        failures,
        "format_date('2026-01-02')",
        format_date("2026-01-02"),
        "02/01/2026",
    )

    # ---- format_date: garbage falls through to input ----------------
    _check(
        failures,
        "format_date('not-a-date')",
        format_date("not-a-date"),
        "not-a-date",
    )

    if failures:
        print(f"test_format_dt: {len(failures)} failure(s):")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("test_format_dt: all cases passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
