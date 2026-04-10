# PRISM Changelog

All notable changes to this project are documented here. The
format follows [Keep a Changelog](https://keepachangelog.com/),
and PRISM uses [Semantic Versioning](https://semver.org).

The full commit-level history is in `git log`. This file
collapses each release into the rationale and the user-visible
delta — read this first, drop into `git log` for the line-by-line
detail.

## [Unreleased]

Forward plan lives in `TODO_AI.txt`. Headline:

- **v1.3.0** — CSRF enforcement on, input validation everywhere,
  persisted state-transition test (done). The originally-planned
  `request_detail()` handler split is dropped — the state machine
  + `tests/test_status_transitions.py` already lock every status
  write, so the 685-line function is ugly but not unsafe.
- **v1.4.0** — bulk operations on the queue tile.
- **v1.5.0** — SQLite FTS5 full-text search.

### Added (in flight)

- **`tests/test_status_transitions.py`** — exhaustive walk of
  `REQUEST_STATUS_TRANSITIONS`: 21 legal pairs, 70 illegal pairs,
  terminal lock, idempotent self-transitions, admin force-override
  bypass, fast-track. Wired into the pre-push gate next to
  `smoke_test.py`. (v1.3.0-d)
- **Ollama bridge** — `OLLAMA_DEV_PLAN.md` (the contract),
  `setup_remote.command` (interactive Mac mini setup including
  the `usekeychain` typo fix), and a clean rewrite of
  `run_ollama_task.sh` (sandboxed `ollama-work` branch, refuses
  to run on master/main with `--commit`, three modes: local /
  remote / dual). Gives the project an unattended-task lane for
  mechanical work (CSRF inputs, `safe_int` wraps) while Claude
  handles judgment calls.

## [1.2.0] — 2026-04-10

Foundation hardening. No user-facing feature changes; the existing
features become unbreakable. PRISM is now production-usable on a
LAN.

### Added

- **22 database indexes** on hot query paths (status filters,
  instrument scoping, approval-step joins, audit log entity scans,
  attachment filters, junction lookups). Idempotent CREATE INDEX
  IF NOT EXISTS in `init_db()`.
- **`@instrument_access_required(level)` decorator** with four
  levels (view / open / manage / operate). Gates every route that
  takes `<int:instrument_id>`. Returns 404 if missing, 403 if
  denied. Injects the instrument into the view as a kwarg.
- **`REQUEST_DETAIL_JOINS` constant** — single canonical FROM/JOIN
  block for the three callers that share the verbatim 6-line join.
  Aliases `sr / i / r / c / op / recv` are load-bearing.
- **`assigned_instrument_ids(user)` cached in Flask `g`** per
  request. Free to call as many times as needed within one render.
- **Request status state machine** — `REQUEST_STATUS_TRANSITIONS`
  dict + `assert_status_transition(current, target, force=False)`
  validator. Wired into 14 update sites across `request_detail`,
  `schedule_actions`, `quick_receive_request`, and
  `release_submitted_requests_for_instrument`. Admin overrides pass
  `force=True`. `InvalidStatusTransition` is registered as a Flask
  error handler that flashes and redirects to the referrer.
- **CSRF token machinery** via Flask-WTF `CSRFProtect`. Enforcement
  is gated by `LAB_SCHEDULER_CSRF=1`; the `base.html` JS shim
  auto-injects the token into form submits and `fetch()` calls.
  Default off so existing forms / tests / demo agents continue to
  work; v1.3.0 flips the default.
- **`DEMO_MODE` gate** on `/demo/switch/*` and `seed_data()`. Set
  `LAB_SCHEDULER_DEMO_MODE=0` for production to lock both down.
- **Toast notification system** — `flash()` API unchanged, but
  rendering moved from inline `.flash-stack` to a fixed-position
  `.toast-stack` with auto-dismiss, slide-in animation, light /
  dark variants, and `prefers-reduced-motion` honor.
- **PWA polish** — `static/manifest.json`, theme-color meta tags
  (light + dark), apple-touch-icon, skip-nav link to
  `id="main-content"`, ARIA polish on the instrument dropdown
  (`aria-haspopup`, `aria-expanded` synced via JS, Escape-to-close).
- **`.env.example`** — every environment flag PRISM reads with safe
  defaults and a one-line rationale per flag.
- **Crawler suite** under `crawlers/` — 13 registered strategies
  organised into 8 wave pipelines. Plugin architecture: drop a
  file into `crawlers/strategies/`, import in `__init__.py`, and
  the CLI picks it up automatically. `python -m crawlers wave
  sanity` is the pre-push gate.
- **`CRAWLER_RANDOM_WALK_STEPS` env knob** for the random-walk
  coverage crawler. Default 800; 1000 covers ~99% of (role × route)
  cells per coupon-collector math.

### Changed

- **`metadata_grid` macro** auto-escapes string values; HTML must
  be wrapped in a `{% set var %}…{% endset %}` block (which
  produces `Markup`). Closed a stored-XSS vector in
  `instrument.notes`.
- **Cleanup crawler** ignores Flask hook decorators
  (`@app.errorhandler`, `@app.context_processor`,
  `@app.teardown_appcontext`, etc.) so it stops flagging
  live-by-registration helpers as dead code.
- **Crawler harness** is now idempotent across wave runs — dropped
  the stale `csrf_token()` context_processor stub that conflicted
  with the Flask-WTF global registration after the first request
  was served.

### Fixed

- Queue title falling back to a generic label when pre-filtered by
  source.
- Instrument photo crash when the configured URL was unreachable —
  now falls back to the placeholder SVG.

### Baseline metrics (v1.2.0)

| Metric | Value |
|---|---|
| `app.py` | ~6,750 lines |
| Routes | 42 |
| DB tables | 15 (22 indexes) |
| Templates | 27 |
| `static/styles.css` | ~7,150 lines |
| Roles | 9 |
| Visibility audit | 171 / 171 PASS |
| Populate crawl | 500 actions, 0 × 5xx, 0 exceptions |
| Random-walk coverage | 99.2% of (role × route) cells, 0 × 5xx |
| Performance p95 | < 5 ms on every hot route |

## [1.1.0] — Tile architecture

Every user-facing page converted to the tile pattern set by
`templates/instrument_detail.html` (the 10-tile reference
implementation on a 6-column fluid grid).

### Added

- **8 widget macros** in `templates/_page_macros.html`:
  `card_heading`, `paginated_pane`, `metadata_grid`, `kpi_grid`,
  `status_pills_row`, `queue_action_stack`, `person_chip`,
  `approval_action_form`, `activity_feed`. Canonical building
  blocks for every page from this point on.
- **`empty_state` macro** for every list / table empty branch.
- **`paginated_pane` everywhere** — long lists no longer use
  `overflow: auto`. The macro handles page state, page-size
  controls, and the empty-state branch.

### Changed

- **`schedule.html`** — monolithic 7-col table replaced with four
  tiles (filter / status pills / bulk actions / queue). Bulk-actions
  tile placeholder added (wired in v1.4.0). View toggle moved into
  the queue tile's section-actions slot.
- **`request_detail.html`** — `.request-workspace` 2-col sticky
  layout retired in favor of a fluid `.request-tiles` grid. Six
  tiles (header / details / actions / approvals / files / activity).
  Activity tile uses `.activity-feed` / `.activity-entry-threaded`
  for chat-style left/right alignment.
- **`dashboard.html`** — `.instrument-carousel` retired in favor of
  a `.dash-instrument-grid` of inline mini-queue cards. Six tiles
  (week / month / quick-intake / instrument-queues / downtime /
  your-jobs).
- **`stats.html`** — fourteen tiles on a `.stats-tiles` 6-col grid.
  Conditional tiles render only when their data source is non-empty.
- **`pending.html`, `users.html`, `finance.html`,
  `instruments.html`, `calendar.html`** — all converted to the
  tile pattern. `paginated_pane` adopted for member / admin tables.
- **`visualization.html`, `user_detail.html`, `notifications.html`,
  `instrument_config.html`** — final stragglers converted.

### Removed

- **~870 lines of orphaned CSS selectors** retired from
  `static/styles.css` (7,925 → 7,057). Killed families:
  `.bucket-*`, `.stream-*`, `.queue-control-*`, `.queue-toggle-*`,
  `.warroom-*`, `.history-*`, `.role-toggle-*`,
  `.instrument-carousel*`, `.instrument-card*`, `.event-*`,
  `.stats-left-column` / `.stats-right-column`, `.grid-two`,
  `.grid-auto-stats`, `.compact-stats`, `.request-workspace`,
  `.request-side-stack`.
- **`templates/_stream_macros.html`** — dead module, no imports
  anywhere. `stream_header` and `quick_filter_strip` macros gone
  with their consumers.

## [1.0.0] — Foundation

Initial working app. The pre-tile architecture: working sample
request lifecycle, sequential approval chain, instrument detail
page, calendar, dashboard, stats, file uploads, immutable audit
chain, 8-role visibility model.

### Added

- Sample request submission, approval, scheduling, completion.
- Sequential approval chain (Finance → Professor → Operator),
  configurable per instrument.
- 8-role visibility model with server-side scope filtering.
- Two-layer authorization: server-side `request_card_policy()` +
  `request_scope_sql()` is the gate; client-side `data-vis` is the
  visual safety net.
- Immutable audit log with SHA-256 hash chain.
  `verify_audit_chain()` walks the chain.
- File upload subsystem under `uploads/users/<uid>/requests/<rid>/`.
- Calendar with drag-drop scheduling (FullCalendar).
- Statistics dashboard with Chart.js visualisations.
- Excel export under `exports/`.
- Demo accounts seeded on first boot.
- Visibility audit (`test_visibility_audit.py`): 8 roles × ~12
  pages, 171/171 baseline.
- Populate crawl (`test_populate_crawl.py`): 500 actions
  end-to-end, 0 5xx baseline.

[Unreleased]: https://github.com/anthropics/claude-code
[1.2.0]: https://github.com/anthropics/claude-code
[1.1.0]: https://github.com/anthropics/claude-code
[1.0.0]: https://github.com/anthropics/claude-code
