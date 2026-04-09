# Lab Scheduler MVP

Small Flask-based lab request and operator workflow system for a shared instrument facility.

## What It Covers

- admin-created member accounts
- invite activation page for members to set their own password
- sample request submission
- sequential approvals: finance -> professor -> operator
- approved requests wait for physical sample dropoff
- member confirms sample submitted
- operator/admin confirms sample received
- operator/admin schedules, starts, completes, drops, or rejects requests
- internal/external samples with receipt and payment tracking
- PDF and document attachments stored on disk per request
- requester and instrument history pages
- weekly calendar with downtime blocks
- immutable audit log with chained hashes
- completion lock after final closeout

## Local Run

```bash
cd "/Users/vishvajeetn/Downloads/untitled folder 8/lab-scheduler-mvp"
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python app.py
```

Open:

`http://127.0.0.1:5055`

To populate richer live-like demo data:

```bash
.venv/bin/python populate_live_demo.py
```

Excel exports are generated into:

`/Users/vishvajeetn/Downloads/untitled folder 8/lab-scheduler-mvp/exports`

Uploads are stored on disk under:

`/Users/vishvajeetn/Downloads/untitled folder 8/lab-scheduler-mvp/uploads`

Folder model:

- `uploads/users/<user_id>/requests/req_<request_id>_<request_no>/attachments/`

Max upload size:

- `100 MB` per file

Allowed upload types:

- `pdf`
- `png`
- `jpg`
- `jpeg`
- `xlsx`
- `csv`
- `txt`

## Demo Accounts

Password for seeded demo users:

`SimplePass123`

Examples:

- `admin@lab.local`
- `finance@lab.local`
- `prof.approver@lab.local`
- `fesem.admin@lab.local`
- `icpms.admin@lab.local`
- `anika@lab.local`
- `ravi@lab.local`
- `sen@lab.local`
- `iyer@lab.local`
- `shah@lab.local`

## Invite Activation

Admins create members from the Users page.

Members can then activate their invited account at:

`/activate`

## History Pages

- `My History` shows the requester's own requests with filters and attachment counts
- each instrument row links to instrument-specific history
- request detail pages show all attachments and audit activity

## Calendar

- `Calendar` is a simple weekly operational view
- filters: instrument, operator, scheduled, in-progress, completed, maintenance
- queue board remains the main screen; calendar is secondary for planning
- super admins and instrument admins can add downtime blocks

## Development Mode

Set `LAB_SCHEDULER_DEBUG=1` to enable template auto-reload and Flask debug mode:

```bash
LAB_SCHEDULER_DEBUG=1 python3 app.py
```

Without this, Flask caches compiled templates in memory and changes require a server restart.

## Smoke Test

To run a lightweight regression pass:

```bash
.venv/bin/python smoke_test.py
```

## AI Agent Workflow Rules

1. **Always commit before starting** a new task.
2. **Write the plan in this README** (under Current Task) before coding.
3. **Break work into <5 min tasks**. Use parallel agents where possible.
4. **Commit after finishing** each task. Never leave uncommitted work.
5. If the last job wasn't completed, revert via git, re-read the plan, complete it, then move on.

## Current Task

**Grid Overlay + Feedback Panel** (in progress)

- [x] Grid overlay JS: alphanumeric codes (H1, S3, E4…) on every UI element (Ctrl+G toggle)
- [x] Click-to-log: clicking a badge registers it in a feedback panel
- [x] Feedback panel JS: draggable panel, inline notes per entry, path mode, copy-to-clipboard export
- [x] Base.html: linked grid-overlay.js
- [ ] **Feedback panel CSS** — style the floating panel, log entries, form inputs, path separator, flash animation
- [ ] **Test on all pages** — verify overlay + panel work on Home, Instruments, Queue, Stats, Calendar
- [ ] **Final commit**

## Known Bugs / TODO

- **Archived instruments table** on `/instruments` still uses the old 6-column layout (Name, Links, Operation, Location, Operators, Faculty). Should be updated to match the new 7-column active instruments layout.
- **Dashboard instrument card CSS** (`.instrument-card`) targets a class that may not be present in `dashboard.html` — verify the card wrapper has this class or the uniform-height styles won't apply.
- **Queue page title** now always says "Jobs" — consider showing the instrument name in a subtitle or breadcrumb when pre-filtered via `?instrument_id=`.
- **Template caching pitfall**: production deploys (`debug=False`, no `LAB_SCHEDULER_DEBUG`) cache templates. Any template-only change requires a process restart to take effect.
- **stats page `i.status = 'active'` fix**: the previous `i.active = 1` column reference was wrong (column doesn't exist). Fixed to `i.status = 'active'`. Verify no other queries reference `i.active`.
- **Row serialization**: stats route converts SQLite Row objects to dicts before passing to `tojson`. If new stats queries are added, they must also use `dict(r)` conversion.
