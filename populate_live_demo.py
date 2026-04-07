from __future__ import annotations

import hashlib
import json
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

from werkzeug.security import generate_password_hash


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "lab_scheduler.db"
DEFAULT_PASSWORD = "SimplePass123"


def now_iso(dt: datetime | None = None) -> str:
    value = dt or datetime.utcnow()
    return value.replace(microsecond=0).isoformat() + "Z"


def log_action(db: sqlite3.Connection, actor_id: int | None, request_id: int, action: str, payload: dict, created_at: str) -> None:
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
    db.execute(
        "INSERT OR IGNORE INTO instrument_admins (user_id, instrument_id) VALUES (?, ?)",
        (user_id, instrument_id),
    )


def assign_operator(db: sqlite3.Connection, user_id: int, instrument_id: int) -> None:
    db.execute(
        "INSERT OR IGNORE INTO instrument_operators (user_id, instrument_id) VALUES (?, ?)",
        (user_id, instrument_id),
    )


def assign_faculty(db: sqlite3.Connection, user_id: int, instrument_id: int) -> None:
    db.execute(
        "INSERT OR IGNORE INTO instrument_faculty_admins (user_id, instrument_id) VALUES (?, ?)",
        (user_id, instrument_id),
    )


def next_request_number(db: sqlite3.Connection) -> str:
    row = db.execute("SELECT COUNT(*) AS c FROM sample_requests").fetchone()
    return f"REQ-{2001 + row['c']}"


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
    instrument_id = db.execute("SELECT id FROM instruments WHERE code = ?", (instrument_code,)).fetchone()["id"]
    finance_id = db.execute("SELECT id FROM users WHERE role = 'finance_admin' ORDER BY id LIMIT 1").fetchone()["id"]
    professor_id = db.execute("SELECT id FROM users WHERE role = 'professor_approver' ORDER BY id LIMIT 1").fetchone()["id"]
    operator_id = db.execute(
        """
        SELECT u.id
        FROM users u
        JOIN instrument_operators io ON io.user_id = u.id
        WHERE io.instrument_id = ?
        ORDER BY u.id
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


def seed_live_demo(db: sqlite3.Connection) -> None:
    users = [
        ("Dr. Menon", "menon@lab.local", "requester", "active"),
        ("Prof. Banerjee", "banerjee@lab.local", "requester", "active"),
        ("Dr. Kulkarni", "kulkarni@lab.local", "requester", "active"),
        ("Prof. Nair", "nair@lab.local", "requester", "active"),
        ("Dr. Kapoor", "kapoor@lab.local", "requester", "active"),
        ("Dr. Das", "das@lab.local", "requester", "active"),
        ("Member One", "member1@lab.local", "requester", "active"),
        ("Member Two", "member2@lab.local", "requester", "active"),
        ("Member Meera", "meera.member@lab.local", "requester", "invited"),
        ("Sports Liaison", "sports@lab.local", "requester", "active"),
        ("XRD Admin", "xrd.admin@lab.local", "instrument_admin", "active"),
        ("XRD Operator", "leo@lab.local", "operator", "active"),
        ("DSC Operator", "fatima@lab.local", "operator", "active"),
    ]
    for record in users:
        ensure_user(db, *record)

    instruments = [
        ("UV-Vis Spectrometer", "INST-005", "Spectroscopy", "Analytical Bay", 8, "Routine absorbance runs", "Shimadzu", "UV-2600", "Routine absorbance scans, kinetics checks, and calibration curve workflows.", "https://images.unsplash.com/photo-1581092919535-7146ff1a590e?auto=format&fit=crop&w=900&q=80", "https://www.shimadzu.com/"),
        ("FTIR", "INST-006", "Spectroscopy", "Analytical Bay", 6, "Polymer and functional group confirmation", "PerkinElmer", "Spectrum Two", "Functional group confirmation, polymer checks, and quick library matching.", "https://images.unsplash.com/photo-1511174511562-5f7f18b874f8?auto=format&fit=crop&w=900&q=80", "https://www.perkinelmer.com/"),
        ("Raman Microscope", "INST-007", "Microscopy", "Optics Room", 4, "Micro-Raman spot analysis", "Horiba", "LabRAM", "Micro-Raman spot mapping and defect site comparison.", "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=900&q=80", "https://www.horiba.com/"),
        ("AFM", "INST-008", "Microscopy", "Nanoscience Lab", 3, "Surface roughness and phase mapping", "Bruker", "Dimension Icon", "Surface roughness, topography, and nanoscale phase mapping.", "https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=900&q=80", "https://www.bruker.com/"),
        ("GC-MS", "INST-009", "Chromatography", "Analytical Bay", 5, "Volatile compounds", "Thermo Scientific", "ISQ 7000", "Volatile compound profiling and solvent impurity screening.", "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=900&q=80", "https://www.thermofisher.com/"),
        ("HPLC", "INST-010", "Chromatography", "Wet Chemistry Lab", 8, "Routine separations", "Waters", "Alliance e2695", "Routine separations, quantification, and method transfer support.", "https://images.unsplash.com/photo-1532635241-17e820acc59f?auto=format&fit=crop&w=900&q=80", "https://www.waters.com/"),
    ]
    for record in instruments:
        ensure_instrument(db, *record)

    admin_map = {
        "INST-001": "fesem.admin@lab.local",
        "INST-002": "icpms.admin@lab.local",
        "INST-003": "xrd.admin@lab.local",
        "INST-004": "xrd.admin@lab.local",
        "INST-005": "icpms.admin@lab.local",
        "INST-006": "icpms.admin@lab.local",
        "INST-007": "fesem.admin@lab.local",
        "INST-008": "fesem.admin@lab.local",
        "INST-009": "icpms.admin@lab.local",
        "INST-010": "xrd.admin@lab.local",
    }
    operator_map = {
        "INST-001": "anika@lab.local",
        "INST-002": "ravi@lab.local",
        "INST-003": "leo@lab.local",
        "INST-004": "fatima@lab.local",
        "INST-005": "ravi@lab.local",
        "INST-006": "ravi@lab.local",
        "INST-007": "anika@lab.local",
        "INST-008": "anika@lab.local",
        "INST-009": "ravi@lab.local",
        "INST-010": "ravi@lab.local",
    }
    faculty_map = {
        "INST-001": "sen@lab.local",
        "INST-002": "iyer@lab.local",
        "INST-003": "shah@lab.local",
        "INST-004": "banerjee@lab.local",
        "INST-005": "menon@lab.local",
        "INST-006": "kulkarni@lab.local",
        "INST-007": "nair@lab.local",
        "INST-008": "kapoor@lab.local",
        "INST-009": "das@lab.local",
        "INST-010": "sports@lab.local",
    }
    for code, email in admin_map.items():
        instrument_id = db.execute("SELECT id FROM instruments WHERE code = ?", (code,)).fetchone()["id"]
        user_id = db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()["id"]
        assign_admin(db, user_id, instrument_id)
    for code, email in operator_map.items():
        instrument_id = db.execute("SELECT id FROM instruments WHERE code = ?", (code,)).fetchone()["id"]
        user_id = db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()["id"]
        assign_operator(db, user_id, instrument_id)
    for code, email in faculty_map.items():
        instrument_id = db.execute("SELECT id FROM instruments WHERE code = ?", (code,)).fetchone()["id"]
        user_id = db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()["id"]
        assign_faculty(db, user_id, instrument_id)

    if db.execute("SELECT COUNT(*) FROM sample_requests WHERE request_no LIKE 'REQ-2%'").fetchone()[0]:
        return

    base = datetime(2026, 4, 1, 9, 0, 0)
    request_specs = [
        ("menon@lab.local", "INST-002", "Industrial effluent panel", "Effluent Set A", 6, "Trace metal screen for effluent samples.", "external", "RCPT-9011", 2500, 1000, "partial", "high", "under_review", "ravi@lab.local", None, "Waiting for professor approval", "", "", None, None, None, "finance_only"),
        ("banerjee@lab.local", "INST-001", "Nanocoating morphology", "TiN coated coupon batch", 4, "Surface imaging request for coated coupons.", "internal", "", 0, 0, "n/a", "normal", "under_review", "anika@lab.local", None, "Freshly submitted today", "", "", None, None, None, "pending"),
        ("kulkarni@lab.local", "INST-003", "Ceramic phase verification", "Zirconia pellet lot 4", 3, "Need phase check before report release.", "internal", "", 0, 0, "n/a", "normal", "awaiting_sample_submission", "leo@lab.local", None, "Approved and waiting for physical dropoff", "", "", None, None, None, "fully_approved"),
        ("nair@lab.local", "INST-004", "Polymer blend transition", "Blend series B", 5, "DSC run for Tg/Tm comparison.", "external", "RCPT-9012", 1800, 1800, "paid", "normal", "sample_submitted", "fatima@lab.local", None, "Sample submitted at thermal suite", "", "Stored in thermal suite fridge", now_iso(base + timedelta(days=1, hours=2)), None, None, "fully_approved"),
        ("kapoor@lab.local", "INST-005", "Catalyst absorbance series", "Catalyst wash set", 8, "Routine UV-Vis absorbance scans.", "internal", "", 0, 0, "n/a", "normal", "sample_received", "ravi@lab.local", None, "Received and waiting for bench slot", "", "Received in rack 2", now_iso(base + timedelta(days=2, hours=1)), now_iso(base + timedelta(days=2, hours=4)), None, "fully_approved"),
        ("das@lab.local", "INST-006", "Polymer FTIR confirmation", "Copolymer film strip", 3, "Confirm characteristic peaks after curing.", "internal", "", 0, 0, "n/a", "normal", "scheduled", "ravi@lab.local", "2026-04-06T11:00", "Scheduled in afternoon slot", "", "At instrument bench", now_iso(base + timedelta(days=3, hours=1)), now_iso(base + timedelta(days=3, hours=3)), None, "fully_approved"),
        ("iyer@lab.local", "INST-009", "Solvent impurity check", "Solvent drums composite", 4, "GC-MS scan before procurement signoff.", "external", "RCPT-9013", 2200, 1200, "partial", "high", "in_progress", "ravi@lab.local", "2026-04-05T14:30", "Sample loaded and sequence started", "", "Handed to operator directly", now_iso(base + timedelta(days=4, hours=1)), now_iso(base + timedelta(days=4, hours=2)), None, "fully_approved"),
        ("shah@lab.local", "INST-010", "Dye batch HPLC", "Dye process batch 17", 7, "Quantification for process consistency.", "external", "RCPT-9014", 3000, 3000, "paid", "high", "completed", "ravi@lab.local", "2026-04-04T10:00", "Completed and report issued", "Chromatograms cleaned and shared with requester.", "Submitted to wet chemistry counter", now_iso(base + timedelta(days=5, hours=1)), now_iso(base + timedelta(days=5, hours=2)), now_iso(base + timedelta(days=5, hours=7)), "fully_approved"),
        ("sen@lab.local", "INST-010", "Method transfer check", "Method batch C7", 2, "HPLC method transfer confirmation for reporting.", "internal", "", 0, 0, "n/a", "normal", "completed", "ravi@lab.local", "2026-04-03T09:30", "Completed and locked", "Method transfer reported and archived.", "Left at wet chemistry desk", now_iso(base + timedelta(days=6, hours=1)), now_iso(base + timedelta(days=6, hours=2)), now_iso(base + timedelta(days=6, hours=6)), "fully_approved"),
        ("banerjee@lab.local", "INST-004", "Thermal stability screen", "Additive batch 9", 4, "DSC thermal profile for review meeting.", "internal", "", 0, 0, "n/a", "normal", "rejected", "fatima@lab.local", None, "Rejected after sample leak in pan", "", "Container leaked during handoff", now_iso(base + timedelta(days=7, hours=1)), now_iso(base + timedelta(days=7, hours=2)), None, "fully_approved"),
        ("menon@lab.local", "INST-007", "Raman mapping of defect sites", "Wafer coupon grid", 2, "Spot map around visible defects.", "internal", "", 0, 0, "n/a", "normal", "rejected", "anika@lab.local", None, "Rejected during approval", "", "", None, None, None, "operator_rejected"),
        ("kapoor@lab.local", "INST-008", "Roughness comparison", "Thin film set D", 3, "AFM comparison before and after plasma treatment.", "internal", "", 0, 0, "n/a", "normal", "awaiting_sample_submission", "anika@lab.local", None, "Approval complete, sample not yet submitted to lab", "", "", None, None, None, "fully_approved"),
    ]

    extra_batch = []
    requesters = ["sen@lab.local", "iyer@lab.local", "shah@lab.local", "menon@lab.local", "banerjee@lab.local", "kulkarni@lab.local", "nair@lab.local", "kapoor@lab.local"]
    instruments_cycle = ["INST-001", "INST-002", "INST-003", "INST-004", "INST-005", "INST-006", "INST-009", "INST-010"]
    statuses_cycle = [
        ("under_review", "finance_only"),
        ("awaiting_sample_submission", "fully_approved"),
        ("sample_submitted", "fully_approved"),
        ("sample_received", "fully_approved"),
        ("scheduled", "fully_approved"),
        ("completed", "fully_approved"),
    ]
    for idx in range(18):
        requester = requesters[idx % len(requesters)]
        code = instruments_cycle[idx % len(instruments_cycle)]
        status, approval_state = statuses_cycle[idx % len(statuses_cycle)]
        origin = "external" if idx % 4 == 0 else "internal"
        amount_due = 1200 + idx * 150 if origin == "external" else 0
        amount_paid = amount_due if status == "completed" else (amount_due / 2 if origin == "external" and idx % 2 == 0 else 0)
        finance_status = "paid" if amount_due and amount_paid >= amount_due else ("partial" if amount_paid else ("pending" if amount_due else "n/a"))
        operator_email = operator_map[code]
        dt = base + timedelta(days=8 + idx, hours=idx % 5)
        sample_submitted = now_iso(dt + timedelta(hours=2)) if status in {"sample_submitted", "sample_received", "scheduled", "completed"} else None
        sample_received = now_iso(dt + timedelta(hours=5)) if status in {"sample_received", "scheduled", "completed"} else None
        scheduled_for = (dt + timedelta(days=1)).strftime("%Y-%m-%dT%H:%M") if status in {"scheduled", "completed"} else None
        completed_at = now_iso(dt + timedelta(days=1, hours=3)) if status == "completed" else None
        results = f"Auto-seeded result summary for live demo request {idx + 1}." if status == "completed" else ""
        remarks = f"Live demo request seeded in state {status}."
        dropoff_note = "Left with front desk technician" if sample_submitted else ""
        extra_batch.append(
            (
                requester,
                code,
                f"Live demo workflow request {idx + 1}",
                f"Sample lot {idx + 1}",
                (idx % 5) + 1,
                f"Auto-generated realistic request {idx + 1} for operator queue demo.",
                origin,
                f"RCPT-{9200 + idx}" if origin == "external" else "",
                amount_due,
                amount_paid,
                finance_status,
                "high" if idx % 3 == 0 else "normal",
                status,
                operator_email,
                scheduled_for,
                remarks,
                results,
                dropoff_note,
                sample_submitted,
                sample_received,
                completed_at,
                approval_state,
            )
        )

    for idx, spec in enumerate(request_specs + extra_batch):
        (
            requester_email,
            instrument_code,
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
            operator_email,
            scheduled_for,
            remarks,
            results_summary,
            sample_dropoff_note,
            sample_submitted_at,
            sample_received_at,
            completed_at,
            approval_state,
        ) = spec
        request_base = base + timedelta(hours=idx * 4)
        request_id = create_request(
            db,
            requester_email,
            instrument_code,
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
            request_base,
            operator_email=operator_email,
            scheduled_for=scheduled_for,
            remarks=remarks,
            results_summary=results_summary,
            sample_dropoff_note=sample_dropoff_note,
            sample_submitted_at=sample_submitted_at,
            sample_received_at=sample_received_at,
            completed_at=completed_at,
        )
        create_approval_chain(db, request_id, instrument_code, request_base, approval_state)

        requester_id = db.execute("SELECT id FROM users WHERE email = ?", (requester_email,)).fetchone()["id"]
        actor_operator = db.execute("SELECT id FROM users WHERE email = ?", (operator_email,)).fetchone()["id"] if operator_email else None
        log_action(db, requester_id, request_id, "submitted", {"status": "submitted"}, now_iso(request_base))
        if approval_state in {"finance_only", "professor_pending", "fully_approved", "operator_rejected"}:
            finance_id = db.execute("SELECT id FROM users WHERE email = 'finance@lab.local'").fetchone()["id"]
            log_action(db, finance_id, request_id, "finance_approved", {}, now_iso(request_base + timedelta(hours=3)))
        if approval_state in {"fully_approved", "operator_rejected"}:
            professor_id = db.execute("SELECT id FROM users WHERE email = 'prof.approver@lab.local'").fetchone()["id"]
            log_action(db, professor_id, request_id, "professor_approved", {}, now_iso(request_base + timedelta(hours=6)))
        if approval_state == "fully_approved":
            log_action(db, actor_operator, request_id, "operator_approved", {}, now_iso(request_base + timedelta(hours=9)))
        if approval_state == "operator_rejected":
            log_action(db, actor_operator, request_id, "operator_rejected", {"reason": "Instrument not suitable"}, now_iso(request_base + timedelta(hours=9)))
        if sample_submitted_at:
            log_action(db, requester_id, request_id, "sample_submitted", {"dropoff_note": sample_dropoff_note}, sample_submitted_at)
        if sample_received_at:
            log_action(db, actor_operator, request_id, "sample_received", {}, sample_received_at)
        if scheduled_for:
            log_action(db, actor_operator, request_id, "scheduled", {"scheduled_for": scheduled_for}, now_iso(request_base + timedelta(hours=12)))
        if status == "in_progress":
            log_action(db, actor_operator, request_id, "started", {}, now_iso(request_base + timedelta(hours=13)))
        if status == "completed" and completed_at:
            log_action(db, actor_operator, request_id, "completed", {"results_summary": results_summary}, completed_at)
        if status == "rejected":
            log_action(db, actor_operator, request_id, "rejected", {"remarks": remarks}, now_iso(request_base + timedelta(hours=11)))
        if status == "rejected":
            log_action(db, actor_operator, request_id, "rejected", {"remarks": remarks}, now_iso(request_base + timedelta(hours=10)))

    seeded_originators = {
        "REQ-1001": "admin@lab.local",
        "REQ-1002": "fesem.admin@lab.local",
        "REQ-1003": "admin@lab.local",
    }
    for request_no, originator_email in seeded_originators.items():
        originator_id = db.execute("SELECT id FROM users WHERE email = ?", (originator_email,)).fetchone()["id"]
        request_row = db.execute("SELECT id FROM sample_requests WHERE request_no = ?", (request_no,)).fetchone()
        if request_row:
            db.execute(
                "UPDATE sample_requests SET created_by_user_id = ? WHERE id = ?",
                (originator_id, request_row["id"]),
            )
            db.execute(
                """
                UPDATE audit_logs
                SET actor_id = ?
                WHERE entity_type = 'sample_request' AND entity_id = ? AND action = 'submitted'
                """,
                (originator_id, request_row["id"]),
            )


def main() -> None:
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    seed_live_demo(db)
    db.commit()
    counts = {
        "users": db.execute("SELECT COUNT(*) FROM users").fetchone()[0],
        "instruments": db.execute("SELECT COUNT(*) FROM instruments").fetchone()[0],
        "requests": db.execute("SELECT COUNT(*) FROM sample_requests").fetchone()[0],
        "audit_logs": db.execute("SELECT COUNT(*) FROM audit_logs").fetchone()[0],
    }
    print("Live demo population complete.")
    for key, value in counts.items():
        print(f"{key}: {value}")
    print("Request status breakdown:")
    for row in db.execute("SELECT status, COUNT(*) AS total FROM sample_requests GROUP BY status ORDER BY status"):
        print(f"  {row['status']}: {row['total']}")
    db.close()


if __name__ == "__main__":
    main()
