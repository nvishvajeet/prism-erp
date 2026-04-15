"""
onboard_ravikiran_overlay — apply a Ravikiran-ERP household-staff
roster from an extracted proposal JSON into a Ravikiran SQLite DB.

Parallel to `scripts/onboard_qubit_overlay.py` (Lab ERP), but for
the household ERP wrapper. Per the silo policy, takes a mandatory
`--erp ravikiran` flag and refuses any other value.

The input is the JSON emitted by `crawlers/ai_extract_upload.py
--erp ravikiran`. Each proposed_user is inserted as a `pending_approval`
account so a Ravikiran super_admin (Pournima / Abasaheb / Prashant)
can approve them via the normal Members → Pending queue UI.

Usage
-----
.venv/bin/python scripts/onboard_ravikiran_overlay.py \\
    --erp ravikiran \\
    --proposal /path/to/prashant_attendance.proposal.json \\
    --db /Users/vishwajeet/ravikiran-services/data/demo/lab_scheduler.db

Idempotent — re-running skips users whose email already exists.
`--dry-run` prints what would happen without touching the DB.

Refuses any DB whose path contains `/operational/` unless
`--allow-operational` is explicitly passed (same guardrail as the
Lab-ERP overlay). Today Ravikiran has no operational DB; this is
forward-proofing.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    from werkzeug.security import generate_password_hash
except ImportError:
    # Fallback — werkzeug not in Ravikiran's venv yet; just write empty hash
    def generate_password_hash(*a, **kw):  # type: ignore
        return ""

SUPPORTED_ERPS = {"ravikiran"}
DEMO_PASSWORD = "RaviPass2026"


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0, tzinfo=None).isoformat() + "Z"


def pick_inviter(con: sqlite3.Connection) -> int | None:
    """Prefer Prashant (Chief Accountant on Ravikiran), fall back to any
    super_admin."""
    for email in ("prashant", "pournima", "abasaheb"):
        row = con.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
        if row:
            return row[0]
    row = con.execute(
        "SELECT id FROM users WHERE role = 'super_admin' AND active = 1 ORDER BY id LIMIT 1"
    ).fetchone()
    return row[0] if row else None


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        prog="onboard_ravikiran_overlay",
        description="Apply a Ravikiran household-staff roster proposal JSON into the Ravikiran SQLite DB.",
    )
    ap.add_argument(
        "--erp",
        required=True,
        choices=sorted(SUPPORTED_ERPS),
        help="Target ERP. NO DEFAULT — wrong-target writes are a loud error. "
             "Only --erp ravikiran is supported by this overlay.",
    )
    ap.add_argument(
        "--proposal",
        type=Path,
        required=True,
        help="Path to the JSON emitted by ai_extract_upload --erp ravikiran.",
    )
    ap.add_argument(
        "--db",
        type=Path,
        required=True,
        help="Path to the Ravikiran SQLite DB (typically "
             "~/ravikiran-services/data/demo/lab_scheduler.db).",
    )
    ap.add_argument(
        "--allow-operational",
        action="store_true",
        help="Required to write to a DB whose path contains '/operational/'.",
    )
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would happen; no DB writes.",
    )
    args = ap.parse_args(argv)

    if args.erp != "ravikiran":
        print(f"refusing: --erp {args.erp} not supported", file=sys.stderr)
        return 2
    if not args.proposal.exists():
        print(f"refusing: proposal not found: {args.proposal}", file=sys.stderr)
        return 2
    if not args.db.exists():
        print(f"refusing: db not found: {args.db}", file=sys.stderr)
        return 2
    if "/operational/" in str(args.db) and not args.allow_operational:
        print(f"refusing: {args.db} is an operational DB. Pass --allow-operational.", file=sys.stderr)
        return 2

    proposal = json.loads(args.proposal.read_text(encoding="utf-8"))
    if proposal.get("erp") and proposal["erp"] != "ravikiran":
        print(f"refusing: proposal was generated for erp={proposal['erp']!r}, not ravikiran", file=sys.stderr)
        return 2
    users = proposal.get("proposed_users", [])
    if not users:
        print("no proposed_users in proposal; nothing to do")
        return 0

    con = sqlite3.connect(args.db, timeout=30, isolation_level=None)
    con.execute("PRAGMA busy_timeout = 30000;")
    con.row_factory = sqlite3.Row

    inviter = pick_inviter(con)
    if inviter is None:
        print("refusing: no Ravikiran super_admin found to act as inviter", file=sys.stderr)
        return 2

    pw_hash = generate_password_hash(DEMO_PASSWORD, method="pbkdf2:sha256") if generate_password_hash else ""
    now = now_iso()

    created = 0
    skipped_email = 0
    skipped_shortcode = 0
    if args.dry_run:
        print(f"DRY RUN — would insert up to {len(users)} users (inviter={inviter})")
        for u in users[:5]:
            print(f"  would add: {u['name']} ({u['email']}) role={u['role']} sc={u['short_code']}")
        if len(users) > 5:
            print(f"  ... and {len(users) - 5} more")
        con.close()
        return 0

    cur = con.cursor()

    # Schema-aware: Ravikiran's users table is older than Lab ERP's and
    # lacks some columns (short_code, phone, office_location, etc.).
    # Detect at runtime and build INSERT dynamically from the intersection
    # of our desired columns and what the table actually has.
    actual_cols = {row[1] for row in cur.execute("PRAGMA table_info(users)")}
    has_short_code         = "short_code" in actual_cols
    has_office_location    = "office_location" in actual_cols
    has_phone              = "phone" in actual_cols
    has_avatar             = "avatar_url" in actual_cols
    has_role_manual        = "role_manual_notice" in actual_cols
    has_must_change_pw     = "must_change_password" in actual_cols

    cur.execute("BEGIN IMMEDIATE;")
    try:
        for u in users:
            # Skip if email already exists
            if cur.execute("SELECT 1 FROM users WHERE email = ?", (u["email"],)).fetchone():
                skipped_email += 1
                continue
            # Skip if short_code collides (when the column exists in this schema)
            if has_short_code and u.get("short_code") and cur.execute(
                "SELECT 1 FROM users WHERE short_code = ?", (u["short_code"],)
            ).fetchone():
                skipped_shortcode += 1
                continue

            cols = ["name", "email", "password_hash", "role", "invited_by",
                    "invite_status", "active"]
            vals: list = [u["name"], u["email"], pw_hash,
                          u.get("role") or "operator", inviter,
                          "pending_approval", 0]
            if has_must_change_pw:
                cols.append("must_change_password"); vals.append(1)
            if has_role_manual:
                cols.append("role_manual_notice"); vals.append("")
            if has_avatar:
                cols.append("avatar_url"); vals.append("")
            if has_short_code:
                cols.append("short_code"); vals.append(u.get("short_code") or "")
            if has_phone:
                cols.append("phone"); vals.append("")
            if has_office_location:
                cols.append("office_location"); vals.append("Ravikiran Services")

            placeholders = ", ".join("?" * len(cols))
            column_list  = ", ".join(cols)
            cur.execute(
                f"INSERT INTO users ({column_list}) VALUES ({placeholders})",
                vals,
            )
            created += 1
        cur.execute("COMMIT;")
    except Exception as exc:
        cur.execute("ROLLBACK;")
        print(f"ROLLBACK: {exc}", file=sys.stderr)
        return 1

    print(f"Ravikiran overlay applied to {args.db}")
    print(f"  inserted : {created} users in 'pending_approval'")
    print(f"  skipped  : {skipped_email} (email already exists), {skipped_shortcode} (short_code collision)")
    print(f"  inviter  : user id {inviter}")
    print(f"  next step: a Ravikiran super_admin approves them from Members → Pending profiles")

    con.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
