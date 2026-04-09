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

## 3. User Roles (9 roles total)

Roles are assigned per user. Owners (determined by `OWNER_EMAILS` env var) bypass all restrictions and have full access.

| Role | Scope | Key Permissions |
|------|-------|-----------------|
| `requester` | Own requests | Submit requests, view own cards, reply, upload attachments, mark sample submitted |
| `finance_admin` | All requests (finance only) | View all requests, access instruments, stats, calendar; approve/reject finance steps; view finance_data |
| `professor_approver` | All requests | View all requests, all instruments; approve/reject professor steps; view requester/operator identity |
| `faculty_in_charge` | Assigned instruments | View own instrument queue only; reply, upload; view profiles; no approval actions |
| `operator` | Assigned instruments | View own queue; mark received, reassign, finish jobs, update status; no view-all |
| `instrument_admin` | Assigned instruments | Manage instrument config; view own queue; all operator actions + update_status |
| `site_admin` | All requests + instruments | Full operational access (view all, all actions); no user management |
| `super_admin` | All | Full access including user creation, member elevation, role switching |
| `owner` | All | Full system access, determined by OWNER_EMAILS env var (not a database role) |

### Permission Matrix (derived from ROLE_ACCESS_PRESETS)

| Capability | requester | finance | professor | faculty | operator | inst_admin | site_admin | super_admin |
|------------|-----------|---------|-----------|---------|----------|------------|-----------|------------|
| Access Instruments page | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Access Schedule/Queue | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Access Calendar | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Access Stats | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Manage members | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Use role switcher | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| View all requests | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ |
| View all instruments | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ |
| View user profiles | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| View finance stage | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| View professor stage | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Card visible fields | Remarks, Results, Docs, Conversation, Events, Requester, Operator | Remarks, Docs, Conv, Events, Requester, Finance | Remarks, Results, Docs, Conv, Events, Requester, Operator | Remarks, Results, Docs, Conv, Events, Requester, Operator | Remarks, Results, Docs, Conv, Events, Requester, Operator | Remarks, Results, Docs, Conv, Events, Requester, Operator | Remarks, Results, Docs, Conv, Events, Requester, Operator | Remarks, Results, Docs, Conv, Events, Requester, Operator |
| Card actions | Reply, Upload, Mark Submitted | Reply, Upload | Reply, Upload | Reply, Upload | Reply, Upload, Finish Fast, Reassign, Mark Received | Reply, Upload, Finish Fast, Reassign, Mark Received, Update Status | Reply, Upload, Finish Fast, Reassign, Mark Received, Update Status | Reply, Upload, Finish Fast, Reassign, Mark Received, Update Status |

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

15 tables. All have foreign key enforcement.

### users
`id` (PK), `name`, `email` (UNIQUE), `password_hash`, `role`, `invited_by`, `invite_status` (active|invited), `active` (0|1), `member_code`.

### instruments
`id` (PK), `name`, `code` (UNIQUE), `category`, `location`, `daily_capacity`, `status` (active|archived), `notes`, `office_info`, `faculty_group`, `manufacturer`, `model_number`, `capabilities_summary`, `machine_photo_url`, `reference_links`, `instrument_description`, `accepting_requests` (0|1), `soft_accept_enabled` (0|1).

### instrument_admins
`user_id`, `instrument_id`. Primary key (user_id, instrument_id). Junction table for admin assignments. Foreign keys on both sides with CASCADE delete.

### instrument_operators
`user_id`, `instrument_id`. Primary key (user_id, instrument_id). Junction table for operator assignments. Foreign keys on both sides with CASCADE delete.

### instrument_faculty_admins
`user_id`, `instrument_id`. Primary key (user_id, instrument_id). Junction table for faculty oversight. Foreign keys on both sides with CASCADE delete.

### sample_requests
`id` (PK), `request_no` (UNIQUE), `sample_ref` (UNIQUE), `requester_id` (FK users), `created_by_user_id` (FK users), `originator_note`, `instrument_id` (FK instruments), `title`, `sample_name`, `sample_count`, `description`, `sample_origin` (internal|external), `receipt_number`, `amount_due` (REAL), `amount_paid` (REAL), `finance_status`, `priority` (normal|urgent), `status`, `submitted_to_lab_at`, `sample_submitted_at`, `sample_received_at`, `sample_dropoff_note`, `received_by_operator_id` (FK users), `assigned_operator_id` (FK users), `scheduled_for`, `remarks`, `results_summary`, `result_email_status`, `result_email_sent_at`, `completion_locked` (0|1), `created_at`, `updated_at`, `completed_at`.

### approval_steps
`id` (PK), `sample_request_id` (FK sample_requests, CASCADE), `step_order`, `approver_role` (finance|professor|operator), `approver_user_id` (FK users), `status` (pending|approved|rejected), `remarks`, `acted_at`.

### request_messages
`id` (PK), `request_id` (FK sample_requests, CASCADE), `sender_user_id` (FK users), `note_kind` (requester_note|lab_reply|operator_note|final_note), `message_body`, `created_at`, `is_active` (0|1).

### request_attachments
`id` (PK), `request_id` (FK sample_requests, CASCADE), `user_id` (FK users), `instrument_id` (FK instruments), `original_filename`, `stored_filename`, `relative_path`, `file_extension`, `mime_type`, `file_size`, `uploaded_by_user_id` (FK users), `uploaded_at`, `attachment_type` (request_document|sample_slip|result_document|invoice|other), `note`, `is_active` (0|1), `request_message_id` (FK request_messages).

### request_issues
`id` (PK), `request_id` (FK sample_requests, CASCADE), `created_by_user_id` (FK users), `issue_message`, `response_message`, `status` (open|responded|resolved), `created_at`, `responded_at`, `responded_by_user_id` (FK users), `resolved_at`, `resolved_by_user_id` (FK users).

### instrument_downtime
`id` (PK), `instrument_id` (FK instruments, CASCADE), `start_time`, `end_time`, `reason`, `created_by_user_id` (FK users), `created_at`, `is_active` (0|1).

### generated_exports
`id` (PK), `filename` (UNIQUE), `created_by_user_id` (FK users), `created_at`, `scope_label`.

### instrument_approval_config
`id` (PK), `instrument_id` (FK instruments, CASCADE), `step_order`, `approver_role`, `approver_user_id` (FK users). Unique constraint (instrument_id, step_order).

### audit_logs
`id` (PK), `entity_type`, `entity_id`, `action`, `actor_id` (FK users), `payload_json`, `prev_hash`, `entry_hash`, `created_at`.

SHA-256 hash chain: each entry's `entry_hash` covers `prev_hash|entity_type|entity_id|action|payload`. The function `verify_audit_chain()` validates integrity.

### announcements
`id` (PK), `title`, `body`, `priority` (info|warning|error), `created_by_user_id` (FK users), `created_at`, `is_active` (0|1).

---

## 6. Routes (41 total)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | Dashboard: stats, instrument queues, recent jobs |
| GET | `/instruments` | List all instruments by category |
| POST | `/instruments` | Create new instrument |
| GET | `/instruments/<int:instrument_id>` | Instrument detail: info, queue, stats, admin panel |
| POST | `/instruments/<int:instrument_id>` | Update instrument settings |
| GET | `/instruments/<int:instrument_id>/history` | Redirect to `/schedule?instrument_id=...` |
| GET | `/instruments/<int:instrument_id>/calendar` | Redirect to `/calendar?instrument_id=...` |
| GET | `/schedule` | **The Queue** — master list of all requests, sorted, filterable |
| POST | `/schedule/actions` | Quick inline actions from queue (approve, reject, assign, etc.) |
| GET | `/requests/new` | New request form |
| POST | `/requests/new` | Submit new request |
| GET | `/requests/<int:request_id>` | Full request card: metadata, approvals, files, messages, actions |
| POST | `/requests/<int:request_id>` | Card actions (approve, reject, mark received, complete, etc.) |
| GET | `/requests/<int:request_id>/duplicate` | Duplicate request (copy fields, clear status) |
| POST | `/requests/<int:request_id>/quick-receive` | Quick operator receive sample action |
| GET | `/requests/<int:request_id>/calendar-card` | Calendar event details popup |
| GET | `/calendar` | FullCalendar view (week/month, scheduled requests + downtime) |
| POST | `/calendar` | Create instrument downtime |
| GET | `/calendar/events` | JSON feed: scheduled requests + downtime events |
| GET | `/stats` | Statistics dashboard: volume, throughput, instrument load |
| GET | `/visualizations` | Data visualization view with grouping and filters |
| POST | `/visualizations/export` | Generate Excel export |
| GET | `/visualizations/group/<path:group_name>` | Visualize requests grouped by (instrument/requester/status) |
| GET | `/visualizations/instrument/<int:instrument_id>` | Visualize requests for single instrument |
| GET | `/me` | Redirect to own user profile |
| GET | `/users/<int:user_id>` | User profile: name, email, role, recent activity |
| POST | `/users/<int:user_id>` | Update user profile (password change, etc.) |
| GET | `/users/<int:user_id>/history` | Redirect to `/schedule?requester_id=...` |
| GET | `/profile/change-password` | Password change form |
| POST | `/profile/change-password` | Update password |
| GET | `/admin/users` | User management: list, invite, elevate roles |
| POST | `/admin/users` | Create user, invite, change role |
| GET | `/attachments/<int:attachment_id>/download` | Download attachment file |
| GET | `/attachments/<int:attachment_id>/view` | View attachment inline (PDF, image, etc.) |
| POST | `/attachments/<int:attachment_id>/delete` | Delete attachment |
| GET | `/sitemap` | Navigation/settings hub (Apple-style sidebar + panels) |
| GET | `/docs` | Documentation viewer (markdown → HTML) |
| GET | `/login` | Login form |
| POST | `/login` | Authenticate user (session creation) |
| GET | `/logout` | Logout (session destruction) |
| GET | `/activate` | Invitation activation form |
| POST | `/activate` | Accept invitation, set password |
| GET | `/demo/switch/<role_key>` | Dev-only: switch demo role (disabled in production) |
| GET | `/prism/log` | Dev-only: view PRISM command buffer |
| POST | `/prism/save` | Dev-only: save PRISM session |
| POST | `/prism/clear` | Dev-only: clear PRISM buffer |
| GET | `/api/health-check` | Health check endpoint (no auth required) |
| GET | `/exports/<path:filename>` | Download generated Excel export file |
| GET | `/history/processed` | Legacy: processed request history (redirect to `/schedule?status=completed`) |
| GET | `/my/history` | Redirect to own request history |

---

## 7. Template System & Macros

### Macro Library: _page_macros.html

Reusable macros for page layout and components.

#### paginated_pane(pane_id, page_size=10, max_height='28rem', css_class='')

Wraps a `<table>` with paginated controls. The table must have `id="{pane_id}Body"`.

- `pane_id` — Unique ID for pagination state and JS hooks
- `page_size` — Rows per page (default 10)
- `max_height` — CSS height for scroll container (default '28rem', use 'none' for no scroll)
- `css_class` — Optional CSS classes to add

Generated elements:
- `#{pane_id}Scroll` — Scrollable container
- `#{pane_id}Controls` — Previous/Next buttons and page label
- `#{pane_id}Prev`, `#{pane_id}Next` — Navigation buttons
- `#{pane_id}Label` — Current page indicator

Used in: dashboard, instruments, schedule, instrument_detail, request_detail, stats, visualizations.

#### page_intro(kicker, title, hint='')

Page header with optional section kicker, title, subtitle, and actions.

- `kicker` — Small text above title
- `title` — Page/section heading
- `hint` — Optional explanatory text
- `caller()` — Action buttons in section-actions div

Example: `{% call page_intro('Data', 'Request Statistics') %}[buttons]{% endcall %}`

#### stat_blob(value, label, href='#', tone='', dark=False, sub='')

Clickable statistics tile.

- `value` — Large number/metric
- `label` — Short description
- `href` — Link target
- `tone` — CSS tone class (wait, active, open, week-jobs, week-samples, month-jobs, month-samples, completed, samples)
- `dark` — Boolean to apply `.dark-stat` filled background
- `sub` — Optional small note/subtext

Example: `{{ stat_blob(45, 'Pending', tone='wait') }}`

#### chart_bar(label, value, width_pct, dark=False)

Horizontal bar row for visual metrics.

- `label` — Left-side label
- `value` — Right-side value (number)
- `width_pct` — Bar width as percentage (0–100)
- `dark` — Boolean for filled bar styling

Example: `{{ chart_bar('FESEM', 18, 75) }}`

#### input_dialog(form_action, action_name, placeholder='Write a message...', submit_label='Send', note_types=[], allow_file=True, allow_routing=False, routing_options=[])

Universal form widget for text input + optional file + routing.

- `form_action` — POST endpoint
- `action_name` — Hidden "action" field value
- `placeholder` — Textarea placeholder
- `submit_label` — Button text
- `note_types` — List of `(value, label)` tuples for message type dropdown (e.g., requester_note, lab_reply)
- `allow_file` — Show file input
- `allow_routing` — Show routing selector dropdown
- `routing_options` — List of `(value, label)` tuples for routing choices

Example: `{% call input_dialog('/requests/1', 'add_note', 'Reply...', 'Send', [('lab_reply', 'Lab Reply')], true) %}{% endcall %}`

#### card_heading(kicker, title, hint='')

Card/section header (same as page_intro, used for card details).

### Macro Library: _request_macros.html

Macros for request card display and field rendering.

#### request_identity(row, compact=False)

Render request number, sample name, sample ref.

- `row` — Request record from database
- `compact` — Boolean for single-line layout

Shows: Request link, sample count badge (if > 1), sample name, sample_ref.

#### instrument_name_link(row)

Render instrument name as link (if user can access instrument_detail).

- `row` — Request record (needs `instrument_id`, `instrument_name`)

Returns: Link or plain text depending on permissions.

#### person_name_link(user_id, name)

Render person name as link (if user can view profile).

- `user_id` — User ID
- `name` — Display name

Returns: User profile link or plain text; "-" if no user_id.

#### requester_block(row, show_originator=False, show_email=False)

Render requester identity with optional originator and email.

- `row` — Request record
- `show_originator` — Show "Originator: " line
- `show_email` — Show requester email

Checks: `request_card_can_view_field(row, 'requester_identity')`. Returns "Restricted" if not visible.

#### operator_block(row)

Render assigned operator name.

- `row` — Request record (needs `assigned_operator_id`, `operator_name`)

Checks: `request_card_can_view_field(row, 'operator_identity')`.

#### status_block(row, show_group=True, show_summary=False, link=True)

Render request status badge with optional group and summary.

- `row` — Request record
- `show_group` — Show status group (e.g., "Awaiting Approval")
- `show_summary` — Show dynamic status text
- `link` — Make badge clickable to request_detail

Example: `{{ status_block(row, show_group=True) }}`

#### meta_link(row, value, fallback='-')

Render clickable value that links to request_detail.

- `row` — Request record
- `value` — Display value
- `fallback` — Fallback if value is empty

#### attachment_list(row, attachment_map, count_first=False, limit=None)

Render list of attached files with download links.

- `row` — Request record (needs `id` for key lookup)
- `attachment_map` — Dict of `{request_id: [attachments]}`
- `count_first` — Show count before list
- `limit` — Max files to show (shows "+N more" link if exceeded)

Example: `{{ attachment_list(row, attachment_map, limit=2) }}`

### Macro Library: _stream_macros.html

Macros for stream/list pages and filtering.

#### stream_header(title, back_url='', back_label='Back')

Page header with optional back link.

- `title` — Page title (currently unused, for future)
- `back_url` — URL for back button
- `back_label` — Text for back button (default "Back")

#### quick_filter_strip(strip_id, items, active_key='all', key_attr='data-slice-key')

Filter button strip for quick slicing.

- `strip_id` — ID for JS hooks
- `items` — List of `(key, label, tone, count)` tuples
  - `key` — Filter key (e.g., 'submitted', 'approved')
  - `label` — Display text
  - `tone` — CSS class (bucket-wait, bucket-active, bucket-open, etc.)
  - `count` — Number badge
- `active_key` — Which item is currently selected (gets `.bucket-active` class)
- `key_attr` — HTML attribute name to store key (default `data-slice-key`)

Example: `{{ quick_filter_strip('statusFilter', [('all', 'All', 'open', 23), ('pending', 'Pending', 'wait', 5)]) }}`

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

### Completed Waves (A–D)

**Wave A: Foundation & Polish ✅ (2026-02-15 → 2026-03-01)**

- [x] A1 — Graceful 403/404/500 error pages + SVG icons + CSS
- [x] A2 — Template cleanup: data-vis="all" → {{ V }} (176 occurrences, 4 files)
- [x] A3 — Fix bounded_pane → paginated_pane (9 calls, 6 files)
- [x] A4 — Remove redundant V declarations
- [x] A5 — README benchmark update

**Wave B: Settings & Navigation ✅ (2026-03-01 → 2026-03-15)**

- [x] B1 — Redesign sitemap → Apple Settings (sticky sidebar + right panel)
- [x] B2 — Settings sections: Core, Operations, Reporting, Admin
- [x] B3 — Instrument nav hover dropdown + status dots (green/yellow/red)
- [x] B4 — Mobile touch support for nav dropdown

**Wave C: Panels & Dialog ✅ (2026-03-15 → 2026-03-31)**

- [x] C1 — Universal input_dialog macro (text + file + routing + note types)
- [x] C2 — Instrument detail → 5-panel CSS grid (Info, Stats, Queue, Admin, Activity)
- [x] C3 — Responsive layout: 2-col desktop, 1-col mobile

**Wave D: Calendar Integration ✅ (2026-03-31 → 2026-04-07)**

- [x] D1 — instrument_downtime DB table + model
- [x] D2 — POST /calendar downtime creation + validation
- [x] D3 — GET /calendar/events JSON API (downtime + requests)
- [x] D4 — Calendar UI: downtime modal, time-range select, orange blocks
- [x] D5 — Cross-page calendar: dashboard + instrument detail downtime

### In Progress: Wave E (2026-04-10)

**Wave E: Demo Data & Documentation 🔄**

- [ ] E1 — Full demo populator (25 instruments, 15 faculty, 10 operators, 500 reqs)
- [x] E2 — Rewrite PROJECT.md (current schema, routes, macros, changelog) — **IN PROGRESS**
- [ ] E3 — Document all macros (_page_macros, _request_macros, _stream_macros) — **IN PROGRESS**
- [ ] E4 — Apply chart_bar macro to dashboard weekly/monthly charts

### Planned: Wave F

**Wave F: Final Verification 🔲**

- [ ] F1 — Full crawl: all 9 roles × all 41 routes
- [ ] F2 — Cross-page consistency check (counters, queue slices)
- [ ] F3 — Smoke test + tag release v1.0

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

### 2026-04-10 | Claude Haiku 4.5 | Status: COMPLETED
**Intent:** Update PROJECT.md with current system state: 15 tables, 41 routes, all 9 roles, complete macro documentation.
**Result:** Updated Database Schema (15 tables with full columns), Routes section (41 routes listed), User Roles with full permission matrix, Template System with all macros from _page_macros.html, _request_macros.html, _stream_macros.html fully documented with parameters and usage.
**Files:** PROJECT.md
**Git commit:** (pending)

### 2026-04-09 | Claude Haiku 4.5 | Status: COMPLETED
**Intent:** Consolidate README.md, TODO_AI.txt, PROJECT.md into 2 well-structured files. README focused on quick start + progress. PROJECT.md absorbs roadmap.
**Result:** README.md now slim with progress bar and quick start (Waves A-D complete, 71% overall). PROJECT.md now comprehensive spec with Roadmap section, Template System section documenting macros, expanded File Structure. Two files form complete rebuild source.
**Files:** README.md, PROJECT.md
**Git commit:** (pending)

### 2026-04-07 | Claude Opus 4.6 (Cowork) | Status: COMPLETED
**Intent:** Fix visual layout issues on request detail + queue row sizing + set up local git remote
**Result:** Fixed request detail blank space, queue row natural height, added local bare repo at ../lab-scheduler.git as origin. CSS and template updates for consistency.
**Files:** PROJECT.md, static/styles.css, templates/request_detail.html
**Git commit:** fa8bfcf (remote setup)

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

### 2026-03-31 to 2026-04-07 | Wave D: Calendar Integration | Status: COMPLETED
**Intent:** Add instrument downtime calendar, event feed, cross-page downtime display
**Result:** Added `instrument_downtime` table. POST /calendar for downtime creation. GET /calendar/events JSON API. Calendar UI with downtime modal. Dashboard + instrument detail show next downtime. Full FullCalendar integration.
**Files:** app.py, templates/calendar.html, templates/dashboard.html, templates/instrument_detail.html, static/styles.css
**Git commit:** c538dcd

### 2026-03-15 to 2026-03-31 | Wave C: Panels & Dialog | Status: COMPLETED
**Intent:** Build universal input_dialog macro, redesign instrument detail to 5-panel CSS grid
**Result:** Implemented `input_dialog` macro (text + file + routing + note types). Instrument detail: 5-panel grid (Info, Stats, Queue, Admin, Activity). Responsive 2-col desktop / 1-col mobile layout.
**Files:** templates/_page_macros.html, templates/instrument_detail.html, static/styles.css
**Git commit:** (Wave C completed)

### 2026-03-01 to 2026-03-15 | Wave B: Settings & Navigation | Status: COMPLETED
**Intent:** Redesign sitemap to Apple Settings style. Add instrument nav dropdown with status dots.
**Result:** Sitemap → Settings with sticky sidebar + right panel. Sections: Core, Operations, Reporting, Admin. Instrument nav dropdown with green/yellow/red status dots. Mobile touch support.
**Files:** templates/sitemap.html, templates/base.html, static/styles.css
**Git commit:** 9bc6d03

### 2026-02-15 to 2026-03-01 | Wave A: Foundation & Polish | Status: COMPLETED
**Intent:** Add error pages, standardize data-vis, rename bounded_pane → paginated_pane
**Result:** Added 403/404/500 error pages with SVG icons. Replaced 176 data-vis="all" with {{ V }}. Fixed 9 bounded_pane calls → paginated_pane. Cleaned up redundant V declarations.
**Files:** app.py, templates/, static/styles.css
**Git commit:** a2f2e84

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
