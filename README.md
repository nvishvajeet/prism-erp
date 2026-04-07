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

## Smoke Test

To run a lightweight regression pass:

```bash
.venv/bin/python smoke_test.py
```
