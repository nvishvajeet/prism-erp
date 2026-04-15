#!/usr/bin/env python3
"""Per-variant demo seeder for the CATALYST three-ERP-variant demo.

This script seeds a minimal, idempotent demo dataset tailored to ONE of
three ERP variants defined in docs/ERP_DEMO_VARIANTS.md:

  - lab             — shared instrumentation lab (FULLY implemented)
  - ravikiran_ops   — service/operations ERP (STUB — TODO)
  - compute         — HPC / compute ERP        (STUB — TODO)

Usage (lab variant, writing into a dedicated data dir):

    mkdir -p data/demo_triad/lab
    CATALYST_DATA_DIR=$PWD/data/demo_triad/lab \\
    CATALYST_MODULES=instruments,finance,inbox,notifications,attendance,queue,calendar,stats,admin \\
    LAB_SCHEDULER_DEMO_MODE=1 \\
    .venv/bin/python scripts/seed_demo_triad.py --variant lab

Contract:
  * Honours CATALYST_DATA_DIR (or --data-dir) — seeds into whatever DB
    app.py boots with.
  * Honours CATALYST_MODULES — only touches tables whose module is in
    the enabled set. If the env var is empty, all modules are treated
    as enabled.
  * Idempotent — safe to run twice. Pattern used here is "wipe the
    narrow set of rows we own, then re-seed", so reruns converge on
    the same state.
  * Reuses the seeding pattern established by scripts/populate_crf.py
    and scripts/populate_live_demo.py (werkzeug password hash, direct
    sqlite3 cursor, commit at natural boundaries).
"""

from __future__ import annotations

import argparse
import os
import sqlite3
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Allow `import app` from scripts/ — mirrors populate_live_demo.py.
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))


# ── CLI ──────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Seed one CATALYST ERP demo variant.")
    p.add_argument(
        "--variant",
        required=True,
        choices=["lab", "ravikiran_ops", "compute"],
        help="Which ERP demo variant to seed.",
    )
    p.add_argument(
        "--data-dir",
        default=None,
        help="Override CATALYST_DATA_DIR for this run (directory, not db path).",
    )
    return p.parse_args()


# ── Module gate ──────────────────────────────────────────────────────

def enabled_modules() -> set[str]:
    """Parse CATALYST_MODULES into a set. Empty → 'all modules enabled'."""
    raw = os.environ.get("CATALYST_MODULES", "").strip()
    if not raw:
        return set()  # caller treats empty set as "unrestricted"
    return {m.strip() for m in raw.split(",") if m.strip()}


def module_enabled(name: str, active: set[str]) -> bool:
    return not active or name in active


# ── Lab variant data (minimal, demo-oriented) ────────────────────────

DEFAULT_PW = "catalyst2026"

# (name, email, role) — spans every role the lab "first-click journey"
# in docs/ERP_DEMO_VARIANTS.md needs: requester → approver/admin →
# operator → finance → owner.
LAB_USERS = [
    ("Demo Owner",      "owner.demo@catalyst.test",      "owner"),
    ("Demo Admin",      "admin.demo@catalyst.test",      "site_admin"),
    ("Prof. Approver",  "approver.demo@catalyst.test",   "professor_approver"),
    ("Finance Admin",   "finance.demo@catalyst.test",    "finance_admin"),
    ("Op. Anika",       "operator.demo@catalyst.test",   "operator"),
    ("PhD Requester",   "requester.demo@catalyst.test",  "member"),
]

# (code, name, category, location, manufacturer, model, capacity, desc)
LAB_INSTRUMENTS = [
    ("DEMO-FESEM", "Field Emission SEM",   "Microscopy",        "CRF R-102", "TESCAN",  "S8152",        6,
     "High-res nanoscale imaging — demo instrument."),
    ("DEMO-XRD",   "X-Ray Diffractometer", "Crystallography",   "CRF R-103", "PANALYTICAL", "Empyrean", 8,
     "Phase ID and crystal structure — demo instrument."),
    ("DEMO-RAMAN", "Raman Spectrometer",   "Spectroscopy",      "CRF R-104", "JASCO",   "NRS-4500",     6,
     "Confocal micro-Raman — demo instrument."),
    ("DEMO-UV",    "UV-Vis Spectrometer",  "Spectroscopy",      "CRF R-110", "LABINDIA","UV 3200",      8,
     "Absorbance + DRS — demo instrument."),
]

# (requester_email, instrument_code, title, sample_name, count, status, desc)
# Statuses are spread so the queue, inbox, and stats surfaces all show
# something non-empty on first-click.
LAB_REQUESTS = [
    ("requester.demo@catalyst.test", "DEMO-FESEM",
     "ZnO nanorod imaging", "ZnO-NR-1", 2, "submitted",
     "Top and cross-section SEM of hydrothermal ZnO nanorods."),
    ("requester.demo@catalyst.test", "DEMO-XRD",
     "BaTiO3 thin film phase check", "BTO-TF-2", 1, "under_review",
     "2θ scan 20°–80° for phase purity of PLD-deposited BaTiO3."),
    ("requester.demo@catalyst.test", "DEMO-RAMAN",
     "Graphene D/G peak check", "GR-CVD-3", 1, "scheduled",
     "532 nm Raman to confirm monolayer graphene on Cu."),
    ("requester.demo@catalyst.test", "DEMO-UV",
     "TiO2 band gap (Tauc)", "TIO2-P25-4", 2, "completed",
     "Reflectance for Tauc plot band gap determination."),
    ("requester.demo@catalyst.test", "DEMO-FESEM",
     "Au nanoparticle size", "AU-NP-5", 3, "completed",
     "Particle size distribution of citrate Au NPs (complete)."),
    ("requester.demo@catalyst.test", "DEMO-XRD",
     "Accidentally-duplicate request", "BTO-TF-2-dup", 1, "rejected",
     "Duplicate of BTO-TF-2 — rejected by approver."),
]


# ── Audit log helper (SHA-256 chain — same format as app.py) ─────────

def _audit_append(
    c: sqlite3.Cursor,
    entity_type: str,
    entity_id: int,
    action: str,
    actor_id: int | None,
    payload: dict,
    when: str,
) -> None:
    """Append one entry to audit_logs, chaining SHA-256 off the prior row."""
    import hashlib, json
    row = c.execute(
        "SELECT entry_hash FROM audit_logs "
        "WHERE entity_type=? AND entity_id=? ORDER BY id DESC LIMIT 1",
        (entity_type, entity_id),
    ).fetchone()
    prev_hash = row[0] if row else ""
    payload_json = json.dumps(payload, sort_keys=True)
    entry_hash = hashlib.sha256(
        f"{prev_hash}|{entity_type}|{entity_id}|{action}|{payload_json}".encode()
    ).hexdigest()
    c.execute(
        "INSERT INTO audit_logs "
        "(entity_type, entity_id, action, actor_id, payload_json, prev_hash, entry_hash, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (entity_type, entity_id, action, actor_id, payload_json, prev_hash, entry_hash, when),
    )


# ── Lab variant implementation ───────────────────────────────────────

def seed_lab(modules: set[str]) -> dict:
    """Seed the lab variant. Returns a summary dict for the final banner."""
    from werkzeug.security import generate_password_hash
    import app  # imported here so CATALYST_DATA_DIR is already set

    app.init_db()  # safe to call on an existing DB
    db_path = str(app.DB_PATH)
    db = sqlite3.connect(db_path)
    db.row_factory = sqlite3.Row
    c = db.cursor()

    # Wipe the narrow set of rows this seeder owns. Leaves schema and
    # any operator-created data alone (there isn't any on a fresh DB).
    # NB: order matters because of FK cascades.
    wipe_tables = [
        "approval_steps", "sample_requests", "audit_logs",
        "instrument_operators", "instrument_admins",
        "instrument_faculty_admins", "instrument_approval_config",
        "instruments", "users",
    ]
    for t in wipe_tables:
        try:
            c.execute(f"DELETE FROM {t}")
        except sqlite3.OperationalError:
            # Table may not exist on a minimal variant — that's fine.
            pass
    try:
        c.execute("DELETE FROM sqlite_sequence")
    except sqlite3.OperationalError:
        pass
    db.commit()

    pw_hash = generate_password_hash(DEFAULT_PW, method="pbkdf2:sha256")

    # Users — always seeded; the 'admin' module covers user management.
    user_ids: dict[str, int] = {}
    for name, email, role in LAB_USERS:
        c.execute(
            "INSERT INTO users (name, email, password_hash, role, invite_status, active) "
            "VALUES (?, ?, ?, ?, 'active', 1)",
            (name, email, pw_hash, role),
        )
        user_ids[email] = c.lastrowid
    db.commit()

    # Instruments — gated on the 'instruments' module.
    inst_ids: dict[str, int] = {}
    if module_enabled("instruments", modules):
        for code, name, cat, loc, mfr, model, cap, desc in LAB_INSTRUMENTS:
            c.execute(
                "INSERT INTO instruments "
                "(name, code, category, location, manufacturer, model_number, "
                " daily_capacity, status, accepting_requests, soft_accept_enabled, "
                " instrument_description, capabilities_summary) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 1, 0, ?, ?)",
                (name, code, cat, loc, mfr, model, cap, desc, desc[:200]),
            )
            inst_ids[code] = c.lastrowid

        # Operator + admin assignments. Simple: the single operator
        # handles every demo instrument, and the site_admin admins all.
        op_id = user_ids["operator.demo@catalyst.test"]
        admin_id = user_ids["admin.demo@catalyst.test"]
        approver_id = user_ids["approver.demo@catalyst.test"]
        finance_id = user_ids["finance.demo@catalyst.test"]
        for code, iid in inst_ids.items():
            c.execute("INSERT INTO instrument_operators (user_id, instrument_id) VALUES (?, ?)",
                      (op_id, iid))
            c.execute("INSERT INTO instrument_admins (user_id, instrument_id) VALUES (?, ?)",
                      (admin_id, iid))
            c.execute("INSERT INTO instrument_faculty_admins (user_id, instrument_id) VALUES (?, ?)",
                      (approver_id, iid))
            # 2-step approval: professor → finance (mirrors populate_crf.py).
            c.execute(
                "INSERT INTO instrument_approval_config "
                "(instrument_id, step_order, approver_role, approver_user_id) "
                "VALUES (?, 1, 'professor', ?)", (iid, approver_id))
            c.execute(
                "INSERT INTO instrument_approval_config "
                "(instrument_id, step_order, approver_role, approver_user_id) "
                "VALUES (?, 2, 'finance', ?)", (iid, finance_id))
        db.commit()

    # Sample requests — gated on the 'queue' module (which is where the
    # demo story for pipeline state lives).
    req_count = 0
    if module_enabled("queue", modules) and inst_ids:
        now = datetime.utcnow()
        approver_id = user_ids["approver.demo@catalyst.test"]
        for i, (req_email, inst_code, title, sample, count, status, desc) in enumerate(LAB_REQUESTS):
            iid = inst_ids.get(inst_code)
            if iid is None:
                continue  # instrument missing — skip, keep seeder safe
            uid = user_ids[req_email]
            created = (now - timedelta(days=len(LAB_REQUESTS) - i, hours=i * 2)).isoformat(timespec="seconds")
            completed_at = (
                (now - timedelta(hours=i + 1)).isoformat(timespec="seconds")
                if status == "completed" else None
            )
            request_no = f"DEMO-{i + 1:04d}"
            c.execute(
                "INSERT INTO sample_requests "
                "(request_no, requester_id, created_by_user_id, instrument_id, title, sample_name, "
                " sample_count, description, status, priority, created_at, updated_at, completed_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'normal', ?, ?, ?)",
                (request_no, uid, uid, iid, title, sample, count, desc,
                 status, created, created, completed_at),
            )
            req_id = c.lastrowid
            req_count += 1

            # One audit entry per request, reflecting its current status.
            _audit_append(
                c, "sample_request", req_id, f"seed_{status}",
                uid, {"request_no": request_no, "status": status}, created,
            )
            # For completed requests add an approval + completion hop
            # so the log is not degenerate.
            if status == "completed":
                _audit_append(
                    c, "sample_request", req_id, "approved",
                    approver_id, {"step": "professor"}, created,
                )
                _audit_append(
                    c, "sample_request", req_id, "completed",
                    user_ids["operator.demo@catalyst.test"],
                    {"results_summary": "demo run complete"},
                    completed_at or created,
                )
        db.commit()

    db.close()
    return {
        "users": len(user_ids),
        "instruments": len(inst_ids),
        "requests": req_count,
        "db": db_path,
    }


# ── Ravikiran ops variant (STUB) ─────────────────────────────────────

def seed_ravikiran_ops(modules: set[str]) -> dict:
    """STUB — TODO.

    Target rows once implemented (see docs/ERP_DEMO_VARIANTS.md §2,
    "Best first-click journey"):

      TODO: 3-5 personnel rows (name, role, staff_code, base_salary).
            Use the 'personnel' module gate.
      TODO: 2-3 vehicles linked to driver personnel via
            vehicle.driver_user_id. Use the 'vehicles' module gate.
      TODO: 4-6 receipts in varied states (draft, submitted, approved,
            paid). Use the 'receipts' + 'finance' modules.
      TODO: 2-3 attendance rows per person for the last week.
            Use the 'attendance' module.
      TODO: 3-4 todos across people for the inbox demo.
            Use the 'todos' + 'inbox' modules.
      TODO: ~3 audit_log entries for the receipt-to-finance hop so
            the finance surface feels traced.

    For now, just report zero counts so the CLI stays uniform.
    """
    return {"users": 0, "personnel": 0, "vehicles": 0, "receipts": 0, "todos": 0}


# ── Compute variant (STUB) ───────────────────────────────────────────

def seed_compute(modules: set[str]) -> dict:
    """STUB — TODO.

    Target rows once implemented (see docs/ERP_DEMO_VARIANTS.md §3,
    "Best first-click journey"):

      TODO: 2-3 users (a requester + an ops/owner). 'admin' module.
      TODO: 3-5 software entries in the compute catalog.
            Use the 'compute' module gate.
      TODO: 4-6 compute jobs spread across states
            (queued, running, completed, failed, needs_attention).
            Use the 'compute' module gate.
      TODO: One sample stdout + one stderr blob per finished job
            so the job-detail view shows real content.
      TODO: ~3 audit_log entries per job lifecycle
            (submitted → started → completed).

    For now, just report zero counts so the CLI stays uniform.
    """
    return {"users": 0, "software": 0, "jobs": 0}


# ── Entry point ──────────────────────────────────────────────────────

def main() -> int:
    args = parse_args()

    # Let --data-dir override CATALYST_DATA_DIR *before* we import app.
    if args.data_dir:
        os.environ["CATALYST_DATA_DIR"] = str(Path(args.data_dir).resolve())

    modules = enabled_modules()

    if args.variant == "lab":
        summary = seed_lab(modules)
        print(
            f"seeded lab: {summary['users']} users, "
            f"{summary['instruments']} instruments, "
            f"{summary['requests']} requests  →  {summary['db']}"
        )
    elif args.variant == "ravikiran_ops":
        summary = seed_ravikiran_ops(modules)
        print(
            f"seeded ravikiran_ops (STUB): {summary['personnel']} personnel, "
            f"{summary['vehicles']} vehicles, {summary['receipts']} receipts, "
            f"{summary['todos']} todos"
        )
    elif args.variant == "compute":
        summary = seed_compute(modules)
        print(
            f"seeded compute (STUB): {summary['software']} software, "
            f"{summary['jobs']} jobs"
        )
    else:  # defensive — argparse should have caught this
        print(f"unknown variant: {args.variant}", file=sys.stderr)
        return 2

    return 0


if __name__ == "__main__":
    sys.exit(main())
