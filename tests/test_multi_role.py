"""Regression test for the v1.5.0 multi-role helpers.

Locks the contract of:
    user_role_set(user)       → frozenset of every role
    user_has_role(user, role) → membership shortcut
    grant_user_role(uid, r)   → idempotent insert into user_roles
    revoke_user_role(uid, r)  → remove a role from user_roles

The schema + backfill landed silently in init_db earlier in the
session (app.py:3539 table, :3682 backfill). This test file is
the v1.5.0 acceptance gate: if these assertions break, a new
role resolution bug has landed.

Run directly:

    .venv/bin/python tests/test_multi_role.py

Exits 0 on success, 1 on any failure. Pure DB + helper shape, no
Flask request context — so it also runs fine as part of a future
`tests` crawler wave.
"""
from __future__ import annotations

import os
import sqlite3
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Point at a throwaway DB before importing app.py so init_db()
# builds the schema from scratch without touching the real demo DB.
_tmp_dir = tempfile.TemporaryDirectory()
_tmp_db_dir = Path(_tmp_dir.name) / "data" / "demo"
_tmp_db_dir.mkdir(parents=True, exist_ok=True)
_tmp_db = _tmp_db_dir / "lab_scheduler.db"
os.environ["LAB_SCHEDULER_DEMO_MODE"] = "1"
os.environ["LAB_SCHEDULER_DATA_DIR"] = str(Path(_tmp_dir.name))

import app  # noqa: E402


FAILURES: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    if not ok:
        FAILURES.append(f"{name}: {detail or 'assertion failed'}")
        print(f"  FAIL  {name} — {detail}")
    else:
        print(f"  ok    {name}")


def run() -> int:
    # Fresh DB + seed the canonical demo users so user_roles
    # backfill has something to work with.
    if _tmp_db.exists():
        _tmp_db.unlink()
    app.DB_PATH = _tmp_db  # redirect the module-level path
    app.init_db()

    with app.app.app_context():
        # --- 1. backfill should have created at least one row per user ---
        user_count = app.query_one("SELECT COUNT(*) AS c FROM users")["c"]
        role_rows = app.query_one("SELECT COUNT(*) AS c FROM user_roles")["c"]
        check(
            "backfill-populates-user_roles",
            role_rows >= user_count,
            f"expected >= {user_count} rows in user_roles, got {role_rows}",
        )

        # --- 2. user_role_set for a known super_admin ---
        admin = app.query_one(
            "SELECT id, role FROM users WHERE email = 'admin@lab.local'"
        )
        check("admin-user-exists", admin is not None)
        admin_roles = app.user_role_set(admin)
        check(
            "admin-role-set-contains-super_admin",
            "super_admin" in admin_roles,
            f"got {admin_roles}",
        )

        # --- 3. user_has_role shortcut ---
        check(
            "user_has_role-true-path",
            app.user_has_role(admin, "super_admin"),
        )
        check(
            "user_has_role-false-path",
            not app.user_has_role(admin, "operator"),
        )

        # --- 4. grant_user_role adds a row, idempotently ---
        before = app.query_one(
            "SELECT COUNT(*) AS c FROM user_roles WHERE user_id = ?",
            (admin["id"],),
        )["c"]
        app.grant_user_role(admin["id"], "finance_admin", granted_by=None)
        after1 = app.query_one(
            "SELECT COUNT(*) AS c FROM user_roles WHERE user_id = ?",
            (admin["id"],),
        )["c"]
        check("grant-adds-row", after1 == before + 1, f"{before}→{after1}")

        app.grant_user_role(admin["id"], "finance_admin", granted_by=None)
        after2 = app.query_one(
            "SELECT COUNT(*) AS c FROM user_roles WHERE user_id = ?",
            (admin["id"],),
        )["c"]
        check(
            "grant-is-idempotent",
            after2 == after1,
            f"second grant changed count {after1}→{after2}",
        )

        # --- 5. user_role_set now includes the granted role ---
        admin_after_grant = app.query_one(
            "SELECT id, role FROM users WHERE email = 'admin@lab.local'"
        )
        roles_after = app.user_role_set(admin_after_grant)
        check("multi-role-visible", "finance_admin" in roles_after)
        check("primary-role-still-present", "super_admin" in roles_after)

        # --- 6. revoke_user_role removes the granted role ---
        app.revoke_user_role(admin["id"], "finance_admin")
        roles_revoked = app.user_role_set(admin_after_grant)
        check("revoke-drops-role", "finance_admin" not in roles_revoked)
        check(
            "revoke-preserves-primary",
            "super_admin" in roles_revoked,
            "revoke must not touch users.role",
        )

        # --- 7. empty / None user inputs are safe ---
        check("none-user-empty-set", app.user_role_set(None) == frozenset())
        check("none-user-has-no-role", not app.user_has_role(None, "super_admin"))

    _tmp_dir.cleanup()

    if FAILURES:
        print(f"\nFAILED ({len(FAILURES)}):")
        for f in FAILURES:
            print(f"  - {f}")
        return 1
    print(f"\nall multi-role checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(run())
