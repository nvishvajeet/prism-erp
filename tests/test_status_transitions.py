"""Exhaustive regression test for the request status state machine.

Walks every (current, target) pair against `REQUEST_STATUS_TRANSITIONS`
and asserts:

1. Every legal pair declared in the dict succeeds without raising.
2. Every *illegal* pair raises `InvalidStatusTransition`.
3. The terminal statuses (`completed`, `rejected`, `cancelled`) accept
   no outgoing transitions.
4. Same-status writes are idempotent (the validator allows a status
   to "transition" to itself — used for re-scheduling at a different
   time while still in the `scheduled` state).
5. Admin overrides (`force=True`) bypass every check, including
   transitions out of terminal statuses.
6. Unknown current statuses raise `InvalidStatusTransition`.
7. The `awaiting_sample_submission → sample_received` fast-track
   transition (the operator quick-receive path) is honored.

Run directly:

    venv/bin/python tests/test_status_transitions.py

Or as part of the pre-push gate alongside `smoke_test.py`,
`test_visibility_audit.py`, and `test_populate_crawl.py`. Exits 0
on success, 1 on any failure with a one-line summary per failure.

This is the v1.3.0-d hardening item from TODO_AI.txt — persists the
13-case smoke check from the v1.2.0 state machine commit message
into a real test file so the state machine can never regress
silently.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Make the parent dir importable so `import app as catalyst_app` works
# whether the test is run from the repo root or from `tests/`.
HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Crawler-style env defaults so importing app.py is safe in any context.
os.environ.setdefault("LAB_SCHEDULER_DEMO_MODE", "1")
os.environ.setdefault("LAB_SCHEDULER_CSRF", "0")
os.environ.setdefault("OWNER_EMAILS", "admin@lab.local")

import app as catalyst_app  # noqa: E402

REQUEST_STATUS_TRANSITIONS = catalyst_app.REQUEST_STATUS_TRANSITIONS
assert_status_transition = catalyst_app.assert_status_transition
InvalidStatusTransition = catalyst_app.InvalidStatusTransition


# A small set of statuses that should NEVER appear in the dict.
GHOST_STATUSES = ("draft", "pending_approval", "in-progress", "Done", "")

TERMINAL_STATUSES = {"completed", "rejected", "cancelled"}


def all_statuses() -> list[str]:
    """Return every status that appears as a key in the transitions dict."""
    return sorted(REQUEST_STATUS_TRANSITIONS.keys())


def legal_pairs() -> list[tuple[str, str]]:
    """Every (current, target) pair declared as legal in the dict."""
    return [
        (current, target)
        for current, targets in REQUEST_STATUS_TRANSITIONS.items()
        for target in targets
    ]


def illegal_pairs() -> list[tuple[str, str]]:
    """Every (current, target) pair NOT declared in the dict."""
    statuses = all_statuses()
    legal = set(legal_pairs())
    return [
        (current, target)
        for current in statuses
        for target in statuses
        if current != target and (current, target) not in legal
    ]


def run_checks() -> tuple[int, list[str]]:
    """Return (failures, messages). Zero failures means the test passed."""
    failures: list[str] = []

    # 1. Every legal pair must succeed.
    for current, target in legal_pairs():
        try:
            assert_status_transition(current, target)
        except InvalidStatusTransition as exc:
            failures.append(
                f"legal pair rejected: {current!r} -> {target!r} ({exc})"
            )

    # 2. Every illegal pair must raise.
    for current, target in illegal_pairs():
        try:
            assert_status_transition(current, target)
        except InvalidStatusTransition:
            continue
        failures.append(
            f"illegal pair accepted: {current!r} -> {target!r}"
        )

    # 3. Terminal statuses accept no outgoing transitions in the dict.
    for terminal in TERMINAL_STATUSES:
        outgoing = REQUEST_STATUS_TRANSITIONS.get(terminal, set())
        if outgoing:
            failures.append(
                f"terminal status {terminal!r} has outgoing transitions: {outgoing}"
            )

    # 4. Same-status writes are idempotent — every status must accept itself.
    for status in all_statuses():
        try:
            assert_status_transition(status, status)
        except InvalidStatusTransition as exc:
            failures.append(
                f"same-status write rejected: {status!r} -> {status!r} ({exc})"
            )

    # 5. Admin overrides bypass every check, even out of terminal statuses.
    for terminal in TERMINAL_STATUSES:
        try:
            assert_status_transition(terminal, "scheduled", force=True)
        except InvalidStatusTransition as exc:
            failures.append(
                f"force=True rejected from terminal {terminal!r}: {exc}"
            )

    # 6. Unknown current statuses must raise (unless forced).
    for ghost in GHOST_STATUSES:
        try:
            assert_status_transition(ghost, "submitted")
        except InvalidStatusTransition:
            continue
        failures.append(
            f"unknown current status accepted: {ghost!r} -> 'submitted'"
        )

    # 6b. Forced unknown statuses must succeed (admin override path).
    for ghost in GHOST_STATUSES:
        try:
            assert_status_transition(ghost, "submitted", force=True)
        except InvalidStatusTransition as exc:
            failures.append(
                f"force=True rejected for unknown {ghost!r}: {exc}"
            )

    # 7. The quick-receive fast-track must be allowed.
    try:
        assert_status_transition("awaiting_sample_submission", "sample_received")
    except InvalidStatusTransition as exc:
        failures.append(
            f"quick-receive fast-track rejected: {exc}"
        )

    return len(failures), failures


def main() -> int:
    failures, messages = run_checks()
    statuses = all_statuses()
    legal = legal_pairs()
    illegal = illegal_pairs()

    print(
        f"State machine: {len(statuses)} statuses, "
        f"{len(legal)} legal pairs, {len(illegal)} illegal pairs."
    )

    if failures:
        print(f"FAIL — {failures} failure(s):")
        for msg in messages:
            print(f"  - {msg}")
        return 1

    print(
        f"PASS — every legal pair accepted, every illegal pair rejected, "
        f"terminals locked, idempotent writes honored, admin overrides "
        f"bypass, fast-track allowed."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
