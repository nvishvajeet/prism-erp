#!/usr/bin/env python3
"""MCMC Random Walk Lifecycle Crawler for PRISM Lab Scheduler.

═══════════════════════════════════════════════════════════════════════
THEORY
═══════════════════════════════════════════════════════════════════════

By the coupon collector's argument, to visit all k states at least once
with probability ≥ 1−δ, a random walk needs O(k · ln(k/δ)) steps.

PRISM has ~55 routes × 8 roles × ~5 actions ≈ 2200 state-action pairs.
For δ=0.05:  n ≈ 2200 · ln(2200/0.05) ≈ 23000 steps.
With 20 walkers × 1000 steps = 20000 transitions → ~95% coverage.

═══════════════════════════════════════════════════════════════════════
DESIGN
═══════════════════════════════════════════════════════════════════════

The simulation starts from a COMPLETELY EMPTY database.  The crawlers
themselves build the entire system through their actions:

  Phase 0 — Bootstrap: One super_admin creates the first instruments,
            invites all other users
  Phase 1 — Activation: Each invited user activates their account
  Phase 2 — Organic lifecycle: Requesters submit, faculty approve,
            operators process, admins configure — all via random walk
  Phase 3 — Extended random walk: All 20 walkers explore freely

Every HTTP response is logged.  Every status code, redirect, error,
and security violation is recorded to crawl_log.json.  An AI agent
can read this log and generate targeted fixes.

═══════════════════════════════════════════════════════════════════════
TOGGLE
═══════════════════════════════════════════════════════════════════════

    RUN_MCMC_CRAWL=1 python3 test_mcmc_crawl.py     # run
    RUN_MCMC_CRAWL=0 python3 test_mcmc_crawl.py     # skip (exit 0)

═══════════════════════════════════════════════════════════════════════
OUTPUT FILES
═══════════════════════════════════════════════════════════════════════

    crawl_log.json      Machine-readable: every step + violations
    crawl_report.txt    Human-readable summary
"""
from __future__ import annotations

import json
import os
import random
import re
import shutil
import sqlite3
import sys
import time
import traceback
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path

if os.environ.get("RUN_MCMC_CRAWL") == "0":
    print("MCMC crawl disabled (RUN_MCMC_CRAWL=0).")
    sys.exit(0)

# ── Bootstrap Flask app ──────────────────────────────────────────────
os.environ.setdefault("OWNER_EMAILS", "admin@lab.local")
sys.path.insert(0, str(Path(__file__).resolve().parent))

import app as prism_app

flask_app = prism_app.app
flask_app.config["TESTING"] = True
flask_app.config["WTF_CSRF_ENABLED"] = False
flask_app.config["SERVER_NAME"] = "localhost:5055"

BASE_DIR = Path(__file__).resolve().parent
LOG_PATH = BASE_DIR / "crawl_log.json"
REPORT_PATH = BASE_DIR / "crawl_report.txt"
PASSWORD = "CrawlTest2026!"

# ── Personas ─────────────────────────────────────────────────────────
# The admin creates these people; they activate themselves.
PERSONAS = [
    # Admin (pre-exists — seeded by init_db or created manually)
    {"name": "Admin Owner",      "email": "admin@lab.local",       "role": "super_admin",        "walker": "W-SA-1"},
    {"name": "Dean Kumar",       "email": "dean@lab.local",        "role": "super_admin",        "walker": "W-SA-2"},
    {"name": "Site Admin",       "email": "siteadmin@lab.local",   "role": "site_admin",         "walker": "W-SiA"},
    {"name": "FESEM Admin",      "email": "fesem.admin@lab.local", "role": "instrument_admin",   "walker": "W-IA-1"},
    {"name": "XRD Admin",        "email": "xrd.admin@lab.local",   "role": "instrument_admin",   "walker": "W-IA-2"},
    {"name": "NMR Admin",        "email": "nmr.admin@lab.local",   "role": "instrument_admin",   "walker": "W-IA-3"},
    {"name": "Dr. Sen",          "email": "sen@lab.local",         "role": "faculty_in_charge",  "walker": "W-FIC-1"},
    {"name": "Dr. Kondhalkar",   "email": "kondhalkar@lab.local",  "role": "faculty_in_charge",  "walker": "W-FIC-2"},
    {"name": "Anika Operator",   "email": "anika@lab.local",       "role": "operator",           "walker": "W-Op-1"},
    {"name": "Raj Operator",     "email": "raj.op@lab.local",      "role": "operator",           "walker": "W-Op-2"},
    {"name": "Priya Operator",   "email": "priya.op@lab.local",    "role": "operator",           "walker": "W-Op-3"},
    {"name": "Finance Officer",  "email": "finance@lab.local",     "role": "finance_admin",      "walker": "W-Fin"},
    {"name": "Prof. Approver",   "email": "prof.approver@lab.local","role":"professor_approver",  "walker": "W-Prof"},
    {"name": "Aarav Shah",       "email": "shah@lab.local",        "role": "requester",          "walker": "W-Req-1"},
    {"name": "Priya Mehta",      "email": "priya.m@lab.local",     "role": "requester",          "walker": "W-Req-2"},
    {"name": "Vikram Singh",     "email": "vikram@lab.local",      "role": "requester",          "walker": "W-Req-3"},
    {"name": "Sneha Patel",      "email": "sneha@lab.local",       "role": "requester",          "walker": "W-Req-4"},
    {"name": "Rohan Gupta",      "email": "rohan@lab.local",       "role": "requester",          "walker": "W-Req-5"},
]

INSTRUMENTS_TO_CREATE = [
    {"name": "FESEM",                    "code": "FESEM-01", "category": "Electron Microscopy", "location": "Lab A-101", "capacity": 3},
    {"name": "XRD",                      "code": "XRD-01",   "category": "X-Ray Diffraction",  "location": "Lab A-102", "capacity": 5},
    {"name": "NMR Spectrometer",         "code": "NMR-01",   "category": "Spectroscopy",       "location": "Lab B-201", "capacity": 2},
    {"name": "FTIR",                     "code": "FTIR-01",  "category": "Spectroscopy",       "location": "Lab B-202", "capacity": 4},
    {"name": "UV-Vis Spectrophotometer", "code": "UVVIS-01", "category": "Spectroscopy",       "location": "Lab B-203", "capacity": 6},
    {"name": "TGA",                      "code": "TGA-01",   "category": "Thermal Analysis",   "location": "Lab C-301", "capacity": 3},
    {"name": "DSC",                      "code": "DSC-01",   "category": "Thermal Analysis",   "location": "Lab C-302", "capacity": 3},
    {"name": "HPLC",                     "code": "HPLC-01",  "category": "Chromatography",     "location": "Lab D-401", "capacity": 4},
    {"name": "GC-MS",                    "code": "GCMS-01",  "category": "Chromatography",     "location": "Lab D-402", "capacity": 3},
    {"name": "AFM",                      "code": "AFM-01",   "category": "Microscopy",         "location": "Lab A-103", "capacity": 2},
]

STEPS_PER_WALKER = 1000  # 20 walkers × 1000 = 20000 transitions

# ── Authorization Rules ──────────────────────────────────────────────
ADMIN_ONLY_ROUTES = {"/api/process-email-queue", "/api/operator-workload",
                     "/api/audit-search", "/api/audit-export", "/api/db-backup",
                     "/api/compile-check"}
ADMIN_ROLES = {"super_admin", "site_admin"}
SCHEDULE_ROLES = {"super_admin", "site_admin", "operator", "instrument_admin", "faculty_in_charge"}
STATS_ROLES = {"super_admin", "site_admin", "instrument_admin", "faculty_in_charge", "operator"}
CALENDAR_ROLES = {"super_admin", "site_admin", "operator", "instrument_admin", "faculty_in_charge"}
PUBLIC_ROUTES = {"/login", "/logout", "/activate", "/api/health-check"}


# ── Crawl Logger ─────────────────────────────────────────────────────
class CrawlLog:
    def __init__(self):
        self.entries = []
        self.violations = []
        self.status_counts = Counter()
        self.route_coverage = set()
        self.role_route_coverage = defaultdict(set)
        self.phase_counts = defaultdict(int)

    def record(self, walker, role, phase, step, method, url, data, status, desc, violation=None):
        entry = {
            "walker": walker, "role": role, "phase": phase, "step": step,
            "method": method, "url": url,
            "post_data": {k: v for k, v in (data or {}).items()} if data else None,
            "status": status, "description": desc, "violation": violation,
            "ts": datetime.utcnow().isoformat(),
        }
        self.entries.append(entry)
        self.status_counts[status] += 1
        self.phase_counts[phase] += 1
        route_key = re.sub(r'/\d+', '/<id>', url.split('?')[0])
        self.route_coverage.add(route_key)
        self.role_route_coverage[role].add(route_key)
        if violation:
            self.violations.append(entry)
            print(f"    !! VIOLATION: [{walker}/{role}] {method} {url} -> {status}: {violation}")

    def check_security(self, role, method, url, status):
        base = url.split('?')[0]
        if status == 500:
            return f"SERVER_ERROR_500"
        if status == 999:
            return "EXCEPTION"
        if role == "anonymous":
            if base not in PUBLIC_ROUTES and status == 200:
                return f"AUTH_BYPASS"
            return None
        if base in ADMIN_ONLY_ROUTES and role not in ADMIN_ROLES and status == 200:
            return f"PRIVILEGE_ESCALATION"
        if base == "/schedule" and role not in SCHEDULE_ROLES and status == 200:
            return f"SCHEDULE_BYPASS"
        if base in ("/calendar", "/calendar/events") and role not in CALENDAR_ROLES and status == 200:
            return f"CALENDAR_BYPASS"
        if base in ("/stats", "/visualizations") and role not in STATS_ROLES and status == 200:
            return f"STATS_BYPASS"
        if base == "/admin/users" and role not in ADMIN_ROLES and status == 200:
            return f"ADMIN_BYPASS"
        if re.match(r'/users/\d+/history', base) and role != "super_admin" and status == 200:
            return f"AUDIT_BYPASS"
        return None

    def save(self):
        with open(LOG_PATH, "w") as f:
            json.dump({
                "meta": {
                    "timestamp": datetime.utcnow().isoformat(),
                    "total_steps": len(self.entries),
                    "total_violations": len(self.violations),
                    "unique_routes": len(self.route_coverage),
                    "walkers": len(set(e["walker"] for e in self.entries)),
                    "phases": dict(self.phase_counts),
                },
                "violations": self.violations,
                "status_distribution": dict(self.status_counts),
                "route_coverage": sorted(self.route_coverage),
                "entries": self.entries,
            }, f, indent=2)

        lines = []
        lines.append("=" * 70)
        lines.append("PRISM MCMC RANDOM WALK CRAWL REPORT")
        lines.append(f"Generated: {datetime.utcnow().isoformat()}")
        lines.append("=" * 70)
        lines.append(f"Total steps:        {len(self.entries)}")
        lines.append(f"Unique routes:      {len(self.route_coverage)}")
        lines.append(f"Total violations:   {len(self.violations)}")
        lines.append(f"Phases:             {dict(self.phase_counts)}")
        lines.append("")
        lines.append("STATUS DISTRIBUTION:")
        for code, count in sorted(self.status_counts.items()):
            pct = count / max(len(self.entries), 1) * 100
            lines.append(f"  {code}: {count:>6} ({pct:5.1f}%)")
        lines.append("")
        lines.append("ROUTE COVERAGE BY ROLE:")
        for role in sorted(self.role_route_coverage.keys()):
            lines.append(f"  {role:<25} {len(self.role_route_coverage[role]):>3} routes")
        lines.append("")
        lines.append(f"ALL ROUTES VISITED ({len(self.route_coverage)}):")
        for r in sorted(self.route_coverage):
            lines.append(f"  {r}")
        if self.violations:
            lines.append("")
            lines.append("!" * 70)
            lines.append(f"VIOLATIONS ({len(self.violations)}):")
            lines.append("!" * 70)
            seen = set()
            for v in self.violations:
                key = f"{v['violation']}|{v['url']}|{v['role']}"
                if key in seen:
                    continue
                seen.add(key)
                lines.append(f"  [{v['walker']}/{v['role']}] {v['method']} {v['url']} -> {v['status']}")
                lines.append(f"    RULE: {v['violation']}")
                lines.append(f"    DESC: {v['description']}")
                if v.get("post_data"):
                    lines.append(f"    DATA: {json.dumps(v['post_data'], default=str)[:200]}")
                lines.append("")
            if len(self.violations) > len(seen):
                lines.append(f"  ({len(self.violations) - len(seen)} duplicate violations suppressed)")
        else:
            lines.append("")
            lines.append("=" * 70)
            lines.append("ALL SECURITY ASSERTIONS PASSED — ZERO VIOLATIONS")
            lines.append("=" * 70)

        with open(REPORT_PATH, "w") as f:
            f.write("\n".join(lines))


# ── HTTP helpers ─────────────────────────────────────────────────────
def do_request(client, method, url, data=None):
    try:
        if method == "GET":
            return client.get(url, follow_redirects=True)
        else:
            return client.post(url, data=data or {},
                               content_type="application/x-www-form-urlencoded",
                               follow_redirects=True)
    except Exception:
        return None


def do_step(client, log, walker, role, phase, step, method, url, data, desc):
    resp = do_request(client, method, url, data)
    status = resp.status_code if resp else 999
    violation = log.check_security(role, method, url, status)
    log.record(walker, role, phase, step, method, url, data, status, desc, violation)
    return status


# ── Phase 0: Clean slate ─────────────────────────────────────────────
def phase_0_clean_slate(log):
    """Delete existing database.  Create fresh with init_db.  Insert bootstrap admin."""
    print("\n[Phase 0] Clean slate — empty database")
    db_path = prism_app.DB_PATH
    if db_path.exists():
        db_path.unlink()

    # Clean uploads/exports/backups
    for d in ["uploads", "exports", "backups"]:
        p = BASE_DIR / d
        if p.exists():
            shutil.rmtree(p, ignore_errors=True)
        p.mkdir(exist_ok=True)

    with flask_app.app_context():
        prism_app.init_db()
        db = prism_app.get_db()

        # Insert the bootstrap admin (the only pre-existing user)
        from werkzeug.security import generate_password_hash
        pw = generate_password_hash(PASSWORD)
        db.execute(
            "INSERT INTO users (name, email, password_hash, role, invite_status, active) "
            "VALUES (?, ?, ?, 'super_admin', 'active', 1)",
            ("Admin Owner", "admin@lab.local", pw),
        )
        db.commit()
    print("  Database initialized with 1 bootstrap admin")


# ── Phase 1: Admin bootstrap ─────────────────────────────────────────
def phase_1_admin_bootstrap(log):
    """Admin logs in, creates instruments, creates all user accounts."""
    print("\n[Phase 1] Admin bootstrap — instruments + user creation")
    step = 0

    with flask_app.test_client() as c:
        # Login
        do_step(c, log, "W-SA-1", "super_admin", "bootstrap", step,
                "POST", "/login", {"email": "admin@lab.local", "password": PASSWORD}, "admin login")
        step += 1

        # Visit empty dashboard
        do_step(c, log, "W-SA-1", "super_admin", "bootstrap", step,
                "GET", "/", None, "dashboard (empty)")
        step += 1

        # Create instruments
        for inst in INSTRUMENTS_TO_CREATE:
            do_step(c, log, "W-SA-1", "super_admin", "bootstrap", step,
                    "POST", "/instruments", {
                        "action": "create_instrument",
                        "new_name": inst["name"],
                        "new_code": inst["code"],
                        "new_category": inst["category"],
                        "new_location": inst["location"],
                        "new_daily_capacity": str(inst["capacity"]),
                    }, f"create instrument {inst['code']}")
            step += 1

        # Verify instruments page
        do_step(c, log, "W-SA-1", "super_admin", "bootstrap", step,
                "GET", "/instruments", None, "instruments (should show 10)")
        step += 1

        # Create user accounts (all except the admin who already exists)
        for persona in PERSONAS[1:]:  # skip admin
            do_step(c, log, "W-SA-1", "super_admin", "bootstrap", step,
                    "POST", "/admin/users", {
                        "action": "create_user",
                        "name": persona["name"],
                        "email": persona["email"],
                        "role": persona["role"],
                        "password": PASSWORD,
                    }, f"create user {persona['email']}")
            step += 1

        # Visit admin users page to verify
        do_step(c, log, "W-SA-1", "super_admin", "bootstrap", step,
                "GET", "/admin/users", None, f"users page (should show {len(PERSONAS)})")
        step += 1

        # Set up approval chains for first 3 instruments
        with flask_app.app_context():
            db = prism_app.get_db()
            instruments = db.execute("SELECT id FROM instruments ORDER BY id LIMIT 3").fetchall()
            for inst_row in instruments:
                iid = inst_row[0]
                do_step(c, log, "W-SA-1", "super_admin", "bootstrap", step,
                        "POST", f"/instruments/{iid}/config", {
                            "action": "add_approval_step",
                            "approver_role": "professor",
                        }, f"add approval step to inst {iid}")
                step += 1

        # Browse sitemap, calendar, schedule, stats
        for url in ["/sitemap", "/calendar", "/schedule", "/stats", "/visualizations"]:
            do_step(c, log, "W-SA-1", "super_admin", "bootstrap", step,
                    "GET", url, None, f"visit {url}")
            step += 1

    print(f"  {step} bootstrap steps completed")


# ── Phase 2: All users activate and explore ──────────────────────────
def phase_2_activation(log):
    """Each persona logs in and does initial exploration."""
    print("\n[Phase 2] User activation and initial exploration")
    step = 0

    for persona in PERSONAS:
        walker = persona["walker"]
        role = persona["role"]
        email = persona["email"]

        with flask_app.test_client() as c:
            # Login
            s = do_step(c, log, walker, role, "activation", step,
                        "POST", "/login", {"email": email, "password": PASSWORD}, "login")
            step += 1

            if s >= 400:
                print(f"  {walker} login failed ({s}) — skipping")
                continue

            # Explore common pages
            for url in ["/", "/sitemap", "/me", "/pending",
                        "/profile/email-preferences", "/instruments"]:
                do_step(c, log, walker, role, "activation", step,
                        "GET", url, None, f"explore {url}")
                step += 1

            # Try role-specific pages
            if role in SCHEDULE_ROLES:
                do_step(c, log, walker, role, "activation", step,
                        "GET", "/schedule", None, "explore schedule")
                step += 1
            if role in CALENDAR_ROLES:
                do_step(c, log, walker, role, "activation", step,
                        "GET", "/calendar", None, "explore calendar")
                step += 1
            if role in STATS_ROLES:
                do_step(c, log, walker, role, "activation", step,
                        "GET", "/stats", None, "explore stats")
                step += 1

            # Try forbidden pages (security check)
            if role not in ADMIN_ROLES:
                do_step(c, log, walker, role, "activation", step,
                        "GET", "/admin/users", None, "SEC: try admin users")
                step += 1
            if role not in SCHEDULE_ROLES:
                do_step(c, log, walker, role, "activation", step,
                        "GET", "/schedule", None, "SEC: try schedule")
                step += 1

    print(f"  {step} activation steps completed")


# ── Phase 3: Organic lifecycle — requesters submit, system processes ──
def phase_3_lifecycle(log):
    """Requesters submit requests.  Operators/admins process them."""
    print("\n[Phase 3] Organic lifecycle — requests flow through system")
    step = 0
    created_request_ids = []

    # Requesters submit requests
    requester_personas = [p for p in PERSONAS if p["role"] == "requester"]
    with flask_app.app_context():
        db = prism_app.get_db()
        instruments = [r[0] for r in db.execute("SELECT id FROM instruments").fetchall()]

    for persona in requester_personas:
        with flask_app.test_client() as c:
            do_step(c, log, persona["walker"], "requester", "lifecycle", step,
                    "POST", "/login", {"email": persona["email"], "password": PASSWORD}, "login")
            step += 1

            # Each requester submits 2-3 requests
            for i in range(random.randint(2, 3)):
                iid = random.choice(instruments)
                s = do_step(c, log, persona["walker"], "requester", "lifecycle", step,
                            "POST", "/requests/new", {
                                "instrument_id": str(iid),
                                "title": f"Analysis-{persona['name'].split()[0]}-{i+1}",
                                "sample_name": f"Sample-{persona['name'].split()[-1]}-{i+1}",
                                "sample_count": str(random.randint(1, 4)),
                                "description": f"Request from {persona['name']} for instrument analysis #{i+1}",
                                "priority": random.choice(["normal", "high", "urgent"]),
                            }, f"submit request #{i+1}")
                step += 1

            # Browse own requests
            do_step(c, log, persona["walker"], "requester", "lifecycle", step,
                    "GET", "/pending", None, "check pending")
            step += 1

    # Refresh request IDs
    with flask_app.app_context():
        db = prism_app.get_db()
        created_request_ids = [r[0] for r in db.execute("SELECT id FROM sample_requests ORDER BY id").fetchall()]

    print(f"  {len(created_request_ids)} requests created")

    # Operators/admins process requests
    admin_personas = [p for p in PERSONAS if p["role"] in ("super_admin", "operator", "instrument_admin")]
    for persona in admin_personas[:3]:
        with flask_app.test_client() as c:
            do_step(c, log, persona["walker"], persona["role"], "lifecycle", step,
                    "POST", "/login", {"email": persona["email"], "password": PASSWORD}, "login")
            step += 1

            # View schedule
            do_step(c, log, persona["walker"], persona["role"], "lifecycle", step,
                    "GET", "/schedule", None, "view queue")
            step += 1

            # Process some requests
            for rid in created_request_ids[:3]:
                # View detail
                do_step(c, log, persona["walker"], persona["role"], "lifecycle", step,
                        "GET", f"/requests/{rid}", None, f"view request {rid}")
                step += 1

                # Post a message
                do_step(c, log, persona["walker"], persona["role"], "lifecycle", step,
                        "POST", f"/requests/{rid}", {
                            "action": "post_message",
                            "note_kind": "operator_note",
                            "message_body": f"Processing note from {persona['name']}",
                        }, f"message on request {rid}")
                step += 1

    print(f"  {step} lifecycle steps completed")
    return created_request_ids


# ── Phase 4: Extended random walk ────────────────────────────────────
def phase_4_random_walk(log, request_ids):
    """All 20 walkers do MCMC random exploration for uniform coverage."""
    print(f"\n[Phase 4] Extended MCMC random walk — {len(PERSONAS)+2} walkers × {STEPS_PER_WALKER} steps")

    with flask_app.app_context():
        db = prism_app.get_db()
        instrument_ids = [r[0] for r in db.execute("SELECT id FROM instruments").fetchall()]
        user_ids = [r[0] for r in db.execute("SELECT id FROM users").fetchall()]

    db_state = {
        "request_ids": request_ids,
        "instrument_ids": instrument_ids,
        "user_ids": user_ids,
    }

    master_seed = int(time.time())

    # Run all personas + 2 anonymous walkers
    walker_configs = []
    for p in PERSONAS:
        walker_configs.append(p)
    walker_configs.append({"name": "W-Anon-1", "email": None, "role": "anonymous", "walker": "W-Anon-1"})
    walker_configs.append({"name": "W-Anon-2", "email": None, "role": "anonymous", "walker": "W-Anon-2"})

    for i, persona in enumerate(walker_configs):
        rng = random.Random(master_seed + i * 31337)
        walker = persona.get("walker", persona["name"])
        role = persona["role"]
        email = persona.get("email")

        with flask_app.test_client() as c:
            # Login (unless anonymous)
            if email:
                resp = do_request(c, "POST", "/login", {"email": email, "password": PASSWORD})
                if not resp or resp.status_code >= 400:
                    print(f"  {walker} login failed — skipping random walk")
                    continue

            for step in range(STEPS_PER_WALKER):
                transitions = _build_transitions(role, db_state, rng)
                method, url, data, desc = rng.choice(transitions)
                do_step(c, log, walker, role, "random_walk", step, method, url, data, desc)

                # Periodically refresh db_state (new requests may have been created)
                if step % 100 == 99:
                    with flask_app.app_context():
                        db2 = prism_app.get_db()
                        db_state["request_ids"] = [
                            r[0] for r in db2.execute("SELECT id FROM sample_requests ORDER BY id").fetchall()
                        ]

        # Summary
        walker_entries = [e for e in log.entries if e["walker"] == walker and e["phase"] == "random_walk"]
        if walker_entries:
            sc = Counter(e["status"] for e in walker_entries)
            errs = sum(1 for e in walker_entries if e["status"] >= 500)
            uniq = len(set(re.sub(r'/\d+', '/<id>', e["url"].split("?")[0]) for e in walker_entries))
            viols = sum(1 for e in walker_entries if e["violation"])
            print(f"  {walker:<12} {role:<22} {len(walker_entries)} steps, {uniq} URLs, "
                  f"{errs} err, {viols} viol  {dict(sc)}")


def _build_transitions(role, db_state, rng):
    """Build transition list for random walk step."""
    t = []

    # Navigation
    t.append(("GET", "/", None, "dashboard"))
    t.append(("GET", "/sitemap", None, "sitemap"))
    t.append(("GET", "/me", None, "my profile"))
    t.append(("GET", "/pending", None, "pending"))
    t.append(("GET", "/profile/email-preferences", None, "email prefs"))
    t.append(("GET", "/profile/change-password", None, "change pw"))
    t.append(("GET", "/instruments", None, "instruments"))
    t.append(("GET", "/requests/new", None, "new request form"))
    t.append(("GET", "/api/notif-count", None, "notif count"))
    t.append(("GET", "/api/health-check", None, "health check"))
    t.append(("GET", "/api/announcements", None, "announcements"))

    for rid in rng.sample(db_state["request_ids"], min(8, len(db_state["request_ids"]))):
        t.append(("GET", f"/requests/{rid}", None, f"request {rid}"))
    for iid in db_state["instrument_ids"]:
        t.append(("GET", f"/instruments/{iid}", None, f"instrument {iid}"))
        t.append(("GET", f"/api/sparkline/{iid}", None, f"sparkline {iid}"))
    for uid in rng.sample(db_state["user_ids"], min(5, len(db_state["user_ids"]))):
        t.append(("GET", f"/users/{uid}", None, f"user {uid}"))
    for rid in rng.sample(db_state["request_ids"], min(3, len(db_state["request_ids"]))):
        t.append(("GET", f"/requests/{rid}/duplicate", None, f"dup {rid}"))

    if role in SCHEDULE_ROLES:
        t.append(("GET", "/schedule", None, "queue"))
        for b in ["submitted", "completed", "in_progress", "rejected", "scheduled"]:
            t.append(("GET", f"/schedule?bucket={b}", None, f"queue/{b}"))
    if role in CALENDAR_ROLES:
        t.append(("GET", "/calendar", None, "calendar"))
        t.append(("GET", "/calendar/events", None, "cal events"))
        for iid in db_state["instrument_ids"][:3]:
            t.append(("GET", f"/instruments/{iid}/calendar", None, f"inst {iid} cal"))
    if role in STATS_ROLES:
        t.append(("GET", "/stats", None, "stats"))
        t.append(("GET", "/stats?horizon=monthly", None, "stats monthly"))
        t.append(("GET", "/visualizations", None, "viz"))
        for iid in db_state["instrument_ids"][:3]:
            t.append(("GET", f"/visualizations/instrument/{iid}", None, f"viz inst {iid}"))
    if role in ADMIN_ROLES:
        t.append(("GET", "/admin/users", None, "admin users"))
        t.append(("GET", "/api/operator-workload", None, "workload"))
        t.append(("GET", "/api/instrument-utilization", None, "utilization"))
        t.append(("GET", "/api/turnaround-stats", None, "turnaround"))
        t.append(("GET", "/api/audit-search", None, "audit search"))
        t.append(("GET", "/api/audit-export", None, "audit CSV"))
        for uid in db_state["user_ids"][:3]:
            t.append(("GET", f"/users/{uid}/history", None, f"user {uid} hist"))
    if role in {"super_admin", "site_admin", "instrument_admin"}:
        for iid in db_state["instrument_ids"][:5]:
            t.append(("GET", f"/instruments/{iid}/config", None, f"inst {iid} cfg"))
    if role in {"finance_admin", "site_admin", "super_admin"}:
        t.append(("GET", "/admin/budgets", None, "budgets"))

    # POST actions
    iids = db_state["instrument_ids"]
    t.append(("POST", "/requests/new", {
        "instrument_id": str(rng.choice(iids)),
        "title": f"RW-{rng.randint(1000,9999)}",
        "sample_name": f"S-{rng.randint(100,999)}",
        "sample_count": str(rng.randint(1, 5)),
        "description": "Random walk test request",
        "priority": rng.choice(["normal", "high", "urgent"]),
    }, "submit request"))

    for rid in rng.sample(db_state["request_ids"], min(3, len(db_state["request_ids"]))):
        t.append(("POST", f"/requests/{rid}", {
            "action": "post_message",
            "note_kind": rng.choice(["requester_note", "lab_reply", "operator_note"]),
            "message_body": f"RW msg {rng.randint(1,9999)}",
        }, f"msg on {rid}"))

    t.append(("POST", "/api/notif-mark-read", {}, "mark read"))
    t.append(("POST", "/profile/change-password", {
        "current_password": PASSWORD, "new_password": PASSWORD, "confirm_password": PASSWORD,
    }, "change pw"))
    t.append(("POST", "/profile/email-preferences", {
        "action": "update_preferences", "enable_status_changed": str(rng.randint(0, 1)),
    }, "update prefs"))

    if role in ADMIN_ROLES:
        t.append(("POST", "/api/announcements", {
            "title": f"A-{rng.randint(1,999)}", "body": "Test.", "priority": "info",
        }, "announce"))
    if role in {"super_admin", "site_admin", "operator", "instrument_admin"}:
        rids = db_state["request_ids"]
        if rids:
            t.append(("POST", "/api/bulk-action", {
                "action": "mark_received", "request_ids": str(rng.choice(rids)),
            }, "bulk recv"))

    # Security probes
    if role not in ADMIN_ROLES:
        t.append(("GET", "/admin/users", None, "SEC:admin"))
        t.append(("GET", "/api/audit-search", None, "SEC:audit"))
        t.append(("POST", "/api/db-backup", {}, "SEC:backup"))
        t.append(("POST", "/api/compile-check", {}, "SEC:compile"))
    if role not in SCHEDULE_ROLES:
        t.append(("GET", "/schedule", None, "SEC:schedule"))
    if role not in CALENDAR_ROLES:
        t.append(("GET", "/calendar", None, "SEC:calendar"))
    if role not in STATS_ROLES:
        t.append(("GET", "/stats", None, "SEC:stats"))
    if role != "super_admin":
        for uid in db_state["user_ids"][:2]:
            t.append(("GET", f"/users/{uid}/history", None, f"SEC:hist {uid}"))

    if role == "anonymous":
        t = [
            ("GET", "/login", None, "login page"),
            ("GET", "/activate", None, "activate"),
            ("GET", "/api/health-check", None, "health"),
            ("GET", "/", None, "try home"),
            ("GET", "/instruments", None, "try instruments"),
            ("GET", "/schedule", None, "try schedule"),
            ("GET", "/calendar", None, "try calendar"),
            ("GET", "/stats", None, "try stats"),
            ("GET", "/admin/users", None, "try admin"),
            ("GET", "/pending", None, "try pending"),
            ("GET", "/me", None, "try profile"),
            ("GET", "/sitemap", None, "try sitemap"),
            ("GET", "/api/notif-count", None, "try notif"),
            ("GET", "/api/announcements", None, "try announce"),
            ("POST", "/api/notif-mark-read", {}, "try mark read"),
            ("POST", "/requests/new", {"title": "x"}, "try submit"),
            ("POST", "/api/db-backup", {}, "try backup"),
        ]

    return t


# ── Main ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    total_walkers = len(PERSONAS) + 2  # +2 anonymous
    total_steps = total_walkers * STEPS_PER_WALKER

    print(f"{'='*70}")
    print(f"PRISM MCMC Lifecycle Crawler")
    print(f"{'='*70}")
    print(f"Date:        {datetime.utcnow().isoformat()}")
    print(f"Walkers:     {total_walkers} ({len(PERSONAS)} authenticated + 2 anonymous)")
    print(f"Steps/walk:  {STEPS_PER_WALKER}")
    print(f"Total steps: ~{total_steps + 500} (phases + random walk)")
    print(f"Database:    {prism_app.DB_PATH}")
    print(f"{'='*70}")

    log = CrawlLog()
    start = time.time()

    phase_0_clean_slate(log)
    phase_1_admin_bootstrap(log)
    phase_2_activation(log)
    request_ids = phase_3_lifecycle(log)
    phase_4_random_walk(log, request_ids)

    elapsed = time.time() - start
    log.save()

    print(f"\n{'='*70}")
    print(f"CRAWL COMPLETE")
    print(f"{'='*70}")
    print(f"Elapsed:     {elapsed:.1f}s ({len(log.entries) / elapsed:.0f} req/sec)")
    print(f"Log:         {LOG_PATH}")
    print(f"Report:      {REPORT_PATH}")
    print(f"Violations:  {len(log.violations)}")
    print(f"500 errors:  {log.status_counts.get(500, 0)}")
    print(f"Routes hit:  {len(log.route_coverage)}")

    # Print report
    print()
    print(REPORT_PATH.read_text())

    sys.exit(0 if len(log.violations) == 0 else 1)
