<!-- ============================================================
     PROJECT.md — Lab Scheduler
     ============================================================

     ┌─────────────────────────────────────────────────────────┐
     │  AI AGENT CONSTRAINT                                    │
     │                                                         │
     │  You MUST update this file before and after every job.  │
     │                                                         │
     │  BEFORE you start:                                      │
     │   1. Read this file.                                    │
     │   2. Add a CHANGELOG entry: date, agent, intent.        │
     │      Status: STARTED                                    │
     │   3. Commit this file.                                  │
     │                                                         │
     │  AFTER you finish:                                      │
     │   1. Update your CHANGELOG entry with what changed.     │
     │      Status: COMPLETED                                  │
     │   2. If architecture changed, update that section.      │
     │   3. Update the TODO section.                           │
     │   4. Commit this file with your code. Push.             │
     │                                                         │
     │  Use Git. Always push: git push origin master           │
     │  Commit with: Co-Authored-By: <Name> <email>            │
     │  Never force-push. Never rewrite history.               │
     └─────────────────────────────────────────────────────────┘
-->

# Lab Scheduler

A request-tracking and operator-workflow system for a shared
instrument facility on a local network.  One Python process, one
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

14 tables.  Foreign keys are enforced.

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

SHA-256 hash chain: each entry's `entry_hash` covers
`prev_hash|entity_type|entity_id|action|payload`.  The function
`verify_audit_chain()` validates integrity.

### generated_exports
`id`, `filename`, `created_by_user_id`, `created_at`, `scope_label`.

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
├── PROJECT.md                  This file
├── .gitignore
├── static/
│   ├── styles.css              All CSS (light + dark themes)
│   ├── instrument-placeholder.svg
│   └── instrument_images/      Uploaded instrument photos
├── templates/
│   ├── base.html               Layout: topbar, nav, theme toggle, JS
│   ├── _page_macros.html       Shared macros: card_heading, paginated_pane
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

- Session-based authentication, 12-hour lifetime, HttpOnly cookies.
- Passwords hashed with pbkdf2:sha256.
- All SQL uses parameterized queries.
- File uploads validated against extension whitelist.
- Immutable audit log with SHA-256 hash chain.
- Role checks on every route via `login_required` and
  `role_required` decorators.
- Field-level and action-level visibility via `card_policy`.

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

## 12. CHANGELOG

<!-- AI agents: newest entry first.
     Format:
     ### YYYY-MM-DD | Agent Name | Status: STARTED/COMPLETED
     **Intent:** …
     **Result:** …
     **Files:** …
     **Git commit:** …
-->

### 2026-04-07 | Claude Opus 4.6 (Cowork) | Status: STARTED
**Intent:** Rewrite PROJECT.md to formal standard. Fix visual layout
issues (request detail blank space, queue row sizing, panel consistency).
Address user feedback on scroll panels and text cutoff.
**Result:** (to be updated after commit)
**Files:** PROJECT.md, static/styles.css, templates/request_detail.html

### 2026-04-07 | Claude Opus 4.6 (Cowork) | Status: COMPLETED
**Intent:** Set up local bare repo as open-source remote origin
**Result:** Created `lab-scheduler.git` bare repo. Updated PROJECT.md.
**Files:** PROJECT.md
**Git commit:** fa8bfcf

### 2026-04-07 | Claude Opus 4.6 (Cowork) | Status: COMPLETED
**Intent:** Consolidate all history views into single Queue page
**Result:** Replaced user_history, instrument_history, processed_history
routes with redirects to /schedule. Deleted 3 legacy templates. −910 lines.
**Files:** app.py, templates/ (deleted history.html, instrument_history.html,
processed_history.html), user_detail.html
**Git commit:** e503a2d

### 2026-04-07 | Claude Opus 4.6 (Cowork) | Status: COMPLETED
**Intent:** Fix two crashing bugs (missing table, missing macro import)
**Result:** Replaced query against nonexistent `request_events` table with
`audit_logs`. Added missing macro import in `instrument_detail.html`.
**Files:** app.py, templates/instrument_detail.html
**Git commit:** 401cefa

---

## 13. TODO

### Bugs
- [ ] Request detail: server must be restarted after template changes
      (debug=False caches templates)
- [ ] Instrument detail: broken image icon when `machine_photo_url`
      points to missing file
- [ ] Sample count not validated server-side (can be 0 or negative)
- [ ] File extension crash if uploaded filename has no extension
- [ ] Null checks missing on some optional fields in card display

### Work in progress
- [ ] Request detail layout: left column events + right column
      response (template restructured, needs server restart to verify)
- [ ] Queue row sizing: natural height instead of fixed 3.4rem
- [ ] Scroll panels: consistent max-height, text overflow handling

### Needed
- [ ] CSRF tokens on all POST forms
- [ ] Rate limiting on login route
- [ ] Input sanitisation for stored text (XSS prevention)
