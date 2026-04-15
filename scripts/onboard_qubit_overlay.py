"""
onboard_qubit_overlay — apply the Qubit-onboarding overlay on top of the
canonical demo seed.

This is intentionally NOT part of `populate_live_demo.py` because the
canonical seed needs to stay stable for `scripts/smoke_test.py` (the
pre-commit gate asserts seed-user IDs and request IDs).

Run AFTER `smoke_test.py` (or AFTER `populate_live_demo.py` directly) when
you want the running demo to show only:

    - All admins
    - Six R&D operators from Kondhalkar's xlsx (2026-04-15)
    - Two demo PIs (Dr. Kapoor, Dr. Das)
    - INST-022 (RF-DC Sputtering & Thermal E-Beam) added if missing
    - 14 operator-instrument pairings exactly per the sheet
    - 3 fresh sample requests (one per status: submitted / under_review / awaiting)

Idempotent — safe to re-run. Hard cap on what it touches: only the tables
listed below. Audit_logs are preserved (chain integrity).

Usage:
    .venv/bin/python scripts/onboard_qubit_overlay.py
"""

from __future__ import annotations

import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

from werkzeug.security import generate_password_hash

# Find app.DB_PATH the same way populate_live_demo does
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))
import app as _app  # noqa: E402

DEMO_PASSWORD = "DemoPass2026"


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0, tzinfo=None).isoformat() + "Z"


def main() -> int:
    db_path = _app.DB_PATH
    if not db_path.exists():
        print(f"DB not found: {db_path}. Run populate_live_demo first.", file=sys.stderr)
        return 2

    con = sqlite3.connect(db_path, timeout=30, isolation_level=None)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA busy_timeout = 30000;")
    cur = con.cursor()

    cur.execute("BEGIN IMMEDIATE;")
    try:
        # 1. Six new operators
        op_specs = [
            ("Mr. Ranjit Kate",       "ranjit.kate@mitwpu.edu.in",       "RKA"),
            ("Dr. Santosh Patil",     "santosh.patil@mitwpu.edu.in",     "SPA"),
            ("Mrs. Aparna Potdar",    "aparna.potdar@mitwpu.edu.in",     "APO"),
            ("Dr. Vaibhav Kathavate", "vaibhav.kathavate@mitwpu.edu.in", "VKA"),
            ("Dr. Vrushali Pagire",   "vrushali.pagire@mitwpu.edu.in",   "VPA"),
            ("Dr. Sahebrao More",     "sahebrao.more@mitwpu.edu.in",     "SMO"),
        ]
        pw_hash = generate_password_hash(DEMO_PASSWORD, method="pbkdf2:sha256")
        op_ids: dict[str, int] = {}
        for name, email, sc in op_specs:
            cur.execute(
                """INSERT INTO users (name, email, password_hash, role, invited_by, invite_status, active,
                                      must_change_password, role_manual_notice, avatar_url, short_code,
                                      phone, office_location)
                   VALUES (?,?,?, 'operator', NULL, 'active', 1, 1, '', '', ?, '', 'R&D Lab')
                   ON CONFLICT(email) DO UPDATE SET
                       name=excluded.name,
                       role='operator',
                       invite_status='active',
                       active=1,
                       short_code=excluded.short_code,
                       office_location='R&D Lab',
                       password_hash=excluded.password_hash,
                       must_change_password=1""",
                (name, email, pw_hash, sc),
            )
            row = cur.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone()
            op_ids[sc] = row["id"]

        # 2. INST-022 (idempotent)
        cur.execute(
            """INSERT INTO instruments (name, code, category, location, daily_capacity, notes,
                manufacturer, model_number, capabilities_summary, machine_photo_url, reference_links,
                faculty_group, instrument_description)
               SELECT 'RF-DC Sputtering & Thermal E-Beam System','INST-022','Deposition',
                      'Facility Bay C — Deposition', 4,
                      'Thin-film deposition (RF-DC sputtering + thermal E-beam).',
                      '','','Sputtering and thermal evaporation thin-film deposition.',
                      '','','R&D Lab','RF-DC Sputtering and Thermal E-Beam System.'
               WHERE NOT EXISTS (SELECT 1 FROM instruments WHERE code='INST-022')""")
        inst_ids = {r["code"]: r["id"] for r in cur.execute("SELECT id, code FROM instruments")}

        # 3. Re-seed instrument_operators with the 14 pairings from the sheet
        cur.execute("DELETE FROM instrument_operators")
        pairings = [
            ("RKA","INST-001"), ("SPA","INST-003"), ("APO","INST-003"),
            ("VKA","INST-006"), ("VKA","INST-007"), ("VPA","INST-004"),
            ("APO","INST-010"), ("RKA","INST-010"),
            ("SPA","INST-022"), ("SMO","INST-022"),
            ("SMO","INST-011"), ("SMO","INST-012"), ("SMO","INST-005"),
            ("SPA","INST-002"),
        ]
        for sc, code in pairings:
            if sc in op_ids and code in inst_ids:
                cur.execute(
                    "INSERT OR IGNORE INTO instrument_operators (user_id, instrument_id) VALUES (?, ?)",
                    (op_ids[sc], inst_ids[code]))

        # 4. Wipe sample requests + children, re-seed with 3 demo samples
        cur.execute("DELETE FROM request_attachments")
        cur.execute("DELETE FROM request_messages")
        cur.execute("DELETE FROM request_issues")
        cur.execute("DELETE FROM request_custom_field_values")
        cur.execute("DELETE FROM approval_steps WHERE sample_request_id IS NOT NULL")
        cur.execute("DELETE FROM invoices WHERE request_id IS NOT NULL")
        cur.execute("DELETE FROM sample_requests")
        cur.execute("DELETE FROM sqlite_sequence WHERE name='sample_requests'")

        # Pick demo PIs in priority order — Dr. Kapoor (lab) → Dr. Das (lab) → fall back to first requester
        def pick_user(emails: list[str]) -> int | None:
            for em in emails:
                r = cur.execute("SELECT id FROM users WHERE email=?", (em,)).fetchone()
                if r:
                    return r["id"]
            r = cur.execute("SELECT id FROM users WHERE role='requester' AND active=1 ORDER BY id LIMIT 1").fetchone()
            return r["id"] if r else None

        kapoor_id = pick_user(["kapoor@lab.local"])
        das_id = pick_user(["das@lab.local"])
        if kapoor_id and das_id:
            now = now_iso()
            demos = [
                ("REQ-DEMO-001", kapoor_id, inst_ids.get("INST-001"), "FESEM imaging — alumina pellets",       "Alumina pellet (sintered)", "Surface morphology + EDS spot scan on five sintered Al2O3 pellets.",   "submitted",                  "normal"),
                ("REQ-DEMO-002", das_id,    inst_ids.get("INST-004"), "Raman scan — graphene oxide thin film", "GO film on Si",             "D-band / G-band ratio across 5 spots; 532 nm laser.",                  "under_review",               "normal"),
                ("REQ-DEMO-003", kapoor_id, inst_ids.get("INST-006"), "Nanoindentation — DLC coating",         "DLC-coated steel coupon",   "Hardness + modulus at 50 mN, 9 indents in 3x3 grid.",                  "awaiting_sample_submission", "high"),
            ]
            for req_no, requester_id, inst_id, title, sname, descr, status, prio in demos:
                if not inst_id:
                    continue
                cur.execute(
                    """INSERT INTO sample_requests
                       (request_no, requester_id, created_by_user_id, instrument_id, title, sample_name,
                        description, status, priority, sample_origin, originator_note, created_at, updated_at)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (req_no, requester_id, requester_id, inst_id, title, sname, descr, status, prio,
                     "internal", "", now, now))

        # 5. Deactivate everyone not in keepers (admins + Kondhalkar + 2 PIs + 6 new operators)
        keeper_emails = [
            "nikita", "prashant",
            "owner@catalyst.local", "dean@catalyst.local",
            "kondhalkar", "siteadmin@catalyst.local", "satyajeetn", "siteadmin@lab.local",
            "meera@catalyst.local", "suresh@catalyst.local",
            "approver@catalyst.local", "sen@lab.local",
            "kapoor@lab.local", "das@lab.local",
            "xrd.admin@lab.local",
        ] + [email for _, email, _ in op_specs]
        ph = ",".join("?" * len(keeper_emails))
        cur.execute(f"UPDATE users SET active = 0 WHERE email NOT IN ({ph})", keeper_emails)

        cur.execute("COMMIT;")
    except Exception as exc:
        cur.execute("ROLLBACK;")
        print(f"ROLLBACK: {exc}", file=sys.stderr)
        return 1

    # Report
    print("=== Qubit overlay applied ===")
    for label, sql in [
        ("active users by role",
         "SELECT role, COUNT(*) FROM users WHERE active=1 GROUP BY role ORDER BY role"),
        ("sample requests",
         "SELECT request_no, status, title FROM sample_requests ORDER BY id"),
        ("operator-instrument links (active)",
         """SELECT u.short_code, u.name, i.code, i.name FROM instrument_operators io
            JOIN users u ON u.id=io.user_id JOIN instruments i ON i.id=io.instrument_id
            WHERE u.active=1 ORDER BY i.code"""),
    ]:
        print(f"\n-- {label} --")
        for r in cur.execute(sql):
            print("  " + " | ".join("" if v is None else str(v) for v in r))

    print(f"\nDemo password for the 6 new operators: {DEMO_PASSWORD}")
    print("(must_change_password=1 — they'll be prompted to set their own on first login)")
    con.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
