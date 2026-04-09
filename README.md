# PRISM — Lab Scheduler

A Flask-based sample request and instrument workflow system for MIT-WPU's shared lab facility. Provides sequential approvals (finance → professor → operator), queue management, audit logging, and per-request attachment storage.

## Quick Start

```bash
cd Main
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python app.py
```

Open: `http://127.0.0.1:5055`

To populate richer demo data:

```bash
.venv/bin/python populate_live_demo.py
```

## Demo Accounts

Password: `SimplePass123`

| Account | Role |
|---------|------|
| `admin@lab.local` | Owner (full access) |
| `finance@lab.local` | Finance Admin |
| `prof.approver@lab.local` | Professor Approver |
| `fesem.admin@lab.local` | Instrument Admin (FESEM) |
| `anika@lab.local` | Operator |
| `sen@lab.local` | Requester |

## Progress

| Phase | Status | Progress |
|-------|--------|----------|
| Core Platform | Done | ████████████████████ 100% |
| UI Architecture | Done | ████████████████████ 100% |
| Navigation & Widgets | In Progress | ████████████░░░░░░░░ 60% |
| Calendar Integration | Planned | ░░░░░░░░░░░░░░░░░░░░ 0% |
| User Customization | Planned | ░░░░░░░░░░░░░░░░░░░░ 0% |
| Finance Extension | Future | ░░░░░░░░░░░░░░░░░░░░ 0% |
| Full Demo & Verification | Planned | ░░░░░░░░░░░░░░░░░░░░ 0% |

## AI Agent Workflow Rules

1. **Always commit before starting** a new task.
2. **Write the plan in PROJECT.md** (Roadmap section) before coding.
3. **Break work into <5 min tasks**. Use parallel agents where possible.
4. **Commit after finishing** each task. Never leave uncommitted work.
5. If the last job wasn't completed, revert via git, re-read the plan, complete it, then move on.

## Full Documentation

- **PROJECT.md** — Complete specification, architecture, database schema, every route, every template macro. Read this to rebuild the system from scratch.
- **CRAWL_PLAN.md** — Role-based access testing plan and test account matrix.
- **CSS_COMPONENT_MAP.md** — All CSS classes and component patterns used across templates.
- **SECURITY_TODO.md** — Security hardening checklist and HTTPS migration tracker.
- **ROLE_VISIBILITY_MATRIX.md** — Every page and UI element mapped to the roles that can access it.
- **TODO_AI.txt** — Active task list and execution roadmap (also embedded in PROJECT.md § Roadmap).

## Development Mode

Enable template auto-reload and Flask debug mode:

```bash
LAB_SCHEDULER_DEBUG=1 python3 app.py
```

Without this flag, Flask caches compiled templates in memory and changes require server restart.

## Testing

Run a lightweight regression smoke test:

```bash
.venv/bin/python smoke_test.py
```

## File Uploads

- **Location:** `uploads/users/<user_id>/requests/req_<id>_<request_no>/attachments/`
- **Max file size:** 100 MB per file
- **Allowed types:** pdf, png, jpg, jpeg, xlsx, csv, txt
- **Export location:** `exports/` (generated Excel reports)

See PROJECT.md for full specification.
