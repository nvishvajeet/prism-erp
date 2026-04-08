<!-- README.md — PRISM. AI agents: do not edit without owner approval. -->

# PRISM — Platform for Research Infrastructure Management

A request-tracking and operator-workflow system for MIT-WPU's
Department of Research & Development. One Python process, one
SQLite database, browser-based interface.

This file is the single authoritative reference for the project.
A competent developer reading only this file must be able to
reconstruct a functionally identical system.

---

## 1. Philosophy

**The Request Card.**  Every sample request is a card.  The card is
created when a requester submits a job and accumulates all data over
its lifetime: approvals, notes, files, operator actions, timestamps,
results.  Nothing is stored separately — the card is the single source
of truth for that job.

**Sliced visibility.**  The same cards form a single queue.  Every
page on the site is a filtered, role-appropriate slice of that queue.
The Queue page is the canonical view; the Home dashboard, Instrument
detail, Calendar, and Statistics pages are derived views.  There is no
data duplication between pages.

**Blobs within blobs.**  Every visual element on a page is a panel
(blob).  Panels contain sub-panels.  Each panel has a role-visibility
attribute: if the user's role is not in the panel's allowed set, the
panel is not rendered.  This applies uniformly to every element — page
sections, card fields, action buttons, navigation items.  There are no
exposed hyperlinks; navigation is through buttons and panel actions.

**LAN-first.**  This is a lightweight internal tool.  It runs on a
single machine on the local network.  There is no cloud dependency, no
external authentication provider, no CDN.  The design favours
simplicity and maintainability.

---

## 2. Technology

| Component   | Choice                                  |
|-------------|-----------------------------------------|
| Language    | Python 3.10+                            |
| Framework   | Flask (single file: `app.py`)           |
| Database    | SQLite (`lab_scheduler.db`, git-ignored) |
| Templates   | Jinja2                                  |
| Styles      | Single CSS file (`static/styles.css`)   |
| JavaScript  | Vanilla JS, FullCalendar for calendar   |
| Server      | Flask dev server, port 5055             |

No external Python packages beyond Flask and its dependencies.
No build step.  No bundler.  No transpiler.

---

## 3. User Roles

Roles are hierarchical.  A higher role inherits all capabilities of
lower roles unless otherwise noted.

| Role                | Scope         | Purpose                                |
|---------------------|---------------|----------------------------------------|
| `requester`         | Own cards     | Submit requests, track own jobs        |
| `finance_admin`     | Finance steps | Approve/reject finance approval steps  |
| `professor_approver`| All cards     | Approve/reject faculty approval steps  |
| `faculty_in_charge` | Assigned instruments | Faculty oversight of specific instruments |
| `operator`          | Assigned instruments | Run instruments, receive samples, complete jobs |
| `instrument_admin`  | Assigned instruments | Manage instrument settings, operators, approval chains |
| `site_admin`        | All           | Full operational access, no user management |
| `super_admin`       | All           | Full access including user management  |

Owner status is determined by email match against the `OWNER_EMAILS`
environment variable, not by role.  Owners bypass all restrictions.

### Visibility Matrix

Every UI element checks the user's role before rendering.  The
`card_policy` object (computed per request, per user) contains two
sets:

- `card_policy.fields` — which data fields are visible (instrument,
  requester identity, operator identity, remarks, results, events,
  conversation, submitted documents, finance details).

- `card_policy.actions` — which action buttons are shown (approve,
  reject, mark submitted, mark received, schedule, complete, reassign,
  upload, reply, flag issue, update status).

The `user_access_profile()` function returns a dict of boolean
capabilities used by templates to show/hide navigation items, page
sections, and dashboard widgets.

---

## 4. Request Lifecycle

A card moves through these statuses in order.  Each transition is
logged in the immutable audit trail.

```
submitted
  │  (instrument accepting → auto-create approval chain)
  ▼
under_review
  │  Finance approves → Professor approves → Operator approves
  │  (any rejection → rejected)
  ▼
awaiting_sample_submission
  │  Requester marks physical sample delivered
  ▼
sample_submitted
  │  Operator confirms receipt
  ▼
sample_received
  │  Operator assigns schedule time
  ▼
scheduled
  │  Operator starts work
  ▼
in_progress
  │  Operator completes with results
  ▼
completed  (record locked)

rejected   (terminal — any approval step rejection)
```

### Approval Chain

Default sequence: Finance → Professor → Operator.  Configurable per
instrument via `instrument_approval_config`.  Steps execute in strict
order.  A step cannot be actioned until all prior steps are approved.

---

## 5. Database Schema

17 tables.  Foreign keys are enforced.

### users
`id`, `name`, `email`, `password_hash`, `role`, `invited_by`,
`invite_status` (active|invited), `active` (0|1).

### instruments
`id`, `name`, `code` (unique), `category`, `location`,
`daily_capacity`, `status` (active|archived), `notes`, `office_info`,
`faculty_group`, `manufacturer`, `model_number`,
`capabilities_summary`, `machine_photo_url`, `reference_links`,
`instrument_description`, `accepting_requests` (0|1),
`soft_accept_enabled` (0|1).

### instrument_admins
`user_id`, `instrument_id`.  Junction table.

### instrument_operators
`user_id`, `instrument_id`.  Junction table.

### instrument_faculty_admins
`user_id`, `instrument_id`.  Junction table.

### sample_requests
`id`, `request_no`, `sample_ref`, `requester_id`,
`created_by_user_id`, `originator_note`, `instrument_id`, `title`,
`sample_name`, `sample_count`, `description`, `sample_origin`
(internal|external), `receipt_number`, `amount_due`, `amount_paid`,
`finance_status`, `priority`, `status`, `submitted_to_lab_at`,
`sample_submitted_at`, `sample_received_at`, `sample_dropoff_note`,
`received_by_operator_id`, `assigned_operator_id`, `scheduled_for`,
`remarks`, `results_summary`, `result_email_status`,
`result_email_sent_at`, `completion_locked` (0|1), `created_at`,
`updated_at`, `completed_at`.

### approval_steps
`id`, `sample_request_id`, `step_order`, `approver_role`
(finance|professor|operator), `approver_user_id`, `status`
(pending|approved|rejected), `remarks`, `acted_at`.

### request_messages
`id`, `request_id`, `sender_user_id`, `note_kind`
(requester_note|lab_reply|operator_note|final_note), `message_body`,
`created_at`, `is_active`.

### request_attachments
`id`, `request_id`, `user_id`, `instrument_id`,
`original_filename`, `stored_filename`, `relative_path`,
`file_extension`, `mime_type`, `file_size`, `uploaded_by_user_id`,
`uploaded_at`, `attachment_type`
(request_document|sample_slip|result_document|invoice|other), `note`,
`is_active`, `request_message_id`.

### request_issues
`id`, `request_id`, `created_by_user_id`, `issue_message`,
`response_message`, `status` (open|responded|resolved), `created_at`,
`responded_at`, `responded_by_user_id`, `resolved_at`,
`resolved_by_user_id`.

### instrument_downtime
`id`, `instrument_id`, `start_time`, `end_time`, `reason`,
`created_by_user_id`, `created_at`, `is_active`.

### instrument_approval_config
`id`, `instrument_id`, `step_order`, `approver_role`,
`approver_user_id`.

### audit_logs
`id`, `entity_type`, `entity_id`, `action`, `actor_id`,
`payload_json`, `prev_hash`, `entry_hash`, `created_at`.

### announcements
`id`, `content`, `actor_id`, `created_at`, `is_active`.


### generated_exports
`id`, `filename`, `created_by_user_id`, `created_at`, `scope_label`.

### access_tags
`id`, `tag_type`, `tag_value`, `description`.
Defines named access scopes (e.g. department, lab, facility, area).

### user_access_tags
`user_id`, `tag_id`.  Junction table linking users to access tags.

### instrument_access_tags
`instrument_id`, `tag_id`.  Junction table linking instruments to access
tags.  When an instrument has tags, only users sharing at least one tag
can access it.  No tags = unrestricted (backward-compatible).

---

## 6. Page Map

| Route                              | Template                 | Auth        | Purpose                              |
|------------------------------------|--------------------------|-------------|--------------------------------------|
| `GET /`                            | `dashboard.html`         | login       | Home: stats, instrument queues       |
| `GET /instruments`                 | `instruments.html`       | login       | List instruments by category         |
| `POST /instruments`                | —                        | admin       | Create instrument                    |
| `GET /instruments/<id>`            | `instrument_detail.html` | login       | Instrument dashboard, queue, config  |
| `POST /instruments/<id>`           | —                        | admin       | Update instrument settings           |
| `GET /instruments/<id>/history`    | redirect → `/schedule`   | login       | Queue filtered by instrument         |
| `GET /instruments/<id>/calendar`   | redirect → `/calendar`   | login       | Calendar filtered by instrument      |
| `GET /schedule`                    | `schedule.html`          | login       | **The Queue** — central working page |
| `POST /schedule/actions`           | —                        | varies      | Quick actions from queue             |
| `GET /requests/new`                | `new_request.html`       | login       | Submit new request                   |
| `GET /requests/<id>`               | `request_detail.html`    | login       | Full card view + actions             |
| `POST /requests/<id>`              | —                        | varies      | All card actions (approve, etc.)     |
| `GET /calendar`                    | `calendar.html`          | login       | FullCalendar weekly/monthly view     |
| `GET /calendar/events`             | JSON                     | login       | AJAX event feed for calendar         |
| `GET /stats`                       | `stats.html`             | login       | Statistics dashboard                 |
| `GET /visualizations`              | `visualization.html`     | login       | Data view with export                |
| `POST /visualizations/export`      | —                        | login       | Generate Excel report                |
| `GET /me`                          | redirect                 | login       | Own profile                          |
| `GET /users/<id>`                  | `user_detail.html`       | login       | User profile                         |
| `GET /users/<id>/history`          | redirect → `/schedule`   | super_admin | Queue filtered by requester          |
| `GET /admin/users`                 | `users.html`             | super_admin | User management                      |
| `POST /admin/users`                | —                        | super_admin | Create/update users                  |
| `GET /sitemap`                     | `sitemap.html`           | login       | Navigation map                       |
| `GET /login`                       | `login.html`             | public      | Sign in                              |
| `POST /login`                      | —                        | public      | Authenticate                         |
| `GET /logout`                      | redirect                 | login       | Sign out                             |
| `GET /activate`                    | `activate.html`          | public      | Invitation activation                |
| `GET /attachments/<id>/download`   | file                     | login       | Download attachment                  |
| `GET /attachments/<id>/view`       | file                     | login       | View attachment inline               |

---

## 7. File Structure

```
Main/
├── app.py                      Single application file
├── lab_scheduler.db            SQLite database (git-ignored, auto-created)
├── README.md                   This file
├── SECURITY_TODO.md            Security hardening & HTTPS migration tracker
├── .gitignore
├── static/
│   ├── styles.css              All CSS (light + dark themes)
│   ├── instrument-placeholder.svg
│   └── instrument_images/      Uploaded instrument photos
├── templates/
│   ├── base.html               Layout: topbar, nav, theme toggle, JS
│   ├── _page_macros.html       Shared macros: card_heading, bounded_pane
│   ├── _request_macros.html    Card display macros: status_block, etc.
│   ├── dashboard.html
│   ├── instruments.html
│   ├── instrument_detail.html
│   ├── schedule.html           The Queue
│   ├── new_request.html
│   ├── request_detail.html     The Card
│   ├── calendar.html
│   ├── stats.html
│   ├── visualization.html
│   ├── user_detail.html
│   ├── users.html
│   ├── login.html
│   ├── activate.html
│   ├── sitemap.html
│   └── error.html
├── uploads/                    Request files (git-ignored)
│   └── users/<uid>/requests/<req>/attachments/
└── exports/                    Generated Excel reports (git-ignored)
```

---

## 8. File Upload System

Each request gets a folder:
`uploads/users/<user_id>/requests/req_<id>_<request_no>/attachments/`

Allowed extensions: pdf, png, jpg, jpeg, xlsx, csv, txt.
Maximum upload: 100 MB.
Files are served through Flask, not as direct static files.

A sample slip PDF is auto-generated on request creation and stored as
`attachment_type=sample_slip`.

A `request_metadata.json` snapshot is written to the request folder
after every meaningful state change.  It contains the complete card
state and serves as an offline backup.

---

## 9. Communication

Four note types on each card:

| Type             | Author          | Visible to     |
|------------------|-----------------|----------------|
| `requester_note` | Requester       | Lab staff      |
| `lab_reply`      | Lab staff       | Requester      |
| `operator_note`  | Operator/admin  | Lab staff only |
| `final_note`     | Operator/admin  | Requester      |

Issue tracking: flag → respond → resolve cycle, tracked in
`request_issues`.

---

## 10. Security

### Current state

- Session-based authentication, 12-hour lifetime, HttpOnly cookies.
- Passwords hashed with pbkdf2:sha256.
- All SQL uses parameterized queries.
- File uploads validated against extension whitelist.
- Immutable audit log with SHA-256 hash chain.
- Role checks on every route via `login_required` and
  `role_required` decorators.
- Field-level and action-level visibility via `card_policy`.
- Client-side `data-vis` attribute system for visual role gating
  (convenience layer — not a security boundary).
- **CSRF protection** via Flask-WTF `CSRFProtect` on all POST routes.
- **Security headers**: CSP, X-Frame-Options DENY, nosniff,
  Referrer-Policy, HSTS (conditional on HTTPS mode).
- **Tag/scope authorization tables**: `access_tags`,
  `user_access_tags`, `instrument_access_tags` for flexible
  role + scope access control.
- **HTTPS-ready cookie config**: `SESSION_COOKIE_SECURE` toggled
  by `LAB_SCHEDULER_COOKIE_SECURE` environment variable.
- See `SECURITY_TODO.md` for full deployment checklist.

### Architecture: two-layer authorization

**Layer 1 — Server-side (mandatory, enforces security).**
Every route in `app.py` checks the session user against `ROLE_ACCESS_PRESETS`
and `request_card_policy()`.  The server never renders or returns data the
user is not authorised to see.  Jinja `{% if %}` blocks gate template
sections.  This layer is the security boundary.

**Layer 2 — Client-side `data-vis` (visual uniformity, not security).**
Every HTML element carries a `data-vis="role1 role2 ..."` attribute that
declares which roles may see it.  A JS engine on page load hides elements
whose roles do not match.  This gives uniform visual structure (the
"blobs-within-blobs" philosophy).  It is never trusted as a security
mechanism — a user who inspects the DOM will only find data the server
already authorised them to have.

---

## 11. Git and Development

> **AI agents: update this section if you change repo settings.**

| Setting          | Value                                           |
|------------------|-------------------------------------------------|
| VCS              | Git — open source, no proprietary services      |
| Working repo     | `Main/`                                         |
| Local remote     | `../lab-scheduler.git` (bare repo)              |
| Default branch   | `master`                                        |
| Git user.name    | AAAA                                            |
| Git user.email   | general.goje@gmail.com                          |

Push after every commit: `git push origin master`.
Commit messages: imperative mood, ≤ 72 chars first line.
Append `Co-Authored-By:` line.
Never force-push.

To run: `cd Main/ && pip install flask && python app.py`
(starts on `http://127.0.0.1:5055`).

Debug mode: controlled at the bottom of `app.py`.  Set `True` while
developing, `False` before committing.

Editor: VS Code.  No linter enforced.

To add a cloud remote later:
`git remote add github https://github.com/<user>/lab-scheduler.git`

---

## 12. Safeguards

The application includes compile-time and runtime safeguards to
prevent deployment of broken code.

### Pre-flight Compile Check

On startup (`python3 app.py`), a subprocess-based compile check runs
with a hard timeout (`COMPILE_TIMEOUT_SECONDS = 10`). If `py_compile`
does not complete within the threshold, the subprocess is killed and
the server **refuses to start** (`sys.exit(1)`).

### Health Endpoints

`GET /api/health-check` — unauthenticated. Returns compile status,
DB probe result, app line count, and timestamp. Use for monitoring.

`POST /api/compile-check` — admin only. Triggers an on-demand compile
verification with configurable timeout (max 30s).

### Test Suite

`python3 test_safeguards.py` runs 5 tests: compile OK within threshold,
bad-file detection, line count sanity (>5000), critical function presence
(14 functions checked), and import-hang detection. All tests must pass
before deploying a new version.

### Rate Limiting

`@rate_limit(max_requests, window_seconds)` decorator backed by the
`rate_limit_tracking` table. Applied to POST routes to prevent abuse.
Old entries are garbage-collected on each request.

---

## 14. ROADMAP — Prioritised Feature Plan

> Philosophy: single global queue, event-driven audit, role-scoped views,
> `EntityManager` for all entities, `bounded_pane` pagination, `data-vis`
> gating, `StreamQuery` / `request_stream()` for all data queries.
> Every new feature reuses these patterns.

### Progress (as of 2026-04-08)

    ┌───────────────────────────────────────────────────────────┐
    │  PROGRESS PANEL — Git-verified status only               │
    │  Last updated: 2026-04-08                                │
    ├───────────────────────────────────────────────────────────┤
    │                                                           │
    │  Phase 1 — Architecture Foundation                        │
    │  ████████████████████████████  6 / 6 modules   (100%)    │
    │  StreamQuery, data-vis, filter specs, factories           │
    │                                                           │
    │  Phase 2 — Core Features                                  │
    │  ████████████████████████████  14 / 14 modules (100%)    │
    │  Rate limit, cancel, notif badge + UI + JS poll,          │
    │  email queue, result confirm, approval pills,             │
    │  config panel, chain editor, email wiring,                │
    │  email preferences page                                   │
    │                                                           │
    │  Phase 3 — Polish & Reporting                             │
    │  ████████████████████████████  13 / 13 modules (100%)    │
    │  Operator workload, audit search + CSV export,            │
    │  utilization stats, turnaround percentiles,               │
    │  downtime types + color coding, request duplication,      │
    │  print CSS, sparklines, bulk actions,                     │
    │  announcements + dismiss, DB backup, password reset       │
    │                                                           │
    │  Safeguards                                               │
    │  ████████████████████████████  5 / 5 tests     (100%)    │
    │  Compile timeout, bad-file detection, line count,         │
    │  function presence, import hang check                     │
    │                                                           │
    │  OVERALL: 33 / 33 modules  (100%)                        │
    │  ████████████████████████████████████████████████████████ │
    │                                                           │
    │  SYSTEM READY FOR ON-DEVICE TESTING                      │
    │                                                           │
    └───────────────────────────────────────────────────────────┘

    GIT-VERIFIED WAVES (only code confirmed in git counts):
      Wave A — StreamQuery classes + factories + 3 call sites      [68196cb]
      Wave B — data-vis 100% across 24+ templates                  [43d9b97]
      Wave C — rate_limit + cancelled status + notification badge  [e3345b9]
      Wave D — cancel route + result confirm + email queue + pills [b7b122d]
      Wave E — instrument config + chain CRUD + email wiring       [3f5e8ea]
      Wave F — operator workload + utilization + turnaround + audit [d821b2b]
      Wave G+H — downtime types, duplication, sparklines, print CSS,
                 audit export, bulk actions, announcements, backup,
                 password reset                                    [02ba15e]
      Safeguards — compile timeout + test suite (5/5 pass)         [8334d90]
      Wave I — notif badge UI + JS poll + email preferences        [61b20a0]

    VERIFIED:
      app.py syntax: OK (6995 lines, py_compile clean)
      Safeguard tests: 5/5 pass (compile 0.06s, threshold 10s)
      CSS: balanced (styles.css + print @media rules)
      Jinja blocks: all balanced (smart parser confirmed)
      Flask not available in sandbox — needs on-device test

    DEPLOYMENT: Run `python3 app.py` on target machine. Pre-flight
    compile check runs automatically. If it fails, server refuses to start.

### Execution Model

    Phase  →  Wave  →  Module  (each module ≈ 20 min)

Modules within a **wave** run in **parallel** (separate agents,
separate files). A wave finishes when all its agents report back.
The next wave starts only after the previous wave merges clean.

Key constraint: `app.py` is a single 7600-line file — only ONE
agent may edit it per wave. Template files are separate so multiple
template agents can run concurrently.

### Size Legend

- **S** = small, < 50 lines changed, < 20 min (1 module)
- **M** = medium, 50-200 lines, 20-40 min (1-2 modules)
- **L** = large, 200+ lines or external dependencies, 40-60 min (2-3 modules)

---

## Phase 1 — Architecture Foundation

*Every file brought to a uniform standard. No feature work until
Phase 1 is green.*

### Wave A (sequential — completed, git: d3cb2d7 + 68196cb)

| Module | File(s) | Task | Status |
|--------|---------|------|--------|
| 1.1.1 | app.py | Insert `StreamQuery` class, filter specs, constants | Done |
| 1.1.2 | app.py | Insert `request_stream()` + `stats_stream()` factories | Done |
| 1.1.3 | app.py | Refactor all 3 call sites. Delete `request_history_query()` + `processed_history_query_parts()`. | Done |

### Wave B (parallel — 3 agents, git: 43d9b97)

Templates only — no app.py conflicts.

| Agent | Module | File(s) | Task | Status |
|-------|--------|---------|------|--------|
| B1 | 1.2.1 | instrument_detail.html | data-vis → 100% | Done |
| B2 | 1.2.2+1.2.3 | new_request, request_detail, user_detail, budgets | data-vis → 100% | Done |
| B3 | 1.2.4 | all remaining templates | data-vis → 100% (~880 attributes added) | Done |

### Wave C (sequential on app.py — completed, git: e3345b9)

| Module | File(s) | Task | Status |
|--------|---------|------|--------|
| 2.5.1 | app.py | `rate_limit(max_requests, window_seconds)` decorator + `rate_limit_tracking` table | Done |
| 2.1.0 | app.py | Request cancellation: `cancelled` status in display/group/summary helpers | Done |
| 2.4.1 | app.py | Notification badge: `unread_notification_count()` + `/api/notif-count` + `/api/notif-mark-read` + context processor + `last_notification_check` migration | Done |

### Wave D (sequential on app.py — completed, git: b7b122d)

| Module | File(s) | Task | Status |
|--------|---------|------|--------|
| 2.1.1 | app.py | `cancel_request` action + cancellable statuses guard + added to admin_set_status | Done |
| 2.2.1 | app.py | `confirm_results` action for requester + `result_confirmed_at`/`result_confirmed_by` migrations | Done |
| 2.7.1 | app.py | Email queue: `EMAIL_EVENT_TEMPLATES`, `queue_email_notification()`, `process_email_queue()`, `email_queue` table, `/api/process-email-queue` | Done |
| 2.3.1 | app.py | `approval_pill_chain()` helper + context processor injection | Done |

### Wave E (sequential on app.py — completed, git: 3f5e8ea)

| Module | File(s) | Task | Status |
|--------|---------|------|--------|
| 2.6.1 | app.py | `/instruments/<id>/config` route: settings update (capacity, intake mode, notes) | Done |
| 2.6.2 | app.py | Approval chain CRUD: add step, remove step, auto-reorder | Done |
| 2.7.2 | app.py | Wire `queue_email_notification` into cancel + result confirmation handlers | Done |

### Wave F (sequential on app.py — completed, git: d821b2b)

| Module | File(s) | Task | Status |
|--------|---------|------|--------|
| 3.1.1 | app.py | `operator_workload_summary()` + `/api/operator-workload` endpoint | Done |
| 3.1.2 | app.py | `audit_trail_search()` + `/api/audit-search` with flexible filters | Done |
| 3.1.3 | app.py | `instrument_utilization_summary()` + `turnaround_percentiles()` + 2 API endpoints | Done |

### Wave G+H (combined — completed, git: 02ba15e)

| Module | File(s) | Task | Status |
|--------|---------|------|--------|
| 3.2.1 | app.py | `downtime_type` column + 5 types + color-coded calendar events | Done |
| 3.2.2 | app.py | `/requests/<id>/duplicate` route (pre-fill new request from existing) | Done |
| 3.3.1 | app.py | `instrument_sparkline_data()` + `/api/sparkline/<id>` endpoint | Done |
| 3.3.3 | styles.css | Print-friendly CSS: `@media print` rules, approval pill styles | Done |
| 3.3.2 | app.py | `/api/audit-export` CSV download of filtered audit logs | Done |
| 3.2.4 | app.py | `/api/bulk-action` multi-select cancel/reject/mark_received | Done |
| 3.4.1 | app.py | `announcements` table + `/api/announcements` CRUD + dismiss | Done |
| 3.4.2 | app.py | `/api/db-backup` timestamped database backup endpoint | Done |
| 3.4.3 | app.py + template | `/profile/change-password` route + `change_password.html` | Done |

### Safeguards (completed, git: 8334d90)

| Module | File(s) | Task | Status |
|--------|---------|------|--------|
| S.1 | app.py | `safe_compile_check()` with subprocess timeout (kills if >10s) | Done |
| S.2 | app.py | `safe_startup_probe()` with server health poll timeout | Done |
| S.3 | app.py | Pre-flight compile check on startup (sys.exit(1) if fails) | Done |
| S.4 | app.py | `/api/health-check` + `/api/compile-check` endpoints | Done |
| S.5 | test_safeguards.py | 5-test suite (compile, bad-file, line count, functions, imports) | Done |

### Wave I (completed, git: 61b20a0)

| Module | File(s) | Task | Status |
|--------|---------|------|--------|
| 2.4.2 | base.html + styles.css | Notification badge UI (red circle) + CSS + 60s JS polling | Done |
| 2.7.3 | app.py + template | `/profile/email-preferences` route + `email_preferences` column migration | Done |

**NOTE:** Waves C-K from the previous session were destroyed when parallel
agents overwrote app.py. The code was reverted to git HEAD and rebuilt
from scratch. All waves above (A through I + Safeguards) are confirmed in git.

---

## 13. Architecture Patterns

Every new feature must follow these patterns:

1. **`StreamQuery`** / **`request_stream()`** — composable query builder with fluent API, never raw SQL string assembly
2. **`request_scope_sql()`** — role-based data filtering, never inline role checks
3. **`log_action()`** — immutable audit trail for every state change, no exceptions
4. **`data-vis`** — every HTML element tagged with allowed roles for visibility gating
5. **`bounded_pane`** — paginate any list longer than 10 items
6. **`queue_email_notification()`** — event-driven email via queue table, never inline SMTP
7. **`safe_compile_check()`** — subprocess compile verification with timeout before any deployment

---

## 14. API Endpoints

### Public

`GET /api/health-check` — compile status, DB probe, line count, timestamp

### Authenticated

| Endpoint | Method | Access | Purpose |
|----------|--------|--------|---------|
| `/api/notif-count` | GET | any user | Notification badge count |
| `/api/notif-mark-read` | POST | any user | Mark notifications as read |
| `/api/sparkline/<id>` | GET | instrument access | 30-day daily throughput data |
| `/api/turnaround-stats` | GET | stats access | p50/p75/p90/avg turnaround |
| `/api/instrument-utilization` | GET | stats access | Capacity vs throughput |
| `/api/operator-workload` | GET | admin | Per-operator active/completed/avg |
| `/api/audit-search` | GET | admin | Filterable audit log query |
| `/api/audit-export` | GET | admin | CSV download of audit logs |
| `/api/bulk-action` | POST | admin/operator | Multi-select queue actions |
| `/api/announcements` | GET/POST | any/admin | List or create announcements |
| `/api/announcements/<id>/dismiss` | POST | admin | Deactivate announcement |
| `/api/process-email-queue` | POST | admin | Trigger email queue flush |
| `/api/compile-check` | POST | admin | On-demand compile verification |
| `/api/db-backup` | POST | admin | Timestamped database backup |

---

## 15. Future Work (Phase 4)

Not needed for core operations. Implement when Phases 1-3 are
stable and users request these specifically.

| Feature | Size | Notes |
|---------|------|-------|
| CSP headers | S | Tighten script-src/style-src |
| Grant utilization chart | S | Burn-down per budget |
| Capacity calendar heatmap | S | Color cells by load % |
| Invoice/receipt PDF | M | Auto-generate per paid request |
| Instrument comparison view | M | Side-by-side for 2-3 instruments |
| Keyboard shortcuts | S | n=new, /=search, j/k=navigate |
| Custom report builder | L | Pick dimensions, generate chart |
| Department-level scoping | M | Restrict by access_tags |
| OAuth2/LDAP integration | L | SSO via university IdP |
| REST API endpoints | L | JSON API with auth + rate limiting |
| Mobile responsive pass | L | 24 templates full sweep |
