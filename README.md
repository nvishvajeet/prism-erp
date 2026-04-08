<!-- README.md — PRISM Reconstruction Manual.  AI agents: do NOT edit
     this file without explicit owner approval.  Read it in full before
     modifying ANY source file.  This document is the single authoritative
     reference for the entire system. -->

# PRISM — Platform for Research Infrastructure Management

## Reconstruction Manual

**Version:** 2026-04-08  
**Maintainer:** MIT-WPU Department of Research & Development  
**License:** Internal — not for redistribution  

A request-tracking and operator-workflow system for a university
research instrumentation laboratory.  One Python process, one SQLite
database, one CSS file, browser-based interface.  No JavaScript
framework; no ORM.

A competent developer or AI agent reading only this file must be able to
reconstruct a functionally identical system from scratch.

---

## Table of Contents

1.  Philosophy and Design Axioms  
2.  Technology Stack  
3.  Directory Layout  
4.  Prerequisites and Installation  
5.  User Roles and Permission Matrix  
6.  Request Lifecycle State Machine  
7.  Database Schema (15 Tables)  
8.  Schema Migrations (26 ALTER TABLE Statements)  
9.  Route Map (55 Endpoints)  
10. Template Architecture (27 Files)  
11. StreamQuery: Composable SQL Builder  
12. Context Processor: Injected Template Variables  
13. Approval Workflow Engine  
14. Email Queue Subsystem  
15. Audit Trail with Hash Chain  
16. File Upload and Attachment System  
17. Communication Channel (Request Messages)  
18. Notification System  
19. Compile Safeguards  
20. Client-Side Architecture  
21. Configuration and Environment Variables  
22. Known Bugs and Design Gaps  
23. Future Modules with Time Estimates  

---

## 1. Philosophy and Design Axioms

**The Request Card.**  Every sample request is a card.  The card is
created when a requester submits a job and accumulates all data over its
lifetime: approvals, notes, files, operator actions, timestamps, results.
Nothing is stored separately — the card is the single source of truth for
that job.

**Sliced visibility.**  The same cards form a single queue.  Every page
on the site is a filtered, role-appropriate slice of that queue.  The
Queue page is the canonical view; the Home dashboard, Instrument detail,
Calendar, and Statistics pages are derived views.  There is no data
duplication between pages.

**Blobs within blobs.**  Every visual element on a page is a panel
(blob).  Panels contain sub-panels.  Each panel has a role-visibility
attribute (`data-vis`) that determines which roles can see it.  This
is evaluated client-side, meaning ALL data is sent to the browser but
hidden with CSS/JS — the server does not filter HTML output by role.

**One file.**  The entire server is `app.py`.  Routes, models, helpers,
migrations, templates context, and startup logic all coexist in a single
file (~6900 lines).  This is intentional: it eliminates import cycles,
simplifies deployment, and makes grep-based auditing trivial.

**No ORM.**  All SQL is hand-written.  The `StreamQuery` class provides
composable query building without hiding the SQL.  Every query is visible,
auditable, and optimizable by reading the source.

---

## 2. Technology Stack

| Layer         | Technology            | Version   | Purpose                        |
|---------------|-----------------------|-----------|--------------------------------|
| Runtime       | Python                | 3.11+     | Application server             |
| Web framework | Flask                 | 3.x       | Routing, templates, sessions   |
| Database      | SQLite 3              | built-in  | Persistent storage             |
| Templating    | Jinja2                | (Flask)   | Server-side HTML rendering     |
| Password hash | Werkzeug              | (Flask)   | `generate_password_hash`, `check_password_hash` |
| Excel export  | openpyxl              | 3.x       | `.xlsx` generation for reports |
| CSS           | Custom (no framework) | —         | `static/styles.css`, 3657 lines |
| JS            | Vanilla ES5           | —         | Inline `<script>` blocks in `base.html` |
| Auth          | Flask session (cookie) | —        | Server-side session with secret key |

No Node.js, no npm, no bundler, no TypeScript, no React.

---

## 3. Directory Layout

```
Main/
├── app.py                     # Entire application (6939 lines)
├── lab_scheduler.db           # SQLite database (created on first run)
├── test_safeguards.py         # 5 compile/structural tests
├── README.md                  # This file
├── static/
│   ├── styles.css             # All CSS (3657 lines, 571 rules)
│   └── instrument_images/     # Uploaded instrument photos
├── templates/                 # 27 Jinja2 templates
│   ├── base.html              # Master layout: topbar, nav, flash, scripts
│   ├── _page_macros.html      # paginated_pane, bounded_pane, page_intro, card_heading
│   ├── _request_macros.html   # 8 macros for request card rendering
│   ├── _stream_macros.html    # 2 macros for stream/queue rows
│   ├── activate.html          # Invite activation form
│   ├── budgets.html           # Budget management
│   ├── calendar.html          # Interactive calendar view
│   ├── calendar_card.html     # Calendar event popup card
│   ├── change_password.html   # Password change form
│   ├── dashboard.html         # Home / landing dashboard
│   ├── email_preferences.html # Email notification toggles
│   ├── error.html             # Generic error page
│   ├── finance.html           # Finance overview with KPIs
│   ├── instrument_config.html # Instrument settings + approval chain editor
│   ├── instrument_detail.html # Single instrument view
│   ├── instruments.html       # Instrument catalog listing
│   ├── login.html             # Authentication form
│   ├── new_request.html       # Sample request creation form
│   ├── notifications.html     # Notification center
│   ├── pending.html           # Card-viewer for pending approvals
│   ├── request_detail.html    # Full request card with all actions
│   ├── schedule.html          # Queue management (operator/admin)
│   ├── sitemap.html           # Navigation map
│   ├── stats.html             # Statistics dashboard
│   ├── user_detail.html       # User profile page
│   ├── users.html             # User management (admin)
│   └── visualization.html     # Charts and data viz
├── uploads/                   # User-uploaded attachments (per-instrument)
├── exports/                   # Generated Excel reports
└── backups/                   # Database backup snapshots
```

---

## 4. Prerequisites and Installation

```bash
# System requirements
python3 --version   # Must be 3.11 or higher
pip3 install flask openpyxl werkzeug

# Clone and run
cd Main/
python3 app.py
# Server starts on http://127.0.0.1:5055
# Database created automatically on first launch
```

On startup, `app.py` performs a pre-flight compile check using
`subprocess.run([python3, -m, py_compile, app.py])` with a hard
10-second timeout.  If the check fails or times out, the process
calls `sys.exit(1)` and refuses to start.

Default owner account: `admin@lab.local` (set via `OWNER_EMAILS`
environment variable).

---

## 5. User Roles and Permission Matrix

Eight roles, ordered from least to most privilege:

| Role                | Access Level | Key Capabilities                                                |
|---------------------|--------------|-----------------------------------------------------------------|
| `requester`         | 1            | Submit requests, view own history, confirm results              |
| `professor_approver`| 2            | Approve requests requiring professor sign-off                   |
| `finance_admin`     | 3            | View finance page, manage budgets, approve payment              |
| `faculty_in_charge` | 4            | Approve requests for assigned instruments                       |
| `operator`          | 5            | Receive samples, operate instruments, record results            |
| `instrument_admin`  | 6            | Configure instruments, manage operators, set approval chains    |
| `site_admin`        | 7            | Manage all users, instruments, and system settings              |
| `super_admin`       | 8            | Full access including audit logs, backups, user history          |

**Owner bypass:** Users whose email appears in the `OWNER_EMAILS`
environment variable have unrestricted access regardless of role.  The
`is_owner(user)` helper checks `user["email"].lower() in OWNER_EMAILS`.

**Role-visibility (data-vis):** Every HTML element carries a `data-vis`
attribute listing which roles may see it.  Client-side JavaScript hides
elements whose `data-vis` value does not include the current user's role.
The attribute value is set by the template variable `V`, which is typically
defined at the top of each template as a space-separated role list.

---

## 6. Request Lifecycle State Machine

```
                  ┌─── rejected
                  │
submitted ──→ under_review ──→ awaiting_sample_submission ──→ sample_submitted
    │              │                                               │
    │              │                                          sample_received
    │              │                                               │
    └── cancelled  └── cancelled                              scheduled
                                                                   │
                                                              in_progress
                                                                   │
                                                              completed
```

**Status values** (stored in `sample_requests.status`):

| Status                       | Meaning                                                |
|------------------------------|--------------------------------------------------------|
| `submitted`                  | Requester has submitted; awaiting review                |
| `under_review`               | Admin/operator is reviewing the request                 |
| `awaiting_sample_submission` | Approved; waiting for physical sample                  |
| `sample_submitted`           | Requester reports sample has been dropped off           |
| `sample_received`            | Operator confirms physical receipt of sample            |
| `scheduled`                  | Assigned to a specific date/time slot                   |
| `in_progress`                | Instrument is actively processing the sample            |
| `completed`                  | Results available; requester may confirm receipt         |
| `rejected`                   | Request denied (with reason in remarks)                |
| `cancelled`                  | Withdrawn by requester (only from submitted, under_review, or awaiting_sample_submission) |

**Cancellable statuses:** `{submitted, under_review, awaiting_sample_submission}`

**Result confirmation:** After status reaches `completed`, the requester
may confirm receipt.  This sets `result_confirmed_at` and
`result_confirmed_by` on the sample_requests row and triggers a
`results_confirmed` email notification.

---

## 7. Database Schema (15 Tables)

### 7.1 users

```sql
CREATE TABLE IF NOT EXISTS users (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    name                     TEXT NOT NULL,
    email                    TEXT UNIQUE NOT NULL,
    password_hash            TEXT NOT NULL,
    role                     TEXT NOT NULL,
    invited_by               INTEGER,
    invite_status            TEXT NOT NULL DEFAULT 'active',
    active                   INTEGER NOT NULL DEFAULT 1,
    last_notification_check  TEXT DEFAULT '1970-01-01T00:00:00',
    email_preferences        TEXT  -- JSON blob, e.g. {"status_changed": true, ...}
);
```

### 7.2 instruments

```sql
CREATE TABLE IF NOT EXISTS instruments (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    name                   TEXT NOT NULL,
    code                   TEXT UNIQUE NOT NULL,
    category               TEXT NOT NULL,
    location               TEXT NOT NULL,
    daily_capacity         INTEGER NOT NULL DEFAULT 3,
    status                 TEXT NOT NULL DEFAULT 'active',
    notes                  TEXT NOT NULL DEFAULT '',
    office_info            TEXT NOT NULL DEFAULT '',
    faculty_group          TEXT NOT NULL DEFAULT '',
    manufacturer           TEXT NOT NULL DEFAULT '',
    model_number           TEXT NOT NULL DEFAULT '',
    capabilities_summary   TEXT NOT NULL DEFAULT '',
    machine_photo_url      TEXT NOT NULL DEFAULT '',
    reference_links        TEXT NOT NULL DEFAULT '',
    instrument_description TEXT NOT NULL DEFAULT '',
    accepting_requests     INTEGER NOT NULL DEFAULT 1,
    soft_accept_enabled    INTEGER NOT NULL DEFAULT 0
);
```

### 7.3 instrument_admins

```sql
CREATE TABLE IF NOT EXISTS instrument_admins (
    user_id       INTEGER NOT NULL,
    instrument_id INTEGER NOT NULL,
    PRIMARY KEY (user_id, instrument_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (instrument_id) REFERENCES instruments(id) ON DELETE CASCADE
);
```

### 7.4 instrument_operators

```sql
CREATE TABLE IF NOT EXISTS instrument_operators (
    user_id       INTEGER NOT NULL,
    instrument_id INTEGER NOT NULL,
    PRIMARY KEY (user_id, instrument_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (instrument_id) REFERENCES instruments(id) ON DELETE CASCADE
);
```

### 7.5 instrument_faculty_admins

```sql
CREATE TABLE IF NOT EXISTS instrument_faculty_admins (
    user_id       INTEGER NOT NULL,
    instrument_id INTEGER NOT NULL,
    PRIMARY KEY (user_id, instrument_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (instrument_id) REFERENCES instruments(id) ON DELETE CASCADE
);
```

### 7.6 sample_requests

```sql
CREATE TABLE IF NOT EXISTS sample_requests (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    request_no               TEXT UNIQUE NOT NULL,
    sample_ref               TEXT UNIQUE,
    requester_id             INTEGER NOT NULL,
    created_by_user_id       INTEGER NOT NULL,
    originator_note          TEXT NOT NULL DEFAULT '',
    instrument_id            INTEGER NOT NULL,
    title                    TEXT NOT NULL,
    sample_name              TEXT NOT NULL,
    sample_count             INTEGER NOT NULL DEFAULT 1,
    description              TEXT NOT NULL,
    sample_origin            TEXT NOT NULL DEFAULT 'internal',
    receipt_number           TEXT NOT NULL DEFAULT '',
    amount_due               REAL NOT NULL DEFAULT 0,
    amount_paid              REAL NOT NULL DEFAULT 0,
    finance_status           TEXT NOT NULL DEFAULT 'n/a',
    priority                 TEXT NOT NULL DEFAULT 'normal',
    status                   TEXT NOT NULL DEFAULT 'submitted',
    submitted_to_lab_at      TEXT,
    sample_submitted_at      TEXT,
    sample_received_at       TEXT,
    sample_dropoff_note      TEXT NOT NULL DEFAULT '',
    received_by_operator_id  INTEGER,
    assigned_operator_id     INTEGER,
    scheduled_for            TEXT,
    remarks                  TEXT NOT NULL DEFAULT '',
    results_summary          TEXT NOT NULL DEFAULT '',
    result_email_status      TEXT NOT NULL DEFAULT '',
    result_email_sent_at     TEXT,
    result_confirmed_at      TEXT,
    result_confirmed_by      INTEGER,
    completion_locked        INTEGER NOT NULL DEFAULT 0,
    created_at               TEXT NOT NULL,
    updated_at               TEXT NOT NULL,
    completed_at             TEXT,
    FOREIGN KEY (requester_id) REFERENCES users(id),
    FOREIGN KEY (created_by_user_id) REFERENCES users(id),
    FOREIGN KEY (instrument_id) REFERENCES instruments(id),
    FOREIGN KEY (received_by_operator_id) REFERENCES users(id),
    FOREIGN KEY (assigned_operator_id) REFERENCES users(id)
);
```

### 7.7 approval_steps

```sql
CREATE TABLE IF NOT EXISTS approval_steps (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    sample_request_id   INTEGER NOT NULL,
    step_order          INTEGER NOT NULL,
    approver_role       TEXT NOT NULL,
    approver_user_id    INTEGER,
    status              TEXT NOT NULL DEFAULT 'pending',
    remarks             TEXT NOT NULL DEFAULT '',
    acted_at            TEXT,
    FOREIGN KEY (sample_request_id) REFERENCES sample_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (approver_user_id) REFERENCES users(id)
);
```

### 7.8 audit_logs

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type   TEXT NOT NULL,
    entity_id     INTEGER NOT NULL,
    action        TEXT NOT NULL,
    actor_id      INTEGER,
    payload_json  TEXT NOT NULL,
    prev_hash     TEXT NOT NULL,
    entry_hash    TEXT NOT NULL,
    created_at    TEXT NOT NULL,
    FOREIGN KEY (actor_id) REFERENCES users(id)
);
```

Each row's `entry_hash` is computed as
`SHA-256(prev_hash + entity_type + entity_id + action + payload_json + created_at)`.
The first row uses `prev_hash = "genesis"`.  This forms an immutable
hash chain; tampering with any row invalidates all subsequent hashes.

### 7.9 request_attachments

```sql
CREATE TABLE IF NOT EXISTS request_attachments (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id          INTEGER NOT NULL,
    user_id             INTEGER NOT NULL,
    instrument_id       INTEGER NOT NULL,
    original_filename   TEXT NOT NULL,
    stored_filename     TEXT NOT NULL,
    relative_path       TEXT NOT NULL,
    file_extension      TEXT NOT NULL,
    mime_type           TEXT NOT NULL,
    file_size           INTEGER NOT NULL DEFAULT 0,
    uploaded_by_user_id INTEGER NOT NULL,
    uploaded_at         TEXT NOT NULL,
    attachment_type     TEXT NOT NULL DEFAULT 'other',
    note                TEXT NOT NULL DEFAULT '',
    is_active           INTEGER NOT NULL DEFAULT 1,
    request_message_id  INTEGER,
    FOREIGN KEY (request_id) REFERENCES sample_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (instrument_id) REFERENCES instruments(id),
    FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id),
    FOREIGN KEY (request_message_id) REFERENCES request_messages(id)
);
```

### 7.10 request_messages

```sql
CREATE TABLE IF NOT EXISTS request_messages (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id      INTEGER NOT NULL,
    sender_user_id  INTEGER NOT NULL,
    note_kind       TEXT NOT NULL DEFAULT 'requester_note',
    message_body    TEXT NOT NULL,
    created_at      TEXT NOT NULL,
    is_active       INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (request_id) REFERENCES sample_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_user_id) REFERENCES users(id)
);
```

`note_kind` values: `requester_note`, `lab_reply`, `operator_note`, `final_note`.

### 7.11 request_issues

```sql
CREATE TABLE IF NOT EXISTS request_issues (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id            INTEGER NOT NULL,
    created_by_user_id    INTEGER NOT NULL,
    issue_message         TEXT NOT NULL,
    response_message      TEXT NOT NULL DEFAULT '',
    status                TEXT NOT NULL DEFAULT 'open',
    created_at            TEXT NOT NULL,
    responded_at          TEXT,
    responded_by_user_id  INTEGER,
    resolved_at           TEXT,
    resolved_by_user_id   INTEGER,
    FOREIGN KEY (request_id) REFERENCES sample_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id),
    FOREIGN KEY (responded_by_user_id) REFERENCES users(id),
    FOREIGN KEY (resolved_by_user_id) REFERENCES users(id)
);
```

### 7.12 instrument_downtime

```sql
CREATE TABLE IF NOT EXISTS instrument_downtime (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    instrument_id       INTEGER NOT NULL,
    start_time          TEXT NOT NULL,
    end_time            TEXT NOT NULL,
    reason              TEXT NOT NULL,
    downtime_type       TEXT NOT NULL DEFAULT 'maintenance',
    created_by_user_id  INTEGER NOT NULL,
    created_at          TEXT NOT NULL,
    is_active           INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (instrument_id) REFERENCES instruments(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);
```

`downtime_type` values: `maintenance`, `calibration`, `repair`, `shutdown`, `other`.

Color scheme for calendar rendering:

| Type          | Background | Border    | Text      |
|---------------|------------|-----------|-----------|
| maintenance   | `#fff0df`  | `#c5741d` | `#6f4312` |
| calibration   | `#e8f0fe`  | `#3b6dc5` | `#1a3a6f` |
| repair        | `#fce8e8`  | `#c53b3b` | `#6f1a1a` |
| shutdown      | `#f0e8f5`  | `#7b3bc5` | `#3d1a6f` |
| other         | `#e8e8e8`  | `#6b6b6b` | `#333333` |

### 7.13 generated_exports

```sql
CREATE TABLE IF NOT EXISTS generated_exports (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    filename            TEXT UNIQUE NOT NULL,
    created_by_user_id  INTEGER NOT NULL,
    created_at          TEXT NOT NULL,
    scope_label         TEXT NOT NULL,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);
```

### 7.14 instrument_approval_config

```sql
CREATE TABLE IF NOT EXISTS instrument_approval_config (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    instrument_id     INTEGER NOT NULL,
    step_order        INTEGER NOT NULL,
    approver_role     TEXT NOT NULL,
    approver_user_id  INTEGER,
    UNIQUE(instrument_id, step_order),
    FOREIGN KEY (instrument_id) REFERENCES instruments(id) ON DELETE CASCADE,
    FOREIGN KEY (approver_user_id) REFERENCES users(id)
);
```

### 7.15 rate_limit_tracking

```sql
CREATE TABLE IF NOT EXISTS rate_limit_tracking (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    tracking_key  TEXT NOT NULL,
    route_path    TEXT NOT NULL,
    timestamp     TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 7.16 announcements

```sql
CREATE TABLE IF NOT EXISTS announcements (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    title               TEXT NOT NULL,
    body                TEXT NOT NULL DEFAULT '',
    priority            TEXT NOT NULL DEFAULT 'info',
    created_by_user_id  INTEGER NOT NULL,
    created_at          TEXT NOT NULL,
    expires_at          TEXT,
    is_active           INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);
```

### 7.17 email_queue

```sql
CREATE TABLE IF NOT EXISTS email_queue (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type       TEXT NOT NULL,
    request_id       INTEGER,
    recipient_email  TEXT NOT NULL,
    subject          TEXT NOT NULL,
    body             TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'pending',
    error_message    TEXT,
    retry_count      INTEGER NOT NULL DEFAULT 0,
    created_at       TEXT NOT NULL,
    sent_at          TEXT,
    FOREIGN KEY (request_id) REFERENCES sample_requests(id)
);
```

---

## 8. Schema Migrations (26 ALTER TABLE Statements)

All migrations are idempotent.  `init_db()` wraps each in a
try/except that catches "duplicate column name" errors and continues.

```sql
-- sample_requests extensions
ALTER TABLE sample_requests ADD COLUMN created_by_user_id INTEGER;
ALTER TABLE sample_requests ADD COLUMN sample_ref TEXT;
ALTER TABLE sample_requests ADD COLUMN originator_note TEXT NOT NULL DEFAULT '';
ALTER TABLE sample_requests ADD COLUMN submitted_to_lab_at TEXT;
ALTER TABLE sample_requests ADD COLUMN sample_submitted_at TEXT;
ALTER TABLE sample_requests ADD COLUMN sample_received_at TEXT;
ALTER TABLE sample_requests ADD COLUMN sample_dropoff_note TEXT NOT NULL DEFAULT '';
ALTER TABLE sample_requests ADD COLUMN received_by_operator_id INTEGER;
ALTER TABLE sample_requests ADD COLUMN result_confirmed_at TEXT;
ALTER TABLE sample_requests ADD COLUMN result_confirmed_by INTEGER;

-- request_attachments extensions
ALTER TABLE request_attachments ADD COLUMN note TEXT NOT NULL DEFAULT '';
ALTER TABLE request_attachments ADD COLUMN request_message_id INTEGER;

-- request_messages extensions
ALTER TABLE request_messages ADD COLUMN note_kind TEXT NOT NULL DEFAULT 'requester_note';

-- instruments extensions
ALTER TABLE instruments ADD COLUMN office_info TEXT NOT NULL DEFAULT '';
ALTER TABLE instruments ADD COLUMN faculty_group TEXT NOT NULL DEFAULT '';
ALTER TABLE instruments ADD COLUMN manufacturer TEXT NOT NULL DEFAULT '';
ALTER TABLE instruments ADD COLUMN model_number TEXT NOT NULL DEFAULT '';
ALTER TABLE instruments ADD COLUMN capabilities_summary TEXT NOT NULL DEFAULT '';
ALTER TABLE instruments ADD COLUMN machine_photo_url TEXT NOT NULL DEFAULT '';
ALTER TABLE instruments ADD COLUMN reference_links TEXT NOT NULL DEFAULT '';
ALTER TABLE instruments ADD COLUMN instrument_description TEXT NOT NULL DEFAULT '';
ALTER TABLE instruments ADD COLUMN accepting_requests INTEGER NOT NULL DEFAULT 1;
ALTER TABLE instruments ADD COLUMN soft_accept_enabled INTEGER NOT NULL DEFAULT 0;

-- users extensions
ALTER TABLE users ADD COLUMN last_notification_check TEXT DEFAULT '1970-01-01T00:00:00';
ALTER TABLE users ADD COLUMN email_preferences TEXT;

-- instrument_downtime extensions
ALTER TABLE instrument_downtime ADD COLUMN downtime_type TEXT NOT NULL DEFAULT 'maintenance';
```

---

## 9. Route Map (55 Endpoints)

### 9.1 Page Routes (32)

| URL Pattern                                     | Methods    | Function                    | Purpose                                          |
|-------------------------------------------------|------------|-----------------------------|--------------------------------------------------|
| `/`                                             | GET        | `index()`                   | Dashboard: instrument counts, open/completed, queue |
| `/login`                                        | GET, POST  | `login()`                   | Authentication form                               |
| `/logout`                                       | GET        | `logout()`                  | Clear session                                     |
| `/activate`                                     | GET, POST  | `activate()`                | Invited user activation form                      |
| `/instruments`                                  | GET, POST  | `instruments()`             | Instrument catalog and management                 |
| `/instruments/<id>`                             | GET, POST  | `instrument_detail()`       | Single instrument: info, admins, operators        |
| `/instruments/<id>/config`                      | GET, POST  | `instrument_config()`       | Settings, approval chain editor                   |
| `/instruments/<id>/history`                     | GET        | `instrument_history()`      | Request history for one instrument                |
| `/instruments/<id>/calendar`                    | GET        | `instrument_calendar()`     | Calendar filtered to one instrument               |
| `/requests/new`                                 | GET, POST  | `new_request()`             | Create sample request                             |
| `/requests/<id>`                                | GET, POST  | `request_detail()`          | Full request card with all actions                |
| `/requests/<id>/duplicate`                      | GET        | `duplicate_request()`       | Pre-fill new request from existing                |
| `/requests/<id>/quick-receive`                  | POST       | `quick_receive_request()`   | Mark sample as received                           |
| `/pending`                                      | GET        | `pending_review()`          | Card-viewer for pending approvals                 |
| `/pending/<idx>`                                | GET        | `pending_review()`          | Card-viewer at specific index                     |
| `/admin/budgets`                                | GET        | `admin_budgets()`           | Budget management (stub, redirects to index)      |
| `/schedule`                                     | GET        | `schedule()`                | Queue management with filters                     |
| `/schedule/actions`                             | POST       | `schedule_actions()`        | Bulk status changes, operator assignment          |
| `/calendar`                                     | GET, POST  | `calendar()`                | Interactive calendar view                         |
| `/calendar/events`                              | GET        | `calendar_events()`         | JSON events for calendar widget                   |
| `/stats`                                        | GET        | `stats()`                   | Statistics dashboard                              |
| `/visualizations`                               | GET        | `visualizations()`          | Data visualization page                           |
| `/visualizations/instrument/<id>`               | GET        | `instrument_visualization()`| Per-instrument charts                             |
| `/visualizations/group/<name>`                  | GET        | `group_visualization()`     | Per-group charts                                  |
| `/sitemap`                                      | GET        | `sitemap()`                 | Navigation map                                    |
| `/users/<id>`                                   | GET, POST  | `user_profile()`            | User profile and request history                  |
| `/users/<id>/history`                           | GET        | `user_history()`            | User audit log (super_admin)                      |
| `/admin/users`                                  | GET, POST  | `admin_users()`             | User management (create, invite, deactivate)      |
| `/my/history`                                   | GET        | `my_history()`              | Redirect to own schedule view                     |
| `/me`                                           | GET        | `my_profile()`              | Redirect to own profile                           |
| `/history/processed`                            | GET        | `processed_history()`       | Redirect to completed requests                    |
| `/profile/email-preferences`                    | GET, POST  | `email_preferences()`       | Email notification toggles                        |
| `/profile/change-password`                      | GET, POST  | `change_password()`         | Self-service password change                      |
| `/demo/switch/<role_key>`                       | GET        | `demo_switch_role()`        | Switch demo role (development only)               |

### 9.2 API Endpoints (15)

| URL Pattern                           | Methods | Function                      | Auth Required | Purpose                              |
|---------------------------------------|---------|-------------------------------|---------------|--------------------------------------|
| `/api/notif-count`                    | GET     | `api_notif_count()`           | Yes           | Unread notification count (JSON)     |
| `/api/notif-mark-read`               | POST    | `api_notif_mark_read()`       | Yes           | Mark notifications as read           |
| `/api/process-email-queue`           | POST    | `api_process_email_queue()`   | Admin         | Trigger email queue batch processing |
| `/api/operator-workload`             | GET     | `api_operator_workload()`     | Admin         | Workload stats per operator          |
| `/api/instrument-utilization`        | GET     | `api_instrument_utilization()`| Admin         | Utilization metrics per instrument   |
| `/api/turnaround-stats`             | GET     | `api_turnaround_stats()`      | Admin         | Turnaround time percentiles          |
| `/api/sparkline/<id>`               | GET     | `api_sparkline()`             | Yes           | 30-day activity sparkline data       |
| `/api/audit-search`                 | GET     | `api_audit_search()`          | Admin         | Search/filter audit logs             |
| `/api/audit-export`                 | GET     | `api_audit_export()`          | Admin         | Download audit logs as CSV           |
| `/api/announcements`                | GET,POST| `api_announcements()`         | Yes/Admin     | List or create announcements         |
| `/api/announcements/<id>/dismiss`   | POST    | `api_dismiss_announcement()`  | Admin         | Deactivate an announcement           |
| `/api/bulk-action`                  | POST    | `api_bulk_action()`           | Admin         | Bulk cancel/reject/mark_received     |
| `/api/db-backup`                    | POST    | `api_db_backup()`             | Admin         | Create timestamped database backup   |
| `/api/health-check`                 | GET     | `api_health_check()`          | No            | Uptime monitoring endpoint           |
| `/api/compile-check`                | POST    | `api_compile_check()`         | Admin         | Run py_compile on app.py             |

### 9.3 File Serving Endpoints (3)

| URL Pattern                             | Methods | Function                       | Purpose                           |
|-----------------------------------------|---------|--------------------------------|-----------------------------------|
| `/attachments/<id>/download`            | GET     | `download_attachment()`        | Download file attachment          |
| `/attachments/<id>/view`                | GET     | `view_attachment()`            | Inline view in browser            |
| `/exports/<filename>`                   | GET     | `download_export()`            | Download generated Excel export   |

### 9.4 Export Generation (2)

| URL Pattern                  | Methods | Function                          | Purpose                        |
|------------------------------|---------|-----------------------------------|--------------------------------|
| `/exports/generate`          | POST    | `generate_export()`               | Generate Excel request report  |
| `/visualizations/export`     | POST    | `generate_visualization_export()` | Generate Excel stats report    |

---

## 10. Template Architecture (27 Files)

### 10.1 Template Inheritance

All page templates extend `base.html`.  The inheritance chain is:

```
base.html
├── dashboard.html
├── instruments.html
├── instrument_detail.html
├── instrument_config.html
├── new_request.html
├── request_detail.html
├── schedule.html
├── calendar.html
├── stats.html
├── visualization.html
├── sitemap.html
├── login.html
├── activate.html
├── users.html
├── user_detail.html
├── pending.html
├── finance.html
├── budgets.html
├── notifications.html
├── email_preferences.html
├── change_password.html
└── error.html
```

### 10.2 Macro Libraries

**`_page_macros.html`** — 4 macros:

- `paginated_pane(pane_id, page_size, max_height, css_class)` — wraps
  a `<table>` in a scrollable, paginated, resizable container.  Requires
  the table body to have `id="{pane_id}Body"`.
- `bounded_pane(...)` — identical to `paginated_pane`; used in finance,
  pending, notifications, and budgets templates.
- `page_intro(kicker, title, hint)` — section header card with optional
  action slot (via `{% call %}`).
- `card_heading(kicker, title, hint)` — in-card heading with action slot.

**`_request_macros.html`** — 8 macros for rendering request card
components (status badges, detail grids, action buttons, message threads).

**`_stream_macros.html`** — 2 macros for rendering queue/stream table rows.

### 10.3 base.html Structure

```
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="static/styles.css">
  <script>/* Theme initialization from localStorage */</script>
</head>
<body>
  <header class="topbar">          <!-- Brand, user info, theme toggle, notif badge, logout -->
  <nav class="nav">                <!-- Role-dependent navigation links -->
  <main class="page">
    {% block content %}{% endblock %}
  </main>
  <script>/* PaginatedPane engine */</script>
  <script>/* Theme toggle + notification badge polling (60s) */</script>
</body>
</html>
```

---

## 11. StreamQuery: Composable SQL Builder

`StreamQuery` is the central query abstraction.  It builds SELECT
statements via a fluent API without hiding the SQL.

### 11.1 Class Definition

```python
class StreamQuery:
    def __init__(self, label: str)
    def source(self, table: str, alias: str) -> StreamQuery
    def join(self, table: str, alias: str, on: str) -> StreamQuery
    def columns(self, *cols: str) -> StreamQuery
    def where(self, clause: str, *params) -> StreamQuery
    def scope_raw(self, clauses: list[str], params: list) -> StreamQuery
    def apply_filters(self, filter_specs: list[_FilterSpec]) -> StreamQuery
    def group_by(self, *cols: str) -> StreamQuery
    def order(self, clause: str) -> StreamQuery
    def build(self) -> tuple[str, list]
    def fetch_all(self) -> list[sqlite3.Row]
    def fetch_one(self) -> sqlite3.Row | None
```

### 11.2 Filter Spec Classes

```python
class _FilterSpec:       # Abstract base
class ExactFilter:       # WHERE col = ?
class InFilter:          # WHERE col IN (?, ?, ...)
class SearchFilter:      # WHERE (col1 LIKE ? OR col2 LIKE ? OR ...)
class DateGteFilter:     # WHERE col >= ?
class DateLteFilter:     # WHERE col <= ?
```

Each filter reads its value from `request.args` (Flask query params).

### 11.3 Pre-configured Factory

```python
def request_stream(user, filters=None) -> StreamQuery
```

Returns a StreamQuery pre-configured with a 6-table JOIN chain:

```sql
FROM sample_requests sr
JOIN instruments i ON i.id = sr.instrument_id
JOIN users r ON r.id = sr.requester_id
LEFT JOIN users op ON op.id = sr.assigned_operator_id
LEFT JOIN users recv ON recv.id = sr.received_by_operator_id
LEFT JOIN users creator ON creator.id = sr.created_by_user_id
```

Scope is automatically applied based on the user's role via
`request_scope_sql(user, alias)`.

---

## 12. Context Processor: Injected Template Variables

The `@app.context_processor` function `inject_globals()` injects 27
variables into every template render.  These fall into three categories:

**User state:** `current_user`, `access_profile_user`, `is_owner_user`,
`unread_notification_count_user`.

**Permission flags:** `can_manage_members_user`, `can_use_role_switcher_user`,
`can_access_schedule_user`, `can_access_calendar_user`, `can_access_stats_user`,
`has_instrument_area_access_user`.

**Helper functions:** `request_display_status`, `request_status_group`,
`request_status_summary`, `request_lifecycle_steps`, `format_dt`,
`format_date`, `format_duration_short`, `format_duration_days`,
`instrument_intake_mode`, `intake_mode_label`, `instrument_photo_src`,
`approval_pill_chain`, `support_admin_email`, `timedelta`.

**Lambda accessors:** `can_open_instrument_detail_id_user(id)`,
`can_view_user_profile_id_user(id)`, `request_card_policy_user(request)`,
`request_card_can_view_field_user(request, field)`.

---

## 13. Approval Workflow Engine

Each instrument may have a configurable multi-step approval chain stored
in `instrument_approval_config`.  When a request is submitted for that
instrument, `approval_steps` rows are created matching the config.

### 13.1 Configuration

The `/instruments/<id>/config` route allows instrument admins to:

1. **Add steps:** POST `action=add_approval_step` with `approver_role`
   and optional `approver_user_id`.  `step_order` is auto-incremented.
2. **Remove steps:** POST `action=remove_approval_step` with `step_id`.
   Remaining steps are re-ordered to eliminate gaps.
3. **Update settings:** POST `action=update_settings` for instrument
   metadata fields.

### 13.2 Visualization

`approval_pill_chain(approval_steps)` returns a list of pill descriptors:

```python
{
    "role": "professor_approver",
    "label": "Professor Approver",
    "status": "approved",        # pending | approved | rejected
    "acted_at": "2026-04-07T14:30:00",
    "approver_name": "Dr. Smith",
    "css_class": "pill-approved"  # pill-pending | pill-approved | pill-rejected
}
```

---

## 14. Email Queue Subsystem

### 14.1 Event Templates

```python
EMAIL_EVENT_TEMPLATES = {
    "status_changed":    { "subject": "Request {request_no} status: {new_status}",
                           "body": "..." },
    "request_cancelled": { "subject": "Request {request_no} cancelled",
                           "body": "..." },
    "results_confirmed": { "subject": "Results confirmed: {request_no}",
                           "body": "..." },
    "approval_needed":   { "subject": "Approval needed: {request_no}",
                           "body": "..." },
}
```

### 14.2 Queue API

```python
def queue_email_notification(event_type, request_id, recipient_email, context) -> int | None
```

Formats the template with `context` dict and inserts a row into
`email_queue` with `status='pending'`.  Returns the new row ID.

```python
def process_email_queue(batch_size=10) -> int
```

Fetches up to `batch_size` pending emails, attempts SMTP delivery via
`smtplib`, and updates each row to `status='sent'` or `status='failed'`
with `error_message`.  Returns the count of successfully sent emails.

Triggered by POST to `/api/process-email-queue` (admin only).

### 14.3 User Preferences

Email preferences are stored as JSON in `users.email_preferences`:

```json
{"status_changed": true, "request_cancelled": false, "results_confirmed": true, "approval_needed": true}
```

`queue_email_notification` should check these preferences before inserting
(currently does not — see Known Bugs).

---

## 15. Audit Trail with Hash Chain

### 15.1 Logging

```python
def log_audit(entity_type, entity_id, action, actor_id=None, payload=None)
```

Computes `entry_hash = SHA-256(prev_hash + entity_type + entity_id + action + payload_json + created_at)` and inserts into `audit_logs`.

### 15.2 Verification

The hash chain can be verified by reading all rows in order and
recomputing each `entry_hash` from the previous row's hash.  Any
mismatch indicates tampering.

### 15.3 Search and Export

- `/api/audit-search` — accepts `entity_type`, `entity_id`, `action`,
  `actor_id`, `date_from`, `date_to`, `limit`, `offset`.  Returns
  paginated results with total count.
- `/api/audit-export` — downloads the full audit log as CSV.

---

## 16. File Upload and Attachment System

### 16.1 Storage Layout

```
uploads/
└── instruments/
    └── {instrument_id}/
        └── requests/
            └── {request_id}/
                └── {stored_filename}
```

`stored_filename` = `secure_filename(original)` with a UUID prefix to
prevent collisions.

### 16.2 Allowed Extensions

`{pdf, png, jpg, jpeg, xlsx, csv, txt}`

### 16.3 Post-Completion Uploads

After a request reaches `completed`, only users with roles in
`POST_COMPLETION_UPLOAD_ROLES = {super_admin, instrument_admin, operator}`
may upload additional attachments (e.g., result files).

---

## 17. Communication Channel (Request Messages)

### 17.1 Note Kinds

| Kind             | Label            | Description                                      |
|------------------|------------------|--------------------------------------------------|
| `requester_note` | Requester Note   | Question or clarification from the submitter      |
| `lab_reply`      | Lab Reply        | Single reply from the lab side for coordination   |
| `operator_note`  | Operator Note    | Operational note from operator or instrument admin |
| `final_note`     | Final Note       | Final handoff note shared with the requester       |

### 17.2 Message-Attachment Binding

Each `request_messages` row may have one or more `request_attachments`
linked via `request_message_id`.  This allows file uploads within the
conversation thread.

---

## 18. Notification System

### 18.1 Unread Count

```python
def unread_notification_count(user) -> int
```

Queries `audit_logs` for entries after the user's `last_notification_check`
timestamp, filtered by role-appropriate entity types.  Returns
`min(count, 99)`.

### 18.2 Client-Side Polling

`base.html` includes a `setInterval` that calls `/api/notif-count` every
60 seconds and updates the badge in the header.  The badge shows the count
or "99+" and hides when count is 0.

### 18.3 Mark as Read

POST to `/api/notif-mark-read` sets the user's `last_notification_check`
to the current UTC timestamp.

---

## 19. Compile Safeguards

### 19.1 Pre-Flight Check

```python
COMPILE_TIMEOUT_SECONDS = 10

def safe_compile_check(file_path=None, timeout=None) -> dict:
    result = subprocess.run(
        [sys.executable, "-m", "py_compile", target],
        capture_output=True, text=True, timeout=timeout,
    )
    return {"ok": bool, "elapsed": float, "error": str | None}
```

### 19.2 Startup Guard

```python
if __name__ == "__main__":
    check = safe_compile_check()
    if not check["ok"]:
        print(f"[SAFEGUARD] COMPILE FAILED — {check['error']}")
        sys.exit(1)
    init_db()
    app.run(debug=False, port=5055)
```

### 19.3 Test Suite

`test_safeguards.py` contains 5 tests:

1. `test_compile_ok` — app.py compiles within 10s threshold
2. `test_bad_file_detected` — syntax errors are caught, not hung on
3. `test_line_count_sane` — file is between 5000–15000 lines
4. `test_key_functions_present` — 13 critical functions/constants exist
5. `test_no_import_hangs` — module spec loads in under 5s

Run: `python3 test_safeguards.py` — exit code 0 means all pass.

---

## 20. Client-Side Architecture

### 20.1 Theme System

Dark/light theme stored in `localStorage["labTheme"]`.  Falls back to
`prefers-color-scheme` media query.  Toggle button in header swaps
`data-theme` attribute on `<html>`.  CSS uses `var(--color-*)` custom
properties scoped by `[data-theme="dark"]` and `[data-theme="light"]`.

### 20.2 PaginatedPane Engine

`window.PaginatedPane` is a self-contained pagination system defined in
`base.html`.  Any element with `data-pane-id` and `data-page-size`
attributes is automatically initialized on `DOMContentLoaded`.

Features: drag-to-resize handle, saved heights in localStorage,
prev/next pagination, automatic page count recalculation on filter
changes.

### 20.3 Print CSS

`@media print` rules in `styles.css`: hide nav, actions, and interactive
elements; reset backgrounds to white; format tables with visible borders;
display URLs after links.

---

## 21. Configuration and Environment Variables

| Variable        | Default           | Purpose                                      |
|-----------------|-------------------|----------------------------------------------|
| `OWNER_EMAILS`  | `admin@lab.local` | Comma-separated emails with owner bypass      |
| `SECRET_KEY`    | (random)          | Flask session encryption key                  |
| `SMTP_HOST`     | (none)            | SMTP server for email queue                   |
| `SMTP_PORT`     | `587`             | SMTP port                                     |
| `SMTP_USER`     | (none)            | SMTP authentication user                      |
| `SMTP_PASSWORD`  | (none)            | SMTP authentication password                  |
| `FLASK_RUN_PORT`| `5055`            | Server listen port                            |

---

## 22. Known Bugs and Design Gaps

1. **Email preferences not enforced.** `queue_email_notification()` does
   not check `users.email_preferences` before inserting into the queue.
   All recipients receive all event types regardless of preference settings.

2. **Rate limiting defined but not applied.** The `rate_limit_tracking`
   table exists and is created on init, but no route currently uses a
   rate-limiting decorator.  The decorator was removed as dead code; the
   table remains for future use.

3. **`data-vis` sends all data to browser.** Role-visibility is
   client-side only.  A technically sophisticated user can inspect the DOM
   and see all data regardless of their role.  Server-side filtering would
   require restructuring every template.

4. **No CSRF protection.** Forms use POST but do not include CSRF tokens.
   Flask-WTF or a manual token system should be added.

5. **SQLite single-writer limitation.** Under concurrent load, SQLite's
   single-writer lock may cause "database is locked" errors.  This is
   acceptable for the expected user count (<50 concurrent) but would
   require migration to PostgreSQL for larger deployments.

6. **`admin_budgets` route is a stub.** It redirects to `index()`.  The
   `budgets.html` and `finance.html` templates exist with full UI, but
   no backing data model or routes for budget CRUD operations are
   implemented.

7. **No password recovery flow.** Users can change passwords if logged in
   (`/profile/change-password`) but there is no "forgot password" or
   email-based reset mechanism.

8. **Notification count query scans audit_logs.** For large audit tables,
   `unread_notification_count()` may become slow.  An index on
   `(created_at, entity_type)` would help.

9. **Export files accumulate.** Generated Excel files in `exports/` are
   never cleaned up automatically.  A periodic cleanup job should remove
   files older than N days.

10. **No input sanitization for XSS.** Jinja2 auto-escapes by default,
    but `|safe` filters or `Markup()` calls could introduce XSS if used
    carelessly.  A Content Security Policy header should be added.

---

## 23. Future Modules with Time Estimates

| Module                                 | Estimated Effort | Description                                                         |
|----------------------------------------|------------------|---------------------------------------------------------------------|
| CSRF Token Protection                  | 2–3 hours        | Add Flask-WTF or manual token to all POST forms                     |
| Server-Side Role Filtering             | 8–12 hours       | Replace client-side `data-vis` with server-side template conditionals |
| Budget CRUD and Finance Workflow       | 6–8 hours        | Full budget model, allocation tracking, finance approval pipeline    |
| Password Reset via Email               | 3–4 hours        | Token-based forgot-password flow with email delivery                 |
| Rate Limiting on Sensitive Routes      | 1–2 hours        | Apply rate-limit decorator to login, new_request, API endpoints      |
| Email Preference Enforcement           | 1 hour           | Check `email_preferences` JSON before queueing emails                |
| Audit Log Indexing                     | 1 hour           | Add composite index on `(created_at, entity_type)` for performance   |
| Export Cleanup Cron Job                | 1–2 hours        | Scheduled deletion of old export files                               |
| Content Security Policy Headers        | 1 hour           | Add CSP via Flask `after_request` hook                               |
| Instrument Booking / Calendar Slots    | 10–15 hours      | Time-slot reservation system with conflict detection                  |
| External User (Guest) Access           | 4–6 hours        | Limited access for external researchers submitting samples            |
| Dashboard Analytics Widgets            | 6–8 hours        | Chart.js or D3 visualizations embedded in dashboard                  |
| Bulk Import (CSV → Instruments/Users)  | 4–5 hours        | Upload CSV to create instruments or invite users in batch             |
| Mobile-Responsive Layout Overhaul      | 8–10 hours       | Responsive CSS for phone/tablet breakpoints                          |
| PostgreSQL Migration                   | 6–10 hours       | Replace SQLite with PostgreSQL for concurrent multi-user production   |
| REST API Formalization                 | 8–12 hours       | OpenAPI/Swagger spec, versioned endpoints, token auth                 |
| Automated Test Suite                   | 10–15 hours      | pytest with Flask test client, covering all routes and edge cases     |
| Webhook/Integration Layer              | 4–6 hours        | POST event notifications to external systems (Slack, Teams, etc.)    |
| Document Generation (PDF Reports)      | 4–5 hours        | Generate PDF reports for completed requests with results summary      |
| Multi-Language Support (i18n)          | 10–15 hours      | Flask-Babel integration for Hindi/Marathi/English                    |

---

## Appendix A: Git History (Abridged)

```
32777e1  Formal README rewrite: remove agent logs, add API docs + architecture patterns
61b20a0  Wave I: notification badge UI, email preferences route, JS polling
8334d90  Add compile safeguards with timeout thresholds + test suite
02ba15e  Waves G+H: downtime types, duplication, sparklines, print CSS, audit export,
         bulk actions, announcements, password reset, DB backup
d821b2b  Wave F: operator efficiency, audit search, reporting APIs
3f5e8ea  Wave E: instrument config panel, email wiring, approval chain editor
b7b122d  Wave D: cancellation, result confirmation, email queue, approval pills
e3345b9  Wave C: rate limiting, request cancellation, notification badge
43d9b97  Wave B: data-vis 100% coverage across all 24+ templates
68196cb  Wave A: Refactor all query sites to StreamQuery
d3cb2d7  Wave A: Insert StreamQuery infrastructure (classes + factories)
```

## Appendix B: Module-Level Constants

```python
BASE_DIR                   = Path(__file__).resolve().parent
DB_PATH                    = BASE_DIR / "lab_scheduler.db"
EXPORT_DIR                 = BASE_DIR / "exports"
UPLOAD_DIR                 = BASE_DIR / "uploads"
STATIC_DIR                 = BASE_DIR / "static"
INSTRUMENT_IMAGE_DIR       = STATIC_DIR / "instrument_images"
ALLOWED_EXTENSIONS         = {"pdf", "png", "jpg", "jpeg", "xlsx", "csv", "txt"}
POST_COMPLETION_UPLOAD_ROLES = {"super_admin", "instrument_admin", "operator"}
COMPILE_TIMEOUT_SECONDS    = 10
STARTUP_TIMEOUT_SECONDS    = 30
REQUEST_SEARCH_COLUMNS     = ["sr.request_no", "sr.sample_ref", "sr.sample_name",
                              "r.name", "r.email", "i.name"]
OWNER_EMAILS               = {env OWNER_EMAILS or "admin@lab.local", split by comma}
```

## Appendix C: Communication Note Types

```python
COMMUNICATION_NOTE_TYPES = [
    ("requester_note", "Requester Note",
     "Question or clarification from the submitting member."),
    ("lab_reply", "Lab Reply",
     "Single reply from the lab side for coordination."),
    ("operator_note", "Operator Note",
     "Operational note from the operator or instrument admin."),
    ("final_note", "Final Note",
     "Final handoff note shared with the requester."),
]
```

## Appendix D: Demo Role Switcher

For development, the application provides a role-switcher at
`/demo/switch/<role_key>`.  This logs the current user out and logs in
as the demo user for the selected role.

```python
DEMO_ROLE_SWITCHES = {
    "owner":            {"label": "Owner",            "email": "admin@lab.local"},
    "super_admin":      {"label": "Super Admin",      "email": "dean@lab.local"},
    "instrument_admin": {"label": "Instrument Admin", "email": "fesem.admin@lab.local"},
    "faculty_in_charge":{"label": "Faculty In-Charge", "email": "sen@lab.local"},
    "operator":         {"label": "Operator",         "email": "anika@lab.local"},
    "member":           {"label": "Member",           "email": "shah@lab.local"},
    "finance":          {"label": "Finance",          "email": "finance@lab.local"},
    "professor":        {"label": "Professor",        "email": "prof.approver@lab.local"},
}
```

---

*End of reconstruction manual.*
