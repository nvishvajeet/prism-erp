# OPERATION TROIS AGENTS

> Three agents, three machines, 90 minutes. Coordinated sprint
> on the CATALYST ERP stack. This file is the single source of
> truth. If you are Claude 1 or Codex 0, read this end to end
> before doing anything else. Do not read the other agents'
> chat logs — everything you need is here.

---

## Roster

| Tag | Agent | Machine | Role |
|---|---|---|---|
| `Claude 0` | Claude (owner's primary session) | MacBook Pro (Vishvajeet's editor) | Lane 1 — Chooser + Ravikiran silo + playbook + merge captain + weaving check |
| `Claude 1` | Claude (fresh session) | iMac (dev pool, full sudo) | Lane 2 — UI / forms / wrap audit |
| `Codex 0` | Codex | MacBook Pro (local) | Lane 3 — Gatekeeping / role-guard audit |

The Mac mini is the deploy target for production (currently hosts
Lab-ERP on port 5055 + demo on 5056 + Ravikiran on 5057). **The
mini is READ-ONLY this sprint.** No live restarts, no config
reloads, no launchctl reloads.

## Machines and their jobs this sprint

- **MacBook Pro (Vishvajeet's)** — Claude 0 + Codex 0 work here.
  Editor throttled 50% when user is active; both agents tolerate
  that. Working copies: `~/Documents/Scheduler/Main/` and
  `~/Claude/ravikiran-erp/`.
- **iMac (dev pool)** — Claude 1 works here. Full sudo. iMac has
  its own clone of the lab-scheduler repo. **Claude 1 MUST pull
  from the LOCAL bare (`~/.claude/git-server/lab-scheduler.git`
  on MacBook, reachable over the LAN) at T+0, and push back to
  the same bare on commit.** Do not push to mini, do not push to
  GitHub.
- **Mac mini** — production. Leave alone. The named Cloudflare
  tunnel is running; do not touch it. Probing `http://localhost:
  {5055,5056,5057}` via SSH for read-only verification is fine.

## Timeline — 90 minutes total

```
T+0 ──────────────────── T+55 ─── T+60 ──────────────── T+90
│                         │       │                      │
│   PHASE 1 — BUILD       │ MERGE │   PHASE 3 — CRAWL    │ PHASE 4
│   all three agents      │       │   verification       │ WEAVING
│   in parallel           │       │   all three agents   │ CHECK
│                         │       │                      │ (Claude 0)
└─────────────────────────┴───────┴──────────────────────┴────────
```

- **T+0 → T+55: Phase 1 — build.** Three lanes in parallel.
- **T+55 → T+60: Phase 2 — merge.** Claude 0 pulls everyone's
  work, applies the base-template / nav gates per Codex 0's
  handoff, resolves conflicts, pushes to both LOCAL bares.
- **T+60 → T+90: Phase 3 — verification crawl.** Deep testing.
  All three agents crawl in parallel (different lanes — details
  below). The goal is to find whatever just broke.
- **T+90: Phase 4 — weaving check.** Claude 0 verifies that
  everything the three lanes produced is woven correctly:
  navigation shows/hides the right options, forms save, view
  panes wrap, gatekeeping actually gates, nothing Cl2 did
  collides with what Codex 0 did, nothing in Ravikiran mentions
  Lab, nothing in Lab mentions Ravikiran, chooser works, and
  the audit docs round-trip.

## START HERE if you're joining now (Claude 1 / Codex 0)

> Claude 0 is the conductor for this sprint. Read this entire
> doc once, then drop into your lane. Claude 0 issues all direction
> via `STATUS:` commits on this branch — check them before picking
> up a task and whenever you finish one.

### Read the sprint history (30 seconds)

```bash
# from your working copy, on operation-trois-agents branch:
git fetch origin operation-trois-agents
git log origin/operation-trois-agents --grep '^STATUS:' --oneline -40
```

The most recent STATUS commits tell you:
- Where in the timeline we are (T+NN)
- What each agent just shipped
- Your current assignment (look for commits addressed to you)

### Post your own progress

Every ~15 min, or whenever you finish a chunk:

```bash
git commit --allow-empty -m "STATUS: T+NN <your-tag> — <past-tense summary>"
git push origin operation-trois-agents
```

Your tag is `Claude1` or `Codex0` (no spaces, no hyphens).

### Current timeline (extended 2026-04-15 T+32)

```
T+0 ─── T+15 ──────────────────────── T+120 ── T+125 ────── T+140 ────── T+150
│WARMUP│    PHASE 1 · BUILD            │ MERGE+ │  PHASE 3  │  PHASE 4  │
│ 15m  │    105 min (extended)         │ SMOKE  │  CRAWL    │ WEAVE+TAG │
│      │    evidence-driven            │  5 min │  15 min   │  10 min   │
└──────┴───────────────────────────────┴────────┴───────────┴───────────┘
  CL0/1/CO       CL0/1/CO                  CL0   CL0/1/CO     CL0 alone
```

The owner extended the build window by one hour at T+32 — Phase 1
now runs until T+120. Match that cadence; no need to race.

### Active lanes (current state)

- **Claude 0 (MacBook)** — Lane 1 (chooser + Ravikiran silo +
  playbook + configs) + Lane 4 (attendance-by-number) +
  merge captain + weaving.
- **Claude 1 (iMac)** — Lane 2 extended: Ravikiran UI audit
  first (it's where Tejveer tests), then back-fill Lab-ERP P1/P2,
  then responsive polish. See the §"Lane 2 — Claude 1" block
  below for the hard rules; Claude 0's latest STATUS commit
  addressed to Claude1 has the priority order.
- **Codex 0 (MacBook)** — Lane 3 extended: time-logging feature
  (user_work_sessions + heartbeat + /admin/users/<id>/hours +
  heartbeat.js) after the gatekeeping audit. See Claude 0's
  latest STATUS commit addressed to Codex0 for the full spec.

### Hard rules — the short version

1. **Only edit files listed in your lane.**
2. **Smoke gate before every push:** `.venv/bin/python scripts/smoke_test.py`.
3. **No touching** `templates/base.html`, `templates/nav.html`,
   `static/css/global.css`, or `~/.cloudflared/*` on mini.
4. **Commit small, push often.** Max 250 changed lines per commit.
5. **Don't read other agents' chat transcripts.** All coordination
   is in this file + `STATUS:` commits.
6. **Blocker?** Push `STATUS: T+NN <agent> — BLOCKER: <what>` and
   drop out. Claude 0 picks it up at T+120.

## T+15 PIVOT — read this BEFORE continuing past T+15

The first 15 minutes are **Warmup** — inventory and orientation
only. At T+15 each agent:

1. Commits whatever inventory / setup work is done, with a
   commit message starting `warmup:`.
2. Pushes to `origin/operation-trois-agents`.
3. Writes a status commit: `STATUS: T+15 <agent> — warmup done, N items logged`.
4. Re-reads this §"T+15 PIVOT" section top to bottom.
5. Proceeds to **Phase 1 — Apply-Fixes** (below).

Nobody applies fixes before T+15. During Warmup, do not change
`app.py`, `templates/`, or `static/css/`. Only audit docs and
the chooser directory scaffolding get writes. This gives Phase 1
a clean, evidence-based fix list.

### Revised phase timeline

```
T+0 ─── T+15 ────────────────── T+60 ──── T+65 ───── T+80 ──── T+90
│WARMUP│    PHASE 1 · APPLY     │ MERGE + │  PHASE 3  │ PHASE 4 │
│      │     FIXES (45 min)     │ SMOKE   │  CRAWL    │ WEAVE   │
│15min │     evidence-driven    │  5 min  │  15 min   │ + TAG   │
│      │                        │         │           │ 10 min  │
└──────┴────────────────────────┴─────────┴───────────┴─────────┘
 CL0/1/CO     CL0/1/CO             CL0     CL0/1/CO     CL0 alone
```

**Total = 90 minutes.** Build-to-verify ratio is 45 : 35 — more
time coding than inventorying.

### Warmup deliverables (T+0 → T+15) — no code changes

| Agent | Deliver at T+15 |
|---|---|
| Claude 0 | `chooser/` skeleton (Flask stub, no styling); `docs/ERP_TENANT_ONBOARDING.md` outline; grep list of MITWPU/lab strings in `ravikiran-erp/` committed as an appendix |
| Claude 1 | `docs/UI_AUDIT_2026_04_15.md` inventory table: every `<form method=post>` with path, line, has-save-button, label-complete; every view pane with `overflow:hidden`/fixed-height; three priority buckets — P0 blocks-Tejveer, P1 visible-breakage, P2 nice-to-have |
| Codex 0 | `docs/GATEKEEPING_AUDIT_2026_04_15.md` — route table: path, methods, decorators, endpoint fn; "Template gates to apply" handoff table; "Ravikiran parallel findings" section. **Inventory only, no code changes yet.** |

### Phase 1 — Apply Fixes (T+15 → T+60), 45 minutes

Now change code. Work from each agent's own warmup inventory.

**Claude 0 (MacBook):**
- Finish chooser app (styling + launchd plist staged).
- Ravikiran `real_team` seed port (idempotent block from
  `lab-scheduler/app.py:7706–7783` → `ravikiran-erp/app.py seed_data()`).
- Ravikiran branding scrub (use warmup grep list).
- Cloudflare ingress staging → `docs/cloudflared_config_pending.yml`.
- Ravikiran launchd plist staged at `chooser/launchd/local.catalyst.ravikiran.plist`.
- If HEADROOM yes from all three at T+6 → attendance-by-number
  (sequential `short_code` populated + quick-mark page).

**Claude 1 (iMac):**
- Work through P0 and P1 from `UI_AUDIT_*.md`.
- For each P0: add save button, fix clipped fields, wrap
  overflowing view panes. Commit in chunks of ≤5 templates
  per commit (keeps each commit under the 250-line rule).
- P2s skipped unless time permits after P0+P1 are done.
- No touching `base.html` / `nav.html` / `global.css`.
- No app.py edits. If a template needs a context var that
  doesn't exist, write it into a "Handoff to Codex 0" section
  in `UI_AUDIT_*.md` — don't add the var yourself.

**Codex 0 (MacBook):**
- Add `@login_required` + role decorators to every route
  flagged in the warmup inventory.
- Add the `@app.context_processor` exposing the boolean flags
  (`can_edit_user`, `can_approve_finance`,
  `can_manage_instruments`, `can_view_debug`, `can_invite`, …).
- Resolve Claude 1's "Handoff to Codex 0" items (add new
  context vars they asked for).
- No template edits. No new routes. No schema changes.
- **Stretch if done early:** mobile-debug stub — add
  `@app.route("/debug", methods=["GET"])` returning a minimal
  HTML body. Claude 1 owns the proper template if time permits
  in their own stretch slot.

### Phase 2 — Merge + smoke (T+60 → T+65), 5 minutes, Claude 0

Git pull, apply Codex's nav gates to `base.html`+`nav.html` as a
single commit, run smoke gate, local `/health` probe, push.

### Phase 3 — Crawl (T+65 → T+80), 15 minutes

Three lanes and isolated test accounts as scripted above. Output
as planned. Rsync crawl outputs to `jack.local` at T+78.

### Phase 4 — Weave + tag (T+80 → T+90), 10 minutes, Claude 0

Same 6-check weaving. `docs/OPERATION_TROIS_AGENTS_RESULT.md` as
executive summary. `v2.0.0-rc1` tag if all 6 checks pass.

### Stretch items

Only start one if you finish Phase 1 **≥ 5 min early** (i.e.
before T+55):

1. Mobile-debug body — Claude 1, if UI P0+P1 done.
2. `user_work_sessions` schema + heartbeat — Codex 0, if
   gatekeeping done.
3. `CHANGELOG.md` v2.0.0-rc1 entry — Claude 0.

No stretch work may bleed past T+58 (2 min before Phase 2 merge).

## North-star

> "Whatever after 1.5 hours of 3 machines we should be able to
> ship v2.0 no pending ships and issues no pending technologies."
> — Vishvajeet, 2026-04-15.

At T+90, we want the v2.0 tag ready to cut on master the moment
`cert.pem` is live. No pending ship items for today. No
unresolved UI/gatekeeping issue blocking Tejveer's manual test.
All three audit docs written. Green weaving report.

Full session log of the asks leading to this sprint:
`~/tmp/operation_trois_agents/DEBUG_LOG.md`. Read it if you want
the backstory; otherwise skip to your lane.

## New-feature candidate (Lane 4 decision at T+5)

Nikita asked: "instead of letters it is better people have
numbers so they can just tell their number and mark their
attendance quickly." Users get a short numeric code (1, 2, 3,
…); attendance mark is a fast type-the-number interaction.
Schema already has an unused `short_code` column on `users`.

**Headroom protocol.** At T+5 each agent pushes one status
commit: either

    STATUS: T+05 <agent> — HEADROOM yes

or

    STATUS: T+05 <agent> — HEADROOM no

Claude 0 tallies at T+06. **Three yes → Lane 4 activated**
(Claude 0 owns Lane 4 on top of Lane 1). Otherwise the feature
defers to the next sprint.

**If adopted as Lane 4 (Claude 0):**
- Populate `short_code` for every existing user in both Lab-ERP
  and Ravikiran DBs (sequential integers, per-ERP).
- Add `GET/POST /attendance/quick` — type-the-number form →
  fetches `SELECT name FROM users WHERE short_code=?` → Mark
  Present button → writes to existing attendance table.
- Show the user's own number prominently on their profile page.
- Nav link visible to: `operator`, `site_admin`, `super_admin`.
  (Codex 0 includes this role gate in the gatekeeping audit doc.)

## Mission

Backend is strong. UI and gatekeeping are shipping with holes
— Tejveer's manual testing is blocked by forms missing save
buttons, fields cut off, view panes overflowing, and role-gated
options rendering when they shouldn't. Three lanes attack that
in parallel, then we crawl everything to surface anything we
missed.

**Deferred (NOT in this sprint, on the main backlog):** mobile
debug tool (eruda + `/debug` page), time-logging feature
(`user_work_sessions` + heartbeat + hours view), audit SEV2
items (login rate-limit, DB rename, `--erp` flag enforcement).
Schedule a separate sprint for those after `cert.pem` is on
mini and the subdomains (`mitwpu-rnd.`, `ravikiran.`,
`playground.catalysterp.org`) are live.

## Constants — every agent must respect these

| Thing | Value |
|---|---|
| Lab-ERP repo (MacBook) | `~/Documents/Scheduler/Main/` · LOCAL bare = `~/.claude/git-server/lab-scheduler.git` on MacBook |
| Ravikiran-ERP repo (MacBook) | `~/Claude/ravikiran-erp/` · LOCAL bare = `~/.claude/git-server/ravikiran-erp.git` on MacBook |
| MacBook hostname on LAN | `jack.local` (IP `192.168.1.168`) — for iMac clone, see Lane 2 bootstrap |
| Sprint branch | **`operation-trois-agents`** — forked at T+0 off `feature/insights-module`. All three agents commit to this branch only. Claude 0 merges back at or after T+90. |
| Branch freeze for this hour | No edits to `master`, `feature/insights-module`, `v1.3.0-stable-release`, `v2.0.0-alpha`, `v2.0.0-beta` by any agent. All work lands on `operation-trois-agents`. |
| Commit format | `<lane>: <imperative subject ≤70c>` — e.g. `ui-audit: add Save button to invoice form`. Max 250 changed lines per commit; split bigger work. |
| Pre-commit gate (mandatory) | `.venv/bin/python scripts/smoke_test.py` — ~5s, blocks the push otherwise (pre-receive hook enforces). Every commit on the sprint branch runs this. |
| Shared timeline | Git empty-commits tagged `STATUS:` are the canonical timeline. Each agent runs `git commit --allow-empty -m "STATUS: T+NN <agent> — <summary>"` + pushes. `git log --grep '^STATUS:' --oneline` gives the shared log. |
| Local status convenience copy | `~/tmp/operation_trois_agents/STATUS.md` on each agent's own machine — not synced; the git log is truth. |
| Shared artifacts | Crawl outputs rsync to `jack.local:~/tmp/operation_trois_agents/crawl_outputs/` at T+88 — see Phase 3 rsync command. |
| Time base (T+0) | Absolute UTC epoch written in the first `STATUS: T+00` commit by Claude 0. All agents compute T+NN as `now_utc - t0_epoch` in minutes. |

## Hard bans (all agents)

1. No SSH changes on mini. No `launchctl` reloads. No
   `cloudflared` config edits.
2. No `git push` to anything except `origin` (the LOCAL bare).
   No pushes to mini, GitHub, or anywhere else.
3. No touching the `~/.cloudflared/cert.pem` flow — that's the
   owner's job; it blocks DNS for the subdomains but is not
   this sprint's problem.
4. No edits to `templates/base.html` or `templates/nav.html`.
   Claude 0 owns those at T+55 for nav-visibility gates.
5. No edits to `static/css/global.css`. Add a new stylesheet file
   if you need CSS.
6. No `app.py` edits outside the ranges assigned to your lane.
7. Do not read `/private/tmp/claude-501/.../tasks/*.output` — that
   is another agent's transcript and will overflow your context.
8. Do not run any command that writes to the mini DBs. All probes
   are read-only.

---

## PHASE 1 — BUILD (T+0 → T+55)

### Lane 1 — Claude 0 (MacBook) — Chooser + Ravikiran silo + playbook + merge captain

**Files Claude 0 owns (nobody else touches):**

- `~/Claude/ravikiran-erp/**` — entire repo
- `~/Documents/Scheduler/Main/chooser/**` — NEW directory (tiny Flask chooser on port 5060)
- `~/Documents/Scheduler/Main/docs/ERP_TENANT_ONBOARDING.md` — NEW playbook
- `~/Documents/Scheduler/Main/docs/OPERATION_TROIS_AGENTS.md` — this file
- `~/Documents/Scheduler/Main/docs/cloudflared_config_pending.yml` — staged config (not deployed)
- `~/Library/LaunchAgents/local.catalyst.ravikiran.plist` — staged plist

**Deliverables:**

1. **Chooser app** — two tiles: MITWPU R&D → `https://mitwpu-rnd.catalysterp.org`, Personal ERP → `https://ravikiran.catalysterp.org`. Zero mention of "Ravikiran" or "Lab" brand on the chooser page. Port 5060. Launchd plist staged for deploy.
2. **Ravikiran seed port** — bring the idempotent `real_team` pattern from `lab-scheduler/app.py:7706–7783` into `ravikiran-erp/app.py seed_data()`, including the 6 humans.
3. **Ravikiran branding scrub** — remove MITWPU / FESEM / ICP-MS / XRD / lab-instrument strings from `ravikiran-erp/templates/` and `seed_data`. Household vocabulary instead.
4. **`ERP_TENANT_ONBOARDING.md`** — playbook for future tenant rollouts, using today's Ravikiran onboarding as the worked example.
5. **Cloudflare config staging** — ingress rules for the four hostnames. Also stage the Ravikiran launchd plist so Ravikiran survives mini reboot (audit SEV2 #3).

### Lane 2 — Claude 1 (iMac) — UI / forms / wrap audit

**Files Claude 1 owns (nobody else touches):**

- `~/Documents/Scheduler/Main/templates/**/*.html` on iMac working copy — except `base.html` and `nav.html`
- `~/Documents/Scheduler/Main/static/css/ui_audit_2026_04_15.css` — NEW (do not modify existing stylesheets)
- `~/Documents/Scheduler/Main/docs/UI_AUDIT_2026_04_15.md` — NEW inventory
- **Do not touch `app.py`.**
- **Do not touch `ravikiran-erp/`.**

**Bootstrap (at T+0 on iMac):**

```bash
# On the iMac, clone Lab-ERP from the MacBook's LOCAL bare.
mkdir -p ~/Claude && cd ~/Claude
git clone ssh://vishvajeetn@jack.local/Users/vishvajeetn/.claude/git-server/lab-scheduler.git lab-scheduler-imac
cd lab-scheduler-imac
git fetch origin operation-trois-agents
git checkout operation-trois-agents
# Create Python env + verify smoke gate works before any commit.
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python scripts/smoke_test.py   # MUST pass before first commit
```

On commit, push back to the same remote.

**The failing symptoms (per owner, 2026-04-15 verbatim):**

- "Big Big UI audit — forms need save buttons"
- "All fields in forms need to be seen"
- "View panes should have wrap if they are showing data entry items currently they are overflowing"
- "Gatekeeping and showing options that is not happened properly"
  (the last one overlaps Codex 0's lane; Claude 1 documents,
  Codex 0 enforces server-side, Claude 0 stitches nav.)

**Deliverables:**

1. **Form inventory.** Grep every `<form ... method="post"` in
   `templates/**/*.html`. For each, verify: (a) visible submit
   button with text Save/Submit/Update/Create; (b) every `<input>`,
   `<select>`, `<textarea>` has a `<label>`; (c) the button is
   outside any hidden/collapsed container. Write the inventory to
   `docs/UI_AUDIT_2026_04_15.md` — one row per form, path:line,
   missing-pieces.
2. **Fix missing Save buttons.** Add
   `<button type="submit" class="btn btn-primary">Save</button>`
   (or Update / Create per context) using class names already in
   that template.
3. **Fix cut-off form fields.** Identify CSS/layout rules that
   hide fields (`overflow: hidden` on fixed-height containers,
   `display:none` that doesn't reset, `max-height` on form
   sections, grid-area collisions). Add overrides to
   `ui_audit_2026_04_15.css`. Do NOT edit `global.css`.
4. **Fix view-pane overflow.** For every view pane that renders
   data-entry items and clips: `overflow: auto` on container,
   `flex-wrap: wrap` on flex rows, `word-break: break-word` on
   long-value cells.
5. **Changelog in `UI_AUDIT_2026_04_15.md`.** Row per fix:
   `templates/foo.html:42 — added Save button to create form`.
6. **Handoff to Codex 0.** Any role-gating you notice but can't
   fix without app-side context variables — write under a
   "Handoff to Codex 0" section in your audit doc.

**Acceptance:**
- Grep `grep -rE '<form [^>]*method=.post' templates/` — every
  match has a reachable submit button.
- All forms render completely at mobile (375px), tablet (768px),
  desktop (1280px).
- Status line: `T+NN Claude1 — shipped UI audit, N forms fixed, M panes wrapped`.

**What Claude 1 does NOT do:** no new features, no `app.py` edits,
no `base.html`/`nav.html` edits, no role-guard `{% if %}` work
(Codex 0's territory).

### Lane 3 — Codex 0 (MacBook) — Gatekeeping / role-guard audit

**Files Codex 0 owns (nobody else touches):**

- `~/Documents/Scheduler/Main/app.py` — **role decorators and context-injection edits only.** No route body logic changes beyond adding decorators and passing new context variables.
- `~/Documents/Scheduler/Main/docs/GATEKEEPING_AUDIT_2026_04_15.md` — NEW inventory
- **Do not touch templates.** Templates are Claude 1's.
- **Do not touch `ravikiran-erp/`.**

**The failing symptoms:**

1. Options render for roles that shouldn't see them (tester sees
   Edit buttons that no-op on click).
2. Some routes lack server-side role enforcement (audit flagged
   `tester` reading finance + professor stages at read level).
3. Not every protected view has a matching
   `@login_required + role check` pair.

**Deliverables:**

1. **Route inventory.** For every `@app.route(...)` in `app.py`,
   record: path, methods, decorators, endpoint function. Output
   as a sorted table in `GATEKEEPING_AUDIT_2026_04_15.md`. Flag:
   - No `@login_required` and not clearly public
     (`/`, `/login`, `/logout`, `/health`, `/static/*`).
   - No role gate where implied by path
     (`/admin/*`, `/finance/*`, `/super_admin/*`).
   - Mutating methods without an in-body role check.
2. **Permission `@app.context_processor`.** Single processor that
   exposes boolean flags every template needs:
   `can_edit_user`, `can_approve_finance`, `can_manage_instruments`,
   `can_view_debug`, `can_invite`, etc. Derive from
   `current_user.role`.
3. **Add missing decorators** to flagged routes. Use existing
   decorators in `app.py`; if you invent one, document it.
4. **Handoff section** in your audit doc titled "Template gates
   to apply" — for each nav item / form / button / link that
   should hide per role: template path, line number, the
   `{% if can_* %}` guard to wrap it with. Claude 0 applies
   nav-related gates at T+55; Claude 1 does not apply these
   (her Save-button work takes priority).

**Acceptance:**
- Every admin/finance/owner route has a server-side role gate.
- `GATEKEEPING_AUDIT_2026_04_15.md` contains full route inventory
  + handoff list.
- `context_processor` exposes the boolean flags.
- Status line: `T+NN Codex0 — shipped gatekeeping audit, N routes gated, M context flags added`.

**What Codex 0 does NOT do:** no template edits, no `ravikiran-erp/`,
no new features, no new routes, no schema changes, no audit-SEV2
fixes (separate sprint).

### File-conflict map — Phase 1

| File / dir | Claude 0 | Claude 1 | Codex 0 |
|---|---|---|---|
| `chooser/**` | ✓ own | — | — |
| `ravikiran-erp/**` | ✓ own | — | — |
| `templates/base.html`, `templates/nav.html` | ✓ own (merge at T+55) | — | — |
| `templates/**/*.html` (other) | — | ✓ own | — (document only) |
| `static/css/global.css` | **BANNED (no one)** | **BANNED** | **BANNED** |
| `static/css/ui_audit_2026_04_15.css` | — | ✓ own (NEW) | — |
| `app.py` (Lab-ERP) | — | — | ✓ own (decorators + context only) |
| `docs/ERP_TENANT_ONBOARDING.md` | ✓ own (NEW) | — | — |
| `docs/UI_AUDIT_2026_04_15.md` | — | ✓ own (NEW) | — |
| `docs/GATEKEEPING_AUDIT_2026_04_15.md` | — | — | ✓ own (NEW) |

Templates, CSS, app.py, docs — all partitioned. Only three-way
touch risk is `app.py` (Lab-ERP) and only Codex 0 is allowed to
edit it this sprint.

---

## PHASE 2 — MERGE + SMOKE (T+55 → T+60) — Claude 0

1. `git fetch origin && git pull origin operation-trois-agents` on
   both Lab-ERP and Ravikiran-ERP working copies.
2. Read `docs/GATEKEEPING_AUDIT_2026_04_15.md` §"Template gates to apply".
3. Apply nav/base gates to `templates/base.html` +
   `templates/nav.html` as one commit with the `merge:` prefix.
4. Resolve any `app.py` conflicts (should be none — only Codex 0
   edits app.py this sprint).
5. **Smoke gate:** `.venv/bin/python scripts/smoke_test.py`. If
   red, `git revert HEAD`, investigate, re-apply smaller chunks
   until green.
6. **Local health probe:** start the app on a throwaway port and
   `curl -fsS localhost:<port>/health` — must return 200.
7. Push to `origin` on both repos.
8. `STATUS: T+60 Claude0 — merged + smoked + pushed; entering crawl phase`.

---

## PHASE 3 — VERIFICATION CRAWL (T+60 → T+75) — all three agents

Fifteen minutes of parallel crawling on different targets — the
goal is to surface what the build phase broke.

**Test-account isolation** — no two agents share a session:

| Agent | Uses account | DB target |
|---|---|---|
| Claude 0 | `admin` / `12345` (Ravikiran super_admin) | Ravikiran demo @ `localhost:5057` via `ssh -fN -L 15057:localhost:5057 catalyst-mini` |
| Claude 1 | `test.super_admin` / `12345` (Lab-ERP demo) | Lab-ERP demo @ `jack.local:5056` (cross-LAN direct, plus local smoke at `localhost:5056` on iMac if running demo there) |
| Codex 0 | `test.operator`, `test.requester`, … / `12345` (cycles roles) | Lab-ERP demo @ `localhost:5056` (or SSH tunnel to mini:5056 if not running locally) |

**Shared outputs:** all three write to
`~/tmp/operation_trois_agents/crawl_outputs/` on the agent's
machine, then push a compressed tarball to MacBook via
`rsync`-over-ssh for Phase 4.

### Crawl lane A — Claude 0 (MacBook) — Ravikiran-ERP + chooser

- Target: `http://localhost:5057` (Ravikiran on mini, via SSH
  tunnel from MacBook: `ssh -fN -L 15057:localhost:5057 catalyst-mini`
  then hit `localhost:15057`).
- Walk every nav entry. For each URL: HTTP status, render time,
  any 5xx, any "500 Internal", any unhandled exception in
  `logs/server.log` (readable over SSH). Verify NO "MITWPU",
  "FESEM", "ICP-MS", "XRD", "Lab" strings appear in visible text.
- Test chooser page rendering locally
  (`python chooser/app.py`, port 5060), both tiles clickable,
  link destinations correct.
- Output: `crawl_outputs/ravikiran_silo_check.md` with one row
  per URL visited + findings.

### Crawl lane B — Claude 1 (iMac) — Lab-ERP UI sweep

- Target: `http://<MINI_HOSTNAME>:5056` (Lab-ERP demo on mini, via
  LAN) AND `http://<MACBOOK_HOSTNAME>:5056` if the demo is running
  locally on MacBook.
- For each URL in the app's nav: load at mobile (375px), tablet
  (768px), desktop (1280px) using `curl -H "User-Agent: ..."`
  for quick size-agnostic checks, then `playwright` or headless
  Chrome for actual viewport renders if available on iMac.
- Verify for every `<form>`: has a submit button, all fields
  visible, fields don't overflow the pane.
- Verify for every data-entry view pane: scrollable/wrapping,
  no hidden overflow.
- Output: `crawl_outputs/ui_sweep.md` with screenshots (if
  playwright available) + findings.

### Crawl lane C — Codex 0 (MacBook) — Gatekeeping sweep

- For each role in {`tester`, `operator`, `requester`,
  `faculty_in_charge`, `instrument_admin`, `site_admin`,
  `professor_approver`, `finance_admin`, `super_admin`}:
  log in as a test user of that role on `localhost:5056`, visit
  every route that your Phase 1 inventory tagged, and verify:
  role-appropriate content is shown, role-forbidden content is
  hidden AND the server returns 403 when accessed directly.
- Use the `test.<role>` accounts that already exist in demo seed
  (password `12345`, must-change).
- Output: `crawl_outputs/gatekeeping_matrix.md` — a
  role-by-route matrix of pass/fail/403/200/other.

**Crawl ground rules:**
- Read-only. No POSTs that change state. No form submissions.
- If you must POST to test a form, use `csrf_token` + a
  deliberately-invalid payload (expect 4xx response, not a real
  write). Do not hit any route that creates, deletes, or mutates
  real data.
- If any crawl causes a 500, record the traceback from
  `logs/server.log` and keep crawling.
- At T+73 rsync your crawl outputs to MacBook:
  `rsync -az ~/tmp/operation_trois_agents/crawl_outputs/ vishvajeetn@jack.local:~/tmp/operation_trois_agents/crawl_outputs/`
- At T+75 push final status: `STATUS: T+75 <agent> — crawl done, N issues filed`.

### Codex 0 bonus — Ravikiran gatekeeping inventory (read-only)

Codex 0 does not edit `ravikiran-erp/app.py` this sprint, but DOES
inventory its routes. Add a section to
`GATEKEEPING_AUDIT_2026_04_15.md` titled "Ravikiran-ERP parallel
findings" listing: ungated routes, missing decorators, and any
`tester`-role leak analogous to Lab-ERP's. Ravikiran fixes go on
the next-sprint backlog.

---

## PHASE 4 — WEAVING CHECK + v2.0 TAG (T+75 → T+90) — Claude 0

"Weaving" = everything the three lanes produced is woven
correctly end to end:

1. **Navigation weave.** Every nav entry Codex 0 flagged as
   role-gated is actually hidden in the UI for non-qualifying
   roles. Cross-reference
   `GATEKEEPING_AUDIT_2026_04_15.md` §"Template gates" with
   `git diff base.html nav.html` from Phase 2.
2. **Form weave.** Every form Claude 1 added a save button to
   actually submits successfully. Cross-reference
   `UI_AUDIT_2026_04_15.md` with the Phase 3B crawl's
   form-submission results.
3. **Silo weave.** Ravikiran UI contains no MITWPU/Lab strings;
   Lab-ERP UI contains no Ravikiran/personal strings; chooser
   contains neither brand name. Cross-reference
   Phase 3A output.
4. **Role weave.** For every role in the Phase 3C gatekeeping
   matrix, confirm: UI hides what server rejects, UI shows what
   server permits, and the two never disagree.
5. **Chooser weave.** `http://localhost:5060` renders both tiles
   with correct links.
6. **Doc weave.** All three audit docs
   (`UI_AUDIT_...`, `GATEKEEPING_AUDIT_...`,
   `ERP_TENANT_ONBOARDING.md`) reference each other where
   relevant. No orphan references.

Claude 0 writes `docs/OPERATION_TROIS_AGENTS_RESULT.md` —
executive summary of: what shipped, what the crawl found,
what's still broken, what's deferred. One page max.

**v2.0 tag-cut** — if weaving is green (all 6 checks pass), at
T+89 Claude 0 tags the sprint branch head:

    git tag -a v2.0.0-rc1 -m "Operation TroisAgents RC1"
    git push origin v2.0.0-rc1

The tag is provenance only — NOT a merge into trunk. Trunk
merge happens in a separate review step after cert.pem deploy.

Final status commit: `STATUS: T+90 Claude0 — weaving green, v2.0.0-rc1 tagged`.

If weaving is NOT green, Claude 0 writes
`docs/OPERATION_TROIS_AGENTS_RESULT.md` with an explicit "Blocked
v2.0 ship on these N items" list and does not tag.

---

## Status file — append-only

```
~/tmp/operation_trois_agents/STATUS.md
```

Format: `T+NN <agent> — <past-tense summary>`.

```
T+00 Claude0 — opened lane, created status file, committing plan doc
T+12 Claude1 — swept /users pages, 14 forms missing Save
T+18 Codex0  — enumerated 247 routes, 31 ungated
T+55 <agent> — phase 1 done, handing off
T+60 Claude0 — merged + pushed; entering crawl phase
T+88 <agent> — crawl done, N issues filed
T+90 Claude0 — weaving check complete
```

Do not edit other agents' lines. Do not pass code via this file.
If blocked, append `BLOCKER: <what>` and drop out — Claude 0
picks up at T+55.

## What to do if you're reading this cold (Claude 1 / Codex 0)

1. Read this file end to end. Re-read your lane section twice.
2. `cat ~/tmp/operation_trois_agents/STATUS.md` to see what's landed.
3. (Claude 1 only) Clone Lab-ERP from the MacBook's LOCAL bare.
4. Append your first status line:
   `T+NN <agent> — opened lane, starting <first task>`.
5. Work on your lane only. Commit small. Push to `origin` after
   each commit.
6. If blocked, tag `BLOCKER` in the status file and drop out.
7. At T+55 write `T+55 <agent> — phase 1 done`, then start Phase 3.
8. At T+88 write `T+88 <agent> — crawl done, N issues filed`.

Good hunting.
