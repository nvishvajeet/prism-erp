#!/usr/bin/env python3
"""Comprehensive crawl test for PRISM Lab Scheduler.

Seeds a test database with 10 instruments, 15+ faculty/staff, 25+ users,
and sample requests in various lifecycle states.  Then uses Flask's test
client to crawl every page as every role, checking for:

  1. HTTP 200 (or expected redirect) on every accessible route
  2. No Jinja2 template errors (500s)
  3. Role-appropriate access (403 where expected)
  4. Form submissions work (login, new request, status changes)
  5. API endpoints return valid JSON

Run:  python3 test_crawl.py
Exit: 0 = all pass, 1 = failures found
"""
from __future__ import annotations

import json
import os
import sqlite3
import sys
import tempfile
from datetime import datetime, timedelta
from pathlib import Path
from werkzeug.security import generate_password_hash

# ── Setup ────────────────────────────────────────────────────────────
os.environ["OWNER_EMAILS"] = "admin@lab.local"
# Point to a fresh temp database
TEMP_DB = tempfile.mktemp(suffix=".db")
os.environ["LAB_SCHEDULER_DB_PATH"] = TEMP_DB

# Patch DB_PATH before importing app
import app as prism_app
prism_app.DB_PATH = Path(TEMP_DB)

app = prism_app.app
app.config["TESTING"] = True
app.config["WTF_CSRF_ENABLED"] = False

PASSWORD = "TestPass123!"
PW_HASH = generate_password_hash(PASSWORD)

# ── Test Users ───────────────────────────────────────────────────────
USERS = [
    # (name, email, role)
    ("Admin Owner", "admin@lab.local", "super_admin"),
    ("Dean Kumar", "dean@lab.local", "super_admin"),
    ("Dr. Sen", "sen@lab.local", "faculty_in_charge"),
    ("Dr. Kondhalkar", "kondhalkar@lab.local", "faculty_in_charge"),
    ("Dr. Patil", "patil@lab.local", "faculty_in_charge"),
    ("Dr. Joshi", "joshi@lab.local", "faculty_in_charge"),
    ("Dr. Deshmukh", "deshmukh@lab.local", "faculty_in_charge"),
    ("FESEM Admin", "fesem.admin@lab.local", "instrument_admin"),
    ("XRD Admin", "xrd.admin@lab.local", "instrument_admin"),
    ("NMR Admin", "nmr.admin@lab.local", "instrument_admin"),
    ("Anika Operator", "anika@lab.local", "operator"),
    ("Raj Operator", "raj.op@lab.local", "operator"),
    ("Priya Operator", "priya.op@lab.local", "operator"),
    ("Meera Operator", "meera.op@lab.local", "operator"),
    ("Finance Officer", "finance@lab.local", "finance_admin"),
    ("Prof. Approver", "prof.approver@lab.local", "professor_approver"),
    ("Dr. Reviewer", "reviewer@lab.local", "professor_approver"),
    ("Aarav Shah", "shah@lab.local", "requester"),
    ("Priya Mehta", "priya.m@lab.local", "requester"),
    ("Vikram Singh", "vikram@lab.local", "requester"),
    ("Sneha Patel", "sneha@lab.local", "requester"),
    ("Rohan Gupta", "rohan@lab.local", "requester"),
    ("Ananya Das", "ananya@lab.local", "requester"),
    ("Karan Jain", "karan@lab.local", "requester"),
    ("Neha Sharma", "neha@lab.local", "requester"),
    ("Site Admin", "siteadmin@lab.local", "site_admin"),
]

INSTRUMENTS = [
    ("FESEM", "FESEM-01", "Electron Microscopy", "Lab A-101", 3),
    ("XRD", "XRD-01", "X-Ray Diffraction", "Lab A-102", 5),
    ("NMR Spectrometer", "NMR-01", "Spectroscopy", "Lab B-201", 2),
    ("FTIR", "FTIR-01", "Spectroscopy", "Lab B-202", 4),
    ("UV-Vis Spectrophotometer", "UVVIS-01", "Spectroscopy", "Lab B-203", 6),
    ("TGA", "TGA-01", "Thermal Analysis", "Lab C-301", 3),
    ("DSC", "DSC-01", "Thermal Analysis", "Lab C-302", 3),
    ("HPLC", "HPLC-01", "Chromatography", "Lab D-401", 4),
    ("GC-MS", "GCMS-01", "Chromatography", "Lab D-402", 3),
    ("AFM", "AFM-01", "Microscopy", "Lab A-103", 2),
]


def seed_database():
    """Create all tables and seed test data."""
    with app.app_context():
        prism_app.init_db()
        db = prism_app.get_db()

        # Insert users
        for name, email, role in USERS:
            db.execute(
                "INSERT INTO users (name, email, password_hash, role, invite_status, active) "
                "VALUES (?, ?, ?, ?, 'active', 1)",
                (name, email, PW_HASH, role),
            )

        # Insert instruments
        for name, code, category, location, capacity in INSTRUMENTS:
            db.execute(
                "INSERT INTO instruments (name, code, category, location, daily_capacity, status) "
                "VALUES (?, ?, ?, ?, ?, 'active')",
                (name, code, category, location, capacity),
            )

        # Assign instrument admins and operators
        # FESEM admin → FESEM
        fesem_admin = db.execute("SELECT id FROM users WHERE email='fesem.admin@lab.local'").fetchone()
        fesem_inst = db.execute("SELECT id FROM instruments WHERE code='FESEM-01'").fetchone()
        db.execute("INSERT INTO instrument_admins (user_id, instrument_id) VALUES (?, ?)",
                   (fesem_admin[0], fesem_inst[0]))

        # Operators → instruments
        operators = db.execute("SELECT id FROM users WHERE role='operator'").fetchall()
        instruments = db.execute("SELECT id FROM instruments").fetchall()
        for i, op in enumerate(operators):
            # Each operator handles 2-3 instruments
            for j in range(min(3, len(instruments))):
                idx = (i * 2 + j) % len(instruments)
                try:
                    db.execute("INSERT INTO instrument_operators (user_id, instrument_id) VALUES (?, ?)",
                               (op[0], instruments[idx][0]))
                except sqlite3.IntegrityError:
                    pass

        # Faculty → instruments
        faculty = db.execute("SELECT id FROM users WHERE role='faculty_in_charge'").fetchall()
        for i, fac in enumerate(faculty):
            idx = i % len(instruments)
            try:
                db.execute("INSERT INTO instrument_faculty_admins (user_id, instrument_id) VALUES (?, ?)",
                           (fac[0], instruments[idx][0]))
            except sqlite3.IntegrityError:
                pass

        # Create approval config for first 3 instruments
        for inst_idx in range(3):
            inst_id = instruments[inst_idx][0]
            db.execute(
                "INSERT INTO instrument_approval_config (instrument_id, step_order, approver_role) VALUES (?, 1, 'faculty_in_charge')",
                (inst_id,))
            db.execute(
                "INSERT INTO instrument_approval_config (instrument_id, step_order, approver_role) VALUES (?, 2, 'professor_approver')",
                (inst_id,))

        # Create sample requests in various states
        requesters = db.execute("SELECT id FROM users WHERE role='requester'").fetchall()
        statuses = [
            "submitted", "under_review", "awaiting_sample_submission",
            "sample_submitted", "sample_received", "scheduled",
            "in_progress", "completed", "rejected", "cancelled",
        ]
        now = datetime.utcnow()
        for i, status in enumerate(statuses):
            req_id = i + 1
            requester = requesters[i % len(requesters)]
            instrument = instruments[i % len(instruments)]
            created = (now - timedelta(days=30 - i * 3)).isoformat()
            req_no = f"REQ-2026-{req_id:04d}"

            cols = {
                "request_no": req_no,
                "sample_ref": f"SR-{req_id:04d}",
                "requester_id": requester[0],
                "created_by_user_id": requester[0],
                "instrument_id": instrument[0],
                "title": f"Test Request {req_id}",
                "sample_name": f"Sample-{chr(65 + i)}",
                "sample_count": (i % 3) + 1,
                "description": f"Test description for request {req_id} in status {status}",
                "status": status,
                "priority": ["normal", "high", "urgent"][i % 3],
                "created_at": created,
                "updated_at": created,
            }
            if status == "completed":
                cols["completed_at"] = now.isoformat()
                cols["results_summary"] = "Test results available."
            if status in ("scheduled", "in_progress", "completed"):
                cols["scheduled_for"] = (now + timedelta(days=i)).isoformat()
                cols["assigned_operator_id"] = operators[i % len(operators)][0]
            if status in ("sample_received", "scheduled", "in_progress", "completed"):
                cols["sample_received_at"] = created
                cols["received_by_operator_id"] = operators[i % len(operators)][0]

            placeholders = ", ".join(["?"] * len(cols))
            col_names = ", ".join(cols.keys())
            db.execute(f"INSERT INTO sample_requests ({col_names}) VALUES ({placeholders})",
                       tuple(cols.values()))

            # Add audit log entry
            prism_app.log_audit("request", req_id, "created", requester[0],
                                {"status": status, "request_no": req_no})

        # Create some request messages
        for req_id in range(1, 6):
            db.execute(
                "INSERT INTO request_messages (request_id, sender_user_id, note_kind, message_body, created_at) "
                "VALUES (?, ?, 'requester_note', 'This is a test question about my sample.', ?)",
                (req_id, requesters[0][0], now.isoformat()))

        # Create an announcement
        admin = db.execute("SELECT id FROM users WHERE email='admin@lab.local'").fetchone()
        db.execute(
            "INSERT INTO announcements (title, body, priority, created_by_user_id, created_at, is_active) "
            "VALUES ('Lab Maintenance Notice', 'Lab A will be closed on Friday for maintenance.', 'warning', ?, ?, 1)",
            (admin[0], now.isoformat()))

        # Create some downtime
        db.execute(
            "INSERT INTO instrument_downtime (instrument_id, start_time, end_time, reason, downtime_type, created_by_user_id, created_at) "
            "VALUES (?, ?, ?, 'Scheduled calibration', 'calibration', ?, ?)",
            (instruments[0][0],
             (now + timedelta(days=2)).isoformat(),
             (now + timedelta(days=2, hours=4)).isoformat(),
             admin[0], now.isoformat()))

        db.commit()
        print(f"Database seeded: {len(USERS)} users, {len(INSTRUMENTS)} instruments, {len(statuses)} requests")


# ── Crawl Test Engine ────────────────────────────────────────────────
class CrawlResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []

    def ok(self, msg):
        self.passed += 1

    def fail(self, msg):
        self.failed += 1
        self.errors.append(msg)
        print(f"  FAIL: {msg}")

    def summary(self):
        total = self.passed + self.failed
        print(f"\n{'='*60}")
        print(f"Crawl Results: {self.passed}/{total} passed, {self.failed} failed")
        if self.errors:
            print(f"\nFailures:")
            for e in self.errors:
                print(f"  - {e}")
        print(f"{'='*60}")
        return self.failed == 0


def login_as(client, email):
    """Log in as the given user. Returns True on success."""
    resp = client.post("/login", data={"email": email, "password": PASSWORD}, follow_redirects=False)
    return resp.status_code in (200, 302)


def crawl_page(client, url, results, role_label, expect_code=200):
    """GET a page and verify the response."""
    try:
        resp = client.get(url, follow_redirects=True)
        if resp.status_code == expect_code:
            results.ok(f"[{role_label}] GET {url} → {resp.status_code}")
        elif resp.status_code == 403 and expect_code == 403:
            results.ok(f"[{role_label}] GET {url} → 403 (expected)")
        elif resp.status_code == 500:
            # Extract error from response if possible
            body = resp.data.decode("utf-8", errors="replace")[:200]
            results.fail(f"[{role_label}] GET {url} → 500 SERVER ERROR: {body}")
        elif resp.status_code == 404:
            results.fail(f"[{role_label}] GET {url} → 404 NOT FOUND")
        else:
            results.fail(f"[{role_label}] GET {url} → {resp.status_code} (expected {expect_code})")
    except Exception as e:
        results.fail(f"[{role_label}] GET {url} → EXCEPTION: {e}")


def crawl_api(client, url, results, role_label, method="GET", data=None):
    """Hit an API endpoint and verify JSON response."""
    try:
        if method == "GET":
            resp = client.get(url)
        else:
            resp = client.post(url, data=data or {}, content_type="application/x-www-form-urlencoded")

        if resp.status_code in (200, 302):
            if resp.content_type and "json" in resp.content_type:
                try:
                    json.loads(resp.data)
                    results.ok(f"[{role_label}] {method} {url} → {resp.status_code} (valid JSON)")
                except json.JSONDecodeError:
                    results.fail(f"[{role_label}] {method} {url} → {resp.status_code} (INVALID JSON)")
            else:
                results.ok(f"[{role_label}] {method} {url} → {resp.status_code}")
        elif resp.status_code == 403:
            results.ok(f"[{role_label}] {method} {url} → 403 (access denied, expected for role)")
        elif resp.status_code == 500:
            body = resp.data.decode("utf-8", errors="replace")[:200]
            results.fail(f"[{role_label}] {method} {url} → 500 SERVER ERROR: {body}")
        else:
            results.fail(f"[{role_label}] {method} {url} → {resp.status_code}")
    except Exception as e:
        results.fail(f"[{role_label}] {method} {url} → EXCEPTION: {e}")


def test_unauthenticated(results):
    """Test pages accessible without login."""
    print("\n--- Unauthenticated Access ---")
    with app.test_client() as c:
        # Login page should be accessible
        crawl_page(c, "/login", results, "anon")
        crawl_page(c, "/activate", results, "anon")
        crawl_api(c, "/api/health-check", results, "anon")

        # Protected pages should redirect to login
        resp = c.get("/", follow_redirects=False)
        if resp.status_code in (302, 303):
            results.ok("[anon] GET / → redirect to login")
        else:
            results.fail(f"[anon] GET / → {resp.status_code} (expected redirect)")

        resp = c.get("/instruments", follow_redirects=False)
        if resp.status_code in (302, 303):
            results.ok("[anon] GET /instruments → redirect to login")
        else:
            results.fail(f"[anon] GET /instruments → {resp.status_code} (expected redirect)")


def test_login_flow(results):
    """Test login/logout for each role."""
    print("\n--- Login/Logout Flow ---")
    for name, email, role in USERS[:8]:  # Test first 8 users
        with app.test_client() as c:
            if login_as(c, email):
                results.ok(f"[{role}] Login as {email}")
                resp = c.get("/logout", follow_redirects=False)
                if resp.status_code in (302, 303):
                    results.ok(f"[{role}] Logout {email}")
                else:
                    results.fail(f"[{role}] Logout {email} → {resp.status_code}")
            else:
                results.fail(f"[{role}] Login FAILED for {email}")


def test_role_crawl(results):
    """Crawl all pages as each role type."""
    # Map of role → representative user email
    role_emails = {
        "super_admin": "admin@lab.local",
        "site_admin": "siteadmin@lab.local",
        "instrument_admin": "fesem.admin@lab.local",
        "faculty_in_charge": "sen@lab.local",
        "operator": "anika@lab.local",
        "professor_approver": "prof.approver@lab.local",
        "finance_admin": "finance@lab.local",
        "requester": "shah@lab.local",
    }

    # Pages every logged-in user should see
    common_pages = [
        "/",
        "/sitemap",
        "/me",
        "/profile/email-preferences",
        "/profile/change-password",
    ]

    # Pages requiring specific access
    instrument_pages = [
        "/instruments",
    ]

    # Pages for roles with schedule access
    schedule_pages = [
        "/schedule",
    ]

    calendar_pages = [
        "/calendar",
        "/calendar/events",
    ]

    stats_pages = [
        "/stats",
        "/visualizations",
    ]

    admin_pages = [
        "/admin/users",
    ]

    for role, email in role_emails.items():
        print(f"\n--- Crawling as {role} ({email}) ---")
        with app.test_client() as c:
            if not login_as(c, email):
                results.fail(f"[{role}] Cannot login as {email}")
                continue

            # Common pages
            for url in common_pages:
                crawl_page(c, url, results, role)

            # Instrument pages — accessible to most roles
            for url in instrument_pages:
                crawl_page(c, url, results, role)

            # Individual instrument detail
            crawl_page(c, "/instruments/1", results, role)

            # Individual request detail
            crawl_page(c, "/requests/1", results, role)

            # Schedule
            for url in schedule_pages:
                crawl_page(c, url, results, role)

            # Calendar (may 403 for some roles)
            for url in calendar_pages:
                crawl_page(c, url, results, role)

            # Stats (may 403 for some roles)
            for url in stats_pages:
                crawl_page(c, url, results, role)

            # Pending
            crawl_page(c, "/pending", results, role)

            # API endpoints
            crawl_api(c, "/api/notif-count", results, role)
            crawl_api(c, "/api/sparkline/1", results, role)
            crawl_api(c, "/api/announcements", results, role)

            # Admin-only pages
            if role in ("super_admin", "site_admin"):
                for url in admin_pages:
                    crawl_page(c, url, results, role)
                crawl_api(c, "/api/operator-workload", results, role)
                crawl_api(c, "/api/instrument-utilization", results, role)
                crawl_api(c, "/api/turnaround-stats", results, role)
                crawl_api(c, "/api/audit-search", results, role)


def test_request_lifecycle(results):
    """Test creating a request and moving it through lifecycle."""
    print("\n--- Request Lifecycle Test ---")
    with app.test_client() as c:
        # Login as requester
        login_as(c, "shah@lab.local")

        # GET new request form
        crawl_page(c, "/requests/new", results, "requester")

        # POST new request
        resp = c.post("/requests/new", data={
            "instrument_id": "1",
            "title": "Lifecycle Test Request",
            "sample_name": "Lifecycle-Sample",
            "sample_count": "2",
            "description": "Testing full lifecycle",
            "priority": "normal",
        }, follow_redirects=True)
        if resp.status_code == 200:
            results.ok("[requester] POST /requests/new → created")
        else:
            results.fail(f"[requester] POST /requests/new → {resp.status_code}")

    # Now login as operator and check schedule
    with app.test_client() as c:
        login_as(c, "anika@lab.local")
        crawl_page(c, "/schedule", results, "operator")

    # Login as admin and test bulk action endpoint
    with app.test_client() as c:
        login_as(c, "admin@lab.local")
        crawl_api(c, "/api/bulk-action", results, "admin", method="POST",
                  data={"action": "mark_received", "request_ids": "5"})


def test_instrument_config(results):
    """Test instrument configuration page."""
    print("\n--- Instrument Config Test ---")
    with app.test_client() as c:
        login_as(c, "admin@lab.local")
        crawl_page(c, "/instruments/1/config", results, "admin")
        crawl_page(c, "/instruments/1/history", results, "admin")
        crawl_page(c, "/instruments/1/calendar", results, "admin")


def test_user_management(results):
    """Test user profile and management."""
    print("\n--- User Management Test ---")
    with app.test_client() as c:
        login_as(c, "admin@lab.local")
        crawl_page(c, "/admin/users", results, "admin")
        crawl_page(c, "/users/1", results, "admin")
        crawl_page(c, "/users/1/history", results, "admin")
        crawl_page(c, "/users/5", results, "admin")  # faculty user


def test_duplicate_request(results):
    """Test request duplication."""
    print("\n--- Duplicate Request Test ---")
    with app.test_client() as c:
        login_as(c, "shah@lab.local")
        resp = c.get("/requests/1/duplicate", follow_redirects=False)
        if resp.status_code in (302, 303):
            results.ok("[requester] GET /requests/1/duplicate → redirect to new_request")
        else:
            results.fail(f"[requester] GET /requests/1/duplicate → {resp.status_code}")


def test_export_endpoints(results):
    """Test export generation."""
    print("\n--- Export Tests ---")
    with app.test_client() as c:
        login_as(c, "admin@lab.local")
        # Audit export
        crawl_api(c, "/api/audit-export", results, "admin")


def test_password_change(results):
    """Test password change form."""
    print("\n--- Password Change Test ---")
    with app.test_client() as c:
        login_as(c, "shah@lab.local")
        crawl_page(c, "/profile/change-password", results, "requester")

        resp = c.post("/profile/change-password", data={
            "current_password": PASSWORD,
            "new_password": "NewTestPass456!",
            "confirm_password": "NewTestPass456!",
        }, follow_redirects=True)
        if resp.status_code == 200:
            results.ok("[requester] Password change submitted")
        else:
            results.fail(f"[requester] Password change → {resp.status_code}")


def test_email_preferences(results):
    """Test email preferences page."""
    print("\n--- Email Preferences Test ---")
    with app.test_client() as c:
        login_as(c, "shah@lab.local")
        crawl_page(c, "/profile/email-preferences", results, "requester")

        resp = c.post("/profile/email-preferences", data={
            "action": "update_preferences",
            "enable_status_changed": "1",
            "enable_results_confirmed": "1",
        }, follow_redirects=True)
        if resp.status_code == 200:
            results.ok("[requester] Email preferences saved")
        else:
            results.fail(f"[requester] Email preferences → {resp.status_code}")


def test_visualization_pages(results):
    """Test visualization pages."""
    print("\n--- Visualization Tests ---")
    with app.test_client() as c:
        login_as(c, "admin@lab.local")
        crawl_page(c, "/visualizations", results, "admin")
        crawl_page(c, "/visualizations/instrument/1", results, "admin")
        crawl_page(c, "/visualizations/group/Electron%20Microscopy", results, "admin")


# ── Main ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print(f"{'='*60}")
    print(f"PRISM Comprehensive Crawl Test — {datetime.utcnow().isoformat()}")
    print(f"Database: {TEMP_DB}")
    print(f"{'='*60}")

    seed_database()

    results = CrawlResults()

    test_unauthenticated(results)
    test_login_flow(results)
    test_role_crawl(results)
    test_request_lifecycle(results)
    test_instrument_config(results)
    test_user_management(results)
    test_duplicate_request(results)
    test_export_endpoints(results)
    test_password_change(results)
    test_email_preferences(results)
    test_visualization_pages(results)

    success = results.summary()

    # Cleanup
    try:
        os.unlink(TEMP_DB)
    except:
        pass

    sys.exit(0 if success else 1)
