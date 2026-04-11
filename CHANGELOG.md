# PRISM Changelog

All notable changes to this project are documented here. The
format follows [Keep a Changelog](https://keepachangelog.com/),
and PRISM uses [Semantic Versioning](https://semver.org).

The full commit-level history is in `git log`. This file
collapses each release into the rationale and the user-visible
delta — read this first, drop into `git log` for the line-by-line
detail.

## [Unreleased]

Forward plan lives in `docs/NEXT_WAVES.md`. The iOS-style patch
cadence (`docs/PHILOSOPHY.md` §3.1) tags whenever trunk is green;
see the per-tag sections below for what shipped.

## [1.7.0] — 2026-04-11

**Finance portal + grants & budgets — the ERP-ready proof point.**
PRISM is still a scheduler, not an ERP. But when the user asked
"can you pick pieces and put a finance portal in under 30 minutes",
the answer had to be yes. This tag is that answer, twice: external
billing in one pass, grants/budgets with charge-tracking in a
second pass. Both built on the same single-source-of-truth
architecture that runs the rest of the app — `sample_requests`
remains the only table of record, the finance views read
aggregations over its existing `amount_due` / `amount_paid` /
`finance_status` / `grant_id` columns.

### Added (hard)

- **`grants(id, code, name, sponsor, pi_name, total_budget,
  start_date, end_date, status, notes)`** (`app.py`, v1.7.0) —
  new hard table. Each grant has a human-readable code
  (`MHRD-FES-2024`), a sponsor, a PI, a total budget, optional
  date range, and an active/closed status flag.
- **`sample_requests.grant_id`** — nullable FK → `grants.id`.
  Additive ALTER on existing DBs. A sample with a grant_id is
  "charged to" that grant; spend is computed at read time as
  `SUM(amount_paid) WHERE grant_id = ?`.

### Added (soft)

- **`/finance`** (`app.py:finance_portal`) — 4-KPI hero
  (outstanding, total billed, collected, collection rate) +
  by-instrument aggregation table + outstanding invoice list +
  recently-paid list. Read-only view over `sample_requests`.
  Gated to finance + admin roles via `_user_can_view_finance`.
- **`/finance/grants`** (`finance_grants_list`) — totals hero
  (total budget across all grants, spent, remaining, burn rate)
  + per-grant list with progress bars and click-through.
- **`/finance/grants/<id>`** (`finance_grant_detail`) — drill-down
  with 4-KPI (budget, paid, billed, remaining + % used),
  metadata grid (code, sponsor, PI, dates, status), and the list
  of samples charged to the grant with their finance status.
- **`templates/finance.html` + `finance_grants.html` +
  `finance_grant_detail.html`** — three new templates, all in
  the standard tile vocabulary (`.finance-tiles`, Ferrari red for
  outstanding, mint green for collected).
- **`_seed_demo_grants()`** — idempotent DEMO_MODE seeder.
  Six grants: MHRD-FES-2024, DST-XRD-2024, SERB-PI-BIOCHEM,
  ICMR-PHARMA-2024, WPU-INTERNAL, CSIR-NANO-2025.
- **Noticeboard link** — "Finance Portal" quick action added for
  finance + admin roles on `/` dashboard.
- **`.finance-*` + `.mc-meta-grid` CSS** — `static/styles.css`
  appended. Ferrari-dashboard palette consistent with the rest
  of the app: `#c0392b` outstanding, `#2f9e44` collected, earthy
  accents for cells, progress bars with soft glow.

### Why this tag is v1.7.0, not v2.0

v2.0 is a paradigm-shift marker per `docs/PHILOSOPHY.md` §3.1 —
it would mean PRISM is no longer "just a scheduler" but a new
class of system. Finance portal + grants is a *new capability*,
not a *new paradigm*. It earned a minor bump (v1.6.x → v1.7.x)
legitimately, but the core model — `sample_requests` as the
single source of truth, tile-based read views, additive hard
attributes — is unchanged. v2.0 stays on the shelf for something
that actually breaks the current frame.

## [1.6.2] — 2026-04-11

**User-to-user messaging — inbox, detail, compose.** The
noticeboard from v1.6.0 handled broadcast; v1.6.1 added the
admin write surface; v1.6.2 closes the loop with direct
person-to-person messages. Same single-source-of-truth
architecture: one `messages` table, three read views.

### Added (hard)

- **`messages(id, sender_id, recipient_id, subject, body,
  sent_at, read_at, reply_to_id)`** — new hard table. Foreign
  keys cascade on user deletion; `reply_to_id` is a self-FK for
  threading (currently flat, reply is just pre-filled compose).

### Added (soft)

- **`/inbox`** (`inbox_view`) — per-user message list with
  unread dots. Recipient-scoped; the route reads only the
  logged-in user's messages.
- **`/messages/<id>`** (`message_detail`) — single-message view
  with sender / timestamp / Reply button. Auto-marks `read_at`
  on first view (idempotent — second view is a no-op).
- **`/messages/new`** (GET+POST `message_compose`) — compose form
  with recipient dropdown. Capped at 200 recipients via
  `RECIPIENT_CAP` + `?q=` search + recency ranking via
  `MAX(sent_at)` subquery (5000-user scaling fix).
- **`unread_message_count(user)` + `inbox_preview_for_user(user)`**
  — helpers for topbar badge + noticeboard inbox preview.
- **Topbar badge** — unread count appears next to the Inbox link
  on every page (dashboard + tile pages).
- **`_seed_demo_messages()`** — idempotent demo seeder.
- **`templates/inbox.html` + `message_detail.html` +
  `message_compose.html`** — three new templates in the standard
  tile vocabulary.

## [1.6.1] — 2026-04-11

**Admin notices write surface — `/admin/notices`.** v1.6.0
shipped the noticeboard read view; v1.6.1 gives admins the
compose form to write to it without touching the DB.

### Added (soft)

- **`/admin/notices`** (GET list + compose) — two-tile layout:
  compose form on the left, live list of active notices on the
  right. JS scope-target picker that enables/disables the target
  select based on the chosen scope (global / role / user /
  instrument).
- **`/admin/notices/new`** (POST) — create-notice handler with
  scope + severity + expiry + target_id validation.
- **`/admin/notices/<id>/delete`** (POST) — soft-delete by
  setting `deleted_at`. Honoured by `active_notices_for_user`.
- **`_user_can_post_notice(user)`** — gates the admin notices
  page to admin + super_admin roles.
- **`templates/admin_notices.html`** — new template, same tile
  vocabulary as the rest of the app.

## [1.6.0] — 2026-04-11

**Noticeboard + Quick Actions — Ferrari-dashboard home tiles.**
The dashboard is the first thing every user sees. Until v1.6.0
it showed their pending requests and nothing else. This tag adds
two new tiles built for daily orientation: what's happening
right now (noticeboard), and what should I click next (quick
actions), both tuned per-role.

### Added (hard)

- **`notices(id, scope, target_id, severity, title, body,
  created_at, created_by_user_id, expires_at, deleted_at)`** —
  new hard table. Scope ∈ {global, role, user, instrument};
  severity ∈ {info, warning, critical}. Soft delete via
  `deleted_at`. Expiry via `expires_at`.

### Added (soft)

- **`active_notices_for_user(user)`** — returns all active
  notices the user should see based on their role, user_id, and
  instrument memberships. Respects `expires_at` + `deleted_at`.
- **`quick_actions_for_user(user)`** — per-role card list, hard
  cap of 5 cards. Admin sees different cards than requester sees
  different cards than operator.
- **NOTICEBOARD tile** (`templates/dashboard.html`) — severity-
  coloured rows, timestamp, author. Empty state when nothing
  active.
- **QUICK ACTIONS tile** (`templates/dashboard.html`) — 5-card
  max grid of the most-clicked actions for the current user's
  role.
- **`_seed_demo_notices()`** — idempotent demo seeder.
- **`.tile-dash-noticeboard` + `.tile-dash-quick-actions` CSS** —
  Ferrari-dashboard palette.

## [1.5.2] — 2026-04-11

**Mission Control drill-downs + PROJECT CONTROL banner.** v1.5.1
added the PROJECT TIMELINE tile to `/dev`; v1.5.2 makes every
commit and every tag clickable, and adds a dedicated banner
surfacing the current stable version / HEAD / last-shipped
rhythm in one glance.

### Added (soft)

- **PROJECT CONTROL banner** (`templates/dev_panel.html`) —
  three-stat header: current stable tag, HEAD commit, time since
  last ship. Earthy-red accent when HEAD ≠ stable (untagged
  work). NASA-console monospaced feel.
- **`/dev/commit/<sha>`** (`dev_panel_commit`) — per-commit
  drill-down with message, diffstat, changed files.
- **`/dev/tag/<tag_name>`** (`dev_panel_tag`) — per-tag drill-down
  with tagger, date, and the commit range since the previous
  tag.
- **`templates/dev_panel_commit.html` + `dev_panel_tag.html`** —
  two new Mission Control drill templates.
- **Clickable commits + tags** — `PROJECT TIMELINE` tile rows
  link to their drill-downs.
- **`.mc-banner` + `.mc-drill-tiles` CSS** — shared Ferrari
  vocabulary for the Mission Control drill pages.

## [1.5.1] — 2026-04-11

**PROJECT TIMELINE tile — every shipped tag in one view.** The
`/dev` Mission Control panel gets a new tile listing every
version tag chronologically with its commit count, date, and
subject line of the tag commit. The point is daily situational
awareness: how fast are we shipping, what just landed.

### Added (soft)

- **PROJECT TIMELINE tile** (`templates/dev_panel.html`) —
  reverse-chronological tag list. Read via `git for-each-ref`
  through a new helper. Each row shows tag, date, commit count
  since previous tag, and the tag message first line.
- **`future_fixes` tile** — remaining v1.5.0 TODO markers from
  `scripts/seed_fixes.py`, grouped by file. Click any to open
  the file at that line.
- **`.tile-dev-timeline` + `.tile-dev-future-fixes` CSS.**

## [1.5.0] — 2026-04-11

**First minor bump on the `v1.4.x` → `v1.5.x` line.**
**Multi-role users land as a first-class hard attribute.** This
is the capability release that unblocks every pending
`user["role"] ==` migration — individual call-site rewrites ship
as patches on the v1.5.x line over the coming days.

### Added (hard — see `docs/PHILOSOPHY.md` §2 update)

- **`user_roles(user_id, role, granted_at, granted_by_user_id)`
  junction table** (`app.py:3539`) — additive new hard attribute.
  Every user may hold multiple roles simultaneously. `PRIMARY KEY
  (user_id, role)` enforces uniqueness. Foreign keys cascade on
  user deletion. The legacy `users.role` column remains as the
  canonical **primary role** (display + topbar label); the
  junction layers additional roles on top without breaking any
  existing permission check.
- **`user_role_set(user) → frozenset[str]`** (`app.py:3965`) —
  returns every role assigned to `user`, primary + additional.
  Graceful degradation if the junction table is missing
  (returns the primary role alone). Idempotent, no side effects.
- **`user_has_role(user, role) → bool`** (`app.py:3989`) — the
  canonical membership check. Replaces every
  `user["role"] == "admin"` pattern at call sites.
- **`grant_user_role(user_id, role, granted_by=None)`** — idempotent
  insert into `user_roles`. Safe to call repeatedly.
- **`revoke_user_role(user_id, role)`** — removes a role from the
  junction. Does not touch `users.role` — callers that want to
  change the primary role must update that column separately.
- **`_backfill_user_roles()` second-pass at end of `seed_data()`**
  (`app.py`, this tag) — the first-pass backfill in `init_db()`
  ran before `seed_data()` created demo users, so `user_roles`
  stayed empty on fresh DBs. The second pass reruns the
  idempotent `INSERT OR IGNORE` after seeding. **This is the
  v1.5.0 acceptance gate bug-fix** — the helpers technically
  still worked because `user_role_set()` falls back to
  `users.role` as the primary, but the junction was never
  actually populated, which meant multi-role assignment had no
  working backing store.
- **`tests/test_multi_role.py`** — 13 assertions locking every
  helper: backfill populates, role set includes primary +
  additional, `has_role` true/false paths, grant is idempotent,
  revoke preserves primary, None-user safety. Pure function +
  tmp DB shape, no Flask request context.

### Changed (soft)

- **`docs/PHILOSOPHY.md` §2 hard-attribute table** — row
  "9 roles" → "9 roles + `user_roles` junction". The role set
  itself is still locked at 9 (multi-role is additive: a user
  can hold *more than one* of the existing 9, not a new role
  outside them). Any new canonical role still requires a major
  version bump.
- **`docs/NEXT_WAVES.md` § Future technology bets** — the
  "Tech bet — Multi-role users (v1.5.0)" row moves out of the
  tech-bets backlog and into shipped history. The related
  "Tech bet — Instrument groups (v1.5.1)" row stays parked —
  its schema (`instrument_group` + `instrument_group_member`)
  is already in `init_db` alongside `user_roles`, but the
  assignment-matrix UX and `group_visibility` crawler are
  deferred to the v1.5.x patch stream.

### Not done in this tag (follow-up patches on the v1.5.x line)

- **Retire the 106 `# TODO [v1.5.0 multi-role]` markers** seeded
  in `d9297e6`. Each is a call-site where `user["role"] == X`
  should become `user_has_role(user, X)`. The `future_fixes_placeholder`
  crawler surfaces the remaining count on the dev panel and
  the number decrements as each site lands. Planned tags:
  `v1.5.1` retires the 30 easiest call sites (single-role
  comparisons in `app.py:1000-2000`), `v1.5.2` retires the
  set-membership patterns (`user["role"] in {...}`), etc.
- **`multi_role` behavioral crawler** — asserts both role-path
  resolution for every seeded persona. Scaffolded in the
  `NEXT_WAVES.md` proposal, implementation shipping as a
  v1.5.x patch.

## [1.4.10] — 2026-04-11

**Service-mode hardening + protocol deep-review.** Tenth
iOS-cadence patch. End-of-sprint capstone bundling one
service-mode bug-fix and the parallel-work protocol's biggest
doctrinal update of the session.

### Added

- **`docs/PARALLEL.md` read vs write agent distinction**
  (`74dd677`) — read agents run unlimited concurrent, write
  agents capped at 2 (lowered from 3). Crawler runs are
  explicitly read agents because `reports/` + `logs/` are
  gitignored. Unlocks N concurrent `wave all` invocations.
- **`docs/PARALLEL.md` hardening — stash / index-pollution /
  NOOP** (`2d8b32c`) — every rule now tied to an observed
  2026-04-11 production incident. Rule 2 (`never git stash`)
  strengthened with the 4-violations-in-one-day observation
  and the "STOP, surface, wait" recovery. New rule 11 for
  index-pollution recovery via `git reset HEAD <file>`. New
  rule 12 explicit on shared filesystem. New "NOOP is a
  first-class success" section documenting 4 correct NOOPs.

### Fixed

- **`scripts/start.sh --service` pins `LAB_SCHEDULER_AUTORELOAD=0`
  unconditionally** (`ccf5751`) — belt-and-suspenders for the
  launchd bootstrap path. The Werkzeug reloader forks a child
  and exits the parent, which makes launchd mark the service
  `EX_CONFIG` (exit 78). Observed during the attempted launchd
  bootstrap this session. Setting it in `start.sh` guarantees
  service mode always turns the reloader off regardless of
  how the script was launched. (Launchd bootstrap itself still
  fails silently for an unrelated reason — tracked separately
  as a follow-up.)

## [1.4.9] — 2026-04-11

**5 parallel streams shipped in one sprint.** Ninth
iOS-cadence patch. Three background agents + two in-session
lanes running concurrently on disjoint file surfaces.

### Added

- **`future_fixes_placeholder` counter tile on dev panel**
  (`8e3a0c8`) — new `tile-dev-future-fixes` tile between
  STABLE RELEASE / LATEST SHIPPED and the NOW SHIPPING hero,
  headlining the remaining v1.5.0 TODO count (106 on first
  render). Reads from a new `_dev_panel_future_fixes_count`
  helper that re-runs the seed_fixes regex against `app.py`
  at render time.
- **`tests/test_seed_fixes.py`** (`420735b`) — unit tests for
  `scripts/seed_fixes.py` locking the regex + `already_marked`
  idempotency + triple-quote-block skip + `--dry-run` read-only
  + `--apply` writes + second-apply idempotency. 5 check
  functions, ~20 assertions, plain-script shape (no pytest
  needed).
- **CHANGELOG backfill [1.4.6] [1.4.7] [1.4.8]** (`d42f08d`) —
  CHANGELOG caught up to git tags, 76 lines added.
- **Demo data expansion from ~30 to ~47 sample requests**
  (`72a4b84`) — `populate_live_demo.py` auto-generative loop
  bumped from `range(18)` to `range(35)` so the public demo
  queue looks realistically populated when visitors land on
  `/schedule`.
- **`docs/PARALLEL.md` read vs write agent section** (`74dd677`
  — also captured in [1.4.10] above because the refinement
  commit landed between the two tags).

### Notes

Sprint merge overhead: one index-pollution incident
(concurrent agent left CHANGELOG.md staged) resolved via
`git reset HEAD`. Within the 5% soft target. Protocol worked.

## [1.4.8] — 2026-04-11

**Sitemap tile graduation + v1.5.0 progress counter.** Eighth
iOS-cadence patch. Two parallel-agent wins landing the last
canonical-page exemption and a new behavioral crawler.

### Added

- **`future_fixes_placeholder` crawler** (`4ded600`) — new
  behavioral-wave strategy that counts remaining
  `# TODO [v1.5.0 multi-role]` markers across `app.py` + templates.
  First run: 106 markers, top file `app.py` (106). Reports via
  `result.metrics.total_markers / by_release / by_file / top_files`
  so the dev panel can eventually show 'unreleased multi-role work'
  as a progress signal. Wired into behavioral (not sanity),
  aspect=regression.
- **Sitemap graduated onto `.sitemap-tiles` pattern** (`4203fd9`) —
  `sitemap.html` was the only canonical page still exempt from the
  tile-architecture rule (ui_uniformity flagged it earlier this
  session). Graduated onto a new 6-column grid mirroring
  `.new-request-tiles`, exemption removed from both ui_uniformity
  and the canonical-tile crawlers.

## [1.4.7] — 2026-04-11

**Public cloudflared tunnel + rotate helper + ship.sh absorption
fix.** Seventh iOS-cadence patch. Bundles the demo-goes-public work
and one protocol bug-fix surfaced by parallel agents.

### Added

- **`scripts/rotate_demo_tunnel.sh`** (`f48ef12`) — one-command
  cloudflared rotation + github.io push. 7-step flow: pre-check
  Flask, kill old tunnel, start fresh, poll log for URL, verify
  `/login?demo=1` prefill, rewrite `_config.yml` `url`+`base`,
  commit+push both remotes. Demo now reachable from the public
  internet via `https://<subdomain>.trycloudflare.com` proxying
  laptop `:5055`.

### Changed

- **`scripts/ship.sh` no longer absorbs concurrent agents' untracked
  files** (`47dc29a`) — stages modified-tracked only by default,
  bails with a hint if untracked files exist and the caller did not
  list them explicitly. Closes the `a40d845` absorption bug where
  agent G's `ui_uniformity.py` got pulled into an unrelated commit.

## [1.4.6] — 2026-04-11

**Demo card + ship.sh velocity + v1.5.0 pre-seed + CHANGELOG
backfill.** Sixth iOS-cadence patch. Six real-work commits since
v1.4.5 shipped under the 5-min-block cadence.

### Added

- **`scripts/seed_fixes.py` + 106 v1.5.0 TODO markers** (`d9297e6`) —
  pre-seeds multi-role TODO markers at every `user['role']` call
  site so the future v1.5.0 agent finds context directly in the
  code. 106 markers across `app.py` + templates.
- **`scripts/ship.sh` velocity helper** (`4ea2560`) — one-command
  `stage → smoke → commit → rebase → push` flow. Also pins
  `LAB_SCHEDULER_AUTORELOAD=0` in the laptop launchd plist.
- **`admin/12345` credential + `/login?demo=1` prefill** (`a40d845`,
  `a1fb4be`) — public demo card gets an auto-filled email +
  password for first-time visitors; crawler harness login made
  password-aware.

### Changed

- **Unified seed passwords on `12345` + role-named persona emails**
  (`f773e1c`) — `operator@`, `requester@`, `approver@`, etc.
  coexisting with legacy named personas at stable IDs.
- **CHANGELOG backfill for [1.4.1]–[1.4.5]** (`773e8a6`) — retro
  sections written after the fact to catch the file up with the
  tag stream.

## [1.4.5] — 2026-04-11

**Dev-panel deep fixes + Flask auto-reload.** Four bundled commits
landing the dev panel's "what's the stable version?" answer and
unblocking laptop hot-reload.

### Added

- **Parallelism budget codified** (`8474506`) — `docs/PARALLEL.md`
  gains a soft 5%/1min + hard 10%/2min merge-overhead rule with a
  3-agent concurrency cap and a pre-firing estimation checklist.

### Changed

- **ROADMAP tile now reads from git tags** (`6e79194`) — retired the
  stale `TODO_AI.txt` parse ("v1.4.0 BULK OPERATIONS") in favour
  of grouping semver tags by major.minor line. WAVES tile Time
  budget table caught up to W1.4.15.
- **`ahead_behind` targets real upstream** (`6e79194`) — was
  hardcoded to `origin/main`, now resolves `@{upstream}`.
- **Flask auto-reload decoupled from debug toolbar** (`984acaa`) —
  `use_reloader` now defaults ON for loopback binds, OFF for
  LAN-facing. New `LAB_SCHEDULER_AUTORELOAD` env-var override
  for explicit opt-in/out. Laptop `.py` edits hot-reload without
  manual restart.

## [1.4.4] — 2026-04-11

**Dev panel three-panel answer.** Stale-oracle drift surfaced in
user screenshots; fixed at the source.

### Added

- **Dev panel Stable Release tile** (`e9c7c2c`) — big accent-blue
  `vX.Y.Z` headline with sha + tagged-at + commits-since-tag depth
  hint. Reads from `git tag --list`, not CHANGELOG.md.
- **Dev panel Latest Shipped tile** (`e9c7c2c`) — HEAD commit
  headline + author + cross-reference to stable tag depth.

### Changed

- **`_dev_panel_progress.current_release` now reads git tags**
  (`e9c7c2c`) — CHANGELOG.md was lying (stopped at [1.3.12] while
  origin had v1.4.3 tagged). Tags are the authoritative oracle.

## [1.4.3] — 2026-04-11

**iOS-cadence philosophy + Future technology bets reframing.**

### Added

- **`docs/PHILOSOPHY.md` §3.1 — iOS patch cadence** (`81d4c13`) —
  explicit schema (MAJOR / MINOR / PATCH semantics), 4-point
  "ready to tag" checklist, tagging protocol (no checkout
  needed), and the v1.4.2 proof point.

### Changed

- **`docs/NEXT_WAVES.md` "Future technology bets" section**
  (`81d4c13`) — reframes HTTPS / multi-role / instrument-groups
  / ERP-2.0 as strategic operator decisions, not routine
  task-board rows. HTTPS explicitly "a goal, not a todo."

## [1.4.2] — 2026-04-11

**First iOS-cadence patch release.** ~15 commits since v1.4.1
captured under one tag after the cadence policy was adopted.

### Added

- **Parallel agent work protocol** (`37f3623`, `5709104`) —
  `CLAIMS.md` live lock board at repo root, `docs/PARALLEL.md`
  full spec (3 safety layers, 12-step lifecycle, lane taxonomy,
  abort protocol), `WORKFLOW.md` §3.7 minimum-rules summary.
  Hardened with 10 non-negotiable git hygiene rules after
  production runs.
- **`new_request.html` graduated onto tile pattern** (`a9825b8`) —
  full-width form, sample intake summary as horizontal tile,
  zero wasted whitespace. Mirrors `instrument_detail.html`.
- **Inline XHR approve/reject toggle** (`200f491`) — replaces the
  twin-form approve/reject block on request_detail's Approvals
  tile with single-tap approve + 2-tap-armed reject.
- **Inline intake-mode toggle** (`e3157c1`) — instrument operators
  can flip between "accepting" / "hold" / "maintenance" without
  leaving the detail page. 2-tap safety.
- **Dev panel "Now Shipping" hero** (`597640a`) — 4-cell hero tile
  (release / hot wave / commits today / crawlers last ran).
- **Requester dashboard pulse tile** (`64c01b5`).
- **New crawlers**: `xhr_contracts` (`b90a83a`), `agents_md_contract`
  (`391e7ae`), `parallel_claims` (new behavioral-wave check),
  `dev_panel_readability` (`94849ae`).
- **Launchd newsyslog rotation** (`be38a6f`) — `server.log` gets
  daily rotation keeping 7 compressed archives. Opt-in via
  `scripts/install_launchd.sh`.
- **Portfolio action-first dashboard** (`9d682a4`).

### Changed

- **Grid-overlay unhooked from main site** (`02cb7ce`) — the
  always-on floating grid button removed from `base.html`;
  `static/grid-overlay.js` preserved for a future dev-mode wave
  (see `docs/NEXT_WAVES.md` § "Deferred — dev mode overlay").
- **PROJECT.md §11 documents the tile-family pattern**
  (`b33240b`) — `.inst-tiles` / `.request-tiles` /
  `.new-request-tiles` as a reusable abstraction.

## [1.4.1] — 2026-04-11

**UX polish batch — time hints, topbar badges, empty-state warmth,
keyboard shortcuts.** First tag on the v1.4.x line.

### Added

- **`.row-time-hint`** (`36fe93f`) — server-side `time_ago()` helper
  renders "just now / 5m ago / 3h ago / 2d ago / in 4h" under every
  queue row's exact timestamp.
- **Topbar queue count badge** (`455ffb7`) — pending-for-role count
  on the Queue nav item. New `topbar_badges` sanity crawler.
- **Empty-state warmth** (`db7bc19`) — shared `empty_state(...)`
  macro applied to all big tables. New `empty_states` sanity
  crawler.
- **Bare-key shortcuts `n` + `?`** (`bcd3990`) — `static/keybinds.js`
  (≤40 lines, vanilla JS). `n` → `/requests/new`, `?` → help
  overlay. Philosophy crawler extended with rule 8 enforcing the
  40-line budget and base.html reference.
- **AGENTS.md at project root** (`90383b1`) — vendor-neutral agent
  onboarding covering topology, commit rhythm, pre-commit gate,
  hard/soft contract, demo/operational separation.

### Changed

- **CSS fossil backlog wiped** (`0d3102e`) — 231 orphaned selectors
  retired. `css_orphan` went 512/0/229 → 548/0/0.
- **Stunnel / Caddy fallback retired** (`929911d`) — Tailscale Serve
  is now the only HTTPS path.
- **`docs/NEXT_WAVES.md` optimized** (`6f2b543`) — collapsed
  W1.3.9+W1.4.0 into one post-ops wave, critical path to
  demo-live dropped from ~4 days to ~2.5 h focused work.

## [1.3.12] — 2026-04-11

**Retire the stunnel/Caddy self-signed HTTPS fallback.** Tailscale
Serve is now the only HTTPS path — one fewer moving piece.

### Removed

- **`ops/Caddyfile`, `ops/certs/cert.pem`, `ops/certs/key.pem`**
  (`929911d`) — the self-signed reverse-proxy stack has no consumer
  left after W1.3.9.
- **`scripts/start.sh --https` and `--trust` modes** — remaining
  modes are dev (Chrome auto-open) and `--service` (launchd).

### Changed

- **`README.md`, `docs/DEPLOY.md` §5, `docs/HANDOVER.md` 2.1,
  `docs/PROJECT.md` §13–14** — every doc reference to the stunnel/
  Caddy path rewritten to point at `docs/HTTPS.md` (Tailscale
  Serve). Sanity wave still 160/0/0.

## [1.3.11] — 2026-04-11

**CSS fossil backlog wiped.** Every line should serve a purpose.

### Removed

- **194 dead CSS selectors + ~1700 lines of rule-body dead weight**
  (`0d3102e`) from `static/styles.css`. File went from 7382 →
  5636 lines. Brace-tracking parser (not sed) handled multi-
  selector lists and `@media` variants correctly. Also killed a
  malformed `/* Badge — semi-transparent{ ... }` block whose
  opening comment was never closed.

### Changed

- **`css_orphan` crawler allowlist** — 13 selectors were false-
  positives emitted at runtime via `{{ }}` template interpolation.
  Added prefixes for `status-`, `stat-tone-`, `dp-wave-`,
  `month_white_`, and bare `fc`. Threshold dropped from 260 → 20
  so any regression fails loudly. Crawler now reports 548/0/0.

## [1.3.9] — 2026-04-11

**Tailnet HTTPS code prep (W1.3.9 + W1.4.0).** Laptop-side
deliverables for tailnet HTTPS; execution is blocked on one
operator click at the Tailscale admin console.

### Added

- **`scripts/tailscale_serve.sh`** (`5bc3142`) — three-verb
  wrapper (up / down / status) around
  `tailscale serve --bg --https=443 5055`, using the full
  `/opt/homebrew/bin/tailscale` path since launchd/ssh sessions
  don't inherit the interactive PATH.
- **`docs/HTTPS.md`** (~150 lines) — full Plan-A recipe: enable
  Serve, revert loopback binding, run the helper, flip cookie
  flags, verify with `deploy_smoke`, revert the firewall
  exception, re-bookmark. Plan-B mkcert fallback stub for the
  extreme case where Serve cannot be enabled at all. Current-state
  table at the bottom makes the blocker explicit.

### Blocked on

- **One operator click** at
  https://login.tailscale.com/f/serve to enable Tailscale Serve
  tailnet-wide. Once clicked, the rest collapses to ~10 min of
  ops work. Sanity wave is 160/0/0 (no Flask surface touched).

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

## [1.3.7] — 2026-04-10

**Layered roles + instrument-group quick-grant in user admin.**
Wires the additive schema from v1.3.6 into the user-detail page.

### Added

- **Multi-role editing on `/users/<id>`** (`19d72b5`) — new
  `update_user_role_set` POST action. Ticked roles are granted,
  unticked are revoked, and the primary role (`users.role`) is
  always force-granted so the set never drops below the
  single-role baseline. Only `super_admin` may layer
  `site_admin` on top.
- **Extra-roles tile** — renders the full role set as inline
  `.role-chip` badges with an Edit toggle that exposes a
  checkbox grid. The primary-role checkbox is disabled to
  prevent accidental revocation.
- **Group quick-grant row** inside the Instrument Access tile
  — one button per `instrument_group`, each ticking the operator
  lane for every member instrument. The junction tables stay
  authoritative; groups are a pure UI shortcut.

## [1.3.6] — 2026-04-10

**Additive schema — `user_roles` + `instrument_group` (W1.3.6/W1.3.7).**
Three new tables, zero breaking changes.

### Added

- **`user_roles(user_id, role, granted_at, granted_by_user_id)`**
  (`ba64c10`) — layers additional roles on top of the existing
  `users.role` column. `users.role` stays the primary role for
  display and topbar; helpers `user_role_set`, `user_has_role`,
  `grant_user_role`, `revoke_user_role` handle reads/writes.
- **`instrument_group(id, name, description)`** +
  `instrument_group_member(group_id, instrument_id)` — admin-
  curated bundles of instruments used as grant shortcuts. Does
  not affect the existing `instrument_admins` /
  `instrument_operators` / `instrument_faculty_admins` gating.
- **`init_db` backfills** — `user_roles` gets one row per
  existing user mirroring `users.role`; `instrument_group`
  auto-seeds one group per distinct `instruments.category`
  when the table is empty.
- `inject_globals` exposes `current_role_set`, `user_has_role`,
  `instrument_groups_all` for templates.

## [1.3.5] — 2026-04-10

**WAL journal mode + `slow_queries` crawler (W1.3.5 + W1.3.8 partial).**

### Added

- **SQLite WAL pinned** (`f81e55d`) — `PRAGMA journal_mode = WAL`
  and `synchronous = NORMAL` in both `init_db()` and `get_db()`
  so every PRISM connection is born in WAL. Concurrent reads
  during writes, same durability envelope.
- **`crawlers/strategies/slow_queries.py`** — monkey-patches
  `query_all` / `query_one` / `execute`, records per-fingerprint
  timings across five hot routes, and flags anything > 50 ms
  (warn) or > 250 ms (fail). Baseline: 37 distinct queries, 0
  over budget. Wired into the `coverage` wave.

## [1.3.4] — 2026-04-10

**Role orientation hint + `role_landing` crawler.**

### Added

- **Role-hint badge** (`7a4d11c`) — dashboard and sitemap now
  render a "you are here" tile using the `current_role_display`
  + `current_role_hint` globals already in `inject_globals`. One
  shared badge style in `static/styles.css`, reused across both
  pages.
- **`role_landing` crawler** — asserts the badge renders on
  `/` and `/sitemap` for every `ROLE_PERSONAS` entry (16
  checks in ~1 s). Added to the `sanity` wave as a hard gate
  and to `behavioral` for completeness.

### Fixed

- Harness bootstrap forces persona roles via `UPDATE` after
  `INSERT OR IGNORE`, so `ROLE_PERSONAS` stays authoritative
  even if `seed_data` already inserted the same email with a
  different role.

## [1.3.3] — 2026-04-09

**Member admin hardening.** User detail becomes the central hub
for member administration.

### Added

- **Change Role tile** (`72e0b35`) on `/users/<id>` — site_admin+
  can change a user's role through a toggle form. Safeguards:
  owners are untouchable by lesser admins, super_admin lane
  requires super_admin viewer, site_admin can't over-grant
  beyond their own manageable instruments.
- **Instrument Access tile** — three-lane assignment matrix
  (admin / operator / faculty) grouped by instrument category
  with quick-grant buttons ("Grant all as operator", etc.) and
  a clear-category action. Wired through a new
  `update_user_instruments` handler.
- **Per-role orientation** — `inject_globals` exposes
  `role_display_name` + `role_next_action` so templates can
  render role-scoped next-step copy consistently.

## [1.3.2] — 2026-04-09

**In-place admin metadata editing with timeline append.**
Extends the v1.3.1 instrument edit pattern to users and
requests.

### Added

- **User Metadata edit** (`d131e27`) — `user_detail.html` gains
  an Edit toggle over name / member_code / active, handled by
  a new `update_user_metadata` route. Self-deactivation blocked;
  owner/super_admin rows protected from lesser admins.
- **Request Details edit** — `request_detail.html` gains an
  admin Edit toggle over title / sample_name / sample_count /
  working remarks, handled by `update_request_metadata`. Only
  visible to instrument-managers on non-completed requests.
- **Timeline append** — both handlers write a `log_action` row
  so edits land in the existing timeline feeds. The timeline
  renderer formats `request_metadata_updated` with the changed
  fields inline.

### Changed

- **Generic `data-toggle-target` handler** in `base.html` —
  one IIFE replaces four bespoke toggles. Any button carrying
  `data-toggle-target="#id"` now reveals/hides that element.

## [1.3.1] — 2026-04-09

**Skeleton strengthening pass — dead code purge + tile grids.**
Max-gain / min-effort crawler-driven cleanup.

### Removed

- **6 dead templates** (`8e9a7d4`) — `budgets.html`,
  `email_preferences.html`, `finance.html`,
  `instrument_config.html`, `notifications.html`, `pending.html`
  (no `render_template` / `url_for` references anywhere).
- **5 dead Python helpers** (~87 lines) in `app.py` —
  `generate_unique_reference`, `planner_datetime_value`,
  `processed_history_query_parts`, `user_upload_root`,
  `week_start_for`.

### Fixed

- **`philosophy` crawler warnings cleared** — `activate.html`
  and `docs.html` wrapped in proper `-tiles` grids with
  `card_heading` macros; `error.html` / `sitemap.html`
  exempted as single-purpose layouts; `portfolio.html` inline
  style colours moved to a `.portfolio-forecast-chip` class
  with a `--chip-bg` custom property.
- **`cleanup` crawler warnings:** 11 → 0.
- **`css_orphan` warnings:** below the new regression threshold.

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
