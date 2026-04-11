"""v2.0.0-alpha.2 — finance-portal read-path parity.

alpha.1 added peer aggregates. alpha.2 flipped /finance, /finance/grants,
and /finance/grants/<id> to read from them. This test locks that the
new read path produces numerically identical results to the legacy
columns, per request and in aggregate.

If this fails, the mitosis read path is lying — either the backfill
didn't fully populate, or the new SQL has a semantic gap. Either way
the alpha.2 tag must not ship until this is green.

Run directly:

    .venv/bin/python tests/test_finance_parity.py
"""
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

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


def _approx(a: float, b: float, tol: float = 0.01) -> bool:
    return abs((a or 0) - (b or 0)) < tol


def run() -> int:
    if _tmp_db.exists():
        _tmp_db.unlink()
    app.DB_PATH = _tmp_db
    app.init_db()

    import sqlite3
    db = sqlite3.connect(str(_tmp_db))
    db.row_factory = sqlite3.Row

    # ── A. /finance KPI parity ──────────────────────────────────
    legacy = db.execute(
        """
        SELECT
          COALESCE(SUM(CASE WHEN sample_origin='external' THEN amount_due  ELSE 0 END), 0) AS owed,
          COALESCE(SUM(CASE WHEN sample_origin='external' THEN amount_paid ELSE 0 END), 0) AS paid
          FROM sample_requests
        """
    ).fetchone()
    new = db.execute(
        """
        SELECT
          COALESCE(SUM(inv.amount_due), 0) AS owed,
          COALESCE(SUM(COALESCE(p.paid, 0)), 0) AS paid
          FROM invoices inv
          JOIN sample_requests sr ON sr.id = inv.request_id
          LEFT JOIN (SELECT invoice_id, SUM(amount) AS paid FROM payments GROUP BY invoice_id) p
            ON p.invoice_id = inv.id
         WHERE sr.sample_origin = 'external'
        """
    ).fetchone()
    check("kpi-owed-parity", _approx(legacy["owed"], new["owed"]),
          f"legacy={legacy['owed']} new={new['owed']}")
    check("kpi-paid-parity", _approx(legacy["paid"], new["paid"]),
          f"legacy={legacy['paid']} new={new['paid']}")

    # ── B. Per-instrument parity ────────────────────────────────
    legacy_inst = db.execute(
        """
        SELECT i.id,
               COALESCE(SUM(CASE WHEN sr.sample_origin='external' THEN sr.amount_due  ELSE 0 END), 0) AS owed,
               COALESCE(SUM(CASE WHEN sr.sample_origin='external' THEN sr.amount_paid ELSE 0 END), 0) AS paid
          FROM instruments i
          LEFT JOIN sample_requests sr ON sr.instrument_id = i.id
         GROUP BY i.id
        """
    ).fetchall()
    mismatch = 0
    for row in legacy_inst:
        inst_id = row["id"]
        new_row = db.execute(
            """
            SELECT
              COALESCE((SELECT SUM(inv.amount_due)
                          FROM invoices inv
                          JOIN sample_requests sr ON sr.id = inv.request_id
                         WHERE sr.instrument_id = ? AND sr.sample_origin = 'external'), 0) AS owed,
              COALESCE((SELECT SUM(p.amount)
                          FROM payments p
                          JOIN invoices inv ON inv.id = p.invoice_id
                          JOIN sample_requests sr ON sr.id = inv.request_id
                         WHERE sr.instrument_id = ? AND sr.sample_origin = 'external'), 0) AS paid
            """,
            (inst_id, inst_id),
        ).fetchone()
        if not _approx(row["owed"], new_row["owed"]) or not _approx(row["paid"], new_row["paid"]):
            mismatch += 1
    check("by-instrument-parity", mismatch == 0,
          f"{mismatch} instruments disagree between legacy and new")

    # ── C. Per-grant parity ─────────────────────────────────────
    grants = db.execute("SELECT id FROM grants").fetchall()
    grant_mismatch = 0
    for g in grants:
        gid = g["id"]
        legacy_g = db.execute(
            """
            SELECT
              COALESCE(SUM(sr.amount_paid), 0) AS paid,
              COALESCE(SUM(sr.amount_due),  0) AS due,
              COUNT(*) AS n
              FROM sample_requests sr
             WHERE sr.grant_id = ?
            """,
            (gid,),
        ).fetchone()
        new_g = db.execute(
            """
            SELECT
              COALESCE((SELECT SUM(p.amount)
                          FROM payments p
                          JOIN invoices inv ON inv.id = p.invoice_id
                          JOIN sample_requests sr ON sr.id = inv.request_id
                          JOIN grant_allocations ga ON ga.project_id = sr.project_id
                         WHERE ga.grant_id = ?), 0) AS paid,
              COALESCE((SELECT SUM(inv.amount_due)
                          FROM invoices inv
                          JOIN sample_requests sr ON sr.id = inv.request_id
                          JOIN grant_allocations ga ON ga.project_id = sr.project_id
                         WHERE ga.grant_id = ?), 0) AS due,
              COALESCE((SELECT COUNT(DISTINCT sr.id)
                          FROM sample_requests sr
                          JOIN grant_allocations ga ON ga.project_id = sr.project_id
                         WHERE ga.grant_id = ?), 0) AS n
            """,
            (gid, gid, gid),
        ).fetchone()
        if (not _approx(legacy_g["paid"], new_g["paid"])
                or not _approx(legacy_g["due"], new_g["due"])
                or legacy_g["n"] != new_g["n"]):
            grant_mismatch += 1
    check("per-grant-parity", grant_mismatch == 0,
          f"{grant_mismatch} grants disagree on spend")

    # ── D. Live route status codes ──────────────────────────────
    with app.app.test_client() as c:
        import re
        r = c.get("/login")
        tok_m = re.search(r'name="csrf_token" value="([^"]+)"', r.data.decode())
        if tok_m:
            c.post(
                "/login",
                data={"email": "admin@lab.local", "password": "12345", "csrf_token": tok_m.group(1)},
                follow_redirects=True,
            )
            for path in ("/finance", "/finance/grants"):
                r = c.get(path)
                check(f"live-{path}", r.status_code == 200, f"status={r.status_code}")
            # one grant detail drill
            first = db.execute("SELECT id FROM grants LIMIT 1").fetchone()
            if first:
                r = c.get(f"/finance/grants/{first['id']}")
                check("live-/finance/grants/<id>", r.status_code == 200,
                      f"status={r.status_code}")

    db.close()
    _tmp_dir.cleanup()

    if FAILURES:
        print(f"\nFAILED ({len(FAILURES)}):")
        for f in FAILURES:
            print(f"  - {f}")
        return 1
    print(f"\nall finance-parity checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(run())
