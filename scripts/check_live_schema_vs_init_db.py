#!/usr/bin/env python3
"""S4 — Pre-deploy schema drift check.

Runs init_db() against an in-memory SQLite DB (via importing app), then
compares the resulting schema to the live DB. Exits non-zero if the live DB
is missing tables or columns that init_db() expects.

Usage:
    python scripts/check_live_schema_vs_init_db.py --db /path/to/live.db [--soft-warn]

Exit codes:
    0 — no drift (or soft-warn mode)
    1 — drift found (tables/columns missing from live DB)

Designed to run in the post-receive hook on Mini BEFORE gunicorn kickstart,
so a bad deploy that would cause 500s on first request is blocked at push time.
"""
from __future__ import annotations

import argparse
import os
import sqlite3
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def get_schema(conn: sqlite3.Connection) -> dict[str, set[str]]:
    """Return {table_name: {col_name, ...}} for all non-sqlite tables."""
    tables: dict[str, set[str]] = {}
    rows = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).fetchall()
    for (tname,) in rows:
        cols = conn.execute(f"PRAGMA table_info({tname})").fetchall()
        tables[tname] = {row[1] for row in cols}
    return tables


def get_indexes(conn: sqlite3.Connection) -> set[str]:
    rows = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'"
    ).fetchall()
    return {row[0] for row in rows}


def build_expected_schema() -> tuple[dict[str, set[str]], set[str]]:
    """Import app.py, call init_db() against a temp DB, return its schema."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        tmp_path = f.name
    try:
        os.environ["LAB_SCHEDULER_SKIP_INIT_DB"] = "1"
        sys.path.insert(0, str(ROOT))

        # Point the app at the temp DB so init_db writes there
        os.environ.setdefault("CATALYST_DATA_DIR", str(ROOT / "data"))
        # Temporarily override the DB path env so app picks up our temp file
        os.environ["_CHECK_SCHEMA_TMP_DB"] = tmp_path

        import importlib
        import app as erp_app  # noqa: F401
        importlib.invalidate_caches()

        # Patch the DB connection to use our temp path for the init call
        orig_get_db = erp_app.get_db

        def patched_get_db():
            conn = sqlite3.connect(tmp_path, check_same_thread=False)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA foreign_keys = ON")
            return conn

        erp_app.get_db = patched_get_db  # type: ignore[attr-defined]
        erp_app.init_db()

        conn = sqlite3.connect(tmp_path)
        tables = get_schema(conn)
        indexes = get_indexes(conn)
        conn.close()
        erp_app.get_db = orig_get_db  # type: ignore[attr-defined]
        return tables, indexes
    finally:
        os.environ.pop("_CHECK_SCHEMA_TMP_DB", None)
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def check_live(live_path: Path) -> list[str]:
    """Return list of drift messages (missing tables / columns)."""
    try:
        expected_tables, expected_indexes = build_expected_schema()
    except Exception as exc:
        return [f"ERROR: could not build expected schema from app.py: {exc}"]

    live_conn = sqlite3.connect(str(live_path))
    actual_tables = get_schema(live_conn)
    actual_indexes = get_indexes(live_conn)
    live_conn.close()

    issues: list[str] = []

    missing_tables = sorted(set(expected_tables) - set(actual_tables))
    for t in missing_tables:
        issues.append(f"MISSING TABLE: {t}")

    for t, expected_cols in sorted(expected_tables.items()):
        if t not in actual_tables:
            continue
        missing_cols = sorted(expected_cols - actual_tables[t])
        for c in missing_cols:
            issues.append(f"MISSING COLUMN: {t}.{c}")

    missing_indexes = sorted(expected_indexes - actual_indexes)
    for idx in missing_indexes:
        issues.append(f"MISSING INDEX: {idx}")

    return issues


def main() -> int:
    parser = argparse.ArgumentParser(description="Pre-deploy schema drift check")
    parser.add_argument("--db", required=True, help="Path to the live SQLite DB")
    parser.add_argument("--soft-warn", action="store_true",
                        help="Exit 0 even if drift found (log only)")
    args = parser.parse_args()

    live_path = Path(args.db).resolve()
    if not live_path.exists():
        print(f"ERROR: DB not found: {live_path}", file=sys.stderr)
        return 1

    print(f"[S4] Checking schema drift: {live_path.name} vs init_db() …")
    issues = check_live(live_path)

    if not issues:
        print(f"[S4] Schema OK — no drift detected in {live_path.name}")
        return 0

    print(f"[S4] DRIFT DETECTED — {len(issues)} issue(s) in {live_path.name}:")
    for issue in issues[:50]:
        print(f"  {issue}")
    if len(issues) > 50:
        print(f"  … and {len(issues) - 50} more")

    if args.soft_warn:
        print("[S4] soft-warn mode: drift logged, exit 0")
        return 0

    print("[S4] HARD-FAIL: deploy blocked until live DB schema matches init_db()",
          file=sys.stderr)
    print("[S4] Fix: SSH to Mini, run the missing ALTERs manually, then re-push.",
          file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
