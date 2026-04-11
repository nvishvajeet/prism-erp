from __future__ import annotations

import io
import json
import shutil
import sys
from pathlib import Path

# After the v1.3.8 top-level cleanup this file lives in scripts/.
# Expose both the repo root (for `import app`) and scripts/ itself
# (for `import populate_live_demo`) on sys.path.
_SCRIPT_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _SCRIPT_DIR.parent
sys.path.insert(0, str(_REPO_ROOT))
sys.path.insert(0, str(_SCRIPT_DIR))

import app  # noqa: E402
import populate_live_demo  # noqa: E402


def login(client, email: str, password: str | None = None) -> None:
    # admin@lab.local uses "12345" in demo mode (public-facing demo
    # card on nvishvajeet.github.io). Every other demo account keeps
    # the legacy SimplePass123.
    if password is None:
        password = "12345" if email == "admin@lab.local" else "SimplePass123"
    response = client.post("/login", data={"email": email, "password": password}, follow_redirects=True)
    assert response.status_code == 200
    # Sanity: post-login response should be a logged-in PRISM page (not the
    # login form). Match against the universal `<title>` and a nav fragment
    # from base.html so the assertion survives template-level rewrites of
    # individual page bodies.
    assert b"PRISM" in response.data or b"Lab Scheduler" in response.data, (
        f"login({email!r}): post-login response did not contain PRISM/Lab Scheduler title"
    )
    assert b'name="email"' not in response.data, (
        f"login({email!r}): still on login form after submit — credentials wrong?"
    )


def main() -> None:
    if app.DB_PATH.exists():
        app.DB_PATH.unlink()
    if app.UPLOAD_DIR.exists():
        shutil.rmtree(app.UPLOAD_DIR)
    if app.EXPORT_DIR.exists():
        for export in app.EXPORT_DIR.glob("*.xlsx"):
            export.unlink()

    app.init_db()
    populate_live_demo.main()
    client = app.app.test_client()
    issue_message = "The vial label is smudged and may need verification."

    login(client, "sen@lab.local")
    response = client.post(
        "/requests/1",
        data={
            "action": "upload_attachment",
            "attachment_type": "request_document",
            "note": "Initial intake PDF",
            "attachment": (io.BytesIO(b"%PDF-1.4\n% demo pdf\n"), "intake-form.pdf"),
        },
        content_type="multipart/form-data",
        follow_redirects=True,
    )
    assert response.status_code == 200
    assert b"intake-form.pdf" in response.data or b"Attachment uploaded" in response.data
    response = client.post(
        "/requests/1",
        data={
            "action": "save_note",
            "note_kind": "requester_note",
            "note_body": "Please confirm whether the sample prep looks fine.",
        },
        follow_redirects=True,
    )
    assert b"Requester Note updated" in response.data
    assert b"Please confirm whether the sample prep looks fine." in response.data
    response = client.post(
        "/requests/1",
        data={
            "action": "post_message",
            "message_body": "Attached the corrected submission sheet.",
            "attachment": (io.BytesIO(b"%PDF-1.4\n% message attachment\n"), "message-sheet.pdf"),
        },
        content_type="multipart/form-data",
        follow_redirects=True,
    )
    assert b"Reply added" in response.data
    assert b"message-sheet.pdf" in response.data
    response = client.post(
        "/requests/1",
        data={
            "action": "flag_issue",
            "issue_message": issue_message,
        },
        follow_redirects=True,
    )
    assert response.status_code == 200
    assert b"Events" in response.data

    with app.app.app_context():
        db = app.get_db()
        attachment = db.execute("SELECT * FROM request_attachments WHERE original_filename = 'intake-form.pdf'").fetchone()
        assert attachment is not None
        stored_path = app.BASE_DIR / attachment["relative_path"]
        assert stored_path.exists()
        request_row = db.execute("SELECT request_no, instrument_id, created_at FROM sample_requests WHERE id = 1").fetchone()
        request_one_no = request_row["request_no"]
        month_bucket = app.request_month_bucket(request_row["created_at"])
        instrument_bucket = app.query_one("SELECT code FROM instruments WHERE id = ?", (request_row["instrument_id"],))["code"]
        assert f"uploads/requests/{month_bucket}/{instrument_bucket}/" in attachment["relative_path"]
        assert "/attachments/" in attachment["relative_path"]
        metadata_path = stored_path.parent.parent / "request_metadata.json"
        assert metadata_path.exists()
        snapshot = json.loads(metadata_path.read_text(encoding="utf-8"))
        assert snapshot["request_no"] == request_one_no
        assert snapshot["requester"]["email"] == "sen@lab.local"
        assert any(item["original_filename"] == "intake-form.pdf" for item in snapshot["attachments"])
        assert any(item["original_filename"] == "message-sheet.pdf" for item in snapshot["attachments"])
        assert any("corrected submission sheet" in item["message_body"] for item in snapshot["communication_notes"])
        assert any("smudged" in item["issue_message"] for item in snapshot["issues"])
        audit = db.execute(
            "SELECT 1 FROM audit_logs WHERE entity_type = 'sample_request' AND entity_id = 1 AND action = 'attachment_uploaded'"
        ).fetchone()
        assert audit is not None
        threaded_attachment = db.execute(
            "SELECT request_message_id FROM request_attachments WHERE original_filename = 'message-sheet.pdf'"
        ).fetchone()
        assert threaded_attachment is not None
        assert threaded_attachment["request_message_id"] is not None
        issue = db.execute(
            "SELECT * FROM request_issues WHERE request_id = 1 AND issue_message LIKE ?",
            (f"{issue_message.split('%')[0]}%",),
        ).fetchone()
        assert issue is not None
        message = db.execute(
            """
            SELECT *
            FROM request_messages
            WHERE request_id = 1
              AND note_kind = 'requester_note'
              AND message_body LIKE 'Please confirm whether the sample prep looks fine.%'
              AND is_active = 1
            """
        ).fetchone()
        assert message is not None

    # /my/history is a permanent redirect into /schedule as of v1.2.x —
    # the requester's "history" is just the queue scoped to them. Follow
    # the redirect and assert the queue rendered.
    response = client.get("/my/history", follow_redirects=True)
    assert response.status_code == 200
    assert request_one_no.encode() in response.data
    response = client.get("/me", follow_redirects=True)
    assert response.status_code == 200
    assert b"Work Summary" in response.data or b"Profile" in response.data
    response = client.post(
        "/requests/new",
        data={
            "instrument_id": "1",
            "title": "Slip generation check",
            "sample_name": "Slip sample",
            "sample_count": "1",
            "description": "Check generated slip PDF",
            "sample_origin": "external",
            "receipt_number": "",
            "amount_due": "100",
            "amount_paid": "0",
            "finance_status": "pending",
            "priority": "normal",
            "initial_attachment": (io.BytesIO(b"%PDF-1.4\n% request payload\n"), "request-input.pdf"),
        },
        content_type="multipart/form-data",
        follow_redirects=True,
    )
    assert b"Sample number" in response.data
    assert b"Files" in response.data

    response = client.get(f"/attachments/{attachment['id']}/download")
    assert response.status_code == 200
    response = client.get(f"/attachments/{attachment['id']}/view")
    assert response.status_code == 200

    with app.app.app_context():
        latest_request = app.get_db().execute(
            "SELECT id, request_no, sample_ref, receipt_number, sample_origin FROM sample_requests WHERE title = 'Slip generation check' ORDER BY id DESC LIMIT 1"
        ).fetchone()
        assert latest_request is not None
        assert latest_request["request_no"].startswith("J4")
        assert latest_request["sample_ref"].startswith("FEE")
        assert latest_request["sample_origin"] == "external"
        assert latest_request["receipt_number"].startswith("RCPT-83")
        slip_attachment = app.get_db().execute(
            "SELECT * FROM request_attachments WHERE request_id = ? AND attachment_type = 'sample_slip' AND is_active = 1",
            (latest_request["id"],),
        ).fetchone()
        assert slip_attachment is not None
        assert (app.BASE_DIR / slip_attachment["relative_path"]).exists()

    client.get("/logout")
    login(client, "admin@lab.local")
    response = client.post(
        "/requests/new",
        data={
            "instrument_id": "1",
            "requester_id": "9",
            "originator_note": "Submitted at the desk after the sample came back for reassessment.",
            "title": "Admin desk intake",
            "sample_name": "Returned powder sample",
            "sample_count": "1",
            "description": "Re-entered by facility admin on behalf of the requester.",
            "sample_origin": "internal",
            "receipt_number": "",
            "amount_due": "0",
            "amount_paid": "0",
            "finance_status": "n/a",
            "priority": "normal",
        },
        follow_redirects=True,
    )
    assert b"submitted for Prof. Sen" in response.data or b"submitted for" in response.data
    with app.app.app_context():
        admin_created = app.get_db().execute(
            "SELECT requester_id, created_by_user_id, originator_note FROM sample_requests WHERE title = 'Admin desk intake' ORDER BY id DESC LIMIT 1"
        ).fetchone()
        assert admin_created is not None
        assert admin_created["requester_id"] == 9
        admin_user = app.get_db().execute("SELECT id FROM users WHERE email = 'admin@lab.local'").fetchone()
        assert admin_user is not None
        assert admin_created["created_by_user_id"] == admin_user["id"]
        assert "reassessment" in (admin_created["originator_note"] or "")
        internal_receipt = app.get_db().execute(
            "SELECT receipt_number FROM sample_requests WHERE title = 'Admin desk intake' ORDER BY id DESC LIMIT 1"
        ).fetchone()
        assert internal_receipt is not None
        assert internal_receipt["receipt_number"].startswith("RCPT-17")
    # /history/processed was folded into the schedule queue
    # (bucket=completed) in v1.2.x — follow the redirect and assert
    # the queue page rendered.
    response = client.get("/history/processed", follow_redirects=True)
    assert response.status_code == 200
    response = client.get("/history/processed?q=J&page=1", follow_redirects=True)
    assert response.status_code == 200
    # /instruments/<id>/history is also a redirect into the queue
    # (scoped to that instrument) in v1.2.x.
    response = client.get("/instruments/1/history", follow_redirects=True)
    assert response.status_code == 200
    assert request_one_no.encode() in response.data
    response = client.get("/instruments/1")
    assert response.status_code == 200
    # Instrument detail page: tile architecture (v1.3.0+) —
    # check for canonical tiles, not the old "Edit Instrument" header.
    assert b"Control Panel" in response.data
    assert b"Queue" in response.data
    assert b"Metadata" in response.data
    response = client.get("/stats")
    assert response.status_code == 200
    response = client.get("/admin/users")
    assert response.status_code == 200
    response = client.get("/requests/1")
    assert response.status_code == 200
    assert b"Events" in response.data
    # Request detail tile architecture: at minimum the Events feed is there.
    # The action button text varies by lifecycle stage.
    with app.app.app_context():
        finance_step = app.get_db().execute(
            "SELECT id FROM approval_steps WHERE sample_request_id = 1 AND approver_role = 'finance' ORDER BY id LIMIT 1"
        ).fetchone()
    response = client.post(
        "/requests/1",
        data={"action": "assign_approver", "step_id": str(finance_step["id"]), "approver_user_id": "3"},
        follow_redirects=True,
    )
    assert response.status_code == 200
    assert b"approver updated" in response.data
    assert b"Facility Admin" in response.data
    assert b"Events" in response.data
    assert b"Audit Chain" not in response.data
    assert b"Immutable Audit Log" not in response.data
    response = client.post(
        "/requests/1",
        data={
            "action": "respond_issue",
            "issue_id": str(issue["id"]),
            "response_message": "Please bring the vial to the desk so we can verify it before loading.",
        },
        follow_redirects=True,
    )
    assert b"Issue response saved." in response.data
    assert response.status_code == 200
    response = client.post(
        "/requests/1",
        data={
            "action": "resolve_issue",
            "issue_id": str(issue["id"]),
            "response_message": "Label checked and issue resolved at intake.",
        },
        follow_redirects=True,
    )
    assert b"Issue marked as resolved." in response.data
    assert response.status_code == 200
    response = client.post(
        "/requests/1",
        data={
            "action": "save_note",
            "note_kind": "operator_note",
            "note_body": "Operator note: results PDF will be added after completion.",
        },
        follow_redirects=True,
    )
    assert b"Operator Note updated" in response.data
    assert response.status_code == 200
    # W1.3.8 — admin-issued temp passwords. `create_user` ignores any
    # submitted `password` field and generates a random temp. The user
    # is inserted with `invite_status='active'` + `must_change_password=1`;
    # first login forces a /change_password redirect. For the smoke test
    # we cannot recover the flashed temp, so we overwrite the hash in
    # place and clear must_change_password to fake "user has already
    # chosen their password".
    response = client.post(
        "/admin/users",
        data={
            "action": "create_user",
            "name": "Member Temp",
            "email": "member.temp@lab.local",
            "role": "requester",
        },
        follow_redirects=True,
    )
    assert b"member.temp@lab.local" in response.data
    from werkzeug.security import generate_password_hash as _gph
    with app.app.app_context():
        db = app.get_db()
        temp_member = db.execute("SELECT id FROM users WHERE email = 'member.temp@lab.local'").fetchone()
        assert temp_member is not None
        temp_member_id = temp_member["id"]
        db.execute(
            "UPDATE users SET password_hash = ?, must_change_password = 0 "
            "WHERE id = ?",
            (_gph("SimplePass123", method="pbkdf2:sha256"), temp_member_id),
        )
        db.commit()

    client.get("/logout")
    login(client, "member.temp@lab.local")
    response = client.get(f"/attachments/{attachment['id']}/download")
    assert response.status_code == 403
    assert client.get("/schedule").status_code == 403
    assert client.get("/calendar").status_code == 403
    response = client.get("/instruments")
    assert response.status_code == 403
    assert client.get("/users/9").status_code == 403
    response = client.get("/")
    # The 403 checks above are the real guard. The home page may still
    # include nav shells; visibility is enforced server-side.
    assert response.status_code == 200
    login(client, "admin@lab.local")

    response = client.post(
        "/calendar?instrument_id=1&date=2026-04-06&view=week",
        data={
            "instrument_id": "1",
            "start_time": "2026-04-07T09:00",
            "end_time": "2026-04-07T12:00",
            "reason": "Routine maintenance",
            "date": "2026-04-06",
            "view": "week",
        },
        follow_redirects=True,
    )
    assert b"Downtime block added" in response.data

    response = client.get("/calendar?date=2026-04-06&view=week&instrument_id=1")
    assert response.status_code == 200
    assert b"id=\"calendar_app\"" in response.data
    response = client.get("/calendar/events?instrument_id=1&show_scheduled=1&show_in_progress=1&show_completed=1&show_maintenance=1&start=2026-04-06&end=2026-04-13")
    assert response.status_code == 200
    event_titles = [event["title"] for event in response.get_json()]
    assert any("Maintenance" in title for title in event_titles)
    assert len(event_titles) >= 1

    response = client.get(f"/schedule?instrument_id=1&q={request_one_no}")
    assert response.status_code == 200
    assert request_one_no.encode() in response.data
    response = client.get("/schedule?requester_id=9")
    assert response.status_code == 200
    assert request_one_no.encode() in response.data
    assert b"Submitted" in client.get("/schedule").data

    with app.app.app_context():
        ready_row = app.get_db().execute(
            "SELECT id FROM sample_requests WHERE status = 'sample_received' ORDER BY id LIMIT 1"
        ).fetchone()
        assert ready_row is not None
        ready_request_id = ready_row["id"]

    response = client.post(
        "/schedule/actions",
        data={
            "action": "take_up",
            "request_id": str(ready_request_id),
            "scheduled_for": "2026-04-10T09:30",
            "assigned_operator_id": "",
            "remarks": "Taken up from board",
        },
        follow_redirects=True,
    )
    assert b"taken up for work" in response.data

    response = client.post(
        "/schedule/actions",
        data={
            "action": "start_now",
            "request_id": str(ready_request_id),
        },
        follow_redirects=True,
    )
    assert b"now in progress" in response.data

    response = client.post(
        "/schedule/actions",
        data={
            "action": "finish_now",
            "request_id": str(ready_request_id),
            "results_summary": "Board-finished run with usable output",
            "remarks": "Completed from operator board",
        },
        follow_redirects=True,
    )
    assert b"Job marked done." in response.data
    with app.app.app_context():
        finished_row = app.get_db().execute("SELECT status, completion_locked FROM sample_requests WHERE id = ?", (ready_request_id,)).fetchone()
        assert finished_row["status"] == "completed"
        assert finished_row["completion_locked"] == 1

    response = client.get("/stats")
    assert response.status_code == 200
    assert b"Export" in response.data
    response = client.get("/visualizations")
    assert response.status_code == 200
    assert b"Global Visualization" in response.data
    response = client.get("/visualizations/instrument/1")
    assert response.status_code == 200
    assert b"Visualization" in response.data
    response = client.get("/stats?horizon=weekly")
    assert response.status_code == 200
    assert b"Export" in response.data
    response = client.get("/stats?horizon=yearly")
    assert response.status_code == 200
    assert b"Export" in response.data
    response = client.get("/stats?horizon=range&date_from=2026-04-01&date_to=2026-04-30")
    assert response.status_code == 200
    assert b"Export" in response.data

    response = client.post(
        "/exports/generate",
        data={"horizon": "range", "date_from": "2026-04-01", "date_to": "2026-04-30"},
        follow_redirects=True,
    )
    assert b"Excel export created" in response.data
    assert b"Range" in response.data
    assert any(app.EXPORT_DIR.glob("*.xlsx"))

    too_big = io.BytesIO(b"x" * (101 * 1024 * 1024))
    response = client.post(
        "/requests/1",
        data={
            "action": "upload_attachment",
            "attachment_type": "request_document",
            "note": "oversized",
            "attachment": (too_big, "huge.pdf"),
        },
        content_type="multipart/form-data",
        follow_redirects=True,
    )
    assert b"Upload too large" in response.data

    client.get("/logout")
    login(client, "finance@lab.local")
    response = client.get("/my/history", follow_redirects=True)
    assert response.status_code == 200
    # Visibility matrix (v1.2.x+): finance can browse instruments,
    # calendar, stats, and schedule. Only admin surfaces are forbidden.
    assert client.get("/calendar").status_code == 200
    assert client.get("/stats").status_code == 200
    assert client.get("/instruments").status_code == 200
    assert client.get("/admin/users").status_code == 403
    assert client.get("/schedule").status_code == 200
    response = client.get("/requests/1")
    assert response.status_code == 200
    assert b"Equipment Page" not in response.data
    assert b"Instrument Calendar" not in response.data
    response = client.get("/")
    assert b"Operations" not in response.data
    assert b"Records" not in response.data

    client.get("/logout")
    login(client, "dean@lab.local")
    assert client.get("/admin/users").status_code == 200
    response = client.post(
        f"/users/{temp_member_id}",
        data={"action": "remove_access"},
        follow_redirects=True,
    )
    assert b"Access removed" in response.data

    client.get("/logout")
    login(client, "fesem.admin@lab.local")
    response = client.get("/my/history", follow_redirects=True)
    assert response.status_code == 200
    response = client.get("/instruments")
    assert response.status_code == 200
    assert b"FESEM" in response.data
    assert client.get("/calendar?instrument_id=2").status_code == 200
    response = client.get("/calendar/events?instrument_id=2&show_scheduled=1&show_in_progress=1&show_completed=1&show_maintenance=1&start=2026-04-06&end=2026-04-13")
    assert response.status_code == 200
    assert response.get_json() == []
    response = client.post(
        "/instruments/1",
        data={
            "action": "update_metadata",
            "office_info": "CIF Office Desk",
            "faculty_group": "Advanced Materials",
            "manufacturer": "Zeiss",
            "model_number": "Sigma 500",
            "capabilities_summary": "Updated capability summary for submitters.",
            "machine_photo_url": "https://example.com/fesem.jpg",
            "machine_photo_file": (io.BytesIO(b"\x89PNG\r\n\x1a\nplaceholder"), "fesem.png"),
            "reference_links": "https://example.com/fesem\nhttps://example.com/manual",
            "instrument_description": "Updated description",
            "notes": "Updated notes",
            "intake_mode": "maintenance",
        },
        content_type="multipart/form-data",
        follow_redirects=True,
    )
    assert b"Instrument page updated" in response.data
    assert b"Zeiss" in response.data
    assert b"Sigma 500" in response.data
    assert client.get("/admin/users").status_code == 403
    with app.app.app_context():
        instrument = app.get_db().execute("SELECT machine_photo_url FROM instruments WHERE id = 1").fetchone()
        assert instrument is not None
        assert instrument["machine_photo_url"].startswith("instrument_images/instrument_1_")
        assert (app.STATIC_DIR / instrument["machine_photo_url"]).exists()

    client.get("/logout")
    login(client, "sen@lab.local")
    response = client.post(
        "/requests/new",
        data={
            "instrument_id": "1",
            "title": "Queued maintenance request",
            "sample_name": "Queued sample",
            "sample_count": "2",
            "sample_origin": "internal",
            "priority": "normal",
            "receipt_number": "",
            "amount_due": "0",
            "amount_paid": "0",
            "finance_status": "n/a",
            "description": "Should queue until accepting",
            "initial_attachment": (io.BytesIO(b"%PDF-1.4\n% queued request\n"), "queued-request.pdf"),
        },
        content_type="multipart/form-data",
        follow_redirects=True,
    )
    assert b"not accepting jobs yet, so it has been queued" in response.data

    with app.app.app_context():
        queued_row = app.get_db().execute(
            "SELECT id, status FROM sample_requests WHERE title = ? ORDER BY id DESC LIMIT 1",
            ("Queued maintenance request",),
        ).fetchone()
        assert queued_row is not None
        assert queued_row["status"] == "submitted"

    client.get("/logout")
    login(client, "fesem.admin@lab.local")
    response = client.post(
        "/instruments/1",
        data={"action": "update_operation", "intake_mode": "accepting"},
        follow_redirects=True,
    )
    assert b"Released" in response.data and b"queued request" in response.data
    with app.app.app_context():
        released_row = app.get_db().execute(
            "SELECT status, remarks FROM sample_requests WHERE id = ?",
            (queued_row["id"],),
        ).fetchone()
        assert released_row is not None
        assert released_row["status"] == "under_review"
        assert "released into review" in (released_row["remarks"] or "").lower()

    client.get("/logout")
    response = client.post("/login", data={"email": "member.temp@lab.local", "password": "SimplePass123"}, follow_redirects=True)
    assert b"Invalid login" in response.data

    print("smoke test passed")


if __name__ == "__main__":
    main()
