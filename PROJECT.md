# Lab Scheduler — Project Specification

<!-- ============================================================
     PROJECT.md — Lab Scheduler
     ============================================================

     AI AGENT CONSTRAINT:
     You MUST update this file before and after every job.

     BEFORE you start:
      1. Read this file.
      2. Add a CHANGELOG entry: date, agent, intent.
         Status: STARTED
      3. Commit this file.

     AFTER you finish:
      1. Update your CHANGELOG entry with what changed.
         Status: COMPLETED
      2. If architecture changed, update that section.
      3. Update the Roadmap section.
      4. Commit this file with your code. Push.

     Use Git. Always push: git push origin master
     Commit with: Co-Authored-By: <Name> <email>
     Never force-push. Never rewrite history.
     ============================================================
-->

A request-tracking and operator-workflow system for a shared instrument facility on a local network. One Python process, one SQLite database, browser-based interface.

**This file is the single authoritative reference for the project.** A competent developer reading only this file must be able to reconstruct a functionally identical system.

---

## 1. Philosophy

**The Request Card.** Every sample request is a card. The card is created when a requester submits a job and accumulates all data over its lifetime: approvals, notes, files, operator actions, timestamps, results. Nothing is stored separately — the card is the single source of truth for that job.

**Sliced visibility.** The same cards form a single queue. Every page on the site is a filtered, role-appropriate slice of that queue. The Queue page (`/schedule`) is the canonical view; the Home dashboard, Instrument detail, Calendar, and Statistics pages are derived views. There is no data duplication between pages.

**Blobs within blobs.** Every visual element on a page is a panel (blob). Panels contain sub-panels. Each panel has a role-visibility attribute: if the user's role is not in the panel's allowed set, the panel is not rendered. This applies uniformly to every element — page sections, card fields, action buttons, navigation items. There are no exposed hyperlinks; navigation is through buttons and panel actions.

**LAN-first.** This is a lightweight internal tool. It runs on a single machine on the local network. There is no cloud dependency, no external authentication provider, no CDN. The design favours simplicity and maintainability.

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

No external Python packages beyond Flask and its dependencies. No build step. No bundler. No transpiler.

---

## 3. User Roles

Roles are hierarchical. A higher role inherits all capabilities of lower roles unless otherwise noted.

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

Owner status is determined by email match against the `OWNER_EMAILS` environment variable, not by role. Owners bypass all restrictions.

### Visibility Matrix

Every UI element checks the user's role before rendering. The `card_policy` object (computed per request, per user) contains two sets:

- `card_policy.fields` — which data fields are visible (instrument, requester identity, operator identity, remarks, results, events, conversation, submitted documents, finance details).

- `card_policy.actions` — which action buttons are shown (approve, reject, mark submitted, mark received, schedule, complete, reassign, upload, reply, flag issue, update status).

The `user_access_profile()` function returns a dict of boolean capabilities used by templates to show/hide navigation items, page sections, and dashboard widgets.

For detailed role-to-page mapping, see ROLE_VISIBILITY_MATRIX.md.

---

## 4. Request Lifecycle

A card moves through these statuses in order. Each transition is logged in the immutable audit trail.

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

Default sequence: Finance → Professor → Operator. Configurable per instrument via `instrument_approval_config`. Steps execute in strict order. A step cannot be actioned until all prior steps are approved.

---

## 5. Database Schema

14 tables. Foreign keys are enforced.

### users
`id`, `name`, `email`, `password_hash`, `role`, `invited_by`, `invite_status` (active|invited), `active` (0|1).

### instruments
`id`, `name`, `code` (unique), `category`, `location`, `daily_capacity`, `status` (active|archived), `notes`, `office_info`, `faculty_group`, `manufacturer`, `model_number`, `capabilities_summary`, `machine_photo_url`, `reference_links`, `instrument_description`, `accepting_requests` (0|1), `soft_accept_enabled` (0|1).

### instrument_admins
`user_id`, `instrument_id`. Junction table.

### instrument_operators
`user_id`, `instrument_id`. Junction table.

### instrument_faculty_admins
`user_id`, `instrument_id`. Junction table.

### sample_requests
`id`, `request_no`, `sample_ref`, `requester_id`, `created_by_user_id`, `originator_note`, `instrument_id`, `title`, `sample_name`, `sample_count`, `description`, `sample_origin` (internal|external), `receipt_number`, `amount_due`, `amount_paid`, `finance_status`, `priority`, `status`, `submitted_to_lab_at`, `sample_submitted_at`, `sample_received_at`, `sample_dropoff_note`, `received_by_operator_id`, `assigned_operator_id`, `scheduled_for`, `remarks`, `results_summary`, `result_email_status`, `result_email_sent_at`, `completion_locked` (0|1), `created_at`, `updated_at`, `completed_at`.

### approval_steps
`id`, `sample_request_id`, `step_order`, `approver_role` (finance|professor|operator), `approver_user_id`, `status` (pending|approved|rejected), `remarks`, `acted_at`.

### request_messages
`id`, `request_id`, `sender_user_id`, `note_kind` (requester_note|lab_reply|operator_note|final_note), `message_body`, `created_at`, `is_active`.

### request_attachments
`id`, `request_id`, `user_id`, `instrument_id`, `original_filename`, `stored_filename`, `relative_path`, `file_extension`, `mime_type`, `file_size`, `uploaded_by_user_id`, `uploaded_at`, `attachment_type` (request_document|sample_slip|result_document|invoice|other), `note`, `is_active`, `request_message_id`.

### request_issues
`id`, `request_id`, `created_by_user_id`, `issue_message`, `response_message`, `status` (open|responded|resolved), `created_at`, `responded_at`, `responded_by_user_id`, `resolved_at`, `resolved_by_user_id`.

### instrument_downtime
`id`, `instrument_id`, `start_time`, `end_time`, `reason`, `created_by_user_id`, `created_at`, `is_active`.

### instrument_approval_config
`id`, `instrument_id`, `step_order`, `approver_role`, `approver_user_id`.

### audit_logs
`id`, `entity_type`, `entity_id`, `action`, `actor_id`, `payload_json`, `prev_hash`, `entry_hash`, `created_at`.

SHA-256 hash chain: each entry's `entry_hash` covers `prev_hash|entity_type|entity_id|action|payload`. The function `verify_audit_chain()` validates integrity.

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
| `GET /docs`                        | markdown/html            | login       | Documentation viewer                 |
| `GET /login`                       | `login.html`             | public      | Sign in                              |
| `POST /login`                      | —                        | public      | Authenticate                         |
| `GET /logout`                      | redirect                 | login       | Sign out                             |
| `GET /activate`                    | `activate.html`          | public      | Invitation activation                |
| `GET /attachments/<id>/download`   | file                     | login       | Download attachment                  |
| `GET /attachments/<id>/view`       | file                     | login       | View attachment inline               |

---

## 7. Template System

### Macro Library: _page_macros.html

Reusable macros for page construction and layout.

#### paginated_pane(pane_id, items, page_size, columns, max_height, actions_fn)

Renders a paginated table pane with client-side pagination. Each pane has a unique `data-pane-id` for JS interaction.

- `pane_id` — Unique identifier (e.g., `"quickIntake"`, `"instCard10"`)
- `items` — List of objects to display
- `page_size` — Rows per page
- `columns` — List of column definitions: `{name: "Status", key: "status"}`
- `max_height` — CSS height (e.g., `"400px"`) or `"none"` for pagination-only overflow
- `actions_fn` — Optional lambda returning action buttons for each row

Example panes in current system:
- Dashboard: `quickIntake` (page_size=3), `instCard{N}` (page_size=5)
- Instruments: `mainInstruments` (page_size=25), `archivedInstruments` (page_size=25)
- Queue: `centralQueue` (page_size=25)
- Instrument Detail: `instQueue` (page_size=5), `instEvents` (page_size=10)
- Request Detail: `reqFiles` (page_size=6), `reqEvents` (page_size=10)
- Statistics: `statsInstrument` (page_size=10), `statsWeekly` (page_size=10)

#### page_intro(title, subtitle, breadcrumbs)

Renders page header: title, optional subtitle, and breadcrumb navigation.

#### stat_blob(label, value, icon, action_url)

Renders a clickable statistics tile: displays a metric with label and optional icon. Used for dashboard counters and war-room panels. Tiles link to detail pages (e.g., instrument tiles in stats link to instrument_detail).

#### chart_bar(label, value, max_value, color)

Renders a horizontal bar chart element for visual metrics (e.g., instrument load, weekly throughput).

#### card_heading(title, subtitle, actions)

Renders the header of a card with title, subtitle, and action buttons. Used in request_detail, instrument_detail, user profile pages.

#### input_dialog(dialog_id, title, fields, submit_label)

Reusable search-type panel widget: text box input + optional file attachment + message routing selector. Used for request comments, instrument events, issue flagging.

### Macro Library: _request_macros.html

Macros specific to request/card rendering.

#### status_block(status, stage)

Renders the current status and approval stage of a request card.

#### approval_chain(approvals)

Renders the approval step indicator showing which approvers have acted and current pending steps.

#### attachment_list(attachments)

Renders a list of uploaded files with download/view links, organized by attachment type.

#### note_thread(messages)

Renders the conversation history: requester notes, lab replies, operator notes, final notes.

#### finance_block(amount_due, amount_paid, receipt, finance_status)

Renders finance information: amounts, payment status, receipt number.

### Data Visualization System

The `V` variable centralizes role visibility:

```python
V = [
    'requester', 'finance_admin', 'professor_approver',
    'faculty_in_charge', 'operator', 'instrument_admin',
    'site_admin', 'super_admin', 'owner'
]
```

Subset variables for restricted elements:
- `VA` — Approver roles (finance_admin, professor_approver, operator)
- `VOP` — Operator-only roles (operator, instrument_admin, site_admin, super_admin)
- `VLAB` — Lab staff roles (finance_admin, professor_approver, faculty_in_charge, operator, instrument_admin, site_admin, super_admin)

Templates use `{% if user.role in V %}` or subset variables to gate element visibility. Client-side data-vis (`data-vis` attributes) serve as a secondary safety net but are not the primary access control.

### CSS Component Architecture

See CSS_COMPONENT_MAP.md for comprehensive component catalog. Core components:

- `.card` — Container for content sections (with `.card.compact` variant)
- `.paginated-pane` — Table wrapper with pagination controls
- `.stat-blob` — Statistics tile
- `.status-badge` — Status indicator
- `.action-button` — Clickable action button
- `.input-dialog` — Modal/panel for text input + attachment

All repeated UI elements use these components to maintain consistency.

---

## 8. File Structure

```
Main/
├── app.py                          Single application file
├── lab_scheduler.db                SQLite database (git-ignored, auto-created)
├── PROJECT.md                      This file (formal specification)
├── README.md                        Quick start guide + progress bar
├── TODO_AI.txt                     Active tasks (legacy, content absorbed into this file)
├── CRAWL_PLAN.md                   Role-based access testing plan
├── CSS_COMPONENT_MAP.md            CSS components and usage
├── SECURITY_TODO.md                Security hardening checklist
├── ROLE_VISIBILITY_MATRIX.md       Role-to-page access matrix
├── .gitignore
├── static/
│   ├── styles.css                  All CSS (light + dark themes)
│   ├── instrument-placeholder.svg
│   └── instrument_images/          Uploaded instrument photos
├── templates/
│   ├── base.html                   Layout: topbar, nav, theme toggle, JS
│   ├── _page_macros.html           Shared macros: paginated_pane, page_intro, stat_blob, chart_bar, card_heading, input_dialog
│   ├── _request_macros.html        Card display macros: status_block, approval_chain, attachment_list, note_thread, finance_block
│   ├── _stream_macros.html         Streaming/real-time macros (if applicable)
│   ├── dashboard.html
│   ├── instruments.html
│   ├── instrument_detail.html
│   ├── schedule.html               The Queue
│   ├── new_request.html
│   ├── request_detail.html         The Card
│   ├── calendar.html
│   ├── stats.html
│   ├── visualization.html
│   ├── user_detail.html
│   ├── users.html
│   ├── login.html
│   ├── activate.html
│   ├── sitemap.html
│   ├── error.html
│   └── docs.html                   Documentation viewer
├── uploads/                        Request files (git-ignored)
│   └── users/<uid>/requests/<req>/attachments/
└── exports/                        Generated Excel reports (git-ignored)
```

---

## 9. File Upload System

Each request gets a folder:
`uploads/users/<user_id>/requests/req_<id>_<request_no>/attachments/`

Allowed extensions: pdf, png, jpg, jpeg, xlsx, csv, txt.
Maximum upload: 100 MB per file.
Files are served through Flask, not as direct static files.

A sample slip PDF is auto-generated on request creation and stored as `attachment_type=sample_slip`.

A `request_metadata.json` snapshot is written to the request folder after every meaningful state change. It contains the complete card state and serves as an offline backup.

---

## 10. Communication

Four note types on each card:

| Type             | Author          | Visible to     |
|------------------|-----------------|----------------|
| `requester_note` | Requester       | Lab staff      |
| `lab_reply`      | Lab staff       | Requester      |
| `operator_note`  | Operator/admin  | Lab staff only |
| `final_note`     | Operator/admin  | Requester      |

Issue tracking: flag → respond → resolve cycle, tracked in `request_issues`.

---

## 11. Security

- Session-based authentication, 12-hour lifetime, HttpOnly cookies.
- Passwords hashed with pbkdf2:sha256.
- All SQL uses parameterized queries.
- File uploads validated against extension whitelist.
- Immutable audit log with SHA-256 hash chain.
- Role checks on every route via `login_required` and `role_required` decorators.
- Field-level and action-level visibility via `card_policy`.
- CSRF protection via flask-wtf: all POST forms include CSRF tokens, fetch() calls send `X-CSRFToken` header.

See SECURITY_TODO.md for ongoing hardening work.

---

## 12. Git and Development

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

Debug mode: controlled at the bottom of `app.py`. Set `True` while developing, `False` before committing.

Editor: VS Code. No linter enforced.

To add a cloud remote later:
`git remote add github https://github.com/<user>/lab-scheduler.git`

---

## 13. Roadmap

### COMPLETED ITEMS (All phases through 2026-04-09)

**Phase 1 & 2: Core Platform + UI Architecture** — DONE

- [x] Basic Flask scaffold with SQLite
- [x] User authentication and role management
- [x] Request card creation, approval chain, lifecycle
- [x] Instruments table (7-column: Name, Status, Avg Return, Operator, Faculty, Location, Links)
- [x] Dashboard quick-intake panel (page_size=3, inline Assign/Accept)
- [x] Instrument queue cards (flex-wrap grid, 5 samples each, overflow link)
- [x] Queue page reordered (Request, Instrument, Status, Requester, Time, File, Action)
- [x] Unified statistics war room (clickable counters, instrument tiles link to detail)
- [x] Hover back button (fixed circle in left margin on sub-pages)
- [x] Instrument detail 3-block layout (machine + queue + control)
- [x] Machine metadata left (1/3), queue+control right (2/3)
- [x] No scroll panes (all paginated_pane max_height='none')
- [x] Role-based access control (4 bugs fixed via ROLE_VISIBILITY_MATRIX)
- [x] Random-walk stress crawl (300 steps, POST /requests/new 500 fixed)
- [x] UI macro centralization (stat_blob, chart_bar macros; V hardcodes removed)
- [x] CSRF protection (flask-wtf installed, all POST routes protected)
- [x] Audit log with SHA-256 hash chain
- [x] File upload system (100 MB max, extension whitelist, disk storage)
- [x] Calendar view with FullCalendar
- [x] Statistics dashboard with export to Excel

**Phase 3a: Full Simulation (In Progress)**

- [x] Instruments table distinct columns implementation
- [x] Dashboard quick-intake panel with inline actions
- [x] Instrument queue blocks (flex-wrap grid)
- [x] Queue page column reordering
- [x] Statistics war room implementation
- [x] Hover back button on sub-pages
- [x] Instrument detail 3-block layout
- [x] Instrument detail left/right split
- [x] No scroll panes enforcement
- [x] Role-based crawl verification
- [x] Random-walk stress crawl
- [x] UI macro centralization
- [ ] Build populate_full_demo.py (25 instruments, 15 faculty, 10 operators, ~40 requesters, 500 requests)

**Phase 3b: Admin/Settings Page Redesign (Planned)**

- [ ] Redesign sitemap.html → settings.html (Apple Settings philosophy)
  - Left sidebar: section selector buttons (Core, Operations, Reporting, Admin)
  - Right panel: forms, toggles, and info for selected section
  - Remove useless/dead links; keep only functional navigation

**Phase 3c: Navigation + Widget Improvements (Planned)**

- [ ] Instrument hover navigation pane (dropdown under "Instruments" link)
- [ ] Universal dialog/input widget (reusable search-type panel)
- [ ] Instrument control panel improvement (stats + queue + admin + info + form control)

**Phase 4: Calendar Integration (Planned)**

- [ ] Link instrument downtime to calendar
- [ ] Downtime blocks appear on calendar view
- [ ] Calendar events clickable → navigate to instrument detail
- [ ] Instrument detail shows upcoming downtime from calendar
- [ ] Cross-page calendar presence: dashboard shows next downtime, queue shows scheduling conflicts

**Phase 5: Final Template Centralization (Planned)**

- [ ] Apply chart_bar macro to dashboard weekly/monthly charts
- [ ] Audit all remaining templates for ad-hoc patterns
- [ ] Ensure all role visibility uses {{ V }} or proper subset variables
- [ ] Document all macros in _page_macros.html, _request_macros.html, _stream_macros.html

**Phase 6: Documentation Rewrite (Completed)**

- [x] Rewrite README.md with progress bar and quick start
- [x] Update PROJECT.md with complete spec, macros, roles, all routes
- [x] Add new macros to file structure documentation
- [x] Add new roles/presets documentation
- [x] Update changelog with Phase 2-3 work

**Phase 7: Verification (Planned)**

- [ ] Run populate_full_demo.py and verify data integrity
- [ ] Full crawl: all roles, all pages, all actions
- [ ] Cross-page consistency check: counter verification, queue slice matching
- [ ] Final smoke test

### Architecture Notes (Preserved)

Philosophy preserved:
- One queue, one request card as source of truth
- Sliced visibility per role
- LAN-first simplicity
- Blobs within blobs (tiles containing widgets)
- No scroll panes; paginated view panes only
- Apple UX / Johnny Ive design sensibility

Data-vis decision: Keep data-vis as defense-in-depth. Server-side rendering is primary gate; client-side data-vis JS is secondary safety net. V includes all roles for elements that are visible to everyone; use subset variables (VA, VOP, VLAB) for restricted elements.

Component system: Enforce macros over ad-hoc markup. All stat blobs, card headings, paginated panes, status badges, and chart bars use shared macros.

---

## 14. Changelog

<!-- AI agents: newest entry first.
     Format:
     ### YYYY-MM-DD | Agent Name | Status: STARTED/COMPLETED
     **Intent:** …
     **Result:** …
     **Files:** …
     **Git commit:** …
-->

### 2026-04-09 | Claude Haiku 4.5 | Status: COMPLETED
**Intent:** Consolidate README.md, TODO_AI.txt, PROJECT.md into 2 well-structured files. README focused on quick start + progress. PROJECT.md absorbs roadmap.
**Result:** README.md now slim with progress bar and quick start. PROJECT.md now comprehensive spec with Roadmap section absorbing all TODO_AI.txt items, Template System section documenting all macros and data-vis, expanded File Structure. Two files form complete rebuild source.
**Files:** README.md, PROJECT.md
**Git commit:** (pending)

### 2026-04-07 | Claude Opus 4.6 (Cowork) | Status: STARTED
**Intent:** Rewrite PROJECT.md to formal standard. Fix visual layout issues (request detail blank space, queue row sizing, panel consistency). Address user feedback on scroll panels and text cutoff.
**Result:** (to be updated after commit)
**Files:** PROJECT.md, static/styles.css, templates/request_detail.html

### 2026-04-07 | Claude Opus 4.6 (Cowork) | Status: COMPLETED
**Intent:** Set up local bare repo as open-source remote origin
**Result:** Created `lab-scheduler.git` bare repo. Updated PROJECT.md.
**Files:** PROJECT.md
**Git commit:** fa8bfcf

### 2026-04-07 | Claude Opus 4.6 (Cowork) | Status: COMPLETED
**Intent:** Consolidate all history views into single Queue page
**Result:** Replaced user_history, instrument_history, processed_history routes with redirects to /schedule. Deleted 3 legacy templates. −910 lines.
**Files:** app.py, templates/ (deleted history.html, instrument_history.html, processed_history.html), user_detail.html
**Git commit:** e503a2d

### 2026-04-07 | Claude Opus 4.6 (Cowork) | Status: COMPLETED
**Intent:** Fix two crashing bugs (missing table, missing macro import)
**Result:** Replaced query against nonexistent `request_events` table with `audit_logs`. Added missing macro import in `instrument_detail.html`.
**Files:** app.py, templates/instrument_detail.html
**Git commit:** 401cefa

---

## 15. Known Bugs & TODO

### Bugs
- **Queue page title** — Always says "Jobs"; consider showing instrument name in subtitle when pre-filtered via `?instrument_id=`
- **Template caching** — Production deploys (`debug=False`) cache templates. Template-only changes require server restart.
- **Row serialization** — Stats route converts SQLite Row objects to dicts for JSON. New stats queries must also use `dict(r)`.
- **Server restart** — Recent template changes require Flask restart to take full effect. Run `python3 app.py` or use `start.sh`.
- **Image missing** — Instrument detail broken image icon when `machine_photo_url` points to missing file
- **Sample count** — Not validated server-side (can be 0 or negative)
- **File extension crash** — Uploaded filename with no extension causes crash
- **Null checks** — Missing on some optional fields in card display

### Work in Progress
- **Request detail layout** — Left column events + right column response (template restructured, needs restart verification)
- **Queue row sizing** — Natural height instead of fixed 3.4rem
- **Scroll panels** — Consistent max-height, text overflow handling

### Needed
- **Input sanitisation** — XSS prevention for stored text
- **Rate limiting** — On login route
- **HTTPS migration** — See SECURITY_TODO.md

---

## 16. Reference Documents

This project uses multiple supporting documentation files:

| File | Purpose |
|------|---------|
| `README.md` | Quick start, demo accounts, progress bar |
| `CRAWL_PLAN.md` | Role-based access testing plan, test account matrix |
| `CSS_COMPONENT_MAP.md` | CSS classes, component patterns, template usage |
| `SECURITY_TODO.md` | Security hardening checklist, HTTPS migration tracker, bug fixes log |
| `ROLE_VISIBILITY_MATRIX.md` | Every page and UI element mapped to accessible roles |

---

## Task Execution

### Source of Truth

All active work is defined in this file's **Roadmap** section (previously TODO_AI.txt).

Workflow:
1. Read the Roadmap section first.
2. Execute tasks in order (each wave sequentially, items within waves can parallelize).
3. Do not invent new architecture unless required.
4. After completing work, update the Roadmap section: move completed items to COMPLETED ITEMS, mark active items with checkbox status.

### AI Agent Workflow

1. **Always commit before starting** a new task.
2. **Write the plan** (update Roadmap section) before coding.
3. **Break work into <5 min tasks**. Use parallel agents where possible.
4. **Commit after finishing** each task. Never leave uncommitted work.
5. If the last job wasn't completed, revert via git, re-read the Roadmap, complete it, then move on.
6. **Before starting**: Read this file, add CHANGELOG entry (Status: STARTED), commit.
7. **After finishing**: Update CHANGELOG entry (Status: COMPLETED), update Roadmap, commit, push.
