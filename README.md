# PRISM — Lab Scheduler

A Flask sample-request and instrument workflow system for MIT-WPU's
shared lab facility. Sequential approvals (finance → professor →
operator), queue management, audit logging, per-request attachments.

LAN-first. Single-binary deploy. SQLite. No build step.

---

## Design Philosophy

Apple / Jony Ive / Ferrari. Every element earns its place.

- **Tiles, not pages.** Every concern is a self-contained widget tile
  on a fluid grid. No mixed concerns inside one card.
- **Pagination, never scroll.** Long lists use the `paginated_pane`
  macro. No `overflow: auto` inside content.
- **Macros over markup.** If a pattern shows up twice, it becomes a
  macro. Templates compose; they do not duplicate.
- **One queue, one card.** A request is the same object everywhere it
  appears — same identity, same status block, same actions.
- **Visibility is sliced server-side first.** `data-vis` is a safety
  net, not the gate.
- **Empty space is content.** Cramped is the failure mode, not bold.

Reference implementation: `templates/instrument_detail.html` — 10
tiles on a 6-column fluid grid. Match its rhythm everywhere else.

---

## Current Focus

**Phase 5 — Widget Propagation.** Extract recurring widgets to macros,
then convert each user-facing page to the tile pattern, in priority
order:

1. `schedule.html` — highest-touch page
2. `request_detail.html` — high-complexity detail view
3. `dashboard.html` — hub page
4. `stats.html` — operations dashboard
5. Calendar, instruments, pending, users, finance — secondary polish

See `TODO_AI.txt` for the full plan, including the macros to extract
first (W5.1) and the CSS hygiene pass (W5.7) that runs alongside.

After Phase 5 settles, **Phase 6 — Foundation Hardening** picks up DB
indexes, the permission decorator, the request status state machine,
CSRF, and the request_detail() handler refactor.

---

## Phase 5 Progress

| Step | Scope | State |
|---|---|---|
| W5.1 | Shared widget macros (8 primitives + CSS) | Done |
| W5.2 | `schedule.html` tile conversion | Not started |
| W5.3 | `request_detail.html` tile conversion | Not started |
| W5.4 | `dashboard.html` tile conversion | Not started |
| W5.5 | `stats.html` tile conversion | Not started |
| W5.6 | Secondary pages (calendar, instruments, pending, users, finance) | Not started |
| W5.7 | CSS hygiene pass (retire legacy class families) | Not started |

**W5.1 macro checklist** (`templates/_page_macros.html`):

- [x] `status_pills_row` — unifies stream-pill / role-toggle / warroom-pill
- [x] `person_chip` — avatar + name, composes with permission checks
- [x] `metadata_grid` — canonical `<dl>` for label/value pairs
- [x] `kpi_grid` — KPI counter grid wrapping `stat_blob`
- [x] `approval_action_form` — approve/reject forms for one approval step
- [x] `queue_action_stack` — accept sample + quick assign forms
- [x] `activity_feed` — timeline with optional chat threading
- [x] `toggleable_form` — disclosure pattern for inline editors
- [x] Validation: adopt 3 macros in `instrument_detail.html` (metadata_grid, person_chip, status_pills_row)
- [x] Crawls green (`test_visibility_audit.py` 171/171, `test_populate_crawl.py` 500 actions, 0 5xx)

Update this block as steps land. The source of truth for task detail
lives in `TODO_AI.txt`; this panel is a progress mirror.

---

## What's Done

| Area | State |
|---|---|
| Error pages (403/404/500) | Done |
| Settings page (Apple-style) | Done |
| Instrument nav dropdown + status dots | Done |
| Universal `input_dialog` macro | Done |
| Calendar + downtime cross-page integration | Done |
| Visibility audit (8 roles × 12 pages) | 171/171 pass |
| Populate crawl (500 actions) | 0 5xx, 0 exceptions |
| Empty-state macro | Done |
| Nav / dashboard large-dataset caps | Done |
| **instrument_detail.html — 10-tile architecture** | Done (reference) |

---

## Snapshot (2026-04-10)

| Metric | Value |
|---|---|
| `app.py` | ~6,400 lines |
| Routes | 41 |
| DB tables | 15 |
| Templates | 28 |
| `static/styles.css` | ~5,800 lines |
| Roles | 9 (`ROLE_ACCESS_PRESETS`) |

---

## Quick Start

```bash
cd Main
python3 -m venv venv
venv/bin/pip install -r requirements.txt
venv/bin/python app.py
```

Open `http://127.0.0.1:5055`.

To populate richer demo data:

```bash
venv/bin/python populate_live_demo.py
```

Enable template auto-reload + Flask debug:

```bash
LAB_SCHEDULER_DEBUG=1 venv/bin/python app.py
```

---

## Demo Accounts

Password: `SimplePass123`

| Account | Role |
|---|---|
| `admin@lab.local` | Owner (full access) |
| `finance@lab.local` | Finance Admin |
| `prof.approver@lab.local` | Professor Approver |
| `fesem.admin@lab.local` | Instrument Admin (FESEM) |
| `anika@lab.local` | Operator |
| `sen@lab.local` | Requester |

---

## Testing

```bash
venv/bin/python test_visibility_audit.py    # 8 roles × all pages
venv/bin/python test_populate_crawl.py      # 500 actions, end-to-end
venv/bin/python smoke_test.py               # lightweight regression
```

The visibility audit and populate crawl must stay green before any
commit lands on master.

---

## File Uploads

- **Location:** `uploads/users/<user_id>/requests/req_<id>_<request_no>/attachments/`
- **Max size:** 100 MB per file
- **Allowed:** pdf, png, jpg, jpeg, xlsx, csv, txt
- **Exports:** `exports/` (generated Excel reports)

---

## Documentation

- **`TODO_AI.txt`** — active plan and design philosophy. Read first.
- **`PROJECT.md`** — full spec, schema, routes, macros (rewrite
  scheduled for end of Phase 5).
- **`ROLE_VISIBILITY_MATRIX.md`** — every page mapped to roles.
- **`SECURITY_TODO.md`** — hardening checklist + HTTPS migration.
- **`CRAWL_PLAN.md`** — role-based access testing plan.

---

## AI Agent Workflow Rules

1. Read `TODO_AI.txt` before starting.
2. Verify state before acting — items may already be done.
3. Fix root causes, not symptoms.
4. Commit and push after every meaningful change.
5. Keep visibility audit + populate crawl green.
