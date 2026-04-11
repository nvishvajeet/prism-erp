"""v2.0.0 — runtime write paths land in peer aggregates.

Rewritten for v2.0.0: legacy finance columns dropped. The runtime
write test verifies a request created via the /requests/new form
produces the expected invoice + payment rows and surfaces in
/finance.

Run directly:

    .venv/bin/python tests/test_runtime_dual_write.py
"""
from __future__ import annotations

import os
import re
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


def run() -> int:
    if _tmp_db.exists():
        _tmp_db.unlink()
    app.DB_PATH = _tmp_db
    app.init_db()

    import sqlite3
    db = sqlite3.connect(str(_tmp_db))
    db.row_factory = sqlite3.Row

    # ── A. sync top-up delta ─────────────────────────────────────
    target = db.execute(
        """
        SELECT sr.id, inv.id AS inv_id, inv.amount_due
          FROM sample_requests sr
          JOIN invoices inv ON inv.request_id = sr.id
         LIMIT 1
        """
    ).fetchone()
    check("find-a-billable-request", target is not None)
    if target:
        before_paid = db.execute(
            "SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE invoice_id = ?",
            (target["inv_id"],),
        ).fetchone()["s"]
        app.sync_request_to_peer_aggregates(
            db, target["id"],
            amount_due=target["amount_due"],
            amount_paid=before_paid + 500,
        )
        db.commit()
        new_total = db.execute(
            "SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE invoice_id = ?",
            (target["inv_id"],),
        ).fetchone()["s"]
        check(
            "top-up-delta-reconciles",
            abs(new_total - (before_paid + 500)) < 0.01,
            f"{before_paid} + 500 -> {new_total}",
        )

    # ── B. new_request POST creates invoice + payment ──────────────
    with app.app.test_client() as c:
        r = c.get("/login")
        tok = re.search(r'name="csrf_token" value="([^"]+)"', r.data.decode()).group(1)
        c.post(
            "/login",
            data={"email": "admin@lab.local", "password": "12345", "csrf_token": tok},
            follow_redirects=True,
        )
        inst = db.execute(
            "SELECT id FROM instruments WHERE status='active' ORDER BY id LIMIT 1"
        ).fetchone()
        r = c.get("/requests/new")
        body = r.data.decode()
        meta = re.search(r'name="csrf-token" content="([^"]+)"', body)
        form_tok = meta.group(1) if meta else ""
        r = c.post(
            "/requests/new",
            data={
                "csrf_token": form_tok,
                "instrument_id": str(inst["id"]),
                "title": "v20-runtime-test",
                "sample_name": "v20-sample",
                "sample_count": "1",
                "description": "runtime write test v2.0",
                "sample_origin": "external",
                "amount_due": "7777",
                "amount_paid": "3333",
                "finance_status": "partial",
                "priority": "normal",
            },
            follow_redirects=True,
        )
        check("new_request-post-200", r.status_code == 200, f"got {r.status_code}")
        new_req = db.execute(
            "SELECT id, project_id FROM sample_requests ORDER BY id DESC LIMIT 1"
        ).fetchone()
        check("new-request-has-project_id", new_req["project_id"] is not None)
        inv_row = db.execute(
            "SELECT id, amount_due FROM invoices WHERE request_id = ?", (new_req["id"],)
        ).fetchone()
        check("new-request-has-invoice", inv_row is not None)
        if inv_row:
            check(
                "new-invoice-amount",
                abs(inv_row["amount_due"] - 7777) < 0.01,
                f"got {inv_row['amount_due']}",
            )
            paid_sum = db.execute(
                "SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE invoice_id = ?",
                (inv_row["id"],),
            ).fetchone()["s"]
            check(
                "new-payment-amount",
                abs(paid_sum - 3333) < 0.01,
                f"got {paid_sum}",
            )

    # ── C. Live /finance shows the new request ──────────────────
    with app.app.test_client() as c:
        r = c.get("/login")
        tok = re.search(r'name="csrf_token" value="([^"]+)"', r.data.decode()).group(1)
        c.post(
            "/login",
            data={"email": "admin@lab.local", "password": "12345", "csrf_token": tok},
            follow_redirects=True,
        )
        r = c.get("/finance")
        check("live-/finance-200", r.status_code == 200)
        check(
            "new-request-visible-in-finance",
            b"v20-runtime-test" in r.data,
            "runtime-created request did not surface in /finance",
        )

    # ── D. Legacy columns are GONE ──────────────────────────────
    sr_cols = {r[1] for r in db.execute("PRAGMA table_info(sample_requests)").fetchall()}
    for col in ("amount_due", "amount_paid", "finance_status",
                "receipt_number", "grant_id"):
        check(f"legacy-col-dropped-{col}", col not in sr_cols)

    db.close()
    _tmp_dir.cleanup()

    if FAILURES:
        print(f"\nFAILED ({len(FAILURES)}):")
        for f in FAILURES:
            print(f"  - {f}")
        return 1
    print(f"\nall v2.0 runtime checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(run())
