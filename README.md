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

| Wave | Description | Status | Progress |
|------|-------------|--------|----------|
| — | Core Platform (routes, DB, auth, RBAC) | Done | ████████████████████ 100% |
| — | UI Architecture (macros, data-vis, nav) | Done | ████████████████████ 100% |
| 1 | Full Demo Population (500-action crawl) | Done | ████████████████████ 100% |
| 2 | Admin/Settings Page Redesign | Planned | ░░░░░░░░░░░░░░░░░░░░ 0% |
| 3 | Navigation + Widget Improvements | In Progress | ████████░░░░░░░░░░░░ 40% |
| 4 | Calendar Integration | Planned | ░░░░░░░░░░░░░░░░░░░░ 0% |
| 5 | Template Centralization | Done | ██████████████████░░ 95% |
| 6 | Documentation Rewrite | In Progress | ██████░░░░░░░░░░░░░░ 30% |
| 7 | Verification (crawl + audit) | Done | ████████████████████ 100% |

### Benchmark (2026-04-09)

- **app.py**: 6,413 lines, 41 routes, 15 DB tables
- **Templates**: 28 HTML files, 0 orphaned data-vis, 0 bounded_pane calls
- **Roles**: 9 roles with ROLE_ACCESS_PRESETS, OR-logic with instrument assignments
- **Crawl**: 500-action populate crawl — 0 server errors
- **Visibility audit**: 169 checks across 8 roles — 0 failures
- **Finance admin**: full instrument area access (read-only, approver-level)

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
