"""
Comprehensive full demo data population script for Flask Lab Scheduler app.

Creates:
- 25 instruments across 5 categories
- 15 faculty members with professor_approver and faculty_in_charge roles
- 10 operators handling 2-3 instruments each
- 40+ requester accounts with realistic Indian academic names
- 1 finance_admin (Secretary Kondhalkar)
- 500 sample requests spread across 6 months (Oct 2025 - Apr 2026)
- Realistic lifecycle distributions: 60% completed, 15% in-progress/scheduled, 10% under_review/awaiting, 10% sample_submitted/received, 5% rejected
- Event log entries with SHA-256 hash chain audit trail
- Cross-instrument permissions and grant/funding tracking
"""

from __future__ import annotations

import hashlib
import json
import random
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

from werkzeug.security import generate_password_hash


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "lab_scheduler.db"
DEFAULT_PASSWORD = "SimplePass123"

# Random seed for reproducibility
random.seed(42)


def now_iso(dt: datetime | None = None) -> str:
    """Convert datetime to ISO 8601 format with Z suffix."""
    value = dt or datetime.utcnow()
    return value.replace(microsecond=0).isoformat() + "Z"


def log_action(db: sqlite3.Connection, actor_id: int | None, request_id: int, action: str, payload: dict, created_at: str) -> None:
    """Log action with SHA-256 hash chain for audit trail."""
    previous = db.execute(
        "SELECT entry_hash FROM audit_logs WHERE entity_type = 'sample_request' AND entity_id = ? ORDER BY id DESC LIMIT 1",
        (request_id,),
    ).fetchone()
    prev_hash = previous["entry_hash"] if previous else ""
    payload_json = json.dumps(payload, sort_keys=True)
    digest = hashlib.sha256(f"{prev_hash}|sample_request|{request_id}|{action}|{payload_json}".encode()).hexdigest()
    db.execute(
        """
        INSERT INTO audit_logs (entity_type, entity_id, action, actor_id, payload_json, prev_hash, entry_hash, created_at)
        VALUES ('sample_request', ?, ?, ?, ?, ?, ?, ?)
        """,
        (request_id, action, actor_id, payload_json, prev_hash, digest, created_at),
    )


def ensure_user(db: sqlite3.Connection, name: str, email: str, role: str, invite_status: str = "active") -> int:
    """Ensure user exists, upsert on email."""
    password_hash = generate_password_hash(DEFAULT_PASSWORD, method="pbkdf2:sha256")
    db.execute(
        """
        INSERT INTO users (name, email, password_hash, role, invited_by, invite_status, active)
        VALUES (?, ?, ?, ?, NULL, ?, 1)
        ON CONFLICT(email) DO UPDATE SET
            name = excluded.name,
            role = excluded.role,
            invite_status = excluded.invite_status,
            active = 1
        """,
        (name, email, password_hash, role, invite_status),
    )
    row = db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    assert row is not None
    return row["id"]


def ensure_instrument(
    db: sqlite3.Connection,
    name: str,
    code: str,
    category: str,
    location: str,
    daily_capacity: int,
    notes: str,
    manufacturer: str = "",
    model_number: str = "",
    capabilities_summary: str = "",
    machine_photo_url: str = "",
    reference_links: str = "",
) -> int:
    """Ensure instrument exists, upsert on code."""
    row = db.execute("SELECT id FROM instruments WHERE code = ?", (code,)).fetchone()
    if row:
        db.execute(
            """
            UPDATE instruments
            SET name = ?, category = ?, location = ?, daily_capacity = ?, status = 'active', notes = ?,
                manufacturer = ?, model_number = ?, capabilities_summary = ?, machine_photo_url = ?, reference_links = ?
            WHERE code = ?
            """,
            (name, category, location, daily_capacity, notes, manufacturer, model_number, capabilities_summary, machine_photo_url, reference_links, code),
        )
        return row["id"]
    cur = db.execute(
        """
        INSERT INTO instruments (name, code, category, location, daily_capacity, status, notes, manufacturer, model_number, capabilities_summary, machine_photo_url, reference_links)
        VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)
        """,
        (name, code, category, location, daily_capacity, notes, manufacturer, model_number, capabilities_summary, machine_photo_url, reference_links),
    )
    return cur.lastrowid


def assign_admin(db: sqlite3.Connection, user_id: int, instrument_id: int) -> None:
    """Assign instrument admin (ignore duplicates)."""
    db.execute(
        "INSERT OR IGNORE INTO instrument_admins (user_id, instrument_id) VALUES (?, ?)",
        (user_id, instrument_id),
    )


def assign_operator(db: sqlite3.Connection, user_id: int, instrument_id: int) -> None:
    """Assign instrument operator (ignore duplicates)."""
    db.execute(
        "INSERT OR IGNORE INTO instrument_operators (user_id, instrument_id) VALUES (?, ?)",
        (user_id, instrument_id),
    )


def assign_faculty(db: sqlite3.Connection, user_id: int, instrument_id: int) -> None:
    """Assign faculty admin to instrument (ignore duplicates)."""
    db.execute(
        "INSERT OR IGNORE INTO instrument_faculty_admins (user_id, instrument_id) VALUES (?, ?)",
        (user_id, instrument_id),
    )


def next_request_number(db: sqlite3.Connection) -> str:
    """Generate next sequential request number."""
    row = db.execute("SELECT COUNT(*) AS c FROM sample_requests").fetchone()
    return f"REQ-{3001 + row['c']}"


def create_request(
    db: sqlite3.Connection,
    requester_email: str,
    instrument_code: str,
    title: str,
    sample_name: str,
    sample_count: int,
    description: str,
    sample_origin: str,
    receipt_number: str,
    amount_due: float,
    amount_paid: float,
    finance_status: str,
    priority: str,
    status: str,
    base_dt: datetime,
    operator_email: str | None = None,
    scheduled_for: str | None = None,
    remarks: str = "",
    results_summary: str = "",
    sample_dropoff_note: str = "",
    sample_submitted_at: str | None = None,
    sample_received_at: str | None = None,
    completed_at: str | None = None,
    created_by_email: str | None = None,
) -> int:
    """Create a sample request with all lifecycle fields."""
    request_no = next_request_number(db)
    requester_id = db.execute("SELECT id FROM users WHERE email = ?", (requester_email,)).fetchone()["id"]
    created_by_lookup = created_by_email or requester_email
    created_by_user_id = db.execute("SELECT id FROM users WHERE email = ?", (created_by_lookup,)).fetchone()["id"]
    instrument_id = db.execute("SELECT id FROM instruments WHERE code = ?", (instrument_code,)).fetchone()["id"]
    operator_id = None
    if operator_email:
        operator_id = db.execute("SELECT id FROM users WHERE email = ?", (operator_email,)).fetchone()["id"]
    completion_locked = 1 if status == "completed" else 0
    created_at = now_iso(base_dt)
    updated_at = completed_at or sample_received_at or sample_submitted_at or scheduled_for or created_at
    cur = db.execute(
        """
        INSERT INTO sample_requests (
            request_no, requester_id, created_by_user_id, instrument_id, title, sample_name, sample_count, description, sample_origin,
            receipt_number, amount_due, amount_paid, finance_status, priority, status, submitted_to_lab_at,
            sample_submitted_at, sample_received_at, sample_dropoff_note, received_by_operator_id, assigned_operator_id,
            scheduled_for, remarks, results_summary, result_email_status, result_email_sent_at, completion_locked,
            created_at, updated_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            request_no,
            requester_id,
            created_by_user_id,
            instrument_id,
            title,
            sample_name,
            sample_count,
            description,
            sample_origin,
            receipt_number,
            amount_due,
            amount_paid,
            finance_status,
            priority,
            status,
            sample_submitted_at,
            sample_submitted_at,
            sample_received_at,
            sample_dropoff_note,
            operator_id if sample_received_at else None,
            operator_id,
            scheduled_for,
            remarks,
            results_summary,
            "Seeded as emailed." if status == "completed" else "",
            completed_at if status == "completed" else None,
            completion_locked,
            created_at,
            updated_at,
            completed_at,
        ),
    )
    request_id = cur.lastrowid
    return request_id


def create_approval_chain(db: sqlite3.Connection, request_id: int, instrument_code: str, base_dt: datetime, approval_state: str) -> None:
    """Create approval workflow chain for a request."""
    instrument_id = db.execute("SELECT id FROM instruments WHERE code = ?", (instrument_code,)).fetchone()["id"]
    finance_id = db.execute("SELECT id FROM users WHERE role = 'finance_admin' ORDER BY id LIMIT 1").fetchone()["id"]

    # Pick a random professor from available professors
    professor_id = db.execute("SELECT id FROM users WHERE role = 'professor_approver' ORDER BY RANDOM() LIMIT 1").fetchone()["id"]

    # Get operator for this instrument
    operator_id = db.execute(
        """
        SELECT u.id
        FROM users u
        JOIN instrument_operators io ON io.user_id = u.id
        WHERE io.instrument_id = ?
        ORDER BY RANDOM()
        LIMIT 1
        """,
        (instrument_id,),
    ).fetchone()
    operator_id = operator_id["id"] if operator_id else None

    step_rows = [
        (1, "finance", finance_id),
        (2, "professor", professor_id),
        (3, "operator", operator_id),
    ]

    for order, role, user_id in step_rows:
        status = "pending"
        remarks = ""
        acted_at = None

        if approval_state == "finance_only" and order == 1:
            status = "approved"
            remarks = "Finance cleared"
            acted_at = now_iso(base_dt + timedelta(hours=3))
        elif approval_state == "professor_pending" and order == 1:
            status = "approved"
            remarks = "Finance cleared"
            acted_at = now_iso(base_dt + timedelta(hours=3))
        elif approval_state == "fully_approved":
            status = "approved"
            remarks = f"{role.title()} approved"
            acted_at = now_iso(base_dt + timedelta(hours=order * 3))
        elif approval_state == "operator_rejected":
            if order < 3:
                status = "approved"
                remarks = f"{role.title()} approved"
                acted_at = now_iso(base_dt + timedelta(hours=order * 3))
            else:
                status = "rejected"
                remarks = "Sample matrix not suitable for instrument"
                acted_at = now_iso(base_dt + timedelta(hours=9))

        db.execute(
            """
            INSERT INTO approval_steps (sample_request_id, step_order, approver_role, approver_user_id, status, remarks, acted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (request_id, order, role, user_id, status, remarks, acted_at),
        )


def seed_full_demo(db: sqlite3.Connection) -> None:
    """Seed comprehensive full demo dataset."""

    # ========== INDIAN ACADEMIC NAMES DATA ==========

    faculty_names = [
        ("Prof. Rajesh Kumar", "rajesh.kumar@lab.local"),
        ("Prof. Priya Sharma", "priya.sharma@lab.local"),
        ("Prof. Vikram Patel", "vikram.patel@lab.local"),
        ("Prof. Amrita Gupta", "amrita.gupta@lab.local"),
        ("Prof. Sanjay Desai", "sanjay.desai@lab.local"),
        ("Prof. Neha Verma", "neha.verma@lab.local"),
        ("Prof. Arjun Singh", "arjun.singh@lab.local"),
        ("Prof. Divya Nair", "divya.nair@lab.local"),
        ("Prof. Manish Iyer", "manish.iyer@lab.local"),
        ("Prof. Anjali Rao", "anjali.rao@lab.local"),
        ("Prof. Rohan Bhatt", "rohan.bhatt@lab.local"),
        ("Prof. Savita Kulkarni", "savita.kulkarni@lab.local"),
        ("Prof. Arun Menon", "arun.menon@lab.local"),
        ("Prof. Kavya Saxena", "kavya.saxena@lab.local"),
        ("Prof. Nikhil Joshi", "nikhil.joshi@lab.local"),
    ]

    operator_names = [
        ("Anita Rao", "anita.rao@lab.local"),
        ("Ravi Kumar", "ravi.kumar@lab.local"),
        ("Fatima Khan", "fatima.khan@lab.local"),
        ("Deepak Singh", "deepak.singh@lab.local"),
        ("Priya Mishra", "priya.mishra@lab.local"),
        ("Vikram Reddy", "vikram.reddy@lab.local"),
        ("Sunita Sharma", "sunita.sharma@lab.local"),
        ("Anil Gupta", "anil.gupta@lab.local"),
        ("Meera Pandey", "meera.pandey@lab.local"),
        ("Arjun Verma", "arjun.verma@lab.local"),
    ]

    requester_names = [
        ("Dr. Rajesh Desai", "rajesh.desai@lab.local"),
        ("Dr. Priya Nair", "priya.nair@lab.local"),
        ("Dr. Vikram Singh", "vikram.singh@lab.local"),
        ("Dr. Amrita Patel", "amrita.patel@lab.local"),
        ("Dr. Sanjay Verma", "sanjay.verma@lab.local"),
        ("Dr. Neha Sharma", "neha.sharma@lab.local"),
        ("Dr. Arjun Rao", "arjun.rao@lab.local"),
        ("Dr. Divya Iyer", "divya.iyer@lab.local"),
        ("Dr. Manish Kulkarni", "manish.kulkarni@lab.local"),
        ("Dr. Anjali Bhatt", "anjali.bhatt@lab.local"),
        ("Dr. Rohan Menon", "rohan.menon@lab.local"),
        ("Dr. Savita Reddy", "savita.reddy@lab.local"),
        ("Dr. Arun Joshi", "arun.joshi@lab.local"),
        ("Dr. Kavya Singh", "kavya.singh@lab.local"),
        ("Ms. Nikhila Das", "nikhila.das@lab.local"),
        ("Mr. Siddharth Gupta", "siddharth.gupta@lab.local"),
        ("Ms. Ananya Kapoor", "ananya.kapoor@lab.local"),
        ("Dr. Varun Saxena", "varun.saxena@lab.local"),
        ("Ms. Pooja Nair", "pooja.nair@lab.local"),
        ("Dr. Akshay Sharma", "akshay.sharma@lab.local"),
        ("Dr. Ritika Verma", "ritika.verma@lab.local"),
        ("Mr. Harsh Patel", "harsh.patel@lab.local"),
        ("Ms. Shruti Desai", "shruti.desai@lab.local"),
        ("Dr. Abhishek Rao", "abhishek.rao@lab.local"),
        ("Dr. Sneha Singh", "sneha.singh@lab.local"),
        ("Mr. Aditya Kumar", "aditya.kumar@lab.local"),
        ("Ms. Diya Iyer", "diya.iyer@lab.local"),
        ("Dr. Vishal Kulkarni", "vishal.kulkarni@lab.local"),
        ("Ms. Tanvi Reddy", "tanvi.reddy@lab.local"),
        ("Dr. Pranav Joshi", "pranav.joshi@lab.local"),
        ("Dr. Isha Menon", "isha.menon@lab.local"),
        ("Mr. Kabir Bhatt", "kabir.bhatt@lab.local"),
        ("Ms. Neetu Saxena", "neetu.saxena@lab.local"),
        ("Dr. Yash Gupta", "yash.gupta@lab.local"),
        ("Ms. Hira Nair", "hira.nair@lab.local"),
        ("Dr. Siddhartha Rao", "siddhartha.rao@lab.local"),
        ("Dr. Priya Verma", "priya.verma2@lab.local"),
        ("Mr. Rohan Sharma", "rohan.sharma@lab.local"),
        ("Ms. Zainab Khan", "zainab.khan@lab.local"),
        ("Dr. Aakash Singh", "aakash.singh@lab.local"),
    ]

    # ========== CREATE USERS ==========

    # Finance admin
    ensure_user(db, "Secretary Kondhalkar", "kondhalkar@lab.local", "finance_admin", "active")

    # Faculty members
    for name, email in faculty_names:
        ensure_user(db, name, email, "professor_approver", "active")

    # Operators
    for name, email in operator_names:
        ensure_user(db, name, email, "operator", "active")

    # Requesters
    for name, email in requester_names:
        ensure_user(db, name, email, "requester", "active")

    # ========== CREATE INSTRUMENTS ==========

    instruments_data = [
        # Spectroscopy (5)
        ("FESEM", "INST-101", "Spectroscopy", "Nanoscience Lab", 5, "Field Emission SEM for high-resolution imaging", "Zeiss", "Sigma 300", "High-resolution imaging, elemental mapping, crystallographic analysis", "https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=900&q=80", "https://www.zeiss.com/"),
        ("ICP-MS", "INST-102", "Spectroscopy", "Analytical Suite", 4, "Multi-element analysis for trace metals", "PerkinElmer", "NexION 2000", "Trace metal quantification, isotope ratio analysis, speciation studies", "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=900&q=80", "https://www.perkinelmer.com/"),
        ("XRD", "INST-103", "Spectroscopy", "Crystallography Lab", 6, "X-ray diffraction for phase identification", "Bruker", "D8 Advance", "Phase identification, crystal structure determination, texture analysis", "https://images.unsplash.com/photo-1581092162562-40038f34c4d7?auto=format&fit=crop&w=900&q=80", "https://www.bruker.com/"),
        ("UV-Vis", "INST-104", "Spectroscopy", "Analytical Suite", 8, "Routine absorbance and transmission measurements", "Shimadzu", "UV-2600", "Absorbance scans, kinetics studies, quantification", "https://images.unsplash.com/photo-1581092919535-7146ff1a590e?auto=format&fit=crop&w=900&q=80", "https://www.shimadzu.com/"),
        ("FTIR", "INST-105", "Spectroscopy", "Analytical Suite", 6, "Infrared spectroscopy for functional group analysis", "PerkinElmer", "Spectrum Two", "Functional group identification, polymer characterization, library matching", "https://images.unsplash.com/photo-1511174511562-5f7f18b874f8?auto=format&fit=crop&w=900&q=80", "https://www.perkinelmer.com/"),

        # Microscopy (5)
        ("Optical Microscope", "INST-201", "Microscopy", "Optics Room", 8, "Routine optical microscopy and sample inspection", "Zeiss", "Axio Imager", "Bright field, dark field, polarized light microscopy", "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=900&q=80", "https://www.zeiss.com/"),
        ("TEM", "INST-202", "Microscopy", "Nanoscience Lab", 3, "Transmission electron microscopy for ultra-high resolution", "FEI", "Tecnai G2", "High-resolution TEM, STEM analysis, elemental mapping", "https://images.unsplash.com/photo-1516339901601-2e1b62dc0c45?auto=format&fit=crop&w=900&q=80", "https://www.fei.com/"),
        ("Raman", "INST-203", "Microscopy", "Optics Room", 4, "Confocal Raman microscopy for vibrational spectroscopy", "Horiba", "LabRAM", "Micro-Raman mapping, defect analysis, structural characterization", "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=900&q=80", "https://www.horiba.com/"),
        ("AFM", "INST-204", "Microscopy", "Nanoscience Lab", 5, "Atomic force microscopy for nanoscale surface analysis", "Bruker", "Dimension Icon", "Topography, roughness, phase mapping, nanoscale imaging", "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=900&q=80", "https://www.bruker.com/"),
        ("SEM-EDS", "INST-205", "Microscopy", "Materials Lab", 6, "Scanning electron microscopy with energy-dispersive X-ray spectroscopy", "JEOL", "JSM-6490LV", "Microstructure imaging, elemental composition, surface analysis", "https://images.unsplash.com/photo-1581092162562-40038f34c4d7?auto=format&fit=crop&w=900&q=80", "https://www.jeol.co.jp/"),

        # Chromatography (5)
        ("GC-MS", "INST-301", "Chromatography", "Analytical Suite", 5, "Gas chromatography-mass spectrometry for volatile compounds", "Thermo Scientific", "ISQ 7000", "Volatile profiling, compound identification, purity analysis", "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=900&q=80", "https://www.thermofisher.com/"),
        ("HPLC", "INST-302", "Chromatography", "Wet Chemistry Lab", 8, "High-performance liquid chromatography", "Waters", "Alliance e2695", "Routine separations, quantification, impurity profiling", "https://images.unsplash.com/photo-1532635241-17e820acc59f?auto=format&fit=crop&w=900&q=80", "https://www.waters.com/"),
        ("LC-MS", "INST-303", "Chromatography", "Analytical Suite", 6, "Liquid chromatography-mass spectrometry", "Agilent", "1290/6210", "Metabolite profiling, compound identification, molecular weight determination", "https://images.unsplash.com/photo-1576091160679-112cc4ce0ee2?auto=format&fit=crop&w=900&q=80", "https://www.agilent.com/"),
        ("Supercritical Fluid", "INST-304", "Chromatography", "Wet Chemistry Lab", 4, "Supercritical fluid chromatography for chiral separations", "Thar", "SFC-AP", "Chiral compound separation, enantiomeric analysis", "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=900&q=80", "https://www.tharsfc.com/"),
        ("NMR 400MHz", "INST-305", "Chromatography", "NMR Lab", 7, "400 MHz nuclear magnetic resonance spectrometer", "Bruker", "AVANCE", "1H NMR, 13C NMR, 2D NMR, structural characterization", "https://images.unsplash.com/photo-1516339901601-2e1b62dc0c45?auto=format&fit=crop&w=900&q=80", "https://www.bruker.com/"),

        # Thermal Analysis (5)
        ("DSC", "INST-401", "Thermal Analysis", "Thermal Suite", 6, "Differential scanning calorimetry", "TA Instruments", "Q2000", "Thermal transitions, heat capacity, crystallinity analysis", "https://images.unsplash.com/photo-1581092163562-40038f34c4d7?auto=format&fit=crop&w=900&q=80", "https://www.tainstruments.com/"),
        ("TGA", "INST-402", "Thermal Analysis", "Thermal Suite", 5, "Thermogravimetric analysis", "TA Instruments", "Q5000", "Weight loss, thermal stability, decomposition kinetics", "https://images.unsplash.com/photo-1581092160562-40038f34c4d7?auto=format&fit=crop&w=900&q=80", "https://www.tainstruments.com/"),
        ("DMA", "INST-403", "Thermal Analysis", "Thermal Suite", 4, "Dynamic mechanical analysis", "TA Instruments", "Q850", "Viscoelastic properties, glass transition, storage modulus", "https://images.unsplash.com/photo-1581092162562-40038f34c4d7?auto=format&fit=crop&w=900&q=80", "https://www.tainstruments.com/"),
        ("Rheometer", "INST-404", "Thermal Analysis", "Polymer Lab", 5, "Rotational rheometer for viscosity and flow", "Anton Paar", "MCR 102", "Viscosity, dynamic moduli, temperature sweeps, cure kinetics", "https://images.unsplash.com/photo-1581092162562-40038f34c4d7?auto=format&fit=crop&w=900&q=80", "https://www.anton-paar.com/"),
        ("Dilatometer", "INST-405", "Thermal Analysis", "Thermal Suite", 3, "Thermal expansion measurement", "Netzsch", "DIL 402", "Linear expansion, sintering behavior, phase transitions", "https://images.unsplash.com/photo-1581092162562-40038f34c4d7?auto=format&fit=crop&w=900&q=80", "https://www.netzsch.com/"),

        # Surface Analysis (5)
        ("BET Surface Area", "INST-501", "Surface Analysis", "Materials Lab", 4, "Brunauer-Emmett-Teller surface area analyzer", "Micromeritics", "ASAP 2020", "Specific surface area, pore size distribution, adsorption analysis", "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=900&q=80", "https://www.micromeritics.com/"),
        ("XPS", "INST-502", "Surface Analysis", "Surface Lab", 3, "X-ray photoelectron spectroscopy", "Thermo Scientific", "K-Alpha", "Elemental composition, chemical state analysis, depth profiling", "https://images.unsplash.com/photo-1581092162562-40038f34c4d7?auto=format&fit=crop&w=900&q=80", "https://www.thermofisher.com/"),
        ("Zeta Potential", "INST-503", "Surface Analysis", "Colloidal Lab", 6, "Dynamic light scattering and zeta potential analyzer", "Malvern", "Zetasizer", "Particle size, zeta potential, aggregation behavior", "https://images.unsplash.com/photo-1581092160562-40038f34c4d7?auto=format&fit=crop&w=900&q=80", "https://www.malvern.com/"),
        ("Contact Angle", "INST-504", "Surface Analysis", "Surface Lab", 7, "Contact angle and surface tension analyzer", "Dataphysics", "OCA", "Wettability, surface energy, interfacial tension", "https://images.unsplash.com/photo-1581092162562-40038f34c4d7?auto=format&fit=crop&w=900&q=80", "https://www.dataphysics.com/"),
        ("Ellipsometer", "INST-505", "Surface Analysis", "Materials Lab", 5, "Spectroscopic ellipsometer for thin film analysis", "Horiba", "UVISEL", "Film thickness, refractive index, optical properties", "https://images.unsplash.com/photo-1581092162562-40038f34c4d7?auto=format&fit=crop&w=900&q=80", "https://www.horiba.com/"),
    ]

    instrument_map = {}
    for record in instruments_data:
        inst_id = ensure_instrument(db, *record)
        instrument_map[record[1]] = inst_id

    # ========== ASSIGN FACULTY AND OPERATORS ==========

    # Each faculty member gets 1-3 instruments (random assignment)
    faculty_instruments = {
        "rajesh.kumar@lab.local": ["INST-101", "INST-102"],
        "priya.sharma@lab.local": ["INST-103", "INST-104"],
        "vikram.patel@lab.local": ["INST-105", "INST-201"],
        "amrita.gupta@lab.local": ["INST-202", "INST-203"],
        "sanjay.desai@lab.local": ["INST-204", "INST-205"],
        "neha.verma@lab.local": ["INST-301", "INST-302"],
        "arjun.singh@lab.local": ["INST-303", "INST-304"],
        "divya.nair@lab.local": ["INST-305", "INST-401"],
        "manish.iyer@lab.local": ["INST-402", "INST-403"],
        "anjali.rao@lab.local": ["INST-404", "INST-405"],
        "rohan.bhatt@lab.local": ["INST-501", "INST-502"],
        "savita.kulkarni@lab.local": ["INST-503", "INST-504"],
        "arun.menon@lab.local": ["INST-505", "INST-101"],
        "kavya.saxena@lab.local": ["INST-301", "INST-302"],
        "nikhil.joshi@lab.local": ["INST-401", "INST-402"],
    }

    for faculty_email, instruments in faculty_instruments.items():
        faculty_id = db.execute("SELECT id FROM users WHERE email = ?", (faculty_email,)).fetchone()["id"]
        for inst_code in instruments:
            inst_id = instrument_map[inst_code]
            assign_faculty(db, faculty_id, inst_id)

    # Operators: each handles 2-3 instruments
    operator_instruments = {
        "anita.rao@lab.local": ["INST-101", "INST-205", "INST-201"],
        "ravi.kumar@lab.local": ["INST-102", "INST-301", "INST-302"],
        "fatima.khan@lab.local": ["INST-401", "INST-402", "INST-403"],
        "deepak.singh@lab.local": ["INST-103", "INST-501", "INST-502"],
        "priya.mishra@lab.local": ["INST-104", "INST-105", "INST-503"],
        "vikram.reddy@lab.local": ["INST-202", "INST-203", "INST-304"],
        "sunita.sharma@lab.local": ["INST-204", "INST-504", "INST-505"],
        "anil.gupta@lab.local": ["INST-303", "INST-305", "INST-404"],
        "meera.pandey@lab.local": ["INST-201", "INST-405", "INST-301"],
        "arjun.verma@lab.local": ["INST-101", "INST-302", "INST-401"],
    }

    for operator_email, instruments in operator_instruments.items():
        operator_id = db.execute("SELECT id FROM users WHERE email = ?", (operator_email,)).fetchone()["id"]
        for inst_code in instruments:
            inst_id = instrument_map[inst_code]
            assign_operator(db, operator_id, inst_id)

    # ========== CREATE 500 SAMPLE REQUESTS ==========

    sample_titles = [
        "Material composition analysis",
        "Thermal stability evaluation",
        "Particle size characterization",
        "Surface morphology study",
        "Phase identification",
        "Trace metal screening",
        "Polymer chain analysis",
        "Crystal structure determination",
        "Functional group confirmation",
        "Catalyst activity assessment",
        "Contamination screening",
        "Purity verification",
        "Batch consistency check",
        "Pre-release characterization",
        "Process control analysis",
        "Quality assurance testing",
        "Research sample screening",
        "Comparative study",
        "Impurity profiling",
        "Structural verification",
    ]

    sample_names = [
        "Batch A-101",
        "Reference standard",
        "Process sample",
        "Control material",
        "Test formulation",
        "Comparative sample",
        "Raw material lot",
        "Finished product",
        "Intermediate compound",
        "Polymer resin",
        "Composite specimen",
        "Ceramic pellet",
        "Metal alloy",
        "Crystal sample",
        "Powder specimen",
        "Thin film",
        "Nanoparticle suspension",
        "Fiber bundle",
        "Coated substrate",
        "Mixture formulation",
    ]

    descriptions = [
        "Routine characterization for quality control",
        "Pre-release verification before shipment",
        "Research support for academic study",
        "Process optimization evaluation",
        "Comparative analysis with reference",
        "Batch identity confirmation",
        "Stability assessment after storage",
        "Performance validation of new process",
        "Root cause analysis investigation",
        "Specification compliance check",
        "Method development support",
        "Regulatory compliance analysis",
        "Feasibility study for new material",
        "Collaboration research support",
        "Grant-funded investigation",
    ]

    # Approval states distribution (weighted)
    approval_states = ["fully_approved"] * 6 + ["finance_only"] * 1 + ["professor_pending"] * 1 + ["operator_rejected"] * 1

    # Status lifecycle distribution
    status_distribution = {
        "completed": 0.60,  # 60%
        "scheduled": 0.08,  # 15% combined in-progress/scheduled
        "in_progress": 0.07,
        "under_review": 0.08,  # 15% combined under_review/awaiting
        "awaiting_sample_submission": 0.07,
        "sample_submitted": 0.06,  # 10% combined sample_submitted/received
        "sample_received": 0.02,
        "rejected": 0.05,  # 5%
    }

    start_date = datetime(2025, 10, 1, 9, 0, 0)
    end_date = datetime(2026, 4, 30, 17, 0, 0)
    total_days = (end_date - start_date).days

    request_count = 0
    for req_idx in range(500):
        # Spread evenly across 6 months
        day_offset = int((req_idx / 500) * total_days)
        base_dt = start_date + timedelta(days=day_offset, hours=random.randint(0, 8))

        # Pick random requester
        requester_email = random.choice(requester_names)[1]

        # Pick random instrument
        inst_code = random.choice(list(instrument_map.keys()))

        # Status distribution
        rand_val = random.random()
        cumulative = 0
        status = "completed"
        for s, prob in status_distribution.items():
            cumulative += prob
            if rand_val <= cumulative:
                status = s
                break

        # Determine if internal or external
        is_external = random.random() < 0.3  # 30% external

        # Financial details
        if is_external:
            amount_due = random.choice([1000, 1500, 2000, 2500, 3000, 3500])
            if status == "completed":
                amount_paid = amount_due  # Completed = paid
            elif status in {"scheduled", "in_progress"}:
                amount_paid = random.randint(int(amount_due * 0.3), int(amount_due * 0.7))
            else:
                amount_paid = 0
            receipt_number = f"RCPT-{5000 + req_idx}"
        else:
            amount_due = 0
            amount_paid = 0
            receipt_number = ""

        # Determine finance status
        if not is_external:
            finance_status = "n/a"
        elif amount_paid >= amount_due:
            finance_status = "paid"
        elif amount_paid > 0:
            finance_status = "partial"
        else:
            finance_status = "pending"

        # Get operator for this instrument
        operator_email = db.execute(
            """
            SELECT u.email
            FROM users u
            JOIN instrument_operators io ON io.user_id = u.id
            WHERE io.instrument_id = ?
            ORDER BY RANDOM()
            LIMIT 1
            """,
            (instrument_map[inst_code],),
        ).fetchone()["email"]

        # Determine timeline based on status
        sample_submitted_at = None
        sample_received_at = None
        scheduled_for = None
        completed_at = None
        remarks = ""
        results_summary = ""
        sample_dropoff_note = ""

        if status == "completed":
            sample_submitted_at = now_iso(base_dt + timedelta(hours=1))
            sample_received_at = now_iso(base_dt + timedelta(hours=4))
            scheduled_for = (base_dt + timedelta(days=1)).strftime("%Y-%m-%dT%H:%M")
            completed_at = now_iso(base_dt + timedelta(days=2, hours=3))
            results_summary = f"Analysis complete. {random.choice(['Results conform to specification.', 'Minor variations observed.', 'Full characterization completed successfully.'])}"
            sample_dropoff_note = "Delivered to specimen reception"
            remarks = "Completed on schedule"
        elif status == "scheduled":
            sample_submitted_at = now_iso(base_dt + timedelta(hours=2))
            sample_received_at = now_iso(base_dt + timedelta(hours=5))
            scheduled_for = (base_dt + timedelta(days=1)).strftime("%Y-%m-%dT%H:%M")
            sample_dropoff_note = "Received and stored"
            remarks = "Awaiting execution"
        elif status == "in_progress":
            sample_submitted_at = now_iso(base_dt + timedelta(hours=2))
            sample_received_at = now_iso(base_dt + timedelta(hours=5))
            scheduled_for = base_dt.strftime("%Y-%m-%dT%H:%M")
            sample_dropoff_note = "In instrument queue"
            remarks = "Currently running"
        elif status == "sample_received":
            sample_submitted_at = now_iso(base_dt + timedelta(hours=2))
            sample_received_at = now_iso(base_dt + timedelta(hours=5))
            sample_dropoff_note = "Received in storage"
            remarks = "Pending scheduling"
        elif status == "sample_submitted":
            sample_submitted_at = now_iso(base_dt + timedelta(hours=2))
            sample_dropoff_note = "At reception desk"
            remarks = "Awaiting operator confirmation"
        elif status == "awaiting_sample_submission":
            remarks = "Approved and awaiting physical sample"
        elif status == "under_review":
            remarks = "Pending approval workflow"
        elif status == "rejected":
            remarks = random.choice([
                "Sample not suitable for requested analysis",
                "Insufficient sample quantity",
                "Sample degradation observed",
                "Instrument capacity exceeded",
                "Safety constraints prevent analysis",
            ])

        approval_state = random.choice(approval_states)
        priority = random.choice(["normal", "normal", "normal", "high"])

        request_id = create_request(
            db,
            requester_email,
            inst_code,
            random.choice(sample_titles),
            random.choice(sample_names),
            random.randint(1, 10),
            random.choice(descriptions),
            "external" if is_external else "internal",
            receipt_number,
            amount_due,
            amount_paid,
            finance_status,
            priority,
            status,
            base_dt,
            operator_email=operator_email,
            scheduled_for=scheduled_for,
            remarks=remarks,
            results_summary=results_summary,
            sample_dropoff_note=sample_dropoff_note,
            sample_submitted_at=sample_submitted_at,
            sample_received_at=sample_received_at,
            completed_at=completed_at,
        )

        request_count += 1

        # Create approval chain
        create_approval_chain(db, request_id, inst_code, base_dt, approval_state)

        # Create audit log entries based on status lifecycle
        requester_id = db.execute("SELECT id FROM users WHERE email = ?", (requester_email,)).fetchone()["id"]
        operator_id = db.execute("SELECT id FROM users WHERE email = ?", (operator_email,)).fetchone()["id"]

        log_action(db, requester_id, request_id, "submitted", {"status": "submitted"}, now_iso(base_dt))

        if approval_state in {"finance_only", "professor_pending", "fully_approved", "operator_rejected"}:
            finance_id = db.execute("SELECT id FROM users WHERE role = 'finance_admin'").fetchone()["id"]
            log_action(db, finance_id, request_id, "finance_approved", {"amount_approved": amount_due}, now_iso(base_dt + timedelta(hours=3)))

        if approval_state in {"professor_pending", "fully_approved", "operator_rejected"}:
            professor_id = db.execute("SELECT id FROM users WHERE role = 'professor_approver' ORDER BY RANDOM() LIMIT 1").fetchone()["id"]
            log_action(db, professor_id, request_id, "professor_approved", {}, now_iso(base_dt + timedelta(hours=6)))

        if approval_state == "fully_approved":
            log_action(db, operator_id, request_id, "operator_approved", {}, now_iso(base_dt + timedelta(hours=9)))

        if approval_state == "operator_rejected":
            log_action(db, operator_id, request_id, "operator_rejected", {"reason": "Instrument not suitable for sample matrix"}, now_iso(base_dt + timedelta(hours=9)))

        if status != "under_review" and status != "awaiting_sample_submission" and status != "rejected":
            if sample_submitted_at:
                log_action(db, requester_id, request_id, "sample_submitted", {"dropoff_note": sample_dropoff_note}, sample_submitted_at)

        if status in {"sample_received", "scheduled", "in_progress", "completed"}:
            if sample_received_at:
                log_action(db, operator_id, request_id, "sample_received", {}, sample_received_at)

        if status in {"scheduled", "in_progress", "completed"}:
            if scheduled_for:
                log_action(db, operator_id, request_id, "scheduled", {"scheduled_for": scheduled_for}, now_iso(base_dt + timedelta(hours=12)))

        if status in {"in_progress", "completed"}:
            log_action(db, operator_id, request_id, "started", {}, now_iso(base_dt + timedelta(hours=13)))

        if status == "completed":
            if completed_at:
                log_action(db, operator_id, request_id, "completed", {"results_summary": results_summary}, completed_at)

        if status == "rejected":
            log_action(db, operator_id, request_id, "rejected", {"remarks": remarks}, now_iso(base_dt + timedelta(hours=11)))


def main() -> None:
    """Main entry point for demo data population."""
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    seed_full_demo(db)
    db.commit()

    # Print comprehensive summary
    print("\n" + "="*70)
    print("FULL DEMO DATA POPULATION COMPLETE")
    print("="*70)

    users = db.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    instruments = db.execute("SELECT COUNT(*) FROM instruments").fetchone()[0]
    requests = db.execute("SELECT COUNT(*) FROM sample_requests").fetchone()[0]
    audit_logs = db.execute("SELECT COUNT(*) FROM audit_logs").fetchone()[0]
    approval_steps = db.execute("SELECT COUNT(*) FROM approval_steps").fetchone()[0]

    print(f"\nUSERS: {users}")

    user_roles = db.execute("SELECT role, COUNT(*) AS count FROM users GROUP BY role ORDER BY role").fetchall()
    print("  By role:")
    for row in user_roles:
        print(f"    {row['role']}: {row['count']}")

    print(f"\nINSTRUMENTS: {instruments}")

    by_category = db.execute("SELECT category, COUNT(*) AS count FROM instruments GROUP BY category ORDER BY category").fetchall()
    print("  By category:")
    for row in by_category:
        print(f"    {row['category']}: {row['count']}")

    print(f"\nSAMPLE REQUESTS: {requests}")

    status_breakdown = db.execute("SELECT status, COUNT(*) AS total FROM sample_requests GROUP BY status ORDER BY status").fetchall()
    print("  By status:")
    for row in status_breakdown:
        pct = (row['total'] / requests) * 100
        print(f"    {row['status']}: {row['total']} ({pct:.1f}%)")

    origin_breakdown = db.execute("SELECT sample_origin, COUNT(*) AS total FROM sample_requests GROUP BY sample_origin").fetchall()
    print("  By origin:")
    for row in origin_breakdown:
        pct = (row['total'] / requests) * 100
        print(f"    {row['sample_origin']}: {row['total']} ({pct:.1f}%)")

    finance_breakdown = db.execute("SELECT finance_status, COUNT(*) AS total FROM sample_requests GROUP BY finance_status").fetchall()
    print("  By finance status:")
    for row in finance_breakdown:
        pct = (row['total'] / requests) * 100
        print(f"    {row['finance_status']}: {row['total']} ({pct:.1f}%)")

    total_amount_due = db.execute("SELECT SUM(amount_due) AS total FROM sample_requests").fetchone()["total"] or 0
    total_amount_paid = db.execute("SELECT SUM(amount_paid) AS total FROM sample_requests").fetchone()["total"] or 0

    print(f"\nFINANCIAL SUMMARY:")
    print(f"  Total amount due: ₹{total_amount_due:,.2f}")
    print(f"  Total amount paid: ₹{total_amount_paid:,.2f}")
    print(f"  Outstanding: ₹{total_amount_due - total_amount_paid:,.2f}")

    print(f"\nAUDIT & APPROVAL:")
    print(f"  Total audit log entries: {audit_logs}")
    print(f"  Total approval steps: {approval_steps}")

    db.close()
    print("\n" + "="*70)


if __name__ == "__main__":
    main()
