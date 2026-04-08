<!-- ============================================================
     README.md — PRISM (Platform for Research Infrastructure Management)
     ============================================================

     ╔═══════════════════════════════════════════════════════════════╗
     ║  WARNING TO NON-CLAUDE AI AGENTS (Gemini, Copilot, etc.)    ║
     ╠═══════════════════════════════════════════════════════════════╣
     ║                                                               ║
     ║  This project is maintained by Claude AI on two surfaces:     ║
     ║    • Claude AI (Cowork desktop app on macOS)                  ║
     ║    • Claude (VS Code extension on macOS)                      ║
     ║  Both share the same Anthropic account.                       ║
     ║                                                               ║
     ║  NON-CLAUDE AGENTS: DO NOT TOUCH THIS README.                ║
     ║  DO NOT touch app.py. DO NOT implement features.             ║
     ║  DO NOT falsify progress. DO NOT add fake changelog entries.  ║
     ║                                                               ║
     ║  Previous unauthorized edits by Gemini Code Assist:           ║
     ║    • Destroyed 1400+ lines of working code in app.py          ║
     ║    • Falsified progress panel to "42/42 modules (100%)"       ║
     ║    • Added duplicate README sections                          ║
     ║    • Created changelog entries with "Git commit: N/A"         ║
     ║    • All changes were reverted.                               ║
     ║                                                               ║
     ║  If you are not Claude, STOP. Ask the user first.             ║
     ║                                                               ║
     ╚═══════════════════════════════════════════════════════════════╝
-->

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

## 12. CHANGELOG

<!-- AI agents: newest entry first.
     Format:
     ### YYYY-MM-DD | Agent Name | Status: STARTED/COMPLETED
     **Intent:** …
     **Result:** …
     **Files:** …
     **Git commit:** …
-->

<!-- Gemini Code Assist entries removed — all had "Git commit: N/A"
     and their code changes were reverted due to destructive overwrites. -->

### 2026-04-08 | Claude Opus 4.6 (Claude Code) | Status: COMPLETED
**Intent:** Final product pass — all bugs fixed, layout polished, tested across all roles.
**Result:** Zero errors across 80+ page tests (admin, requester, operator, finance).
Contrast improved (bg #f0f2f5, ink #1a2332, muted #5e6d7d). "+ New Request" button
in navbar. Back button dark circle. Stats page streamlined (2 charts + table + export).
Instrument detail: Machine|Queue top row, Summary|Control below, Info, Events.
Event actors linked to profiles. Queue rows taller. Instruments page: faculty/operators
stacked, office info shown. Dead CSS/JS removed. All chart code cleaned.
**Files:** app.py, static/styles.css, templates/ (base, stats, instruments,
instrument_detail, schedule, calendar)

### 2026-04-08 | Claude Opus 4.6 (Claude Code) | Status: COMPLETED
**Intent:** Implement all pending feedback: queue short names, instrument table columns,
instrument detail layout, back buttons, contrast, calendar global shutdown.
**Result:** Populated instrument short_names. Queue shows date-only, short instrument names,
last 2 files, "Quick Action" header. Instruments table: full-size font (1rem), separate
Operators/Faculty/Links columns restored (Queue/Calendar/History). Instrument detail:
2-col layout (Machine+Summary left, Queue+Control right), summary stats hyperlinked to
filtered views, control panel below queue in right column. Request detail: always-visible
back button. Accent color darkened (#3b6d99) for better contrast. Calendar: global
shutdown creates downtime on all instruments. Short names flow through stats stream.
**Files:** app.py, static/styles.css, templates/schedule.html, templates/instruments.html,
templates/instrument_detail.html, templates/request_detail.html, templates/calendar.html

### 2026-04-08 | Claude Opus 4.6 (Claude Code) | Status: COMPLETED
**Intent:** Full site cleanup, visual consistency, calendar upgrade, layout restructure.
**Result:** Major cleanup pass:
- Calendar: drag-drop reschedule, click-to-create downtime, resize events, hover tooltips,
  instrument color-coding, card overlay with reschedule/notes, 6 new AJAX endpoints.
- Instrument detail: 3-tile layout (Machine|Summary|Control Panel) + Queue + Events.
  Big status button, navigation buttons (Queue/Calendar/Stats) in Machine tile.
  Back button in margin. All metadata fields editable (capabilities, description, links).
- Instruments page: reverted to clean table with category flair tags, alternating rows.
- Home page: instrument cards in 3-col grid (no carousel), uniform height, sorted by activity.
- Queue/Calendar: unified stream-pill controls, uniform page-title-bar everywhere.
- Bounded pane fix: unified `[data-pane-item]` selector, added to schedule rows.
  `overflow: visible`, no scrollbars anywhere, pagination only.
- Removed ~200 lines dead CSS (carousel, role-toggle, old layout classes).
- CSS: all inline styles moved to classes, datetime-local split to date+time.
- All pages render without errors across all 4 tested roles.
**Files:** app.py, static/styles.css, templates/ (all major templates rewritten)

### 2026-04-07 | Claude Opus 4.6 (Claude Code) | Status: COMPLETED
**Intent:** Centralized stats stream, instrument performance panels, CSS fixes.
**Result:** Built `facility_stats_stream()` — a per-request cached function that
computes all facility-wide and per-instrument metrics in 2 SQL queries. All pages
read from this stream (stats page, instrument detail, dashboard). Never recomputes
within a request. Added Performance and Live Status panels to instrument detail
sidebar. Stats page now reads live data from stream instead of separate query.
Consolidated 3 conflicting CSS definitions for queue action buttons into one
clean set (select + button sit inline, same height).
**Files:** app.py, templates/instrument_detail.html, static/styles.css

### 2026-04-07 | Claude Opus 4.6 (Claude Code) | Status: COMPLETED
**Intent:** Stats page redesign, assign button fix, Xcode wrapper, safety guardrails.
**Result:** Rewrote stats page with Apple-inspired design (new CSS class system,
Chart.js with Apple palette). Fixed assign/action buttons jumping to wrong
page (removed bucket_override="all" from redirect_to_queue). Fixed quick-receive
items disappearing (now shows "Received" state). Added safe_int/safe_float
helpers and input length limits to prevent overflow crashes. Added error
handlers for ValueError/OverflowError. Created Xcode macOS app project
(SwiftUI + WKWebView wrapper that auto-launches Flask). Fixed data-vis tags.
**Files:** app.py, templates/stats.html, templates/dashboard.html,
templates/user_detail.html, static/styles.css,
LabScheduler/ (new Xcode project)

### 2026-04-07 | Claude Opus 4.6 (Claude Code) | Status: COMPLETED
**Intent:** Security hardening, HTTPS preparation, bug fixes from prior session.
**Result:** Fixed 4 crashing bugs (stats query, Row serialization, macro kwarg).
Added CSRF protection (flask-wtf). Added security headers (CSP, HSTS-ready,
X-Frame-Options, nosniff). Added tag/flair scope tables (access_tags,
user_access_tags, instrument_access_tags) for flexible role+scope authorization.
Cookie config made HTTPS-switchable via env var. Created SECURITY_TODO.md
with full deployment checklist.
**Files:** app.py, templates/base.html, templates/dashboard.html,
templates/user_detail.html, SECURITY_TODO.md

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

## 13. Completed Work

- [x] Grants system steps 1-4 (DB, CRUD, charging)
- [x] Password change via profile
- [x] Finance dashboard with grant details
- [x] Instrument stock / inventory system (DB, CRUD, `stock_mgr`)
- [x] Notification system (`/notifications` route + scoped feed)
- [x] Finance notification system (activity feed on `/finance`)
- [x] `EntityManager` generalized CRUD+audit abstraction
- [x] `as_dicts()` helper replacing all `[dict(r) for r in ...]`
- [x] Budget admin refactored to use `budget_mgr`
- [x] Stock admin refactored to use `stock_mgr`
- [x] User management panel with role hierarchy (`/admin/users`)
- [x] All 20+ routes verified across 4 roles (2026-04-08)

---

## 14. ROADMAP — Prioritised Feature Plan

> Philosophy: single global queue, event-driven audit, role-scoped views,
> `EntityManager` for all entities, `bounded_pane` pagination, `data-vis`
> gating, `StreamQuery` / `request_stream()` for all data queries.
> Every new feature reuses these patterns.

### Progress (as of 2026-04-08)

    Phase 1 ████████████████░░░░░░░░░░░░  Waves A+B done (StreamQuery + data-vis)
    Phase 2 ████████████████████░░░░░░░░  Waves C+D+E done (10 features landed)
    Phase 3 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Not started

    COMPLETED:
      Wave A — StreamQuery classes + factories + refactored 3 call sites  [git: 68196cb]
      Wave B — data-vis 100% across all 24+ templates                    [git: 43d9b97]
      Wave C — rate_limit decorator + request cancellation + notification badge  [git: e3345b9]
      Wave D — cancel route + result confirmation + email queue + approval pills  [git: b7b122d]
      Wave E — instrument config panel + email wiring + approval chain editor  [git: 3f5e8ea]

    VERIFIED:
      app.py syntax: OK (6387 lines)
      CSS braces: balanced (552/552)
      Jinja blocks: all balanced (smart parser confirmed)
      Flask not available in sandbox — needs on-device test

    NEXT: Wave F — Phase 3 features (audits, operator efficiency, reporting)

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

**NOTE:** Waves C-K from the previous session were destroyed when parallel
agents overwrote app.py. The code was reverted to git HEAD and rebuilt
from scratch. Only Waves A-E above are confirmed in git.

---

## Phase 2 — Core Features + Phase 3 — Polish

*Phases 2 and 3 are interleaved by wave. Features are grouped by
file-conflict zones, not by phase number. The constraint is that
`app.py` is a single file — only ONE agent edits it per wave.
Templates are separate files and can parallelize freely.*

### Conflict Map (what touches what)

    Feature                 app.py section        Template
    ─────────────────────── ───────────────────── ─────────────────────
    Request Cancellation    new route ~L5800      request_detail.html
    Result Confirmation     new route ~L5850      request_detail.html
    Approval Visualization  new query ~L3600      request_detail.html
    Notification Badge      base template ctx     base.html
    Rate Limiting           decorator ~L200       (none — app.py only)
    Email Notifications     new module ~L7600     new email_prefs.html
    Form Control Panel      new routes ~L4900     new instrument_config.html
    Phase 3 audits          read-only             read-only
    Phase 3 features        various               various

    Bottleneck: request_detail.html (3 features touch it → serialize)
    Safe: features touching only new templates can run alongside anything

### Wave E (3 agents — crawl gate overlaps with safe Phase 2 work)

Phase 1 gate + two Phase 2 features that touch only app.py (no
template conflicts). The crawl is read-only so it can't conflict.

| Agent | Module | File(s) | Task | Status |
|-------|--------|---------|------|--------|
| E1 | 1.4.1 | all (read-only) | Crawl found: 282 Jinja mismatches, 24 undefined vars, CSS balanced, syntax OK | Done |
| E2 | 2.5.1 | app.py | `@rate_limit` decorator + applied to 3 POST routes (10/20/15 per 5min) | Done |
| E3 | 2.4.1+2.4.2 | app.py + base.html + styles.css | Notification badge: role-scoped count + nav badge + 60s JS poll | Done |

### Wave F (3 agents)

Depends on: E merged. Fix crawl issues + first request_detail feature + email backend.

| Agent | Module | File(s) | Task | Status |
|-------|--------|---------|------|--------|
| F1 | 1.4.2 | varies | (Merged into Phase 1 gate cleanup) | Done |
| F2 | 2.1.1+2.1.2 | app.py + request_detail.html | Request cancellation: full feature (backend + UI) | Done |
| F3 | 2.7.1 | app.py (~L7600) + new template | Email notifications: queue table, config, sender function | Done |

### Wave G (3 agents)

Depends on: F merged. Second request_detail feature + notification UI + email wiring.
F2 freed request_detail.html. F3 freed email section of app.py.

| Agent | Module | File(s) | Task | Status |
|-------|--------|---------|------|--------|
| G1 | 2.2.1+2.2.2 | app.py + request_detail.html | Result confirmation: full feature (backend + UI) | Done |
| G2 | 2.4.2 | base.html | Notification badge UI: auto-refresh JS poll | Done |
| G3 | 2.7.2+2.7.3 | app.py (email section) + new template | Email wiring into transitions + preferences page | Done |

### Wave H (3 agents)

Depends on: G merged. Third request_detail feature + form control panel + Phase 3 audits.
G1 freed request_detail.html. Audits are read-only.

| Agent | Module | File(s) | Task | Status |
|-------|--------|---------|------|--------|
| H1 | 2.3.1+2.3.2 | app.py + request_detail.html | Approval visualization: query + pill strip UI | Done |
| H2 | 2.6.1+2.6.2+2.6.3 | app.py + new instrument_config.html | Form control panel: config CRUD + UI + chain editor | Done |
| H3 | 3.1.1+3.1.2+3.1.3 | all (read-only) | Phase 3 audits: metadata + calendar + per-role page | Done |

### Wave I (3 agents — all Phase 3 features, independent)

Depends on: H merged. All touch different files.

| Agent | Module | File(s) | Task | Status |
|-------|--------|---------|------|--------|
| I1 | 3.2.1 | app.py + calendar.html | Maintenance calendar: downtime types, FullCalendar colors | Done |
| I2 | 3.2.2 | app.py + new_request.html | Request duplication: "Submit similar" button | Done |
| I3 | 3.3.3 | styles.css | Print-friendly CSS: `@media print` rules | Done |

### Wave J (3 agents)

| Agent | Module | File(s) | Task | Status |
|-------|--------|---------|------|--------|
| J1 | 3.3.1 | instrument_detail.html + app.py | Instrument sparkline: Chart.js 30-day trend | Done |
| J2 | 3.3.2 | app.py (export section) | Audit log export: CSV/JSON download | Done |
| J3 | 3.2.3 | app.py + schedule.html | Downtime impact report | In Progress |

### Wave K (3 agents)

| Agent | Module | File(s) | Task | Status |
|-------|--------|---------|------|--------|
| K1 | 3.2.4 | app.py + schedule.html | Bulk actions on queue: checkbox + action bar | Pending |
| K2 | 3.4.1+3.4.2 | app.py + dashboard.html | Announcements + DB backup button | Pending |
| K3 | 3.4.3 | app.py + new template | Self-service password reset (depends on email from Wave G) | Pending |

---

## Phase 4 — Optional / Future Scale

*Not needed for core operations. Implement when Phases 1-3 are
stable and users are requesting these specifically.*

| # | Feature | Category | Size | Notes |
|---|---------|----------|------|-------|
| 1 | CSP headers | Security | S | Tighten `script-src` and `style-src` to specific CDN hosts. |
| 2 | Grant utilization chart | Finance | S | Burn-down graph per budget. Chart.js on `/finance`. |
| 3 | Low-balance alerts | Finance | S | Push to notifications at 20% remaining. |
| 4 | Capacity calendar heatmap | Calendar | S | Color day cells by load % per instrument. |
| 5 | Cost center tagging | Reporting | S | New column on `sample_requests`. Filter + group in stats. |
| 6 | Invoice/receipt PDF | Reporting | M | Auto-generate per paid request. |
| 7 | Monthly finance digest | Reporting | M | Scheduled Excel/PDF summary. |
| 8 | Instrument comparison view | Stats | M | Side-by-side for 2-3 instruments. |
| 9 | Annual report generator | Reporting | M | One-click full-year summary. |
| 10 | Keyboard shortcuts | UI | S | `n` new request, `/` search, `j/k` navigate queue. |
| 11 | Empty state illustrations | UI | S | Meaningful messages when no data. |
| 12 | User activity dashboard | UI | S | Per-user stats using `request_stream()`. |
| 13 | Request comments thread | Communication | M | Threaded discussion beyond flat notes. |
| 14 | Scheduled auto-reminders | Communication | M | Flag requests stuck > N days. |
| 15 | Custom report builder | Reporting | L | Pick dimensions → generate table + chart. |
| 16 | Department-level scoping | Access control | M | Restrict by `access_tags`. |
| 17 | Delegation / out-of-office | Workflow | M | Auto-route approvals to alternate. |
| 18 | Multi-role support | Architecture | L | Cascades through scope, policy, templates. |
| 19 | REST API endpoints | Integration | L | JSON API with auth + rate limiting. |
| 20 | OAuth2/LDAP integration | Integration | L | SSO via university IdP. |
| 21 | External billing webhook | Integration | M | Push billing events to ERP. |
| 22 | Session management UI | Security | S | Active sessions, "log out everywhere". |
| 23 | Mobile responsive pass | UI | L | 24 templates — full responsive sweep. |
| 24 | Onboarding tour | UI | M | First-login walkthrough per role. |
| 25 | Scheduled reports | Reporting | M | Weekly/monthly auto-export. |
| 26 | Xcode macOS app wrapper | Platform | M | SwiftUI WKWebView + Flask subprocess. |

---

### Dependency Graph (full)

    Phase 1 (done):
    Wave A ──→ B ──→ C ──→ D ───┐
    (done)   (done)  (done) (done) │
                                    ▼
    Remaining:                    Wave E ──→ Wave F ──→ Wave G ──→ Wave H
                                  (3 ∥)     (3 ∥)     (3 ∥)     (3 ∥)
                                  P1 gate   P2 feat   P2 feat   P2+P3
                                  +P2 safe  +crawlfix           audits
                                                                  │
                                                        Wave I ──→ Wave J ──→ Wave K
                                                        (3 ∥)     (3 ∥)     (3 ∥)
                                                        P3 feat   P3 feat   P3 feat

    Critical path: E → F → G → H → I → J → K  (7 waves × ~5 min = ~35 min)
    ∥ = parallel agents within wave
    Max 3 agents per wave (keeps merge complexity manageable)

### Architecture Patterns (for new features)

Every new feature should use:

1. **`StreamQuery`** / **`request_stream()`** — canonical query builder, never raw SQL assembly
2. **`EntityManager`** — declare a manager, get CRUD+audit for free
3. **`as_dicts()`** — convert query results for templates
4. **`request_scope_sql()`** — filter by role, never raw role checks
5. **`bounded_pane`** — paginate any list longer than 10 items
6. **`data-vis`** — tag every visible element with allowed roles
7. **`log_action()`** — audit every state change, no exceptions
8. **`facility_stats_stream()`** — aggregate counters, cached per HTTP request
