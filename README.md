# PRISM — Lab Scheduler

A Flask sample-request and instrument workflow system for MIT-WPU's
shared lab facility. Sequential approvals (finance → professor →
operator), queue management, audit logging, per-request attachments.

LAN-first. Single-binary deploy. SQLite. No build step.

---

## Phase 5 Progress & Schedule

Current focus: **Phase 5 — Widget Propagation.** Extract recurring
widgets to macros, then convert every user-facing page to the tile
pattern set by `templates/instrument_detail.html`.

Effort sizing is **relative** (S / M / L / XL) — small = isolated
edits, XL = multi-session rewrite with template + handler refactor.
No hour estimates; the surprise budget for each page varies too much.

```
Phase 5 overall   ██████████████████████████████   7 / 7  waves   ( W5.1 · W5.2 · W5.3 · W5.4 · W5.5 · W5.6 · W5.7 )
Solo waves        ██████████████████████████████   6 / 6  ( all done — Phase 5 complete )
```

| Step | Scope | Effort | Progress | State |
|---|---|---|---|---|
| W5.1 | Shared widget macros (8 primitives + CSS) | M | `██████████` | **Done** (24f4308) |
| W5.2 | `schedule.html` tile conversion + bulk-actions tile | L | `██████████` | **Done** (ac8d7c9) |
| W5.3 | `request_detail.html` tile conversion | XL | `██████████` | **Done** (2603cd1) |
| W5.4 | `dashboard.html` tile conversion | L | `██████████` | **Done** |
| W5.5 | `stats.html` tile conversion | M | `██████████` | **Done** |
| W5.6 | Secondary pages (calendar, instruments, pending, users, finance) | L | `██████████` | **Done** |
| W5.7 | CSS hygiene pass (retire legacy class families) | M | `██████████` | **Done** |

**Sizing rationale:**
- **W5.2 (L)** — highest-touch page; swaps monolithic 7-col table for
  tiles, rewires filter pill JS, wires up bulk-actions tile.
- **W5.3 (XL)** — drops the fragile `.request-workspace` 2-col layout,
  adopts threaded `activity_feed`, collapses duplicated approve/reject
  forms. The 682-line `request_detail()` Python handler split is
  deferred to Phase 6 unless it blocks.
- **W5.4 (L)** — kills the `.instrument-carousel`, adopts `kpi_grid`
  and `queue_action_stack`, replaces `.grid-two` layout.
- **W5.5 (M)** — mostly chart tile wrapping + KPI adoption; data
  layer untouched.
- **W5.6 (L)** — six secondary pages, each small on its own but the
  bundle is sizeable; `users.html` gets a `user_table` extraction.
- **W5.7 (M)** — not a standalone wave; each page conversion retires
  its own legacy classes as it lands.

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

**W5.2 deliverables** (`templates/schedule.html`):

- [x] Four tiles: filter / status pills / bulk actions / queue
- [x] `status_pills_row` adopted (`.filter-pill` JS replaces `.stream-pill`)
- [x] `queue_action_stack` adopted in both `schedule.html` and `instrument_detail.html`
- [x] Bulk-actions tile with select-all + per-row checkboxes + animated reveal
- [x] New `/schedule/bulk` route (`schedule_bulk_actions`) with permission-aware skip-and-report
- [x] Latent bug fix: `request_assignment_candidates` was called from `quick_assign` but never defined — would have 500'd on first use
- [x] View toggle (Detailed/Compact) moved into queue tile's section-actions slot — kills `.stream-page-header`
- [x] Crawls green (171/171 visibility, 500 actions, 0 5xx, 0 exceptions)

**W5.3 deliverables** (`templates/request_detail.html`):

- [x] Six tiles: header / details / actions / approvals / files / activity
- [x] Killed `.request-workspace` 2-col sticky layout — everything is a fluid `.request-tiles` grid now
- [x] `metadata_grid` adopted for the details grid (instrument/sample/people/dates)
- [x] `person_chip` adopted for requester + operator slots
- [x] `approval_action_form` adopted for actionable approvals — macro now emits the correct server field names (`remarks`, `approval_attachment`) so it drops cleanly into this page and future ones
- [x] Activity tile uses `.activity-feed` / `.activity-entry-threaded` — chat-style left/right alignment replaces the old `.event-left` / `.event-right` / `.event-center` triple
- [x] Empty-state macro replaces the bare "No events." fallback
- [x] `input_dialog` reply composer kept verbatim inside the activity tile
- [x] Crawls green (visibility audit clean, populate crawl clean)

**W5.4 deliverables** (`templates/dashboard.html`):

- [x] Six tiles on `.dashboard-tiles` 6-col grid: week / month / quick-intake / instrument-queues / downtime / your-jobs
- [x] Killed `.grid-two` — metrics tiles now compose into the same fluid grid as every other page
- [x] Killed `.instrument-carousel` — replaced with a `.dash-instrument-grid` of up to 9 inline mini-queue cards that reflow to 3 / 2 / 1 cols
- [x] `kpi_grid(variant='dense')` adopted for both week + month counter clusters — retires `.stats.compact-stats`
- [x] `queue_action_stack` adopted for the Quick Intake accept+assign forms — kills the two ad-hoc inline forms in the intake row
- [x] Latent bug fix: the quick-intake search JS was targeting `#quickIntakeList` (never existed) and `.quick-intake-item` (class never emitted) — the filter was a no-op on every dashboard load. Now targets `#quickIntakeBody` + `[data-pane-item]` and refreshes the paginated pane on input.
- [x] Collapse persistence (Hide/Show week+month) survives the refactor — buttons still carry `data-collapse-id` and the collapse script is untouched
- [x] Crawls green (visibility audit clean, populate crawl clean)

**W5.5 deliverables** (`templates/stats.html`):

- [x] Fourteen tiles on `.stats-tiles` 6-col grid: header / counters / war-room board / trend / status donut / instrument throughput / turnaround / top requesters / weekly bar / bottlenecks / activity / perf table / weekly table / export
- [x] Killed `.warroom-title-row` + `.warroom-filters` + `.grid-auto-stats` + `.grid-two` + `.stats-left-column` / `.stats-right-column` — every concern is now its own tile
- [x] `kpi_grid` adopted for the counter cluster + inline week-comparison chevron
- [x] `.filter-pill-row` adopted for the horizon + instrument filter bars — retires the bespoke `.warroom-filters` markup
- [x] `paginated_pane` adopted for the instrument perf + weekly throughput tables
- [x] Chart.js canvases (`trendChart`, `statusChart`, `instChart`, `turnChart`, `topChart`, `weekBarChart`) kept verbatim — canvas IDs untouched, only the wrappers moved
- [x] Conditional tiles render only when their data source is non-empty (bottlenecks, activity feed, top requesters, war-room board) so empty roles don't see stub cards
- [x] Crawls green (visibility audit 171/171, populate crawl 500/0 5xx/0 exceptions)

**W5.6 deliverables** (secondary pages bundle):

- [x] `pending.html` → 3-tile `.pending-tiles` (viewer / approval / own). Adopts `metadata_grid` + `empty_state`, kills the bare `.page-title-bar` + loose-card layout.
- [x] `users.html` → 4-tile `.users-tiles` (create / members / admins / owners). Inline `user_row` sub-macro collapses 3× near-identical `<tr>` blocks. Member + admin tables now use `paginated_pane`.
- [x] `finance.html` → 6-tile `.finance-tiles` (header / budgets / by-instrument / monthly / recent / activity). `kpi_grid(variant='dense')` replaces the ad-hoc `.stats-kpi-row`. Chart.js canvas ID untouched.
- [x] `instruments.html` → 3-tile `.instruments-tiles` (header / active / archived). Inline `instrument_row` macro collapses the duplicated 50-line active+archived `<tr>` pair.
- [x] `calendar.html` → 2-tile `.calendar-tiles` (filters / grid). Retires the legacy `stream_header` + `role-toggle-strip` markup — filters now use `.filter-pill-row`. FullCalendar instance + overlays kept verbatim.
- [x] Crawls green (visibility audit 171/171, populate crawl 500/0 5xx/0 exceptions)

**W5.7 deliverables** (CSS hygiene + straggler templates):

- [x] Migrated the last four templates clinging to legacy classes: `visualization.html` → 9-tile `.viz-tiles`, `user_detail.html` → `.user-detail-tiles`, `notifications.html` → `.activity-feed` / `.activity-entry`, `instrument_config.html` → `.config-page-title`
- [x] Retired **~870 lines** of orphaned selectors from `static/styles.css` (7,925 → 7,057). Killed families: `.bucket-grid` / `.bucket-link` / `.bucket-*` tone variants, `.stream-filter-strip`, `.stream-page-head`, `.stream-pill*`, `.queue-control-strip`, `.queue-toggle-grid`, `.queue-table-card`, `.queue-jump-card`, `.warroom-title-row`, `.warroom-filters`, `.warroom-header`, `.warroom-title`, `.warroom-subtitle`, `.warroom-pill*`, `.history-toggle-grid`, `.history-control-strip`, `.history-filter-form`, `.role-toggle-strip`, `.role-toggle`, `.role-switch-grid`, `.instrument-carousel*`, `.instrument-card*`, `.instrument-queue-table*`, `.instrument-queue-jumps`, `.instrument-page-links`, `.instrument-side-links`, `.instrument-main-card`, `.instrument-inline-queue-shell`, `.event-stream*`, `.event-stream-table`, `.event-left` / `.event-right` / `.event-center`, `.event-attachment-link`, `.stats-left-column` / `.stats-right-column`, `.grid-two`, `.grid-auto-stats`, `.compact-stats`, `.compact-scroll`, `.request-workspace`, `.request-side-stack`
- [x] Deleted dead `templates/_stream_macros.html` (no imports anywhere) — `stream_header` and `quick_filter_strip` macros are gone with their consumers
- [x] Crawls green (visibility audit 171/0/2 warns, populate crawl 500/0 5xx)

After Phase 5 settles, **Phase 6 — Foundation Hardening** picks up DB
indexes, the permission decorator, the request status state machine,
CSRF, and the `request_detail()` handler refactor.

Update this block as steps land. The source of truth for task detail
lives in `TODO_AI.txt`; this panel is a progress mirror.

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

## Crawler Suite

Every type of crawler we've used to test / improve PRISM now lives in
the `crawlers/` package. Each crawler is a reusable `CrawlerStrategy`
subclass registered against an *aspect* (visibility, lifecycle,
coverage, performance, accessibility, dead_links, css_hygiene,
regression, data_integrity). Drop in a new file, import it in
`crawlers/strategies/__init__.py`, and the CLI picks it up
automatically.

### CLI

```bash
venv/bin/python -m crawlers list                 # all registered strategies
venv/bin/python -m crawlers describe <name>      # docstring + aspect
venv/bin/python -m crawlers run <name|all>       # run one crawler (or all)
venv/bin/python -m crawlers list-waves           # all wave pipelines
venv/bin/python -m crawlers wave <name>          # run a named wave
```

Every run writes a JSON log + plain-text summary under `reports/`.

### Registered strategies

| Name | Aspect | What it improves |
| --- | --- | --- |
| `smoke` | regression | Critical paths × 3 roles — pre-push sanity check |
| `visibility` | visibility | 8 roles × ~12 pages access matrix |
| `role_behavior` | visibility | Each role performs its signature action (behavioral RBAC) |
| `lifecycle` | lifecycle | End-to-end request lifecycle through the UI |
| `dead_link` | dead_links | BFS href harvest + hit across 4 roles |
| `performance` | performance | p50/p95/max on hot routes (budgets: warn 300ms / fail 1500ms) |
| `random_walk` | coverage | MCMC walk over (role × route) cells, ~800 steps |
| `contrast_audit` | accessibility | WCAG AA contrast check on the fixed palette |
| `color_improvement` | accessibility | Grep rendered HTML for palette drift + low-contrast pairs |
| `architecture` | regression | Handler body size / template size / CSS line budget |
| `philosophy` | css_hygiene | Template-level design creed audit (tiles, vars, vis, deprecated classes) |
| `css_orphan` | css_hygiene | Scan `static/styles.css` for unused selectors |
| `cleanup` | css_hygiene | Find suspected dead Python functions / templates / stale files |

### Wave pipelines (`python -m crawlers wave <name>`)

Waves batch strategies into phased pipelines matching the dev
improvement phases of PRISM.

| Wave | Strategies | Purpose |
| --- | --- | --- |
| `sanity` | smoke → visibility → contrast_audit | **Pre-push gate** — stops on first failure |
| `static` | architecture → philosophy → css_orphan | No-DB structural analysis |
| `behavioral` | role_behavior → visibility | Behavioral RBAC — "can act", not just "can load" |
| `lifecycle` | lifecycle → dead_link | End-to-end UI journeys + dead-link sweep |
| `coverage` | random_walk → performance | MCMC coverage + perf sampling |
| `accessibility` | contrast_audit → color_improvement | WCAG + palette-drift detection |
| `cleanup` | cleanup → css_orphan → philosophy | Dead-code retirement backlog |
| `all` | every wave in order | Full pre-release gate (slow) |

The `sanity` wave has `stop_on_fail=True`; the others run through to
collect a complete backlog of findings.

### Adding a new crawler

1. Drop `my_strategy.py` into `crawlers/strategies/`.
2. Subclass `CrawlerStrategy`, set `name`, `aspect`, `description`, and
   implement `run(harness) -> CrawlResult`.
3. Call `MyStrategy.register()` at the bottom of the file.
4. Import the module in `crawlers/strategies/__init__.py`.
5. Optionally add it to a wave in `crawlers/waves.py`.

The shared `Harness` bootstraps a temp SQLite DB, seeds the 8-role
persona cohort + 3 instruments, and hands back a logged Flask test
client — so strategies only ever express *what to crawl*, never *how
to boot PRISM*.

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
4. **Commit and push every ~2 minutes. Never leave changes hanging.**
   Pull → work → commit → push is the default rhythm. Batch only when a
   single logical unit genuinely spans multiple files; otherwise commit
   each file change as it lands. `git push` is mandatory after every
   commit on PRISM/Scheduler — never leave commits local.
5. Keep `test_visibility_audit.py` + `test_populate_crawl.py` green
   before every push. The `crawlers/` package exposes
   `python -m crawlers run all` for batched verification.
6. **Batch terminal permissions up front.** Front-load shell
   operations into long chained commands (`mkdir && write && test &&
   git add/commit/push`) rather than drip-feeding many small calls.
   When a multi-step task is predictable, list every command you'll
   need at the top of the reply so the user can authorize in one pass.
