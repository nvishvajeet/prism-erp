"""v2.0.0 — peer-aggregate invariants on the post-drop schema.

Rewritten for v2.0.0: the legacy finance columns on sample_requests
were dropped in the v2.0 migration. Everything that used to compare
legacy-vs-new now just verifies the peer aggregates are internally
consistent.

Run directly:

    .venv/bin/python tests/test_domain_split.py
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
sys.path.insert(0, str(ROOT / "scripts"))
import populate_live_demo  # noqa: E402


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
    # populate_live_demo snapshots app.DB_PATH at import time; repoint it to
    # the throwaway DB or its main() still writes to the default location.
    populate_live_demo.DB_PATH = _tmp_db
    app.init_db()
    # populate peer aggregates (projects/invoices/payments) — smoke_test does
    # the same; init_db alone leaves the v2.0 peer tables empty.
    populate_live_demo.main()

    with app.app.app_context():
        import sqlite3
        db = sqlite3.connect(str(_tmp_db))
        db.row_factory = sqlite3.Row

        # ── 1. Peer tables exist ──────────────────────────────────
        tables = {r[0] for r in db.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()}
        for t in ("projects", "invoices", "payments", "grant_allocations"):
            check(f"table-exists-{t}", t in tables)

        sr_cols = {r[1] for r in db.execute("PRAGMA table_info(sample_requests)").fetchall()}
        check("sample_requests.project_id-present", "project_id" in sr_cols)

        # ── 2. Legacy columns are GONE (v2.0 contract) ────────────
        for col in ("amount_due", "amount_paid", "finance_status",
                    "receipt_number", "grant_id"):
            check(f"legacy-col-dropped-{col}", col not in sr_cols,
                  f"{col} still exists on sample_requests")

        # ── 3. Seeding populated peer aggregates ──────────────────
        projects = db.execute("SELECT COUNT(*) AS c FROM projects").fetchone()["c"]
        invoices = db.execute("SELECT COUNT(*) AS c FROM invoices").fetchone()["c"]
        payments = db.execute("SELECT COUNT(*) AS c FROM payments").fetchone()["c"]
        check("projects-populated", projects > 0, f"got {projects}")
        check("invoices-populated", invoices > 0, f"got {invoices}")
        check("payments-populated", payments > 0, f"got {payments}")

        # ── 4. Every invoice belongs to a real request ────────────
        orphan_invoices = db.execute(
            """
            SELECT COUNT(*) AS c FROM invoices inv
             WHERE NOT EXISTS (SELECT 1 FROM sample_requests WHERE id = inv.request_id)
            """
        ).fetchone()["c"]
        check("no-orphan-invoices", orphan_invoices == 0)

        # ── 5. Every payment belongs to a real invoice ────────────
        orphan_payments = db.execute(
            """
            SELECT COUNT(*) AS c FROM payments p
             WHERE NOT EXISTS (SELECT 1 FROM invoices WHERE id = p.invoice_id)
            """
        ).fetchone()["c"]
        check("no-orphan-payments", orphan_payments == 0)

        # ── 6. Per-invoice: SUM(payments) <= invoice.amount_due ──
        row = db.execute(
            """
            SELECT inv.id, inv.amount_due,
                   COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = inv.id), 0) AS paid
              FROM invoices inv
            """
        ).fetchall()
        overpaid = [r for r in row if float(r["paid"]) > float(r["amount_due"]) + 0.01]
        check("no-overpaid-invoices", len(overpaid) == 0,
              f"{len(overpaid)} invoices with payments > amount_due")

        # ── 7. Every grant_allocations row links to real rows ────
        bad_allocs = db.execute(
            """
            SELECT COUNT(*) AS c FROM grant_allocations ga
             WHERE NOT EXISTS (SELECT 1 FROM grants WHERE id = ga.grant_id)
                OR NOT EXISTS (SELECT 1 FROM projects WHERE id = ga.project_id)
            """
        ).fetchone()["c"]
        check("no-orphan-allocations", bad_allocs == 0)

        # ── 8. sync_request_to_peer_aggregates is idempotent ─────
        target = db.execute(
            """
            SELECT sr.id FROM sample_requests sr
              JOIN invoices inv ON inv.request_id = sr.id
             LIMIT 1
            """
        ).fetchone()
        if target:
            before_inv = db.execute("SELECT COUNT(*) FROM invoices").fetchone()[0]
            before_pay = db.execute("SELECT COUNT(*) FROM payments").fetchone()[0]
            # Re-sync with the same values (read first)
            inv = db.execute(
                "SELECT amount_due FROM invoices WHERE request_id = ?",
                (target["id"],),
            ).fetchone()
            total_paid = db.execute(
                "SELECT COALESCE(SUM(p.amount),0) AS s FROM payments p JOIN invoices i ON i.id=p.invoice_id WHERE i.request_id = ?",
                (target["id"],),
            ).fetchone()["s"]
            app.sync_request_to_peer_aggregates(
                db, target["id"],
                amount_due=inv["amount_due"],
                amount_paid=total_paid,
            )
            db.commit()
            after_inv = db.execute("SELECT COUNT(*) FROM invoices").fetchone()[0]
            after_pay = db.execute("SELECT COUNT(*) FROM payments").fetchone()[0]
            check("idempotent-invoices", before_inv == after_inv,
                  f"{before_inv} → {after_inv}")
            check("idempotent-payments", before_pay == after_pay,
                  f"{before_pay} → {after_pay}")

        # ── 9. Dual-write helpers still round-trip ───────────────
        sr_row = db.execute(
            "SELECT id FROM sample_requests LIMIT 1"
        ).fetchone()
        if sr_row:
            new_inv = app.create_invoice_for_request(
                db, sr_row["id"], 99.99, status="pending", notes="test"
            )
            db.commit()
            inv_check = db.execute("SELECT amount_due FROM invoices WHERE id = ?", (new_inv,)).fetchone()
            check("create_invoice_for_request-works",
                  inv_check is not None and abs(inv_check["amount_due"] - 99.99) < 0.01)
            app.record_payment(db, new_inv, 50.0, receipt_number="TEST-A1")
            app.record_payment(db, new_inv, 49.99, receipt_number="TEST-A2")
            db.commit()
            paid = db.execute(
                "SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE invoice_id = ?",
                (new_inv,),
            ).fetchone()["s"]
            check("record_payment-partial-sums",
                  abs(paid - 99.99) < 0.01, f"expected 99.99, got {paid}")

        # ── 10. computed_finance_for_request returns sane shape ──
        if sr_row:
            f = app.computed_finance_for_request(db, sr_row["id"])
            check("computed_finance-shape", isinstance(f, dict)
                  and {"amount_due", "amount_paid", "finance_status", "receipt_number"}.issubset(f.keys()))

        db.close()

    _tmp_dir.cleanup()

    if FAILURES:
        print(f"\nFAILED ({len(FAILURES)}):")
        for f in FAILURES:
            print(f"  - {f}")
        return 1
    print(f"\nall v2.0 peer-aggregate checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(run())
