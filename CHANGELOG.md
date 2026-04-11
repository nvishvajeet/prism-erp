# PRISM Changelog

All notable changes to this project are documented here. The
format follows [Keep a Changelog](https://keepachangelog.com/),
and PRISM uses [Semantic Versioning](https://semver.org).

The full commit-level history is in `git log`. This file
collapses each release into the rationale and the user-visible
delta — read this first, drop into `git log` for the line-by-line
detail.

## [Unreleased]

Forward plan lives in `docs/NEXT_WAVES.md`. The active line is
the `v1.3.0-stable-release` branch; the first tag of the v1.4.x
line is **v1.4.2** once Tailscale Serve is unblocked.

**Shipped on trunk since v1.3.8, pending the next tag:**

### Added

- **W1.3.9/W1.4.0 code prep** (`5bc3142`) — `scripts/tailscale_serve.sh`
  one-shot helper + `docs/HTTPS.md`. Lands the laptop-side
  deliverables for tailnet HTTPS. Execution blocks on one operator
  click at https://login.tailscale.com/f/serve . Plan B (mkcert
  local cert via Flask `ssl_context`) documented as the fallback.
- **W1.4.1 c1a — `.row-time-hint`** (`36fe93f`) — server-side
  `time_ago()` helper renders a muted "just now / 5m ago / 2d ago
  / in 4h" hint under every queue row's exact timestamp. No JS.
- **W1.4.1 c1b — topbar queue count badge** (`455ffb7`) — pending-
  for-role count on the Queue nav item, computed once in
  `inject_globals`. New `topbar_badges` crawler in the sanity wave.
- **W1.4.1 c2 — empty-state warmth** (`db7bc19`) — shared
  `empty_state(...)` macro applied to the big table pages; stray
  "No records" stubs retired. New `empty_states` crawler in the
  sanity wave.
- **W1.4.1 c3 — bare-key shortcuts** (`bcd3990`) — `static/keybinds.js`
  (≤40 lines, vanilla JS, zero framework creep). `n` → new
  request, `?` → toggle help overlay, `Esc` → close. No-op while
  a form input / textarea / contenteditable is focused.
  Philosophy crawler extended with a rule that enforces the
  40-line budget and base.html reference. **Completes W1.4.1;
  v1.4.1 is ready to tag.**
- **AGENTS.md at project root** (`90383b1`) — vendor-neutral
  onboarding for any AI coding agent (Claude, Codex, Gemini,
  Cursor, Continue, Aider, Copilot). Self-contained: topology,
  commit rhythm, pre-commit gate, hard/soft contract, demo/
  operational separation, docs manifest.
- **Dev panel WAVES tile honours `✅ SHIPPED` marker** (`8043696`)
  — `_dev_panel_waves()` now treats any section header with the
  marker in `docs/NEXT_WAVES.md` as shipped, not just git-tagged
  waves. Unblocks reflecting state for waves the plan explicitly
  leaves untagged.

### Changed

- **CSS fossil backlog wiped** (`0d3102e`) — W1.3.11 retired 231
  orphaned selectors from `static/styles.css`. `css_orphan`
  crawler went from 512/0/229 → 548/0/0.
- **Stunnel / Caddy fallback retired** (`929911d`) — W1.3.12
  Tailscale Serve is now the only HTTPS path. Simpler state to
  reason about, one fewer moving piece.
- **`docs/NEXT_WAVES.md` second-pass optimization** (`6f2b543`) —
  collapsed W1.3.9+W1.4.0 into one post-ops wave, dropped the
  W1.4.2 hotfix-buffer slot, split the release gate into ops-free
  W1.4.2a + post-ops W1.4.2b. Net: critical path to demo-live
  dropped from ~4 days calendar to ~2.5 h focused work.

## [1.3.8] — 2026-04-11

**W1.3.8 — launchd service for Flask on the mini.** Turns the
`nohup` dance into a real service that survives reboots.

### Added

- **`ops/launchd/local.prism.plist`** — `KeepAlive` + `RunAtLoad`,
  stdout/stderr to `logs/server.log`, env vars sourced from a
  one-line wrapper.
- **`scripts/start_server.sh`** — exports `.env`, execs
  `.venv/bin/python app.py`. Launchd invokes this, not python
  directly, so env loading is unambiguous.
- **`scripts/install_launchd.sh`** — copies the plist to
  `~/Library/LaunchAgents/` and runs `launchctl bootstrap`.

### Changed

- **`docs/DEPLOY.md` §2 rewrite** — launchd is now the canonical
  deploy recipe; manual `python app.py` is a debugging fallback
  only.

### Blocked on

- **Reboot-acceptance step deferred** until the Mac mini
  Application Firewall is unblocked (`logs/mini_network_diag_20260411.md`).
  Code-side W1.3.8 shipped; the ops-side acceptance test is
  pending one operator command.

## [1.3.0] — 2026-04-10

**First stable release.** Hard attributes (data model, routes,
roles, audit chain, tile architecture, event stream) are now
locked. See `PHILOSOPHY.md` for the full hard-vs-soft contract.
From this point forward every release on `master` is stable.

### Added

- **`PHILOSOPHY.md`** — THE PHILOSOPHY. Jony Ive / Apple / Ferrari
  design creed as the load-bearing document. Hard-attribute
  contract (data model / routes / roles / audit chain / tile
  architecture / event stream are locked), soft-attribute freedom
  (copy / placement / colours drift between patch releases),
  stable-release discipline (every master release is shippable),
  demo-vs-operational data separation (physically distinct paths,
  `LAB_SCHEDULER_DEMO_MODE=0` mandatory on the production host).
- **`DEPLOY.md`** — Mac mini production deployment. The mini at
  `100.115.176.118` is the canonical production host, reachable
  from every Tailscale peer. Atomic deploys: `git pull` → smoke →
  `launchctl kickstart`. Never interrupts live users.
- **Owner-only `/admin/dev_panel`** — development console for the
  owner role only. Surfaces project progress (git branch, ahead /
  behind, dirty count, recent commits), roadmap (parsed version
  blocks from TODO_AI.txt rendered as `chart_bar` progress meters),
  and an in-page document viewer (README, PHILOSOPHY, PROJECT,
  TODO_AI, CHANGELOG, DEPLOY). No external dependencies.
- **CSRF enforcement on by default.** `LAB_SCHEDULER_CSRF=1`. Every
  `<form method="post">` carries a `csrf_token` hidden input; the
  base-template JS shim auto-injects the token into `fetch()` calls.
- **`tests/test_status_transitions.py`** — exhaustive walk of
  `REQUEST_STATUS_TRANSITIONS`: 21 legal pairs, 70 illegal pairs,
  terminal lock, idempotent self-transitions, admin force-override
  bypass, fast-track. Wired into the pre-push gate next to
  `smoke_test.py`.
- **`chart_bar` macro usage across the dev panel** — replaces the
  ad-hoc badge / detail rows on the progress, bridge, and roadmap
  tiles with the canonical bar widget.

### Removed

- **Ollama bridge** — the v1.2.x Ollama offload plan is retired.
  The Mac mini is now a production host, not a compute bridge.
  Deleted: `OLLAMA_DEV_PLAN.md`, `run_ollama_task.sh`,
  `review_ollama_commits.sh`, `ollama_qc_log.md`,
  `ollama_observations.md`, `crawlers/strategies/ollama_observer.py`,
  the four `.command` launcher files, and every Ollama reference
  in the dev panel, README, TODO_AI.txt, and CHANGELOG.md.
  Rationale: the production host requirement supersedes the
  background-compute experiment and the empirical results
  (v1.2.x dispatches hallucinated diffs) did not justify the
  maintenance cost.

### Changed

- **README.md** — rewritten for the 1.3.0 stable-release posture.
  Roadmap collapses to "v1.4.0 bulk ops, v1.5.0 search" — the
  hardening story is closed.
- **TODO_AI.txt** — v1.3.0 entries moved into the "shipped"
  section; new `v1.3.x patch stream` captures the soft-attribute
  polish queue (safe_int wrap, instrument-page polish, demo /
  backend directory split). Guideline #1 now points at
  `PHILOSOPHY.md`.

### Deferred

- **`safe_int` / `safe_float` wrap** — ~30 sites. Ships as 1.3.1.
- **`request_detail()` handler split** — dropped permanently
  unless the function grows past ~900 lines. The state machine +
  `tests/test_status_transitions.py` already lock every status
  write.

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
