#!/usr/bin/env python3
"""Seed the PRISM database with comprehensive test data.

Creates 10 instruments, 26 users across all 8 roles, sample requests
in every lifecycle state, messages, announcements, downtime events,
and approval configurations.

Run:  python3 seed_test_data.py
This operates on the same lab_scheduler.db used by app.py.
"""
from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import sys
from datetime import datetime, timedelta
from pathlib import Path

try:
    from werkzeug.security import generate_password_hash
except ImportError:
    # Fallback: use pbkdf2 directly if werkzeug not available as CLI script
    import hashlib as _h
    def generate_password_hash(pw):
        salt = os.urandom(16).hex()
        dk = _h.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 260000).hex()
        return f"pbkdf2:sha256:260000${salt}${dk}"

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "lab_scheduler.db"

PASSWORD = "TestPass123!"

USERS = [
    ("Admin Owner", "admin@lab.local", "super_admin"),
    ("Dean Kumar", "dean@lab.local", "super_admin"),
    ("Site Admin", "siteadmin@lab.local", "site_admin"),
    ("Dr. Sen (FIC-FESEM)", "sen@lab.local", "faculty_in_charge"),
    ("Dr. Kondhalkar (Office IC)", "kondhalkar@lab.local", "faculty_in_charge"),
    ("Dr. Patil (FIC-NMR)", "patil@lab.local", "faculty_in_charge"),
    ("Dr. Joshi (FIC-FTIR)", "joshi@lab.local", "faculty_in_charge"),
    ("Dr. Deshmukh (FIC-HPLC)", "deshmukh@lab.local", "faculty_in_charge"),
    ("FESEM Admin", "fesem.admin@lab.local", "instrument_admin"),
    ("XRD Admin", "xrd.admin@lab.local", "instrument_admin"),
    ("NMR Admin", "nmr.admin@lab.local", "instrument_admin"),
    ("Anika (Operator)", "anika@lab.local", "operator"),
    ("Raj (Operator)", "raj.op@lab.local", "operator"),
    ("Priya (Operator)", "priya.op@lab.local", "operator"),
    ("Meera (Operator)", "meera.op@lab.local", "operator"),
    ("Finance Officer", "finance@lab.local", "finance_admin"),
    ("Prof. Approver", "prof.approver@lab.local", "professor_approver"),
    ("Dr. Reviewer", "reviewer@lab.local", "professor_approver"),
    ("Aarav Shah (Student)", "shah@lab.local", "requester"),
    ("Priya Mehta (Student)", "priya.m@lab.local", "requester"),
    ("Vikram Singh (PhD)", "vikram@lab.local", "requester"),
    ("Sneha Patel (MSc)", "sneha@lab.local", "requester"),
    ("Rohan Gupta (PhD)", "rohan@lab.local", "requester"),
    ("Ananya Das (Student)", "ananya@lab.local", "requester"),
    ("Karan Jain (External)", "karan@lab.local", "requester"),
    ("Neha Sharma (PostDoc)", "neha@lab.local", "requester"),
]

INSTRUMENTS = [
    ("FESEM", "FESEM-01", "Electron Microscopy", "Lab A-101", 3, "Field Emission Scanning Electron Microscope for high-resolution imaging"),
    ("XRD", "XRD-01", "X-Ray Diffraction", "Lab A-102", 5, "X-Ray Diffractometer for crystal structure analysis"),
    ("NMR Spectrometer", "NMR-01", "Spectroscopy", "Lab B-201", 2, "Nuclear Magnetic Resonance for molecular structure"),
    ("FTIR", "FTIR-01", "Spectroscopy", "Lab B-202", 4, "Fourier Transform Infrared Spectrometer"),
    ("UV-Vis Spectrophotometer", "UVVIS-01", "Spectroscopy", "Lab B-203", 6, "UV-Visible spectroscopy for absorbance measurements"),
    ("TGA", "TGA-01", "Thermal Analysis", "Lab C-301", 3, "Thermogravimetric Analyzer for thermal stability"),
    ("DSC", "DSC-01", "Thermal Analysis", "Lab C-302", 3, "Differential Scanning Calorimeter"),
    ("HPLC", "HPLC-01", "Chromatography", "Lab D-401", 4, "High Performance Liquid Chromatography"),
    ("GC-MS", "GCMS-01", "Chromatography", "Lab D-402", 3, "Gas Chromatography Mass Spectrometry"),
    ("AFM", "AFM-01", "Microscopy", "Lab A-103", 2, "Atomic Force Microscope for surface topography"),
]


def now_iso():
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S")


def log_audit(db, entity_type, entity_id, action, actor_id=None, payload=None):
    """Insert an audit log entry with hash chain."""
    payload_json = json.dumps(payload or {})
    created_at = now_iso()
    last = db.execute("SELECT entry_hash FROM audit_logs ORDER BY id DESC LIMIT 1").fetchone()
    prev_hash = last[0] if last else "genesis"
    raw = f"{prev_hash}{entity_type}{entity_id}{action}{payload_json}{created_at}"
    entry_hash = hashlib.sha256(raw.encode()).hexdigest()
    db.execute(
        "INSERT INTO audit_logs (entity_type, entity_id, action, actor_id, payload_json, prev_hash, entry_hash, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (entity_type, entity_id, action, actor_id, payload_json, prev_hash, entry_hash, created_at),
    )


def seed():
    # Import app module to run init_db
    sys.path.insert(0, str(BASE_DIR))
    import app as prism_app

    # Delete existing DB for clean seed
    if DB_PATH.exists():
        DB_PATH.unlink()
        print(f"Removed existing database: {DB_PATH}")

    with prism_app.app.app_context():
        prism_app.init_db()
        db = prism_app.get_db()

        pw_hash = generate_password_hash(PASSWORD)

        # ── Users ──
        user_ids = {}
        for name, email, role in USERS:
            db.execute(
                "INSERT INTO users (name, email, password_hash, role, invite_status, active) "
                "VALUES (?, ?, ?, ?, 'active', 1)",
                (name, email, pw_hash, role),
            )
            user_ids[email] = db.execute("SELECT last_insert_rowid()").fetchone()[0]
        print(f"Created {len(USERS)} users")

        # ── Instruments ──
        inst_ids = {}
        for name, code, category, location, capacity, desc in INSTRUMENTS:
            db.execute(
                "INSERT INTO instruments (name, code, category, location, daily_capacity, status, instrument_description) "
                "VALUES (?, ?, ?, ?, ?, 'active', ?)",
                (name, code, category, location, capacity, desc),
            )
            inst_ids[code] = db.execute("SELECT last_insert_rowid()").fetchone()[0]
        print(f"Created {len(INSTRUMENTS)} instruments")

        # ── Instrument Admin Assignments ──
        admin_assignments = [
            ("fesem.admin@lab.local", "FESEM-01"),
            ("xrd.admin@lab.local", "XRD-01"),
            ("nmr.admin@lab.local", "NMR-01"),
        ]
        for email, code in admin_assignments:
            db.execute("INSERT INTO instrument_admins (user_id, instrument_id) VALUES (?, ?)",
                       (user_ids[email], inst_ids[code]))

        # ── Faculty In-Charge Assignments ──
        fic_assignments = [
            ("sen@lab.local", "FESEM-01"),
            ("sen@lab.local", "AFM-01"),
            ("patil@lab.local", "NMR-01"),
            ("joshi@lab.local", "FTIR-01"),
            ("joshi@lab.local", "UVVIS-01"),
            ("deshmukh@lab.local", "HPLC-01"),
            ("deshmukh@lab.local", "GCMS-01"),
            ("kondhalkar@lab.local", "XRD-01"),
            ("kondhalkar@lab.local", "TGA-01"),
            ("kondhalkar@lab.local", "DSC-01"),
        ]
        for email, code in fic_assignments:
            db.execute("INSERT INTO instrument_faculty_admins (user_id, instrument_id) VALUES (?, ?)",
                       (user_ids[email], inst_ids[code]))

        # ── Operator Assignments ──
        op_assignments = [
            ("anika@lab.local", ["FESEM-01", "AFM-01", "XRD-01"]),
            ("raj.op@lab.local", ["NMR-01", "FTIR-01", "UVVIS-01"]),
            ("priya.op@lab.local", ["TGA-01", "DSC-01", "HPLC-01"]),
            ("meera.op@lab.local", ["GCMS-01", "HPLC-01", "FESEM-01"]),
        ]
        for email, codes in op_assignments:
            for code in codes:
                try:
                    db.execute("INSERT INTO instrument_operators (user_id, instrument_id) VALUES (?, ?)",
                               (user_ids[email], inst_ids[code]))
                except sqlite3.IntegrityError:
                    pass

        # ── Approval Configs ──
        # FESEM, XRD, NMR require 2-step approval
        for code in ["FESEM-01", "XRD-01", "NMR-01"]:
            db.execute(
                "INSERT INTO instrument_approval_config (instrument_id, step_order, approver_role) VALUES (?, 1, 'faculty_in_charge')",
                (inst_ids[code],))
            db.execute(
                "INSERT INTO instrument_approval_config (instrument_id, step_order, approver_role) VALUES (?, 2, 'professor_approver')",
                (inst_ids[code],))

        # HPLC requires only faculty approval
        db.execute(
            "INSERT INTO instrument_approval_config (instrument_id, step_order, approver_role) VALUES (?, 1, 'faculty_in_charge')",
            (inst_ids["HPLC-01"],))

        print("Configured approval chains")

        # ── Sample Requests ──
        now = datetime.utcnow()
        statuses = [
            "submitted", "under_review", "awaiting_sample_submission",
            "sample_submitted", "sample_received", "scheduled",
            "in_progress", "completed", "rejected", "cancelled",
        ]
        requester_emails = [e for n, e, r in USERS if r == "requester"]
        operator_emails = [e for n, e, r in USERS if r == "operator"]
        inst_codes = list(inst_ids.keys())

        for i, status in enumerate(statuses):
            req_no = f"REQ-2026-{i+1:04d}"
            req_email = requester_emails[i % len(requester_emails)]
            inst_code = inst_codes[i % len(inst_codes)]
            op_email = operator_emails[i % len(operator_emails)]
            created = (now - timedelta(days=30 - i * 3)).strftime("%Y-%m-%dT%H:%M:%S")

            cols = {
                "request_no": req_no,
                "sample_ref": f"SR-{i+1:04d}",
                "requester_id": user_ids[req_email],
                "created_by_user_id": user_ids[req_email],
                "instrument_id": inst_ids[inst_code],
                "title": f"Analysis of {['Polymer', 'Metal Oxide', 'Nanoparticle', 'Ceramic', 'Composite'][i % 5]} Sample",
                "sample_name": f"Sample-{chr(65 + i)}",
                "sample_count": (i % 3) + 1,
                "description": f"Detailed analysis required for {['morphology', 'crystal structure', 'molecular weight', 'thermal stability', 'composition'][i % 5]} characterization.",
                "status": status,
                "priority": ["normal", "high", "urgent"][i % 3],
                "created_at": created,
                "updated_at": created,
            }
            if status == "completed":
                cols["completed_at"] = now.strftime("%Y-%m-%dT%H:%M:%S")
                cols["results_summary"] = "Analysis complete. Results show expected characteristics within normal parameters."
            if status in ("scheduled", "in_progress", "completed"):
                cols["scheduled_for"] = (now + timedelta(days=i)).strftime("%Y-%m-%dT%H:%M:%S")
                cols["assigned_operator_id"] = user_ids[op_email]
            if status in ("sample_received", "scheduled", "in_progress", "completed"):
                cols["sample_received_at"] = created
                cols["received_by_operator_id"] = user_ids[op_email]
            if status == "rejected":
                cols["remarks"] = "Sample does not meet the minimum requirements for FESEM analysis."

            placeholders = ", ".join(["?"] * len(cols))
            col_names = ", ".join(cols.keys())
            db.execute(f"INSERT INTO sample_requests ({col_names}) VALUES ({placeholders})",
                       tuple(cols.values()))

            req_id = db.execute("SELECT last_insert_rowid()").fetchone()[0]
            log_audit(db, "request", req_id, "created", user_ids[req_email],
                      {"status": status, "request_no": req_no})

        # Add 5 more requests from different users to make it realistic
        for i in range(5):
            idx = len(statuses) + i
            req_no = f"REQ-2026-{idx+1:04d}"
            req_email = requester_emails[(i + 3) % len(requester_emails)]
            inst_code = inst_codes[(i + 2) % len(inst_codes)]
            created = (now - timedelta(days=i + 1)).strftime("%Y-%m-%dT%H:%M:%S")

            db.execute(
                "INSERT INTO sample_requests (request_no, sample_ref, requester_id, created_by_user_id, "
                "instrument_id, title, sample_name, sample_count, description, status, priority, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', 'normal', ?, ?)",
                (req_no, f"SR-{idx+1:04d}", user_ids[req_email], user_ids[req_email],
                 inst_ids[inst_code], f"New Submission #{i+1}", f"Fresh-Sample-{i+1}",
                 1, "Newly submitted request for testing", created, created))

        print(f"Created {len(statuses) + 5} sample requests")

        # ── Messages ──
        for req_id in range(1, 6):
            db.execute(
                "INSERT INTO request_messages (request_id, sender_user_id, note_kind, message_body, created_at) "
                "VALUES (?, ?, 'requester_note', 'Could you please provide an estimated completion date?', ?)",
                (req_id, user_ids["shah@lab.local"], now.strftime("%Y-%m-%dT%H:%M:%S")))
            db.execute(
                "INSERT INTO request_messages (request_id, sender_user_id, note_kind, message_body, created_at) "
                "VALUES (?, ?, 'lab_reply', 'We expect to process your sample within 3-5 business days.', ?)",
                (req_id, user_ids["anika@lab.local"],
                 (now + timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%S")))

        # ── Announcement ──
        db.execute(
            "INSERT INTO announcements (title, body, priority, created_by_user_id, created_at, is_active) "
            "VALUES (?, ?, 'warning', ?, ?, 1)",
            ("Lab A Maintenance Notice",
             "Lab A (rooms 101-103) will be closed Friday 10 AM - 2 PM for scheduled HVAC maintenance. FESEM, XRD, and AFM will be unavailable.",
             user_ids["admin@lab.local"], now.strftime("%Y-%m-%dT%H:%M:%S")))

        db.execute(
            "INSERT INTO announcements (title, body, priority, created_by_user_id, created_at, is_active) "
            "VALUES (?, ?, 'info', ?, ?, 1)",
            ("New HPLC Column Installed",
             "A new C18 reverse-phase column has been installed on the HPLC. Please update your method parameters accordingly.",
             user_ids["admin@lab.local"], now.strftime("%Y-%m-%dT%H:%M:%S")))

        # ── Instrument Downtime ──
        db.execute(
            "INSERT INTO instrument_downtime (instrument_id, start_time, end_time, reason, downtime_type, created_by_user_id, created_at) "
            "VALUES (?, ?, ?, 'Scheduled calibration of FESEM detector', 'calibration', ?, ?)",
            (inst_ids["FESEM-01"],
             (now + timedelta(days=2)).strftime("%Y-%m-%dT%H:%M:%S"),
             (now + timedelta(days=2, hours=4)).strftime("%Y-%m-%dT%H:%M:%S"),
             user_ids["admin@lab.local"], now.strftime("%Y-%m-%dT%H:%M:%S")))

        db.execute(
            "INSERT INTO instrument_downtime (instrument_id, start_time, end_time, reason, downtime_type, created_by_user_id, created_at) "
            "VALUES (?, ?, ?, 'Annual preventive maintenance', 'maintenance', ?, ?)",
            (inst_ids["XRD-01"],
             (now + timedelta(days=5)).strftime("%Y-%m-%dT%H:%M:%S"),
             (now + timedelta(days=6)).strftime("%Y-%m-%dT%H:%M:%S"),
             user_ids["admin@lab.local"], now.strftime("%Y-%m-%dT%H:%M:%S")))

        db.commit()

    print(f"\nDatabase seeded successfully at: {DB_PATH}")
    print(f"\n{'='*60}")
    print("TEST CREDENTIALS")
    print(f"{'='*60}")
    print(f"Password for ALL accounts: {PASSWORD}")
    print()
    print(f"{'Role':<25} {'Email':<35} {'Name'}")
    print(f"{'-'*25} {'-'*35} {'-'*30}")
    for name, email, role in USERS:
        print(f"{role:<25} {email:<35} {name}")
    print(f"\nServer: python3 app.py  →  http://127.0.0.1:5055")


if __name__ == "__main__":
    seed()
