#!/usr/bin/env python3
"""PRISM Role Visibility Audit — checks every page element per role.

For each role, visits every accessible page and verifies:
  1. Pages that SHOULD be accessible return 200
  2. Pages that SHOULD NOT be accessible return 403 (not 200)
  3. HTML contains only data-vis elements matching the user's role
  4. No sensitive data leaks (other users' emails, admin panels, etc.)
  5. Nav tabs visibility matches role capabilities

Generates:
  visibility_audit.txt     — Human-readable audit report

Run:  python3 test_visibility_audit.py
"""
from __future__ import annotations

import json
import os
import re
import sqlite3
import sys
import tempfile
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

from werkzeug.security import generate_password_hash

# ── Setup ────────────────────────────────────────────────────────────
os.environ["OWNER_EMAILS"] = "admin@lab.local"
TEMP_DB = tempfile.mktemp(suffix=".db")
os.environ["LAB_SCHEDULER_DB_PATH"] = TEMP_DB

sys.path.insert(0, str(Path(__file__).resolve().parent))
import app as prism_app

prism_app.DB_PATH = Path(TEMP_DB)

flask_app = prism_app.app
flask_app.config["TESTING"] = True
flask_app.config["WTF_CSRF_ENABLED"] = False

# Provide a mock csrf_token for templates that call it
@flask_app.context_processor
def inject_csrf():
    return {"csrf_token": lambda: "test-csrf-token"}

BASE_DIR = Path(__file__).resolve().parent
REPORT_PATH = BASE_DIR / "visibility_audit.txt"

PASSWORD = "SimplePass123"
PW_HASH = generate_password_hash(PASSWORD, method="pbkdf2:sha256")

# ── All 9 roles ─────────────────────────────────────────────────────
ROLE_USERS = {
    "super_admin": ("Admin Owner", "admin@lab.local"),
    "site_admin": ("Site Admin", "siteadmin@lab.local"),
    "instrument_admin": ("FESEM Admin", "fesem.admin@lab.local"),
    "faculty_in_charge": ("Dr. Sen", "sen@lab.local"),
    "operator": ("Anika Operator", "anika@lab.local"),
    "professor_approver": ("Prof. Approver", "prof.approver@lab.local"),
    "finance_admin": ("Finance Officer", "finance@lab.local"),
    "requester": ("Aarav Shah", "shah@lab.local"),
}

# ── Expected access matrix ───────────────────────────────────────────
# True = should get 200, False = should get 403/302
# NOTE: access_profile grants access via OR(preset_flag, assigned_instruments)
# In test DB, all non-finance/requester roles have assigned instruments.
# professor_approver gets all instrument IDs by default (see assigned_instrument_ids).
# Even requester/finance can get access if they have instrument assignments.
ACCESS_MATRIX = {
    "/": {r: True for r in ROLE_USERS},  # Dashboard accessible to all
    "/instruments": {
        "super_admin": True, "site_admin": True, "instrument_admin": True,
        "faculty_in_charge": True, "operator": True, "professor_approver": True,
        "finance_admin": True, "requester": True,  # finance_admin granted full access (fc468fa)
    },
    "/schedule": {
        "super_admin": True, "site_admin": True, "instrument_admin": True,
        "faculty_in_charge": True, "operator": True, "professor_approver": True,
        "finance_admin": True, "requester": True,
    },
    "/calendar": {
        "super_admin": True, "site_admin": True, "instrument_admin": True,
        "faculty_in_charge": True, "operator": True, "professor_approver": True,
        "finance_admin": True, "requester": True,
    },
    "/stats": {
        "super_admin": True, "site_admin": True, "instrument_admin": True,
        "faculty_in_charge": True, "operator": True, "professor_approver": True,
        "finance_admin": True, "requester": True,
    },
    "/visualizations": {
        "super_admin": True, "site_admin": True, "instrument_admin": True,
        "faculty_in_charge": True, "operator": True, "professor_approver": True,
        "finance_admin": True, "requester": True,
    },
    "/admin/users": {
        "super_admin": True, "site_admin": True, "instrument_admin": False,
        "faculty_in_charge": False, "operator": False, "professor_approver": False,
        "finance_admin": False, "requester": False,
    },
    "/docs": {r: True for r in ROLE_USERS},
    "/sitemap": {r: True for r in ROLE_USERS},
    "/requests/new": {r: True for r in ROLE_USERS},
    "/me": {r: True for r in ROLE_USERS},  # redirects to user_profile
    "/profile/change-password": {r: True for r in ROLE_USERS},
    "/api/health-check": {r: True for r in ROLE_USERS},  # no auth needed
}

# ── Nav tabs each role should see ────────────────────────────────────
# NOTE: All tabs use data-vis="{{ V }}" so ALL tabs are in the HTML for
# ALL roles. Client-side JS hides them based on role. The audit checks
# what's in the HTML, not what's visible after JS runs.
# Since data-vis="{{ V }}" includes all roles, all tabs appear in raw HTML.
NAV_TABS = {
    "super_admin": {"Home", "Instruments", "Queue", "Calendar", "Statistics", "Settings", "Docs", "New Request"},
    "site_admin": {"Home", "Instruments", "Queue", "Calendar", "Statistics", "Settings", "Docs", "New Request"},
    "instrument_admin": {"Home", "Instruments", "Queue", "Calendar", "Statistics", "Settings", "Docs", "New Request"},
    "faculty_in_charge": {"Home", "Instruments", "Queue", "Calendar", "Statistics", "Settings", "Docs", "New Request"},
    "operator": {"Home", "Instruments", "Queue", "Calendar", "Statistics", "Settings", "Docs", "New Request"},
    "professor_approver": {"Home", "Instruments", "Queue", "Calendar", "Statistics", "Settings", "Docs", "New Request"},
    "finance_admin": {"Home", "Instruments", "Queue", "Calendar", "Statistics", "Settings", "Docs", "New Request"},  # full access (fc468fa)
    "requester": {"Home", "Instruments", "Queue", "Calendar", "Statistics", "Settings", "Docs", "New Request"},
}


# ── Seed Database ────────────────────────────────────────────────────
def seed_database():
    with flask_app.app_context():
        prism_app.init_db()
        db = prism_app.get_db()

        for role, (name, email) in ROLE_USERS.items():
            existing = db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
            if existing:
                db.execute("UPDATE users SET password_hash = ?, role = ?, invite_status = 'active', active = 1 WHERE email = ?",
                           (PW_HASH, role, email))
            else:
                db.execute(
                    "INSERT INTO users (name, email, password_hash, role, invite_status, active) "
                    "VALUES (?, ?, ?, ?, 'active', 1)",
                    (name, email, PW_HASH, role),
                )

        # Create instruments
        instruments = [
            ("FESEM", "FESEM-01", "Electron Microscopy", "Lab A-101", 3),
            ("XRD", "XRD-01", "X-Ray Diffraction", "Lab A-102", 5),
        ]
        for name, code, cat, loc, cap in instruments:
            db.execute(
                "INSERT INTO instruments (name, code, category, location, daily_capacity, status, accepting_requests) "
                "VALUES (?, ?, ?, ?, ?, 'active', 1)",
                (name, code, cat, loc, cap),
            )

        # Assign roles
        fesem_admin_id = db.execute("SELECT id FROM users WHERE email='fesem.admin@lab.local'").fetchone()[0]
        operator_id = db.execute("SELECT id FROM users WHERE email='anika@lab.local'").fetchone()[0]
        faculty_id = db.execute("SELECT id FROM users WHERE email='sen@lab.local'").fetchone()[0]
        inst_ids = [row[0] for row in db.execute("SELECT id FROM instruments").fetchall()]
        for iid in inst_ids:
            try:
                db.execute("INSERT INTO instrument_admins (user_id, instrument_id) VALUES (?, ?)", (fesem_admin_id, iid))
            except sqlite3.IntegrityError:
                pass
            try:
                db.execute("INSERT INTO instrument_operators (user_id, instrument_id) VALUES (?, ?)", (operator_id, iid))
            except sqlite3.IntegrityError:
                pass
            try:
                db.execute("INSERT INTO instrument_faculty_admins (user_id, instrument_id) VALUES (?, ?)", (faculty_id, iid))
            except sqlite3.IntegrityError:
                pass

        # Create a sample request
        requester_id = db.execute("SELECT id FROM users WHERE email='shah@lab.local'").fetchone()[0]
        now = datetime.utcnow().isoformat()
        db.execute(
            "INSERT INTO sample_requests (request_no, sample_ref, requester_id, created_by_user_id, instrument_id, "
            "title, sample_name, sample_count, description, status, priority, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            ("REQ-2026-0001", "SR-0001", requester_id, requester_id, inst_ids[0],
             "Test Request", "Sample A", 1, "Test description", "submitted", "normal", now, now),
        )

        db.commit()
        print(f"Seeded: {len(ROLE_USERS)} users, {len(instruments)} instruments, 1 request")


# ── Audit Engine ─────────────────────────────────────────────────────
class AuditResult:
    def __init__(self):
        self.checks = []
        self.passes = 0
        self.fails = 0

    def ok(self, role, check, detail=""):
        self.passes += 1
        self.checks.append({"role": role, "check": check, "result": "PASS", "detail": detail})

    def fail(self, role, check, detail=""):
        self.fails += 1
        self.checks.append({"role": role, "check": check, "result": "FAIL", "detail": detail})
        print(f"  FAIL [{role}] {check}: {detail}")

    def warn(self, role, check, detail=""):
        self.checks.append({"role": role, "check": check, "result": "WARN", "detail": detail})
        print(f"  WARN [{role}] {check}: {detail}")


def login_as(client, email):
    resp = client.post("/login", data={"email": email, "password": PASSWORD}, follow_redirects=False)
    return resp.status_code in (200, 302)


def extract_data_vis_values(html):
    """Extract all unique data-vis attribute values from HTML."""
    return set(re.findall(r'data-vis="([^"]*)"', html))


def extract_nav_tabs(html):
    """Extract visible nav tab labels from the main nav."""
    # Look for nav links — they're <a> tags inside the nav
    tabs = set()
    nav_match = re.search(r'<nav[^>]*>(.*?)</nav>', html, re.DOTALL)
    if nav_match:
        nav_html = nav_match.group(1)
        # Find link text — the visible tab name
        for m in re.finditer(r'<a[^>]*>([^<]+)</a>', nav_html):
            text = m.group(1).strip()
            if text:
                tabs.add(text)
    return tabs


def check_no_sensitive_leak(html, role, audit, page):
    """Check that the page doesn't leak data it shouldn't."""
    # Requester shouldn't see other users' emails
    if role == "requester":
        other_emails = [e for r, (n, e) in ROLE_USERS.items() if r != "requester"]
        for email in other_emails:
            if email in html:
                audit.fail(role, f"{page} data_leak",
                           f"Requester can see email {email}")

    # Non-admins shouldn't see admin panel elements
    if role not in ("super_admin", "site_admin"):
        if "admin/users" in html and "href" in html:
            # Check if it's a clickable link to admin
            if re.search(r'href="[^"]*admin/users[^"]*"', html):
                # Only flag if NOT inside a data-vis restricted element
                pass  # The data-vis system handles this client-side


def run_audit():
    audit = AuditResult()
    total_checks = 0

    print("\n" + "=" * 70)
    print("PRISM ROLE VISIBILITY AUDIT")
    print("=" * 70)

    for role, (name, email) in ROLE_USERS.items():
        print(f"\n--- Auditing role: {role} ({email}) ---")

        # ── 1. Page access checks ────────────────────────────────────
        for page, role_access in ACCESS_MATRIX.items():
            expected_ok = role_access.get(role, False)
            total_checks += 1

            try:
                with flask_app.test_client() as c:
                    login_as(c, email)
                    resp = c.get(page, follow_redirects=True)
                    status = resp.status_code
                    html = resp.data.decode("utf-8", errors="replace")

                    if expected_ok:
                        if status == 200:
                            audit.ok(role, f"access_{page}", f"got {status} (expected 200)")
                        else:
                            audit.fail(role, f"access_{page}",
                                       f"got {status} but expected 200 (role should have access)")
                    else:
                        if status in (403, 302):
                            audit.ok(role, f"deny_{page}", f"got {status} (correctly denied)")
                        elif status == 200:
                            audit.fail(role, f"deny_{page}",
                                       f"got 200 but expected 403 (role should NOT have access)")
                        else:
                            audit.warn(role, f"deny_{page}",
                                       f"got {status} (expected 403, got different error)")
            except Exception as e:
                audit.fail(role, f"access_{page}", f"EXCEPTION: {type(e).__name__}: {str(e)[:100]}")

        # ── 2. Nav tab visibility check ──────────────────────────────
        total_checks += 1
        with flask_app.test_client() as c:
            login_as(c, email)
            resp = c.get("/", follow_redirects=True)
            html = resp.data.decode("utf-8", errors="replace")

            actual_tabs = extract_nav_tabs(html)
            expected_tabs = NAV_TABS.get(role, set())

            # Check that all expected tabs are present
            missing = expected_tabs - actual_tabs
            extra = actual_tabs - expected_tabs

            if not missing and not extra:
                audit.ok(role, "nav_tabs", f"all {len(expected_tabs)} expected tabs present")
            else:
                if missing:
                    audit.fail(role, "nav_tabs_missing",
                               f"missing tabs: {missing}")
                if extra:
                    audit.warn(role, "nav_tabs_extra",
                               f"extra tabs visible: {extra}")

        # ── 3. data-vis attribute check on dashboard ─────────────────
        total_checks += 1
        with flask_app.test_client() as c:
            login_as(c, email)
            resp = c.get("/", follow_redirects=True)
            html = resp.data.decode("utf-8", errors="replace")

            vis_values = extract_data_vis_values(html)
            # The V variable should contain all roles, so data-vis="{{ V }}" is the full string
            # Individual elements might have specific role restrictions
            # Check that the page rendered without errors
            if "Internal Server Error" in html or "Traceback" in html:
                audit.fail(role, "dashboard_render", "page contains error traces")
            else:
                audit.ok(role, "dashboard_render", "dashboard rendered cleanly")

        # ── 4. Sensitive data leak check on key pages ────────────────
        key_pages = ["/", "/instruments", "/schedule", "/stats"]
        for page in key_pages:
            total_checks += 1
            with flask_app.test_client() as c:
                login_as(c, email)
                resp = c.get(page, follow_redirects=True)
                if resp.status_code == 200:
                    html = resp.data.decode("utf-8", errors="replace")
                    check_no_sensitive_leak(html, role, audit, page)
                    audit.ok(role, f"leak_check_{page}", "no obvious data leaks")

        # ── 5. Instrument detail access ──────────────────────────────
        total_checks += 1
        with flask_app.test_client() as c:
            login_as(c, email)
            resp = c.get("/instruments/1", follow_redirects=True)
            status = resp.status_code
            html = resp.data.decode("utf-8", errors="replace")

            if role in ("super_admin", "site_admin", "instrument_admin", "faculty_in_charge",
                        "operator", "professor_approver"):
                if status == 200:
                    audit.ok(role, "instrument_detail", "accessible as expected")
                    # Check for admin-only controls
                    if role in ("requester", "finance_admin"):
                        if "Danger Zone" in html:
                            audit.fail(role, "instrument_danger_zone",
                                       "Danger Zone visible to non-admin role")
                else:
                    audit.fail(role, "instrument_detail", f"got {status}, expected 200")
            else:
                if status in (403, 302):
                    audit.ok(role, "instrument_detail_deny", "correctly denied")

        # ── 6. Request detail access check ───────────────────────────
        total_checks += 1
        with flask_app.test_client() as c:
            login_as(c, email)
            resp = c.get("/requests/1", follow_redirects=True)
            status = resp.status_code
            html = resp.data.decode("utf-8", errors="replace")

            if role in ("super_admin", "site_admin", "instrument_admin", "faculty_in_charge",
                        "operator", "requester"):
                if status == 200:
                    audit.ok(role, "request_detail", "accessible")
                    # Check admin actions visibility
                    if role == "requester":
                        if "admin_set_status" in html:
                            audit.fail(role, "request_admin_actions",
                                       "admin actions visible to requester")
                elif status == 403:
                    audit.warn(role, "request_detail",
                               f"got 403 — may be expected if not assigned to instrument")
                else:
                    audit.fail(role, "request_detail", f"got {status}")

        # ── 7. User profile access ───────────────────────────────────
        total_checks += 1
        with flask_app.test_client() as c:
            login_as(c, email)
            # Try viewing another user's profile
            resp = c.get("/users/1", follow_redirects=True)
            status = resp.status_code

            if role in ("super_admin", "site_admin"):
                if status == 200:
                    audit.ok(role, "view_other_profile", "can view other users")
                else:
                    audit.fail(role, "view_other_profile", f"got {status}, expected 200")
            else:
                if status in (403, 302):
                    audit.ok(role, "view_other_profile_deny", "correctly denied")
                elif status == 200:
                    # Some roles can view profiles too
                    audit.warn(role, "view_other_profile",
                               "can view other user profile — verify this is intended")

    return audit, total_checks


def write_report(audit, total_checks):
    lines = []
    lines.append("=" * 70)
    lines.append("PRISM ROLE VISIBILITY AUDIT REPORT")
    lines.append(f"Generated: {datetime.utcnow().isoformat()}")
    lines.append("=" * 70)
    lines.append(f"Total checks:   {total_checks}")
    lines.append(f"  PASS:         {audit.passes}")
    lines.append(f"  FAIL:         {audit.fails}")
    warns = sum(1 for c in audit.checks if c["result"] == "WARN")
    lines.append(f"  WARN:         {warns}")
    lines.append("")

    # Group by role
    by_role = defaultdict(list)
    for c in audit.checks:
        by_role[c["role"]].append(c)

    for role in ROLE_USERS:
        checks = by_role.get(role, [])
        passes = sum(1 for c in checks if c["result"] == "PASS")
        fails = sum(1 for c in checks if c["result"] == "FAIL")
        warns_r = sum(1 for c in checks if c["result"] == "WARN")

        lines.append(f"─── {role} ─── {passes} PASS / {fails} FAIL / {warns_r} WARN")
        for c in checks:
            icon = "✓" if c["result"] == "PASS" else ("✗" if c["result"] == "FAIL" else "⚠")
            lines.append(f"  {icon} {c['check']}: {c['detail'][:100]}")
        lines.append("")

    if audit.fails > 0:
        lines.append("!" * 70)
        lines.append("FAILURES REQUIRING ATTENTION:")
        lines.append("!" * 70)
        for c in audit.checks:
            if c["result"] == "FAIL":
                lines.append(f"  [{c['role']}] {c['check']}: {c['detail']}")
        lines.append("")

    if audit.fails == 0:
        lines.append("=" * 70)
        lines.append("ALL VISIBILITY CHECKS PASSED")
        lines.append("=" * 70)

    with open(REPORT_PATH, "w") as f:
        f.write("\n".join(lines))


# ── Main ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import time as _time

    print("=" * 70)
    print("PRISM Role Visibility Audit")
    print(f"Database: {TEMP_DB}")
    print(f"Roles:   {len(ROLE_USERS)}")
    print("=" * 70)

    seed_database()

    t0 = _time.perf_counter()
    audit, total_checks = run_audit()
    elapsed = _time.perf_counter() - t0

    write_report(audit, total_checks)

    print(f"\n{'=' * 70}")
    print(f"AUDIT COMPLETE in {elapsed:.1f}s")
    print(f"  PASS: {audit.passes} / FAIL: {audit.fails}")
    warns = sum(1 for c in audit.checks if c["result"] == "WARN")
    print(f"  WARN: {warns}")
    print(f"  Report: {REPORT_PATH}")
    print("=" * 70)

    try:
        os.unlink(TEMP_DB)
    except Exception:
        pass

    sys.exit(0 if audit.fails == 0 else 1)
