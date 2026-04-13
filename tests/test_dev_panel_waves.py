"""Lock the `_dev_panel_waves()` parser in app.py.

This test pins down the contract the dev-portal WAVES tile relies on:

1. The parser can read the 'Time budget summary' markdown table in
   `docs/NEXT_WAVES.md` and return at least a handful of rows with all
   required keys populated.
2. Every row's `status` is one of {shipped, hot, pending} and exactly
   one row is marked `hot` — the design promise that "hot" means "first
   unshipped", which can only be satisfied by a single row.
3. Ship detection works via BOTH channels:
     - the `✅ SHIPPED` marker on a section header (W1.3.7 — untagged,
       rolled up into a later tag); and
     - a matching git tag (W1.3.8 → v1.3.8).
4. Letter-suffixed wave ids (W1.4.2a, W1.4.2b, ...) survive the regex
   fix and appear as distinct rows — guarding the regression that
   dropped them when the id pattern was purely numeric.

These are minimum invariants: the plan will gain new waves and retire
old ones over time, so the test avoids exact counts and orderings and
only asserts facts that should remain true across edits until the
parser contract itself changes.

Run directly:

    venv/bin/python tests/test_dev_panel_waves.py

Exits 0 on success, 1 on any failure with one line per failure.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

os.environ.setdefault("LAB_SCHEDULER_DEMO_MODE", "1")
os.environ.setdefault("LAB_SCHEDULER_CSRF", "0")
os.environ.setdefault("OWNER_EMAILS", "admin@lab.local")

import app as catalyst_app  # noqa: E402


REQUIRED_KEYS = ("wave", "track", "est", "blocks", "tag", "status")
VALID_STATUSES = {"shipped", "hot", "pending"}


def main() -> int:
    rows = catalyst_app._dev_panel_waves()
    failures: list[str] = []

    # 1. At least six rows — the plan has been at or above this number
    #    since W1.3.x and it is the smallest count that still exercises
    #    shipped / hot / pending together.
    if len(rows) < 6:
        failures.append(
            f"expected at least 6 rows, got {len(rows)}"
        )

    # 2. Every row has the required keys with non-None values for
    #    everything except `blocks` (which is legitimately "—" / empty
    #    for waves with no prerequisites).
    for idx, row in enumerate(rows):
        for key in REQUIRED_KEYS:
            if key not in row:
                failures.append(
                    f"row {idx} missing key {key!r}: {row!r}"
                )
                continue
            if key == "blocks":
                continue
            if row[key] is None or row[key] == "":
                failures.append(
                    f"row {idx} has empty {key!r}: {row!r}"
                )

    # 3. Every status is from the allowed set.
    for idx, row in enumerate(rows):
        status = row.get("status")
        if status not in VALID_STATUSES:
            failures.append(
                f"row {idx} has invalid status {status!r}: {row!r}"
            )

    # 4. Exactly one row is 'hot' — "first unshipped" is by design
    #    singular.
    hot_rows = [r for r in rows if r.get("status") == "hot"]
    if len(hot_rows) != 1:
        failures.append(
            f"expected exactly 1 'hot' row, got {len(hot_rows)}: "
            f"{[r.get('wave') for r in hot_rows]}"
        )

    # 5. W1.3.7 and W1.3.8 are present and both shipped. W1.3.7 ships
    #    via the SHIPPED marker on its section header (it was rolled
    #    into a later tag so it has no dedicated tag); W1.3.8 ships via
    #    the v1.3.8 git tag.
    by_wave = {r.get("wave"): r for r in rows}
    for wave in ("W1.3.7", "W1.3.8"):
        if wave not in by_wave:
            failures.append(f"expected wave {wave} in parser output")
            continue
        status = by_wave[wave].get("status")
        if status != "shipped":
            failures.append(
                f"wave {wave} expected 'shipped', got {status!r}"
            )

    # 6. Letter-suffixed wave ids survive the regex fix. Only assert if
    #    any such ids are in the current plan; if they've all been
    #    retired, skip rather than fail on absence.
    letter_suffixed = [
        r for r in rows
        if r.get("wave", "")
        and r["wave"].startswith("W")
        and r["wave"][-1].isalpha()
    ]
    plan_text = (catalyst_app.BASE_DIR / "docs" / "NEXT_WAVES.md").read_text(
        errors="ignore"
    )
    plan_has_suffixed = any(
        tok in plan_text
        for tok in ("W1.4.2a", "W1.4.2b", "W1.3.9x", "W1.4.3a")
    )
    if plan_has_suffixed and not letter_suffixed:
        failures.append(
            "NEXT_WAVES.md contains letter-suffixed wave ids but parser "
            "returned none — regex regression?"
        )

    if failures:
        print(f"test_dev_panel_waves: {len(failures)} failure(s):")
        for f in failures:
            print(f"  - {f}")
        return 1

    print(
        f"test_dev_panel_waves: all checks passed "
        f"({len(rows)} rows, {len(letter_suffixed)} letter-suffixed, "
        f"1 hot)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
