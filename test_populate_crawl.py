#!/usr/bin/env python3
"""PRISM Data-Populating Crawl Test — 500 realistic user interactions.

Starts from a BLANK database, builds everything through the UI:
  - Creates users via admin panel
  - Creates instruments
  - Submits requests, moves them through lifecycle
  - Posts messages, browses pages, changes passwords
  - Logs EVERY action + exception + system state to crawl_500_log.json

Every step prints a real-time counter: [042/500]
Every exception is captured with full traceback + system state snapshot.

Run:  python3 test_populate_crawl.py
"""
from __future__ import annotations

import json
import os
import random
import sqlite3
import sys
import tempfile
import traceback
from collections import Counter, defaultdict
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

BASE_DIR = Path(__file__).resolve().parent
LOG_PATH = BASE_DIR / "crawl_500_log.json"
REPORT_PATH = BASE_DIR / "crawl_500_report.txt"

PASSWORD = "SimplePass123"
PW_HASH = generate_password_hash(PASSWORD, method="pbkdf2:sha256")
TOTAL_STEPS = 500

# ── Personas to create via UI ────────────────────────────────────────
PERSONAS = [
    # These will be created through the admin panel, not seeded
    ("Dean Kumar", "dean@lab.local", "super_admin"),
    ("Site Admin", "siteadmin@lab.local", "site_admin"),
    ("FESEM Admin", "fesem.admin@lab.local", "instrument_admin"),
    ("XRD Admin", "xrd.admin@lab.local", "instrument_admin"),
    ("NMR Admin", "nmr.admin@lab.local", "instrument_admin"),
    ("Dr. Sen", "sen@lab.local", "faculty_in_charge"),
    ("Dr. Kondhalkar", "kondhalkar@lab.local", "faculty_in_charge"),
    ("Dr. Patil", "patil@lab.local", "faculty_in_charge"),
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
]

INSTRUMENTS_TO_CREATE = [
    {"name": "FESEM", "code": "FESEM-01", "category": "Electron Microscopy", "location": "Lab A-101", "daily_capacity": "3"},
    {"name": "XRD", "code": "XRD-01", "category": "X-Ray Diffraction", "location": "Lab A-102", "daily_capacity": "5"},
    {"name": "NMR Spectrometer", "code": "NMR-01", "category": "Spectroscopy", "location": "Lab B-201", "daily_capacity": "2"},
    {"name": "FTIR", "code": "FTIR-01", "category": "Spectroscopy", "location": "Lab B-202", "daily_capacity": "4"},
    {"name": "UV-Vis Spectrophotometer", "code": "UVVIS-01", "category": "Spectroscopy", "location": "Lab B-203", "daily_capacity": "6"},
    {"name": "TGA", "code": "TGA-01", "category": "Thermal Analysis", "location": "Lab C-301", "daily_capacity": "3"},
    {"name": "DSC", "code": "DSC-01", "category": "Thermal Analysis", "location": "Lab C-302", "daily_capacity": "3"},
    {"name": "HPLC", "code": "HPLC-01", "category": "Chromatography", "location": "Lab D-401", "daily_capacity": "4"},
    {"name": "GC-MS", "code": "GCMS-01", "category": "Chromatography", "location": "Lab D-402", "daily_capacity": "3"},
    {"name": "AFM", "code": "AFM-01", "category": "Microscopy", "location": "Lab A-103", "daily_capacity": "2"},
]

SAMPLE_NAMES = [
    "TiO2 Nanoparticles", "Graphene Oxide Flakes", "ZnO Thin Film",
    "Carbon Nanotube Bundle", "Polymer Blend A12", "Si Wafer #7",
    "Biochar Sample", "Alumina Powder", "Copper Nanocomposite",
    "Perovskite Film", "Gold Nanorod Sol", "Chitosan Scaffold",
    "Ceramic Pellet B3", "Iron Oxide Ferrofluid", "PDMS Membrane",
    "Zeolite Y Crystals", "Calcium Phosphate", "Graphite Electrode",
    "MoS2 Monolayer", "PLA Filament Cross-Section",
]

DESCRIPTIONS = [
    "Characterize surface morphology and particle size distribution.",
    "Determine crystal structure and phase purity.",
    "Measure proton NMR spectrum for structural confirmation.",
    "Analyze functional groups and confirm synthesis.",
    "Determine UV absorption spectrum and band gap.",
    "Thermal decomposition analysis under nitrogen atmosphere.",
    "Measure glass transition and melting temperatures.",
    "Separate and quantify active pharmaceutical ingredient.",
    "Identify volatile organic compounds in the sample.",
    "Topographic scan at atomic resolution.",
]

MESSAGES = [
    "Could you provide more detail on the sample preparation?",
    "When will the results be available?",
    "Sample has been prepared according to protocol SOP-42.",
    "Please ensure the sample is labeled correctly.",
    "Estimated turnaround: 3 business days.",
    "Can we prioritize this request?",
    "Operator notes: calibration verified before run.",
    "Faculty reviewed — no issues found.",
    "Finance clearance obtained for external sample.",
    "Results uploaded. Please check the attachments.",
    "Need to reschedule due to instrument maintenance.",
    "Sample quality check passed.",
    "Requesting extension on deadline.",
    "Updated measurement parameters as discussed.",
    "Cross-referencing with previous batch results.",
]


# ── Real-time Counter ────────────────────────────────────────────────
class StepCounter:
    def __init__(self, total):
        self.current = 0
        self.total = total

    def tick(self, action_label, role=""):
        self.current += 1
        pct = self.current / self.total * 100
        bar_len = 30
        filled = int(bar_len * self.current / self.total)
        bar = "█" * filled + "░" * (bar_len - filled)
        role_str = f" [{role}]" if role else ""
        print(f"\r  [{self.current:03d}/{self.total}] {bar} {pct:5.1f}%{role_str} {action_label[:50]:<50}", end="", flush=True)

    def newline(self):
        print()


# ── Crawl Logger ─────────────────────────────────────────────────────
class CrawlLog:
    def __init__(self):
        self.entries = []
        self.status_counts = Counter()
        self.action_counts = Counter()
        self.route_coverage = set()
        self.role_action_counts = defaultdict(Counter)
        self.exceptions = []

    def snapshot_state(self):
        """Capture current DB state for debugging."""
        try:
            with flask_app.app_context():
                db = prism_app.get_db()
                users = db.execute("SELECT COUNT(*) FROM users").fetchone()[0]
                instruments = db.execute("SELECT COUNT(*) FROM instruments").fetchone()[0]
                try:
                    requests = db.execute("SELECT COUNT(*) FROM sample_requests").fetchone()[0]
                except Exception:
                    requests = 0
                try:
                    messages = db.execute("SELECT COUNT(*) FROM request_messages").fetchone()[0]
                except Exception:
                    messages = 0
                try:
                    statuses = dict(db.execute("SELECT status, COUNT(*) FROM sample_requests GROUP BY status").fetchall())
                except Exception:
                    statuses = {}
                return {
                    "users": users,
                    "instruments": instruments,
                    "requests": requests,
                    "messages": messages,
                    "request_statuses": statuses,
                }
        except Exception as e:
            return {"error": str(e)}

    def record(self, step, role, method, url, action_label, status, detail="",
               post_data=None, exception_info=None):
        import re
        route_key = re.sub(r'/\d+', '/<id>', url.split('?')[0])

        entry = {
            "step": step,
            "role": role,
            "method": method,
            "url": url,
            "route": route_key,
            "action": action_label,
            "status": status,
            "detail": detail[:500],
            "post_data": post_data,
            "ts": datetime.utcnow().isoformat(),
        }

        if exception_info:
            entry["exception"] = exception_info
            entry["system_state"] = self.snapshot_state()
            self.exceptions.append(entry)

        if status >= 500 or exception_info:
            entry["system_state"] = entry.get("system_state") or self.snapshot_state()

        self.entries.append(entry)
        self.status_counts[status] += 1
        self.action_counts[action_label] += 1
        self.role_action_counts[role][action_label] += 1
        self.route_coverage.add(route_key)

    def save(self):
        ok = sum(1 for e in self.entries if e["status"] < 400)
        warn = sum(1 for e in self.entries if 400 <= e["status"] < 500)
        err = sum(1 for e in self.entries if e["status"] >= 500)
        errors_list = [e for e in self.entries if e["status"] >= 400]

        with open(LOG_PATH, "w") as f:
            json.dump({
                "meta": {
                    "timestamp": datetime.utcnow().isoformat(),
                    "total_steps": len(self.entries),
                    "ok": ok, "client_errors_4xx": warn, "server_errors_5xx": err,
                    "exceptions": len(self.exceptions),
                    "unique_routes": len(self.route_coverage),
                    "action_types": len(self.action_counts),
                    "final_state": self.snapshot_state(),
                },
                "status_distribution": dict(self.status_counts),
                "action_distribution": dict(self.action_counts.most_common()),
                "route_coverage": sorted(self.route_coverage),
                "exceptions": self.exceptions,
                "errors": errors_list,
                "entries": self.entries,
            }, f, indent=2)

        lines = []
        lines.append("=" * 70)
        lines.append("PRISM 500-ACTION POPULATE CRAWL REPORT")
        lines.append(f"Generated: {datetime.utcnow().isoformat()}")
        lines.append("=" * 70)
        lines.append(f"Total actions:      {len(self.entries)}")
        lines.append(f"  OK (2xx/3xx):     {ok}")
        lines.append(f"  Client err (4xx): {warn}")
        lines.append(f"  Server err (5xx): {err}")
        lines.append(f"  Exceptions:       {len(self.exceptions)}")
        lines.append(f"Unique routes:      {len(self.route_coverage)}")
        lines.append(f"Action types:       {len(self.action_counts)}")
        lines.append("")

        final = self.snapshot_state()
        lines.append("FINAL DATABASE STATE:")
        for k, v in final.items():
            lines.append(f"  {k}: {v}")
        lines.append("")

        lines.append("STATUS DISTRIBUTION:")
        for code, count in sorted(self.status_counts.items()):
            pct = count / max(len(self.entries), 1) * 100
            bar = "█" * int(pct / 2)
            lines.append(f"  {code}: {count:>5} ({pct:5.1f}%) {bar}")
        lines.append("")

        lines.append("TOP ACTIONS:")
        for action, count in self.action_counts.most_common(25):
            lines.append(f"  {action:<45} {count:>5}")
        lines.append("")

        lines.append("ACTIONS BY ROLE:")
        for role in sorted(self.role_action_counts.keys()):
            total = sum(self.role_action_counts[role].values())
            lines.append(f"  {role:<25} {total:>5} actions")
        lines.append("")

        lines.append(f"ROUTE COVERAGE ({len(self.route_coverage)} unique):")
        for r in sorted(self.route_coverage):
            lines.append(f"  {r}")

        if errors_list:
            lines.append("")
            lines.append("!" * 70)
            lines.append(f"ALL ERRORS ({len(errors_list)}):")
            lines.append("!" * 70)
            seen = set()
            for e in errors_list:
                key = f"{e['status']}|{e['route']}|{e['role']}|{e['action']}"
                if key in seen:
                    continue
                seen.add(key)
                lines.append(f"  [{e['step']:03d}] [{e['role']}] {e['method']} {e['url']} -> {e['status']}")
                lines.append(f"    Action: {e['action']}")
                if e.get('detail'):
                    lines.append(f"    Detail: {e['detail'][:200]}")
                if e.get('exception'):
                    lines.append(f"    Exception: {e['exception']['type']}: {e['exception']['message'][:200]}")
                if e.get('system_state'):
                    lines.append(f"    DB State: {json.dumps(e['system_state'], default=str)[:200]}")
                if e.get('post_data'):
                    lines.append(f"    POST Data: {json.dumps(e['post_data'], default=str)[:200]}")
                lines.append("")
            dups = len(errors_list) - len(seen)
            if dups > 0:
                lines.append(f"  ({dups} duplicate errors suppressed)")
        else:
            lines.append("")
            lines.append("=" * 70)
            lines.append("ZERO ERRORS — ALL ACTIONS SUCCEEDED")
            lines.append("=" * 70)

        if self.exceptions:
            lines.append("")
            lines.append("!" * 70)
            lines.append(f"EXCEPTIONS ({len(self.exceptions)}):")
            lines.append("!" * 70)
            for e in self.exceptions:
                lines.append(f"  [{e['step']:03d}] [{e['role']}] {e['action']}")
                lines.append(f"    {e['exception']['type']}: {e['exception']['message'][:300]}")
                if e['exception'].get('traceback'):
                    for tb_line in e['exception']['traceback'][-5:]:
                        lines.append(f"    {tb_line.rstrip()}")
                lines.append("")

        with open(REPORT_PATH, "w") as f:
            f.write("\n".join(lines))


# ── HTTP Helpers ─────────────────────────────────────────────────────
def do_get(client, url):
    try:
        resp = client.get(url, follow_redirects=True)
        return resp.status_code, resp.data.decode("utf-8", errors="replace")[:500], None
    except Exception as e:
        tb = traceback.format_exception(type(e), e, e.__traceback__)
        return 999, "", {"type": type(e).__name__, "message": str(e), "traceback": tb}


def do_post(client, url, data):
    try:
        resp = client.post(url, data=data, content_type="application/x-www-form-urlencoded", follow_redirects=True)
        return resp.status_code, resp.data.decode("utf-8", errors="replace")[:500], None
    except Exception as e:
        tb = traceback.format_exception(type(e), e, e.__traceback__)
        return 999, "", {"type": type(e).__name__, "message": str(e), "traceback": tb}


def login_as(client, email):
    try:
        resp = client.post("/login", data={"email": email, "password": PASSWORD}, follow_redirects=False)
        return resp.status_code in (200, 302)
    except Exception:
        return False


# ── Action Runner ────────────────────────────────────────────────────
class ActionRunner:
    def __init__(self, log: CrawlLog, counter: StepCounter):
        self.log = log
        self.counter = counter
        self.step = 0
        self.created_request_ids = []
        self.request_statuses = {}
        self.created_user_emails = {"admin@lab.local": "super_admin"}
        self.created_instrument_ids = []

    def _step(self, role, method, url, data, action_label):
        self.step += 1
        self.counter.tick(action_label, role)
        with flask_app.test_client() as c:
            # Login first (unless anonymous action)
            email = None
            if role != "anonymous":
                # Find an email for this role
                email = self._email_for_role(role)
                if email and not login_as(c, email):
                    self.log.record(self.step, role, method, url, action_label, 401,
                                    f"Login failed for {email}")
                    return 401, ""

            if method == "GET":
                status, detail, exc = do_get(c, url)
            else:
                status, detail, exc = do_post(c, url, data)

            self.log.record(self.step, role, method, url, action_label, status, detail,
                            post_data=data, exception_info=exc)
            return status, detail

    def _email_for_role(self, role):
        """Get a known email for the given role."""
        for email, r in self.created_user_emails.items():
            if r == role:
                return email
        return None

    def _random_email_for_role(self, role):
        """Get a random email for the given role."""
        emails = [e for e, r in self.created_user_emails.items() if r == role]
        return random.choice(emails) if emails else None

    def get(self, role, url, label):
        return self._step(role, "GET", url, None, label)

    def post(self, role, url, data, label):
        return self._step(role, "POST", url, data, label)

    # ── Bootstrap: Create users via admin panel ──────────────────────

    def create_user_via_admin(self, name, email, role):
        """Admin creates a user through /admin/users POST."""
        data = {
            "action": "create_user",
            "name": name,
            "email": email,
            "password": PASSWORD,
            "role": role,
        }
        status, _ = self.post("super_admin", "/admin/users", data, f"create_user_{role}")
        if status < 400:
            self.created_user_emails[email] = role
        return status

    def create_instrument_via_ui(self, inst_data):
        """Admin creates an instrument through /instruments POST."""
        data = {
            "action": "create_instrument",
            "new_name": inst_data["name"],
            "new_code": inst_data["code"],
            "new_category": inst_data["category"],
            "new_location": inst_data["location"],
            "new_daily_capacity": inst_data["daily_capacity"],
        }
        status, _ = self.post("super_admin", "/instruments", data, f"create_instrument_{inst_data['code']}")
        if status < 400:
            with flask_app.app_context():
                row = prism_app.query_one("SELECT id FROM instruments ORDER BY id DESC LIMIT 1")
                if row:
                    self.created_instrument_ids.append(row["id"])
        return status

    # ── Request lifecycle ────────────────────────────────────────────

    def create_request(self, email=None):
        if not email:
            email = self._random_email_for_role("requester")
        if not email or not self.created_instrument_ids:
            return 0
        inst_id = random.choice(self.created_instrument_ids)
        sample = random.choice(SAMPLE_NAMES)
        data = {
            "instrument_id": str(inst_id),
            "title": f"{sample} Analysis - {random.randint(1000, 9999)}",
            "sample_name": sample,
            "sample_count": str(random.randint(1, 5)),
            "description": random.choice(DESCRIPTIONS),
            "priority": random.choice(["normal", "normal", "high", "urgent"]),
            "sample_origin": random.choice(["internal", "external"]),
        }
        # Need to login as this specific user
        self.step += 1
        self.counter.tick("create_request", "requester")
        with flask_app.test_client() as c:
            login_as(c, email)
            status, detail, exc = do_post(c, "/requests/new", data)
            self.log.record(self.step, "requester", "POST", "/requests/new",
                            "create_request", status, detail, post_data=data, exception_info=exc)
            if status < 400:
                with flask_app.app_context():
                    row = prism_app.query_one("SELECT id FROM sample_requests ORDER BY id DESC LIMIT 1")
                    if row:
                        self.created_request_ids.append(row["id"])
                        self.request_statuses[row["id"]] = "submitted"
            return status

    def post_message(self, role, request_id):
        email = self._random_email_for_role(role)
        if not email:
            return 0
        data = {
            "action": "post_message",
            "message_body": random.choice(MESSAGES),
        }
        self.step += 1
        self.counter.tick("post_message", role)
        with flask_app.test_client() as c:
            login_as(c, email)
            status, detail, exc = do_post(c, f"/requests/{request_id}", data)
            self.log.record(self.step, role, "POST", f"/requests/{request_id}",
                            "post_message", status, detail, post_data=data, exception_info=exc)
            return status

    def mark_sample_submitted(self, request_id):
        with flask_app.app_context():
            row = prism_app.query_one("SELECT requester_id FROM sample_requests WHERE id = ?", (request_id,))
            if not row:
                return 0
            user_row = prism_app.query_one("SELECT email FROM users WHERE id = ?", (row["requester_id"],))
            if not user_row:
                return 0
            email = user_row["email"]
        data = {
            "action": "mark_sample_submitted",
            "sample_dropoff_note": "Dropped at front desk, Room A-101.",
        }
        self.step += 1
        self.counter.tick("mark_sample_submitted", "requester")
        with flask_app.test_client() as c:
            login_as(c, email)
            status, detail, exc = do_post(c, f"/requests/{request_id}", data)
            self.log.record(self.step, "requester", "POST", f"/requests/{request_id}",
                            "mark_sample_submitted", status, detail, post_data=data, exception_info=exc)
            if status < 400:
                self.request_statuses[request_id] = "sample_submitted"
            return status

    def mark_sample_received(self, request_id):
        email = self._random_email_for_role("operator")
        if not email:
            return 0
        data = {"action": "mark_sample_received"}
        self.step += 1
        self.counter.tick("mark_sample_received", "operator")
        with flask_app.test_client() as c:
            login_as(c, email)
            status, detail, exc = do_post(c, f"/requests/{request_id}", data)
            self.log.record(self.step, "operator", "POST", f"/requests/{request_id}",
                            "mark_sample_received", status, detail, post_data=data, exception_info=exc)
            if status < 400:
                self.request_statuses[request_id] = "sample_received"
            return status

    def schedule_request(self, request_id):
        email = self._random_email_for_role("operator")
        if not email:
            return 0
        future = (datetime.utcnow() + timedelta(days=random.randint(1, 14))).isoformat(timespec="minutes")
        data = {"action": "schedule", "scheduled_for": future}
        self.step += 1
        self.counter.tick("schedule_request", "operator")
        with flask_app.test_client() as c:
            login_as(c, email)
            status, detail, exc = do_post(c, f"/requests/{request_id}", data)
            self.log.record(self.step, "operator", "POST", f"/requests/{request_id}",
                            "schedule_request", status, detail, post_data=data, exception_info=exc)
            if status < 400:
                self.request_statuses[request_id] = "scheduled"
            return status

    def start_request(self, request_id):
        email = self._random_email_for_role("operator")
        if not email:
            return 0
        data = {"action": "start"}
        self.step += 1
        self.counter.tick("start_request", "operator")
        with flask_app.test_client() as c:
            login_as(c, email)
            status, detail, exc = do_post(c, f"/requests/{request_id}", data)
            self.log.record(self.step, "operator", "POST", f"/requests/{request_id}",
                            "start_request", status, detail, post_data=data, exception_info=exc)
            if status < 400:
                self.request_statuses[request_id] = "in_progress"
            return status

    def complete_request(self, request_id):
        email = self._random_email_for_role("operator")
        if not email:
            return 0
        data = {
            "action": "complete",
            "results_summary": f"Analysis complete. {random.choice(DESCRIPTIONS)}",
        }
        self.step += 1
        self.counter.tick("complete_request", "operator")
        with flask_app.test_client() as c:
            login_as(c, email)
            status, detail, exc = do_post(c, f"/requests/{request_id}", data)
            self.log.record(self.step, "operator", "POST", f"/requests/{request_id}",
                            "complete_request", status, detail, post_data=data, exception_info=exc)
            if status < 400:
                self.request_statuses[request_id] = "completed"
            return status

    def admin_set_status(self, request_id, new_status):
        data = {
            "action": "admin_set_status",
            "new_status": new_status,
            "reason": f"Admin override to {new_status} for testing.",
        }
        status, _ = self.post("super_admin", f"/requests/{request_id}", data, f"admin_set_{new_status}")
        if status < 400:
            self.request_statuses[request_id] = new_status
        return status

    def ids_in_status(self, *statuses):
        return [rid for rid, st in self.request_statuses.items() if st in statuses]

    def health_check(self):
        self.step += 1
        self.counter.tick("health_check", "anonymous")
        with flask_app.test_client() as c:
            status, detail, exc = do_get(c, "/api/health-check")
            self.log.record(self.step, "anonymous", "GET", "/api/health-check",
                            "health_check", status, detail, exception_info=exc)
            return status


# ── Main Crawl Sequence ──────────────────────────────────────────────
def run_500_crawl():
    log = CrawlLog()
    counter = StepCounter(TOTAL_STEPS)
    runner = ActionRunner(log, counter)

    print("\n╔══════════════════════════════════════════════════════╗")
    print("║  PHASE 0: Bootstrap — blank database, create admin  ║")
    print("╚══════════════════════════════════════════════════════╝")

    # Init DB and create bootstrap admin
    with flask_app.app_context():
        prism_app.init_db()
        db = prism_app.get_db()
        db.execute(
            "INSERT OR IGNORE INTO users (name, email, password_hash, role, invite_status, active) "
            "VALUES (?, ?, ?, 'super_admin', 'active', 1)",
            ("Admin Owner", "admin@lab.local", PW_HASH),
        )
        db.commit()

    # Health check on empty system
    runner.health_check()

    # Admin browses empty dashboard
    runner.get("super_admin", "/", "browse_empty_dashboard")
    runner.get("super_admin", "/instruments", "browse_empty_instruments")
    runner.get("super_admin", "/admin/users", "browse_admin_users_empty")

    print("\n╔══════════════════════════════════════════════════════╗")
    print("║  PHASE 1: Admin creates users via /admin/users      ║")
    print("╚══════════════════════════════════════════════════════╝")

    for name, email, role in PERSONAS:
        runner.create_user_via_admin(name, email, role)

    print("\n╔══════════════════════════════════════════════════════╗")
    print("║  PHASE 2: Admin creates instruments via /instruments ║")
    print("╚══════════════════════════════════════════════════════╝")

    for inst in INSTRUMENTS_TO_CREATE:
        runner.create_instrument_via_ui(inst)

    # Assign operators/admins via SQL (UI doesn't have bulk assignment)
    with flask_app.app_context():
        db = prism_app.get_db()
        operators = db.execute("SELECT id FROM users WHERE role='operator'").fetchall()
        instruments = db.execute("SELECT id FROM instruments").fetchall()
        for i, op in enumerate(operators):
            for j in range(3):
                idx = (i * 2 + j) % len(instruments)
                try:
                    db.execute("INSERT INTO instrument_operators (user_id, instrument_id) VALUES (?, ?)",
                               (op[0], instruments[idx][0]))
                except sqlite3.IntegrityError:
                    pass
        iadmins = db.execute("SELECT id FROM users WHERE role='instrument_admin'").fetchall()
        for i, ia in enumerate(iadmins):
            for j in range(2):
                idx = (i * 2 + j) % len(instruments)
                try:
                    db.execute("INSERT INTO instrument_admins (user_id, instrument_id) VALUES (?, ?)",
                               (ia[0], instruments[idx][0]))
                except sqlite3.IntegrityError:
                    pass
        faculty = db.execute("SELECT id FROM users WHERE role='faculty_in_charge'").fetchall()
        for i, fac in enumerate(faculty):
            for j in range(2):
                idx = (i * 2 + j) % len(instruments)
                try:
                    db.execute("INSERT INTO instrument_faculty_admins (user_id, instrument_id) VALUES (?, ?)",
                               (fac[0], instruments[idx][0]))
                except sqlite3.IntegrityError:
                    pass
        db.commit()

    print("\n╔══════════════════════════════════════════════════════╗")
    print("║  PHASE 3: Every role browses (verify access)        ║")
    print("╚══════════════════════════════════════════════════════╝")

    all_roles = ["super_admin", "site_admin", "instrument_admin", "faculty_in_charge",
                 "operator", "professor_approver", "finance_admin", "requester"]
    for role in all_roles:
        runner.get(role, "/", f"browse_dashboard_{role}")
    for role in all_roles[:6]:
        runner.get(role, "/instruments", f"browse_instruments_{role}")
    for role in ["super_admin", "operator", "instrument_admin"]:
        runner.get(role, "/schedule", f"browse_schedule_{role}")

    runner.get("super_admin", "/sitemap", "browse_sitemap")
    runner.get("super_admin", "/docs", "browse_docs")
    runner.get("super_admin", "/stats", "browse_stats")
    runner.get("super_admin", "/calendar", "browse_calendar")

    print("\n╔══════════════════════════════════════════════════════╗")
    print("║  PHASE 4: Requesters create 50 sample requests      ║")
    print("╚══════════════════════════════════════════════════════╝")

    for _ in range(50):
        runner.create_request()

    print("\n╔══════════════════════════════════════════════════════╗")
    print("║  PHASE 5: Messages + browsing (30 steps)            ║")
    print("╚══════════════════════════════════════════════════════╝")

    for _ in range(10):
        if runner.created_request_ids:
            rid = random.choice(runner.created_request_ids)
            runner.post_message("requester", rid)
    for _ in range(10):
        if runner.created_request_ids:
            rid = random.choice(runner.created_request_ids)
            runner.post_message("operator", rid)
    for _ in range(5):
        if runner.created_request_ids:
            rid = random.choice(runner.created_request_ids)
            runner.post_message("super_admin", rid)
    for _ in range(5):
        if runner.created_request_ids:
            rid = random.choice(runner.created_request_ids)
            runner.get("requester", f"/requests/{rid}", "browse_request_detail")

    print("\n╔══════════════════════════════════════════════════════╗")
    print("║  PHASE 6: Sample submission lifecycle (40 steps)    ║")
    print("╚══════════════════════════════════════════════════════╝")

    submitted = runner.ids_in_status("submitted")
    random.shuffle(submitted)
    for rid in submitted[:35]:
        runner.mark_sample_submitted(rid)

    print("\n╔══════════════════════════════════════════════════════╗")
    print("║  PHASE 7: Operators receive samples (30 steps)      ║")
    print("╚══════════════════════════════════════════════════════╝")

    sample_submitted = runner.ids_in_status("sample_submitted")
    random.shuffle(sample_submitted)
    for rid in sample_submitted[:28]:
        runner.mark_sample_received(rid)

    print("\n╔══════════════════════════════════════════════════════╗")
    print("║  PHASE 8: Schedule requests (25 steps)              ║")
    print("╚══════════════════════════════════════════════════════╝")

    received = runner.ids_in_status("sample_received")
    random.shuffle(received)
    for rid in received[:22]:
        runner.schedule_request(rid)

    print("\n╔══════════════════════════════════════════════════════╗")
    print("║  PHASE 9: Start requests (20 steps)                ║")
    print("╚══════════════════════════════════════════════════════╝")

    scheduled = runner.ids_in_status("scheduled")
    random.shuffle(scheduled)
    for rid in scheduled[:18]:
        runner.start_request(rid)

    print("\n╔══════════════════════════════════════════════════════╗")
    print("║  PHASE 10: Complete requests (15 steps)             ║")
    print("╚══════════════════════════════════════════════════════╝")

    in_progress = runner.ids_in_status("in_progress")
    random.shuffle(in_progress)
    for rid in in_progress[:14]:
        runner.complete_request(rid)

    print("\n╔══════════════════════════════════════════════════════╗")
    print("║  PHASE 11: Admin overrides + rejections (15 steps)  ║")
    print("╚══════════════════════════════════════════════════════╝")

    still_submitted = runner.ids_in_status("submitted")
    for rid in still_submitted[:5]:
        runner.admin_set_status(rid, "under_review")
    under_review = runner.ids_in_status("under_review")
    for rid in under_review[:3]:
        runner.admin_set_status(rid, "awaiting_sample_submission")
    can_reject = runner.ids_in_status("submitted", "under_review")
    for rid in can_reject[:3]:
        runner.admin_set_status(rid, "rejected")
    can_cancel = runner.ids_in_status("submitted")
    for rid in can_cancel[:2]:
        runner.admin_set_status(rid, "cancelled")

    print("\n╔══════════════════════════════════════════════════════╗")
    print("║  PHASE 12: Deep browsing — instruments, viz, stats  ║")
    print("╚══════════════════════════════════════════════════════╝")

    for i in runner.created_instrument_ids[:5]:
        runner.get("super_admin", f"/instruments/{i}", f"browse_instrument_{i}")
        runner.get("super_admin", f"/instruments/{i}/history", f"browse_inst_history_{i}")
    runner.get("super_admin", "/visualizations", "browse_visualizations")
    runner.get("super_admin", "/visualizations/instrument/1", "browse_viz_inst_1")
    runner.get("super_admin", "/visualizations/group/Spectroscopy", "browse_viz_spectroscopy")
    for uid in range(1, 5):
        runner.get("super_admin", f"/users/{uid}", f"browse_user_{uid}")

    print("\n╔══════════════════════════════════════════════════════╗")
    print("║  PHASE 13: Duplicate + change password + misc       ║")
    print("╚══════════════════════════════════════════════════════╝")

    if runner.created_request_ids:
        for _ in range(4):
            rid = random.choice(runner.created_request_ids)
            runner.get("requester", f"/requests/{rid}/duplicate", "duplicate_request")

    runner.post("requester", "/profile/change-password", {
        "current_password": PASSWORD, "new_password": PASSWORD, "confirm_password": PASSWORD,
    }, "change_password")
    runner.post("operator", "/profile/change-password", {
        "current_password": PASSWORD, "new_password": PASSWORD, "confirm_password": PASSWORD,
    }, "change_password")
    runner.get("super_admin", "/me", "browse_my_profile")
    runner.get("super_admin", "/my/history", "browse_my_history")
    runner.get("super_admin", "/history/processed", "browse_processed_history")
    runner.health_check()

    print("\n╔══════════════════════════════════════════════════════╗")
    print("║  PHASE 14: Fill remaining steps to 500              ║")
    print("╚══════════════════════════════════════════════════════╝")

    browse_targets = [
        "/", "/instruments", "/schedule", "/sitemap", "/docs",
        "/calendar", "/stats", "/admin/users",
    ]

    while runner.step < TOTAL_STEPS:
        action = random.choice(["browse", "browse", "message", "detail", "create_req"])
        role = random.choice(all_roles)

        if action == "browse":
            page = random.choice(browse_targets)
            runner.get(role, page, "random_browse")
        elif action == "message" and runner.created_request_ids:
            rid = random.choice(runner.created_request_ids)
            runner.post_message(role, rid)
        elif action == "detail" and runner.created_request_ids:
            rid = random.choice(runner.created_request_ids)
            runner.get(role, f"/requests/{rid}", "random_request_detail")
        elif action == "create_req":
            runner.create_request()
        else:
            runner.get(role, "/", "random_browse_fallback")

    counter.newline()
    return log


# ── Main ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import time as _time

    print("=" * 70)
    print("PRISM 500-Action Populate Crawl Test (from BLANK database)")
    print(f"Database: {TEMP_DB}")
    print(f"Steps:   {TOTAL_STEPS}")
    print("=" * 70)

    t0 = _time.perf_counter()
    log = run_500_crawl()
    elapsed = _time.perf_counter() - t0

    print(f"\n{'=' * 70}")
    print("Saving logs...")
    log.save()

    ok = sum(1 for e in log.entries if e["status"] < 400)
    warn = sum(1 for e in log.entries if 400 <= e["status"] < 500)
    err = sum(1 for e in log.entries if e["status"] >= 500)
    exc_count = len(log.exceptions)
    total = len(log.entries)
    steps_per_sec = total / elapsed if elapsed > 0 else 0

    print(f"\n  ┌─────────────────────────────────────────────┐")
    print(f"  │ CRAWL COMPLETE                               │")
    print(f"  ├─────────────────────────────────────────────┤")
    print(f"  │ Total time:     {elapsed:>8.2f}s                    │")
    print(f"  │ Steps/second:   {steps_per_sec:>8.1f}                    │")
    print(f"  │ Total actions:  {total:>8}                    │")
    print(f"  │ OK (2xx/3xx):   {ok:>8}                    │")
    print(f"  │ Client (4xx):   {warn:>8}                    │")
    print(f"  │ Server (5xx):   {err:>8}                    │")
    print(f"  │ Exceptions:     {exc_count:>8}                    │")
    print(f"  └─────────────────────────────────────────────┘")
    print(f"  Log:     {LOG_PATH}")
    print(f"  Report:  {REPORT_PATH}")

    state = log.snapshot_state()
    print(f"\n  FINAL DB STATE:")
    for k, v in state.items():
        print(f"    {k}: {v}")

    print("=" * 70)

    # Cleanup temp DB
    try:
        os.unlink(TEMP_DB)
    except Exception:
        pass

    sys.exit(0 if err == 0 else 1)
