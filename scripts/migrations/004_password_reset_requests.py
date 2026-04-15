"""
Migration 004 — add `password_reset_requests` table.

Schema spec'd in `docs/ROLE_SURFACES.md` §3 (admin-mediated forgot
password flow). The /queue route in app.py already reads from this
table with a silent try/except, so the migration is purely additive
— running it makes those rows visible where they were previously
skipped.

Idempotent: `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS`.
Safe to re-run. Safe against any DB state.

Usage
-----
.venv/bin/python scripts/migrations/004_password_reset_requests.py \\
    --db data/demo/stable/lab_scheduler.db
.venv/bin/python scripts/migrations/004_password_reset_requests.py \\
    --db /Users/vishwajeet/Scheduler/Main/data/operational/lab_scheduler.db \\
    --allow-operational
.venv/bin/python scripts/migrations/004_password_reset_requests.py \\
    --db ~/ravikiran-services/data/demo/lab_scheduler.db

Default (no --db) uses `app.DB_PATH` — i.e., the demo or operational
path derived from DEMO_MODE at import time.

The --allow-operational flag matches the guard in
`scripts/onboard_qubit_overlay.py` — operational writes require an
explicit opt-in to prevent fat-finger fleet-wide accidents.
"""

from __future__ import annotations

import argparse
import sqlite3
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))


DDL = """
CREATE TABLE IF NOT EXISTS password_reset_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username_entered TEXT NOT NULL,             -- what the requester typed; need not match a user row
    matched_user_id INTEGER,                    -- nullable — null means no such user (admins see the unmatched row too, but we don't tell the requester)
    status TEXT NOT NULL DEFAULT 'pending',     -- pending → resolved | rejected | expired
    requested_at TEXT NOT NULL,
    resolved_by_user_id INTEGER,
    resolved_at TEXT,
    decision_note TEXT NOT NULL DEFAULT '',
    requester_ip TEXT NOT NULL DEFAULT '',      -- audit only; not rendered to admin by default
    requester_ua TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_pwreset_status ON password_reset_requests(status, requested_at);
CREATE INDEX IF NOT EXISTS idx_pwreset_user   ON password_reset_requests(matched_user_id);
"""


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        prog="migration_004_password_reset",
        description=__doc__.split("\n\n")[0],
    )
    ap.add_argument(
        "--db",
        type=Path,
        default=None,
        help="SQLite path. Defaults to app.DB_PATH (demo or operational "
             "depending on DEMO_MODE at import time).",
    )
    ap.add_argument(
        "--allow-operational",
        action="store_true",
        help="Required to write to a DB whose path contains '/operational/'. "
             "Default behaviour refuses operational writes.",
    )
    args = ap.parse_args(argv)

    db_path = args.db
    if db_path is None:
        import app as _app  # noqa: E402
        db_path = _app.DB_PATH

    if not db_path.exists():
        print(f"refusing: {db_path} does not exist", file=sys.stderr)
        return 2

    if "/operational/" in str(db_path) and not args.allow_operational:
        print(
            f"refusing: {db_path} is an operational DB. "
            "Pass --allow-operational to override.",
            file=sys.stderr,
        )
        return 2

    con = sqlite3.connect(db_path, timeout=30)
    con.executescript(DDL)
    con.commit()

    # Verify
    cur = con.cursor()
    row = cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='password_reset_requests'"
    ).fetchone()
    if not row:
        print(f"refusing: migration did not produce password_reset_requests in {db_path}", file=sys.stderr)
        return 1
    n_rows = cur.execute("SELECT COUNT(*) FROM password_reset_requests").fetchone()[0]
    n_indexes = cur.execute(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND tbl_name='password_reset_requests'"
    ).fetchone()[0]
    print(f"migration 004 applied to {db_path}")
    print(f"  password_reset_requests rows   : {n_rows}")
    print(f"  password_reset_requests indexes: {n_indexes}")
    con.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
