from __future__ import annotations

import io
import shutil
import sqlite3
from pathlib import Path

import app
import populate_live_demo


BASE_DIR = Path(__file__).resolve().parent
SIM_PASSWORD = "SimplePass123"

EXTRA_USERS = [
    ("Dr. Menon", "menon@lab.local", "requester", "active"),
    ("Prof. Banerjee", "banerjee@lab.local", "requester", "active"),
    ("Dr. Kulkarni", "kulkarni@lab.local", "requester", "active"),
    ("Prof. Nair", "nair@lab.local", "requester", "active"),
    ("Dr. Kapoor", "kapoor@lab.local", "requester", "active"),
    ("Dr. Das", "das@lab.local", "requester", "active"),
    ("Sports Liaison", "sports@lab.local", "requester", "active"),
    ("XRD Admin", "xrd.admin@lab.local", "instrument_admin", "active"),
    ("XRD Operator", "leo@lab.local", "operator", "active"),
    ("DSC Operator", "fatima@lab.local", "operator", "active"),
]

EXTRA_INSTRUMENTS = [
    ("UV-Vis Spectrometer", "INST-005", "Spectroscopy", "Analytical Bay", 8, "Routine absorbance runs"),
    ("FTIR", "INST-006", "Spectroscopy", "Analytical Bay", 6, "Polymer and functional group confirmation"),
    ("Raman Microscope", "INST-007", "Microscopy", "Optics Room", 4, "Micro-Raman spot analysis"),
    ("AFM", "INST-008", "Microscopy", "Nanoscience Lab", 3, "Surface roughness and phase mapping"),
    ("GC-MS", "INST-009", "Chromatography", "Analytical Bay", 5, "Volatile compounds"),
    ("HPLC", "INST-010", "Chromatography", "Wet Chemistry Lab", 8, "Routine separations"),
]

ADMIN_MAP = {
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

OPERATOR_MAP = {
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

FACULTY_MAP = {
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

REQUESTER_POOL = [
    "sen@lab.local",
    "iyer@lab.local",
    "shah@lab.local",
    "menon@lab.local",
    "banerjee@lab.local",
    "kulkarni@lab.local",
    "nair@lab.local",
    "kapoor@lab.local",
    "das@lab.local",
    "sports@lab.local",
    "visiting.faculty@lab.local",
]

INSTRUMENT_SEQUENCE = [
    "INST-001",
    "INST-002",
    "INST-003",
    "INST-004",
    "INST-005",
    "INST-006",
    "INST-007",
    "INST-008",
    "INST-009",
    "INST-010",
]

TARGET_STATES = [
    "under_review",
    "awaiting_sample_submission",
    "sample_submitted",
    "sample_received",
    "scheduled",
    "in_progress",
    "completed",
    "completed",
    "rejected",
]


def reset_system() -> None:
    with app.app.app_context():
        app.close_db(None)
    if app.DB_PATH.exists():
        app.DB_PATH.unlink()
    shutil.rmtree(app.UPLOAD_DIR, ignore_errors=True)
    if app.EXPORT_DIR.exists():
        for export in app.EXPORT_DIR.glob("*.xlsx"):
            export.unlink()
    app.init_db()
    with app.app.app_context():
        db = app.get_db()
        for table in ("request_messages", "request_attachments", "approval_steps", "audit_logs", "generated_exports", "instrument_downtime", "sample_requests"):
            db.execute(f"DELETE FROM {table}")
        db.commit()


def db_fetchone(query: str, params: tuple = ()) -> sqlite3.Row | None:
    with app.app.app_context():
        return app.get_db().execute(query, params).fetchone()


def db_fetchall(query: str, params: tuple = ()) -> list[sqlite3.Row]:
    with app.app.app_context():
        return app.get_db().execute(query, params).fetchall()


def db_execute(query: str, params: tuple = ()) -> None:
    with app.app.app_context():
        db = app.get_db()
        db.execute(query, params)
        db.commit()


def login(client, email: str, password: str = SIM_PASSWORD) -> None:
    response = client.post("/login", data={"email": email, "password": password}, follow_redirects=True)
    assert response.status_code == 200, email


def logout(client) -> None:
    client.get("/logout")


def create_owner_seed(client) -> None:
    login(client, "admin@lab.local")
    for name, email in [("Member Meera", "meera.member@lab.local"), ("Visiting Faculty", "visiting.faculty@lab.local")]:
        response = client.post(
            "/admin/users",
            data={
                "action": "create_user",
                "name": name,
                "email": email,
                "role": "requester",
                "password": SIM_PASSWORD,
            },
            follow_redirects=True,
        )
        assert f"User {email} created.".encode() in response.data or f"User {email} already exists.".encode() in response.data
    logout(client)
    for name, email in [("Member Meera", "meera.member@lab.local"), ("Visiting Faculty", "visiting.faculty@lab.local")]:
        response = client.post(
            "/activate",
            data={"email": email, "password": SIM_PASSWORD, "name": name},
            follow_redirects=True,
        )
        assert b"Account activated" in response.data


def extend_users_and_instruments() -> None:
    with app.app.app_context():
        db = app.get_db()
        for record in EXTRA_USERS:
            populate_live_demo.ensure_user(db, *record)
        for record in EXTRA_INSTRUMENTS:
            populate_live_demo.ensure_instrument(db, *record)
        for code, email in ADMIN_MAP.items():
            instrument_id = db.execute("SELECT id FROM instruments WHERE code = ?", (code,)).fetchone()["id"]
            user_id = db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()["id"]
            populate_live_demo.assign_admin(db, user_id, instrument_id)
        for code, email in OPERATOR_MAP.items():
            instrument_id = db.execute("SELECT id FROM instruments WHERE code = ?", (code,)).fetchone()["id"]
            user_id = db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()["id"]
            populate_live_demo.assign_operator(db, user_id, instrument_id)
        for code, email in FACULTY_MAP.items():
            instrument_id = db.execute("SELECT id FROM instruments WHERE code = ?", (code,)).fetchone()["id"]
            user_id = db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()["id"]
            populate_live_demo.assign_faculty(db, user_id, instrument_id)
        db.commit()


def instrument_id_by_code(code: str) -> int:
    return db_fetchone("SELECT id FROM instruments WHERE code = ?", (code,))["id"]


def user_id_by_email(email: str) -> int:
    return db_fetchone("SELECT id FROM users WHERE email = ?", (email,))["id"]


def update_instrument_pages(client) -> None:
    for code in INSTRUMENT_SEQUENCE:
        instrument_id = instrument_id_by_code(code)
        admin_email = ADMIN_MAP[code]
        operator_email = OPERATOR_MAP[code]
        faculty_email = FACULTY_MAP[code]
        login(client, admin_email)
        response = client.post(
            f"/instruments/{instrument_id}",
            data={
                "action": "update_metadata",
                "office_info": f"Office for {code}",
                "faculty_group": f"Group for {code}",
                "instrument_description": f"Operational description for {code}.",
                "intake_mode": "accepting",
                "operator_ids": [str(user_id_by_email(operator_email))],
                "faculty_admin_ids": [str(user_id_by_email(faculty_email))],
            },
            follow_redirects=True,
        )
        assert b"Instrument page updated" in response.data
        logout(client)


def submit_request(client, requester_email: str, code: str, idx: int, include_attachment: bool = False) -> int:
    instrument_id = instrument_id_by_code(code)
    login(client, requester_email)
    data = {
        "instrument_id": str(instrument_id),
        "title": f"Simulated workflow request {idx}",
        "sample_name": f"Sample lot {idx}",
        "sample_count": str((idx % 5) + 1),
        "description": f"Simulated request {idx} through the web workflow for {code}.",
        "sample_origin": "external" if idx % 4 == 0 else "internal",
        "receipt_number": f"SIM-RCPT-{idx:04d}" if idx % 4 == 0 else "",
        "amount_due": "1800" if idx % 4 == 0 else "0",
        "amount_paid": "0",
        "finance_status": "pending" if idx % 4 == 0 else "n/a",
        "priority": "high" if idx % 3 == 0 else "normal",
    }
    if include_attachment:
        data["initial_attachment"] = (io.BytesIO(b"%PDF-1.4\n% simulated request\n"), f"sample-{idx}.pdf")
    response = client.post("/requests/new", data=data, content_type="multipart/form-data", follow_redirects=True)
    assert response.status_code == 200
    row = db_fetchone("SELECT id FROM sample_requests WHERE title = ? ORDER BY id DESC LIMIT 1", (f"Simulated workflow request {idx}",))
    assert row is not None
    request_id = row["id"]
    if idx % 6 == 0:
        msg = client.post(
            f"/requests/{request_id}",
            data={
                "action": "save_note",
                "note_kind": "requester_note",
                "note_body": f"Requester note for request {idx}.",
            },
            follow_redirects=True,
        )
        assert b"Requester Note updated" in msg.data
    logout(client)
    return request_id


def actionable_step(request_id: int, role: str) -> sqlite3.Row:
    return db_fetchone(
        """
        SELECT * FROM approval_steps
        WHERE sample_request_id = ? AND approver_role = ? AND status = 'pending'
        ORDER BY step_order
        LIMIT 1
        """,
        (request_id, role),
    )


def approve_to_ready(client, request_id: int, instrument_code: str, reject_role: str | None = None) -> None:
    for role, actor in [
        ("finance", "finance@lab.local"),
        ("professor", "prof.approver@lab.local"),
        ("operator", OPERATOR_MAP[instrument_code]),
    ]:
        step = actionable_step(request_id, role)
        if step is None:
            continue
        login(client, actor)
        action = "reject_step" if reject_role == role else "approve_step"
        response = client.post(
            f"/requests/{request_id}",
            data={"action": action, "step_id": str(step["id"]), "remarks": f"{role} workflow action"},
            follow_redirects=False,
        )
        assert response.status_code in {302, 303}
        logout(client)
        if reject_role == role:
            return


def mark_sample_submitted(client, request_id: int, requester_email: str) -> None:
    login(client, requester_email)
    response = client.post(
        f"/requests/{request_id}",
        data={"action": "mark_sample_submitted", "sample_dropoff_note": "Delivered to the lab intake desk"},
        follow_redirects=True,
    )
    assert response.status_code == 200
    logout(client)


def mark_sample_received(client, request_id: int, operator_email: str) -> None:
    login(client, operator_email)
    response = client.post(
        f"/requests/{request_id}",
        data={"action": "mark_sample_received", "remarks": "Received in acceptable condition"},
        follow_redirects=True,
    )
    assert response.status_code == 200
    logout(client)


def take_up_from_board(client, request_id: int, operator_email: str, slot: str) -> None:
    login(client, operator_email)
    response = client.post(
        "/schedule/actions",
        data={
            "action": "take_up",
            "request_id": str(request_id),
            "scheduled_for": slot,
            "assigned_operator_id": str(user_id_by_email(operator_email)),
            "remarks": "Taken up by operator from board",
        },
        follow_redirects=True,
    )
    assert b"taken up for work" in response.data
    logout(client)


def start_from_board(client, request_id: int, operator_email: str) -> None:
    login(client, operator_email)
    response = client.post(
        "/schedule/actions",
        data={"action": "start_now", "request_id": str(request_id)},
        follow_redirects=True,
    )
    assert b"now in progress" in response.data
    logout(client)


def finish_from_board(client, request_id: int, operator_email: str, idx: int) -> None:
    login(client, operator_email)
    response = client.post(
        "/schedule/actions",
        data={
            "action": "finish_now",
            "request_id": str(request_id),
            "results_summary": f"Simulated result package {idx}",
            "remarks": "Completed through board workflow",
        },
        follow_redirects=True,
    )
    assert b"Job marked done." in response.data
    response = client.post(
        f"/requests/{request_id}",
        data={
            "action": "upload_attachment",
            "attachment_type": "result_document",
            "note": "Final report",
            "attachment": (io.BytesIO(b"%PDF-1.4\n% result report\n"), f"result-{idx}.pdf"),
        },
        content_type="multipart/form-data",
        follow_redirects=True,
    )
    assert response.status_code == 200
    assert b"result-" in response.data or b"Attachment uploaded" in response.data
    logout(client)


def add_corner_case_checks(client) -> None:
    # Instrument temporarily closed to new jobs
    instrument_id = instrument_id_by_code("INST-008")
    login(client, ADMIN_MAP["INST-008"])
    response = client.post(
        f"/instruments/{instrument_id}",
        data={
            "action": "update_metadata",
            "office_info": "Office for INST-008",
            "faculty_group": "Group for INST-008",
            "instrument_description": "Operational description for INST-008.",
            "intake_mode": "maintenance",
            "operator_ids": [str(user_id_by_email(OPERATOR_MAP["INST-008"]))],
            "faculty_admin_ids": [str(user_id_by_email(FACULTY_MAP["INST-008"]))],
        },
        follow_redirects=True,
    )
    assert b"Instrument page updated" in response.data
    logout(client)

    login(client, "meera.member@lab.local")
    queued = client.post(
        "/requests/new",
        data={
            "instrument_id": str(instrument_id),
            "title": "Queued intake check",
            "sample_name": "Queued sample",
            "sample_count": "1",
            "description": "Should be queued until intake opens",
            "sample_origin": "internal",
            "priority": "normal",
            "finance_status": "n/a",
            "amount_due": "0",
            "amount_paid": "0",
        },
        follow_redirects=True,
    )
    assert b"queued" in queued.data
    assert client.get("/schedule").status_code == 403
    logout(client)

    login(client, "finance@lab.local")
    assert client.get("/calendar").status_code == 403
    logout(client)

    login(client, "xrd.admin@lab.local")
    assert client.get(f"/instruments/{instrument_id}").status_code == 403
    logout(client)

    with app.app.app_context():
        queued_row = app.get_db().execute(
            "SELECT status FROM sample_requests WHERE title = 'Queued intake check' ORDER BY id DESC LIMIT 1"
        ).fetchone()
        assert queued_row is not None
        assert queued_row["status"] == "submitted"

    # Re-open after queued-intake check.
    login(client, ADMIN_MAP["INST-008"])
    response = client.post(
        f"/instruments/{instrument_id}",
        data={
            "action": "update_metadata",
            "office_info": "Office for INST-008",
            "faculty_group": "Group for INST-008",
            "instrument_description": "Operational description for INST-008.",
            "intake_mode": "accepting",
            "operator_ids": [str(user_id_by_email(OPERATOR_MAP["INST-008"]))],
            "faculty_admin_ids": [str(user_id_by_email(FACULTY_MAP["INST-008"]))],
        },
        follow_redirects=True,
    )
    assert b"Instrument page updated" in response.data
    assert b"Released" in response.data
    logout(client)


def simulate_requests(client) -> None:
    request_ids: list[int] = []
    for idx in range(1, 35):
        requester = REQUESTER_POOL[(idx - 1) % len(REQUESTER_POOL)]
        code = INSTRUMENT_SEQUENCE[(idx - 1) % len(INSTRUMENT_SEQUENCE)]
        request_id = submit_request(client, requester, code, idx, include_attachment=(idx % 3 == 0))
        request_ids.append(request_id)

        target = TARGET_STATES[(idx - 1) % len(TARGET_STATES)]
        if target == "rejected":
            approve_to_ready(client, request_id, code, reject_role="operator" if idx % 2 == 0 else "finance")
            continue

        approve_to_ready(client, request_id, code)
        if target == "under_review":
            continue
        if target == "awaiting_sample_submission":
            continue

        requester = REQUESTER_POOL[(idx - 1) % len(REQUESTER_POOL)]
        operator_email = OPERATOR_MAP[code]
        mark_sample_submitted(client, request_id, requester)
        if target == "sample_submitted":
            continue

        mark_sample_received(client, request_id, operator_email)
        if target == "sample_received":
            continue

        slot = f"2026-04-{10 + (idx % 15):02d}T{9 + (idx % 6):02d}:00"
        take_up_from_board(client, request_id, operator_email, slot)
        if target == "scheduled":
            continue

        start_from_board(client, request_id, operator_email)
        if target == "in_progress":
            continue
        if target == "completed":
            finish_from_board(client, request_id, operator_email, idx)

    assert len(request_ids) >= 34


def add_downtime_and_export(client) -> None:
    login(client, "admin@lab.local")
    response = client.post(
        "/calendar?instrument_id=1&date=2026-04-06&view=week",
        data={
            "instrument_id": "1",
            "start_time": "2026-04-21T09:00",
            "end_time": "2026-04-21T13:00",
            "reason": "Column replacement and recalibration",
            "date": "2026-04-06",
            "view": "week",
        },
        follow_redirects=True,
    )
    assert b"Downtime block added" in response.data
    response = client.post(
        "/exports/generate",
        data={"horizon": "monthly"},
        follow_redirects=True,
    )
    assert b"Excel export created" in response.data
    logout(client)


def final_assertions() -> None:
    with app.app.app_context():
        db = app.get_db()
        instrument_count = db.execute("SELECT COUNT(*) AS c FROM instruments").fetchone()["c"]
        request_count = db.execute("SELECT COUNT(*) AS c FROM sample_requests").fetchone()["c"]
        attachment_count = db.execute("SELECT COUNT(*) AS c FROM request_attachments WHERE is_active = 1").fetchone()["c"]
        note_count = db.execute("SELECT COUNT(*) AS c FROM request_messages WHERE is_active = 1").fetchone()["c"]
        status_rows = db.execute("SELECT status, COUNT(*) AS c FROM sample_requests GROUP BY status ORDER BY status").fetchall()
        status_counts = {row["status"]: row["c"] for row in status_rows}
        assert instrument_count == 10
        assert request_count >= 30
        assert attachment_count >= 10
        assert note_count >= 5
        for expected in ("under_review", "awaiting_sample_submission", "sample_submitted", "sample_received", "scheduled", "in_progress", "completed", "rejected"):
            assert status_counts.get(expected, 0) >= 1, expected
        print("Simulated live dataset ready.")
        print(f"instruments: {instrument_count}")
        print(f"requests: {request_count}")
        print(f"attachments: {attachment_count}")
        print(f"communication notes: {note_count}")
        print("status breakdown:")
        for key in sorted(status_counts):
            print(f"  {key}: {status_counts[key]}")


def main() -> None:
    reset_system()
    extend_users_and_instruments()
    client = app.app.test_client()
    create_owner_seed(client)
    update_instrument_pages(client)
    add_corner_case_checks(client)
    simulate_requests(client)
    add_downtime_and_export(client)
    final_assertions()


if __name__ == "__main__":
    main()
