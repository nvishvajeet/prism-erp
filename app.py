from __future__ import annotations

import hashlib
import json
import math
import mimetypes
import os
import random
import smtplib
import sqlite3
from contextlib import closing
from datetime import date, datetime, timedelta
from email.message import EmailMessage
from functools import wraps
from io import BytesIO
from pathlib import Path

from flask import Flask, abort, flash, g, jsonify, redirect, render_template, request, send_file, send_from_directory, session, url_for
from openpyxl import Workbook
from werkzeug.utils import secure_filename
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.exceptions import RequestEntityTooLarge


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "lab_scheduler.db"
EXPORT_DIR = BASE_DIR / "exports"
UPLOAD_DIR = BASE_DIR / "uploads"
STATIC_DIR = BASE_DIR / "static"
INSTRUMENT_IMAGE_DIR = STATIC_DIR / "instrument_images"
ALLOWED_EXTENSIONS = {"pdf", "png", "jpg", "jpeg", "xlsx", "csv", "txt"}
POST_COMPLETION_UPLOAD_ROLES = {"super_admin", "instrument_admin", "operator"}
COMMUNICATION_NOTE_TYPES = [
    ("requester_note", "Requester Note", "Question or clarification from the submitting member."),
    ("lab_reply", "Lab Reply", "Single reply from the lab side for coordination."),
    ("operator_note", "Operator Note", "Operational note from the operator or instrument admin."),
    ("final_note", "Final Note", "Final handoff note shared with the requester."),
]
OWNER_EMAILS = {
    email.strip().lower()
    for email in os.environ.get("OWNER_EMAILS", "admin@lab.local").split(",")
    if email.strip()
}
DEMO_ROLE_SWITCHES = {
    "owner": {"label": "Owner", "email": "admin@lab.local"},
    "super_admin": {"label": "Super Admin", "email": "dean@lab.local"},
    "instrument_admin": {"label": "Instrument Admin", "email": "fesem.admin@lab.local"},
    "faculty_in_charge": {"label": "Faculty In-Charge", "email": "sen@lab.local"},
    "operator": {"label": "Operator", "email": "anika@lab.local"},
    "member": {"label": "Member", "email": "shah@lab.local"},
    "finance": {"label": "Finance", "email": "finance@lab.local"},
    "professor": {"label": "Professor", "email": "prof.approver@lab.local"},
}

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("LAB_SCHEDULER_SECRET_KEY", "lab-scheduler-dev-secret")
app.config["SMTP_HOST"] = os.environ.get("SMTP_HOST", "localhost")
app.config["SMTP_PORT"] = int(os.environ.get("SMTP_PORT", "25"))
app.config["MAX_CONTENT_LENGTH"] = 100 * 1024 * 1024
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = os.environ.get("LAB_SCHEDULER_COOKIE_SECURE", "").lower() in {"1", "true", "yes"}
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(hours=12)
app.config["SESSION_REFRESH_EACH_REQUEST"] = True


def now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def generate_unique_reference(prefix: str, table: str, column: str) -> str:
    db = get_db()
    while True:
        candidate = f"{prefix}-{random.randint(100000, 999999)}"
        existing = db.execute(
            f"SELECT 1 FROM {table} WHERE {column} = ? LIMIT 1",
            (candidate,),
        ).fetchone()
        if existing is None:
            return candidate


def generate_receipt_reference(sample_origin: str) -> str:
    db = get_db()
    first_two = {
        "internal": "17",
        "external": "83",
    }.get((sample_origin or "").strip().lower(), "17")
    while True:
        candidate = f"RCPT-{first_two}{random.randint(1000, 9999)}"
        existing = db.execute(
            "SELECT 1 FROM sample_requests WHERE receipt_number = ? LIMIT 1",
            (candidate,),
        ).fetchone()
        if existing is None:
            return candidate


def generate_job_reference(sample_origin: str) -> str:
    db = get_db()
    prefix = {
        "internal": "J2",
        "external": "J4",
    }.get((sample_origin or "").strip().lower(), "J2")
    while True:
        candidate = f"{prefix}{random.randint(100000, 999999)}"
        existing = db.execute(
            "SELECT 1 FROM sample_requests WHERE request_no = ? LIMIT 1",
            (candidate,),
        ).fetchone()
        if existing is None:
            return candidate


def sample_reference_prefix(instrument_name: str | None) -> str:
    token = "".join(ch for ch in (instrument_name or "").upper() if ch.isalnum())
    if len(token) >= 2:
        return token[:2]
    if len(token) == 1:
        return f"{token}X"
    return "SM"


def generate_sample_reference(instrument_name: str | None, sample_origin: str) -> str:
    db = get_db()
    prefix = sample_reference_prefix(instrument_name)
    origin_code = "E" if (sample_origin or "").strip().lower() == "external" else "I"
    while True:
        candidate = f"{prefix}{origin_code}{random.randint(100000, 999999)}"
        existing = db.execute(
            "SELECT 1 FROM sample_requests WHERE sample_ref = ? LIMIT 1",
            (candidate,),
        ).fetchone()
        if existing is None:
            return candidate


def pdf_escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def simple_pdf_bytes(title: str, lines: list[str]) -> bytes:
    buffer = BytesIO()
    text_lines = [title] + lines
    y = 770
    commands = ["BT", "/F1 14 Tf", "50 800 Td", f"({pdf_escape(title)}) Tj"]
    for line in lines:
        y -= 22
        commands.extend(["BT", "/F1 11 Tf", f"50 {y} Td", f"({pdf_escape(line)}) Tj", "ET"])
    content = "\n".join(commands).encode("latin-1", errors="replace")
    objects = []
    objects.append(b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n")
    objects.append(b"2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj\n")
    objects.append(b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n")
    objects.append(b"4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n")
    objects.append(f"5 0 obj << /Length {len(content)} >> stream\n".encode("latin-1") + content + b"\nendstream endobj\n")
    buffer.write(b"%PDF-1.4\n")
    offsets = [0]
    for obj in objects:
        offsets.append(buffer.tell())
        buffer.write(obj)
    xref_start = buffer.tell()
    buffer.write(f"xref\n0 {len(offsets)}\n".encode("latin-1"))
    buffer.write(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        buffer.write(f"{offset:010d} 00000 n \n".encode("latin-1"))
    buffer.write(
        f"trailer << /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{xref_start}\n%%EOF\n".encode("latin-1")
    )
    return buffer.getvalue()


def get_db() -> sqlite3.Connection:
    if "db" not in g:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        g.db = conn
    return g.db


@app.teardown_appcontext
def close_db(_exc: object) -> None:
    db = g.pop("db", None)
    if db is not None:
        db.close()


@app.errorhandler(RequestEntityTooLarge)
def handle_large_upload(_exc):
    flash("Upload too large. Maximum file size is 100 MB.", "error")
    referrer = request.referrer or url_for("index")
    return redirect(referrer)


@app.errorhandler(403)
def handle_forbidden(_exc):
    return render_template("error.html", title="Access Restricted", heading="Access Restricted", message="You do not have permission to view this page.", code=403), 403


@app.errorhandler(404)
def handle_not_found(_exc):
    return render_template("error.html", title="Page Not Found", heading="Page Not Found", message="This page does not exist or is no longer available.", code=404), 404


def query_all(sql: str, params: tuple = ()) -> list[sqlite3.Row]:
    return get_db().execute(sql, params).fetchall()


def query_one(sql: str, params: tuple = ()) -> sqlite3.Row | None:
    return get_db().execute(sql, params).fetchone()


def execute(sql: str, params: tuple = ()) -> int:
    cur = get_db().execute(sql, params)
    get_db().commit()
    return cur.lastrowid


def log_action(actor_id: int | None, entity_type: str, entity_id: int, action: str, payload: dict) -> None:
    log_action_at(actor_id, entity_type, entity_id, action, payload, now_iso())


def log_action_at(actor_id: int | None, entity_type: str, entity_id: int, action: str, payload: dict, created_at: str) -> None:
    db = get_db()
    previous = query_one(
        "SELECT entry_hash FROM audit_logs WHERE entity_type = ? AND entity_id = ? ORDER BY id DESC LIMIT 1",
        (entity_type, entity_id),
    )
    prev_hash = previous["entry_hash"] if previous else ""
    payload_json = json.dumps(payload, sort_keys=True)
    digest = hashlib.sha256(f"{prev_hash}|{entity_type}|{entity_id}|{action}|{payload_json}".encode()).hexdigest()
    db.execute(
        """
        INSERT INTO audit_logs (entity_type, entity_id, action, actor_id, payload_json, prev_hash, entry_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (entity_type, entity_id, action, actor_id, payload_json, prev_hash, digest, created_at),
    )
    db.commit()


def verify_audit_chain(entity_type: str, entity_id: int) -> bool:
    rows = query_all(
        """
        SELECT action, payload_json, prev_hash, entry_hash
        FROM audit_logs
        WHERE entity_type = ? AND entity_id = ?
        ORDER BY id
        """,
        (entity_type, entity_id),
    )
    previous_hash = ""
    for row in rows:
        digest = hashlib.sha256(
            f"{previous_hash}|{entity_type}|{entity_id}|{row['action']}|{row['payload_json']}".encode()
        ).hexdigest()
        if row["prev_hash"] != previous_hash or row["entry_hash"] != digest:
            return False
        previous_hash = row["entry_hash"]
    return True


def send_completion_email(sample_request: sqlite3.Row, results_summary: str) -> tuple[bool, str]:
    msg = EmailMessage()
    msg["Subject"] = f"Lab Result Ready: {sample_request['request_no']}"
    msg["From"] = "noreply@lab.local"
    msg["To"] = sample_request["requester_email"]
    msg.set_content(
        "\n".join(
            [
                f"Hello {sample_request['requester_name']},",
                "",
                f"Your request {sample_request['request_no']} for {sample_request['instrument_name']} is complete.",
                f"Sample: {sample_request['sample_name']}",
                "",
                "Operator remark/result summary:",
                results_summary or "No summary provided.",
                "",
                "Regards,",
                "Lab Facility",
            ]
        )
    )
    try:
        with smtplib.SMTP(app.config["SMTP_HOST"], app.config["SMTP_PORT"], timeout=5) as server:
            server.send_message(msg)
        return True, "Email sent"
    except Exception as exc:
        return False, f"Email not sent: {exc}"


def build_request_status(db: sqlite3.Connection, request_id: int) -> str:
    request_row = db.execute(
        """
        SELECT status, sample_submitted_at, sample_received_at
        FROM sample_requests
        WHERE id = ?
        """,
        (request_id,),
    ).fetchone()
    steps = db.execute(
        "SELECT step_order, status FROM approval_steps WHERE sample_request_id = ? ORDER BY step_order",
        (request_id,),
    ).fetchall()
    if not steps:
        return "submitted"
    if any(step["status"] == "rejected" for step in steps):
        return "rejected"
    for step in steps:
        if step["status"] != "approved":
            return "under_review"
    if request_row and request_row["status"] in {"scheduled", "in_progress", "completed"}:
        return request_row["status"]
    if request_row and request_row["sample_received_at"]:
        return "sample_received"
    if request_row and request_row["sample_submitted_at"]:
        return "sample_submitted"
    return "awaiting_sample_submission"


def request_display_status(status: str) -> str:
    labels = {
        "submitted": "Submitted",
        "under_review": "Under Review",
        "awaiting_sample_submission": "Awaiting Sample Submission",
        "sample_submitted": "Sample Submitted",
        "sample_received": "Sample Received",
        "scheduled": "Scheduled",
        "in_progress": "In Progress",
    }
    return labels.get(status, status.replace("_", " ").title())


def approval_role_label(role: str | None) -> str:
    labels = {
        "finance": "Finance",
        "professor": "Professor",
        "operator": "Operator",
    }
    if not role:
        return "Review"
    return labels.get(role, role.replace("_", " ").title())


def request_status_group(status: str | None) -> str:
    status = status or ""
    if status in {"submitted", "under_review", "awaiting_sample_submission", "sample_submitted", "sample_received", "scheduled"}:
        return "Pending"
    if status == "in_progress":
        return "Processing"
    if status == "completed":
        return "Processed"
    if status in {"rejected"}:
        return "Closed"
    return "Open"


def request_status_summary(request_row: sqlite3.Row | dict, approval_steps: list[sqlite3.Row | dict] | None = None) -> str:
    status = (request_row["status"] if request_row else "") or ""
    instrument_mode = instrument_intake_mode(request_row) if request_row else "accepting"
    if status == "submitted":
        return "Request is submitted and waiting for the lab to start accepting new jobs."
    if status == "under_review":
        pending_step = None
        for step in approval_steps or []:
            if step["status"] == "rejected":
                return f"{approval_role_label(step['approver_role'])} rejected this request."
            if step["status"] != "approved":
                pending_step = step
                break
        if pending_step:
            return f"Pending {approval_role_label(pending_step['approver_role']).lower()} approval."
        return "Pending review."
    if status == "awaiting_sample_submission":
        if instrument_mode != "accepting":
            return "Dropoff is on hold right now. You can submit the request, but you cannot drop off the sample until the lab resumes accepting samples."
        return "Approved. Waiting for the member to physically submit the sample."
    if status == "sample_submitted":
        return "Member marked the sample submitted. Operator/admin should confirm receipt."
    if status == "sample_received":
        return "Sample received. Ready for operator scheduling."
    if status == "scheduled":
        scheduled_for = request_row["scheduled_for"] if request_row else None
        if scheduled_for:
            return f"Run scheduled for {format_dt(scheduled_for)}."
        return "Run scheduled."
    if status == "in_progress":
        return "Run is currently being processed."
    if status == "completed":
        completed_at = request_row["completed_at"] if request_row else None
        if completed_at:
            return f"Job completed on {format_dt(completed_at)} and the record is locked."
        return "Job completed and the record is locked."
    if status == "rejected":
        return "Request was rejected and will not be processed."
    return "Request is active."


def request_lifecycle_steps(request_row: sqlite3.Row | dict, approval_steps: list[sqlite3.Row | dict] | None = None) -> list[dict[str, str | bool]]:
    status = (request_row["status"] if request_row else "") or ""
    step_defs = [
        ("created", "Created"),
        ("sample_submitted", "Sample Submitted"),
        ("sample_received", "Sample Received"),
        ("processing", "Processing"),
        ("completed", "Done"),
    ]
    if status in {"rejected"}:
        step_defs[-1] = (status, request_display_status(status))
    rank = {
        "created": 1,
        "submitted": 1,
        "under_review": 1,
        "awaiting_sample_submission": 1,
        "sample_submitted": 2,
        "sample_received": 3,
        "processing": 4,
        "scheduled": 4,
        "in_progress": 4,
        "completed": 5,
        "rejected": 5,
    }
    current_rank = rank.get(status, 1)
    steps = []
    for code, label in step_defs:
        step_rank = rank.get(code, 0)
        if status in {"rejected"} and code == status:
            state = "current"
        elif current_rank > step_rank:
            state = "done"
        elif current_rank == step_rank:
            state = "current"
        else:
            state = "upcoming"
        note = ""
        if code == "created" and request_row and request_row["created_at"]:
            note = format_dt(request_row["created_at"])
        elif code == "sample_submitted" and request_row and request_row["sample_submitted_at"] and current_rank >= 2:
            note = format_dt(request_row["sample_submitted_at"])
        elif code == "sample_received" and request_row and request_row["sample_received_at"] and current_rank >= 3:
            note = format_dt(request_row["sample_received_at"])
        elif code == "processing" and request_row and request_row["scheduled_for"] and current_rank >= 4:
            note = format_dt(request_row["scheduled_for"])
        elif code == "completed" and request_row and request_row["completed_at"] and status == "completed":
            note = format_dt(request_row["completed_at"])
        steps.append({"code": code, "label": label, "state": state, "note": note})
    return steps


def timeline_action_label(action: str) -> str:
    labels = {
        "submitted": "Request created",
        "released_for_review": "Released for review",
        "approval_assigned": "Approver updated",
        "finance_approved": "Finance approved",
        "professor_approved": "Faculty in-charge approved",
        "operator_approved": "Operator approved",
        "finance_rejected": "Finance rejected",
        "professor_rejected": "Faculty in-charge rejected",
        "operator_rejected": "Operator rejected",
        "sample_submitted": "Sample submitted by member",
        "sample_received": "Sample received by lab",
        "dropoff_reopened": "Dropoff reopened",
        "scheduled": "Run scheduled",
        "started": "Run started",
        "completed": "Run completed",
        "rejected": "Request rejected",
        "attachment_uploaded": "File attached",
        "attachment_removed": "File removed",
        "communication_note_saved": "Communication note updated",
        "issue_flagged": "Issue flagged",
        "issue_response_saved": "Issue response added",
        "issue_resolved": "Issue resolved",
        "taken_up_from_board": "Taken up from board",
        "started_from_board": "Started from board",
        "completed_from_board": "Completed from board",
        "operator_reassigned": "Job reassigned",
        "resolved_and_completed": "Job marked done",
        "resolution_saved": "Resolution saved",
        "admin_schedule_override": "Admin schedule override",
        "admin_complete_override": "Admin completion override",
        "status_changed": "Status changed",
    }
    return labels.get(action, action.replace("_", " ").title())


def request_timeline_entries(
    sample_request: sqlite3.Row,
    logs: list[sqlite3.Row],
    attachments: list[sqlite3.Row],
    messages: list[sqlite3.Row],
    message_attachments: dict[int, list[sqlite3.Row]] | None = None,
) -> list[dict]:
    entries: list[dict] = [
        {
            "at": sample_request["created_at"],
            "title": "Request created",
            "detail": f"{sample_request['request_no']} opened for {sample_request['instrument_name']}.",
            "actor": sample_request["originator_name"] or sample_request["requester_name"],
            "kind": "status",
            "scope": "workflow",
        }
    ]
    for log in logs:
        payload = {}
        try:
            payload = json.loads(log["payload_json"] or "{}")
        except Exception:
            payload = {}
        detail = ""
        if log["action"] == "communication_note_saved":
            detail = f"{note_kind_label(payload.get('note_kind', 'note'))}: {payload.get('message_preview', '')}"
        elif log["action"] == "issue_flagged":
            detail = payload.get("issue_preview", "")
        elif log["action"] == "issue_response_saved":
            detail = payload.get("response_preview", "")
        elif log["action"] == "issue_resolved":
            detail = payload.get("resolution_preview", "") or payload.get("response_preview", "")
        elif log["action"] in {"attachment_uploaded", "attachment_removed"}:
            filename = payload.get("filename", "")
            attachment_type = payload.get("attachment_type", "")
            note_text = payload.get("note", "")
            type_label = attachment_type.replace("_", " ").title() if attachment_type else ""
            parts = [part for part in [filename, type_label] if part]
            detail = " · ".join(parts)
            if note_text:
                detail = f"{detail}\n{note_text}".strip()
        elif log["action"] in {"scheduled", "taken_up_from_board"} and payload.get("scheduled_for"):
            detail = f"Scheduled for {format_dt(payload['scheduled_for'])}"
        elif payload.get("remarks"):
            detail = payload["remarks"]
        elif payload.get("results_summary"):
            detail = payload["results_summary"]
        elif payload.get("email_status"):
            detail = payload["email_status"]
        entries.append(
            {
                "at": log["created_at"],
                "title": timeline_action_label(log["action"]),
                "detail": detail,
                "actor": (log["actor_name"] if "actor_name" in log.keys() else None) or "System",
                "kind": "event",
                "scope": "conversation" if log["action"] in {"communication_note_saved", "issue_flagged", "issue_response_saved", "issue_resolved"} else "workflow",
            }
        )
    for attachment in attachments:
        if attachment["request_message_id"]:
            continue
        attachment_title = {
            "request_document": "Submission file attached",
            "sample_slip": "Sample slip generated",
            "result_document": "Result file attached",
            "invoice": "Invoice attached",
        }.get(attachment["attachment_type"], "File attached")
        attachment_detail = attachment["note"] or attachment["original_filename"]
        if attachment["attachment_type"] == "request_document" and sample_request["description"]:
            attachment_detail = f"{sample_request['description']}\n{attachment_detail}".strip()
        entries.append(
            {
                "at": attachment["uploaded_at"],
                "title": attachment_title,
                "detail": attachment_detail,
                "actor": attachment["uploaded_by_name"] or "System",
                "kind": "file",
                "scope": "files",
                "files": [{"id": attachment["id"], "original_filename": attachment["original_filename"]}],
            }
        )
    for note in messages:
        note_kind = note["note_kind"] or ""
        note_title = "Comment" if note_kind in {"requester_note", "operator_note"} else note_kind_label(note_kind)
        entries.append(
            {
                "at": note["created_at"],
                "title": note_title,
                "detail": note["message_body"],
                "actor": note["sender_name"],
                "kind": "note",
                "scope": "conversation",
                "side": "left" if note["sender_user_id"] == sample_request["requester_id"] else "right",
                "files": [
                    {"id": attachment["id"], "original_filename": attachment["original_filename"]}
                    for attachment in (message_attachments or {}).get(note["id"], [])
                ],
            }
        )
    entries.sort(key=lambda item: item.get("at") or "")
    seen: set[tuple] = set()
    deduped = []
    for entry in entries:
        signature = (entry.get("at"), entry.get("title"), entry.get("detail"))
        if signature in seen:
            continue
        seen.add(signature)
        deduped.append(entry)
    return deduped


def instrument_timeline_entries(instrument: sqlite3.Row, logs: list[sqlite3.Row]) -> list[dict]:
    entries: list[dict] = []
    for log in logs:
        payload = {}
        try:
            payload = json.loads(log["payload_json"] or "{}")
        except Exception:
            payload = {}
        title = {
            "instrument_created": "Instrument created",
            "instrument_metadata_updated": "Details updated",
            "instrument_operation_updated": "Operation changed",
            "instrument_archived": "Instrument archived",
            "instrument_restored": "Instrument restored",
            "downtime_added": "Downtime added",
        }.get(log["action"], log["action"].replace("_", " ").title())
        detail = ""
        if log["action"] == "instrument_operation_updated":
            detail = intake_mode_label(payload.get("intake_mode"))
        elif log["action"] == "instrument_metadata_updated":
            parts = []
            if payload.get("location"):
                parts.append(payload["location"])
            machine_label = " / ".join(part for part in [payload.get("manufacturer", ""), payload.get("model_number", "")] if part)
            if machine_label:
                parts.append(machine_label)
            detail = " · ".join(parts)
        elif log["action"] == "downtime_added":
            start_label = format_dt(payload.get("start_time"))
            end_label = format_dt(payload.get("end_time"))
            detail = " to ".join(part for part in [start_label, end_label] if part and part != "-")
            if payload.get("reason"):
                detail = f"{detail}\n{payload['reason']}".strip()
        entries.append(
            {
                "at": log["created_at"],
                "title": title,
                "detail": detail,
                "actor": log["actor_name"] or "System",
            }
        )
    return entries


def format_dt(value: object | None) -> str:
    if value in {None, "", "-"}:
        return "-"
    if isinstance(value, datetime):
        dt = value
    else:
        text = str(value).strip()
        if not text:
            return "-"
        normalized = text.replace("Z", "+00:00")
        dt = None
        for candidate in (normalized, text):
            try:
                dt = datetime.fromisoformat(candidate)
                break
            except ValueError:
                pass
        if dt is None:
            for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M", "%Y-%m-%d"):
                try:
                    dt = datetime.strptime(text, fmt)
                    break
                except ValueError:
                    continue
        if dt is None:
            return text
    return dt.strftime("%d/%m/%Y %H:%M:%S")


def format_date(value: object | None) -> str:
    if value in {None, "", "-"}:
        return "-"
    if isinstance(value, datetime):
        dt_value = value.date()
    elif isinstance(value, date):
        dt_value = value
    else:
        text = str(value).strip()
        if not text:
            return "-"
        for parser in (
            lambda v: date.fromisoformat(v),
            lambda v: datetime.fromisoformat(v.replace("Z", "+00:00")).date(),
        ):
            try:
                dt_value = parser(text)
                break
            except Exception:
                dt_value = None
        if dt_value is None:
            return text
    return dt_value.strftime("%d/%m/%Y")


def format_duration_short(hours_value: object | None) -> str:
    if hours_value in {None, "", "-"}:
        return "-"
    try:
        total_hours = float(hours_value)
    except (TypeError, ValueError):
        return "-"
    if total_hours < 0:
        return "-"
    total_minutes = int(round(total_hours * 60))
    days, remainder = divmod(total_minutes, 24 * 60)
    hours, minutes = divmod(remainder, 60)
    parts: list[str] = []
    if days:
        parts.append(f"{days}d")
    if hours:
        parts.append(f"{hours}h")
    if minutes and not days:
        parts.append(f"{minutes}m")
    return " ".join(parts) if parts else "0m"


def format_duration_days(hours_value: object | None) -> str:
    if hours_value in {None, "", "-"}:
        return "-"
    try:
        total_days = float(hours_value) / 24.0
    except (TypeError, ValueError):
        return "-"
    if total_days < 0:
        return "-"
    if total_days >= 10:
        return f"{round(total_days):.0f} d"
    if total_days >= 1:
        return f"{total_days:.1f} d"
    return "0 d"


def instrument_intake_mode(instrument_row: sqlite3.Row | dict | None) -> str:
    if not instrument_row:
        return "accepting"
    accepting = int(row_value(instrument_row, "accepting_requests", 1) or 0)
    on_hold = int(row_value(instrument_row, "soft_accept_enabled", 0) or 0)
    if accepting:
        return "accepting"
    if on_hold:
        return "on_hold"
    return "maintenance"


def intake_mode_label(mode: str | None) -> str:
    labels = {
        "accepting": "Accepting",
        "on_hold": "On Hold",
        "maintenance": "Maintenance",
    }
    return labels.get(mode or "", "Accepting")


def intake_mode_flags(mode: str | None) -> tuple[int, int]:
    normalized = (mode or "").strip().lower()
    if normalized == "on_hold":
        return 0, 1
    if normalized == "maintenance":
        return 0, 0
    return 1, 0


def next_instrument_code() -> str:
    row = query_one("SELECT code FROM instruments WHERE code LIKE 'INST-%' ORDER BY id DESC LIMIT 1")
    if row and row["code"]:
        try:
            number = int(str(row["code"]).split("-")[-1]) + 1
        except ValueError:
            number = scoped_instrument_count(current_user()) + 1 if current_user() else 1
    else:
        number = 1
    return f"INST-{number:03d}"


def _default_user_for_approval_role(db: sqlite3.Connection, role: str, instrument_id: int) -> int | None:
    if role == "finance":
        row = db.execute("SELECT id FROM users WHERE role = 'finance_admin' AND active = 1 ORDER BY id LIMIT 1").fetchone()
    elif role == "professor":
        row = db.execute(
            """
            SELECT u.id FROM users u
            LEFT JOIN instrument_faculty_admins ifa ON ifa.user_id = u.id AND ifa.instrument_id = ?
            WHERE u.active = 1 AND (ifa.instrument_id IS NOT NULL OR u.role IN ('professor_approver', 'super_admin'))
            ORDER BY (ifa.instrument_id IS NOT NULL) DESC, u.id
            LIMIT 1
            """,
            (instrument_id,),
        ).fetchone()
    elif role == "operator":
        row = db.execute(
            """
            SELECT u.id FROM users u
            JOIN instrument_operators io ON io.user_id = u.id
            WHERE io.instrument_id = ? AND u.active = 1
            ORDER BY u.id LIMIT 1
            """,
            (instrument_id,),
        ).fetchone()
    else:
        row = None
    return row["id"] if row else None


def create_approval_chain(db: sqlite3.Connection, request_id: int, instrument_id: int) -> None:
    config_steps = db.execute(
        "SELECT * FROM instrument_approval_config WHERE instrument_id = ? ORDER BY step_order",
        (instrument_id,),
    ).fetchall()
    if config_steps:
        steps = []
        for cfg in config_steps:
            user_id = cfg["approver_user_id"] or _default_user_for_approval_role(db, cfg["approver_role"], instrument_id)
            steps.append((request_id, cfg["step_order"], cfg["approver_role"], user_id))
    else:
        finance_id = _default_user_for_approval_role(db, "finance", instrument_id)
        professor_id = _default_user_for_approval_role(db, "professor", instrument_id)
        operator_id = _default_user_for_approval_role(db, "operator", instrument_id)
        steps = [
            (request_id, 1, "finance", finance_id),
            (request_id, 2, "professor", professor_id),
            (request_id, 3, "operator", operator_id),
        ]
    db.executemany(
        """
        INSERT INTO approval_steps (sample_request_id, step_order, approver_role, approver_user_id, status, remarks)
        VALUES (?, ?, ?, ?, 'pending', '')
        """,
        steps,
    )


def release_submitted_requests_for_instrument(instrument_id: int, actor_id: int) -> int:
    pending_rows = query_all(
        """
        SELECT id
        FROM sample_requests
        WHERE instrument_id = ? AND status = 'submitted'
        ORDER BY id
        """,
        (instrument_id,),
    )
    released = 0
    db = get_db()
    for row in pending_rows:
        existing_steps = query_one(
            "SELECT 1 FROM approval_steps WHERE sample_request_id = ? LIMIT 1",
            (row["id"],),
        )
        if existing_steps is None:
            create_approval_chain(db, row["id"], instrument_id)
        execute(
            "UPDATE sample_requests SET status = 'under_review', remarks = ?, updated_at = ? WHERE id = ?",
            ("Lab is accepting jobs again. Request released into review.", now_iso(), row["id"]),
        )
        execute(
            """
            INSERT INTO request_messages (request_id, sender_user_id, note_kind, message_body, created_at, is_active)
            VALUES (?, ?, 'operator_note', ?, ?, 1)
            """,
            (row["id"], actor_id, "Lab is accepting jobs again. Your request has been released into review.", now_iso()),
        )
        log_action(actor_id, "sample_request", row["id"], "released_for_review", {"reason": "instrument_accepting"})
        write_request_metadata_snapshot(row["id"])
        released += 1
    dropoff_rows = query_all(
        """
        SELECT id
        FROM sample_requests
        WHERE instrument_id = ? AND status = 'awaiting_sample_submission'
        ORDER BY id
        """,
        (instrument_id,),
    )
    for row in dropoff_rows:
        execute(
            """
            INSERT INTO request_messages (request_id, sender_user_id, note_kind, message_body, created_at, is_active)
            VALUES (?, ?, 'operator_note', ?, ?, 1)
            """,
            (row["id"], actor_id, "The lab is accepting samples again. You can now drop off your sample.", now_iso()),
        )
        log_action(actor_id, "sample_request", row["id"], "dropoff_reopened", {"reason": "instrument_accepting"})
        write_request_metadata_snapshot(row["id"])
    return released


def approval_step_is_actionable(step: sqlite3.Row, all_steps: list[sqlite3.Row]) -> bool:
    if step["status"] != "pending":
        return False
    return all(prev["status"] == "approved" for prev in all_steps if prev["step_order"] < step["step_order"])


def safe_token(value: str) -> str:
    sanitized = secure_filename(value or "").replace(".", "_")
    return sanitized or "record"


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def allowed_instrument_image(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in {"png", "jpg", "jpeg"}


def instrument_photo_src(value: str | None) -> str:
    raw = (value or "").strip()
    if not raw:
        return url_for("static", filename="instrument-placeholder.svg")
    if raw.startswith("http://") or raw.startswith("https://") or raw.startswith("data:"):
        return raw
    if raw.startswith("instrument_images/"):
        return url_for("static", filename=raw)
    return raw


def save_instrument_image(instrument_id: int, uploaded_file) -> str:
    original_filename = (uploaded_file.filename or "").strip()
    if not original_filename:
        raise ValueError("No image selected.")
    if not allowed_instrument_image(original_filename):
        raise ValueError("Only PNG and JPG images are allowed for instrument photos.")
    sanitized = secure_filename(original_filename)
    extension = sanitized.rsplit(".", 1)[1].lower()
    INSTRUMENT_IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    stored_filename = f"instrument_{instrument_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.{extension}"
    full_path = INSTRUMENT_IMAGE_DIR / stored_filename
    uploaded_file.save(full_path)
    return f"instrument_images/{stored_filename}"


def user_upload_root(user_id: int) -> Path:
    return UPLOAD_DIR / "users" / str(user_id)


def request_folder_name(request_row: sqlite3.Row) -> str:
    return f"req_{request_row['id']}_{safe_token(request_row['request_no'])}"


def request_month_bucket(value: object | None) -> str:
    raw = str(value or "").strip()
    if raw:
        candidates = [raw]
        if raw.endswith("Z"):
            candidates.append(raw.replace("Z", "+00:00"))
        for candidate in candidates:
            try:
                return datetime.fromisoformat(candidate).strftime("%b %Y")
            except ValueError:
                continue
    return datetime.utcnow().strftime("%b %Y")


def request_instrument_bucket(request_row: sqlite3.Row) -> str:
    keys = set(request_row.keys())
    instrument_code = ""
    if "instrument_code" in keys:
        instrument_code = str(request_row["instrument_code"] or "").strip()
    if not instrument_code and "instrument_id" in keys:
        row = query_one("SELECT code FROM instruments WHERE id = ?", (request_row["instrument_id"],))
        instrument_code = str(row["code"] or "").strip() if row else ""
    return safe_token(instrument_code or f"instrument-{request_row['instrument_id']}")


def request_storage_root(request_row: sqlite3.Row) -> Path:
    month_bucket = request_month_bucket(request_row["created_at"])
    instrument_bucket = request_instrument_bucket(request_row)
    return UPLOAD_DIR / "requests" / month_bucket / instrument_bucket


def request_folder_path(request_row: sqlite3.Row) -> Path:
    return request_storage_root(request_row) / request_folder_name(request_row)


def request_attachments_path(request_row: sqlite3.Row) -> Path:
    return request_folder_path(request_row) / "attachments"


def ensure_request_folder(request_row: sqlite3.Row) -> Path:
    base_path = request_folder_path(request_row)
    (base_path / "attachments").mkdir(parents=True, exist_ok=True)
    return base_path


def request_metadata_path(request_row: sqlite3.Row) -> Path:
    return request_folder_path(request_row) / "request_metadata.json"


def request_snapshot_row(request_id: int) -> sqlite3.Row | None:
    return query_one(
        """
        SELECT sr.*, i.name AS instrument_name, i.code AS instrument_code,
               r.name AS requester_name, r.email AS requester_email,
               c.name AS originator_name, c.email AS originator_email, c.role AS originator_role,
               op.name AS operator_name, recv.name AS received_by_name
        FROM sample_requests sr
        JOIN instruments i ON i.id = sr.instrument_id
        JOIN users r ON r.id = sr.requester_id
        LEFT JOIN users c ON c.id = sr.created_by_user_id
        LEFT JOIN users op ON op.id = sr.assigned_operator_id
        LEFT JOIN users recv ON recv.id = sr.received_by_operator_id
        WHERE sr.id = ?
        """,
        (request_id,),
    )


def write_request_metadata_snapshot(request_id: int) -> None:
    request_row = request_snapshot_row(request_id)
    if request_row is None:
        return
    folder = ensure_request_folder(request_row)
    attachments = get_request_attachments(request_id)
    notes = get_request_notes(request_id)
    issues = get_request_issues(request_id)
    approval_steps = query_all(
        """
        SELECT step_order, approver_role, status, remarks, acted_at
        FROM approval_steps
        WHERE sample_request_id = ?
        ORDER BY step_order
        """,
        (request_id,),
    )
    payload = {
        "request_id": request_row["id"],
        "request_no": request_row["request_no"],
        "title": request_row["title"],
        "sample_name": request_row["sample_name"],
        "sample_ref": request_row["sample_ref"],
        "sample_count": request_row["sample_count"],
        "description": request_row["description"],
        "sample_origin": request_row["sample_origin"],
        "priority": request_row["priority"],
        "status": request_row["status"],
        "instrument": {
            "id": request_row["instrument_id"],
            "name": request_row["instrument_name"],
            "code": request_row["instrument_code"],
        },
        "requester": {
            "id": request_row["requester_id"],
            "name": request_row["requester_name"],
            "email": request_row["requester_email"],
        },
        "originator": {
            "id": request_row["created_by_user_id"],
            "name": request_row["originator_name"] or request_row["requester_name"],
            "email": request_row["originator_email"] or request_row["requester_email"],
            "role": request_row["originator_role"] or "requester",
        },
        "originator_note": request_row["originator_note"],
        "operator": {
            "id": request_row["assigned_operator_id"],
            "name": request_row["operator_name"],
        },
        "received_by": {
            "id": request_row["received_by_operator_id"],
            "name": request_row["received_by_name"],
        },
        "finance": {
            "receipt_number": request_row["receipt_number"],
            "amount_due": request_row["amount_due"],
            "amount_paid": request_row["amount_paid"],
            "finance_status": request_row["finance_status"],
        },
        "timing": {
            "created_at": request_row["created_at"],
            "updated_at": request_row["updated_at"],
            "submitted_to_lab_at": request_row["submitted_to_lab_at"],
            "sample_submitted_at": request_row["sample_submitted_at"],
            "sample_received_at": request_row["sample_received_at"],
            "scheduled_for": request_row["scheduled_for"],
            "completed_at": request_row["completed_at"],
        },
        "remarks": request_row["remarks"],
        "results_summary": request_row["results_summary"],
        "result_email_status": request_row["result_email_status"],
        "completion_locked": bool(request_row["completion_locked"]),
        "attachments": [
            {
                "id": row["id"],
                "original_filename": row["original_filename"],
                "attachment_type": row["attachment_type"],
                "note": row["note"],
                "uploaded_at": row["uploaded_at"],
                "uploaded_by": row["uploaded_by_name"],
                "relative_path": row["relative_path"],
                "file_size": row["file_size"],
            }
            for row in attachments
        ],
        "communication_notes": [
            {
                "id": row["id"],
                "note_kind": row["note_kind"],
                "sender_name": row["sender_name"],
                "sender_email": row["sender_email"],
                "sender_role": row["sender_role"],
                "message_body": row["message_body"],
                "created_at": row["created_at"],
            }
            for row in notes.values()
        ],
        "issues": [
            {
                "id": row["id"],
                "status": row["status"],
                "issue_message": row["issue_message"],
                "response_message": row["response_message"],
                "created_at": row["created_at"],
                "responded_at": row["responded_at"],
                "resolved_at": row["resolved_at"],
                "created_by_name": row["created_by_name"],
                "responded_by_name": row["responded_by_name"],
                "resolved_by_name": row["resolved_by_name"],
            }
            for row in issues
        ],
        "approval_steps": [dict(row) for row in approval_steps],
        "snapshot_generated_at": now_iso(),
    }
    request_metadata_path(request_row).write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")


def can_view_request(user: sqlite3.Row, request_row: sqlite3.Row) -> bool:
    profile = user_access_profile(user)
    if profile["can_view_all_requests"]:
        return True
    if request_row["requester_id"] == user["id"]:
        return True
    if can_manage_instrument(user["id"], request_row["instrument_id"], user["role"]):
        return True
    if can_operate_instrument(user["id"], request_row["instrument_id"], user["role"]):
        return True
    if profile["can_view_finance_stage"]:
        return query_one(
            """
            SELECT 1
            FROM approval_steps aps
            WHERE aps.sample_request_id = ?
              AND aps.approver_role = 'finance'
              AND aps.status = 'pending'
              AND NOT EXISTS (
                SELECT 1
                FROM approval_steps prev
                WHERE prev.sample_request_id = aps.sample_request_id
                  AND prev.step_order < aps.step_order
                  AND prev.status != 'approved'
              )
            """,
            (request_row["id"],),
        ) is not None
    if profile["can_view_professor_stage"]:
        return query_one(
            """
            SELECT 1
            FROM approval_steps aps
            WHERE aps.sample_request_id = ?
              AND aps.approver_role = 'professor'
              AND aps.status = 'pending'
              AND NOT EXISTS (
                SELECT 1
                FROM approval_steps prev
                WHERE prev.sample_request_id = aps.sample_request_id
                  AND prev.step_order < aps.step_order
                  AND prev.status != 'approved'
              )
            """,
            (request_row["id"],),
        ) is not None
    return False


def can_upload_attachment(user: sqlite3.Row, request_row: sqlite3.Row) -> bool:
    profile = user_access_profile(user)
    if profile["can_view_all_requests"]:
        return True
    if request_row["completion_locked"]:
        return user["role"] in POST_COMPLETION_UPLOAD_ROLES and (
            can_manage_instrument(user["id"], request_row["instrument_id"], user["role"])
            or can_operate_instrument(user["id"], request_row["instrument_id"], user["role"])
        )
    if request_row["requester_id"] == user["id"]:
        return True
    if can_manage_instrument(user["id"], request_row["instrument_id"], user["role"]):
        return True
    if can_operate_instrument(user["id"], request_row["instrument_id"], user["role"]):
        return True
    return False


def can_delete_attachment(user: sqlite3.Row, attachment: sqlite3.Row, request_row: sqlite3.Row) -> bool:
    if user_access_profile(user)["can_view_all_requests"]:
        return True
    if request_row["completion_locked"]:
        return False
    return attachment["uploaded_by_user_id"] == user["id"]


def can_post_message(user: sqlite3.Row, request_row: sqlite3.Row) -> bool:
    return can_view_request(user, request_row)


def note_kind_label(note_kind: str) -> str:
    for key, label, _hint in COMMUNICATION_NOTE_TYPES:
        if key == note_kind:
            return label
    return note_kind.replace("_", " ").title()


def can_edit_request_note(user: sqlite3.Row, request_row: sqlite3.Row, note_kind: str) -> bool:
    if note_kind == "requester_note":
        return request_row["requester_id"] == user["id"] and not request_row["completion_locked"]
    if user_access_profile(user)["can_view_all_requests"]:
        return True
    if note_kind in {"lab_reply", "operator_note", "final_note"}:
        return can_manage_instrument(user["id"], request_row["instrument_id"], user["role"]) or can_operate_instrument(
            user["id"], request_row["instrument_id"], user["role"]
        )
    return False


def row_value(row: sqlite3.Row | dict | None, key: str, default=None):
    if row is None:
        return default
    try:
        return row[key]
    except (KeyError, IndexError, TypeError):
        return default


def request_card_viewer_kind(user: sqlite3.Row, request_row: sqlite3.Row) -> str:
    profile = user_access_profile(user)
    if profile["is_owner"]:
        return "owner"
    if profile["can_view_all_requests"]:
        return "global_admin"
    if profile["can_view_professor_stage"]:
        return "faculty_admin"
    if profile["can_view_finance_stage"]:
        return "finance"
    if can_manage_instrument(user["id"], request_row["instrument_id"], user["role"]):
        return "instrument_admin"
    if can_operate_instrument(user["id"], request_row["instrument_id"], user["role"]):
        return "operator"
    if request_row["requester_id"] == user["id"]:
        return "requester"
    return "viewer"


def request_card_field_allowed(user: sqlite3.Row, request_row: sqlite3.Row, field_name: str) -> bool:
    viewer_kind = request_card_viewer_kind(user, request_row)
    profile = user_access_profile(user)
    always_visible = {
        "request_no",
        "status",
        "instrument",
        "sample_ref",
        "sample_name",
        "sample_count",
        "created_at",
        "completed_at",
        "description",
    }
    if field_name in always_visible:
        return True

    if field_name in set(profile["card_visible_fields"]):
        return True
    field_roles = {
        "requester_identity": {"owner", "global_admin", "faculty_admin", "instrument_admin", "operator", "requester"},
        "operator_identity": {"owner", "global_admin", "faculty_admin", "instrument_admin", "operator", "requester"},
        "remarks": {"owner", "global_admin", "faculty_admin", "instrument_admin", "operator", "requester", "finance"},
        "results_summary": {"owner", "global_admin", "faculty_admin", "instrument_admin", "operator", "requester"},
        "submitted_documents": {"owner", "global_admin", "faculty_admin", "instrument_admin", "operator", "requester", "finance"},
        "conversation": {"owner", "global_admin", "faculty_admin", "instrument_admin", "operator", "requester", "finance"},
        "events": {"owner", "global_admin", "faculty_admin", "instrument_admin", "operator", "requester", "finance"},
    }
    return viewer_kind in field_roles.get(field_name, set())


def request_card_actions(user: sqlite3.Row, request_row: sqlite3.Row) -> dict[str, bool]:
    profile = user_access_profile(user)
    can_manage = can_manage_instrument(user["id"], request_row["instrument_id"], user["role"])
    can_operate = can_operate_instrument(user["id"], request_row["instrument_id"], user["role"])
    return {
        "reply": "reply" in set(profile["card_action_fields"]) and can_post_message(user, request_row),
        "upload_attachment": "upload_attachment" in set(profile["card_action_fields"]) and can_upload_attachment(user, request_row),
        "mark_submitted": "mark_submitted" in set(profile["card_action_fields"])
        and user["role"] == "requester"
        and request_row["requester_id"] == user["id"]
        and request_row["status"] == "awaiting_sample_submission"
        and instrument_intake_mode(request_row) == "accepting",
        "finish_fast": "finish_fast" in set(profile["card_action_fields"]) and (can_manage or can_operate) and request_row["status"] not in {"completed", "rejected"},
        "reassign": "reassign" in set(profile["card_action_fields"]) and (can_manage or can_operate),
        "mark_received": "mark_received" in set(profile["card_action_fields"]) and (can_manage or can_operate) and request_row["status"] == "sample_submitted",
        "update_status": "update_status" in set(profile["card_action_fields"]) and can_manage,
    }


def request_card_attachment_allowed(user: sqlite3.Row, request_row: sqlite3.Row, attachment: sqlite3.Row) -> bool:
    if not can_view_request(user, request_row):
        return False
    if attachment["attachment_type"] in {"request_document", "sample_slip"}:
        return request_card_field_allowed(user, request_row, "submitted_documents")
    return request_card_field_allowed(user, request_row, "events")


def request_card_event_allowed(user: sqlite3.Row, request_row: sqlite3.Row, entry: dict) -> bool:
    if not can_view_request(user, request_row):
        return False
    scope = entry.get("scope", "workflow")
    if scope == "conversation":
        return request_card_field_allowed(user, request_row, "conversation")
    if scope == "files":
        return request_card_field_allowed(user, request_row, "events") or request_card_field_allowed(user, request_row, "submitted_documents")
    return request_card_field_allowed(user, request_row, "events")


def request_card_visible_attachments(user: sqlite3.Row, request_row: sqlite3.Row, attachments: list[sqlite3.Row]) -> list[sqlite3.Row]:
    return [attachment for attachment in attachments if request_card_attachment_allowed(user, request_row, attachment)]


def request_card_visible_timeline(user: sqlite3.Row, request_row: sqlite3.Row, entries: list[dict]) -> list[dict]:
    return [entry for entry in entries if request_card_event_allowed(user, request_row, entry)]


def completion_override_fields(request_row: sqlite3.Row, actor_user_id: int, timestamp_value: str) -> dict[str, object]:
    return {
        "submitted_to_lab_at": request_row["submitted_to_lab_at"] or timestamp_value,
        "sample_submitted_at": request_row["sample_submitted_at"] or timestamp_value,
        "sample_received_at": request_row["sample_received_at"] or timestamp_value,
        "received_by_operator_id": request_row["received_by_operator_id"] or actor_user_id,
        "scheduled_for": request_row["scheduled_for"] or timestamp_value,
        "assigned_operator_id": request_row["assigned_operator_id"] or actor_user_id,
        "completed_at": timestamp_value,
    }


def log_completion_override_events(
    actor_user_id: int,
    request_row: sqlite3.Row,
    completion_fields: dict[str, object],
    timestamp_value: str,
    final_action: str,
    final_payload: dict,
) -> None:
    if not request_row["submitted_to_lab_at"]:
        log_action_at(
            actor_user_id,
            "sample_request",
            request_row["id"],
            "sample_submitted",
            {"remarks": "Backfilled during override completion."},
            timestamp_value,
        )
    if not request_row["sample_received_at"]:
        log_action_at(
            actor_user_id,
            "sample_request",
            request_row["id"],
            "sample_received",
            {"remarks": "Backfilled during override completion."},
            timestamp_value,
        )
    if not request_row["scheduled_for"]:
        log_action_at(
            actor_user_id,
            "sample_request",
            request_row["id"],
            "scheduled",
            {"scheduled_for": completion_fields["scheduled_for"], "remarks": "Backfilled during override completion."},
            timestamp_value,
        )
    log_action_at(actor_user_id, "sample_request", request_row["id"], final_action, final_payload, timestamp_value)


def parse_schedule_day(value: str | None) -> date:
    parsed = parse_date_param(value or "")
    return parsed or datetime.utcnow().date()


def planner_datetime_value(day_value: date, moment: datetime) -> str:
    return moment.replace(year=day_value.year, month=day_value.month, day=day_value.day, second=0, microsecond=0).strftime("%Y-%m-%dT%H:%M")


def compute_next_schedule_slot(day_value: date, existing_rows: list[sqlite3.Row]) -> datetime:
    slots: list[datetime] = []
    for row in existing_rows:
        scheduled_for = row["scheduled_for"]
        if not scheduled_for:
            continue
        parsed = None
        try:
            parsed = datetime.fromisoformat(str(scheduled_for).replace("Z", "+00:00"))
        except ValueError:
            try:
                parsed = datetime.strptime(str(scheduled_for)[:16], "%Y-%m-%dT%H:%M")
            except ValueError:
                try:
                    parsed = datetime.strptime(str(scheduled_for)[:19], "%Y-%m-%d %H:%M:%S")
                except ValueError:
                    parsed = None
        if parsed and parsed.date() == day_value:
            slots.append(parsed.replace(second=0, microsecond=0))
    if not slots:
        return datetime.combine(day_value, datetime.min.time()).replace(hour=9, minute=0)
    return max(slots) + timedelta(minutes=30)


def request_card_policy(user: sqlite3.Row, request_row: sqlite3.Row) -> dict:
    return {
        "viewer_kind": request_card_viewer_kind(user, request_row),
        "fields": {
            "requester_identity": request_card_field_allowed(user, request_row, "requester_identity"),
            "operator_identity": request_card_field_allowed(user, request_row, "operator_identity"),
            "remarks": request_card_field_allowed(user, request_row, "remarks"),
            "results_summary": request_card_field_allowed(user, request_row, "results_summary"),
            "submitted_documents": request_card_field_allowed(user, request_row, "submitted_documents"),
            "conversation": request_card_field_allowed(user, request_row, "conversation"),
            "events": request_card_field_allowed(user, request_row, "events"),
        },
        "actions": request_card_actions(user, request_row),
    }


def can_flag_request_issue(user: sqlite3.Row, request_row: sqlite3.Row) -> bool:
    if request_row["requester_id"] == user["id"]:
        return True
    if user["role"] == "super_admin":
        return True
    return can_manage_instrument(user["id"], request_row["instrument_id"], user["role"]) or can_operate_instrument(
        user["id"], request_row["instrument_id"], user["role"]
    )


def can_respond_request_issue(user: sqlite3.Row, request_row: sqlite3.Row) -> bool:
    if user["role"] == "super_admin":
        return True
    return can_manage_instrument(user["id"], request_row["instrument_id"], user["role"]) or can_operate_instrument(
        user["id"], request_row["instrument_id"], user["role"]
    )


def can_view_user_profile(viewer: sqlite3.Row, target_user: sqlite3.Row) -> bool:
    if viewer["id"] == target_user["id"]:
        return True
    if user_access_profile(viewer)["can_view_user_profiles"] and user_access_profile(viewer)["can_view_all_requests"]:
        return True
    instrument_ids = assigned_instrument_ids(viewer)
    if not instrument_ids:
        return False
    placeholders = ",".join("?" for _ in instrument_ids)
    related_request = query_one(
        f"""
        SELECT 1
        FROM sample_requests sr
        WHERE sr.instrument_id IN ({placeholders})
          AND (
            sr.requester_id = ?
            OR sr.created_by_user_id = ?
            OR sr.assigned_operator_id = ?
            OR sr.received_by_operator_id = ?
          )
        LIMIT 1
        """,
        tuple(instrument_ids) + (target_user["id"], target_user["id"], target_user["id"], target_user["id"]),
    )
    if related_request is not None:
        return True
    related_assignment = query_one(
        f"""
        SELECT 1
        FROM (
          SELECT user_id, instrument_id FROM instrument_admins
          UNION ALL
          SELECT user_id, instrument_id FROM instrument_operators
          UNION ALL
          SELECT user_id, instrument_id FROM instrument_faculty_admins
        ) assignments
        WHERE assignments.user_id = ?
          AND assignments.instrument_id IN ({placeholders})
        LIMIT 1
        """,
        (target_user["id"], *instrument_ids),
    )
    return related_assignment is not None


def can_view_user_profile_id(viewer: sqlite3.Row | None, user_id: int | None) -> bool:
    if viewer is None or not user_id:
        return False
    target_user = query_one("SELECT id, name, email, role, invite_status, active FROM users WHERE id = ?", (user_id,))
    if target_user is None:
        return False
    return can_view_user_profile(viewer, target_user)


def can_view_instrument_history(user: sqlite3.Row, instrument_id: int) -> bool:
    profile = user_access_profile(user)
    if profile["can_view_all_instruments"]:
        return True
    if not profile["can_access_instruments"]:
        return False
    return can_manage_instrument(user["id"], instrument_id, user["role"]) or can_operate_instrument(user["id"], instrument_id, user["role"])


def can_open_instrument_detail(user: sqlite3.Row, instrument_id: int) -> bool:
    profile = user_access_profile(user)
    if profile["can_view_all_instruments"]:
        return True
    if not profile["can_access_instruments"]:
        return False
    return instrument_id in assigned_instrument_ids(user)


def can_view_group_visualization(user: sqlite3.Row, group_name: str) -> bool:
    if not can_access_stats(user):
        return False
    if user["role"] in {"super_admin", "site_admin"}:
        return True
    ids = assigned_instrument_ids(user)
    if not ids:
        return False
    placeholders = ",".join("?" for _ in ids)
    row = query_one(
        f"SELECT 1 FROM instruments WHERE id IN ({placeholders}) AND COALESCE(faculty_group, '') = ? LIMIT 1",
        (*ids, group_name),
    )
    return row is not None


def approval_candidate_options(step_role: str, instrument_id: int) -> list[sqlite3.Row]:
    if step_role == "finance":
        return query_all(
            "SELECT id, name, email, role FROM users WHERE active = 1 AND role IN ('finance_admin', 'site_admin', 'super_admin') ORDER BY name"
        )
    if step_role == "professor":
        return query_all(
            """
            SELECT DISTINCT u.id, u.name, u.email, u.role
            FROM users u
            LEFT JOIN instrument_faculty_admins ifa ON ifa.user_id = u.id AND ifa.instrument_id = ?
            WHERE u.active = 1
              AND (
                ifa.instrument_id IS NOT NULL OR
                u.role IN ('professor_approver', 'site_admin', 'super_admin')
              )
            ORDER BY u.name
            """,
            (instrument_id,),
        )
    return query_all(
        """
        SELECT DISTINCT u.id, u.name, u.email, u.role
        FROM users u
        LEFT JOIN instrument_operators io ON io.user_id = u.id AND io.instrument_id = ?
        LEFT JOIN instrument_admins ia ON ia.user_id = u.id AND ia.instrument_id = ?
        LEFT JOIN instrument_faculty_admins ifa ON ifa.user_id = u.id AND ifa.instrument_id = ?
        WHERE u.active = 1
          AND (
            io.instrument_id IS NOT NULL OR
            ia.instrument_id IS NOT NULL OR
            ifa.instrument_id IS NOT NULL OR
            u.role = 'super_admin'
          )
        ORDER BY u.name
        """,
        (instrument_id, instrument_id, instrument_id),
    )


def candidate_allowed_for_step(candidate: sqlite3.Row | None, step_role: str, instrument_id: int) -> bool:
    if candidate is None:
        return False
    if step_role == "finance":
        return candidate["role"] in {"finance_admin", "super_admin", "site_admin"}
    if step_role == "professor":
        if candidate["role"] in {"professor_approver", "super_admin", "site_admin"}:
            return True
        row = query_one(
            "SELECT 1 FROM instrument_faculty_admins WHERE user_id = ? AND instrument_id = ?",
            (candidate["id"], instrument_id),
        )
        return row is not None
    if candidate["role"] in {"super_admin", "site_admin"}:
        return True
    return can_manage_instrument(candidate["id"], instrument_id, candidate["role"]) or can_operate_instrument(candidate["id"], instrument_id, candidate["role"])


def attachment_type_choices() -> list[str]:
    return ["request_document", "sample_slip", "result_document", "invoice", "other"]


def get_request_attachments(request_id: int) -> list[sqlite3.Row]:
    return query_all(
        """
        SELECT ra.*, u.name AS uploaded_by_name
        FROM request_attachments ra
        LEFT JOIN users u ON u.id = ra.uploaded_by_user_id
        WHERE ra.request_id = ? AND ra.is_active = 1
        ORDER BY ra.uploaded_at DESC, ra.id DESC
        """,
        (request_id,),
    )


def get_request_notes(request_id: int) -> dict[str, sqlite3.Row]:
    rows = query_all(
        """
        SELECT rm.*, u.name AS sender_name, u.email AS sender_email, u.role AS sender_role
        FROM request_messages rm
        JOIN users u ON u.id = rm.sender_user_id
        WHERE rm.request_id = ? AND rm.is_active = 1
        ORDER BY rm.created_at DESC, rm.id DESC
        """,
        (request_id,),
    )
    grouped: dict[str, sqlite3.Row] = {}
    for row in rows:
        note_kind = row["note_kind"] or "requester_note"
        if note_kind not in grouped:
            grouped[note_kind] = row
    return grouped


def get_request_message_thread(request_id: int) -> list[sqlite3.Row]:
    return query_all(
        """
        SELECT rm.*, u.name AS sender_name, u.email AS sender_email, u.role AS sender_role
        FROM request_messages rm
        JOIN users u ON u.id = rm.sender_user_id
        WHERE rm.request_id = ? AND rm.is_active = 1
        ORDER BY rm.created_at ASC, rm.id ASC
        """,
        (request_id,),
    )


def attachments_by_message_ids(message_ids: list[int]) -> dict[int, list[sqlite3.Row]]:
    if not message_ids:
        return {}
    placeholders = ",".join("?" for _ in message_ids)
    rows = query_all(
        f"""
        SELECT ra.*, u.name AS uploaded_by_name
        FROM request_attachments ra
        LEFT JOIN users u ON u.id = ra.uploaded_by_user_id
        WHERE ra.request_message_id IN ({placeholders}) AND ra.is_active = 1
        ORDER BY ra.uploaded_at ASC, ra.id ASC
        """,
        tuple(message_ids),
    )
    grouped: dict[int, list[sqlite3.Row]] = {message_id: [] for message_id in message_ids}
    for row in rows:
        grouped.setdefault(row["request_message_id"], []).append(row)
    return grouped


def get_request_issues(request_id: int) -> list[sqlite3.Row]:
    return query_all(
        """
        SELECT ri.*,
               creator.name AS created_by_name,
               responder.name AS responded_by_name,
               resolver.name AS resolved_by_name
        FROM request_issues ri
        JOIN users creator ON creator.id = ri.created_by_user_id
        LEFT JOIN users responder ON responder.id = ri.responded_by_user_id
        LEFT JOIN users resolver ON resolver.id = ri.resolved_by_user_id
        WHERE ri.request_id = ?
        ORDER BY CASE WHEN ri.status = 'open' THEN 0 ELSE 1 END, ri.created_at DESC, ri.id DESC
        """,
        (request_id,),
    )


def attachments_by_request_ids(request_ids: list[int]) -> dict[int, list[sqlite3.Row]]:
    if not request_ids:
        return {}
    placeholders = ",".join("?" for _ in request_ids)
    rows = query_all(
        f"""
        SELECT ra.*, u.name AS uploaded_by_name
        FROM request_attachments ra
        LEFT JOIN users u ON u.id = ra.uploaded_by_user_id
        WHERE ra.request_id IN ({placeholders}) AND ra.is_active = 1
        ORDER BY ra.uploaded_at DESC, ra.id DESC
        """,
        tuple(request_ids),
    )
    grouped: dict[int, list[sqlite3.Row]] = {request_id: [] for request_id in request_ids}
    for row in rows:
        grouped.setdefault(row["request_id"], []).append(row)
    return grouped


def attachment_size_label(size: int | None) -> str:
    value = size or 0
    for unit in ["B", "KB", "MB", "GB"]:
        if value < 1024 or unit == "GB":
            return f"{value:.1f} {unit}" if unit != "B" else f"{int(value)} B"
        value /= 1024
    return f"{value:.1f} GB"


def save_uploaded_attachment(
    request_row: sqlite3.Row,
    uploaded_file,
    uploaded_by_user_id: int,
    attachment_type: str,
    note: str,
    request_message_id: int | None = None,
) -> sqlite3.Row:
    original_filename = (uploaded_file.filename or "").strip()
    if not original_filename:
        raise ValueError("No file selected.")
    if not allowed_file(original_filename):
        raise ValueError("File type not allowed.")
    sanitized = secure_filename(original_filename)
    extension = sanitized.rsplit(".", 1)[1].lower()
    stored_filename = f"{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{uploaded_by_user_id}_{sanitized}"
    ensure_request_folder(request_row)
    folder = request_attachments_path(request_row)
    full_path = folder / stored_filename
    uploaded_file.save(full_path)
    relative_path = str(full_path.relative_to(BASE_DIR))
    mime_type = uploaded_file.mimetype or mimetypes.guess_type(sanitized)[0] or "application/octet-stream"
    file_size = full_path.stat().st_size
    attachment_id = execute(
        """
        INSERT INTO request_attachments (
            request_id, user_id, instrument_id, original_filename, stored_filename, relative_path,
            file_extension, mime_type, file_size, uploaded_by_user_id, uploaded_at, attachment_type, note, is_active, request_message_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        """,
        (
            request_row["id"],
            request_row["requester_id"],
            request_row["instrument_id"],
            original_filename,
            stored_filename,
            relative_path,
            extension,
            mime_type,
            file_size,
            uploaded_by_user_id,
            now_iso(),
            attachment_type,
            note,
            request_message_id,
        ),
    )
    log_action(
        uploaded_by_user_id,
        "sample_request",
        request_row["id"],
        "attachment_uploaded",
        {
            "filename": original_filename,
            "attachment_type": attachment_type,
            "note": note,
            "request_message_id": request_message_id,
        },
    )
    return query_one("SELECT * FROM request_attachments WHERE id = ?", (attachment_id,))


def save_generated_attachment(
    request_row: sqlite3.Row,
    filename: str,
    content_bytes: bytes,
    uploaded_by_user_id: int,
    attachment_type: str,
    note: str,
    mime_type: str = "application/pdf",
) -> sqlite3.Row:
    sanitized = secure_filename(filename)
    extension = sanitized.rsplit(".", 1)[1].lower() if "." in sanitized else "bin"
    stored_filename = f"{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{uploaded_by_user_id}_{sanitized}"
    ensure_request_folder(request_row)
    folder = request_attachments_path(request_row)
    full_path = folder / stored_filename
    full_path.write_bytes(content_bytes)
    relative_path = str(full_path.relative_to(BASE_DIR))
    file_size = full_path.stat().st_size
    attachment_id = execute(
        """
        INSERT INTO request_attachments (
            request_id, user_id, instrument_id, original_filename, stored_filename, relative_path,
            file_extension, mime_type, file_size, uploaded_by_user_id, uploaded_at, attachment_type, note, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        """,
        (
            request_row["id"],
            request_row["requester_id"],
            request_row["instrument_id"],
            filename,
            stored_filename,
            relative_path,
            extension,
            mime_type,
            file_size,
            uploaded_by_user_id,
            now_iso(),
            attachment_type,
            note,
        ),
    )
    log_action(
        uploaded_by_user_id,
        "sample_request",
        request_row["id"],
        "attachment_uploaded",
        {
            "filename": filename,
            "attachment_type": attachment_type,
            "note": note,
        },
    )
    return query_one("SELECT * FROM request_attachments WHERE id = ?", (attachment_id,))


def generate_sample_slip_pdf(request_row: sqlite3.Row, instrument_name: str, requester_name: str, uploaded_filename: str | None = None) -> bytes:
    lines = [
        f"Sample Number: {request_row['sample_ref']}",
        f"Job Number: {request_row['request_no']}",
        f"Instrument: {instrument_name}",
        f"Requester: {requester_name}",
        f"Sample: {request_row['sample_name']}",
        f"Sample Count: {request_row['sample_count']}",
        f"Created: {format_dt(request_row['created_at'])}",
        "Print this slip and attach it to the physical sample.",
    ]
    if uploaded_filename:
        lines.append(f"Request file: {uploaded_filename}")
    return simple_pdf_bytes("Sample Submission Slip", lines)


def parse_date_param(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def week_start_for(value: str | None) -> date:
    anchor = parse_date_param(value) or datetime.utcnow().date()
    return anchor - timedelta(days=anchor.weekday())


def request_filter_values() -> dict[str, str]:
    return {
        "q": request.args.get("q", "").strip(),
        "status": request.args.get("status", "").strip(),
        "status_slice": request.args.get("status_slice", "all").strip() or "all",
        "instrument_id": request.args.get("instrument_id", "").strip(),
        "operator_id": request.args.get("operator_id", "").strip(),
        "requester_id": request.args.get("requester_id", "").strip(),
        "date_from": request.args.get("date_from", "").strip(),
        "date_to": request.args.get("date_to", "").strip(),
        "sort": request.args.get("sort", "created_desc").strip() or "created_desc",
    }


def page_value(default: int = 1) -> int:
    raw = request.args.get("page", str(default)).strip()
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return default
    return max(1, value)


def schedule_filter_values() -> dict[str, str]:
    values = request_filter_values()
    values["bucket"] = request.args.get("bucket", "").strip()
    values["period"] = request.args.get("period", "all").strip() or "all"
    return values


def calendar_filter_values() -> dict[str, str]:
    return {
        "instrument_id": request.values.get("instrument_id", "").strip(),
        "operator_id": request.values.get("operator_id", "").strip(),
        "show_scheduled": request.values.get("show_scheduled", "1"),
        "show_in_progress": request.values.get("show_in_progress", "1"),
        "show_completed": request.values.get("show_completed", "0"),
        "show_maintenance": request.values.get("show_maintenance", "1"),
        "view": request.values.get("view", "week").strip() or "week",
        "date": request.values.get("date", "").strip(),
    }


def row_anchor_date(row: sqlite3.Row) -> date | None:
    for field in ("scheduled_for", "completed_at", "sample_received_at", "sample_submitted_at", "created_at"):
        value = row[field] if field in row.keys() else None
        if value:
            return parse_date_param(str(value)[:10])
    return None


def row_matches_period(row: sqlite3.Row, period: str) -> bool:
    if period == "all":
        return True
    anchor = row_anchor_date(row)
    if anchor is None:
        return period == "all"
    today = datetime.utcnow().date()
    if period == "week":
        start = today - timedelta(days=today.weekday())
        end = start + timedelta(days=6)
        return start <= anchor <= end
    if period == "month":
        return anchor.year == today.year and anchor.month == today.month
    return True


def request_history_query(
    where_clauses: list[str] | None = None,
    params: list | None = None,
    filters: dict[str, str] | None = None,
) -> tuple[str, list]:
    clauses = list(where_clauses or [])
    query_params = list(params or [])
    active_filters = filters or {}
    if active_filters.get("q"):
        clauses.append(
            """
            (
                sr.request_no LIKE ? OR
                COALESCE(sr.sample_ref, '') LIKE ? OR
                sr.title LIKE ? OR
                sr.sample_name LIKE ? OR
                COALESCE(sr.description, '') LIKE ? OR
                COALESCE(sr.receipt_number, '') LIKE ? OR
                COALESCE(sr.finance_status, '') LIKE ? OR
                COALESCE(sr.priority, '') LIKE ? OR
                COALESCE(sr.remarks, '') LIKE ? OR
                COALESCE(sr.results_summary, '') LIKE ? OR
                COALESCE(i.name, '') LIKE ? OR
                COALESCE(i.code, '') LIKE ? OR
                COALESCE(r.name, '') LIKE ? OR
                COALESCE(c.name, '') LIKE ? OR
                COALESCE(op.name, '') LIKE ?
            )
            """
        )
        token = f"%{active_filters['q']}%"
        query_params.extend([token] * 15)
    if active_filters.get("status"):
        clauses.append("sr.status = ?")
        query_params.append(active_filters["status"])
    if active_filters.get("instrument_id"):
        clauses.append("sr.instrument_id = ?")
        query_params.append(int(active_filters["instrument_id"]))
    if active_filters.get("operator_id"):
        clauses.append("sr.assigned_operator_id = ?")
        query_params.append(int(active_filters["operator_id"]))
    if active_filters.get("requester_id"):
        clauses.append("sr.requester_id = ?")
        query_params.append(int(active_filters["requester_id"]))
    if active_filters.get("date_from"):
        clauses.append("substr(sr.created_at, 1, 10) >= ?")
        query_params.append(active_filters["date_from"])
    if active_filters.get("date_to"):
        clauses.append("substr(sr.created_at, 1, 10) <= ?")
        query_params.append(active_filters["date_to"])
    sort_key = active_filters.get("sort", "created_desc")
    order_map = {
        "created_desc": "sr.created_at DESC, sr.id DESC",
        "created_asc": "sr.created_at ASC, sr.id ASC",
        "completed_desc": "COALESCE(sr.completed_at, '') DESC, sr.id DESC",
        "scheduled_desc": "COALESCE(sr.scheduled_for, '') DESC, sr.id DESC",
        "instrument_asc": "i.name ASC, sr.created_at DESC",
        "status_asc": "sr.status ASC, sr.created_at DESC",
    }
    order_sql = order_map.get(sort_key, order_map["created_desc"])
    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    sql = f"""
        SELECT sr.*, i.name AS instrument_name, i.code AS instrument_code, r.name AS requester_name,
               c.name AS originator_name, c.email AS originator_email, c.role AS originator_role,
               op.name AS operator_name, recv.name AS received_by_name,
               COALESCE(COUNT(ra.id), 0) AS attachment_count,
               GROUP_CONCAT(ra.original_filename, ', ') AS attachment_names
        FROM sample_requests sr
        JOIN instruments i ON i.id = sr.instrument_id
        JOIN users r ON r.id = sr.requester_id
        LEFT JOIN users c ON c.id = sr.created_by_user_id
        LEFT JOIN users op ON op.id = sr.assigned_operator_id
        LEFT JOIN users recv ON recv.id = sr.received_by_operator_id
        LEFT JOIN request_attachments ra ON ra.request_id = sr.id AND ra.is_active = 1
        {where_sql}
        GROUP BY sr.id
        ORDER BY {order_sql}
    """
    return sql, query_params


def processed_history_query_parts(
    where_clauses: list[str] | None = None,
    params: list | None = None,
    filters: dict[str, str] | None = None,
) -> tuple[str, str, list]:
    clauses = list(where_clauses or [])
    query_params = list(params or [])
    active_filters = filters or {}
    clauses.append("sr.status = 'completed'")
    if active_filters.get("q"):
        clauses.append(
            """
            (
                sr.request_no LIKE ? OR
                COALESCE(sr.sample_ref, '') LIKE ? OR
                sr.title LIKE ? OR
                sr.sample_name LIKE ? OR
                COALESCE(sr.description, '') LIKE ? OR
                COALESCE(sr.receipt_number, '') LIKE ? OR
                COALESCE(sr.finance_status, '') LIKE ? OR
                COALESCE(sr.priority, '') LIKE ? OR
                COALESCE(sr.remarks, '') LIKE ? OR
                COALESCE(sr.results_summary, '') LIKE ? OR
                COALESCE(i.name, '') LIKE ? OR
                COALESCE(i.code, '') LIKE ? OR
                COALESCE(r.name, '') LIKE ? OR
                COALESCE(r.email, '') LIKE ? OR
                COALESCE(c.name, '') LIKE ? OR
                COALESCE(op.name, '') LIKE ?
            )
            """
        )
        token = f"%{active_filters['q']}%"
        query_params.extend([token] * 16)
    if active_filters.get("instrument_id"):
        clauses.append("sr.instrument_id = ?")
        query_params.append(int(active_filters["instrument_id"]))
    if active_filters.get("operator_id"):
        clauses.append("sr.assigned_operator_id = ?")
        query_params.append(int(active_filters["operator_id"]))
    if active_filters.get("requester_id"):
        clauses.append("sr.requester_id = ?")
        query_params.append(int(active_filters["requester_id"]))
    if active_filters.get("date_from"):
        clauses.append("substr(COALESCE(sr.completed_at, sr.created_at), 1, 10) >= ?")
        query_params.append(active_filters["date_from"])
    if active_filters.get("date_to"):
        clauses.append("substr(COALESCE(sr.completed_at, sr.created_at), 1, 10) <= ?")
        query_params.append(active_filters["date_to"])

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    from_sql = """
        FROM sample_requests sr
        JOIN instruments i ON i.id = sr.instrument_id
        JOIN users r ON r.id = sr.requester_id
        LEFT JOIN users c ON c.id = sr.created_by_user_id
        LEFT JOIN users op ON op.id = sr.assigned_operator_id
        LEFT JOIN request_attachments ra ON ra.request_id = sr.id AND ra.is_active = 1
    """
    return from_sql, where_sql, query_params


def stats_payload(user: sqlite3.Row | None = None, report_filters: dict[str, str] | None = None) -> dict:
    scoped_user = user or current_user()
    return stats_payload_for_scope(scoped_user, report_filters)


def chart_rows(rows: list[sqlite3.Row], label_key: str, value_key: str, limit: int = 8) -> list[dict]:
    subset = list(rows[:limit])
    max_value = max((row[value_key] for row in subset), default=0) or 1
    output = []
    for row in subset:
        value = row[value_key]
        output.append(
            {
                "label": row[label_key],
                "value": value,
                "width": round((value / max_value) * 100, 1),
            }
        )
    return output


def scoped_stats_filters(user: sqlite3.Row, instrument_id: int | None = None, group_name: str | None = None) -> tuple[list[str], list]:
    clauses, params = request_scope_sql(user, "sr")
    if instrument_id:
        clauses.append("sr.instrument_id = ?")
        params.append(instrument_id)
    if group_name:
        clauses.append("COALESCE(i.faculty_group, '') = ?")
        params.append(group_name)
    return clauses, params


def stats_payload_for_scope(
    user: sqlite3.Row,
    report_filters: dict[str, str] | None = None,
    instrument_id: int | None = None,
    group_name: str | None = None,
) -> dict:
    active_report_filters = report_filters or {}
    if instrument_id is None and active_report_filters.get("instrument_id"):
        try:
            requested_instrument_id = int(active_report_filters["instrument_id"])
        except (TypeError, ValueError):
            requested_instrument_id = None
        if requested_instrument_id and any(row["id"] == requested_instrument_id for row in visible_instruments_for_user(user, active_only=False)):
            instrument_id = requested_instrument_id
    if group_name is None and active_report_filters.get("group_name"):
        group_name = active_report_filters["group_name"]
    db = get_db()
    clauses, params = scoped_stats_filters(user, instrument_id=instrument_id, group_name=group_name)
    metric_clauses, metric_params, report_window = apply_report_window(clauses, params, "sr.completed_at", active_report_filters)
    where_sql = f" AND {' AND '.join(metric_clauses)}" if metric_clauses else ""
    daily = query_all(
        """
        SELECT substr(sr.completed_at, 1, 10) AS bucket, COUNT(*) AS jobs, COALESCE(SUM(sr.sample_count), 0) AS samples
        FROM sample_requests sr
        JOIN instruments i ON i.id = sr.instrument_id
        WHERE sr.status = 'completed' AND sr.completed_at IS NOT NULL
        GROUP BY substr(completed_at, 1, 10)
        ORDER BY bucket DESC
        """.replace("GROUP BY", f"{where_sql}\n        GROUP BY"),
        tuple(metric_params),
    )
    weekly = query_all(
        """
        SELECT strftime('%Y-W%W', substr(sr.completed_at, 1, 19)) AS bucket, COUNT(*) AS jobs, COALESCE(SUM(sr.sample_count), 0) AS samples
        FROM sample_requests sr
        JOIN instruments i ON i.id = sr.instrument_id
        WHERE sr.status = 'completed' AND sr.completed_at IS NOT NULL
        GROUP BY strftime('%Y-W%W', substr(sr.completed_at, 1, 19))
        ORDER BY bucket DESC
        """.replace("GROUP BY", f"{where_sql}\n        GROUP BY"),
        tuple(metric_params),
    )
    monthly = query_all(
        """
        SELECT substr(sr.completed_at, 1, 7) AS bucket, COUNT(*) AS jobs, COALESCE(SUM(sr.sample_count), 0) AS samples
        FROM sample_requests sr
        JOIN instruments i ON i.id = sr.instrument_id
        WHERE sr.status = 'completed' AND sr.completed_at IS NOT NULL
        GROUP BY substr(sr.completed_at, 1, 7)
        ORDER BY bucket DESC
        """.replace("GROUP BY", f"{where_sql}\n        GROUP BY"),
        tuple(metric_params),
    )
    today = datetime.utcnow().date()
    week_start = today - timedelta(days=today.weekday())
    last_week_start = week_start - timedelta(days=7)
    last_week_end = week_start - timedelta(days=1)
    month_start = today.replace(day=1)

    def scoped_completed_total(date_from: str | None, date_to: str | None, field: str) -> float:
        local_clauses = list(clauses)
        local_params = list(params)
        if date_from:
            local_clauses.append("substr(sr.completed_at, 1, 10) >= ?")
            local_params.append(date_from)
        if date_to:
            local_clauses.append("substr(sr.completed_at, 1, 10) <= ?")
            local_params.append(date_to)
        where = f" AND {' AND '.join(local_clauses)}" if local_clauses else ""
        row = query_one(
            f"""
            SELECT COALESCE({field}, 0) AS c
            FROM sample_requests sr
            JOIN instruments i ON i.id = sr.instrument_id
            WHERE sr.status = 'completed'{where}
            """,
            tuple(local_params),
        )
        return row["c"] if row else 0

    request_clauses, request_params, _ = apply_report_window(clauses, params, "sr.created_at", active_report_filters)
    by_instrument = query_all(
        f"""
        SELECT i.id AS instrument_id, i.name AS instrument_name, i.code AS instrument_code, i.faculty_group,
               COUNT(sr.id) AS total_requests,
               SUM(CASE WHEN sr.status = 'completed' THEN 1 ELSE 0 END) AS completed_jobs,
               COALESCE(SUM(CASE WHEN sr.status = 'completed' THEN sr.sample_count ELSE 0 END), 0) AS completed_samples
        FROM instruments i
        LEFT JOIN sample_requests sr ON sr.instrument_id = i.id
        {'WHERE ' + ' AND '.join(request_clauses) if request_clauses else ''}
        GROUP BY i.id
        ORDER BY completed_jobs DESC, i.name
        """,
        tuple(request_params),
    )
    by_group = query_all(
        f"""
        SELECT COALESCE(NULLIF(i.faculty_group, ''), 'Ungrouped') AS group_name,
               COUNT(sr.id) AS total_requests,
               SUM(CASE WHEN sr.status = 'completed' THEN 1 ELSE 0 END) AS completed_jobs,
               COALESCE(SUM(CASE WHEN sr.status = 'completed' THEN sr.sample_count ELSE 0 END), 0) AS completed_samples
        FROM instruments i
        LEFT JOIN sample_requests sr ON sr.instrument_id = i.id
        {'WHERE ' + ' AND '.join(request_clauses) if request_clauses else ''}
        GROUP BY COALESCE(NULLIF(i.faculty_group, ''), 'Ungrouped')
        ORDER BY completed_jobs DESC, group_name
        """,
        tuple(request_params),
    )
    summary = {
        "completed_jobs": query_one(
            f"SELECT COUNT(*) AS c FROM sample_requests sr JOIN instruments i ON i.id = sr.instrument_id WHERE sr.status = 'completed'{' AND ' + ' AND '.join(metric_clauses) if metric_clauses else ''}",
            tuple(metric_params),
        )["c"],
        "completed_samples": query_one(
            f"SELECT COALESCE(SUM(sr.sample_count), 0) AS c FROM sample_requests sr JOIN instruments i ON i.id = sr.instrument_id WHERE sr.status = 'completed'{' AND ' + ' AND '.join(metric_clauses) if metric_clauses else ''}",
            tuple(metric_params),
        )["c"],
        "avg_samples_per_completed_job": query_one(
            f"SELECT ROUND(COALESCE(AVG(sr.sample_count), 0), 2) AS c FROM sample_requests sr JOIN instruments i ON i.id = sr.instrument_id WHERE sr.status = 'completed'{' AND ' + ' AND '.join(metric_clauses) if metric_clauses else ''}",
            tuple(metric_params),
        )["c"],
        "avg_jobs_per_day": round(sum(row["jobs"] for row in daily) / len(daily), 2) if daily else 0,
        "avg_samples_per_day": round(sum(row["samples"] for row in daily) / len(daily), 2) if daily else 0,
        "avg_jobs_per_week": round(sum(row["jobs"] for row in weekly) / len(weekly), 2) if weekly else 0,
        "avg_samples_per_week": round(sum(row["samples"] for row in weekly) / len(weekly), 2) if weekly else 0,
        "avg_jobs_per_month": round(sum(row["jobs"] for row in monthly) / len(monthly), 2) if monthly else 0,
        "avg_samples_per_month": round(sum(row["samples"] for row in monthly) / len(monthly), 2) if monthly else 0,
        "this_week_jobs": int(scoped_completed_total(week_start.isoformat(), today.isoformat(), "COUNT(*)")),
        "this_week_samples": int(scoped_completed_total(week_start.isoformat(), today.isoformat(), "SUM(sr.sample_count)")),
        "last_week_jobs": int(scoped_completed_total(last_week_start.isoformat(), last_week_end.isoformat(), "COUNT(*)")),
        "last_week_samples": int(scoped_completed_total(last_week_start.isoformat(), last_week_end.isoformat(), "SUM(sr.sample_count)")),
        "month_to_date_jobs": int(scoped_completed_total(month_start.isoformat(), today.isoformat(), "COUNT(*)")),
        "month_to_date_samples": int(scoped_completed_total(month_start.isoformat(), today.isoformat(), "SUM(sr.sample_count)")),
    }
    return {
        "summary": summary,
        "daily": daily,
        "weekly": weekly,
        "monthly": monthly,
        "by_instrument": by_instrument,
        "by_group": by_group,
        "report_window": report_window,
    }


def dashboard_analytics(user: sqlite3.Row) -> dict:
    weekly_stats = stats_payload(user, {"horizon": "weekly", "date_from": "", "date_to": ""})
    monthly_stats = stats_payload(user, {"horizon": "monthly", "date_from": "", "date_to": ""})
    clauses, params = request_scope_sql(user, "sr")
    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    today = datetime.utcnow().date()
    week_start = (today - timedelta(days=today.weekday())).isoformat()
    pending_statuses = ("submitted", "under_review", "awaiting_sample_submission", "sample_submitted", "sample_received", "scheduled", "in_progress")
    pending_row = query_one(
        f"SELECT COUNT(*) AS c FROM sample_requests sr {where_sql} {'AND' if clauses else 'WHERE'} sr.status IN ({','.join('?' for _ in pending_statuses)}) AND substr(sr.created_at,1,10) >= ?",
        (*params, *pending_statuses, week_start),
    )
    avg_row = query_one(
        f"""SELECT AVG((julianday(sr.completed_at) - julianday(COALESCE(sr.sample_received_at, sr.sample_submitted_at, sr.created_at))) * 24.0) AS avg_hours
            FROM sample_requests sr {where_sql} {'AND' if clauses else 'WHERE'} sr.status = 'completed' AND sr.completed_at IS NOT NULL""",
        tuple(params),
    )
    return {
        "this_week_jobs": weekly_stats["summary"]["completed_jobs"],
        "this_week_samples": weekly_stats["summary"]["completed_samples"],
        "this_month_jobs": monthly_stats["summary"]["completed_jobs"],
        "this_month_samples": monthly_stats["summary"]["completed_samples"],
        "weekly_chart": chart_rows(weekly_stats["daily"], "bucket", "jobs", 7),
        "monthly_chart": chart_rows(monthly_stats["weekly"], "bucket", "jobs", 6),
        "pending_this_week": pending_row["c"] if pending_row else 0,
        "avg_return_hours": avg_row["avg_hours"] if avg_row else None,
    }


def report_filter_values() -> dict[str, str]:
    return {
        "horizon": request.values.get("horizon", "monthly").strip() or "monthly",
        "date_from": request.values.get("date_from", "").strip(),
        "date_to": request.values.get("date_to", "").strip(),
        "instrument_id": request.values.get("instrument_id", "").strip(),
        "group_name": request.values.get("group_name", "").strip(),
    }


def resolve_report_window(filters: dict[str, str]) -> tuple[str | None, str | None, str]:
    today = datetime.utcnow().date()
    horizon = filters.get("horizon", "monthly")
    if horizon == "weekly":
        start = today - timedelta(days=today.weekday())
        end = start + timedelta(days=6)
        return start.isoformat(), end.isoformat(), "Weekly"
    if horizon == "monthly":
        start = today.replace(day=1)
        next_month = date(start.year + 1, 1, 1) if start.month == 12 else date(start.year, start.month + 1, 1)
        end = next_month - timedelta(days=1)
        return start.isoformat(), end.isoformat(), "Monthly"
    if horizon == "yearly":
        start = date(today.year, 1, 1)
        end = date(today.year, 12, 31)
        return start.isoformat(), end.isoformat(), "Yearly"
    if horizon == "range":
        return filters.get("date_from") or None, filters.get("date_to") or None, "Custom Range"
    return None, None, "All Time"


def apply_report_window(
    clauses: list[str],
    params: list,
    field_sql: str,
    filters: dict[str, str] | None = None,
) -> tuple[list[str], list, dict[str, str | None]]:
    active_filters = filters or {"horizon": "all"}
    date_from, date_to, label = resolve_report_window(active_filters)
    scoped_clauses = list(clauses)
    scoped_params = list(params)
    if date_from:
        scoped_clauses.append(f"substr({field_sql}, 1, 10) >= ?")
        scoped_params.append(date_from)
    if date_to:
        scoped_clauses.append(f"substr({field_sql}, 1, 10) <= ?")
        scoped_params.append(date_to)
    return scoped_clauses, scoped_params, {"date_from": date_from, "date_to": date_to, "label": label}


def generate_export_workbook(
    user: sqlite3.Row,
    report_filters: dict[str, str] | None = None,
    instrument_id: int | None = None,
    group_name: str | None = None,
    filename_prefix: str = "lab_scheduler_export",
) -> Path:
    EXPORT_DIR.mkdir(exist_ok=True)
    clauses, params = scoped_stats_filters(user, instrument_id=instrument_id, group_name=group_name)
    clauses, params, report_window = apply_report_window(clauses, params, "sr.created_at", report_filters)
    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    rows = query_all(
        f"""
        SELECT sr.request_no, sr.status, sr.priority, sr.sample_name, sr.sample_count, sr.sample_origin,
               sr.receipt_number, sr.amount_due, sr.amount_paid, sr.finance_status, sr.created_at,
               sr.sample_submitted_at, sr.sample_received_at, sr.scheduled_for, sr.completed_at,
               sr.remarks, sr.results_summary,
               i.name AS instrument_name, i.faculty_group, r.name AS requester_name, r.email AS requester_email,
               c.name AS originator_name, c.role AS originator_role,
               o.name AS operator_name
        FROM sample_requests sr
        JOIN instruments i ON i.id = sr.instrument_id
        JOIN users r ON r.id = sr.requester_id
        LEFT JOIN users c ON c.id = sr.created_by_user_id
        LEFT JOIN users o ON o.id = sr.assigned_operator_id
        {where_sql}
        ORDER BY sr.created_at DESC
        """,
        tuple(params),
    )
    stats = stats_payload_for_scope(user, report_filters, instrument_id=instrument_id, group_name=group_name)
    workbook = Workbook()
    schedule_sheet = workbook.active
    schedule_sheet.title = "Schedule Export"
    schedule_sheet.append(
        [
            "Request No",
            "Status",
            "Priority",
            "Instrument",
            "Group",
            "Requester",
            "Requester Email",
            "Originator",
            "Originator Role",
            "Operator",
            "Sample",
            "Sample Count",
            "Origin",
            "Receipt Number",
            "Amount Due",
            "Amount Paid",
            "Finance Status",
            "Created At",
            "Sample Submitted At",
            "Sample Received At",
            "Scheduled For",
            "Completed At",
            "Remarks",
            "Results Summary",
        ]
    )
    for row in rows:
        schedule_sheet.append(
            [
                row["request_no"],
                row["status"],
                row["priority"],
                row["instrument_name"],
                row["faculty_group"] or "",
                row["requester_name"],
                row["requester_email"],
                row["originator_name"] or "",
                row["originator_role"] or "",
                row["operator_name"] or "",
                row["sample_name"],
                row["sample_count"],
                row["sample_origin"],
                row["receipt_number"],
                row["amount_due"],
                row["amount_paid"],
                row["finance_status"],
                row["created_at"],
                row["sample_submitted_at"] or "",
                row["sample_received_at"] or "",
                row["scheduled_for"] or "",
                row["completed_at"] or "",
                row["remarks"],
                row["results_summary"],
            ]
        )

    summary_sheet = workbook.create_sheet("Summary Stats")
    summary_sheet.append(["Metric", "Value"])
    summary_sheet.append(["Report Horizon", report_window["label"]])
    summary_sheet.append(["Date From", report_window["date_from"] or "-"])
    summary_sheet.append(["Date To", report_window["date_to"] or "-"])
    for key, value in stats["summary"].items():
        summary_sheet.append([key.replace("_", " ").title(), value])

    for title, dataset in [
        ("Daily Stats", stats["daily"]),
        ("Weekly Stats", stats["weekly"]),
        ("Monthly Stats", stats["monthly"]),
    ]:
        sheet = workbook.create_sheet(title)
        sheet.append(["Period", "Completed Jobs", "Completed Samples"])
        for row in dataset:
            sheet.append([row["bucket"], row["jobs"], row["samples"]])

    instrument_sheet = workbook.create_sheet("Instrument Stats")
    instrument_sheet.append(["Instrument", "Total Requests", "Completed Jobs", "Completed Samples"])
    for row in stats["by_instrument"]:
        instrument_sheet.append([row["instrument_name"], row["total_requests"], row["completed_jobs"], row["completed_samples"]])

    filename = f"{filename_prefix}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.xlsx"
    path = EXPORT_DIR / filename
    workbook.save(path)
    scope_label = f"{user['role'] if user['role'] != 'requester' else 'requester-self'} | {report_window['label']}"
    existing = query_one("SELECT id FROM generated_exports WHERE filename = ?", (filename,))
    if existing is None:
        execute(
            "INSERT INTO generated_exports (filename, created_by_user_id, created_at, scope_label) VALUES (?, ?, ?, ?)",
            (filename, user["id"], now_iso(), scope_label),
        )
    return path


def current_user() -> sqlite3.Row | None:
    user_id = session.get("user_id")
    if not user_id:
        return None
    return query_one("SELECT * FROM users WHERE id = ?", (user_id,))


def is_owner(user: sqlite3.Row | None) -> bool:
    return bool(user and user["email"].strip().lower() in OWNER_EMAILS)


ROLE_ACCESS_PRESETS: dict[str, dict[str, object]] = {
    "requester": {
        "can_access_instruments": False,
        "can_access_schedule": False,
        "can_access_calendar": False,
        "can_access_stats": False,
        "can_manage_members": False,
        "can_use_role_switcher": False,
        "can_view_all_requests": False,
        "can_view_all_instruments": False,
        "can_view_user_profiles": False,
        "can_view_finance_stage": False,
        "can_view_professor_stage": False,
        "card_visible_fields": {"remarks", "results_summary", "submitted_documents", "conversation", "events", "requester_identity", "operator_identity"},
        "card_action_fields": {"reply", "upload_attachment", "mark_submitted"},
    },
    "finance_admin": {
        "can_access_instruments": False,
        "can_access_schedule": False,
        "can_access_calendar": False,
        "can_access_stats": False,
        "can_manage_members": False,
        "can_use_role_switcher": False,
        "can_view_all_requests": False,
        "can_view_all_instruments": False,
        "can_view_user_profiles": False,
        "can_view_finance_stage": True,
        "can_view_professor_stage": False,
        "card_visible_fields": {"remarks", "submitted_documents", "conversation", "events"},
        "card_action_fields": {"reply", "upload_attachment"},
    },
    "professor_approver": {
        "can_access_instruments": True,
        "can_access_schedule": True,
        "can_access_calendar": True,
        "can_access_stats": True,
        "can_manage_members": False,
        "can_use_role_switcher": False,
        "can_view_all_requests": True,
        "can_view_all_instruments": True,
        "can_view_user_profiles": True,
        "can_view_finance_stage": False,
        "can_view_professor_stage": True,
        "card_visible_fields": {"remarks", "results_summary", "submitted_documents", "conversation", "events", "requester_identity", "operator_identity"},
        "card_action_fields": {"reply", "upload_attachment"},
    },
    "instrument_admin": {
        "can_access_instruments": True,
        "can_access_schedule": True,
        "can_access_calendar": True,
        "can_access_stats": True,
        "can_manage_members": False,
        "can_use_role_switcher": False,
        "can_view_all_requests": False,
        "can_view_all_instruments": False,
        "can_view_user_profiles": True,
        "can_view_finance_stage": False,
        "can_view_professor_stage": False,
        "card_visible_fields": {"remarks", "results_summary", "submitted_documents", "conversation", "events", "requester_identity", "operator_identity"},
        "card_action_fields": {"reply", "upload_attachment", "finish_fast", "reassign", "mark_received", "update_status"},
    },
    "operator": {
        "can_access_instruments": True,
        "can_access_schedule": True,
        "can_access_calendar": True,
        "can_access_stats": True,
        "can_manage_members": False,
        "can_use_role_switcher": False,
        "can_view_all_requests": False,
        "can_view_all_instruments": False,
        "can_view_user_profiles": True,
        "can_view_finance_stage": False,
        "can_view_professor_stage": False,
        "card_visible_fields": {"remarks", "results_summary", "submitted_documents", "conversation", "events", "requester_identity", "operator_identity"},
        "card_action_fields": {"reply", "upload_attachment", "finish_fast", "reassign", "mark_received"},
    },
    "site_admin": {
        "can_access_instruments": True,
        "can_access_schedule": True,
        "can_access_calendar": True,
        "can_access_stats": True,
        "can_manage_members": False,
        "can_use_role_switcher": False,
        "can_view_all_requests": True,
        "can_view_all_instruments": True,
        "can_view_user_profiles": True,
        "can_view_finance_stage": True,
        "can_view_professor_stage": True,
        "card_visible_fields": {"remarks", "results_summary", "submitted_documents", "conversation", "events", "requester_identity", "operator_identity"},
        "card_action_fields": {"reply", "upload_attachment", "finish_fast", "reassign", "mark_received", "update_status"},
    },
    "super_admin": {
        "can_access_instruments": True,
        "can_access_schedule": True,
        "can_access_calendar": True,
        "can_access_stats": True,
        "can_manage_members": True,
        "can_use_role_switcher": True,
        "can_view_all_requests": True,
        "can_view_all_instruments": True,
        "can_view_user_profiles": True,
        "can_view_finance_stage": True,
        "can_view_professor_stage": True,
        "card_visible_fields": {"remarks", "results_summary", "submitted_documents", "conversation", "events", "requester_identity", "operator_identity"},
        "card_action_fields": {"reply", "upload_attachment", "finish_fast", "reassign", "mark_received", "update_status"},
    },
}


def user_access_profile(user: sqlite3.Row | None) -> dict[str, object]:
    if user is None:
        return {
            "role": None,
            "is_owner": False,
            "assigned_instrument_ids": [],
            "has_instrument_scope": False,
            "can_access_instruments": False,
            "can_access_schedule": False,
            "can_access_calendar": False,
            "can_access_stats": False,
            "can_manage_members": False,
            "can_use_role_switcher": False,
            "can_view_all_requests": False,
            "can_view_all_instruments": False,
            "can_view_user_profiles": False,
            "can_view_finance_stage": False,
            "can_view_professor_stage": False,
            "card_visible_fields": set(),
            "card_action_fields": set(),
        }
    preset = ROLE_ACCESS_PRESETS.get(user["role"], ROLE_ACCESS_PRESETS["requester"])
    instrument_ids = assigned_instrument_ids(user)
    is_owner_user = is_owner(user)
    card_fields = set(preset["card_visible_fields"])
    card_actions = set(preset["card_action_fields"])
    profile = {
        "role": user["role"],
        "is_owner": is_owner_user,
        "assigned_instrument_ids": instrument_ids,
        "has_instrument_scope": bool(instrument_ids),
        "can_access_instruments": bool(preset["can_access_instruments"] or instrument_ids),
        "can_access_schedule": bool(preset["can_access_schedule"] or instrument_ids),
        "can_access_calendar": bool(preset["can_access_calendar"] or instrument_ids),
        "can_access_stats": bool(preset["can_access_stats"] or instrument_ids),
        "can_manage_members": bool(preset["can_manage_members"] or is_owner_user),
        "can_use_role_switcher": bool(preset["can_use_role_switcher"] or is_owner_user),
        "can_view_all_requests": bool(preset["can_view_all_requests"] or is_owner_user),
        "can_view_all_instruments": bool(preset["can_view_all_instruments"] or is_owner_user),
        "can_view_user_profiles": bool(preset["can_view_user_profiles"] or is_owner_user),
        "can_view_finance_stage": bool(preset["can_view_finance_stage"] or is_owner_user),
        "can_view_professor_stage": bool(preset["can_view_professor_stage"] or is_owner_user),
        "card_visible_fields": card_fields,
        "card_action_fields": card_actions,
    }
    if is_owner_user:
        profile["can_access_instruments"] = True
        profile["can_access_schedule"] = True
        profile["can_access_calendar"] = True
        profile["can_access_stats"] = True
        profile["can_manage_members"] = True
        profile["can_use_role_switcher"] = True
        profile["can_view_all_requests"] = True
        profile["can_view_all_instruments"] = True
        profile["can_view_user_profiles"] = True
        profile["can_view_finance_stage"] = True
        profile["can_view_professor_stage"] = True
    return profile


def can_manage_members(user: sqlite3.Row | None) -> bool:
    return bool(user_access_profile(user)["can_manage_members"])


def can_use_role_switcher(user: sqlite3.Row | None) -> bool:
    return bool(user_access_profile(user)["can_use_role_switcher"])


def can_approve_step(user: sqlite3.Row, step: sqlite3.Row, instrument_id: int) -> bool:
    if user["role"] in {"super_admin", "site_admin"}:
        return True
    if step["approver_role"] == "finance":
        return user["role"] == "finance_admin"
    if step["approver_role"] == "professor":
        return user["role"] in {"professor_approver", "super_admin", "site_admin"}
    if step["approver_role"] == "operator":
        return can_operate_instrument(user["id"], instrument_id, user["role"])
    return False


def login_required(view):
    @wraps(view)
    def wrapped(**kwargs):
        if current_user() is None:
            return redirect(url_for("login"))
        return view(**kwargs)

    return wrapped


def role_required(*roles: str):
    def decorator(view):
        @wraps(view)
        def wrapped(**kwargs):
            user = current_user()
            if user is None:
                return redirect(url_for("login"))
            if user["role"] not in roles:
                abort(403)
            return view(**kwargs)

        return wrapped

    return decorator


def owner_required(view):
    @wraps(view)
    def wrapped(**kwargs):
        user = current_user()
        if user is None:
            return redirect(url_for("login"))
        if not is_owner(user):
            abort(403)
        return view(**kwargs)

    return wrapped


def can_manage_instrument(user_id: int, instrument_id: int, role: str) -> bool:
    if role in {"super_admin", "site_admin"}:
        return True
    for table in ("instrument_admins", "instrument_operators", "instrument_faculty_admins"):
        row = query_one(
            f"SELECT 1 FROM {table} WHERE user_id = ? AND instrument_id = ?",
            (user_id, instrument_id),
        )
        if row is not None:
            return True
    return False


def can_operate_instrument(user_id: int, instrument_id: int, role: str) -> bool:
    if can_manage_instrument(user_id, instrument_id, role):
        return True
    row = query_one(
        "SELECT 1 FROM instrument_operators WHERE user_id = ? AND instrument_id = ?",
        (user_id, instrument_id),
    )
    return row is not None


def assigned_instrument_ids(user: sqlite3.Row) -> list[int]:
    if user["role"] in {"super_admin", "site_admin", "professor_approver"}:
        rows = query_all("SELECT id FROM instruments ORDER BY id")
        return [row["id"] for row in rows]
    rows = query_all(
        """
        SELECT instrument_id FROM instrument_admins WHERE user_id = ?
        UNION
        SELECT instrument_id FROM instrument_operators WHERE user_id = ?
        UNION
        SELECT instrument_id FROM instrument_faculty_admins WHERE user_id = ?
        ORDER BY instrument_id
        """,
        (user["id"], user["id"], user["id"]),
    )
    return [row["instrument_id"] for row in rows]


def visible_instruments_for_user(user: sqlite3.Row, active_only: bool = True) -> list[sqlite3.Row]:
    role = user["role"]
    status_clause = "WHERE status = 'active'" if active_only else ""
    if role in {"super_admin", "site_admin", "professor_approver"}:
        return query_all(
            f"SELECT id, name, code, status FROM instruments {status_clause} ORDER BY name"
        )
    instrument_ids = assigned_instrument_ids(user)
    if instrument_ids:
        placeholders = ",".join("?" for _ in instrument_ids)
        status_and = "AND status = 'active'" if active_only else ""
        return query_all(
            f"SELECT id, name, code, status FROM instruments WHERE id IN ({placeholders}) {status_and} ORDER BY name",
            tuple(instrument_ids),
        )
    return []


def has_instrument_area_access(user: sqlite3.Row | None) -> bool:
    return bool(user_access_profile(user)["can_access_instruments"])


def sync_instrument_assignments(table: str, instrument_id: int, user_ids: list[int]) -> None:
    allowed = {"instrument_admins", "instrument_operators", "instrument_faculty_admins"}
    if table not in allowed:
        raise ValueError("Unsupported assignment table")
    db = get_db()
    db.execute(f"DELETE FROM {table} WHERE instrument_id = ?", (instrument_id,))
    for user_id in sorted(set(user_ids)):
        db.execute(f"INSERT INTO {table} (user_id, instrument_id) VALUES (?, ?)", (user_id, instrument_id))
    db.commit()


def request_scope_sql(user: sqlite3.Row, alias: str = "sr") -> tuple[list[str], list]:
    clauses: list[str] = []
    params: list = []
    if user["role"] in {"super_admin", "site_admin", "professor_approver"}:
        return clauses, params
    instrument_ids = assigned_instrument_ids(user)
    if instrument_ids:
        placeholders = ",".join("?" for _ in instrument_ids)
        clauses.append(f"{alias}.instrument_id IN ({placeholders})")
        params.extend(instrument_ids)
        return clauses, params
    if user["role"] == "requester":
        clauses.append(f"{alias}.requester_id = ?")
        params.append(user["id"])
        return clauses, params
    if user["role"] == "finance_admin":
        clauses.append(f"{alias}.status = 'under_review'")
        clauses.append(
            f"EXISTS (SELECT 1 FROM approval_steps aps WHERE aps.sample_request_id = {alias}.id AND aps.approver_role = 'finance')"
        )
        return clauses, params
    if user["role"] == "professor_approver":
        clauses.append(f"{alias}.status = 'under_review'")
        clauses.append(
            f"EXISTS (SELECT 1 FROM approval_steps aps WHERE aps.sample_request_id = {alias}.id AND aps.approver_role = 'professor')"
        )
        return clauses, params
    clauses.append("1 = 0")
    return clauses, params


def scoped_instrument_count(user: sqlite3.Row) -> int:
    if user["role"] in {"super_admin", "site_admin", "professor_approver"}:
        return query_one("SELECT COUNT(*) AS c FROM instruments WHERE status = 'active'")["c"]
    instrument_ids = assigned_instrument_ids(user)
    if instrument_ids:
        placeholders = ",".join("?" for _ in instrument_ids)
        row = query_one(f"SELECT COUNT(*) AS c FROM instruments WHERE status = 'active' AND id IN ({placeholders})", tuple(instrument_ids))
        return row["c"] if row else 0
    if user["role"] == "requester":
        return query_one("SELECT COUNT(DISTINCT instrument_id) AS c FROM sample_requests WHERE requester_id = ?", (user["id"],))["c"]
    if user["role"] in {"finance_admin", "professor_approver"}:
        clauses, params = request_scope_sql(user, "sr")
        row = query_one(
            f"SELECT COUNT(DISTINCT sr.instrument_id) AS c FROM sample_requests sr {'WHERE ' + ' AND '.join(clauses) if clauses else ''}",
            tuple(params),
        )
        return row["c"] if row else 0
    return 0


def can_access_stats(user: sqlite3.Row | None) -> bool:
    return bool(user_access_profile(user)["can_access_stats"])


def can_access_schedule(user: sqlite3.Row | None) -> bool:
    return bool(user_access_profile(user)["can_access_schedule"])


def can_access_calendar(user: sqlite3.Row | None) -> bool:
    return bool(user_access_profile(user)["can_access_calendar"])


def init_db() -> None:
    db = sqlite3.connect(DB_PATH)
    with closing(db.cursor()) as cur:
        cur.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL,
                invited_by INTEGER,
                invite_status TEXT NOT NULL DEFAULT 'active',
                active INTEGER NOT NULL DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS instruments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                code TEXT UNIQUE NOT NULL,
                category TEXT NOT NULL,
                location TEXT NOT NULL,
                daily_capacity INTEGER NOT NULL DEFAULT 3,
                status TEXT NOT NULL DEFAULT 'active',
                notes TEXT NOT NULL DEFAULT '',
                office_info TEXT NOT NULL DEFAULT '',
                faculty_group TEXT NOT NULL DEFAULT '',
                manufacturer TEXT NOT NULL DEFAULT '',
                model_number TEXT NOT NULL DEFAULT '',
                capabilities_summary TEXT NOT NULL DEFAULT '',
                machine_photo_url TEXT NOT NULL DEFAULT '',
                reference_links TEXT NOT NULL DEFAULT '',
                instrument_description TEXT NOT NULL DEFAULT '',
                accepting_requests INTEGER NOT NULL DEFAULT 1,
                soft_accept_enabled INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS instrument_admins (
                user_id INTEGER NOT NULL,
                instrument_id INTEGER NOT NULL,
                PRIMARY KEY (user_id, instrument_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (instrument_id) REFERENCES instruments(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS instrument_operators (
                user_id INTEGER NOT NULL,
                instrument_id INTEGER NOT NULL,
                PRIMARY KEY (user_id, instrument_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (instrument_id) REFERENCES instruments(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS instrument_faculty_admins (
                user_id INTEGER NOT NULL,
                instrument_id INTEGER NOT NULL,
                PRIMARY KEY (user_id, instrument_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (instrument_id) REFERENCES instruments(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS sample_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                request_no TEXT UNIQUE NOT NULL,
                sample_ref TEXT UNIQUE,
                requester_id INTEGER NOT NULL,
                created_by_user_id INTEGER NOT NULL,
                originator_note TEXT NOT NULL DEFAULT '',
                instrument_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                sample_name TEXT NOT NULL,
                sample_count INTEGER NOT NULL DEFAULT 1,
                description TEXT NOT NULL,
                sample_origin TEXT NOT NULL DEFAULT 'internal',
                receipt_number TEXT NOT NULL DEFAULT '',
                amount_due REAL NOT NULL DEFAULT 0,
                amount_paid REAL NOT NULL DEFAULT 0,
                finance_status TEXT NOT NULL DEFAULT 'n/a',
                priority TEXT NOT NULL DEFAULT 'normal',
                status TEXT NOT NULL DEFAULT 'submitted',
                submitted_to_lab_at TEXT,
                sample_submitted_at TEXT,
                sample_received_at TEXT,
                sample_dropoff_note TEXT NOT NULL DEFAULT '',
                received_by_operator_id INTEGER,
                assigned_operator_id INTEGER,
                scheduled_for TEXT,
                remarks TEXT NOT NULL DEFAULT '',
                results_summary TEXT NOT NULL DEFAULT '',
                result_email_status TEXT NOT NULL DEFAULT '',
                result_email_sent_at TEXT,
                completion_locked INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                completed_at TEXT,
                FOREIGN KEY (requester_id) REFERENCES users(id),
                FOREIGN KEY (created_by_user_id) REFERENCES users(id),
                FOREIGN KEY (instrument_id) REFERENCES instruments(id),
                FOREIGN KEY (received_by_operator_id) REFERENCES users(id),
                FOREIGN KEY (assigned_operator_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS approval_steps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sample_request_id INTEGER NOT NULL,
                step_order INTEGER NOT NULL,
                approver_role TEXT NOT NULL,
                approver_user_id INTEGER,
                status TEXT NOT NULL DEFAULT 'pending',
                remarks TEXT NOT NULL DEFAULT '',
                acted_at TEXT,
                FOREIGN KEY (sample_request_id) REFERENCES sample_requests(id) ON DELETE CASCADE,
                FOREIGN KEY (approver_user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_type TEXT NOT NULL,
                entity_id INTEGER NOT NULL,
                action TEXT NOT NULL,
                actor_id INTEGER,
                payload_json TEXT NOT NULL,
                prev_hash TEXT NOT NULL,
                entry_hash TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (actor_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS request_attachments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                request_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                instrument_id INTEGER NOT NULL,
                original_filename TEXT NOT NULL,
                stored_filename TEXT NOT NULL,
                relative_path TEXT NOT NULL,
                file_extension TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                file_size INTEGER NOT NULL DEFAULT 0,
                uploaded_by_user_id INTEGER NOT NULL,
                uploaded_at TEXT NOT NULL,
                attachment_type TEXT NOT NULL DEFAULT 'other',
                note TEXT NOT NULL DEFAULT '',
                is_active INTEGER NOT NULL DEFAULT 1,
                request_message_id INTEGER,
                FOREIGN KEY (request_id) REFERENCES sample_requests(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (instrument_id) REFERENCES instruments(id),
                FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id),
                FOREIGN KEY (request_message_id) REFERENCES request_messages(id)
            );

            CREATE TABLE IF NOT EXISTS request_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                request_id INTEGER NOT NULL,
                sender_user_id INTEGER NOT NULL,
                note_kind TEXT NOT NULL DEFAULT 'requester_note',
                message_body TEXT NOT NULL,
                created_at TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1,
                FOREIGN KEY (request_id) REFERENCES sample_requests(id) ON DELETE CASCADE,
                FOREIGN KEY (sender_user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS request_issues (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                request_id INTEGER NOT NULL,
                created_by_user_id INTEGER NOT NULL,
                issue_message TEXT NOT NULL,
                response_message TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'open',
                created_at TEXT NOT NULL,
                responded_at TEXT,
                responded_by_user_id INTEGER,
                resolved_at TEXT,
                resolved_by_user_id INTEGER,
                FOREIGN KEY (request_id) REFERENCES sample_requests(id) ON DELETE CASCADE,
                FOREIGN KEY (created_by_user_id) REFERENCES users(id),
                FOREIGN KEY (responded_by_user_id) REFERENCES users(id),
                FOREIGN KEY (resolved_by_user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS instrument_downtime (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                instrument_id INTEGER NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                reason TEXT NOT NULL,
                created_by_user_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1,
                FOREIGN KEY (instrument_id) REFERENCES instruments(id) ON DELETE CASCADE,
                FOREIGN KEY (created_by_user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS generated_exports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT UNIQUE NOT NULL,
                created_by_user_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                scope_label TEXT NOT NULL,
                FOREIGN KEY (created_by_user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS instrument_approval_config (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                instrument_id INTEGER NOT NULL,
                step_order INTEGER NOT NULL,
                approver_role TEXT NOT NULL,
                approver_user_id INTEGER,
                UNIQUE(instrument_id, step_order),
                FOREIGN KEY (instrument_id) REFERENCES instruments(id) ON DELETE CASCADE,
                FOREIGN KEY (approver_user_id) REFERENCES users(id)
            );
            """
        )
        columns = {row[1] for row in cur.execute("PRAGMA table_info(sample_requests)").fetchall()}
        if "created_by_user_id" not in columns:
            cur.execute("ALTER TABLE sample_requests ADD COLUMN created_by_user_id INTEGER")
        if "sample_ref" not in columns:
            cur.execute("ALTER TABLE sample_requests ADD COLUMN sample_ref TEXT")
        if "originator_note" not in columns:
            cur.execute("ALTER TABLE sample_requests ADD COLUMN originator_note TEXT NOT NULL DEFAULT ''")
        cur.execute("UPDATE sample_requests SET created_by_user_id = requester_id WHERE created_by_user_id IS NULL")
        if "submitted_to_lab_at" not in columns:
            cur.execute("ALTER TABLE sample_requests ADD COLUMN submitted_to_lab_at TEXT")
        if "sample_submitted_at" not in columns:
            cur.execute("ALTER TABLE sample_requests ADD COLUMN sample_submitted_at TEXT")
        if "sample_received_at" not in columns:
            cur.execute("ALTER TABLE sample_requests ADD COLUMN sample_received_at TEXT")
        if "sample_dropoff_note" not in columns:
            cur.execute("ALTER TABLE sample_requests ADD COLUMN sample_dropoff_note TEXT NOT NULL DEFAULT ''")
        if "received_by_operator_id" not in columns:
            cur.execute("ALTER TABLE sample_requests ADD COLUMN received_by_operator_id INTEGER")
        attachment_columns = {row[1] for row in cur.execute("PRAGMA table_info(request_attachments)").fetchall()}
        if "note" not in attachment_columns:
            cur.execute("ALTER TABLE request_attachments ADD COLUMN note TEXT NOT NULL DEFAULT ''")
        if "request_message_id" not in attachment_columns:
            cur.execute("ALTER TABLE request_attachments ADD COLUMN request_message_id INTEGER")
        request_message_columns = {row[1] for row in cur.execute("PRAGMA table_info(request_messages)").fetchall()}
        if "note_kind" not in request_message_columns:
            cur.execute("ALTER TABLE request_messages ADD COLUMN note_kind TEXT NOT NULL DEFAULT 'requester_note'")
        instrument_columns = {row[1] for row in cur.execute("PRAGMA table_info(instruments)").fetchall()}
        if "office_info" not in instrument_columns:
            cur.execute("ALTER TABLE instruments ADD COLUMN office_info TEXT NOT NULL DEFAULT ''")
        if "faculty_group" not in instrument_columns:
            cur.execute("ALTER TABLE instruments ADD COLUMN faculty_group TEXT NOT NULL DEFAULT ''")
        if "manufacturer" not in instrument_columns:
            cur.execute("ALTER TABLE instruments ADD COLUMN manufacturer TEXT NOT NULL DEFAULT ''")
        if "model_number" not in instrument_columns:
            cur.execute("ALTER TABLE instruments ADD COLUMN model_number TEXT NOT NULL DEFAULT ''")
        if "capabilities_summary" not in instrument_columns:
            cur.execute("ALTER TABLE instruments ADD COLUMN capabilities_summary TEXT NOT NULL DEFAULT ''")
        if "machine_photo_url" not in instrument_columns:
            cur.execute("ALTER TABLE instruments ADD COLUMN machine_photo_url TEXT NOT NULL DEFAULT ''")
        if "reference_links" not in instrument_columns:
            cur.execute("ALTER TABLE instruments ADD COLUMN reference_links TEXT NOT NULL DEFAULT ''")
        if "instrument_description" not in instrument_columns:
            cur.execute("ALTER TABLE instruments ADD COLUMN instrument_description TEXT NOT NULL DEFAULT ''")
        if "accepting_requests" not in instrument_columns:
            cur.execute("ALTER TABLE instruments ADD COLUMN accepting_requests INTEGER NOT NULL DEFAULT 1")
        if "soft_accept_enabled" not in instrument_columns:
            cur.execute("ALTER TABLE instruments ADD COLUMN soft_accept_enabled INTEGER NOT NULL DEFAULT 0")
        db.commit()
    db.close()
    seed_data()


def seed_data() -> None:
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    existing = db.execute("SELECT COUNT(*) AS count FROM users").fetchone()["count"]
    if existing:
        db.close()
        return

    users = [
        ("Dean Rao", "dean@lab.local", "super_admin"),
        ("Facility Admin", "admin@lab.local", "super_admin"),
        ("Finance Office", "finance@lab.local", "finance_admin"),
        ("Prof. Approver", "prof.approver@lab.local", "professor_approver"),
        ("FESEM Admin", "fesem.admin@lab.local", "instrument_admin"),
        ("ICPMS Admin", "icpms.admin@lab.local", "instrument_admin"),
        ("Anika", "anika@lab.local", "operator"),
        ("Ravi", "ravi@lab.local", "operator"),
        ("Prof. Sen", "sen@lab.local", "requester"),
        ("Prof. Iyer", "iyer@lab.local", "requester"),
        ("Dr. Shah", "shah@lab.local", "requester"),
    ]
    default_password = generate_password_hash("SimplePass123", method="pbkdf2:sha256")
    for name, email, role in users:
        db.execute(
            "INSERT OR IGNORE INTO users (name, email, password_hash, role, invite_status) VALUES (?, ?, ?, ?, 'active')",
            (name, email, default_password, role),
        )

    instruments = [
        ("FESEM", "INST-001", "Microscopy", "Central Instrument Facility", 3, "High-resolution imaging", "CIF Office 201", "Materials and Imaging", "Zeiss", "Sigma 300", "High-resolution surface morphology, particle imaging, cross-section imaging, and elemental mapping support.", "https://images.unsplash.com/photo-1518152006812-edab29b069ac?auto=format&fit=crop&w=900&q=80", "https://www.zeiss.com/microscopy/en/products/scanning-electron-microscopes.html", "Field-emission scanning electron microscope for morphology and surface analysis.", 1, 0),
        ("ICP-MS", "INST-002", "Spectroscopy", "Analytical Bay", 3, "Trace elemental analysis", "Analytical Office 104", "Chemistry and Earth Sciences", "Agilent", "7900 ICP-MS", "Trace metal screening, multi-element quantification, environmental and water sample analysis.", "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=900&q=80", "https://www.agilent.com/", "Inductively coupled plasma mass spectrometer for trace elemental quantification.", 1, 1),
        ("XRD", "INST-003", "Diffraction", "Materials Lab", 4, "Phase identification", "Materials Office 118", "Materials Characterization", "Bruker", "D8 Advance", "Powder diffraction, phase analysis, crystallinity checks, and routine materials characterization.", "https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&w=900&q=80", "https://www.bruker.com/", "Powder diffraction workflow for crystal structure and phase checks.", 1, 0),
        ("DSC", "INST-004", "Thermal", "Thermal Suite", 4, "Thermal transitions", "Thermal Analysis Office 110", "Polymers and Materials", "TA Instruments", "Q2000", "Glass transition, melting behavior, crystallization windows, and comparative thermal transition studies.", "https://images.unsplash.com/photo-1532187643603-ba119ca4109e?auto=format&fit=crop&w=900&q=80", "https://www.tainstruments.com/", "Differential scanning calorimetry for transition and stability studies.", 1, 0),
    ]
    for name, code, category, location, cap, notes, office_info, faculty_group, manufacturer, model_number, capabilities_summary, machine_photo_url, reference_links, instrument_description, accepting_requests, soft_accept_enabled in instruments:
        db.execute(
            """
            INSERT OR IGNORE INTO instruments (name, code, category, location, daily_capacity, notes, office_info, faculty_group, manufacturer, model_number, capabilities_summary, machine_photo_url, reference_links, instrument_description, accepting_requests, soft_accept_enabled)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (name, code, category, location, cap, notes, office_info, faculty_group, manufacturer, model_number, capabilities_summary, machine_photo_url, reference_links, instrument_description, accepting_requests, soft_accept_enabled),
        )

    assignments = [
        ("fesem.admin@lab.local", "INST-001", "admin"),
        ("icpms.admin@lab.local", "INST-002", "admin"),
        ("anika@lab.local", "INST-001", "operator"),
        ("ravi@lab.local", "INST-002", "operator"),
        ("sen@lab.local", "INST-001", "faculty"),
        ("iyer@lab.local", "INST-002", "faculty"),
        ("shah@lab.local", "INST-003", "faculty"),
        ("sen@lab.local", "INST-004", "faculty"),
    ]
    for email, code, kind in assignments:
        user_id = db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()[0]
        inst_id = db.execute("SELECT id FROM instruments WHERE code = ?", (code,)).fetchone()[0]
        if kind == "admin":
            table = "instrument_admins"
        elif kind == "operator":
            table = "instrument_operators"
        else:
            table = "instrument_faculty_admins"
        db.execute(f"INSERT OR IGNORE INTO {table} (user_id, instrument_id) VALUES (?, ?)", (user_id, inst_id))

    demo_requests = [
        ("REQ-1001", "sen@lab.local", "INST-001", "Nanoparticle morphology", "Au NP Batch A", 3, "internal", "", 0, 0, "n/a", "under_review", None, None, None, None),
        ("REQ-1002", "iyer@lab.local", "INST-002", "Water trace metals", "River sample set", 3, "external", "RCPT-7782", 1500, 500, "partial", "awaiting_sample_submission", "ravi@lab.local", None, None, None),
        ("REQ-1003", "shah@lab.local", "INST-001", "Fiber surface imaging", "Polymer fiber lot 7", 2, "external", "RCPT-7783", 2000, 2000, "paid", "completed", "anika@lab.local", "2026-04-09 14:00", "2026-04-08T09:00:00Z", "2026-04-08T10:00:00Z"),
    ]
    for req_no, requester_email, inst_code, title, sample_name, sample_count, sample_origin, receipt_number, amount_due, amount_paid, finance_status, status, operator_email, scheduled, sample_submitted_at, sample_received_at in demo_requests:
        requester_id = db.execute("SELECT id FROM users WHERE email = ?", (requester_email,)).fetchone()[0]
        instrument_id = db.execute("SELECT id FROM instruments WHERE code = ?", (inst_code,)).fetchone()[0]
        operator_id = None
        if operator_email:
            operator_id = db.execute("SELECT id FROM users WHERE email = ?", (operator_email,)).fetchone()[0]
        created = now_iso()
        cur = db.execute(
            """
            INSERT OR IGNORE INTO sample_requests
            (request_no, requester_id, created_by_user_id, instrument_id, title, sample_name, sample_count, description, sample_origin,
             receipt_number, amount_due, amount_paid, finance_status, priority, status, sample_submitted_at, sample_received_at,
             received_by_operator_id, assigned_operator_id, scheduled_for,
             remarks, results_summary, result_email_status, result_email_sent_at, completion_locked, created_at, updated_at, completed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                req_no,
                requester_id,
                requester_id,
                instrument_id,
                title,
                sample_name,
                sample_count,
                f"Demo request for {title}.",
                sample_origin,
                receipt_number,
                amount_due,
                amount_paid,
                finance_status,
                "normal",
                status,
                sample_submitted_at,
                sample_received_at,
                operator_id if sample_received_at else None,
                operator_id,
                scheduled,
                "Initial seeded remark." if status != "under_review" else "",
                "Completed with report uploaded." if status == "completed" else "",
                "Seeded as already emailed." if status == "completed" else "",
                created if status == "completed" else None,
                1 if status == "completed" else 0,
                created,
                created,
                created if status == "completed" else None,
            ),
        )
        request_id = cur.lastrowid
        if not request_id:
            existing_request = db.execute("SELECT id FROM sample_requests WHERE request_no = ?", (req_no,)).fetchone()
            if existing_request is None:
                continue
            request_id = existing_request["id"]
        create_approval_chain(db, request_id, instrument_id)
        if status in {"awaiting_sample_submission", "sample_submitted", "sample_received", "scheduled", "completed"}:
            db.execute(
                "UPDATE approval_steps SET status = 'approved', acted_at = ?, remarks = 'Seeded approval complete' WHERE sample_request_id = ?",
                (created, request_id),
            )
        elif status == "under_review":
            db.execute(
                "UPDATE approval_steps SET status = 'pending' WHERE sample_request_id = ?",
                (request_id,),
            )

    seeded_rows = db.execute("SELECT id, requester_id, status FROM sample_requests").fetchall()
    for row in seeded_rows:
        payload_json = json.dumps({"status": row["status"]}, sort_keys=True)
        digest = hashlib.sha256(
            f"|sample_request|{row['id']}|seeded|{payload_json}".encode()
        ).hexdigest()
        db.execute(
            """
            INSERT INTO audit_logs (entity_type, entity_id, action, actor_id, payload_json, prev_hash, entry_hash, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            ("sample_request", row["id"], "seeded", row["requester_id"], payload_json, "", digest, now_iso()),
        )

    db.commit()
    db.close()


@app.context_processor
def inject_globals():
    user = current_user()
    access_profile = user_access_profile(user)
    support_admin_email = sorted(OWNER_EMAILS)[0] if OWNER_EMAILS else "admin@lab.local"
    V = "requester finance_admin professor_approver faculty_in_charge operator instrument_admin site_admin super_admin"
    return {
        "V": V,
        "current_user": user,
        "access_profile_user": access_profile,
        "support_admin_email": support_admin_email,
        "timedelta": timedelta,
        "is_owner_user": is_owner(user),
        "can_manage_members_user": bool(access_profile["can_manage_members"]),
        "can_use_role_switcher_user": bool(access_profile["can_use_role_switcher"]),
        "can_access_schedule_user": bool(access_profile["can_access_schedule"]),
        "can_access_calendar_user": bool(access_profile["can_access_calendar"]),
        "can_access_stats_user": bool(access_profile["can_access_stats"]),
        "request_display_status": request_display_status,
        "request_status_group": request_status_group,
        "request_status_summary": request_status_summary,
        "request_lifecycle_steps": request_lifecycle_steps,
        "format_dt": format_dt,
        "format_date": format_date,
        "format_duration_short": format_duration_short,
        "format_duration_days": format_duration_days,
        "instrument_intake_mode": instrument_intake_mode,
        "intake_mode_label": intake_mode_label,
        "has_instrument_area_access_user": bool(access_profile["can_access_instruments"]),
        "can_open_instrument_detail_id_user": lambda instrument_id: can_open_instrument_detail(user, instrument_id),
        "can_view_user_profile_id_user": lambda target_user_id: can_view_user_profile_id(user, target_user_id),
        "instrument_photo_src": instrument_photo_src,
        "request_card_policy_user": lambda request_row: request_card_policy(user, request_row),
        "request_card_can_view_field_user": lambda request_row, field_name: request_card_field_allowed(user, request_row, field_name),
    }


@app.route("/")
@login_required
def index():
    user = current_user()
    db = get_db()
    recent_page = page_value(int(request.args.get("recent_page", "1") or 1))
    clauses, params = request_scope_sql(user, "sr")
    where_sql = f" AND {' AND '.join(clauses)}" if clauses else ""
    queue_statuses = ("sample_submitted", "sample_received", "scheduled", "in_progress")
    counts = {
        "instruments": scoped_instrument_count(user),
        "open_requests": (
            db.execute(
                f"SELECT COUNT(*) FROM sample_requests sr WHERE status NOT IN ('completed', 'rejected'){where_sql}",
                tuple(params),
            ).fetchone()[0]
            if user["role"] == "requester" and not has_instrument_area_access(user)
            else db.execute(
                f"SELECT COUNT(*) FROM sample_requests sr WHERE status IN ({','.join('?' for _ in queue_statuses)}){where_sql}",
                tuple(queue_statuses) + tuple(params),
            ).fetchone()[0]
        ),
        "completed": db.execute(f"SELECT COUNT(*) FROM sample_requests sr WHERE status = 'completed'{where_sql}", tuple(params)).fetchone()[0],
        "samples_done": db.execute(
            f"SELECT COALESCE(SUM(sample_count), 0) FROM sample_requests sr WHERE status = 'completed'{where_sql}",
            tuple(params),
        ).fetchone()[0],
    }
    recent_per_page = 5
    if user["role"] == "requester" and not has_instrument_area_access(user):
        recent_total = db.execute(
            "SELECT COUNT(*) FROM sample_requests sr WHERE sr.requester_id = ?",
            (user["id"],),
        ).fetchone()[0]
        recent_total_pages = max(1, math.ceil(recent_total / recent_per_page))
        recent_page = min(recent_page, recent_total_pages)
        requests_rows = query_all(
            """
            SELECT sr.*, i.name AS instrument_name, u.name AS operator_name,
                   c.name AS originator_name, c.role AS originator_role
            FROM sample_requests sr
            JOIN instruments i ON i.id = sr.instrument_id
            LEFT JOIN users c ON c.id = sr.created_by_user_id
            LEFT JOIN users u ON u.id = sr.assigned_operator_id
            WHERE sr.requester_id = ?
            ORDER BY sr.created_at DESC
            LIMIT ? OFFSET ?
            """,
            (user["id"], recent_per_page, (recent_page - 1) * recent_per_page),
        )
    else:
        queue_where_clauses = list(clauses) + ["sr.status IN ('sample_submitted', 'sample_received', 'scheduled', 'in_progress', 'completed')"]
        queue_where_sql = "WHERE " + " AND ".join(queue_where_clauses)
        recent_total = db.execute(
            f"""
            SELECT COUNT(*)
            FROM sample_requests sr
            JOIN instruments i ON i.id = sr.instrument_id
            JOIN users r ON r.id = sr.requester_id
            LEFT JOIN users c ON c.id = sr.created_by_user_id
            LEFT JOIN users u ON u.id = sr.assigned_operator_id
            {queue_where_sql}
            """,
            tuple(params),
        ).fetchone()[0]
        recent_total_pages = max(1, math.ceil(recent_total / recent_per_page))
        recent_page = min(recent_page, recent_total_pages)
        requests_rows = query_all(
            """
            SELECT sr.*, i.name AS instrument_name, u.name AS operator_name, r.name AS requester_name,
                   c.name AS originator_name, c.role AS originator_role
            FROM sample_requests sr
            JOIN instruments i ON i.id = sr.instrument_id
            JOIN users r ON r.id = sr.requester_id
            LEFT JOIN users c ON c.id = sr.created_by_user_id
            LEFT JOIN users u ON u.id = sr.assigned_operator_id
            """
            + queue_where_sql
            + """
            ORDER BY
              CASE sr.status
                WHEN 'sample_submitted' THEN 1
                WHEN 'sample_received' THEN 2
                WHEN 'scheduled' THEN 3
                WHEN 'in_progress' THEN 4
                WHEN 'completed' THEN 5
                ELSE 6
              END,
              sr.created_at DESC
            LIMIT ? OFFSET ?
            """,
            tuple(params) + (recent_per_page, (recent_page - 1) * recent_per_page),
        )
    instruments = query_all("SELECT * FROM instruments ORDER BY name")
    if user["role"] == "requester" and not has_instrument_area_access(user):
        instruments = []
    instrument_fifo_queue: list[dict] = []
    pending_receipt_lookup_rows: list[sqlite3.Row] = []
    if has_instrument_area_access(user):
        fifo_rows = query_all(
            f"""
            SELECT sr.id, sr.request_no, sr.sample_name, sr.status, sr.created_at,
                   sr.sample_submitted_at, sr.sample_received_at, sr.scheduled_for,
                   i.id AS instrument_id, i.name AS instrument_name,
                   r.name AS requester_name
            FROM sample_requests sr
            JOIN instruments i ON i.id = sr.instrument_id
            JOIN users r ON r.id = sr.requester_id
            WHERE sr.status IN ('sample_submitted', 'sample_received', 'scheduled', 'in_progress'){where_sql}
            ORDER BY i.name,
                     COALESCE(sr.sample_submitted_at, sr.sample_received_at, sr.created_at) ASC,
                     sr.id ASC
            """,
            tuple(params),
        )
        grouped_fifo: dict[tuple[int, str], list[sqlite3.Row]] = {}
        for row in fifo_rows:
            key = (row["instrument_id"], row["instrument_name"])
            grouped_fifo.setdefault(key, []).append(row)
        instrument_fifo_queue = [
            {
                "instrument_id": instrument_id,
                "instrument_name": instrument_name,
                "rows": rows[:5],
            }
            for (instrument_id, instrument_name), rows in grouped_fifo.items()
        ]
        pending_receipt_lookup_rows = [
            row for row in fifo_rows if row["status"] == "sample_submitted"
        ][:5]
    dashboard_metrics = dashboard_analytics(user) if can_access_stats(user) else None
    return render_template(
        "dashboard.html",
        counts=counts,
        requests=requests_rows,
        recent_page=recent_page,
        recent_total_pages=recent_total_pages,
        instruments=instruments,
        instrument_fifo_queue=instrument_fifo_queue,
        pending_receipt_lookup_rows=pending_receipt_lookup_rows,
        role_switches=DEMO_ROLE_SWITCHES,
        dashboard_metrics=dashboard_metrics,
    )


@app.route("/sitemap")
@login_required
def sitemap():
    user = current_user()
    access_profile = user_access_profile(user)
    sections = [
        {
            "title": "Core",
            "links": [
                {"label": "Home", "href": url_for("index")},
                {"label": "New Request", "href": url_for("new_request")},
                {"label": "My History", "href": url_for("schedule")},
                {"label": "My Profile", "href": url_for("user_profile", user_id=user["id"])},
            ],
        }
    ]
    if access_profile["can_access_instruments"] or access_profile["can_access_schedule"]:
        ops_links = []
        if access_profile["can_access_instruments"]:
            ops_links.append({"label": "Instruments", "href": url_for("instruments")})
        if access_profile["can_access_schedule"]:
            ops_links.append({"label": "Queue", "href": url_for("schedule")})
            ops_links.append({"label": "Processed History", "href": url_for("schedule", bucket="completed")})
        sections.append({"title": "Operations", "links": ops_links})
    if access_profile["can_access_calendar"] or access_profile["can_access_stats"]:
        report_links = []
        if access_profile["can_access_calendar"]:
            report_links.append({"label": "Calendar", "href": url_for("calendar")})
        if access_profile["can_access_stats"]:
            report_links.append({"label": "Statistics", "href": url_for("stats")})
            report_links.append({"label": "Data View", "href": url_for("visualizations")})
        sections.append({"title": "Reporting", "links": report_links})
    if access_profile["can_manage_members"]:
        sections.append({"title": "Administration", "links": [{"label": "Users", "href": url_for("admin_users")}]})
    return render_template("sitemap.html", sections=sections, title="Site Map")


@app.route("/requests/<int:request_id>/quick-receive", methods=["POST"])
@login_required
def quick_receive_request(request_id: int):
    user = current_user()
    sample_request = query_one("SELECT * FROM sample_requests WHERE id = ?", (request_id,))
    if sample_request is None:
        return jsonify({"ok": False, "error": "Request not found."}), 404
    can_manage = can_manage_instrument(user["id"], sample_request["instrument_id"], user["role"])
    can_operate = can_operate_instrument(user["id"], sample_request["instrument_id"], user["role"])
    if not (can_operate or can_manage):
        return jsonify({"ok": False, "error": "Forbidden."}), 403
    if sample_request["status"] not in {"sample_submitted", "awaiting_sample_submission"}:
        return jsonify({"ok": False, "error": "Sample cannot be marked received from its current state."}), 400
    execute(
        """
        UPDATE sample_requests
        SET status = 'sample_received', sample_received_at = ?, received_by_operator_id = ?,
            updated_at = ?
        WHERE id = ?
        """,
        (now_iso(), user["id"], now_iso(), request_id),
    )
    log_action(user["id"], "sample_request", request_id, "sample_received", {"remarks": ""})
    return jsonify({"ok": True, "request_id": request_id, "new_status": "sample_received"})


@app.route("/demo/switch/<role_key>")
@login_required
def demo_switch_role(role_key: str):
    user = current_user()
    if not can_use_role_switcher(user):
        abort(403)
    target = DEMO_ROLE_SWITCHES.get(role_key)
    if not target:
        abort(404)
    target_user = query_one("SELECT * FROM users WHERE email = ? AND active = 1", (target["email"],))
    if target_user is None:
        flash("Demo role account not found.", "error")
        return redirect(url_for("index"))
    session["user_id"] = target_user["id"]
    flash(f"Switched to {target['label']} view.", "success")
    return redirect(url_for("index"))


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form["email"].strip().lower()
        password = request.form["password"]
        user = query_one("SELECT * FROM users WHERE email = ? AND active = 1", (email,))
        if user and user["invite_status"] == "active" and check_password_hash(user["password_hash"], password):
            session.clear()
            session["user_id"] = user["id"]
            session.permanent = True
            flash(f"Signed in as {user['name']}.", "success")
            return redirect(url_for("index"))
        flash("Invalid login.", "error")
    return render_template("login.html")


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/instruments", methods=["GET", "POST"])
@login_required
def instruments():
    user = current_user()
    if not user_access_profile(user)["can_access_instruments"]:
        abort(403)
    can_add_instrument = is_owner(user) or user["role"] in {"super_admin", "site_admin"}
    if request.method == "POST":
        action = request.form.get("action", "").strip()
        if action == "create_instrument":
            if not can_add_instrument:
                abort(403)
            name = request.form.get("new_name", "").strip()
            category = request.form.get("new_category", "").strip()
            location = request.form.get("new_location", "").strip()
            if not name or not category or not location:
                flash("Name, category, and location are required to add an instrument.", "error")
                return redirect(url_for("instruments"))
            code = request.form.get("new_code", "").strip() or next_instrument_code()
            daily_capacity = max(1, min(50, int(request.form.get("new_daily_capacity", "3") or 3)))
            execute(
                """
                INSERT INTO instruments (name, code, category, location, daily_capacity, status, notes, office_info, faculty_group, manufacturer, model_number, capabilities_summary, machine_photo_url, reference_links, instrument_description, accepting_requests, soft_accept_enabled)
                VALUES (?, ?, ?, ?, ?, 'active', '', '', '', '', '', '', '', '', '', 1, 0)
                """,
                (name, code, category, location, daily_capacity),
            )
            new_instrument = query_one("SELECT id FROM instruments WHERE code = ?", (code,))
            if new_instrument:
                log_action(user["id"], "instrument", new_instrument["id"], "instrument_created", {"name": name, "code": code})
                flash(f"{name} added to the instrument list.", "success")
                return redirect(url_for("instrument_detail", instrument_id=new_instrument["id"]))
            flash("Instrument was created, but could not be reopened immediately.", "success")
            return redirect(url_for("instruments"))
        abort(400)
    instrument_filter = ""
    params: list = []
    if not user_access_profile(user)["can_view_all_instruments"]:
        ids = assigned_instrument_ids(user)
        if not ids:
            rows = []
            return render_template("instruments.html", instruments=rows, visible_links={})
        placeholders = ",".join("?" for _ in ids)
        instrument_filter = f"WHERE i.id IN ({placeholders})"
        params.extend(ids)
    rows = query_all(
        f"""
        SELECT i.*,
               GROUP_CONCAT(DISTINCT a.name) AS admins,
               GROUP_CONCAT(DISTINCT o.name) AS operators,
               GROUP_CONCAT(DISTINCT f.name) AS faculty_in_charge
        FROM instruments i
        LEFT JOIN instrument_admins ia ON ia.instrument_id = i.id
        LEFT JOIN users a ON a.id = ia.user_id
        LEFT JOIN instrument_operators io ON io.instrument_id = i.id
        LEFT JOIN users o ON o.id = io.user_id
        LEFT JOIN instrument_faculty_admins ifa ON ifa.instrument_id = i.id
        LEFT JOIN users f ON f.id = ifa.user_id
        {instrument_filter}
        GROUP BY i.id
        ORDER BY COALESCE(i.category, ''), i.name
        """,
        tuple(params),
    )
    turnaround_filter = ""
    if instrument_filter:
        turnaround_filter = instrument_filter.replace("WHERE i.id", "WHERE sr.instrument_id")
    turnaround_rows = query_all(
        f"""
        SELECT
            sr.instrument_id,
            AVG(
                julianday(sr.completed_at) - julianday(
                    COALESCE(sr.sample_received_at, sr.sample_submitted_at, sr.created_at)
                )
            ) * 24.0 AS avg_return_hours
        FROM sample_requests sr
        JOIN instruments i ON i.id = sr.instrument_id
        {turnaround_filter}
        {' AND ' if turnaround_filter else 'WHERE '}sr.status = 'completed'
          AND sr.completed_at IS NOT NULL
          AND COALESCE(sr.sample_received_at, sr.sample_submitted_at, sr.created_at) IS NOT NULL
        GROUP BY sr.instrument_id
        """,
        tuple(params),
    )
    turnaround_map = {row["instrument_id"]: row["avg_return_hours"] for row in turnaround_rows}
    active_instruments = [row for row in rows if row["status"] == "active"]
    archived_instruments = [row for row in rows if row["status"] == "archived"]
    visible_links = {}
    for instrument in rows:
        visible_links[instrument["id"]] = can_open_instrument_detail(user, instrument["id"])
    return render_template(
        "instruments.html",
        instruments=active_instruments,
        archived_instruments=archived_instruments,
        visible_links=visible_links,
        turnaround_map=turnaround_map,
        can_add_instrument=can_add_instrument,
        suggested_new_code=next_instrument_code(),
        can_view_archived=bool(user_access_profile(user)["can_access_instruments"]),
    )


@app.route("/instruments/<int:instrument_id>", methods=["GET", "POST"])
@login_required
def instrument_detail(instrument_id: int):
    user = current_user()
    if not user_access_profile(user)["can_access_instruments"]:
        abort(403)
    if not can_open_instrument_detail(user, instrument_id):
        abort(403)

    instrument = query_one(
        """
        SELECT i.*,
               GROUP_CONCAT(DISTINCT a.name) AS admins,
               GROUP_CONCAT(DISTINCT o.name) AS operators,
               GROUP_CONCAT(DISTINCT f.name) AS faculty_in_charge
        FROM instruments i
        LEFT JOIN instrument_admins ia ON ia.instrument_id = i.id
        LEFT JOIN users a ON a.id = ia.user_id
        LEFT JOIN instrument_operators io ON io.instrument_id = i.id
        LEFT JOIN users o ON o.id = io.user_id
        LEFT JOIN instrument_faculty_admins ifa ON ifa.instrument_id = i.id
        LEFT JOIN users f ON f.id = ifa.user_id
        WHERE i.id = ?
        GROUP BY i.id
        """,
        (instrument_id,),
    )
    if instrument is None:
        abort(404)

    can_edit = user["role"] in {"super_admin", "site_admin"} or can_manage_instrument(user["id"], instrument_id, user["role"])
    can_edit_assignments = is_owner(user) or user["role"] in {"super_admin", "site_admin"}
    can_archive_instrument = user["role"] == "super_admin"
    can_restore_instrument = user["role"] == "super_admin"
    can_add_downtime_here = user["role"] == "super_admin" or can_manage_instrument(user["id"], instrument_id, user["role"])
    if request.method == "POST":
        action = request.form.get("action", "update_metadata")
        if action == "update_metadata":
            if not can_edit:
                abort(403)
            code = request.form.get("code", instrument["code"]).strip() or instrument["code"]
            category = request.form.get("category", instrument["category"] or "").strip()
            location = request.form.get("location", instrument["location"]).strip() or instrument["location"]
            manufacturer = request.form.get("manufacturer", instrument["manufacturer"]).strip()
            model_number = request.form.get("model_number", instrument["model_number"]).strip()
            machine_photo_url = instrument["machine_photo_url"]
            uploaded_photo = request.files.get("machine_photo_file")
            if uploaded_photo and (uploaded_photo.filename or "").strip():
                try:
                    machine_photo_url = save_instrument_image(instrument_id, uploaded_photo)
                except ValueError as exc:
                    flash(str(exc), "error")
                    return redirect(url_for("instrument_detail", instrument_id=instrument_id))
            link_values = []
            for idx in range(1, 6):
                value = request.form.get(f"reference_link_{idx}", "").strip()
                if value:
                    link_values.append(value)
            reference_links = instrument["reference_links"]
            notes = request.form.get("notes", instrument["notes"]).strip()
            prior_accepting = int(instrument["accepting_requests"] or 0)
            intake_mode = request.form.get("intake_mode", "accepting").strip()
            accepting_requests, soft_accept_enabled = intake_mode_flags(intake_mode)
            if can_edit_assignments:
                instrument_admin_ids = [row["user_id"] for row in query_all("SELECT user_id FROM instrument_admins WHERE instrument_id = ?", (instrument_id,))]
                operator_ids = [int(value) for value in request.form.getlist("operator_ids") if value.strip()]
                faculty_admin_ids = [int(value) for value in request.form.getlist("faculty_admin_ids") if value.strip()]
            else:
                instrument_admin_ids = [row["user_id"] for row in query_all("SELECT user_id FROM instrument_admins WHERE instrument_id = ?", (instrument_id,))]
                operator_ids = [row["user_id"] for row in query_all("SELECT user_id FROM instrument_operators WHERE instrument_id = ?", (instrument_id,))]
                faculty_admin_ids = [row["user_id"] for row in query_all("SELECT user_id FROM instrument_faculty_admins WHERE instrument_id = ?", (instrument_id,))]
            execute(
                """
                UPDATE instruments
                SET code = ?, category = ?, location = ?, manufacturer = ?, model_number = ?, machine_photo_url = ?, reference_links = ?, notes = ?, accepting_requests = ?, soft_accept_enabled = ?
                WHERE id = ?
                """,
                (code, category, location, manufacturer, model_number, machine_photo_url, reference_links, notes, accepting_requests, soft_accept_enabled, instrument_id),
            )
            log_action(
                user["id"],
                "instrument",
                instrument_id,
                "instrument_metadata_updated",
                {
                    "code": code,
                    "location": location,
                    "manufacturer": manufacturer,
                    "model_number": model_number,
                    "machine_photo_url": machine_photo_url,
                    "reference_links": reference_links,
                    "notes": notes,
                    "intake_mode": intake_mode,
                },
            )
            if can_edit_assignments:
                sync_instrument_assignments("instrument_admins", instrument_id, instrument_admin_ids)
                sync_instrument_assignments("instrument_operators", instrument_id, operator_ids)
                sync_instrument_assignments("instrument_faculty_admins", instrument_id, faculty_admin_ids)
            released_count = 0
            if not prior_accepting and accepting_requests:
                released_count = release_submitted_requests_for_instrument(instrument_id, user["id"])
            flash(
                "Instrument page updated." + (f" Released {released_count} queued request(s) into review." if released_count else ""),
                "success",
            )
            return redirect(url_for("instrument_detail", instrument_id=instrument_id))
        if action == "update_operation":
            if not can_edit:
                abort(403)
            prior_accepting = int(instrument["accepting_requests"] or 0)
            intake_mode = request.form.get("intake_mode", "accepting").strip()
            event_at = datetime.utcnow().isoformat(timespec="seconds")
            accepting_requests, soft_accept_enabled = intake_mode_flags(intake_mode)
            execute(
                "UPDATE instruments SET accepting_requests = ?, soft_accept_enabled = ? WHERE id = ?",
                (accepting_requests, soft_accept_enabled, instrument_id),
            )
            released_count = 0
            if not prior_accepting and accepting_requests:
                released_count = release_submitted_requests_for_instrument(instrument_id, user["id"])
            log_action(
                user["id"],
                "instrument",
                instrument_id,
                "instrument_operation_updated",
                {"intake_mode": intake_mode},
            )
            if request.headers.get("X-Requested-With") == "XMLHttpRequest":
                return jsonify(
                    {
                        "ok": True,
                        "intake_mode": intake_mode,
                        "label": intake_mode_label(intake_mode),
                        "released_count": released_count,
                        "actor_name": user["name"],
                        "event_title": "Operation changed",
                        "event_detail": intake_mode_label(intake_mode),
                        "event_at": format_dt(event_at),
                    }
                )
            flash(
                "Instrument operation updated." + (f" Released {released_count} queued request(s) into review." if released_count else ""),
                "success",
            )
            return redirect(url_for("instrument_detail", instrument_id=instrument_id))
        if action == "archive_instrument":
            if not can_archive_instrument:
                abort(403)
            confirm_code = request.form.get("confirm_code", "").strip()
            if confirm_code != instrument["code"]:
                flash("Enter the exact instrument code to archive this instrument.", "error")
                return redirect(url_for("instrument_detail", instrument_id=instrument_id))
            execute("UPDATE instruments SET status = 'archived' WHERE id = ?", (instrument_id,))
            log_action(user["id"], "instrument", instrument_id, "instrument_archived", {"name": instrument["name"], "code": instrument["code"]})
            flash("Instrument archived.", "success")
            return redirect(url_for("instruments"))
        if action == "restore_instrument":
            if not can_restore_instrument:
                abort(403)
            execute("UPDATE instruments SET status = 'active' WHERE id = ?", (instrument_id,))
            log_action(user["id"], "instrument", instrument_id, "instrument_restored", {"name": instrument["name"], "code": instrument["code"]})
            flash("Instrument restored to active inventory.", "success")
            return redirect(url_for("instrument_detail", instrument_id=instrument_id))
        if action == "add_downtime":
            if not can_add_downtime_here:
                abort(403)
            start_time = request.form.get("start_time", "").strip()
            end_time = request.form.get("end_time", "").strip()
            reason = request.form.get("reason", "").strip()
            if not start_time or not end_time or end_time <= start_time:
                flash("Downtime end must be after start.", "error")
                return redirect(url_for("instrument_detail", instrument_id=instrument_id))
            execute(
                """
                INSERT INTO instrument_downtime (instrument_id, start_time, end_time, reason, created_by_user_id, created_at, is_active)
                VALUES (?, ?, ?, ?, ?, ?, 1)
                """,
                (instrument_id, start_time, end_time, reason, user["id"], now_iso()),
            )
            log_action(user["id"], "instrument", instrument_id, "downtime_added", {"start_time": start_time, "end_time": end_time, "reason": reason})
            flash("Downtime block added.", "success")
            return redirect(url_for("instrument_detail", instrument_id=instrument_id))
        if action == "save_approval_config":
            if not (is_owner(user) or user["role"] == "super_admin"):
                abort(403)
            db = get_db()
            db.execute("DELETE FROM instrument_approval_config WHERE instrument_id = ?", (instrument_id,))
            step_order = 1
            valid_roles = {"finance", "professor", "operator"}
            for idx in range(1, 7):
                role = request.form.get(f"step_role_{idx}", "").strip()
                if not role or role not in valid_roles:
                    continue
                user_id_raw = request.form.get(f"step_user_{idx}", "").strip()
                approver_user_id = int(user_id_raw) if user_id_raw else None
                db.execute(
                    "INSERT INTO instrument_approval_config (instrument_id, step_order, approver_role, approver_user_id) VALUES (?, ?, ?, ?)",
                    (instrument_id, step_order, role, approver_user_id),
                )
                step_order += 1
            db.commit()
            log_action(user["id"], "instrument", instrument_id, "approval_config_updated", {"step_count": step_order - 1})
            flash("Approval sequence saved.", "success")
            return redirect(url_for("instrument_detail", instrument_id=instrument_id))
        abort(400)

    queue_sql, queue_params = request_history_query(["sr.instrument_id = ?"], [instrument_id], {})
    instrument_rows_all = query_all(queue_sql, tuple(queue_params))
    queue_rank = {
        "under_review": 1,
        "sample_submitted": 2,
        "sample_received": 3,
        "scheduled": 4,
        "in_progress": 5,
        "submitted": 6,
        "awaiting_sample_submission": 7,
        "completed": 8,
        "rejected": 9,
    }

    def instrument_queue_sort_key(row: sqlite3.Row) -> tuple:
        anchor = (
            row["sample_submitted_at"]
            or row["sample_received_at"]
            or row["scheduled_for"]
            or row["completed_at"]
            or row["created_at"]
            or ""
        )
        return (queue_rank.get(row["status"], 99), str(anchor), row["id"])

    instrument_queue = {
        "submitted": [row for row in instrument_rows_all if row["status"] == "submitted"],
        "approvals": [row for row in instrument_rows_all if row["status"] == "under_review"],
        "awaiting_sample": [row for row in instrument_rows_all if row["status"] == "awaiting_sample_submission"],
        "pending_receipt": [row for row in instrument_rows_all if row["status"] == "sample_submitted"],
        "ready": [row for row in instrument_rows_all if row["status"] == "sample_received"],
        "active": [row for row in instrument_rows_all if row["status"] in {"scheduled", "in_progress"}],
        "done": [row for row in instrument_rows_all if row["status"] == "completed"],
        "closed": [row for row in instrument_rows_all if row["status"] in {"rejected"}],
    }
    queue_preview_rows = sorted(
        [
            row
            for row in instrument_rows_all
            if row["status"] in {"under_review", "sample_submitted", "sample_received", "scheduled", "in_progress", "completed"}
        ],
        key=instrument_queue_sort_key,
    )[:7]
    instrument_queue_counts = {key: len(value) for key, value in instrument_queue.items()}
    pending_count = sum(
        instrument_queue_counts[key]
        for key in ("submitted", "approvals", "awaiting_sample", "pending_receipt", "ready", "active")
    )
    today = datetime.utcnow().date()
    last_week_end = today - timedelta(days=today.weekday() + 1)
    last_week_start = last_week_end - timedelta(days=6)
    processed_last_week = sum(
        1
        for row in instrument_queue["done"]
        if row["completed_at"]
        and last_week_start <= parse_date_param(str(row["completed_at"])[:10]) <= last_week_end
    )
    samples_last_week = sum(
        row["sample_count"] or 0
        for row in instrument_queue["done"]
        if row["completed_at"]
        and last_week_start <= parse_date_param(str(row["completed_at"])[:10]) <= last_week_end
    )
    weekly_rows = query_all(
        """
        SELECT substr(completed_at, 1, 10) AS day_bucket, COUNT(*) AS jobs, COALESCE(SUM(sample_count), 0) AS samples
        FROM sample_requests
        WHERE instrument_id = ? AND status = 'completed' AND completed_at IS NOT NULL
        ORDER BY completed_at
        """,
        (instrument_id,),
    )
    jobs_by_week: dict[tuple[int, int], int] = {}
    samples_by_week: dict[tuple[int, int], int] = {}
    for row in weekly_rows:
        bucket_date = parse_date_param(row["day_bucket"])
        if bucket_date is None:
            continue
        iso_year, iso_week, _ = bucket_date.isocalendar()
        key = (iso_year, iso_week)
        jobs_by_week[key] = jobs_by_week.get(key, 0) + int(row["jobs"] or 0)
        samples_by_week[key] = samples_by_week.get(key, 0) + int(row["samples"] or 0)
    average_jobs_per_week = round(sum(jobs_by_week.values()) / len(jobs_by_week), 1) if jobs_by_week else 0
    average_samples_per_week = round(sum(samples_by_week.values()) / len(samples_by_week), 1) if samples_by_week else 0
    turnaround_avg_row = query_one(
        """
        SELECT AVG(
            julianday(completed_at) - julianday(COALESCE(sample_received_at, sample_submitted_at, created_at))
        ) * 24.0 AS avg_return_hours
        FROM sample_requests
        WHERE instrument_id = ?
          AND status = 'completed'
          AND completed_at IS NOT NULL
          AND COALESCE(sample_received_at, sample_submitted_at, created_at) IS NOT NULL
        """,
        (instrument_id,),
    )
    queue_metrics = {
        "pending": pending_count,
        "processed_last_week": processed_last_week,
        "samples_last_week": samples_last_week,
        "average_jobs_per_week": average_jobs_per_week,
        "average_samples_per_week": average_samples_per_week,
        "average_return_hours": turnaround_avg_row["avg_return_hours"] if turnaround_avg_row else None,
    }
    operator_candidates = query_all(
        "SELECT id, name, email, role FROM users WHERE active = 1 AND role IN ('operator', 'instrument_admin', 'site_admin', 'super_admin') ORDER BY name"
    )
    faculty_candidates = query_all(
        "SELECT id, name, email, role FROM users WHERE active = 1 AND role IN ('requester', 'professor_approver', 'site_admin', 'super_admin') ORDER BY name"
    )
    selected_operator_ids = {
        row["user_id"] for row in query_all("SELECT user_id FROM instrument_operators WHERE instrument_id = ?", (instrument_id,))
    }
    selected_faculty_ids = {
        row["user_id"] for row in query_all("SELECT user_id FROM instrument_faculty_admins WHERE instrument_id = ?", (instrument_id,))
    }
    selected_operator_rows = query_all(
        f"SELECT id, name FROM users WHERE id IN ({','.join('?' for _ in selected_operator_ids)}) ORDER BY name",
        tuple(sorted(selected_operator_ids)),
    ) if selected_operator_ids else []
    selected_faculty_rows = query_all(
        f"SELECT id, name FROM users WHERE id IN ({','.join('?' for _ in selected_faculty_ids)}) ORDER BY name",
        tuple(sorted(selected_faculty_ids)),
    ) if selected_faculty_ids else []
    instrument_logs = query_all(
        "SELECT al.*, u.name AS actor_name FROM audit_logs al LEFT JOIN users u ON u.id = al.actor_id WHERE entity_type = 'instrument' AND entity_id = ? ORDER BY al.id",
        (instrument_id,),
    )
    approval_config = query_all(
        """
        SELECT iac.*, u.name AS approver_name
        FROM instrument_approval_config iac
        LEFT JOIN users u ON u.id = iac.approver_user_id
        WHERE iac.instrument_id = ?
        ORDER BY iac.step_order
        """,
        (instrument_id,),
    )
    can_edit_approval_config = is_owner(user) or user["role"] == "super_admin"
    approval_role_candidates = query_all(
        "SELECT id, name, role FROM users WHERE active = 1 AND role IN ('finance_admin', 'professor_approver', 'operator', 'instrument_admin', 'site_admin', 'super_admin') ORDER BY name"
    )
    return render_template(
        "instrument_detail.html",
        instrument=instrument,
        can_edit=can_edit,
        can_edit_assignments=can_edit_assignments,
        can_archive_instrument=can_archive_instrument,
        can_restore_instrument=can_restore_instrument,
        can_add_downtime_here=can_add_downtime_here,
        instrument_queue=instrument_queue,
        instrument_queue_counts=instrument_queue_counts,
        queue_preview_rows=queue_preview_rows,
        queue_metrics=queue_metrics,
        can_view_history=can_view_instrument_history(user, instrument_id),
        operator_candidates=operator_candidates,
        faculty_candidates=faculty_candidates,
        selected_operator_ids=selected_operator_ids,
        selected_faculty_ids=selected_faculty_ids,
        selected_operator_rows=selected_operator_rows,
        selected_faculty_rows=selected_faculty_rows,
        instrument_timeline_entries=instrument_timeline_entries(instrument, instrument_logs),
        intake_mode=instrument_intake_mode(instrument),
        intake_mode_label=intake_mode_label,
        approval_config=approval_config,
        can_edit_approval_config=can_edit_approval_config,
        approval_role_candidates=approval_role_candidates,
        operators=query_all(
            "SELECT id, name FROM users WHERE role IN ('operator','instrument_admin','super_admin') ORDER BY name"
        ),
    )


@app.route("/requests/new", methods=["GET", "POST"])
@login_required
def new_request():
    user = current_user()
    instruments = query_all("SELECT * FROM instruments WHERE status = 'active' ORDER BY name")
    can_submit_for_others = can_manage_members(user) or has_instrument_area_access(user)
    requester_candidates = query_all(
        """
        SELECT id, name, email, role
        FROM users
        WHERE active = 1 AND invite_status = 'active'
        ORDER BY name, email
        """
    ) if can_submit_for_others else []
    if request.method == "POST":
        instrument_id = int(request.form["instrument_id"])
        instrument = query_one("SELECT * FROM instruments WHERE id = ? AND status = 'active'", (instrument_id,))
        if instrument is None:
            flash("Selected instrument is not available.", "error")
            return redirect(url_for("new_request"))
        title = request.form["title"].strip()
        sample_name = request.form["sample_name"].strip()
        sample_count = int(request.form["sample_count"])
        if sample_count < 0 or sample_count > 99:
            flash("Sample count must be between 0 and 99.", "error")
            return redirect(url_for("new_request"))
        description = request.form["description"].strip()
        sample_origin = request.form["sample_origin"]
        receipt_number = request.form.get("receipt_number", "").strip()
        if not receipt_number:
            receipt_number = generate_receipt_reference(sample_origin)
        amount_due = float(request.form.get("amount_due") or 0)
        amount_paid = float(request.form.get("amount_paid") or 0)
        finance_status = request.form.get("finance_status", "n/a")
        priority = request.form["priority"]
        requester_id = user["id"]
        if can_submit_for_others and request.form.get("requester_id"):
            requester_id = int(request.form["requester_id"])
        requester_row = query_one(
            "SELECT * FROM users WHERE id = ? AND active = 1 AND invite_status = 'active'",
            (requester_id,),
        )
        if requester_row is None:
            flash("Selected requester is not available.", "error")
            return redirect(url_for("new_request"))
        originator_note = request.form.get("originator_note", "").strip()
        request_no = generate_job_reference(sample_origin)
        sample_ref = generate_sample_reference(instrument["name"], sample_origin)
        created = now_iso()
        initial_status = "submitted"
        request_id = execute(
            """
            INSERT INTO sample_requests
            (request_no, sample_ref, requester_id, created_by_user_id, originator_note, instrument_id, title, sample_name, sample_count, description, sample_origin,
             receipt_number, amount_due, amount_paid, finance_status, priority, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                request_no,
                sample_ref,
                requester_id,
                user["id"],
                originator_note,
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
                initial_status,
                created,
                created,
            ),
        )
        if instrument["accepting_requests"]:
            create_approval_chain(get_db(), request_id, instrument_id)
            execute("UPDATE sample_requests SET status = 'under_review' WHERE id = ?", (request_id,))
        else:
            execute(
                "UPDATE sample_requests SET remarks = ?, updated_at = ? WHERE id = ?",
                ("Lab is not currently accepting new jobs. Your request is queued and will be released when intake opens.", now_iso(), request_id),
            )
        created_request = query_one(
            """
            SELECT sr.id, sr.requester_id, sr.request_no, sr.sample_ref, sr.instrument_id, sr.sample_name, sr.sample_count, sr.created_at,
                   i.name AS instrument_name, u.name AS requester_name
            FROM sample_requests sr
            JOIN instruments i ON i.id = sr.instrument_id
            JOIN users u ON u.id = sr.requester_id
            WHERE sr.id = ?
            """,
            (request_id,),
        )
        if created_request is not None:
            ensure_request_folder(created_request)
            initial_attachment_name = None
            write_request_metadata_snapshot(request_id)
            initial_attachment = request.files.get("initial_attachment")
            if initial_attachment and initial_attachment.filename:
                try:
                    save_uploaded_attachment(created_request, initial_attachment, user["id"], "request_document", "Uploaded with new request")
                    initial_attachment_name = initial_attachment.filename
                except ValueError as exc:
                    flash(f"Request created, but initial attachment was not added: {exc}", "error")
            slip_pdf = generate_sample_slip_pdf(
                created_request,
                created_request["instrument_name"],
                created_request["requester_name"],
                initial_attachment_name,
            )
            save_generated_attachment(
                created_request,
                f"{created_request['sample_ref']}_sample-slip.pdf",
                slip_pdf,
                user["id"],
                "sample_slip",
                "Auto-generated printable slip for attaching to the physical sample",
            )
            write_request_metadata_snapshot(request_id)
        log_action(
            user["id"],
            "sample_request",
            request_id,
            "submitted",
            {
                "request_no": request_no,
                "instrument_id": instrument_id,
                "requester_id": requester_id,
                "sample_origin": sample_origin,
                "sample_count": sample_count,
                "created_by_user_id": user["id"],
                "originator_note": originator_note,
                "accepting_requests": bool(instrument["accepting_requests"]),
            },
        )
        if instrument["accepting_requests"]:
            flash(f"Request {request_no} submitted for {requester_row['name']}. Sample number {sample_ref} and printable slip generated.", "success")
        else:
            flash(f"Request {request_no} submitted for {requester_row['name']}. The lab is not accepting jobs yet, so it has been queued. Sample number {sample_ref} and printable slip generated.", "success")
        return redirect(url_for("request_detail", request_id=request_id))
    return render_template(
        "new_request.html",
        instruments=instruments,
        can_submit_for_others=can_submit_for_others,
        requester_candidates=requester_candidates,
    )


@app.route("/requests/<int:request_id>", methods=["GET", "POST"])
@login_required
def request_detail(request_id: int):
    user = current_user()
    sample_request = query_one(
        """
        SELECT sr.*, i.name AS instrument_name, i.daily_capacity, i.accepting_requests, i.soft_accept_enabled, r.name AS requester_name, r.email AS requester_email,
               c.name AS originator_name, c.email AS originator_email, c.role AS originator_role,
               op.name AS operator_name, recv.name AS received_by_name
        FROM sample_requests sr
        JOIN instruments i ON i.id = sr.instrument_id
        JOIN users r ON r.id = sr.requester_id
        LEFT JOIN users c ON c.id = sr.created_by_user_id
        LEFT JOIN users op ON op.id = sr.assigned_operator_id
        LEFT JOIN users recv ON recv.id = sr.received_by_operator_id
        WHERE sr.id = ?
        """,
        (request_id,),
    )
    if sample_request is None:
        abort(404)

    if not can_view_request(user, sample_request):
        abort(403)

    can_manage = can_manage_instrument(user["id"], sample_request["instrument_id"], user["role"])
    can_operate = can_operate_instrument(user["id"], sample_request["instrument_id"], user["role"])
    can_upload_files = can_upload_attachment(user, sample_request)
    can_flag_issue = can_flag_request_issue(user, sample_request)
    can_respond_issue = can_respond_request_issue(user, sample_request)
    card_policy = request_card_policy(user, sample_request)
    approval_steps = query_all(
        """
        SELECT aps.*, u.name AS approver_name, u.email AS approver_email
        FROM approval_steps aps
        LEFT JOIN users u ON u.id = aps.approver_user_id
        WHERE aps.sample_request_id = ?
        ORDER BY aps.step_order
        """,
        (request_id,),
    )
    actionable_step_ids = {step["id"] for step in approval_steps if approval_step_is_actionable(step, approval_steps)}

    if request.method == "POST":
        action = request.form["action"]
        if action in {"save_note", "post_message"}:
            if not can_post_message(user, sample_request):
                abort(403)
            note_kind = request.form.get("note_kind", "").strip()
            if action == "post_message" and not note_kind:
                note_kind = "requester_note" if sample_request["requester_id"] == user["id"] else "operator_note"
            if note_kind not in {item[0] for item in COMMUNICATION_NOTE_TYPES}:
                flash("Invalid note type.", "error")
                return redirect(url_for("request_detail", request_id=request_id))
            if not can_edit_request_note(user, sample_request, note_kind):
                abort(403)
            message_body = request.form.get("note_body", request.form.get("message_body", "")).strip()
            uploaded_file = request.files.get("attachment")
            has_attachment = bool(uploaded_file and (uploaded_file.filename or "").strip())
            if not message_body and not has_attachment:
                flash("Reply cannot be empty.", "error")
                return redirect(url_for("request_detail", request_id=request_id))
            if action == "save_note":
                execute(
                    "UPDATE request_messages SET is_active = 0 WHERE request_id = ? AND note_kind = ?",
                    (request_id, note_kind),
                )
            message_id = execute(
                """
                INSERT INTO request_messages (request_id, sender_user_id, note_kind, message_body, created_at, is_active)
                VALUES (?, ?, ?, ?, ?, 1)
                """,
                (request_id, user["id"], note_kind, message_body, now_iso()),
            )
            if has_attachment:
                try:
                    save_uploaded_attachment(
                        sample_request,
                        uploaded_file,
                        user["id"],
                        "other",
                        "Attached in conversation",
                        request_message_id=message_id,
                    )
                except ValueError as exc:
                    execute("DELETE FROM request_messages WHERE id = ?", (message_id,))
                    flash(str(exc), "error")
                    return redirect(url_for("request_detail", request_id=request_id))
            write_request_metadata_snapshot(request_id)
            log_action(
                user["id"],
                "sample_request",
                request_id,
                "communication_note_saved",
                {"note_kind": note_kind, "message_preview": message_body[:120]},
            )
            flash("Reply added." if action == "post_message" else f"{note_kind_label(note_kind)} updated.", "success")
            return redirect(url_for("request_detail", request_id=request_id))
        if action == "flag_issue":
            if not can_flag_issue:
                abort(403)
            issue_message = request.form.get("issue_message", "").strip()
            if not issue_message:
                flash("Please describe the issue before flagging it.", "error")
                return redirect(url_for("request_detail", request_id=request_id))
            execute(
                """
                INSERT INTO request_issues (request_id, created_by_user_id, issue_message, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (request_id, user["id"], issue_message, now_iso()),
            )
            write_request_metadata_snapshot(request_id)
            log_action(user["id"], "sample_request", request_id, "issue_flagged", {"issue_preview": issue_message[:160]})
            flash("Issue flagged for this sample.", "success")
            return redirect(url_for("request_detail", request_id=request_id))
        if action == "respond_issue":
            if not can_respond_issue:
                abort(403)
            issue_id = int(request.form.get("issue_id") or 0)
            issue = query_one("SELECT * FROM request_issues WHERE id = ? AND request_id = ?", (issue_id, request_id))
            if issue is None:
                abort(404)
            response_message = request.form.get("response_message", "").strip()
            if not response_message:
                flash("Please add a response before saving it.", "error")
                return redirect(url_for("request_detail", request_id=request_id))
            execute(
                """
                UPDATE request_issues
                SET response_message = ?, responded_at = ?, responded_by_user_id = ?
                WHERE id = ?
                """,
                (response_message, now_iso(), user["id"], issue_id),
            )
            write_request_metadata_snapshot(request_id)
            log_action(user["id"], "sample_request", request_id, "issue_response_saved", {"response_preview": response_message[:160]})
            flash("Issue response saved.", "success")
            return redirect(url_for("request_detail", request_id=request_id))
        if action == "resolve_issue":
            if not can_respond_issue:
                abort(403)
            issue_id = int(request.form.get("issue_id") or 0)
            issue = query_one("SELECT * FROM request_issues WHERE id = ? AND request_id = ?", (issue_id, request_id))
            if issue is None:
                abort(404)
            resolution_message = request.form.get("response_message", "").strip() or issue["response_message"] or "Resolved by lab."
            execute(
                """
                UPDATE request_issues
                SET response_message = ?, responded_at = COALESCE(responded_at, ?), responded_by_user_id = COALESCE(responded_by_user_id, ?),
                    status = 'resolved', resolved_at = ?, resolved_by_user_id = ?
                WHERE id = ?
                """,
                (resolution_message, now_iso(), user["id"], now_iso(), user["id"], issue_id),
            )
            write_request_metadata_snapshot(request_id)
            log_action(user["id"], "sample_request", request_id, "issue_resolved", {"resolution_preview": resolution_message[:160]})
            flash("Issue marked as resolved.", "success")
            return redirect(url_for("request_detail", request_id=request_id))
        if action == "reopen_issue":
            issue_id = int(request.form.get("issue_id") or 0)
            issue = query_one("SELECT * FROM request_issues WHERE id = ? AND request_id = ?", (issue_id, request_id))
            if issue is None:
                abort(404)
            if sample_request["requester_id"] != user["id"]:
                abort(403)
            execute(
                """
                UPDATE request_issues
                SET status = 'open', resolved_at = NULL, resolved_by_user_id = NULL
                WHERE id = ?
                """,
                (issue_id,),
            )
            write_request_metadata_snapshot(request_id)
            log_action(user["id"], "sample_request", request_id, "issue_reopened", {"issue_id": issue_id})
            flash("Issue reopened.", "success")
            return redirect(url_for("request_detail", request_id=request_id))
        if action == "upload_attachment":
            if not can_upload_files:
                abort(403)
            uploaded_file = request.files.get("attachment")
            attachment_type = request.form.get("attachment_type", "other")
            note = request.form.get("note", "").strip()
            if attachment_type not in attachment_type_choices():
                attachment_type = "other"
            try:
                save_uploaded_attachment(sample_request, uploaded_file, user["id"], attachment_type, note)
                write_request_metadata_snapshot(request_id)
                flash("Attachment uploaded.", "success")
            except ValueError as exc:
                flash(str(exc), "error")
            return redirect(url_for("request_detail", request_id=request_id))

        if action == "admin_set_status" and can_manage:
            new_status = request.form.get("new_status", "").strip()
            remarks = request.form.get("remarks", "").strip()
            scheduled_for = request.form.get("scheduled_for", "").strip()
            allowed_statuses = {
                "submitted",
                "under_review",
                "awaiting_sample_submission",
                "sample_submitted",
                "sample_received",
                "scheduled",
                "in_progress",
                "completed",
                "rejected",
            }
            if new_status not in allowed_statuses:
                flash("Choose a valid status.", "error")
                return redirect(url_for("request_detail", request_id=request_id))
            db = get_db()
            if new_status == "under_review" and not approval_steps:
                create_approval_chain(db, request_id, sample_request["instrument_id"])
            now_value = now_iso()
            update_fields = {
                "status": new_status,
                "remarks": remarks if remarks else sample_request["remarks"],
                "updated_at": now_value,
                "completion_locked": 1 if new_status == "completed" else 0,
                "completed_at": now_value if new_status == "completed" else None,
            }
            if new_status == "sample_submitted":
                update_fields["submitted_to_lab_at"] = sample_request["submitted_to_lab_at"] or now_value
                update_fields["sample_submitted_at"] = sample_request["sample_submitted_at"] or now_value
            if new_status in {"sample_received", "scheduled", "in_progress", "completed"}:
                update_fields["sample_received_at"] = sample_request["sample_received_at"] or now_value
                update_fields["received_by_operator_id"] = sample_request["received_by_operator_id"] or user["id"]
            if new_status == "scheduled":
                update_fields["scheduled_for"] = scheduled_for or sample_request["scheduled_for"] or now_value
            if new_status == "completed":
                update_fields.update(completion_override_fields(sample_request, user["id"], now_value))
                execute(
                    "UPDATE approval_steps SET status = 'approved', acted_at = COALESCE(acted_at, ?), remarks = CASE WHEN remarks = '' THEN 'Completed from admin status control' ELSE remarks END WHERE sample_request_id = ? AND status != 'rejected'",
                    (now_value, request_id),
                )
            columns = ", ".join(f"{key} = ?" for key in update_fields)
            execute(
                f"UPDATE sample_requests SET {columns} WHERE id = ?",
                tuple(update_fields.values()) + (request_id,),
            )
            if new_status == "completed":
                log_completion_override_events(
                    user["id"],
                    sample_request,
                    update_fields,
                    now_value,
                    "status_changed",
                    {"from_status": sample_request["status"], "to_status": new_status, "remarks": remarks, "scheduled_for": scheduled_for},
                )
            else:
                log_action(
                    user["id"],
                    "sample_request",
                    request_id,
                    "status_changed",
                    {"from_status": sample_request["status"], "to_status": new_status, "remarks": remarks, "scheduled_for": scheduled_for},
                )
            write_request_metadata_snapshot(request_id)
            flash("Status updated.", "success")
            return redirect(url_for("request_detail", request_id=request_id))

        if sample_request["completion_locked"]:
            flash("Completed jobs are locked. Add amendments through a controlled workflow later.", "error")
            return redirect(url_for("request_detail", request_id=request_id))

        if action == "approve_step":
            step_id = int(request.form["step_id"])
            remarks = request.form.get("remarks", "").strip()
            approval_attachment = request.files.get("approval_attachment")
            step = query_one("SELECT * FROM approval_steps WHERE id = ? AND sample_request_id = ?", (step_id, request_id))
            if (
                step is None
                or not can_approve_step(user, step, sample_request["instrument_id"])
                or not approval_step_is_actionable(step, approval_steps)
            ):
                abort(403)
            execute(
                "UPDATE approval_steps SET status = 'approved', remarks = ?, acted_at = ? WHERE id = ?",
                (remarks, now_iso(), step_id),
            )
            next_status = build_request_status(get_db(), request_id)
            execute("UPDATE sample_requests SET status = ?, remarks = ?, updated_at = ? WHERE id = ?", (next_status, remarks, now_iso(), request_id))
            if approval_attachment and (approval_attachment.filename or "").strip():
                try:
                    save_uploaded_attachment(
                        sample_request,
                        approval_attachment,
                        user["id"],
                        "invoice",
                        remarks or f"{step['approver_role'].replace('_', ' ').title()} approval attachment",
                    )
                except ValueError as exc:
                    flash(f"Approved, but file upload failed: {exc}", "error")
            log_action(user["id"], "sample_request", request_id, f"{step['approver_role']}_approved", {"step_id": step_id})
        elif action == "reject_step":
            step_id = int(request.form["step_id"])
            remarks = request.form.get("remarks", "").strip()
            step = query_one("SELECT * FROM approval_steps WHERE id = ? AND sample_request_id = ?", (step_id, request_id))
            if (
                step is None
                or not can_approve_step(user, step, sample_request["instrument_id"])
                or not approval_step_is_actionable(step, approval_steps)
            ):
                abort(403)
            execute(
                "UPDATE approval_steps SET status = 'rejected', remarks = ?, acted_at = ? WHERE id = ?",
                (remarks, now_iso(), step_id),
            )
            execute("UPDATE sample_requests SET status = 'rejected', remarks = ?, updated_at = ? WHERE id = ?", (remarks, now_iso(), request_id))
            log_action(user["id"], "sample_request", request_id, f"{step['approver_role']}_rejected", {"step_id": step_id})
        elif action == "assign_approver" and can_manage:
            step_id = int(request.form["step_id"])
            approver_user_id = int(request.form["approver_user_id"])
            step = query_one("SELECT * FROM approval_steps WHERE id = ? AND sample_request_id = ?", (step_id, request_id))
            candidate = query_one("SELECT * FROM users WHERE id = ? AND active = 1", (approver_user_id,))
            if step is None or not candidate_allowed_for_step(candidate, step["approver_role"], sample_request["instrument_id"]):
                abort(403)
            execute(
                "UPDATE approval_steps SET approver_user_id = ?, acted_at = NULL WHERE id = ?",
                (approver_user_id, step_id),
            )
            log_action(
                user["id"],
                "sample_request",
                request_id,
                "approval_assigned",
                {"step_id": step_id, "approver_role": step["approver_role"], "approver_user_id": approver_user_id},
            )
            flash(f"{approval_role_label(step['approver_role'])} approver updated.", "success")
            return redirect(url_for("request_detail", request_id=request_id))
        elif action == "mark_sample_submitted" and sample_request["requester_id"] == user["id"]:
            if sample_request["status"] != "awaiting_sample_submission":
                flash("This request is not waiting for physical sample submission.", "error")
                return redirect(url_for("request_detail", request_id=request_id))
            if instrument_intake_mode(sample_request) != "accepting":
                flash("This lab is not accepting sample dropoff right now.", "error")
                return redirect(url_for("request_detail", request_id=request_id))
            dropoff_note = request.form.get("sample_dropoff_note", "").strip()
            execute(
                """
                UPDATE sample_requests
                SET status = 'sample_submitted', submitted_to_lab_at = ?, sample_submitted_at = ?,
                    sample_dropoff_note = ?, remarks = ?, updated_at = ?
                WHERE id = ?
                """,
                (now_iso(), now_iso(), dropoff_note, dropoff_note, now_iso(), request_id),
            )
            log_action(user["id"], "sample_request", request_id, "sample_submitted", {"dropoff_note": dropoff_note})
        elif action == "mark_sample_received" and (can_operate or can_manage):
            if sample_request["status"] != "sample_submitted":
                flash("Sample can only be received after member handoff.", "error")
                return redirect(url_for("request_detail", request_id=request_id))
            remarks = request.form.get("remarks", "").strip()
            execute(
                """
                UPDATE sample_requests
                SET status = 'sample_received', sample_received_at = ?, received_by_operator_id = ?,
                    remarks = ?, updated_at = ?
                WHERE id = ?
                """,
                (now_iso(), user["id"], remarks, now_iso(), request_id),
            )
            log_action(user["id"], "sample_request", request_id, "sample_received", {"remarks": remarks})
        elif action == "reassign_operator" and (can_operate or can_manage):
            operator_id = int(request.form.get("assigned_operator_id") or 0)
            assignee = query_one("SELECT * FROM users WHERE id = ? AND active = 1", (operator_id,))
            if not candidate_allowed_for_step(assignee, "operator", sample_request["instrument_id"]):
                flash("Pick a valid operator or instrument-area admin for this instrument.", "error")
                return redirect(url_for("request_detail", request_id=request_id))
            remarks = request.form.get("remarks", "").strip()
            execute(
                "UPDATE sample_requests SET assigned_operator_id = ?, remarks = CASE WHEN ? != '' THEN ? ELSE remarks END, updated_at = ? WHERE id = ?",
                (operator_id, remarks, remarks, now_iso(), request_id),
            )
            log_action(
                user["id"],
                "sample_request",
                request_id,
                "operator_reassigned",
                {"assigned_operator_id": operator_id, "remarks": remarks},
            )
            flash(f"Job reassigned to {assignee['name']}.", "success")
            return redirect(url_for("request_detail", request_id=request_id))
        elif action == "schedule" and (can_operate or can_manage):
            if sample_request["status"] not in {"sample_received", "scheduled", "in_progress"}:
                flash("Request must be approved and physically received before scheduling.", "error")
                return redirect(url_for("request_detail", request_id=request_id))
            scheduled_for = request.form["scheduled_for"]
            operator_id = int(request.form["assigned_operator_id"]) if request.form["assigned_operator_id"] else user["id"]
            remarks = request.form.get("remarks", "").strip()
            execute(
                "UPDATE sample_requests SET status = 'scheduled', scheduled_for = ?, assigned_operator_id = ?, remarks = ?, updated_at = ? WHERE id = ?",
                (scheduled_for, operator_id, remarks, now_iso(), request_id),
            )
            log_action(user["id"], "sample_request", request_id, "scheduled", {"scheduled_for": scheduled_for, "assigned_operator_id": operator_id})
        elif action == "admin_schedule_override" and can_manage:
            scheduled_for = request.form["scheduled_for"]
            operator_id = int(request.form["assigned_operator_id"]) if request.form["assigned_operator_id"] else user["id"]
            remarks = request.form.get("remarks", "").strip()
            execute(
                """
                UPDATE sample_requests
                SET status = 'scheduled', scheduled_for = ?, assigned_operator_id = ?, sample_received_at = COALESCE(sample_received_at, ?),
                    received_by_operator_id = COALESCE(received_by_operator_id, ?), remarks = ?, updated_at = ?
                WHERE id = ?
                """,
                (scheduled_for, operator_id, now_iso(), user["id"], remarks, now_iso(), request_id),
            )
            execute(
                "UPDATE approval_steps SET status = 'approved', acted_at = COALESCE(acted_at, ?), remarks = CASE WHEN remarks = '' THEN 'Admin override' ELSE remarks END WHERE sample_request_id = ? AND status != 'rejected'",
                (now_iso(), request_id),
            )
            log_action(user["id"], "sample_request", request_id, "admin_schedule_override", {"scheduled_for": scheduled_for, "assigned_operator_id": operator_id})
        elif action == "start" and (can_operate or can_manage):
            remarks = request.form.get("remarks", "").strip()
            execute("UPDATE sample_requests SET status = 'in_progress', remarks = ?, updated_at = ? WHERE id = ?", (remarks, now_iso(), request_id))
            log_action(user["id"], "sample_request", request_id, "started", {})
        elif action == "complete" and (can_operate or can_manage):
            results_summary = request.form["results_summary"].strip()
            remarks = request.form.get("remarks", "").strip()
            amount_paid = float(request.form.get("amount_paid") or sample_request["amount_paid"] or 0)
            finance_status = request.form.get("finance_status", sample_request["finance_status"])
            email_ok, email_message = send_completion_email(sample_request, results_summary)
            now_value = now_iso()
            completion_fields = completion_override_fields(sample_request, user["id"], now_value)
            execute(
                """
                UPDATE sample_requests
                SET status = 'completed', results_summary = ?, remarks = ?, amount_paid = ?, finance_status = ?,
                    result_email_status = ?, result_email_sent_at = ?, completion_locked = 1,
                    submitted_to_lab_at = ?, sample_submitted_at = ?, sample_received_at = ?, received_by_operator_id = ?,
                    scheduled_for = ?, assigned_operator_id = ?, completed_at = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    results_summary,
                    remarks,
                    amount_paid,
                    finance_status,
                    email_message,
                    now_value if email_ok else None,
                    completion_fields["submitted_to_lab_at"],
                    completion_fields["sample_submitted_at"],
                    completion_fields["sample_received_at"],
                    completion_fields["received_by_operator_id"],
                    completion_fields["scheduled_for"],
                    completion_fields["assigned_operator_id"],
                    completion_fields["completed_at"],
                    now_value,
                    request_id,
                ),
            )
            log_completion_override_events(
                user["id"],
                sample_request,
                completion_fields,
                now_value,
                "completed",
                {"results_summary": results_summary, "email_status": email_message},
            )
        elif action == "admin_complete_override" and can_manage:
            results_summary = request.form["results_summary"].strip()
            remarks = request.form.get("remarks", "").strip()
            amount_paid = float(request.form.get("amount_paid") or sample_request["amount_paid"] or 0)
            finance_status = request.form.get("finance_status", sample_request["finance_status"])
            operator_id = int(request.form["assigned_operator_id"]) if request.form.get("assigned_operator_id") else (sample_request["assigned_operator_id"] or user["id"])
            email_ok, email_message = send_completion_email(sample_request, results_summary)
            now_value = now_iso()
            completion_fields = completion_override_fields(sample_request, operator_id, now_value)
            execute(
                """
                UPDATE sample_requests
                SET status = 'completed', assigned_operator_id = ?, submitted_to_lab_at = ?, sample_submitted_at = ?, sample_received_at = ?,
                    received_by_operator_id = ?, scheduled_for = ?,
                    results_summary = ?, remarks = ?, amount_paid = ?, finance_status = ?,
                    result_email_status = ?, result_email_sent_at = ?, completion_locked = 1, completed_at = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    completion_fields["assigned_operator_id"],
                    completion_fields["submitted_to_lab_at"],
                    completion_fields["sample_submitted_at"],
                    completion_fields["sample_received_at"],
                    completion_fields["received_by_operator_id"],
                    completion_fields["scheduled_for"],
                    results_summary,
                    remarks,
                    amount_paid,
                    finance_status,
                    email_message,
                    now_value if email_ok else None,
                    completion_fields["completed_at"],
                    now_value,
                    request_id,
                ),
            )
            execute(
                "UPDATE approval_steps SET status = 'approved', acted_at = COALESCE(acted_at, ?), remarks = CASE WHEN remarks = '' THEN 'Admin override' ELSE remarks END WHERE sample_request_id = ? AND status != 'rejected'",
                (now_value, request_id),
            )
            log_completion_override_events(
                user["id"],
                sample_request,
                completion_fields,
                now_value,
                "admin_complete_override",
                {"results_summary": results_summary, "email_status": email_message},
            )
        elif action == "resolve_sample" and (can_operate or can_manage):
            results_summary = request.form.get("results_summary", "").strip()
            remarks = request.form.get("remarks", "").strip()
            amount_paid = float(request.form.get("amount_paid") or sample_request["amount_paid"] or 0)
            finance_status = request.form.get("finance_status", sample_request["finance_status"])
            mark_complete = request.form.get("mark_complete") == "1"
            uploaded_resolution_file = request.files.get("resolution_attachment")
            resolution_upload_error = None
            if mark_complete:
                final_summary = results_summary or remarks or "Completed by operator."
                email_ok, email_message = send_completion_email(sample_request, final_summary)
                now_value = now_iso()
                completion_fields = completion_override_fields(sample_request, user["id"], now_value)
                execute(
                    """
                    UPDATE sample_requests
                    SET status = 'completed', assigned_operator_id = ?, submitted_to_lab_at = ?, sample_submitted_at = ?,
                        sample_received_at = ?, received_by_operator_id = ?, scheduled_for = ?, results_summary = ?, remarks = ?, amount_paid = ?, finance_status = ?,
                        result_email_status = ?, result_email_sent_at = ?, completion_locked = 1, completed_at = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (
                        completion_fields["assigned_operator_id"],
                        completion_fields["submitted_to_lab_at"],
                        completion_fields["sample_submitted_at"],
                        completion_fields["sample_received_at"],
                        completion_fields["received_by_operator_id"],
                        completion_fields["scheduled_for"],
                        final_summary,
                        remarks,
                        amount_paid,
                        finance_status,
                        email_message,
                        now_value if email_ok else None,
                        completion_fields["completed_at"],
                        now_value,
                        request_id,
                    ),
                )
                execute(
                    "UPDATE approval_steps SET status = 'approved', acted_at = COALESCE(acted_at, ?), remarks = CASE WHEN remarks = '' THEN 'Completed from job page' ELSE remarks END WHERE sample_request_id = ? AND status != 'rejected'",
                    (now_value, request_id),
                )
                log_completion_override_events(
                    user["id"],
                    sample_request,
                    completion_fields,
                    now_value,
                    "resolved_and_completed",
                    {"results_summary": final_summary, "email_status": email_message},
                )
            else:
                execute(
                    "UPDATE sample_requests SET results_summary = ?, remarks = ?, amount_paid = ?, finance_status = ?, updated_at = ? WHERE id = ?",
                    (results_summary, remarks, amount_paid, finance_status, now_iso(), request_id),
                )
                log_action(user["id"], "sample_request", request_id, "resolution_saved", {"results_summary": results_summary})
            if uploaded_resolution_file and uploaded_resolution_file.filename:
                try:
                    save_uploaded_attachment(
                        sample_request,
                        uploaded_resolution_file,
                        user["id"],
                        "result_document",
                        remarks or "Resolution upload",
                    )
                except ValueError as exc:
                    resolution_upload_error = str(exc)
            write_request_metadata_snapshot(request_id)
            if resolution_upload_error:
                flash(f"Resolution saved, but file upload failed: {resolution_upload_error}", "error")
            else:
                flash("Job marked done." if mark_complete else "Resolution saved.", "success")
            return redirect(url_for("request_detail", request_id=request_id))
        elif action == "reject" and can_manage:
            remarks = request.form.get("remarks", "").strip()
            execute("UPDATE sample_requests SET status = 'rejected', remarks = ?, updated_at = ? WHERE id = ?", (remarks, now_iso(), request_id))
            log_action(user["id"], "sample_request", request_id, "rejected", {})
        else:
            abort(403)
        write_request_metadata_snapshot(request_id)
        return redirect(url_for("request_detail", request_id=request_id))

    operators = []
    if can_manage or can_operate:
        operators = query_all(
            """
            SELECT DISTINCT u.id, u.name
            FROM users u
            LEFT JOIN instrument_operators io ON io.user_id = u.id AND io.instrument_id = ?
            LEFT JOIN instrument_admins ia ON ia.user_id = u.id AND ia.instrument_id = ?
            LEFT JOIN instrument_faculty_admins ifa ON ifa.user_id = u.id AND ifa.instrument_id = ?
            WHERE u.active = 1
              AND (
                io.instrument_id IS NOT NULL OR
                ia.instrument_id IS NOT NULL OR
                ifa.instrument_id IS NOT NULL OR
                u.role IN ('super_admin', 'site_admin')
              )
            ORDER BY u.name
            """,
            (sample_request["instrument_id"], sample_request["instrument_id"], sample_request["instrument_id"]),
        )
    attachments = get_request_attachments(request_id)
    issues = get_request_issues(request_id)
    message_thread = get_request_message_thread(request_id)
    message_attachments = attachments_by_message_ids([row["id"] for row in message_thread])
    logs = query_all("SELECT al.*, u.name AS actor_name FROM audit_logs al LEFT JOIN users u ON u.id = al.actor_id WHERE entity_type = 'sample_request' AND entity_id = ? ORDER BY al.id", (request_id,))
    audit_chain_valid = verify_audit_chain("sample_request", request_id)
    status_summary = request_status_summary(sample_request, approval_steps)
    lifecycle_steps = request_lifecycle_steps(sample_request, approval_steps)
    visible_attachments = request_card_visible_attachments(user, sample_request, attachments)
    timeline_entries = request_card_visible_timeline(
        user,
        sample_request,
        request_timeline_entries(sample_request, logs, visible_attachments, message_thread, message_attachments),
    )
    has_open_issue = any(issue["status"] == "open" for issue in issues)
    submitted_documents = [row for row in visible_attachments if row["attachment_type"] in {"request_document", "sample_slip"}]
    approval_candidates = {
        "finance": approval_candidate_options("finance", sample_request["instrument_id"]),
        "professor": approval_candidate_options("professor", sample_request["instrument_id"]),
        "operator": approval_candidate_options("operator", sample_request["instrument_id"]),
    }
    actionable_approval_steps = [
        step
        for step in approval_steps
        if step["id"] in actionable_step_ids and can_approve_step(user, step, sample_request["instrument_id"])
    ]
    remarks_author_row = query_one(
        """SELECT u.name FROM audit_logs al
           JOIN users u ON u.id = al.actor_id
           WHERE al.entity_type = 'sample_request' AND al.entity_id = ? AND al.actor_id IS NOT NULL
           ORDER BY al.created_at DESC LIMIT 1""",
        (request_id,),
    )
    remarks_author = remarks_author_row["name"] if remarks_author_row else None
    return render_template(
        "request_detail.html",
        sample_request=sample_request,
        card_policy=card_policy,
        back_url=request.args.get("back", "").strip(),
        can_manage=can_manage,
        can_operate=can_operate,
        can_upload_files=can_upload_files,
        operators=operators,
        approval_steps=approval_steps,
        actionable_step_ids=actionable_step_ids,
        actionable_approval_steps=actionable_approval_steps,
        attachment_type_choices=attachment_type_choices(),
        attachments=visible_attachments,
        submitted_documents=submitted_documents,
        issues=issues,
        message_thread=message_thread,
        message_attachments=message_attachments,
        attachment_size_label=attachment_size_label,
        logs=logs,
        audit_chain_valid=audit_chain_valid,
        status_summary=status_summary,
        lifecycle_steps=lifecycle_steps,
        timeline_entries=timeline_entries,
        has_open_issue=has_open_issue,
        conversation_note_types=[item for item in COMMUNICATION_NOTE_TYPES if item[0] in {"lab_reply", "final_note"}],
        admin_status_choices=["submitted", "under_review", "awaiting_sample_submission", "sample_submitted", "sample_received", "scheduled", "in_progress", "completed", "rejected"],
        can_flag_issue=can_flag_issue,
        can_respond_issue=can_respond_issue,
        approval_candidates=approval_candidates,
        remarks_author=remarks_author,
    )


@app.route("/schedule")
@login_required
def schedule():
    user = current_user()
    if not can_access_schedule(user):
        abort(403)
    filters = schedule_filter_values()
    queue_back_url = request.args.get("back", "").strip()
    queue_source_label = request.args.get("source_label", "").strip()
    focus_request_id = request.args.get("focus_request_id", "").strip()
    visible_instruments = visible_instruments_for_user(user)
    if len(visible_instruments) == 1 and not filters.get("instrument_id"):
        filters["instrument_id"] = str(visible_instruments[0]["id"])
    clauses, params = request_scope_sql(user, "sr")
    schedule_query_filters = {"sort": "created_desc"}  # always fetch newest-first from DB
    base_sql, base_params = request_history_query(clauses, params, schedule_query_filters)
    rows_all = query_all(base_sql, tuple(base_params))
    live_statuses = {"submitted", "under_review", "awaiting_sample_submission", "sample_submitted", "sample_received", "scheduled", "in_progress"}
    live_rows = [row for row in rows_all if row["status"] in live_statuses]
    completed_rows = [row for row in rows_all if row["status"] == "completed"]
    rejected_rows = [row for row in rows_all if row["status"] == "rejected"]
    soft_wait_rows = [row for row in live_rows if row["status"] == "submitted"]
    approval_rows = [row for row in live_rows if row["status"] == "under_review"]
    awaiting_sample_rows = [row for row in live_rows if row["status"] == "awaiting_sample_submission"]
    pending_receipt_rows = [row for row in live_rows if row["status"] == "sample_submitted"]
    ready_rows = [row for row in live_rows if row["status"] == "sample_received"]
    active_rows = [row for row in live_rows if row["status"] in {"scheduled", "in_progress"}]
    selected_instrument = None
    if filters.get("instrument_id"):
        try:
            instrument_id = int(filters["instrument_id"])
        except (TypeError, ValueError):
            instrument_id = None
        if instrument_id is not None:
            selected_instrument = next((row for row in visible_instruments if row["id"] == instrument_id), None)
    instruments = visible_instruments
    operators = query_all("SELECT id, name FROM users WHERE role IN ('operator', 'instrument_admin', 'super_admin') ORDER BY name")
    requesters = query_all("SELECT id, name FROM users WHERE role = 'requester' ORDER BY name")
    attachment_map = attachments_by_request_ids([row["id"] for row in rows_all])
    profile = user_access_profile(user)
    can_operate_queue = bool(
        {"reassign", "mark_received"} & set(profile["card_action_fields"])
    )
    return render_template(
        "schedule.html",
        queue_rows=rows_all,
        live_rows=live_rows,
        completed_rows=completed_rows,
        rejected_rows=rejected_rows,
        soft_wait_rows=soft_wait_rows,
        approval_rows=approval_rows,
        awaiting_sample_rows=awaiting_sample_rows,
        pending_receipt_rows=pending_receipt_rows,
        ready_rows=ready_rows,
        active_rows=active_rows,
        filters=filters,
        instruments=instruments,
        instrument_selector_enabled=len(instruments) > 1,
        operators=operators,
        requesters=requesters,
        selected_instrument=selected_instrument,
        focus_request_id=focus_request_id,
        attachment_map=attachment_map,
        queue_back_url=queue_back_url,
        queue_source_label=queue_source_label,
        can_operate_queue=can_operate_queue,
    )


@app.route("/schedule/actions", methods=["POST"])
@login_required
def schedule_actions():
    user = current_user()
    if not can_access_schedule(user):
        abort(403)
    request_id = int(request.form["request_id"])
    sample_request = query_one(
        """
        SELECT sr.*, i.name AS instrument_name, r.name AS requester_name, r.email AS requester_email
        FROM sample_requests sr
        JOIN instruments i ON i.id = sr.instrument_id
        JOIN users r ON r.id = sr.requester_id
        WHERE sr.id = ?
        """,
        (request_id,),
    )
    if sample_request is None:
        abort(404)
    if not can_view_request(user, sample_request):
        abort(403)
    can_manage = can_manage_instrument(user["id"], sample_request["instrument_id"], user["role"])
    can_operate = can_operate_instrument(user["id"], sample_request["instrument_id"], user["role"])
    if not (can_manage or can_operate):
        abort(403)
    if sample_request["completion_locked"]:
        flash("Completed jobs are locked.", "error")
        return redirect(url_for("schedule", bucket="scheduled"))

    def redirect_to_queue(bucket_override: str | None = None, focus_request: bool = False):
        params: dict[str, str] = {
            "bucket": bucket_override or (request.form.get("bucket") or "all"),
        }
        for key in ("q", "instrument_id", "date_from", "date_to", "source_label"):
            value = (request.form.get(key) or "").strip()
            if value:
                params[key] = value
        back_value = (request.form.get("back") or "").strip()
        if back_value:
            params["back"] = back_value
        if focus_request:
            params["focus_request_id"] = str(request_id)
        return redirect(url_for("schedule", **params))

    action = request.form.get("action", "").strip()
    if action == "take_up":
        if sample_request["status"] not in {"sample_received", "scheduled"}:
            flash("Only received jobs can be taken up from the board.", "error")
            return redirect_to_queue()
        scheduled_for = request.form.get("scheduled_for", "").strip()
        if not scheduled_for:
            flash("Please choose a schedule time.", "error")
            return redirect_to_queue()
        operator_id = int(request.form.get("assigned_operator_id") or user["id"])
        remarks = request.form.get("remarks", "").strip()
        execute(
            "UPDATE sample_requests SET status = 'scheduled', scheduled_for = ?, assigned_operator_id = ?, remarks = ?, updated_at = ? WHERE id = ?",
            (scheduled_for, operator_id, remarks, now_iso(), request_id),
        )
        log_action(user["id"], "sample_request", request_id, "scheduled_from_board", {"scheduled_for": scheduled_for, "assigned_operator_id": operator_id})
        flash(f"{sample_request['request_no']} taken up for work.", "success")
        write_request_metadata_snapshot(request_id)
        return redirect_to_queue(bucket_override="all", focus_request=True)
    elif action == "quick_assign":
        operator_id = int(request.form.get("assigned_operator_id") or 0)
        if not operator_id:
            flash("Choose a person to assign.", "error")
            return redirect_to_queue()
        candidate_ids = {row["id"] for row in request_assignment_candidates(sample_request)}
        if operator_id not in candidate_ids:
            flash("That person cannot be assigned to this job.", "error")
            return redirect_to_queue()
        execute(
            "UPDATE sample_requests SET assigned_operator_id = ?, updated_at = ? WHERE id = ?",
            (operator_id, now_iso(), request_id),
        )
        log_action(user["id"], "sample_request", request_id, "reassigned", {"assigned_operator_id": operator_id, "remarks": "Assigned from queue"})
        flash(f"{sample_request['request_no']} reassigned.", "success")
        write_request_metadata_snapshot(request_id)
        return redirect_to_queue(focus_request=True)
    elif action == "plan_next_slot":
        if sample_request["status"] not in {"sample_received"}:
            flash("Only ready jobs can be placed into the day planner.", "error")
            return redirect_to_queue()
        planner_date = parse_schedule_day(request.form.get("planner_date"))
        scope_filters = schedule_filter_values()
        clauses, params = request_scope_sql(user, "sr")
        if scope_filters.get("requester_id"):
            clauses.append("sr.requester_id = ?")
            params.append(int(scope_filters["requester_id"]))
        base_sql, base_params = request_history_query(clauses, params, scope_filters)
        rows_all = [row for row in query_all(base_sql, tuple(base_params)) if row_matches_period(row, scope_filters["period"])]
        same_day_rows = []
        for row in rows_all:
            if row["status"] not in {"scheduled", "in_progress"} or not row["scheduled_for"]:
                continue
            try:
                parsed = datetime.fromisoformat(str(row["scheduled_for"]).replace("Z", "+00:00"))
            except ValueError:
                try:
                    parsed = datetime.strptime(str(row["scheduled_for"])[:16], "%Y-%m-%dT%H:%M")
                except ValueError:
                    parsed = None
            if parsed and parsed.date() == planner_date:
                same_day_rows.append(row)
        scheduled_for_raw = (request.form.get("scheduled_for") or "").strip()
        if scheduled_for_raw:
            try:
                slot_dt = datetime.fromisoformat(scheduled_for_raw)
            except ValueError:
                flash("Choose a valid date and time for the planner.", "error")
                return redirect_to_queue()
        else:
            slot_dt = compute_next_schedule_slot(planner_date, same_day_rows)
        operator_id = int(request.form.get("assigned_operator_id") or user["id"])
        remarks = request.form.get("remarks", "").strip()
        execute(
            "UPDATE sample_requests SET status = 'scheduled', scheduled_for = ?, assigned_operator_id = ?, remarks = ?, updated_at = ? WHERE id = ?",
            (slot_dt.isoformat(timespec="minutes"), operator_id, remarks, now_iso(), request_id),
        )
        log_action(
            user["id"],
            "sample_request",
            request_id,
            "scheduled_from_board",
            {"scheduled_for": slot_dt.isoformat(timespec="minutes"), "assigned_operator_id": operator_id, "planner_date": planner_date.isoformat()},
        )
        write_request_metadata_snapshot(request_id)
        flash(f"{sample_request['request_no']} added to {planner_date.strftime('%d/%m/%Y')} at {slot_dt.strftime('%H:%M')}.", "success")
        return redirect_to_queue(bucket_override="all", focus_request=True)
    elif action == "mark_received":
        if sample_request["status"] != "sample_submitted":
            flash("Only submitted samples can be marked received from the board.", "error")
            return redirect_to_queue()
        execute(
            """
            UPDATE sample_requests
            SET status = 'sample_received', sample_received_at = ?, received_by_operator_id = ?, updated_at = ?
            WHERE id = ?
            """,
            (now_iso(), user["id"], now_iso(), request_id),
        )
        log_action(user["id"], "sample_request", request_id, "sample_received", {"remarks": ""})
        flash(f"{sample_request['request_no']} marked received.", "success")
        write_request_metadata_snapshot(request_id)
        return redirect_to_queue(bucket_override="all", focus_request=True)
    elif action == "start_now":
        if sample_request["status"] not in {"scheduled", "in_progress"}:
            flash("Only scheduled jobs can be started from the board.", "error")
            return redirect_to_queue()
        remarks = request.form.get("remarks", "").strip()
        operator_id = sample_request["assigned_operator_id"] or user["id"]
        execute(
            "UPDATE sample_requests SET status = 'in_progress', assigned_operator_id = ?, remarks = ?, updated_at = ? WHERE id = ?",
            (operator_id, remarks, now_iso(), request_id),
        )
        log_action(user["id"], "sample_request", request_id, "started_from_board", {})
        flash(f"{sample_request['request_no']} is now in progress.", "success")
        write_request_metadata_snapshot(request_id)
        return redirect_to_queue(bucket_override="all", focus_request=True)
    elif action == "finish_now":
        if sample_request["status"] != "in_progress":
            flash("Only in-progress jobs can be finished from the board.", "error")
            return redirect_to_queue()
        results_summary = request.form.get("results_summary", "").strip()
        if not results_summary:
            flash("Please add a short result summary before finishing.", "error")
            return redirect_to_queue()
        remarks = request.form.get("remarks", "").strip()
        amount_paid = float(request.form.get("amount_paid") or sample_request["amount_paid"] or 0)
        finance_status = request.form.get("finance_status", sample_request["finance_status"])
        email_ok, email_message = send_completion_email(sample_request, results_summary)
        now_value = now_iso()
        completion_fields = completion_override_fields(sample_request, user["id"], now_value)
        execute(
            """
            UPDATE sample_requests
            SET status = 'completed', results_summary = ?, remarks = ?, amount_paid = ?, finance_status = ?,
                result_email_status = ?, result_email_sent_at = ?, completion_locked = 1,
                submitted_to_lab_at = ?, sample_submitted_at = ?, sample_received_at = ?, received_by_operator_id = ?,
                scheduled_for = ?, assigned_operator_id = ?, completed_at = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                results_summary,
                remarks,
                amount_paid,
                finance_status,
                email_message,
                now_value if email_ok else None,
                completion_fields["submitted_to_lab_at"],
                completion_fields["sample_submitted_at"],
                completion_fields["sample_received_at"],
                completion_fields["received_by_operator_id"],
                completion_fields["scheduled_for"],
                completion_fields["assigned_operator_id"],
                completion_fields["completed_at"],
                now_value,
                request_id,
            ),
        )
        log_completion_override_events(
            user["id"],
            sample_request,
            completion_fields,
            now_value,
            "completed_from_board",
            {"results_summary": results_summary, "email_status": email_message},
        )
        flash("Job marked done.", "success")
        write_request_metadata_snapshot(request_id)
        return redirect_to_queue(bucket_override="all", focus_request=True)
    else:
        abort(403)

    write_request_metadata_snapshot(request_id)
    return redirect_to_queue()


@app.route("/attachments/<int:attachment_id>/download")
@login_required
def download_attachment(attachment_id: int):
    attachment = query_one("SELECT * FROM request_attachments WHERE id = ? AND is_active = 1", (attachment_id,))
    if attachment is None:
        abort(404)
    request_row = query_one("SELECT * FROM sample_requests WHERE id = ?", (attachment["request_id"],))
    user = current_user()
    if request_row is None or not can_view_request(user, request_row):
        abort(403)
    full_path = BASE_DIR / attachment["relative_path"]
    if not full_path.exists() or not str(full_path.resolve()).startswith(str(UPLOAD_DIR.resolve())):
        abort(404)
    return send_file(full_path, as_attachment=True, download_name=attachment["original_filename"], mimetype=attachment["mime_type"])


@app.route("/attachments/<int:attachment_id>/view")
@login_required
def view_attachment(attachment_id: int):
    attachment = query_one("SELECT * FROM request_attachments WHERE id = ? AND is_active = 1", (attachment_id,))
    if attachment is None:
        abort(404)
    request_row = query_one("SELECT * FROM sample_requests WHERE id = ?", (attachment["request_id"],))
    user = current_user()
    if request_row is None or not can_view_request(user, request_row):
        abort(403)
    full_path = BASE_DIR / attachment["relative_path"]
    if not full_path.exists() or not str(full_path.resolve()).startswith(str(UPLOAD_DIR.resolve())):
        abort(404)
    return send_file(full_path, as_attachment=False, download_name=attachment["original_filename"], mimetype=attachment["mime_type"])


@app.route("/attachments/<int:attachment_id>/delete", methods=["POST"])
@login_required
def delete_attachment(attachment_id: int):
    attachment = query_one("SELECT * FROM request_attachments WHERE id = ? AND is_active = 1", (attachment_id,))
    if attachment is None:
        abort(404)
    request_row = query_one("SELECT * FROM sample_requests WHERE id = ?", (attachment["request_id"],))
    user = current_user()
    if request_row is None or not can_delete_attachment(user, attachment, request_row):
        abort(403)
    execute("UPDATE request_attachments SET is_active = 0 WHERE id = ?", (attachment_id,))
    write_request_metadata_snapshot(request_row["id"])
    log_action(
        user["id"],
        "sample_request",
        request_row["id"],
        "attachment_removed",
        {
            "filename": attachment["original_filename"],
            "attachment_type": attachment["attachment_type"],
            "note": attachment["note"],
        },
    )
    flash("Attachment removed.", "success")
    return redirect(url_for("request_detail", request_id=request_row["id"]))


@app.route("/my/history")
@login_required
def my_history():
    args = request.args.to_dict()
    return redirect(url_for("schedule", **args))

@app.route("/me")
@login_required
def my_profile():
    return redirect(url_for("user_profile", user_id=current_user()["id"]))


@app.route("/history/processed")
@login_required
def processed_history():
    args = request.args.to_dict()
    args.setdefault("bucket", "completed")
    return redirect(url_for("schedule", **args))


@app.route("/users/<int:user_id>", methods=["GET", "POST"])
@login_required
def user_profile(user_id: int):
    viewer = current_user()
    target_user = query_one("SELECT id, name, email, role, invite_status, active FROM users WHERE id = ?", (user_id,))
    if target_user is None:
        abort(404)
    if not can_view_user_profile(viewer, target_user):
        abort(403)
    if request.method == "POST":
        action = request.form.get("action", "").strip()
        if action == "remove_access":
            if not can_manage_members(viewer):
                abort(403)
            if target_user["role"] != "requester" or is_owner(target_user) or target_user["id"] == viewer["id"]:
                abort(403)
            execute("UPDATE users SET active = 0 WHERE id = ?", (user_id,))
            log_action(viewer["id"], "user", user_id, "member_deactivated", {"email": target_user["email"]})
            flash(f"Access removed for {target_user['email']}.", "success")
            return redirect(url_for("user_profile", user_id=user_id))

    scope_clauses, scope_params = request_scope_sql(viewer, "sr")
    rows = query_all(
        f"""
        SELECT sr.*, i.name AS instrument_name, i.code AS instrument_code,
               op.name AS operator_name,
               COALESCE(COUNT(ra.id), 0) AS attachment_count
        FROM sample_requests sr
        JOIN instruments i ON i.id = sr.instrument_id
        LEFT JOIN users op ON op.id = sr.assigned_operator_id
        LEFT JOIN request_attachments ra ON ra.request_id = sr.id AND ra.is_active = 1
        WHERE {' AND '.join(scope_clauses + ['sr.requester_id = ?'])}
        GROUP BY sr.id
        ORDER BY sr.created_at DESC
        LIMIT 25
        """,
        (*scope_params, user_id),
    )
    handled_rows = query_all(
        f"""
        SELECT sr.*, i.name AS instrument_name, i.code AS instrument_code,
               op.name AS operator_name,
               COALESCE(COUNT(ra.id), 0) AS attachment_count
        FROM sample_requests sr
        JOIN instruments i ON i.id = sr.instrument_id
        LEFT JOIN users op ON op.id = sr.assigned_operator_id
        LEFT JOIN request_attachments ra ON ra.request_id = sr.id AND ra.is_active = 1
        WHERE {' AND '.join(scope_clauses + ['(sr.assigned_operator_id = ? OR sr.received_by_operator_id = ?)'])}
        GROUP BY sr.id
        ORDER BY COALESCE(sr.completed_at, sr.updated_at, sr.created_at) DESC
        LIMIT 25
        """,
        (*scope_params, user_id, user_id),
    )
    originated_count = query_one(
        f"SELECT COUNT(*) AS c FROM sample_requests sr WHERE {' AND '.join(scope_clauses + ['sr.created_by_user_id = ?'])}",
        (*scope_params, user_id),
    )["c"]
    submitted_summary = query_one(
        f"""
        SELECT COUNT(*) AS total_jobs,
               COALESCE(SUM(sr.sample_count), 0) AS total_samples,
               SUM(CASE WHEN sr.status = 'completed' THEN 1 ELSE 0 END) AS completed_jobs,
               SUM(CASE WHEN sr.status NOT IN ('completed', 'rejected') THEN 1 ELSE 0 END) AS open_jobs
        FROM sample_requests sr
        WHERE {' AND '.join(scope_clauses + ['sr.requester_id = ?'])}
        """,
        (*scope_params, user_id),
    )
    handled_summary = query_one(
        f"""
        SELECT COUNT(*) AS total_jobs,
               COALESCE(SUM(sr.sample_count), 0) AS total_samples,
               SUM(CASE WHEN sr.status = 'completed' THEN 1 ELSE 0 END) AS completed_jobs,
               SUM(CASE WHEN sr.status NOT IN ('completed', 'rejected') THEN 1 ELSE 0 END) AS open_jobs
        FROM sample_requests sr
        WHERE {' AND '.join(scope_clauses + ['(sr.assigned_operator_id = ? OR sr.received_by_operator_id = ?)'])}
        """,
        (*scope_params, user_id, user_id),
    )
    return render_template(
        "user_detail.html",
        target_user=target_user,
        rows=rows,
        handled_rows=handled_rows,
        submitted_summary=submitted_summary,
        handled_summary=handled_summary,
        originated_count=originated_count,
        is_self=viewer["id"] == target_user["id"],
        can_remove_access=can_manage_members(viewer) and target_user["role"] == "requester" and target_user["active"] and target_user["id"] != viewer["id"],
    )


@app.route("/users/<int:user_id>/history")
@role_required("super_admin")
def user_history(user_id: int):
    target_user = query_one("SELECT id, name FROM users WHERE id = ?", (user_id,))
    if target_user is None:
        abort(404)
    args = request.args.to_dict()
    args["requester_id"] = str(user_id)
    args["source_label"] = target_user["name"]
    return redirect(url_for("schedule", **args))


@app.route("/instruments/<int:instrument_id>/history")
@login_required
def instrument_history(instrument_id: int):
    user = current_user()
    instrument = query_one("SELECT * FROM instruments WHERE id = ?", (instrument_id,))
    if instrument is None:
        abort(404)
    if not can_view_instrument_history(user, instrument_id):
        abort(403)
    args = request.args.to_dict()
    args["instrument_id"] = str(instrument_id)
    args["source_label"] = instrument["name"]
    return redirect(url_for("schedule", **args))


def calendar_events_payload(user: sqlite3.Row, filters: dict[str, str], range_start: date, range_end: date) -> list[dict]:
    clauses = ["sr.scheduled_for IS NOT NULL", "substr(sr.scheduled_for, 1, 10) >= ?", "substr(sr.scheduled_for, 1, 10) < ?"]
    params: list = [range_start.isoformat(), range_end.isoformat()]
    instrument_ids = assigned_instrument_ids(user)
    if instrument_ids:
        placeholders = ",".join("?" for _ in instrument_ids)
        clauses.append(f"sr.instrument_id IN ({placeholders})")
        params.extend(instrument_ids)
    elif user["role"] == "requester":
        clauses.append("sr.requester_id = ?")
        params.append(user["id"])
    if filters.get("instrument_id"):
        clauses.append("sr.instrument_id = ?")
        params.append(int(filters["instrument_id"]))
    if filters.get("operator_id"):
        clauses.append("sr.assigned_operator_id = ?")
        params.append(int(filters["operator_id"]))
    statuses = []
    if filters.get("show_scheduled", "1") == "1":
        statuses.append("scheduled")
    if filters.get("show_in_progress", "1") == "1":
        statuses.append("in_progress")
    if filters.get("show_completed", "0") == "1":
        statuses.append("completed")
    if statuses:
        clauses.append(f"sr.status IN ({','.join('?' for _ in statuses)})")
        params.extend(statuses)
    else:
        clauses.append("1 = 0")
    sql = f"""
        SELECT sr.id, sr.request_no, sr.sample_name, sr.title, sr.status, sr.scheduled_for,
               i.name AS instrument_name, i.code AS instrument_code, u.name AS operator_name
        FROM sample_requests sr
        JOIN instruments i ON i.id = sr.instrument_id
        LEFT JOIN users u ON u.id = sr.assigned_operator_id
        WHERE {' AND '.join(clauses)}
        ORDER BY sr.scheduled_for
    """
    request_rows = query_all(sql, tuple(params))
    downtime_clauses = ["idt.is_active = 1", "substr(idt.start_time, 1, 10) < ?", "substr(idt.end_time, 1, 10) >= ?"]
    downtime_params: list = [range_end.isoformat(), range_start.isoformat()]
    if filters.get("instrument_id"):
        downtime_clauses.append("idt.instrument_id = ?")
        downtime_params.append(int(filters["instrument_id"]))
    elif instrument_ids:
        placeholders = ",".join("?" for _ in instrument_ids)
        downtime_clauses.append(f"idt.instrument_id IN ({placeholders})")
        downtime_params.extend(instrument_ids)
    downtime_rows = []
    if filters.get("show_maintenance", "1") == "1" and (user["role"] != "requester" or instrument_ids):
        downtime_rows = query_all(
            f"""
            SELECT idt.*, i.name AS instrument_name, i.code AS instrument_code, u.name AS created_by_name
            FROM instrument_downtime idt
            JOIN instruments i ON i.id = idt.instrument_id
            JOIN users u ON u.id = idt.created_by_user_id
            WHERE {' AND '.join(downtime_clauses)}
            ORDER BY idt.start_time
            """,
            tuple(downtime_params),
        )
    events: list[dict] = []
    for row in request_rows:
        status = row["status"]
        start_value = datetime.fromisoformat(str(row["scheduled_for"]))
        end_value = start_value + timedelta(hours=1)
        if status == "in_progress":
            back = "#dce9ff"
            border = "#3465c5"
        elif status == "completed":
            back = "#e7f6e5"
            border = "#4b8d3b"
        else:
            back = "#eaf4f3"
            border = "#1f6f78"
        events.append(
            {
                "id": f"request-{row['id']}",
                "title": f"{row['request_no']} | {row['sample_name']}",
                "start": start_value.isoformat(),
                "end": end_value.isoformat(),
                "backgroundColor": back,
                "borderColor": border,
                "textColor": "#17313a",
                "url": url_for("request_detail", request_id=row["id"]),
                "extendedProps": {
                    "request_id": row["id"],
                    "status": row["status"],
                    "instrument": row["instrument_name"],
                    "instrument_code": row["instrument_code"],
                    "operator": row["operator_name"] or "-",
                },
            }
        )
    for row in downtime_rows:
        events.append(
            {
                "id": f"downtime-{row['id']}",
                "title": f"Maintenance | {row['instrument_code']} | {row['reason']}",
                "start": row["start_time"],
                "end": row["end_time"],
                "backgroundColor": "#fff0df",
                "borderColor": "#c5741d",
                "textColor": "#6f4312",
                "display": "block",
                "extendedProps": {
                    "instrument": row["instrument_name"],
                    "created_by": row["created_by_name"],
                    "downtime": True,
                },
            }
        )
    return events


def calendar_data(filters: dict[str, str]) -> dict:
    view = filters.get("view", "week")
    anchor_date = parse_date_param(filters.get("date")) or datetime.utcnow().date()
    if view == "day":
        prev_date = anchor_date - timedelta(days=1)
        next_date = anchor_date + timedelta(days=1)
    elif view == "month":
        range_start = anchor_date.replace(day=1)
        if range_start.month == 12:
            range_end = date(range_start.year + 1, 1, 1)
        else:
            range_end = date(range_start.year, range_start.month + 1, 1)
        prev_date = range_start - timedelta(days=1)
        next_date = range_end
    else:
        range_start = anchor_date - timedelta(days=anchor_date.weekday())
        prev_date = range_start - timedelta(days=7)
        next_date = range_start + timedelta(days=7)
    return {
        "view": view,
        "anchor_date": anchor_date,
        "prev_date": prev_date,
        "next_date": next_date,
    }


@app.route("/calendar", methods=["GET", "POST"])
@login_required
def calendar():
    user = current_user()
    if not can_access_calendar(user):
        abort(403)
    filters = calendar_filter_values()
    visible_instruments = visible_instruments_for_user(user)
    if len(visible_instruments) == 1 and not filters.get("instrument_id"):
        filters["instrument_id"] = str(visible_instruments[0]["id"])
    if request.method == "POST":
        if user["role"] != "super_admin" and not assigned_instrument_ids(user):
            abort(403)
        instrument_id = int(request.form["instrument_id"])
        if user["role"] != "super_admin" and not can_manage_instrument(user["id"], instrument_id, user["role"]):
            abort(403)
        start_time = request.form["start_time"]
        end_time = request.form["end_time"]
        reason = request.form["reason"].strip()
        if not start_time or not end_time or end_time <= start_time:
            flash("Downtime end must be after start.", "error")
            return redirect(url_for("calendar", **filters))
        execute(
            """
            INSERT INTO instrument_downtime (instrument_id, start_time, end_time, reason, created_by_user_id, created_at, is_active)
            VALUES (?, ?, ?, ?, ?, ?, 1)
            """,
            (instrument_id, start_time, end_time, reason, user["id"], now_iso()),
        )
        log_action(user["id"], "instrument", instrument_id, "downtime_added", {"start_time": start_time, "end_time": end_time, "reason": reason})
        flash("Downtime block added.", "success")
        return redirect(url_for("calendar", instrument_id=instrument_id, date=filters.get("date", ""), view=filters.get("view", "week")))
    context = calendar_data(filters)
    instruments = visible_instruments
    operators = query_all("SELECT id, name FROM users WHERE role IN ('operator', 'instrument_admin', 'super_admin') ORDER BY name")
    can_add_downtime = user["role"] == "super_admin" or bool(assigned_instrument_ids(user))
    managed_instruments = instruments if user["role"] == "super_admin" else [i for i in instruments if can_manage_instrument(user["id"], i["id"], user["role"])]
    return render_template(
        "calendar.html",
        filters=filters,
        instruments=instruments,
        instrument_selector_enabled=len(instruments) > 1,
        operators=operators,
        can_add_downtime=can_add_downtime,
        managed_instruments=managed_instruments,
        **context,
    )


@app.route("/calendar/events")
@login_required
def calendar_events():
    user = current_user()
    if not can_access_calendar(user):
        abort(403)
    filters = calendar_filter_values()
    start = request.args.get("start", "").strip()
    end = request.args.get("end", "").strip()
    range_start = parse_date_param(start[:10]) if start else None
    range_end = parse_date_param(end[:10]) if end else None
    if range_start is None or range_end is None or range_end <= range_start:
        return jsonify([])
    return jsonify(calendar_events_payload(user, filters, range_start, range_end))


@app.route("/instruments/<int:instrument_id>/calendar")
@login_required
def instrument_calendar(instrument_id: int):
    return redirect(url_for("calendar", instrument_id=instrument_id))


@app.route("/stats")
@login_required
def stats():
    user = current_user()
    if not can_access_stats(user):
        abort(403)
    report_filters = report_filter_values()
    visible_instruments = visible_instruments_for_user(user)
    if len(visible_instruments) == 1 and not report_filters.get("instrument_id"):
        report_filters["instrument_id"] = str(visible_instruments[0]["id"])
    own_exports = query_all(
        "SELECT filename FROM generated_exports WHERE created_by_user_id = ? ORDER BY created_at DESC LIMIT 10",
        (user["id"],),
    )
    visible_exports = [EXPORT_DIR / row["filename"] for row in own_exports if (EXPORT_DIR / row["filename"]).exists()]
    stats = stats_payload(user, report_filters)
    admin_graphs = can_access_stats(user)
    stats_visible_links = {i["id"]: can_open_instrument_detail(user, i["id"]) for i in visible_instruments}

    # Trend data (chronological order) — convert Rows to dicts for tojson
    monthly_trend = [dict(r) for r in reversed(stats["monthly"][:12])]
    daily_trend = [dict(r) for r in reversed(stats["daily"][:30])]
    weekly_trend = [dict(r) for r in reversed(stats["weekly"][:12])]

    # ── War-room: live operational data ──
    live_by_instrument = query_all(
        """SELECT i.id, i.name AS instrument_name, i.code,
               SUM(CASE WHEN sr.status IN ('scheduled','in_progress') THEN 1 ELSE 0 END) AS active_jobs,
               SUM(CASE WHEN sr.status IN ('sample_submitted','sample_received') THEN 1 ELSE 0 END) AS queued_jobs,
               SUM(CASE WHEN sr.status IN ('submitted','under_review','awaiting_sample_submission') THEN 1 ELSE 0 END) AS pending_jobs,
               COUNT(sr.id) AS total_open
        FROM instruments i
        LEFT JOIN sample_requests sr ON sr.instrument_id = i.id AND sr.status NOT IN ('completed','rejected')
        WHERE i.status = 'active'
        GROUP BY i.id ORDER BY active_jobs DESC, queued_jobs DESC""",
        (),
    )

    live_totals = {
        "active": sum(r["active_jobs"] for r in live_by_instrument),
        "queued": sum(r["queued_jobs"] for r in live_by_instrument),
        "pending": sum(r["pending_jobs"] for r in live_by_instrument),
        "total_open": sum(r["total_open"] for r in live_by_instrument),
    }

    recent_activity = query_all(
        """SELECT sr.request_no, sr.sample_name, sr.status, sr.updated_at,
               i.name AS instrument_name, u.name AS requester_name
        FROM sample_requests sr
        JOIN instruments i ON i.id = sr.instrument_id
        JOIN users u ON u.id = sr.requester_id
        WHERE sr.updated_at IS NOT NULL
        ORDER BY sr.updated_at DESC LIMIT 25""",
        (),
    )

    # Bottleneck: instruments with oldest waiting jobs
    bottlenecks = query_all(
        """SELECT i.name AS instrument_name,
               MIN(COALESCE(sr.sample_submitted_at, sr.created_at)) AS oldest_waiting,
               ROUND((julianday('now') - julianday(MIN(COALESCE(sr.sample_submitted_at, sr.created_at)))) * 24.0, 1) AS wait_hours,
               COUNT(*) AS waiting_count
        FROM sample_requests sr
        JOIN instruments i ON i.id = sr.instrument_id
        WHERE sr.status IN ('sample_submitted','sample_received','scheduled')
        GROUP BY i.id
        HAVING wait_hours > 0
        ORDER BY wait_hours DESC LIMIT 5""",
        (),
    )

    # Status breakdown for doughnut chart
    status_breakdown = query_all(
        """SELECT status, COUNT(*) AS count
        FROM sample_requests
        WHERE status NOT IN ('completed','rejected')
        GROUP BY status ORDER BY count DESC""",
        (),
    )

    # Turnaround time by instrument (hours)
    turnaround_data = query_all(
        """SELECT i.name AS instrument_name,
               ROUND(AVG((julianday(sr.completed_at) - julianday(sr.created_at)) * 24.0), 1) AS avg_hours,
               ROUND(MIN((julianday(sr.completed_at) - julianday(sr.created_at)) * 24.0), 1) AS min_hours,
               ROUND(MAX((julianday(sr.completed_at) - julianday(sr.created_at)) * 24.0), 1) AS max_hours
        FROM sample_requests sr
        JOIN instruments i ON i.id = sr.instrument_id
        WHERE sr.status = 'completed' AND sr.completed_at IS NOT NULL
        GROUP BY i.id ORDER BY avg_hours DESC LIMIT 10""",
        (),
    )

    # Top requesters
    top_requesters = query_all(
        """SELECT u.name AS requester_name, COUNT(*) AS job_count,
               SUM(sr.sample_count) AS sample_count
        FROM sample_requests sr
        JOIN users u ON u.id = sr.requester_id
        GROUP BY sr.requester_id ORDER BY job_count DESC LIMIT 8""",
        (),
    )

    return render_template(
        "stats.html",
        stats=stats,
        exports=visible_exports[:10],
        admin_graphs=admin_graphs,
        report_filters=report_filters,
        instruments=visible_instruments,
        instrument_selector_enabled=len(visible_instruments) > 1,
        daily_chart=chart_rows(stats["daily"], "bucket", "jobs", 10),
        weekly_chart=chart_rows(stats["weekly"], "bucket", "jobs", 10),
        instrument_chart=chart_rows(stats["by_instrument"], "instrument_name", "completed_samples", 10),
        visible_links=stats_visible_links,
        daily_trend=daily_trend,
        weekly_trend=weekly_trend,
        monthly_trend=monthly_trend,
        by_instrument_json=[dict(r) for r in stats["by_instrument"]],
        weekly_json=[dict(r) for r in stats["weekly"]],
        live_by_instrument=live_by_instrument,
        live_totals=live_totals,
        recent_activity=recent_activity,
        bottlenecks=bottlenecks,
        status_breakdown=[dict(r) for r in status_breakdown],
        turnaround_data=[dict(r) for r in turnaround_data],
        top_requesters=[dict(r) for r in top_requesters],
    )


@app.route("/visualizations")
@login_required
def visualizations():
    user = current_user()
    if not can_access_stats(user):
        abort(403)
    report_filters = report_filter_values()
    visible_instruments = visible_instruments_for_user(user)
    if len(visible_instruments) == 1 and not report_filters.get("instrument_id"):
        report_filters["instrument_id"] = str(visible_instruments[0]["id"])
    stats = stats_payload_for_scope(user, report_filters)
    groups = [row for row in stats["by_group"] if row["group_name"]]
    return render_template(
        "visualization.html",
        page_title="Global Visualization",
        page_hint="Aggregate request and throughput view across all instruments in your scope.",
        scope_kind="global",
        scope_value="All Instruments",
        stats=stats,
        report_filters=report_filters,
        daily_chart=chart_rows(stats["daily"], "bucket", "jobs", 10),
        monthly_chart=chart_rows(stats["monthly"], "bucket", "samples", 10),
        instrument_chart=chart_rows(stats["by_instrument"], "instrument_name", "completed_samples", 10),
        group_chart=chart_rows(stats["by_group"], "group_name", "completed_samples", 10),
        groups=groups,
        current_instrument=None,
        export_endpoint="generate_visualization_export",
        export_scope={},
        instruments=visible_instruments,
        instrument_selector_enabled=len(visible_instruments) > 1,
    )


@app.route("/visualizations/instrument/<int:instrument_id>")
@login_required
def instrument_visualization(instrument_id: int):
    user = current_user()
    if not can_view_instrument_history(user, instrument_id) and user["role"] != "super_admin":
        abort(403)
    instrument = query_one("SELECT * FROM instruments WHERE id = ?", (instrument_id,))
    if instrument is None:
        abort(404)
    report_filters = report_filter_values()
    stats = stats_payload_for_scope(user, report_filters, instrument_id=instrument_id)
    return render_template(
        "visualization.html",
        page_title=f"{instrument['name']} Visualization",
        page_hint="Instrument-level throughput, request volume, and export view.",
        scope_kind="instrument",
        scope_value=instrument["name"],
        stats=stats,
        report_filters=report_filters,
        daily_chart=chart_rows(stats["daily"], "bucket", "jobs", 10),
        monthly_chart=chart_rows(stats["monthly"], "bucket", "samples", 10),
        instrument_chart=chart_rows(stats["by_instrument"], "instrument_name", "completed_samples", 10),
        group_chart=chart_rows(stats["by_group"], "group_name", "completed_samples", 10),
        groups=[],
        current_instrument=instrument,
        export_endpoint="generate_visualization_export",
        export_scope={"instrument_id": instrument_id},
        instruments=visible_instruments_for_user(user),
        instrument_selector_enabled=False,
    )


@app.route("/visualizations/group/<path:group_name>")
@login_required
def group_visualization(group_name: str):
    user = current_user()
    if not can_view_group_visualization(user, group_name):
        abort(403)
    report_filters = report_filter_values()
    stats = stats_payload_for_scope(user, report_filters, group_name=group_name)
    groups = [row for row in stats["by_group"] if row["group_name"]]
    return render_template(
        "visualization.html",
        page_title=f"{group_name} Visualization",
        page_hint="Group-level aggregate across all instruments in this equipment group.",
        scope_kind="group",
        scope_value=group_name,
        stats=stats,
        report_filters=report_filters,
        daily_chart=chart_rows(stats["daily"], "bucket", "jobs", 10),
        monthly_chart=chart_rows(stats["monthly"], "bucket", "samples", 10),
        instrument_chart=chart_rows(stats["by_instrument"], "instrument_name", "completed_samples", 10),
        group_chart=chart_rows(stats["by_group"], "group_name", "completed_samples", 10),
        groups=groups,
        current_instrument=None,
        export_endpoint="generate_visualization_export",
        export_scope={"group_name": group_name},
        instruments=visible_instruments_for_user(user),
        instrument_selector_enabled=len(visible_instruments_for_user(user)) > 1,
    )


@app.route("/exports/generate", methods=["POST"])
@login_required
def generate_export():
    user = current_user()
    if not can_access_stats(user):
        abort(403)
    report_filters = report_filter_values()
    path = generate_export_workbook(user, report_filters)
    log_action(user["id"], "system_export", 0, "export_generated", {"filename": path.name})
    flash(f"Excel export created: {path.name}", "success")
    return redirect(url_for("stats", **report_filters))


@app.route("/visualizations/export", methods=["POST"])
@login_required
def generate_visualization_export():
    user = current_user()
    if not can_access_stats(user):
        abort(403)
    report_filters = report_filter_values()
    instrument_id_value = request.form.get("instrument_id", "").strip()
    group_name = request.form.get("group_name", "").strip()
    instrument_id = int(instrument_id_value) if instrument_id_value else None
    if instrument_id is not None and not (can_view_instrument_history(user, instrument_id) or user["role"] == "super_admin"):
        abort(403)
    if group_name and not can_view_group_visualization(user, group_name):
        abort(403)
    prefix = "lab_visualization_export"
    if instrument_id is not None:
        prefix = f"instrument_{instrument_id}_export"
    elif group_name:
        prefix = f"group_{safe_token(group_name)}_export"
    path = generate_export_workbook(
        user,
        report_filters,
        instrument_id=instrument_id,
        group_name=group_name or None,
        filename_prefix=prefix,
    )
    log_action(user["id"], "system_export", 0, "visualization_export_generated", {"filename": path.name, "instrument_id": instrument_id, "group_name": group_name})
    if instrument_id is not None:
        flash(f"Instrument export created: {path.name}", "success")
        return redirect(url_for("instrument_visualization", instrument_id=instrument_id, **report_filters))
    if group_name:
        flash(f"Group export created: {path.name}", "success")
        return redirect(url_for("group_visualization", group_name=group_name, **report_filters))
    flash(f"Visualization export created: {path.name}", "success")
    return redirect(url_for("visualizations", **report_filters))


@app.route("/exports/<path:filename>")
@login_required
def download_export(filename: str):
    user = current_user()
    if not can_access_stats(user):
        abort(403)
    export_row = query_one("SELECT * FROM generated_exports WHERE filename = ?", (filename,))
    if export_row is None:
        abort(404)
    if user["role"] != "super_admin" and export_row["created_by_user_id"] != user["id"]:
        abort(403)
    return send_from_directory(EXPORT_DIR, filename, as_attachment=True)


@app.route("/requests/<int:request_id>/calendar-card")
@login_required
def request_calendar_card(request_id: int):
    user = current_user()
    sample_request = query_one(
        """
        SELECT sr.*, i.name AS instrument_name, i.accepting_requests, i.soft_accept_enabled,
               r.name AS requester_name, r.email AS requester_email,
               op.name AS operator_name
        FROM sample_requests sr
        JOIN instruments i ON i.id = sr.instrument_id
        JOIN users r ON r.id = sr.requester_id
        LEFT JOIN users op ON op.id = sr.assigned_operator_id
        WHERE sr.id = ?
        """,
        (request_id,),
    )
    if sample_request is None:
        abort(404)
    if not can_view_request(user, sample_request):
        abort(403)
    can_manage = can_manage_instrument(user["id"], sample_request["instrument_id"], user["role"])
    can_operate = can_operate_instrument(user["id"], sample_request["instrument_id"], user["role"])
    operators = []
    if can_manage or can_operate:
        operators = query_all(
            """
            SELECT DISTINCT u.id, u.name
            FROM users u
            LEFT JOIN instrument_operators io ON io.user_id = u.id AND io.instrument_id = ?
            LEFT JOIN instrument_admins ia ON ia.user_id = u.id AND ia.instrument_id = ?
            WHERE u.active = 1
              AND (io.instrument_id IS NOT NULL OR ia.instrument_id IS NOT NULL OR u.role IN ('super_admin', 'site_admin'))
            ORDER BY u.name
            """,
            (sample_request["instrument_id"], sample_request["instrument_id"]),
        )
    next_slot_default = (datetime.utcnow() + timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M")
    return render_template(
        "calendar_card.html",
        sample_request=sample_request,
        can_manage=can_manage,
        can_operate=can_operate,
        operators=operators,
        next_slot_default=next_slot_default,
        request_display_status=request_display_status,
        format_dt=format_dt,
    )


@app.route("/admin/users", methods=["GET", "POST"])
@login_required
def admin_users():
    user = current_user()
    can_open_user_admin = is_owner(user) or user["role"] == "super_admin"
    if not can_open_user_admin:
        abort(403)
    can_create_users = is_owner(user)
    can_delete_members = is_owner(user)
    can_elevate_members = is_owner(user) or user["role"] == "super_admin"
    if request.method == "POST":
        action = request.form.get("action", "create_user")
        if action == "create_user":
            if not can_create_users:
                abort(403)
            name = request.form["name"].strip()
            email = request.form["email"].strip().lower()
            role = request.form["role"]
            password = request.form["password"].strip() or "SimplePass123"
            invite_status = "invited" if role == "requester" else "active"
            existing_user = query_one("SELECT id FROM users WHERE email = ?", (email,))
            if existing_user is not None:
                flash(f"User {email} already exists.", "error")
            else:
                execute(
                    """
                    INSERT INTO users (name, email, password_hash, role, invited_by, invite_status, active)
                    VALUES (?, ?, ?, ?, ?, ?, 1)
                    """,
                    (name, email, generate_password_hash(password, method="pbkdf2:sha256"), role, user["id"], invite_status),
                )
                log_action(user["id"], "user", 0, "user_created", {"email": email, "role": role})
                flash(f"User {email} created.", "success")
        elif action == "delete_member":
            member_id = int(request.form["user_id"])
            member = query_one("SELECT * FROM users WHERE id = ?", (member_id,))
            if member is None or member["role"] != "requester" or is_owner(member) or member["id"] == user["id"]:
                abort(403)
            execute("UPDATE users SET active = 0 WHERE id = ?", (member_id,))
            log_action(user["id"], "user", member_id, "member_deactivated", {"email": member["email"]})
            flash(f"Member {member['email']} deactivated.", "success")
        elif action == "elevate_member":
            if not can_elevate_members:
                abort(403)
            member_id = int(request.form["user_id"])
            new_role = request.form["new_role"].strip()
            allowed_roles = {"operator", "instrument_admin", "site_admin", "finance_admin", "professor_approver"}
            if new_role not in allowed_roles:
                abort(403)
            member = query_one("SELECT * FROM users WHERE id = ?", (member_id,))
            if member is None or member["role"] != "requester" or is_owner(member) or member["id"] == user["id"]:
                abort(403)
            execute(
                "UPDATE users SET role = ?, invite_status = 'active', active = 1 WHERE id = ?",
                (new_role, member_id),
            )
            log_action(user["id"], "user", member_id, "member_elevated", {"email": member["email"], "new_role": new_role})
            flash(f"{member['email']} elevated to {new_role.replace('_', ' ')}.", "success")
        return redirect(url_for("admin_users"))
    rows = query_all("SELECT id, name, email, role, invite_status, active FROM users ORDER BY role, name")
    owners = [row for row in rows if row["email"].strip().lower() in OWNER_EMAILS]
    members = [row for row in rows if row["role"] == "requester"]
    admins = [row for row in rows if row["role"] != "requester" and row["email"].strip().lower() not in OWNER_EMAILS]
    return render_template(
        "users.html",
        members=members,
        admins=admins,
        owners=owners,
        can_create_users=can_create_users,
        can_delete_members=can_delete_members,
        can_elevate_members=can_elevate_members,
    )


@app.route("/activate", methods=["GET", "POST"])
def activate():
    if request.method == "POST":
        email = request.form["email"].strip().lower()
        password = request.form["password"].strip()
        name = request.form.get("name", "").strip()
        user = query_one("SELECT * FROM users WHERE email = ? AND active = 1", (email,))
        if user is None:
            flash("No invited user found with that email.", "error")
            return redirect(url_for("activate"))
        if user["invite_status"] != "invited":
            flash("This account is not waiting for activation. New users must be added by an admin first.", "error")
            return redirect(url_for("activate"))
        if len(password) < 8:
            flash("Password must be at least 8 characters.", "error")
            return redirect(url_for("activate"))
        execute(
            "UPDATE users SET name = ?, password_hash = ?, invite_status = 'active' WHERE id = ?",
            (name or user["name"], generate_password_hash(password, method='pbkdf2:sha256'), user["id"]),
        )
        flash("Account activated. You can log in now.", "success")
        return redirect(url_for("login"))
    return render_template("activate.html")


# ── PRISM feedback log persistence ──────────────────────────
PRISM_LOG = Path(__file__).resolve().parent / "prism_log.json"

@app.route("/prism/save", methods=["POST"])
def prism_save():
    """Persist the full prism dump to disk. Called by overlay JS on every entry."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify(ok=False, error="no data"), 400
    PRISM_LOG.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    return jsonify(ok=True)

@app.route("/prism/log", methods=["GET"])
def prism_log():
    """Return the current persisted prism log."""
    if PRISM_LOG.exists():
        return app.response_class(PRISM_LOG.read_text(), mimetype="application/json")
    return jsonify(feedLog=[], errorLog=[], paths=[])

@app.route("/prism/clear", methods=["POST"])
def prism_clear():
    """Clear the persisted prism log."""
    if PRISM_LOG.exists():
        PRISM_LOG.write_text("{}")
    return jsonify(ok=True)


if __name__ == "__main__":
    init_db()
    # Always auto-reload templates so changes appear without server restart
    app.config["TEMPLATES_AUTO_RELOAD"] = True
    app.jinja_env.auto_reload = True
    # Static files are served fresh by Flask dev server (no caching)
    # use_reloader watches .py files and auto-restarts on code changes
    # Set LAB_SCHEDULER_DEBUG=1 for verbose Flask debug toolbar
    is_debug = os.environ.get("LAB_SCHEDULER_DEBUG", "0") == "1"
    app.run(debug=True, use_reloader=True, port=5055,
            extra_files=[
                str(Path(__file__).resolve().parent / "static" / "styles.css"),
                str(Path(__file__).resolve().parent / "static" / "grid-overlay.js"),
            ])
