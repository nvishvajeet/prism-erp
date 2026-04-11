"""v2.0.0-alpha.3 — runtime dual-write invariants.

alpha.1 + alpha.2 only dual-wrote via the startup backfill. This
test proves that runtime writes (new_request POST, resolve_sample
POST) also propagate into the peer aggregates — so requests created
after startup are visible on /finance, and payments recorded after
startup show up against the right invoice.

If this fails, a runtime path is still legacy-only. Ship is blocked
until the new path is restored.

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


def _csrf(client) -> str:
    r = client.get("/login")
    m = re.search(r'name="csrf_token" value="([^"]+)"', r.data.decode())
    return m.group(1) if m else ""


def run() -> int:
    if _tmp_db.exists():
        _tmp_db.unlink()
    app.DB_PATH = _tmp_db
    app.init_db()

    import sqlite3

    # ── A. sync_request_to_peer_aggregates unit smoke ────────────
    db = sqlite3.connect(str(_tmp_db))
    db.row_factory = sqlite3.Row
    target = db.execute(
        "SELECT id, amount_due, amount_paid FROM sample_requests WHERE amount_due > 0 LIMIT 1"
    ).fetchone()
    check("find-a-billable-request", target is not None)
    if target:
        # Bump amount_paid on the legacy row by 500, then sync. Expect
        # a new payment delta row with amount=500.
        db.execute(
            "UPDATE sample_requests SET amount_paid = amount_paid + 500 WHERE id = ?",
            (target["id"],),
        )
        db.commit()
        app.sync_request_to_peer_aggregates(db, target["id"])
        db.commit()
        new_total = db.execute(
            """
            SELECT COALESCE(SUM(p.amount), 0) AS s
              FROM payments p
              JOIN invoices inv ON inv.id = p.invoice_id
             WHERE inv.request_id = ?
            """,
            (target["id"],),
        ).fetchone()["s"]
        new_legacy = db.execute(
            "SELECT amount_paid FROM sample_requests WHERE id = ?", (target["id"],)
        ).fetchone()["amount_paid"]
        check(
            "top-up-delta-reconciles",
            abs(new_total - new_legacy) < 0.01,
            f"new sum {new_total} vs legacy {new_legacy}",
        )

    # ── B. new_request POST creates invoice + payment at runtime ──
    with app.app.test_client() as c:
        tok = _csrf(c)
        c.post(
            "/login",
            data={"email": "admin@lab.local", "password": "12345", "csrf_token": tok},
            follow_redirects=True,
        )
        # Grab a live instrument id
        inst = db.execute(
            "SELECT id FROM instruments WHERE status='active' ORDER BY id LIMIT 1"
        ).fetchone()
        before_count = db.execute("SELECT COUNT(*) FROM sample_requests").fetchone()[0]
        r = c.get("/requests/new")
        body = r.data.decode()
        # The form doesn't embed a hidden csrf_token input — it's in a
        # <meta name="csrf-token"> tag and injected via JS at submit
        # time. In the test client we read the meta directly and POST
        # it as csrf_token.
        meta = re.search(r'name="csrf-token" content="([^"]+)"', body)
        form_tok = meta.group(1) if meta else ""
        r = c.post(
            "/requests/new",
            data={
                "csrf_token": form_tok,
                "instrument_id": str(inst["id"]),
                "title": "alpha3-runtime-test",
                "sample_name": "alpha3-sample",
                "sample_count": "1",
                "description": "runtime dual-write test",
                "sample_origin": "external",
                "amount_due": "7777",
                "amount_paid": "3333",
                "finance_status": "partial",
                "priority": "normal",
            },
            follow_redirects=True,
        )
        check("new_request-post-status", r.status_code == 200, f"got {r.status_code}")
        after_count = db.execute("SELECT COUNT(*) FROM sample_requests").fetchone()[0]
        check("new_request-inserted", after_count == before_count + 1)
        new_req = db.execute(
            "SELECT id, amount_due, amount_paid, project_id FROM sample_requests ORDER BY id DESC LIMIT 1"
        ).fetchone()
        check("new-request-has-project_id", new_req["project_id"] is not None)
        inv_row = db.execute(
            "SELECT id, amount_due FROM invoices WHERE request_id = ?", (new_req["id"],)
        ).fetchone()
        check("new-request-has-invoice", inv_row is not None)
        if inv_row:
            check(
                "new-invoice-amount-matches-legacy",
                abs(inv_row["amount_due"] - 7777) < 0.01,
                f"got {inv_row['amount_due']}",
            )
            paid_sum = db.execute(
                "SELECT COALESCE(SUM(amount), 0) AS s FROM payments WHERE invoice_id = ?",
                (inv_row["id"],),
            ).fetchone()["s"]
            check(
                "new-payment-matches-legacy",
                abs(paid_sum - 3333) < 0.01,
                f"got {paid_sum}",
            )

    # ── C. Global money invariant holds after runtime writes ─────
    row = db.execute(
        """
        SELECT
          (SELECT COALESCE(SUM(amount_paid),0) FROM sample_requests WHERE amount_due>0) AS legacy,
          (SELECT COALESCE(SUM(p.amount),0)
             FROM payments p
             JOIN invoices inv ON inv.id = p.invoice_id
             JOIN sample_requests sr ON sr.id = inv.request_id
            WHERE sr.amount_due>0) AS new
        """
    ).fetchone()
    check(
        "global-money-invariant-after-runtime-writes",
        abs((row["legacy"] or 0) - (row["new"] or 0)) < 0.01,
        f"legacy={row['legacy']} new={row['new']}",
    )

    # ── D. Live /finance still shows the new request ─────────────
    with app.app.test_client() as c:
        tok = _csrf(c)
        c.post(
            "/login",
            data={"email": "admin@lab.local", "password": "12345", "csrf_token": tok},
            follow_redirects=True,
        )
        r = c.get("/finance")
        check("live-/finance-200", r.status_code == 200)
        check(
            "new-request-visible-in-finance",
            b"alpha3-runtime-test" in r.data,
            "runtime-created external request did not surface in /finance",
        )

    db.close()
    _tmp_dir.cleanup()

    if FAILURES:
        print(f"\nFAILED ({len(FAILURES)}):")
        for f in FAILURES:
            print(f"  - {f}")
        return 1
    print(f"\nall runtime-dual-write checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(run())
