<!-- ============================================================
     PROJECT.md — Lab Scheduler MVP
     Master reference for architecture, changelog, and roadmap.
     ============================================================

     ┌─────────────────────────────────────────────────────────┐
     │  AI AGENT CONSTRAINT — READ THIS BEFORE ANY WORK       │
     │                                                         │
     │  This file is the single source of truth for the        │
     │  project's architecture, change history, and roadmap.   │
     │                                                         │
     │  BEFORE starting any task:                              │
     │   1. Read this file.                                    │
     │   2. Add an entry to the CHANGELOG section with:        │
     │      - Date, your agent name, and a one-line summary    │
     │        of what you intend to do.                        │
     │      - Status: STARTED                                  │
     │   3. If the task changes architecture (new routes, new  │
     │      tables, new roles, new templates), note the        │
     │      planned change in the Architecture section too.    │
     │                                                         │
     │  AFTER completing the task:                             │
     │   1. Update your CHANGELOG entry with:                  │
     │      - What actually changed (files, lines, behavior).  │
     │      - Status: COMPLETED                                │
     │   2. Update the Architecture section if anything        │
     │      structural changed.                                │
     │   3. Update the TODO / Roadmap section — check off      │
     │      completed items, add new discovered issues.        │
     │   4. Commit this file alongside your code changes.      │
     │                                                         │
     │  This file also serves as a human-readable guide to     │
     │  the entire project. A new developer or AI agent        │
     │  should be able to read this and understand the full    │
     │  system.                                                │
     └─────────────────────────────────────────────────────────┘
-->

# Lab Scheduler MVP — Project Reference

A Flask-based lab request and operator workflow system for a shared
instrument facility. One Python file (`app.py`, ~5,900 lines), SQLite
database, Jinja2 templates, vanilla CSS.

---

## 1. Core Mental Model

### The Request Card

The fundamental unit is the **request card**. A card is created when
someone submits a sample request. From that moment forward, the card
accumulates everything that ever happens to that request:

- Approval decisions (finance → professor → operator)
- Status transitions (submitted → under_review → sample_received → …)
- Notes and replies (requester notes, lab replies, operator notes)
- File attachments (intake forms, sample slips, result reports)
- Issues raised and resolved
- Audit log entries (immutable, hash-chained)
- Scheduling info, operator assignments, completion data

The card is the **single source of truth**. There is no duplication
of data. The card lives in the `sample_requests` table with related
data in `approval_steps`, `request_messages`, `request_attachments`,
`request_issues`, and `audit_logs`.

### Slicing and Visibility

The entire site is built around showing **slices** of these cards to
different people based on their role and context:

- The **Queue page** (`/schedule`) shows all cards the user has access
  to, with status bucket tabs (Pending, Approvals, Active, etc.)
- The **Home dashboard** shows summary stats and the top cards per
  instrument queue.
- **Instrument detail** pages show the queue for that single instrument.
- **User profiles** show cards that person submitted or handled.
- **Calendar** shows cards that have scheduled times.
- **Statistics/Visualizations** aggregate card data into charts.

What parts of the card are visible depends on:

1. **Role** — a requester sees their own cards; an operator sees cards
   for their instruments; a super_admin sees everything.
2. **Field visibility** — each role has a `card_visible_fields` set
   that controls which sections of the card render (remarks, results,
   conversation, operator identity, etc.)
3. **Action fields** — each role has a `card_action_fields` set that
   controls what buttons/forms appear (reply, upload, reassign, etc.)

This is managed by the `request_card_policy()` and
`request_card_field_allowed()` functions, plus the
`ROLE_ACCESS_PRESETS` configuration dict.

### No Page Duplication

History pages, processed views, instrument queues — these are NOT
separate data sources. They are all the same `/schedule` Queue page
with different filter parameters pre-selected:

- `/instruments/<id>/history` → redirects to `/schedule?instrument_id=<id>`
- `/users/<id>/history` → redirects to `/schedule?requester_id=<id>`
- `/history/processed` → redirects to `/schedule?bucket=completed`

---

## 2. User Roles and Hierarchy

```
Owner (email-based, defined in OWNER_EMAILS env var)
  └── Has ALL permissions. Cannot be assigned as a role — it's an
      overlay on top of whatever role the user has.

Super Admin
  └── Full system access. Can manage users, see all instruments,
      access all queues, switch roles (demo mode).

Site Admin
  └── Similar to Super Admin but cannot manage members.

Instrument Admin
  └── Manages specific instruments they are assigned to.
      Can see queue, calendar, stats for their instruments.
      Can approve at operator step, reassign, update status.

Operator
  └── Works on assigned instruments. Can receive samples,
      update status, add notes/files. Cannot manage instruments.

Professor Approver
  └── Approves requests at the faculty step.
      Can view all instruments, queue, calendar, stats.

Finance Admin
  └── Approves requests at the finance step only.
      Limited view — cannot see instruments or schedule.

Faculty In-Charge (instrument_faculty_admins table)
  └── Scoped professor role for specific instruments.

Requester (default role for new users)
  └── Can submit requests, view own requests, upload files,
      add notes, confirm sample submission.
```

### Role Access Matrix

| Capability              | Owner | Super | Site | Inst Admin | Operator | Prof | Finance | Requester |
|--------------------------|-------|-------|------|------------|----------|------|---------|-----------|
| Manage members           | ✓     | ✓     |      |            |          |      |         |           |
| View all instruments     | ✓     | ✓     | ✓    |            |          | ✓    |         |           |
| View all requests        | ✓     | ✓     | ✓    |            |          | ✓    |         |           |
| Access schedule/queue    | ✓     | ✓     | ✓    | ✓          | ✓        | ✓    |         |           |
| Access calendar          | ✓     | ✓     | ✓    | ✓          | ✓        | ✓    |         |           |
| Access statistics        | ✓     | ✓     | ✓    | ✓          | ✓        | ✓    |         |           |
| Approve finance step     | ✓     | ✓     | ✓    |            |          |      | ✓       |           |
| Approve professor step   | ✓     | ✓     | ✓    |            |          | ✓    |         |           |
| Approve operator step    | ✓     | ✓     | ✓    | ✓          | ✓        |      |         |           |
| Use role switcher (demo) | ✓     | ✓     |      |            |          |      |         |           |
| Submit requests          | ✓     | ✓     | ✓    | ✓          | ✓        | ✓    | ✓       | ✓         |

---

## 3. Request Lifecycle (Card Flow)

```
 ┌──────────┐     ┌──────────────┐     ┌─────────────────────────┐
 │ Submitted │────▶│ Under Review │────▶│ Awaiting Sample         │
 │           │     │ (approvals)  │     │ Submission              │
 └──────────┘     └──────────────┘     └─────────────────────────┘
                        │                          │
                        │ (rejected)               ▼
                        ▼                ┌─────────────────┐
                   ┌──────────┐         │ Sample Submitted │
                   │ Rejected │         │ (by requester)   │
                   └──────────┘         └─────────────────┘
                                                   │
                                                   ▼
                                        ┌─────────────────┐
                                        │ Sample Received  │
                                        │ (by operator)    │
                                        └─────────────────┘
                                                   │
                                                   ▼
                                        ┌─────────────────┐
                                        │ Scheduled        │
                                        │ (date assigned)  │
                                        └─────────────────┘
                                                   │
                                                   ▼
                                        ┌─────────────────┐
                                        │ In Progress      │
                                        │ (work started)   │
                                        └─────────────────┘
                                                   │
                                                   ▼
                                        ┌─────────────────┐
                                        │ Completed        │
                                        │ (locked after    │
                                        │  closeout)       │
                                        └─────────────────┘
```

### Approval Chain (default: 3 steps)

1. **Finance** — finance_admin approves payment/receipt
2. **Professor/Faculty** — professor_approver or faculty_in_charge approves
3. **Operator** — operator or instrument_admin accepts the job

Each instrument can have a custom approval chain configured via
`instrument_approval_config`. Steps can be skipped or reordered.
All three must be approved before the request moves to
`awaiting_sample_submission`.

### Who Can Trigger Each Transition

| Transition                        | Who                                    |
|-----------------------------------|----------------------------------------|
| Create request                    | Any logged-in user                     |
| Approve/reject at finance step    | finance_admin, owner, super_admin      |
| Approve/reject at professor step  | professor_approver, faculty_in_charge  |
| Approve/reject at operator step   | operator, instrument_admin, super_admin|
| Mark sample submitted             | requester (original submitter)         |
| Mark sample received              | operator, instrument_admin, super_admin|
| Schedule / assign operator        | operator, instrument_admin, super_admin|
| Start (in_progress)               | operator, instrument_admin, super_admin|
| Complete                          | operator, instrument_admin, super_admin|
| Reject (at any point)             | approver for current step, admin       |
| Lock after completion             | automatic on closeout                  |

---

## 4. Database Schema

### Core Tables

**users** — All accounts (admins, operators, requesters)
- id, name, email, password_hash, role, invited_by, invite_status, active

**instruments** — Lab machines
- id, name, code, category, location, daily_capacity, status, notes
- office_info, faculty_group, manufacturer, model_number
- capabilities_summary, machine_photo_url, reference_links
- instrument_description, accepting_requests, soft_accept_enabled

**sample_requests** — The request cards (central table)
- id, request_no, sample_ref, requester_id, created_by_user_id
- originator_note, instrument_id, title, sample_name, sample_count
- description, sample_origin, receipt_number
- amount_due, amount_paid, finance_status, priority, status
- submitted_to_lab_at, sample_submitted_at, sample_received_at
- sample_dropoff_note, received_by_operator_id, assigned_operator_id
- scheduled_for, remarks, results_summary
- result_email_status, result_email_sent_at
- completion_locked, created_at, updated_at, completed_at

### Workflow Tables

**approval_steps** — Each approval in the chain
- id, sample_request_id, step_order, approver_role
- approver_user_id, status, remarks, acted_at

**request_messages** — Communication thread on a card
- id, request_id, sender_user_id, note_kind, message_body
- created_at, is_active

**request_attachments** — Files attached to a card
- id, request_id, user_id, instrument_id
- original_filename, stored_filename, relative_path
- file_extension, mime_type, file_size
- uploaded_by_user_id, uploaded_at, attachment_type, note
- is_active, request_message_id

**request_issues** — Flags/issues raised on a card
- id, request_id, created_by_user_id, issue_message
- response_message, status, created_at, responded_at
- responded_by_user_id, resolved_at, resolved_by_user_id

### Assignment Tables

**instrument_admins** — (user_id, instrument_id)
**instrument_operators** — (user_id, instrument_id)
**instrument_faculty_admins** — (user_id, instrument_id)

### Audit and Config

**audit_logs** — Immutable log with SHA256 hash chain
- id, entity_type, entity_id, action, actor_id
- payload_json, prev_hash, entry_hash, created_at

**instrument_approval_config** — Custom approval chain per instrument
- id, instrument_id, step_order, approver_role, approver_user_id

**instrument_downtime** — Maintenance windows
- id, instrument_id, start_time, end_time, reason
- created_by_user_id, created_at, is_active

**generated_exports** — Excel export records
- id, filename, created_by_user_id, created_at, scope_label

---

## 5. Page Map (Routes)

### Public (no login required)
| Route              | Template       | Purpose                          |
|--------------------|----------------|----------------------------------|
| GET /login         | login.html     | Sign-in form                     |
| POST /login        | login.html     | Process sign-in                  |
| GET /activate      | activate.html  | Activate invited account         |
| POST /activate     | activate.html  | Process activation               |
| GET /logout        | (redirect)     | Clear session, redirect to login |

### Authenticated — All Users
| Route                         | Template             | Purpose                              |
|-------------------------------|----------------------|--------------------------------------|
| GET /                         | dashboard.html       | Home dashboard with stats and queues |
| GET /sitemap                  | sitemap.html         | Navigation map of all pages          |
| GET /requests/new             | new_request.html     | Submit a new sample request          |
| POST /requests/new            | new_request.html     | Process new request submission       |
| GET /requests/<id>            | request_detail.html  | Full card view with actions          |
| POST /requests/<id>           | request_detail.html  | Process card actions (approve, etc.) |
| GET /me                       | (redirect)           | Redirect to own profile              |
| GET /my/history               | (redirect)           | Redirect to /schedule                |
| GET /users/<id>               | user_detail.html     | User profile with stats              |
| POST /users/<id>              | user_detail.html     | Update profile actions               |

### Authenticated — Instrument Access Required
| Route                              | Template              | Purpose                         |
|------------------------------------|-----------------------|---------------------------------|
| GET /instruments                   | instruments.html      | List all accessible instruments |
| POST /instruments                  | instruments.html      | Create new instrument           |
| GET /instruments/<id>              | instrument_detail.html| Instrument dashboard and queue  |
| POST /instruments/<id>             | instrument_detail.html| Update instrument settings      |
| GET /instruments/<id>/history      | (redirect)            | → /schedule?instrument_id=<id>  |
| GET /instruments/<id>/calendar     | (redirect)            | → /calendar?instrument_id=<id>  |

### Authenticated — Schedule/Queue Access
| Route                    | Template         | Purpose                              |
|--------------------------|------------------|--------------------------------------|
| GET /schedule            | schedule.html    | Main queue board (THE central page)  |
| POST /schedule/actions   | (redirect)       | Bulk/quick actions from queue        |
| GET /history/processed   | (redirect)       | → /schedule?bucket=completed         |

### Authenticated — Calendar Access
| Route                    | Template         | Purpose                              |
|--------------------------|------------------|--------------------------------------|
| GET /calendar            | calendar.html    | Weekly/monthly calendar view         |
| GET /calendar/events     | (JSON)           | AJAX endpoint for calendar events    |

### Authenticated — Stats Access
| Route                              | Template           | Purpose                        |
|------------------------------------|--------------------|--------------------------------|
| GET /stats                         | stats.html         | Statistics dashboard           |
| GET /visualizations                | visualization.html | Data view with charts/exports  |
| GET /instruments/<id>/viz          | visualization.html | Per-instrument data view       |
| GET /groups/<name>/viz             | visualization.html | Per-faculty-group data view    |

### Admin Only
| Route                    | Template       | Purpose                            |
|--------------------------|----------------|-------------------------------------|
| GET /admin/users         | users.html     | User management (create, elevate)  |
| POST /admin/users        | users.html     | Process user creation/changes      |
| GET /users/<id>/history  | (redirect)     | → /schedule?requester_id=<id>      |

### File Serving
| Route                               | Purpose                          |
|--------------------------------------|----------------------------------|
| GET /attachments/<id>/download       | Download attachment file         |
| GET /attachments/<id>/view           | View attachment inline           |
| POST /attachments/<id>/delete        | Soft-delete attachment           |
| GET /exports/<filename>              | Download generated Excel export  |
| GET /instrument-images/<filename>    | Serve instrument photos          |

### Special
| Route                        | Purpose                              |
|------------------------------|--------------------------------------|
| GET /demo/switch/<role_key>  | Switch to demo role (owner/admin)    |
| GET /calendar-card/<id>      | Mini card popup for calendar events  |
| POST /requests/<id>/quick-receive | Quick-accept from queue board   |

---

## 6. File Structure

```
Main/
├── app.py                    # Single-file Flask application (~5,900 lines)
├── requirements.txt          # Flask==3.1.0, openpyxl==3.1.5
├── lab_scheduler.db          # SQLite database (gitignored)
├── start_server.sh           # Launch script (port 5055)
├── Start Server.command      # macOS double-click launcher
├── README.md                 # Quick-start guide
├── PROJECT.md                # THIS FILE — architecture + changelog
├── .gitignore                # Python, DB, uploads, IDE files
├── Labscheduler-MVP.code-workspace  # VS Code workspace
│
├── templates/                # Jinja2 templates
│   ├── base.html             # Layout: topbar, nav, theme, flash messages
│   ├── _page_macros.html     # Shared macros (card_heading, paginated_pane)
│   ├── _request_macros.html  # Request card display macros
│   ├── _stream_macros.html   # Timeline/event stream macros
│   ├── login.html            # Sign-in form
│   ├── activate.html         # Invite activation form
│   ├── dashboard.html        # Home page with stats + instrument queues
│   ├── schedule.html         # THE main queue board (central page)
│   ├── instruments.html      # Instrument list with categories
│   ├── instrument_detail.html# Single instrument: queue, settings, events
│   ├── new_request.html      # New request form
│   ├── request_detail.html   # Full card view with approval/action panel
│   ├── calendar.html         # FullCalendar weekly/monthly view
│   ├── calendar_card.html    # Mini popup card for calendar events
│   ├── stats.html            # Statistics page with bar charts
│   ├── visualization.html    # Data view with export button
│   ├── user_detail.html      # User profile with submitted/handled jobs
│   ├── users.html            # Admin: user management panel
│   ├── sitemap.html          # Navigation site map
│   └── error.html            # 403/404 error page
│
├── static/
│   ├── styles.css            # All CSS (~68KB, light+dark themes)
│   ├── instrument-placeholder.svg
│   ├── instrument_images/    # Uploaded instrument photos
│   └── vendor/
│       ├── daypilot/         # DayPilot calendar library (legacy, unused)
│       └── fullcalendar/     # FullCalendar JS library
│
├── uploads/                  # User-uploaded files (gitignored)
│   └── users/<user_id>/requests/req_<id>_<no>/attachments/
│
├── exports/                  # Generated Excel exports (gitignored)
│
├── smoke_test.py             # Lightweight regression test suite
├── full_qa.py                # Full QA test runner
├── populate_live_demo.py     # Seed rich demo data
└── simulate_live_run.py      # Simulate live usage patterns
```

---

## 7. Security Model

### Current Implementation

- **Authentication**: Session-based, 12-hour timeout, HttpOnly cookies,
  SameSite=Lax. Passwords hashed with pbkdf2:sha256.
- **Authorization**: Role-based with instrument-level scoping.
  `login_required` decorator for all protected routes.
  `role_required` decorator for admin-only routes.
  `user_access_profile()` generates a permission dict per request.
- **Audit Trail**: Every significant action logged to `audit_logs` with
  SHA256 hash chain (prev_hash + entry_hash) for tamper detection.
- **File Uploads**: Validated by extension whitelist (pdf, png, jpg,
  jpeg, xlsx, csv, txt). Max 100MB. Stored on disk with secure_filename.
  Served through Flask (not direct static access).
- **SQL**: All queries use parameterized statements. Dynamic table/column
  names validated against whitelists.

### Planned Security Improvements (Future)

- [ ] CSRF tokens on all POST forms
- [ ] Rate limiting on login attempts
- [ ] Password complexity requirements
- [ ] Account lockout after failed attempts
- [ ] Session invalidation on password change
- [ ] Content Security Policy headers
- [ ] HTTPS enforcement (SESSION_COOKIE_SECURE already configurable)
- [ ] Input sanitization for XSS in user-entered text fields
- [ ] Two-factor authentication for admin roles

---

## 8. Communication System

Four note types on each card:

| Type            | Who Can Post       | Purpose                              |
|-----------------|--------------------|--------------------------------------|
| requester_note  | Requester          | Questions or clarifications          |
| lab_reply       | Lab staff          | Coordination replies                 |
| operator_note   | Operator/admin     | Operational notes                    |
| final_note      | Operator/admin     | Final handoff note shared with user  |

Issues can be flagged on cards (open → responded → resolved cycle).
Attachments can be linked to specific messages.

---

## 9. Key Configuration

| Setting                  | Value / Source                    |
|--------------------------|----------------------------------|
| Port                     | 5055                             |
| Secret key               | env LAB_SCHEDULER_SECRET_KEY     |
| Owner emails             | env OWNER_EMAILS (comma-separated)|
| SMTP                     | env SMTP_HOST, SMTP_PORT         |
| Max upload size           | 100 MB                           |
| Session lifetime         | 12 hours                         |
| Allowed upload types     | pdf, png, jpg, jpeg, xlsx, csv, txt |
| Database                 | SQLite (lab_scheduler.db)        |

---

## 10. Git & Development Environment

> **AI agents: update this section if you change any repo settings,
> branch strategy, or dev tooling.**

### Repository

| Setting          | Value                                           |
|------------------|-------------------------------------------------|
| VCS              | Git — 100% open-source, no proprietary services |
| Repo root        | `Main/` (same directory as `app.py`)            |
| Local remote     | `../lab-scheduler.git` (bare repo, same parent folder) |
| Default branch   | `master`                                        |
| Git user.name    | AAAA                                            |
| Git user.email   | general.goje@gmail.com                          |
| .gitignore       | `__pycache__/`, `.venv/`, `venv/`, `*.db`, `.DS_Store`, `uploads/`, `exports/`, `.env`, IDE files |

### Branch & Commit Conventions

- All work happens on `master` until a branching strategy is adopted.
- Every AI agent session **must** create at least one commit covering
  its changes **plus** the updated `PROJECT.md`.
- After committing, **always push**: `git push origin master`
- Commit messages: imperative mood, first line ≤ 72 chars, blank line
  then body if needed.  Append:
  ```
  Co-Authored-By: <Agent Name> <noreply@anthropic.com>
  ```
- Never force-push or rewrite published history.

### Running the App Locally

```bash
cd Main/
# activate your virtualenv if you use one
pip install flask
python app.py          # starts on http://127.0.0.1:5055
```

- **Debug mode** is controlled at the bottom of `app.py`
  (`app.run(debug=False, port=5055)`). Flip to `True` while
  developing, set back to `False` before committing.
- The SQLite database `lab_scheduler.db` is git-ignored; it is created
  automatically on first run via `init_db()`.

### Editor / IDE Notes

- Primary editor: **VS Code** (Xcode also available but not used for
  this project).
- Recommended VS Code extensions: Python, Jinja, SQLite Viewer.
- No formatter or linter is enforced yet — candidates for future
  adoption: `black`, `ruff`.

### Local Remote (Bare Repo)

The project uses a **local bare Git repository** as its remote origin.
This is pure open-source Git — no proprietary cloud service required.

```
Scheduler/
├── Main/                  ← working repo (you edit files here)
│   └── .git/
└── lab-scheduler.git/     ← bare remote (push/pull target)
```

**How it works:** `Main/` has `origin` pointed at `../lab-scheduler.git`.
AI agents and humans push/pull to this bare repo just like they would
to GitHub. Standard `git push origin master` / `git pull origin master`.

**Adding a cloud remote later (optional — update this section if you do):**
```bash
# Example: connect to GitHub alongside the local remote
git remote add github https://github.com/youruser/lab-scheduler.git
git push github master
# Or replace origin entirely:
git remote set-url origin https://github.com/youruser/lab-scheduler.git
```
Compatible with: GitHub, GitLab, Gitea, Codeberg, Bitbucket, any
standard Git host. No lock-in.

### CI (not yet configured)

- No CI pipeline is set. When one is added, update this section.
- Candidates: GitHub Actions, Gitea Actions, or a local pre-push hook.

---

## 11. CHANGELOG

<!-- AI agents: add your entries here, newest first.
     Format:
     ### YYYY-MM-DD | Agent Name | Status: STARTED/COMPLETED
     **Intent:** What you plan to do
     **Result:** What actually changed (update after completion)
     **Files:** List of changed files
     **Git commit:** Commit hash or message
-->

### 2026-04-07 | Claude Opus 4.6 (Cowork) | Status: COMPLETED
**Intent:** Consolidate all history views into single Queue page
**Result:** All history/processed routes now redirect to /schedule with
filter params. Removed 3 unused templates and 2 legacy route functions.
910 lines removed.
**Files:** app.py, templates/history.html (deleted),
templates/instrument_history.html (deleted),
templates/processed_history.html (deleted),
templates/user_detail.html
**Git commit:** e503a2d — Consolidate all history views into single Queue page

### 2026-04-07 | Claude Opus 4.6 (Cowork) | Status: COMPLETED
**Intent:** Fix two crashing bugs found during browser testing
**Result:** (1) Replaced query against non-existent `request_events` table
with `audit_logs` in request_detail route. (2) Added missing
`_request_macros.html` import in `instrument_detail.html`.
**Files:** app.py, templates/instrument_detail.html
**Git commit:** 401cefa — Fix two crashing bugs: missing request_events
table and missing macro import

### 2026-04-07 | Claude Opus 4.6 (Cowork) | Status: COMPLETED
**Intent:** Initialize git repository and set up version control
**Result:** Created .gitignore, initialized repo, made initial commit
with 221 files (76,536 lines).
**Files:** .gitignore (new), all project files
**Git commit:** 76147cf — Initial commit: Lab Scheduler MVP

---

## 12. TODO / Roadmap

<!-- AI agents: check off items as you complete them.
     Add new items as you discover them.
     Mark items [x] when done, [ ] when pending.
     Use priority: P0 = critical, P1 = high, P2 = medium, P3 = nice-to-have
-->

### Bugs (Known)

- [ ] **P0** — Sample count validation accepts 0 (should require ≥ 1)
      in `/requests/new` POST handler
- [ ] **P1** — `save_uploaded_attachment()` crashes on files without
      extensions (IndexError on `rsplit(".", 1)[1]`)
- [ ] **P1** — Missing null check in approval/reassignment handlers —
      if `approver_user_id` doesn't match a valid user, app crashes
- [ ] **P1** — Missing form key validation in `/requests/new` —
      `int(request.form["instrument_id"])` crashes if missing
- [ ] **P2** — Empty sample names can be submitted
- [ ] **P2** — Broken instrument images (some reference external URLs
      that may not load; placeholder SVG exists but not always used)
- [ ] **P3** — Division-by-zero risk in stats when no data exists

### Security (Planned)

- [ ] **P0** — Add CSRF protection on all POST forms
- [ ] **P1** — Rate limiting on login endpoint
- [ ] **P1** — Password complexity requirements on activation
- [ ] **P2** — Account lockout after N failed login attempts
- [ ] **P2** — CSP headers
- [ ] **P3** — Two-factor auth for admin roles

### Features (Planned)

- [ ] **P1** — Email notifications beyond just completion
      (approval needed, sample received, etc.)
- [ ] **P1** — Bulk operations on queue (approve multiple, assign batch)
- [ ] **P2** — Soft-accept "on hold" auto-release mechanism
- [ ] **P2** — Message versioning (edit history) instead of replace
- [ ] **P2** — Export to PDF for individual request cards
- [ ] **P3** — Dashboard customization per role
- [ ] **P3** — API endpoints for external integrations
- [ ] **P3** — Migrate from SQLite to PostgreSQL for production

### Architecture (Planned)

- [ ] **P2** — Extract route handlers into blueprints (auth, requests,
      instruments, admin, api)
- [ ] **P2** — Move helper functions to separate modules
- [ ] **P3** — Add comprehensive test suite beyond smoke_test.py
- [ ] **P3** — Docker containerization for deployment
