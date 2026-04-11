# PRISM — Architecture Specification

**Version 1.2.0**

A request-tracking and operator-workflow system for MIT-WPU's
Department of Research & Development. One Python process, one
SQLite database, browser-based interface.

This file is the **current architecture spec** — what the system
*is*, not how it got here. Read `README.md` for the release
overview and roadmap, `TODO_AI.txt` for the forward plan,
`CHANGELOG.md` for the version history, `git log` for the
commit-level history. The roadmap does not live here.

A competent developer reading this file alongside `app.py` should
be able to understand every architectural decision.

**AI agents: start with `AGENTS.md`.** The project-root `AGENTS.md`
file is the vendor-neutral onboarding contract for any AI coding
agent (Claude, Codex, Gemini, Cursor, Continue, Aider, Copilot,
Windsurf). It covers topology, commit rhythm, the pre-commit gate,
the hard/soft attribute contract, demo/operational separation,
security invariants, and the docs manifest. This file (`PROJECT.md`)
is the deeper architecture spec that `AGENTS.md` §9 points at for
schema, page map, helper catalog, state machine, and security
model detail.

---

## 1. Philosophy

**The Request Card.** Every sample request is a card. The card is
created when a requester submits a job and accumulates all data over
its lifetime: approvals, notes, files, operator actions, timestamps,
results. Nothing is stored separately — the card is the single
source of truth for that job.

**Sliced visibility.** The same cards form a single queue. Every
page on the site is a filtered, role-appropriate slice of that
queue. The Queue page (`/schedule`) is the canonical view; the Home
dashboard, Instrument detail, Calendar, and Statistics pages are
derived views. There is no data duplication between pages.

**Tiles, not pages.** Each concern is a self-contained widget tile
on a fluid grid. No mixed concerns inside one card. Reference
implementation: `templates/instrument_detail.html` — 10 tiles on a
6-column grid. Match its rhythm everywhere.

**Pagination, never scroll.** Long lists use the `paginated_pane`
macro. No `overflow: auto` inside content panes.

**Macros over markup.** If a pattern shows up twice, it becomes a
macro. Templates compose; they do not duplicate. The 8 widget
macros in `_page_macros.html` are the canonical building blocks.

**Visibility is sliced server-side first.** `data-vis` is a safety
net for the visual layer, not the security gate. The server never
returns data the user is not authorised to see.

**LAN-first.** This is a lightweight internal tool. It runs on a
single machine on the local network. There is no cloud dependency,
no external authentication provider, no CDN. The design favours
simplicity and maintainability.

---

## 2. Technology

| Component   | Choice                                  |
|-------------|-----------------------------------------|
| Language    | Python 3.9+ (tested on 3.9.6 and 3.14)  |
| Framework   | Flask 3.1 + Flask-WTF (CSRF)            |
| Database    | SQLite (`lab_scheduler.db`, git-ignored) |
| Templates   | Jinja2 with auto-escape                  |
| Styles      | Single CSS file (`static/styles.css`)   |
| JavaScript  | Vanilla JS, FullCalendar, Chart.js      |
| Server      | Flask dev server, port 5055             |
| Excel I/O   | openpyxl                                 |

No build step. No bundler. No transpiler. Dependencies in
`requirements.txt`; install via `venv/bin/pip install -r requirements.txt`.

---

## 3. User Roles

Roles are hierarchical. A higher role inherits all capabilities of
lower roles unless otherwise noted.

| Role                  | Scope                | Purpose                                                       |
|-----------------------|----------------------|---------------------------------------------------------------|
| `requester`           | Own cards            | Submit requests, track own jobs                               |
| `finance_admin`       | Finance steps        | Approve / reject finance approval steps                       |
| `professor_approver`  | All cards            | Approve / reject faculty approval steps                       |
| `faculty_in_charge`   | Assigned instruments | Faculty oversight of specific instruments (junction table)    |
| `operator`            | Assigned instruments | Run instruments, receive samples, complete jobs               |
| `instrument_admin`    | Assigned instruments | Manage instrument settings, operators, approval chains        |
| `site_admin`          | All                  | Full operational access; cannot create users                  |
| `super_admin`         | All                  | Full access including user management                         |

Owner status is determined by email match against the `OWNER_EMAILS`
environment variable, not by role. Owners bypass all restrictions.

### Visibility surface

Two layers, both load-bearing:

- **Server-side** — `request_card_policy()` returns `fields` and
  `actions` sets per (user, request) pair. The handler never returns
  data the user is not authorised to see. `request_scope_sql()`
  returns `(clauses, params)` to filter queries by role.
- **Client-side** — every visible HTML element carries
  `data-vis="{{ V }}"`. JS hides the element on page load if the
  user's role is not in the list. Tested by the visibility audit
  (`crawlers/strategies/visibility.py`), 171/171 baseline.

`user_access_profile(user)` returns a dict of boolean capabilities
that templates use to show/hide nav items, page sections, and
dashboard widgets.

---

## 4. Request Lifecycle

A card moves through these statuses in order. Each transition is
guarded by `assert_status_transition(current, target)` and logged
in the immutable audit trail.

```
submitted
  │  (instrument accepting → auto-create approval chain)
  ▼
under_review
  │  Finance → Professor → Operator (each approval_step in turn)
  │  Any rejection → rejected
  ▼
awaiting_sample_submission
  │  Requester marks physical sample delivered
  ▼  ────────────────────────┐
sample_submitted              │  (operator quick-receive
  │                           │   fast-track)
  │  Operator confirms        │
  │  receipt                  │
  ▼  ◄───────────────────────┘
sample_received
  │  Operator assigns schedule time
  ▼
scheduled
  │  Operator starts work
  ▼
in_progress
  │  Operator completes with results
  ▼
completed (record locked, completion_locked = 1)

rejected   (terminal — any approval rejection or manager override)
cancelled  (terminal — requester withdrawal before sample-received)
```

### State machine — `REQUEST_STATUS_TRANSITIONS`

The dict in `app.py` is the single source of truth for legal moves.
Every site that mutates `sample_requests.status` calls
`assert_status_transition()` first. Admin overrides
(`admin_schedule_override`, `admin_complete_override`,
manager `reject`) pass `force=True` to bypass the check.

Same-status writes (e.g. re-scheduling at a different time, still
`scheduled`) are idempotent.

`InvalidStatusTransition` is registered as a Flask error handler
that turns the exception into a flash + redirect to the referrer.

### Approval Chain

Default sequence: Finance → Professor → Operator. Configurable per
instrument via `instrument_approval_config`. Steps execute in
strict order; a step cannot be actioned until all prior steps are
approved. The chain is created by `create_approval_chain()` when a
request enters `under_review`.

---

## 5. Database Schema

15 tables. Foreign keys are enforced (`PRAGMA foreign_keys = ON`).
22 indexes cover the hot query paths (status filters, instrument
scoping, approval step joins, audit log entity scans, attachment
filters, junction lookups).

### `users`
`id`, `name`, `email` (unique), `password_hash`, `role`, `invited_by`,
`invite_status` (`active` | `invited`), `active` (0|1), `member_code`.

### `instruments`
`id`, `name`, `code` (unique), `category`, `location`,
`daily_capacity`, `status` (`active` | `archived`), `notes`,
`office_info`, `faculty_group`, `manufacturer`, `model_number`,
`capabilities_summary`, `machine_photo_url`, `reference_links`,
`instrument_description`, `accepting_requests` (0|1),
`soft_accept_enabled` (0|1).

### `instrument_admins`, `instrument_operators`, `instrument_faculty_admins`
Junction tables. `(user_id, instrument_id)` primary key on each.
`assigned_instrument_ids(user)` reads all three with a `UNION`,
result cached in Flask `g` per request.

### `sample_requests`
The big one — 30+ columns. Every captured field about a request:
identifiers (`request_no`, `sample_ref`), people (`requester_id`,
`created_by_user_id`, `received_by_operator_id`,
`assigned_operator_id`), classification (`title`, `sample_name`,
`sample_count`, `sample_origin` internal/external, `material`,
`sample_nature`, `safety_flag`, `data_format`, `guide_name`),
finance (`receipt_number`, `amount_due`, `amount_paid`,
`finance_status`), workflow state (`status`, `priority`,
`completion_locked`, the 5 timestamp columns from
`submitted_to_lab_at` through `completed_at`), and free-text
(`description`, `originator_note`, `sample_dropoff_note`, `remarks`,
`results_summary`).

### `approval_steps`
`id`, `sample_request_id`, `step_order`, `approver_role`
(`finance` | `professor` | `operator`), `approver_user_id`,
`status` (`pending` | `approved` | `rejected`), `remarks`, `acted_at`.

### `audit_logs`
`id`, `entity_type`, `entity_id`, `action`, `actor_id`,
`payload_json`, `prev_hash`, `entry_hash`, `created_at`.

SHA-256 hash chain: each entry's `entry_hash` covers
`prev_hash | entity_type | entity_id | action | payload`.
`verify_audit_chain(entity_type, entity_id)` walks the chain and
returns False if any link is broken. The chain is the load-bearing
proof of immutability.

### `request_attachments`
File uploads. `id`, `request_id`, `user_id`, `instrument_id`,
`original_filename`, `stored_filename`, `relative_path`,
`file_extension`, `mime_type`, `file_size`, `uploaded_by_user_id`,
`uploaded_at`, `attachment_type` (`request_document` | `sample_slip`
| `result_document` | `invoice` | `other`), `note`, `is_active`,
`request_message_id`.

### `request_messages`
Communication thread. `id`, `request_id`, `sender_user_id`,
`note_kind` (`requester_note` | `lab_reply` | `operator_note` |
`final_note`), `message_body`, `created_at`, `is_active`.

### `request_issues`
Flag → respond → resolve cycle. `id`, `request_id`,
`created_by_user_id`, `issue_message`, `response_message`,
`status` (`open` | `responded` | `resolved`), and the matching
actor / timestamp columns.

### `instrument_downtime`
`id`, `instrument_id`, `start_time`, `end_time`, `reason`,
`created_by_user_id`, `created_at`, `is_active`. Drives the
calendar maintenance overlay and the dashboard upcoming-downtime
tile.

### `instrument_approval_config`
`id`, `instrument_id`, `step_order`, `approver_role`,
`approver_user_id`. Per-instrument override of the default
Finance → Professor → Operator chain.

### `generated_exports`
`id`, `filename`, `created_by_user_id`, `created_at`, `scope_label`.
Records every Excel export generated by `/visualizations/export`
so users can re-download recent reports.

### `announcements`
`id`, `title`, `body`, `priority`, `created_by_user_id`,
`created_at`, `is_active`. Site-wide notices on the dashboard.

---

## 6. Page Map

| Route                                       | Template                  | Auth         | Purpose                                       |
|---------------------------------------------|---------------------------|--------------|-----------------------------------------------|
| `GET /`                                     | `dashboard.html`          | login        | Home: KPIs, instrument tiles, upcoming        |
| `GET /instruments`                          | `instruments.html`        | login        | List instruments                              |
| `POST /instruments`                         | —                         | admin        | Create instrument                             |
| `GET/POST /instruments/<id>`                | `instrument_detail.html`  | login        | 10-tile instrument page                       |
| `GET /instruments/<id>/history`             | redirect → `/schedule`    | view         | Queue filtered by instrument                  |
| `GET /instruments/<id>/calendar`            | redirect → `/calendar`    | view         | Calendar filtered by instrument               |
| `GET /schedule`                             | `schedule.html`           | login        | **The Queue** — central working page          |
| `POST /schedule/actions`                    | —                         | varies       | Per-row queue actions                         |
| `POST /schedule/bulk`                       | —                         | varies       | Bulk-action tile                              |
| `GET /requests/new`                         | `new_request.html`        | login        | Submit new request                            |
| `GET/POST /requests/<id>`                   | `request_detail.html`     | login        | Full card view + 14 actions                   |
| `POST /requests/<id>/quick-receive`         | JSON                      | operator     | Operator fast-track sample receive            |
| `GET /requests/<id>/duplicate`              | redirect                  | login        | "Submit similar" pre-fill                     |
| `GET /requests/<id>/calendar-card`          | partial                   | login        | Hover tooltip on calendar                     |
| `GET /calendar`                             | `calendar.html`           | login        | FullCalendar with drag-drop                   |
| `GET /calendar/events`                      | JSON                      | login        | Calendar event feed                           |
| `GET /stats`                                | `stats.html`              | login        | Statistics dashboard                          |
| `GET /visualizations`                       | `visualization.html`      | login        | Data view with export                         |
| `POST /visualizations/export`               | —                         | login        | Generate Excel report                         |
| `GET /visualizations/instrument/<id>`       | `visualization.html`      | view         | Per-instrument visualization                  |
| `GET /visualizations/group/<group>`         | `visualization.html`      | login        | Per-group visualization                       |
| `GET /history/processed`                    | redirect → `/schedule`    | login        | Legacy → completed bucket                     |
| `GET /my/history`                           | redirect → `/schedule`    | login        | Legacy → own requests                         |
| `GET /me`                                   | redirect                  | login        | Own profile                                   |
| `GET /users/<id>`                           | `user_detail.html`        | login        | User profile                                  |
| `GET /users/<id>/history`                   | redirect → `/schedule`    | super_admin  | Queue filtered by requester                   |
| `GET/POST /admin/users`                     | `users.html`              | super_admin  | User management                               |
| `POST /profile/change-password`             | —                         | login        | Self-service password change                  |
| `GET /sitemap`                              | `sitemap.html`            | login        | Settings + nav map                            |
| `GET /docs`                                 | `docs.html`               | login        | In-app project doc viewer                     |
| `GET /login`, `POST /login`                 | `login.html`              | public       | Sign in                                       |
| `GET /logout`                               | redirect                  | login        | Sign out                                      |
| `GET /activate`                             | `activate.html`           | public       | Invitation activation                         |
| `GET /attachments/<id>/download`            | file                      | login        | Download attachment                           |
| `GET /attachments/<id>/view`                | file                      | login        | View attachment inline                        |
| `POST /attachments/<id>/delete`             | —                         | varies       | Soft-delete attachment                        |
| `GET /exports/<filename>`                   | file                      | login        | Download generated Excel                      |
| `POST /exports/generate`                    | —                         | login        | Trigger Excel generation                      |
| `GET /api/health-check`                     | JSON                      | public       | Liveness probe                                |
| `GET /demo/switch/<role>`                   | redirect                  | login + DEMO | Role impersonation (gated by `DEMO_MODE`)     |
| `GET/POST /prism/save`, `/prism/log`, `/prism/clear` | JSON             | login        | Crawler agent endpoints                       |

42 routes total. Auth column: **login** = `@login_required`,
**view/manage/operate** = `@instrument_access_required(level)`,
**admin** = role check inside the handler, **super_admin** =
`@role_required("super_admin")`, **DEMO** = gated by `LAB_SCHEDULER_DEMO_MODE`.

---

## 7. File Structure

```
Main/
├── app.py                       Single application file (~6,750 lines)
├── lab_scheduler.db             SQLite database (git-ignored, auto-created)
├── README.md                    Release overview, running, testing, crawler suite
├── PROJECT.md                   This file — architecture spec
├── CHANGELOG.md                 Version history (semver)
├── TODO_AI.txt                  Forward plan (next versions only)
├── .env.example                 Every environment flag PRISM reads
├── SECURITY_TODO.md             Hardening checklist + HTTPS migration
├── CRAWL_PLAN.md                Test strategy reference
├── ROLE_VISIBILITY_MATRIX.md    Visibility audit reference
├── CSS_COMPONENT_MAP.md         CSS class catalog
├── start.sh                     Auto-restart server launcher with logs
├── view_readme.py               Local README web viewer (port 5088)
├── requirements.txt             Python dependencies
├── .gitignore
│
├── crawlers/                    Pluggable test strategy package
│   ├── __init__.py
│   ├── __main__.py              `python -m crawlers list|run|wave …`
│   ├── core/
│   └── strategies/              Each strategy is one .py file
│       ├── visibility.py        8 roles × 12 pages access matrix
│       ├── role_landing.py      Role-hint badge on dashboard + sitemap
│       ├── role_behavior.py     Behavioural RBAC (each role's defining action)
│       ├── topbar_badges.py     Topbar count badges only when role has pending items
│       ├── empty_states.py     Empty tables render shared empty-state card + CTA
│       ├── dev_panel_readability.py Dev console hero tile + hot-wave + reports freshness
│       ├── lifecycle.py         End-to-end request lifecycle
│       ├── dead_link.py         BFS href harvest across 4 roles
│       ├── random_walk.py       MCMC walk over (role × route), ~800 steps
│       ├── performance.py       p50/p95/max budgets on hot routes
│       ├── slow_queries.py      Per-SQL timing (50ms warn, 250ms fail)
│       ├── contrast_audit.py    WCAG AA palette check (light + dark)
│       ├── color_improvement.py Palette / contrast drift hunter
│       ├── architecture.py      Handler / template / decorator budgets
│       ├── philosophy_propagation.py Tile / vis / deprecated-class audit
│       ├── css_orphan.py        Unused selector scan
│       ├── cleanup.py           Dead Python / template / file hunter
│       ├── approver_pools.py    Round-robin approver assignment integrity
│       ├── smoke.py             Pre-push regression (critical paths × 3 roles)
│       └── deploy_smoke.py      Probe PRISM_DEPLOY_URL for /login + /sitemap
│
├── reports/                     Crawler output (JSON + plain-text)
├── logs/                        Server logs (start.sh writes here)
│
├── static/
│   ├── styles.css               All CSS (~7,150 lines, light + dark themes)
│   ├── grid-overlay.js          Dev-only grid debug overlay
│   ├── manifest.json            PWA manifest
│   ├── favicon.ico
│   ├── instrument-placeholder.svg
│   ├── mitwpu-logo.webp
│   ├── instrument_images/       Uploaded instrument photos
│   └── vendor/                  Pinned vendor assets
│
├── templates/                   27 .html files
│   ├── base.html                Layout: topbar, nav, theme toggle, CSRF, toasts
│   ├── _page_macros.html        8 widget macros
│   ├── _request_macros.html     Card display macros
│   ├── dashboard.html
│   ├── instruments.html
│   ├── instrument_detail.html   Reference 10-tile architecture
│   ├── instrument_config.html
│   ├── schedule.html            The Queue
│   ├── new_request.html
│   ├── request_detail.html      The Card
│   ├── calendar.html
│   ├── calendar_card.html
│   ├── stats.html
│   ├── visualization.html
│   ├── user_detail.html
│   ├── users.html
│   ├── pending.html
│   ├── finance.html
│   ├── notifications.html
│   ├── login.html
│   ├── activate.html
│   ├── change_password.html
│   ├── sitemap.html
│   ├── docs.html
│   └── error.html
│
├── uploads/                     Request files (git-ignored)
│   └── users/<uid>/requests/<req>/attachments/
└── exports/                     Generated Excel reports (git-ignored)
```

---

## 8. File Upload System

Each request gets a folder:
`uploads/users/<user_id>/requests/req_<id>_<request_no>/attachments/`

- **Allowed extensions:** pdf, png, jpg, jpeg, xlsx, csv, txt
- **Max upload:** 100 MB per file (`MAX_CONTENT_LENGTH` config)
- **Served through Flask**, never as direct static files (audit + access control)

A sample slip PDF is auto-generated on request creation and stored
as `attachment_type=sample_slip`.

A `request_metadata.json` snapshot is written to the request folder
after every meaningful state change. It contains the complete card
state and serves as an offline backup if the SQLite database is
ever lost.

---

## 9. Communication

Four note types on each card:

| Type             | Author         | Visible to     |
|------------------|----------------|----------------|
| `requester_note` | Requester      | Lab staff      |
| `lab_reply`      | Lab staff      | Requester      |
| `operator_note`  | Operator/admin | Lab staff only |
| `final_note`     | Operator/admin | Requester      |

Issue tracking is a separate flag → respond → resolve cycle stored
in `request_issues` (open / responded / resolved).

---

## 10. Security

### Current state

- **Session auth.** 12-hour lifetime, HttpOnly cookies, `SameSite=Lax`,
  `Secure` toggled by `LAB_SCHEDULER_COOKIE_SECURE` env var for HTTPS
  deployments.
- **Password hashing.** `werkzeug.security.generate_password_hash`
  with pbkdf2:sha256.
- **Parameterized SQL everywhere.** No string concatenation in any
  query.
- **File upload whitelist.** Extension check via `allowed_file()`
  before any file touches disk.
- **Immutable audit log.** SHA-256 hash chain over every state
  change. `verify_audit_chain()` walks the chain.
- **Two-layer authorization.** Server-side `request_card_policy()`
  + `request_scope_sql()` is the security boundary; client-side
  `data-vis` is visual uniformity, never trusted.
- **CSRF token machinery in place** via Flask-WTF `CSRFProtect`.
  Enforcement gated by `LAB_SCHEDULER_CSRF=1`. base.html emits the
  meta tag and a JS shim auto-injects the token into form submits
  and `fetch()` calls.
- **XSS-safe templates.** Jinja auto-escape is on globally.
  `metadata_grid` escapes string values; HTML must be wrapped in a
  `{% set var %}...{% endset %}` block (produces `Markup`).
- **Login rate limit.** 10 attempts per 5 minutes per IP, in-memory.
- **`@instrument_access_required(level)`** decorator gates every
  route that takes `<int:instrument_id>`. Returns 404 if missing,
  403 if denied.
- **`DEMO_MODE` flag** gates `/demo/switch/*` and `seed_data()` —
  flip via `LAB_SCHEDULER_DEMO_MODE=0` for production.
- **PWA + accessibility polish.** Manifest, theme-color light/dark,
  apple-touch-icon, skip-nav link, ARIA on the instrument dropdown.
- See `SECURITY_TODO.md` for the deployment / hardening checklist.

### Architecture: two-layer authorization

**Layer 1 — Server-side (mandatory, enforces security).**
Every route in `app.py` checks the session user against
`ROLE_ACCESS_PRESETS` and `request_card_policy()`. The server never
renders or returns data the user is not authorised to see. Jinja
`{% if %}` blocks gate template sections. This layer is the security
boundary.

**Layer 2 — Client-side `data-vis` (visual uniformity, not security).**
Every HTML element carries a `data-vis="role1 role2 …"` attribute
that declares which roles may see it. A JS engine on page load
hides elements whose roles do not match. This gives uniform visual
structure (the "blobs-within-blobs" philosophy). It is never
trusted as a security mechanism — a user who inspects the DOM will
only find data the server already authorised them to have.

---

## 11. Reusable abstractions

These are the load-bearing helpers in `app.py`. Every new wave
should pick the relevant one off this list rather than inventing
a parallel approach.

### Data access

- **`query_one(sql, params)`**, **`query_all(sql, params)`**,
  **`execute(sql, params)`** — thin wrappers around the request-scoped
  SQLite connection in Flask `g`.
- **`get_db()`** — returns the request-scoped `sqlite3.Connection`
  with `row_factory = Row` and `PRAGMA foreign_keys = ON`.
- **`REQUEST_DETAIL_JOINS`**, **`REQUEST_ATTACHMENTS_JOIN`** — string
  constants holding the canonical 6-line FROM/JOIN block. Aliases
  `sr / i / r / c / op / recv` are load-bearing across every caller.

### Authorization & scope

- **`request_scope_sql(user, alias="sr")`** — returns
  `(clauses: list[str], params: list)` to filter `sample_requests`
  by the user's role. Always called with an alias.
- **`assigned_instrument_ids(user)`** — list of instrument IDs the
  user has any role on. Cached in Flask `g` per request.
- **`can_view_request(user, sample_request)`**,
  **`can_manage_instrument(user_id, instrument_id, role)`**,
  **`can_operate_instrument(...)`**,
  **`can_view_instrument_history(...)`**,
  **`can_open_instrument_detail(...)`** — permission predicates.
- **`request_card_policy(user, sample_request)`** — returns the
  `fields` and `actions` sets that templates use to render the card.
- **`@instrument_access_required(level)`** — decorator that fetches
  the instrument, runs the permission check, returns 404 / 403, and
  injects `instrument` into the view.
- **`@login_required`**, **`@role_required(*roles)`**,
  **`@owner_required`** — decorators for the simpler gates.
- **`@rate_limit(max=N, window=S)`** — generic per-IP rate limit.

### State machine

- **`REQUEST_STATUS_TRANSITIONS`** — dict mapping current → set of
  legal targets. Single source of truth.
- **`assert_status_transition(current, target, force=False)`** — raises
  `InvalidStatusTransition` if the move is illegal. Admin overrides
  pass `force=True`.
- **`InvalidStatusTransition`** — registered as an error handler that
  flashes the message and redirects to the referrer.
- **`build_request_status(db, request_id)`** — recomputes the
  canonical status from the approval steps + sample timestamps.

### Audit

- **`log_action(actor_id, entity_type, entity_id, action, payload)`**,
  **`log_action_at(..., created_at)`** — append to the audit chain.
  Every state change must call this.
- **`verify_audit_chain(entity_type, entity_id)`** — walk the chain
  and return False if any link is broken.

### Stats

- **`facility_stats_stream()`** — per-request cached aggregator for
  facility-wide metrics. Computed once, cached in Flask `g`. All
  pages read from this stream.
- **`stats_payload_for_scope(user, filters, instrument_id=None, group_name=None)`**
  — scope-aware version that powers `/stats`,
  `/visualizations/instrument/<id>`, and `/visualizations/group/<group>`.

### Demo / dev gating

- **`DEMO_MODE`** — module-level constant, set from
  `LAB_SCHEDULER_DEMO_MODE`. Used by `/demo/switch` and `seed_data()`.

### Templates (in `_page_macros.html`)

- **`card_heading(prefix, title)`** — uniform tile header.
- **`paginated_pane(id, page_size, max_height, css_class)`** —
  every long list. Never use `overflow: auto`.
- **`metadata_grid(items, compact=False)`** — `<dl>` grid for
  label/value pairs. Auto-escapes strings; wrap HTML in
  `{% set var %}...{% endset %}` for `Markup`.
- **`kpi_grid(items, variant)`** — KPI counter row.
- **`status_pills_row(pills, active, on_change)`** — filter pill bar.
- **`queue_action_stack(row, operators, can_accept, can_assign)`** —
  per-row Accept Sample + Quick Assign forms.
- **`person_chip(name, user_id, size, link)`** — avatar + name.
- **`approval_action_form(step, allow_file, allow_note)`** —
  approve / reject form for one approval step.
- **`activity_feed(entries, pane_id, page_size, threaded)`** —
  timeline pattern.
- **`empty_state(...)`** — every list / table needs an empty branch.

### Page layout — the `.*-tiles` tile grid family

Every non-trivial content page composes itself as a **tile grid**.
This is the canonical multi-region layout abstraction — pick it
up, do not invent a parallel flex/grid recipe.

**The pattern.** A page-level `<section class="<name>-tiles">`
wrapper uses:

```css
display: grid;
grid-template-columns: repeat(6, minmax(0, 1fr));
gap: 1rem;
grid-auto-flow: row dense;
```

Children are `<article class="card tile tile-<role>">` blocks
carrying span rules (`.tile-info { grid-column: span 4; }`,
`.tile-queue { grid-column: 1 / -1; }`, etc.). Every family
collapses to a single column at `@media (max-width: 760px)` via
`grid-template-columns: 1fr` and `.tile > { grid-column: 1 / -1 }`.
`.inst-tiles` has an additional 4-column breakpoint at 1200px
(`static/styles.css:3435`); the request and new-request variants
go straight from 6 → 1.

**The three live instances.**

- **`.inst-tiles`** — `templates/instrument_detail.html:24`,
  CSS at `static/styles.css:3395`. 10 tiles (info, stats,
  control, team, approval, queue, downtime, activity, edit,
  danger). The reference implementation.
- **`.request-tiles`** — `templates/request_detail.html:56`,
  CSS at `static/styles.css:4758`. 8 tiles (header, meta,
  actions, approvals, files, samples, events, …). Adds an
  intermediate 4-column breakpoint at 1100px.
- **`.new-request-tiles`** — `templates/new_request.html:16`,
  CSS at `static/styles.css:1018`. 2 full-width tiles
  (`tile-new-request-context`, `tile-new-request-form`).
  Graduated onto the pattern in commit `a9825b8`
  (2026-04-11, "feat(ui): new_request — graduate sample form
  onto the tile pattern"); no longer exempt from the crawler.

**When to use it.** Any content page composing more than one
semantic region (header + list, form + context, detail + history).
Pick a family-specific class name (`.<page>-tiles`) and reuse the
shared `.tile` / span vocabulary.

**When NOT to use it.** Single-form dialogs, error pages, login /
logout, and `notifications.html` (one feed, no multi-tile
composition). The exempt list lives in `NO_TILE_GRID_OK` at
`crawlers/strategies/philosophy_propagation.py:57` and is
currently `{change_password.html, notifications.html}`. Adding to
this set is a policy decision — do not expand it casually.

**Enforcement.** The `philosophy` crawler's rule 2
(`crawlers/strategies/philosophy_propagation.py:98`) greps every
non-exempt template for `class="[^"]*-tiles[^"]*"` and warns
`missing_tile_grid` if absent. Any new page-level template either
gets a tile grid or gets justified into `NO_TILE_GRID_OK` with a
comment.

---

## 12. Testing

Three regression gates that block a merge:

1. **`venv/bin/python test_visibility_audit.py`** — 8 roles × ~12
   pages access matrix. **171/171 baseline**, must stay green.
2. **`venv/bin/python test_populate_crawl.py`** — 500 actions
   end-to-end starting from a blank database. 0 5xx, 0 exceptions.
3. **`venv/bin/python -m crawlers wave <name>`** — strategy-specific
   waves (smoke, philosophy, dead-link, …) for pre-push sanity.

A wave is not "done" until 1 + 2 are still green.

The `crawlers/` package is the test infrastructure. Each strategy
is one Python file registered against an aspect (visibility,
lifecycle, coverage, performance, accessibility, dead_links,
css_hygiene, regression, data_integrity). Drop in a new file,
import it in `crawlers/strategies/__init__.py`, and the CLI picks
it up automatically. Every run writes a JSON log + plain-text
summary under `reports/`.

Run `.venv/bin/python -m crawlers list` for the authoritative
inventory. As of v1.3.0 the suite has 20 strategies. The
`visibility` aspect in particular has grown to cover the whole
role-aware chrome: `visibility` (access matrix), `role_landing`
(dashboard/sitemap role badges), `role_behavior` (each role's
defining action), `topbar_badges` (pending-item counts only render
when the role has work), `empty_states` (empty tables use the
shared card + primary CTA), and `dev_panel_readability` (dev
console hero tile, hot-wave callout, reports freshness).

---

## 13. Environment variables

| Variable                       | Default                  | Purpose                                                  |
|--------------------------------|--------------------------|----------------------------------------------------------|
| `LAB_SCHEDULER_SECRET_KEY`     | dev secret               | Flask session signing key. Set in production.            |
| `LAB_SCHEDULER_COOKIE_SECURE`  | off                      | Set to `1` when serving HTTPS so cookies get `Secure`.   |
| `LAB_SCHEDULER_HTTPS`          | off                      | Tells Flask it is behind an HTTPS frontend (trust `X-Forwarded-Proto`, emit `https://` in `url_for`). Set when `tailscale serve` is in front. |
| `LAB_SCHEDULER_DEBUG`          | off                      | Flask debug mode + auto-reload.                          |
| `LAB_SCHEDULER_CSRF`           | off                      | Enable CSRF enforcement (machinery is always present).   |
| `LAB_SCHEDULER_DEMO_MODE`      | on                       | Demo accounts + `/demo/switch`. Set to `0` in prod.      |
| `OWNER_EMAILS`                 | `admin@lab.local`        | Comma-separated emails granted owner status.             |
| `SMTP_HOST`, `SMTP_PORT`       | `localhost`, `25`        | Outbound mail (currently used for completion emails).    |

`start.sh` reads `LAB_SCHEDULER_DEBUG` and `LAB_SCHEDULER_HTTPS` and
exports the rest from environment as-is.

---

## 14. Running

```bash
cd Main
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# Development (Chrome auto-open)
./scripts/start.sh

# launchd/systemd foreground service mode (no Chrome, .env sourced)
./scripts/start.sh --service
```

Open `http://127.0.0.1:5055`. Demo password for the seeded accounts
is `SimplePass123` (only present when `DEMO_MODE` is on).

HTTPS on the tailnet is delegated to `tailscale serve`; see
`docs/HTTPS.md` and `scripts/tailscale_serve.sh` for the recipe.

---

## 15. Versioning

PRISM uses [Semantic Versioning](https://semver.org). The version
in this file's header is the **architecture spec version** — bump
the minor when an architectural decision in §1–§14 changes, bump
the patch when a section is reworded without changing meaning.

The version of the codebase itself is recorded in `CHANGELOG.md`
and stamped into the running app via `app.config["PRISM_VERSION"]`
(planned for v1.3.0).

| Bump  | When                                                       |
|-------|------------------------------------------------------------|
| Major | Breaking change to schema, route contract, or auth model   |
| Minor | New user-facing capability, new architectural primitive    |
| Patch | Bug fix, doc-only change, internal cleanup                 |

Architectural changes that warrant a minor bump in this spec:
adding a new schema table, a new role, a new helper in §11, a new
macro in `_page_macros.html`, or a new layer in §10 (Security).
Patch bumps cover wording fixes and clarifications.

`README.md` carries the **release version** (currently 1.3.0). The
two versions usually move in lockstep but are tracked separately so
documentation work can ship without a code release.

---

## 16. Operator runtime policy (v1.3.0+)

See `DEPLOY.md` for the full deployment specification. The summary:

- **MacBook Pro** is the development machine. All editing, all
  testing, all crawler work runs here. `master` is the source of
  truth.
- **Mac mini** (`vishwajeet@100.115.176.118`, reachable via
  Tailscale) is the **production host**. It runs PRISM 24×7 and
  serves the website to every machine on the lab's Tailscale
  network. It does not run background jobs, cron, or any compute
  offload — it only hosts.
- Git is the only sync layer between the two machines. There is
  no live shared folder.
- Production deploys are atomic: `git pull` → smoke test →
  `launchctl kickstart`. Never interrupts live users. See
  `PHILOSOPHY.md` §3 — the website stays up.

Required commit loop on the MacBook:

1. `git pull --rebase`
2. work
3. `.venv/bin/python smoke_test.py`
4. commit
5. push
6. (optional) deploy to the mini per `DEPLOY.md` §3
