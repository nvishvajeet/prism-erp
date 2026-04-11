# PRISM dev plan — optimized build plan from 02cb7ce

_Last re-anchored 2026-04-11 (third pass) after the grid-overlay_
_unhook. Replaces the backlog section of `ROADMAP.md`. Each wave is_
_a bounded commit bundle on `v1.3.0-stable-release`, with a crawler_
_proof and a time budget. Sanity wave stays green end-to-end between_
_every wave._

_**Third pass** marks every W1.4.1 / W1.4.2a / W1.4.3 item as_
_✅ SHIPPED against actual git history, collapses the ship-today_
_candidates list to only the truly pending items, and adds a_
_"now parked" section pointing at the dev-mode overlay plan_
_further down. Second pass (earlier) collapsed W1.3.9+W1.4.0 into_
_a single post-ops wave and split the release gate into laptop-local_
_vs ops-dependent work._

## State @ 02cb7ce

* **Branch:** `v1.3.0-stable-release` @ `02cb7ce`
* **Tags on the line:** `v1.3.8`, `v1.4.1`.
* **Shipped since the second-pass anchor at `db7bc19`:**
  `bcd3990` (W1.4.1 c3 — `keybinds.js` + `n`/`?` help overlay +
  philosophy rule locking the ≤40-line budget) → **tags `v1.4.1`**;
  `61c45b9` (W1.4.2a c1 — CHANGELOG `[Unreleased]` fill + `[1.3.8]`
  section); `741742b` (W1.4.2a c2 — README quickstart, five lines
  clone→login); `424bf9c` (W1.4.2a c3 — pre-receive sanity hook
  installed on the laptop bare, two-tier safety net now live);
  `3f2ef2b` (portfolio calendar + inline amount override + pipeline
  table); `d2b3546` (W1.4.2a mark-shipped doc pass); `ff6057a`
  (dev_panel WAVES regex accepts letter-suffixed wave ids);
  `535b2dc` (CHANGELOG backfill 1.3.1–1.3.7); `e3157c1` (W1.4.3 c1 —
  inline intake-mode toggle on `instrument_detail.html`, 2-tap
  safety); `72b5821` (unit test — `time_ago()` humanisation, 15
  cases, no Flask context); `8ea3fab` (AGENTS.md — two-tier safety
  net + pre-receive flow); `597640a` (W1.4.3 c2 — dev_panel
  "Now Shipping" hero + hot-wave highlight); `94849ae` (W1.4.3 c3 —
  `dev_panel_readability` crawler locks the hero contract);
  `6baca66` (fix — scrub `GIT_*` env from `_dev_panel_git`
  subprocess so the sanity wave hook no longer reads the bare's
  object store); **`02cb7ce`** (grid-overlay unhooked from main
  site, parked behind future debug mode); `b658249` (laptop launchd
  agent + service-mode reloader fix); `9d682a4` (portfolio
  action-first dashboard); `42a3068` (mini LaunchDaemon variant
  for headless install); `80979f3` (CSS orphan retirement,
  instrument form + reports tone).
* **W1.4.3 note:** the old second-pass doc anticipated W1.4.2 as the
  next tag on the critical path. In reality a "W1.4.3" batch
  (inline intake toggle + dev_panel hero + readability crawler)
  landed *before* W1.4.2 tagged, untagged, as Jony-Ive polish on
  top of the already-green v1.4.1. Not blocking; just noted so
  future agents don't chase the W1.4.2 tag and wonder where W1.4.3
  came from.
* **Static wave right now:** architecture 63/0/9, philosophy 14/0/0,
  css_orphan 548/0/0. **Zero CSS orphan warnings.**
* **Sanity wave:** 170/0/0 across 7 strategies (smoke 33,
  visibility 96, role_landing 18, topbar_badges 4, empty_states 3,
  contrast_audit 13, deploy_smoke 3) — pre-push gate is now
  broader, still under budget.
* **Laptop:** Flask up at http://127.0.0.1:5055/ (demo mode).
* **Mini:** pulled, venv built, launchd plist ready. Blocked on
  ONE operator click: "Enable Tailscale Serve for this tailnet"
  at https://login.tailscale.com/f/serve . All code for
  W1.3.9+W1.4.0 is already landed in `5bc3142`, and the stunnel
  fallback was retired in `929911d` — the click is the only gate.

## Design principles for this plan

1. **Shortest credible path to demo.** The #1 unlock is "the mini
   is a URL on my portfolio". Everything on that critical path
   ships first; polish ships second; schema changes ship last.
2. **Verification before infrastructure.** Write the crawler that
   proves a deploy works (`deploy_smoke`) *before* writing the
   launchd service it verifies. That way the very first green run
   is the acceptance gate.
3. **Incremental network surface.** We can ship "tailnet-only HTTP"
   in one command today. Real Let's Encrypt HTTPS is a separate,
   smaller step. Don't couple them.
4. **Parallel tracks, single trunk.** Infra (Track A) and UX
   polish (Track B) never share files. They can be worked in
   parallel sessions and interleaved on trunk without rebases.
5. **Schema waves are v1.5.0.** Multi-role and instrument-groups
   each rewrite a foundational column. They do not belong on the
   v1.4.x polish/stabilization line.

## Critical path (the only path that matters for the demo)

```
                                   ┐
W1.3.7  deploy_smoke crawler       │ ✅ SHIPPED (laptop-local)
W1.3.8  launchd service            │ ✅ SHIPPED (tag v1.3.8)
                                   ┘
W1.4.1  Jony-Ive polish (3 commits)     ← Track B, no ops dep, ~2 h
W1.4.2a release prep (ops-free)         ← Track C split, ~90 min
   ┊    CHANGELOG + README quickstart + pre-push hook

┄┄┄┄┄ ops gate: one click at https://login.tailscale.com/f/serve ┄┄┄┄┄

W1.3.9  tailnet serve HTTP→HTTPS one-shot   ← ~15 min ops, tag v1.3.9
W1.4.2b portfolio button + v1.4.2 tag       ← ~10 min, demo is LIVE
```

Everything above the ops gate ships without any external dependency
(no admin console, no sudo on the mini). Everything below the ops
gate collapses to ~25 minutes of ops work the moment the click
happens.

Deferred, not on the critical path:

```
W1.5.0  multi-role users        ← schema, post-v1.4.2
W1.5.1  instrument groups       ← schema, depends on W1.5.0
```

## Track A — infrastructure (sequential, 1 day)

### W1.3.7 — `deploy_smoke` crawler (½ hour) ✅ SHIPPED

*The verification tool that every later infra wave lands against.*

* New `crawlers/strategies/deploy_smoke.py`. Reads `PRISM_DEPLOY_URL`
  env var; if unset, strategy reports *skipped* (exit 0). If set,
  hits `/login`, `/`, `/sitemap`, asserts HTTP 200 and that each
  response body contains a sentinel string (`<title>PRISM`).
* Uses `urllib.request` with an `SSLContext` that verifies the
  cert chain when the URL is `https://`. A warning — not a fail —
  when the cert is self-signed, so both Plan A (Tailscale LE) and
  Plan B (mkcert) can pass.
* Registered in the `sanity` wave as an opt-in final step. Laptop
  runs without the env var → noop → sanity stays fast.
* Commit proof: run `PRISM_DEPLOY_URL=http://127.0.0.1:5055
  .venv/bin/python -m crawlers run deploy_smoke` against the
  laptop server → expect 3/0/0 green.

Exit tag: no tag, one commit.

### W1.3.8 — launchd service for Flask on the mini (1-2 hours) ✅ SHIPPED

*Turns the `nohup` dance into a real service that survives reboots.*

* `ops/launchd/local.prism.plist` — `KeepAlive` true,
  `RunAtLoad` true, stdout/stderr to `logs/server.log`,
  `EnvironmentVariables` sourced from a one-line wrapper.
* `scripts/start_server.sh` — exports `.env`, execs
  `.venv/bin/python app.py`. Launchd invokes this, not python
  directly, so env loading is unambiguous.
* `scripts/install_launchd.sh` — copies the plist to
  `~/Library/LaunchAgents/`, runs `launchctl bootstrap`.
* Delete the mini's stray `nohup` processes.
* `docs/DEPLOY.md` §2 rewrite — the launchd recipe is now the
  canonical recipe. Plan-B (manual `python app.py`) stays as a
  debugging fallback only.
* Acceptance: reboot the mini, wait 30s, run `deploy_smoke` from
  the laptop with `PRISM_DEPLOY_URL=http://100.115.176.118:5055`.
  Must be green without any manual start command.

Blocking item: the Application Firewall still drops inbound
packets to :5055 per the diag log. W1.3.8 acceptance requires the
one-command operator unblock first. If Track A is running before
that unblock, **skip the reboot-acceptance step** and instead
verify via `ssh mini curl http://127.0.0.1:5055/login` → 200.

Commits: 2 (plist+scripts, DEPLOY.md rewrite). Tag **v1.3.8**.

### W1.3.9 — tailnet serve HTTP→HTTPS one-shot (~15 min ops, post-click)

*All code is already landed in `5bc3142` (`scripts/tailscale_serve.sh`*
_+ `docs/HTTPS.md`). The two former waves W1.3.9 (HTTP) + W1.4.0_
_(HTTPS) collapse into one ops event because they share the same_
_unblock click and the helper script wraps both commands. No reason_
_to ship tailnet-only HTTP as a separate step now that the cert_
_provisioning is scripted._

**Ops recipe, run on the mini after the operator clicks
"Enable Tailscale Serve" at
https://login.tailscale.com/f/serve :**

1. `bash scripts/tailscale_serve.sh` — runs `tailscale cert`
   then `tailscale serve --bg --https=443 …`. Provisions the
   Let's Encrypt cert and fronts Flask in a single shot.
2. Flip `.env`: `LAB_SCHEDULER_HTTPS=true` +
   `LAB_SCHEDULER_COOKIE_SECURE=true`. Flask's cookie hardening
   switches on.
3. `launchctl kickstart -k gui/$(id -u)/local.prism` — atomic
   restart of the launchd service with the new env.
4. From the laptop:
   `PRISM_DEPLOY_URL=https://prism-mini.tail-xxxx.ts.net \
    .venv/bin/python -m crawlers run deploy_smoke` → expect 3/0/0
   green with a valid cert chain.
5. Bookmark `https://prism-mini.tail-xxxx.ts.net/` on every
   device on the tailnet.

**Plan B (fallback):** if the admin console blocks Tailscale
Serve for this tailnet, swap to `mkcert` + Flask `ssl_context`
per `docs/HTTPS.md` §Plan B. Costs an extra 20 minutes but has
zero external dependencies.

Commits: 1 (env flip + any docs tweaks discovered during the
run). Tag **v1.3.9**.

## Track B — Jony-Ive UX polish (parallel to Track A, ~2 hours)

### W1.4.1 — polish batch (3 commits, not 5)

Collapsed from the earlier 5-item list. Role-greeting dropped —
redundant with the shipped `tile-dash-role-hint` badge. Estimate
shrunk from "2 days" to "2 hours" because each commit is <50
lines of diff — the original 2-day budget was inflated.

**Commit 1a — `.row-time-hint` muted span on queue rows. ✅ SHIPPED (`36fe93f`)**
  - server-side `time_ago()` helper (`just now`, `5m ago`,
    `3h ago`, `2d ago`, `in 4h`), exposed via `inject_globals`,
    rendered inline under the existing time cell on `/schedule`.
  - Sanity 163/0/0 on commit.

**Commit 1b — `.topbar-count-badge` on Queue. ✅ SHIPPED (`455ffb7`)**
  - Single badge on the **Queue** nav item showing pending-for-role
    count. Landed as a new `topbar_badges` crawler strategy wired
    into the `sanity` wave (4 PASS) rather than a `visibility`
    extension — cleaner separation.

**Commit 2 — `.empty-state` warmth on the big tables. ✅ SHIPPED (`db7bc19`)**
  - Audited + converted stragglers to the shared `empty_state(...)`
    macro from `_page_macros.html`. Landed as a new `empty_states`
    crawler strategy in the `sanity` wave (3 PASS).

**Commit 3 — keyboard shortcut `n` + `?` help. ✅ SHIPPED (`bcd3990`, tags `v1.4.1`)**
  - `static/keybinds.js` (34 lines) loaded via `<script defer>` in
    `base.html:328`. `n` → `/requests/new`, `?` → toggle
    `#keybindHelp` overlay, `Esc` → close overlay. No-op when any
    input / textarea / select / contenteditable is focused, and
    when any modifier key is held.
  - Philosophy crawler rule 8 (`crawlers/strategies/philosophy_propagation.py:141-164`)
    locks the ≤40-line budget: bumps `keybinds_too_long` / `keybinds_missing` /
    `keybinds_not_linked` on drift.

**Status: all three W1.4.1 commits shipped. `v1.4.1` tagged.**

## Track C — the release gate (split into ops-free + ops-dependent)

The former W1.4.3 bundled five tasks under a "½ day" estimate.
Four of those tasks have zero ops dependency and ship to the
laptop bare immediately. Only the portfolio button + final tag
need to wait for the Tailscale unblock. Splitting the wave means
~85% of the release gate lands before the ops click, and the
remaining ~15% collapses to ~10 minutes after.

The v1.4.2 hotfix-buffer slot is dropped — if a hotfix is needed
between tags, cut `v1.3.0-stable-release` → a throwaway branch.
Reserving a version number for a hypothetical fix that may never
ship is cognitive overhead.

### W1.4.2a — release prep, ops-free (~90 minutes, ships now) ✅ SHIPPED

*Shipped as three commits in a single session, in parallel with
the W1.4.1 polish batch:*

1. **`CHANGELOG.md`** — `61c45b9` filled the [Unreleased] block
   with every shipped-since-v1.3.8 wave (grouped Added/Changed/
   Deferred per Keep-a-Changelog) and added a new [1.3.8]
   section for the launchd shipment. Older per-version sections
   (v1.3.1–v1.3.7) deferred to a later archaeology pass.
2. **`README.md` quickstart** — `741742b` added a tight
   five-line quickstart block (clone → cd → venv → pip install
   → start.sh) followed by the demo-mode URL + seeded creds.
3. **Pre-push hook on the laptop bare** — `424bf9c` landed
   `ops/git-hooks/pre-receive` + `ops/git-hooks/install.sh` in
   the working tree for reproducibility, and the hook is
   installed at `~/.claude/git-server/lab-scheduler.git/hooks/pre-receive`
   on the laptop (verified: ran during the `v1.4.1` tag push and
   reported "sanity green — push accepted" on the remote side).
   Two-tier safety is now live: working-copy `scripts/smoke_test.py`
   before commit, central-bare sanity wave on every push.

No new crawlers. Sanity stays under 17 s across 7 strategies.

### W1.4.3 — dev_panel + instrument polish (retro, untagged) ✅ SHIPPED

*Not in the original optimized plan — landed as three bundled
commits in a single focus session on top of `v1.4.1`, before
`v1.4.2` tagged. Captured here so the history reconciles with
`git log`.*

1. **`e3157c1` W1.4.3 c1 — inline intake-mode toggle** on
   `templates/instrument_detail.html`. Two-tap safety (arm →
   confirm) for toggling an instrument between "accepting" /
   "hold" / "maintenance" without leaving the detail page.
   New `static/intake-toggle.js`, wired into `base.html` via
   `<script defer>`.
2. **`597640a` W1.4.3 c2 — "Now Shipping" hero tile** on
   `/admin/dev_panel`. Four-cell dashboard (current release,
   hot wave, today's commits, last crawler run) answering
   "what's the state of the project right now" in 5 seconds.
3. **`94849ae` W1.4.3 c3 — `dev_panel_readability` crawler**
   strategy that asserts the hero tile, the hot-wave callout,
   and the reports-freshness widget render on `/admin/dev_panel`.
   Wired into the `sanity` wave (8th strategy) and caught one
   real hook-vs-local drift in `6baca66` the same day (git subprocess
   inheriting `GIT_*` env from the pre-receive hook process).

No new tag. The line remains `v1.4.1` → `HEAD` on
`v1.3.0-stable-release` until W1.4.2b ships.

### W1.4.2b — demo goes live (~10 minutes, post-ops)

*Only starts after W1.3.9 has tagged and the HTTPS tailnet URL
is confirmed green via `deploy_smoke`.*

1. **Portfolio button on `nvishvajeet.github.io`** — single
   `<a>` pointing at the HTTPS tailnet URL with "demo creds
   inside, requires tailnet access" microcopy. One-commit change
   on that repo. (~5 min)
2. **`v1.4.2` tag** on `v1.3.0-stable-release`. First tag of
   the v1.4.x line. Demo is live. (~1 min)

## Deferred — dev mode overlay

_Parked 2026-04-11. Ships when the main product is stable and we_
_have appetite for a dev-only surface. Not on the v1.4.x critical_
_path._

### What exists today (preserved, not loaded)

* `static/grid-overlay.js` (~697 lines) — full grid/feedback
  overlay. Classes every visible element with a zone code
  (H/N/S/M/F/B/C/E/T/P/R/K/L/D), paints badges, intercepts
  clicks for logging, captures JS errors passively, records
  named "paths" of click sequences, exports JSON/plain-text
  dumps, and auto-flushes to `/prism/save` via `sendBeacon`.
  Public surface: `window.prism.{on,off,codes,at,tap,path.*,dump,clear,find}`.
* Flask endpoints in `app.py` (≈L8193): `/prism/save`,
  `/prism/log`, `/prism/clear`, persisting to `prism_log.json`.
* `templates/dev_panel.html` — separate "Development Console"
  page (wave/commit dashboard). Unrelated to the overlay and
  stays live for super-admin/owner.

### Why it was unhooked

The script tag in `templates/base.html` loaded
`grid-overlay.js` unconditionally for **every user on every
page**, adding a floating button to the main site. No role
gate, no debug gate, no CSS shipped for its classes. Removed
from `base.html` on 2026-04-11; file and routes preserved.

### Wave sketch for revival (no commits, no schema, no role bump)

1. **Gate the script load** in `base.html` behind a single
   context flag `debug_mode_active`, set by an `inject_globals`
   context processor to `True` **iff** all three hold:
   * env var `PRISM_DEBUG_OVERLAY=1` (laptop only; mini leaves
     it unset → dead in prod)
   * `session.get("debug_mode") is True`
   * `current_user.role in ("super_admin", "owner")` — reuses
     existing roles, **no 10th role** (hard-attribute lock per
     `WORKFLOW.md` §3.2 stays intact)
2. **Session toggle:** one new POST route
   `/dev_panel/debug-toggle` (super_admin/owner only) that
   flips `session["debug_mode"]`. Add the toggle button to the
   existing `/dev_panel` page as a new tile.
3. **Ship the missing CSS.** The overlay references
   `.prism-grid-btn`, `.prism-grid-badge`, `.prism-grid-outline`,
   `.prism-pane-id-badge`, `.prism-fb-*` — zero rules exist in
   `static/styles.css`. Add a self-contained `dev-overlay.css`
   loaded in the same `{% if debug_mode_active %}` block so it
   never pollutes the main site's CSS surface.
4. **Demo-mode entry point.** Same `/dev_panel` page gains a
   button that runs the existing demo reset flow (TBD: confirm
   which script under `scripts/` is the canonical entry — likely
   a `reset_demo.*` or an `init_db` variant with `DEMO_MODE=1`).
5. **Crawler:** new `dev_overlay` strategy under `crawlers/
   strategies/` that logs in as super_admin, flips the toggle,
   asserts the overlay button renders on `/`, flips it off,
   asserts it disappears. Lives in the `behavioral` wave only —
   never in `sanity`, never in prod.
6. **Docs:** one paragraph in `docs/PROJECT.md` under "Security
   model" documenting the three-fold gate, and an `### Added`
   CHANGELOG entry. No BREAKING marker because no hard attribute
   moves.

### Acceptance criteria

* With `PRISM_DEBUG_OVERLAY` unset, the overlay is unreachable
  for every role on every page — `view-source:` must not
  contain the `<script src="grid-overlay.js">` tag.
* With `PRISM_DEBUG_OVERLAY=1` and `session["debug_mode"]=False`,
  still unreachable.
* With both flipped on and role = super_admin/owner, `window.prism`
  is defined and the button renders.
* Sanity wave stays green end-to-end in all three states.

## Deferred to v1.5.x (schema waves)

Both waves below touch foundational tables and are out of scope
for v1.4.x. They ship after v1.4.2 is in the wild for a week.

* **W1.5.0 — multi-role users.** `user_roles(user_id, role)`
  junction, `primary_role()` helper, `has_role()` replaces every
  `user["role"] ==` comparison. New `multi_role` crawler.
* **W1.5.1 — instrument groups.** `instrument_group` +
  `instrument_group_member`. "By Group" assignment matrix in user
  detail. Migration seeds Electron-Microscopy / Spectroscopy
  groups from existing `instruments.category`. New
  `group_visibility` crawler. Depends on W1.5.0.

## New crawlers added by this plan

| new strategy       | wave(s)               | budget | gates on                        |
|--------------------|-----------------------|--------|---------------------------------|
| `deploy_smoke`     | `sanity` (opt-in)     | 3s     | `PRISM_DEPLOY_URL` → 200 + cert ✅ |
| `multi_role`       | `behavioral`, `all`   | 5s     | both role paths work per user   |
| `group_visibility` | `behavioral`, `all`   | 5s     | grant/revoke propagate cleanly  |

`approver_pools` (shipped `70f3cbc`) stays in `lifecycle` + `all`.
`deploy_smoke` shipped in `f6e7507` and is wired into the `sanity`
wave already.

## Time budget summary

| wave    | track | est.        | blocks               | tag       | status |
|---------|-------|-------------|----------------------|-----------|--------|
| W1.3.7  | A     | 30 min      | —                    | —         | ✅     |
| W1.3.8  | A     | 1-2 h       | W1.3.7               | v1.3.8    | ✅     |
| W1.3.9  | A     | 15 min ops  | W1.3.8 + ops unblock | v1.3.9    | ops-blocked |
| W1.4.1  | B     | 2 h         | —                    | v1.4.1    | ✅     |
| W1.4.2a | C     | 90 min      | —                    | —         | ✅     |
| W1.4.3  | B     | ~2 h retro  | —                    | —         | ✅     |
| W1.4.2b | C     | 10 min      | W1.3.9 + W1.4.2a     | v1.4.2    | ops-blocked |
| W1.5.0  | v1.5  | 1-2 d       | v1.4.2               | v1.5.0    | deferred |
| W1.5.1  | v1.5  | 1-2 d       | v1.5.0               | v1.5.1    | deferred |

**All laptop-local critical-path work is done.** The v1.4.1 tag
is live; W1.4.2a shipped three commits; W1.4.3 shipped three more
as Jony-Ive polish on top. Grid-overlay was unhooked from the main
site on 2026-04-11 (`02cb7ce`) and parked for future dev-mode work.

**Ops dependency:** one click at
https://login.tailscale.com/f/serve . After that click, the
W1.3.9 + W1.4.2b combo is ~25 minutes from click to live URL:
run `scripts/tailscale_serve.sh`, flip `.env`, `launchctl kickstart`,
`deploy_smoke` from the laptop, then the portfolio button commit
on `nvishvajeet.github.io` and the `v1.4.2` tag. That is the only
remaining critical-path work to demo-live.

## Ship-today candidates (fresh)

Laptop-local work that can land without any ops dependency or
external unblock:

1. **Dev-mode overlay revival** (parked by explicit request
   2026-04-11). See the "Deferred — dev mode overlay" section
   below. Scope: six steps, no schema, no role bump. Sized for
   one focused session. **Gated on explicit user approval to
   un-park.**
2. **Sample-page (`new_request.html`) layout pass** —
   `.new-request-layout` currently splits 1.55fr : 0.85fr with
   the right column holding only a 5-row instrument summary
   card, wasting ~36% of the page below that card as empty
   space. Either promote the instrument summary to a full-width
   header card and let the form span the full page (mirroring
   the `inst-header` → `inst-tiles` pattern from
   `instrument_detail.html`), or fill the sidebar with something
   useful. ~1 h, no schema, no crawler. See "UI uniformity
   audit" proposal below for whether this should ship as a
   one-off or as part of a broader per-role audit wave.
3. **UI uniformity audit wave (proposal, unscoped)** — a new
   `ui_uniformity` crawler that logs in as every role, visits
   the ~8 canonical pages (`/`, `/instruments`,
   `/instruments/<id>`, `/schedule`, `/requests/new`,
   `/requests/<id>`, `/stats`, `/sitemap`), and asserts that
   every page wrapper is `<main class="page">`, every hero is a
   `.inst-header`-shaped header, every content region is a
   `.tile`-family grid, and every form uses the shared
   `.form-grid` macro. Goal: reject new pages that invent their
   own layout. Size and whether it belongs in `sanity` or
   `behavioral` is TBD — not a self-executable task until the
   scope is locked.

W1.3.9 + W1.4.2b are deliberately **not** on this list because
they are ops-gated, not laptop-local.

## Guardrails (unchanged from `ROADMAP.md`)

* Every wave stays under 30 seconds end-to-end on the MacBook.
* Every patch lands a crawler proof in the commit message body.
* Every new tile carries `data-vis="{{ V }}"` + a `.tile-*` class.
* Push to `origin` (the laptop bare) after each commit. The bare
  mirrors to the mini. No pushes to GLOBAL remotes without
  explicit operator approval per `~/.claude/CLAUDE.md`.
