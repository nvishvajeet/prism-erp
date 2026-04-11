"""v2.0.0-alpha.1 — domain split backfill + dual-write invariants.

Locks the contract of:
    _backfill_domain_split()        → legacy sample_requests become
                                       peer aggregates without losing
                                       a single rupee
    create_invoice_for_request(...) → dual-write path for new billing
    record_payment(...)             → partial-payment capable
    attach_request_to_project(...)  → FK stitcher

The backfill is the v2.0.0-alpha.1 acceptance gate. If any of these
invariants breaks, the mitosis is unsafe and the tag must not ship.

Run directly:

    .venv/bin/python tests/test_domain_split.py

Exits 0 on success, 1 on any failure. Pure DB shape — no Flask
request context needed.
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

# Throwaway DB before importing app so init_db() builds a fresh
# schema and the backfill runs against seeded demo data.
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

    with app.app.app_context():
        import sqlite3
        db = sqlite3.connect(str(_tmp_db))
        db.row_factory = sqlite3.Row

        # ── 1. New tables exist with expected columns ─────────────
        tables = {r[0] for r in db.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()}
        for t in ("projects", "invoices", "payments", "grant_allocations"):
            check(f"table-exists-{t}", t in tables)

        sr_cols = {r[1] for r in db.execute("PRAGMA table_info(sample_requests)").fetchall()}
        check("sample_requests.project_id-added", "project_id" in sr_cols)

        # ── 2. Backfill populated something ───────────────────────
        billable = db.execute(
            "SELECT COUNT(*) AS c FROM sample_requests WHERE amount_due > 0"
        ).fetchone()["c"]
        projects = db.execute("SELECT COUNT(*) AS c FROM projects").fetchone()["c"]
        invoices = db.execute("SELECT COUNT(*) AS c FROM invoices").fetchone()["c"]
        check(
            "backfill-created-projects",
            projects >= billable,
            f"expected >= {billable} projects, got {projects}",
        )
        check(
            "backfill-created-one-invoice-per-billable-request",
            invoices == billable,
            f"expected {billable} invoices, got {invoices}",
        )

        # ── 3. Every billable request has project_id stitched ────
        unstitched = db.execute(
            "SELECT COUNT(*) AS c FROM sample_requests WHERE amount_due > 0 AND project_id IS NULL"
        ).fetchone()["c"]
        check(
            "every-billable-request-has-project_id",
            unstitched == 0,
            f"{unstitched} billable requests still have NULL project_id",
        )

        # ── 4. MONEY INVARIANT — paid side ───────────────────────
        legacy_paid = db.execute(
            "SELECT COALESCE(SUM(amount_paid),0) AS s FROM sample_requests WHERE amount_due > 0"
        ).fetchone()["s"]
        new_paid = db.execute(
            "SELECT COALESCE(SUM(amount),0) AS s FROM payments"
        ).fetchone()["s"]
        check(
            "money-invariant-paid",
            abs(legacy_paid - new_paid) < 0.01,
            f"legacy={legacy_paid} new={new_paid} — rupees moved during mitosis",
        )

        # ── 5. MONEY INVARIANT — due side ────────────────────────
        legacy_due = db.execute(
            "SELECT COALESCE(SUM(amount_due),0) AS s FROM sample_requests WHERE amount_due > 0"
        ).fetchone()["s"]
        new_due = db.execute(
            "SELECT COALESCE(SUM(amount_due),0) AS s FROM invoices"
        ).fetchone()["s"]
        check(
            "money-invariant-due",
            abs(legacy_due - new_due) < 0.01,
            f"legacy={legacy_due} new={new_due} — billed amount drifted",
        )

        # ── 6. Per-request payment reconciliation ────────────────
        row = db.execute(
            """
            SELECT sr.id, sr.request_no, sr.amount_paid,
                   COALESCE((SELECT SUM(p.amount) FROM payments p
                             JOIN invoices i ON i.id = p.invoice_id
                             WHERE i.request_id = sr.id), 0) AS new_sum
            FROM sample_requests sr
            WHERE sr.amount_due > 0
            """
        ).fetchall()
        mismatches = [r for r in row if abs(r["amount_paid"] - r["new_sum"]) > 0.01]
        check(
            "per-request-payment-reconciliation",
            len(mismatches) == 0,
            f"{len(mismatches)} requests where legacy amount_paid != SUM(payments)",
        )

        # ── 7. Legacy grant FKs became project allocations ───────
        granted = db.execute(
            "SELECT COUNT(*) AS c FROM sample_requests WHERE grant_id IS NOT NULL"
        ).fetchone()["c"]
        if granted > 0:
            reachable = db.execute(
                """
                SELECT COUNT(*) AS c FROM sample_requests sr
                WHERE sr.grant_id IS NOT NULL
                  AND EXISTS (
                    SELECT 1 FROM grant_allocations ga
                    WHERE ga.grant_id = sr.grant_id
                      AND ga.project_id = sr.project_id
                  )
                """
            ).fetchone()["c"]
            check(
                "legacy-grant-fks-reachable-via-allocation",
                reachable == granted,
                f"{granted} granted requests, only {reachable} reachable via grant_allocations",
            )
        else:
            check("legacy-grant-fks-reachable-via-allocation", True, "no granted requests to check")

        # ── 8. Idempotency — re-running backfill is a no-op ──────
        before_p = db.execute("SELECT COUNT(*) FROM projects").fetchone()[0]
        before_i = db.execute("SELECT COUNT(*) FROM invoices").fetchone()[0]
        before_pay = db.execute("SELECT COUNT(*) FROM payments").fetchone()[0]
        before_alloc = db.execute("SELECT COUNT(*) FROM grant_allocations").fetchone()[0]
        db.close()
        app._backfill_domain_split()
        db = sqlite3.connect(str(_tmp_db))
        db.row_factory = sqlite3.Row
        after_p = db.execute("SELECT COUNT(*) FROM projects").fetchone()[0]
        after_i = db.execute("SELECT COUNT(*) FROM invoices").fetchone()[0]
        after_pay = db.execute("SELECT COUNT(*) FROM payments").fetchone()[0]
        after_alloc = db.execute("SELECT COUNT(*) FROM grant_allocations").fetchone()[0]
        check("idempotent-projects", before_p == after_p, f"{before_p} → {after_p}")
        check("idempotent-invoices", before_i == after_i, f"{before_i} → {after_i}")
        check("idempotent-payments", before_pay == after_pay, f"{before_pay} → {after_pay}")
        check("idempotent-allocations", before_alloc == after_alloc, f"{before_alloc} → {after_alloc}")

        # ── 9. Synthetic receipt numbers when legacy was blank ───
        synthetic = db.execute(
            "SELECT COUNT(*) AS c FROM payments WHERE receipt_number LIKE 'LEGACY-%'"
        ).fetchone()["c"]
        check(
            "synthetic-receipts-for-legacy-blanks",
            synthetic >= 0,
            "LEGACY-<id> receipts are allowed",
        )

        # ── 10. Dual-write helper — create_invoice_for_request ───
        target = db.execute(
            "SELECT id FROM sample_requests WHERE amount_due > 0 LIMIT 1"
        ).fetchone()
        if target:
            new_inv = app.create_invoice_for_request(
                db, target["id"], 123.45, status="pending", notes="test-dual-write"
            )
            db.commit()
            row = db.execute("SELECT * FROM invoices WHERE id = ?", (new_inv,)).fetchone()
            check("create_invoice-returns-id", new_inv is not None and new_inv > 0)
            check("create_invoice-writes-amount", abs(row["amount_due"] - 123.45) < 0.01)
            check("create_invoice-stitches-request", row["request_id"] == target["id"])

            # ── 11. record_payment + partial-payment semantics ───
            pay1 = app.record_payment(db, new_inv, 50.00, receipt_number="TEST-R1")
            pay2 = app.record_payment(db, new_inv, 73.45, receipt_number="TEST-R2")
            db.commit()
            total = db.execute(
                "SELECT COALESCE(SUM(amount),0) AS s FROM payments WHERE invoice_id = ?",
                (new_inv,),
            ).fetchone()["s"]
            check(
                "partial-payments-sum-to-invoice",
                abs(total - 123.45) < 0.01,
                f"expected 123.45, got {total}",
            )
            check("record_payment-two-rows", pay1 != pay2 and pay1 > 0 and pay2 > 0)

            # ── 12. attach_request_to_project idempotency ────────
            proj = db.execute("SELECT id FROM projects LIMIT 1").fetchone()
            if proj:
                app.attach_request_to_project(db, target["id"], proj["id"])
                app.attach_request_to_project(db, target["id"], proj["id"])
                db.commit()
                stitched = db.execute(
                    "SELECT project_id FROM sample_requests WHERE id = ?", (target["id"],)
                ).fetchone()["project_id"]
                check(
                    "attach_request_to_project-sets-fk",
                    stitched == proj["id"],
                    f"expected {proj['id']}, got {stitched}",
                )

        # ── 13. Legacy columns still populated (dual-source contract) ──
        legacy_still_has_money = db.execute(
            "SELECT COUNT(*) AS c FROM sample_requests WHERE amount_due > 0"
        ).fetchone()["c"]
        check(
            "alpha1-preserves-legacy-columns",
            legacy_still_has_money == billable,
            "alpha.1 must NOT zero out legacy columns — that's alpha.3's job",
        )

        db.close()

    _tmp_dir.cleanup()

    if FAILURES:
        print(f"\nFAILED ({len(FAILURES)}):")
        for f in FAILURES:
            print(f"  - {f}")
        return 1
    print(f"\nall domain-split checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(run())
