# CATALYST / Lab Scheduler — Agent Workflow

> **Non-Claude agents:** read `AGENTS.md` at the project root
> first — it is the vendor-neutral, self-contained entry point
> and requires nothing outside this repository. This file
> (`WORKFLOW.md`) is the Claude-specific Level-2 layer and
> references the laptop-wide Level-1 kernel at
> `~/.claude/CLAUDE.md`, which only Claude Code auto-loads.

> **This laptop is an operating system for AI agents.** Kernel + user
> space + audit log. Rules are hierarchical, non-contradictory, and
> optimized for token economy.
>
> **Level 1 — Kernel (global, auto-loaded in every session):**
> `~/.claude/CLAUDE.md` — central-git topology, commit rhythm, SSH
> key, ai-log rules, permission posture, cross-project auto-tasks.
> Pre-loaded at session start. Do NOT re-read it when this Level 2
> file is present.
>
> **Level 2 — User space (this file):** CATALYST-specific rules only.
> Everything expressible at Level 1 has been removed to keep the
> token cost minimal.
>
> **Conflict resolution:** Level 1 infrastructure invariants
> (topology, SSH, "never open a bare in Sourcetree", "one bare per
> project") are absolute. Level 1 routine defaults (commit rhythm,
> pre-read rules, ai-log scope) can be narrowed or replaced by this
> file for CATALYST only. Safety rules from the system prompt outrank
> both levels.

---

## 1. What this project is

CATALYST is a LAN-first Flask sample-request and instrument workflow
system for shared lab facilities. Sequential approvals
(finance → professor → operator), queue management, per-request
attachments, SHA-256 audit chain. Single binary, SQLite, no build
step. **Version 1.3.0 is the first stable release**; every hard
attribute is locked.

Primary entry point: `app.py` (≈7,000 lines). This is the product.

## 1.1 Release Channels

CATALYST now has **two git lanes** and agents must treat them
as different environments:

- **Dev lane / dev repo** — where active implementation, refactors,
  crawler-led fixes, and parallel agent work happen.
- **Stable lane / live repo** — release-candidate commits only.
  This lane exists to keep the live website boring and predictable.

Rule:

- write agents do normal work in the **dev lane**
- only explicitly release-bound work is promoted into the
  **stable/live lane**
- the Mac mini / live website must only pull from the
  **stable/live lane**
- if another agent is preparing a go-live push, do **not** pile
  unrelated work onto the stable branch; keep shipping in dev

## 1.2 Runtime Lanes

The live code path is now expected to sit inside the isolated runtime
tree:

| Lane | App root | Data root |
|---|---|---|
| `live` | `/Users/vishvajeetn/ERP-Instances/lab-erp/live/app` | `/Users/vishvajeetn/ERP-Instances/lab-erp/live/data` |
| `dev` | `/Users/vishvajeetn/ERP-Instances/lab-erp/dev/app` | `/Users/vishvajeetn/ERP-Instances/lab-erp/dev/data` |

Rule:

- stable/live verification should happen from `live/app`
- live mutable state must stay in `live/data`
- do not point the live lane at any dev database or dev uploads path

## 2. Topology

CATALYST is the only project on this laptop with a Level-2 mini
mirror — because the mini actually **runs** CATALYST in production.
The post-receive hook on the Level 1 bare force-mirrors every
push to the mini so the mini's `~/git/lab-scheduler.git` stays
current; the mini then does `git pull` + `launchctl kickstart`
to deploy atomically.

| Thing | Path |
|---|---|
| Level 1 bare (canonical origin) | `~/.claude/git-server/lab-scheduler.git` |
| Working copy | `~/Documents/Scheduler/Main/` *(moved out of Dropbox on 2026-04-11 to avoid pack-file corruption)* |
| Default branch | `v1.3.0-stable-release` *(stable/live lane only)* |
| Level 2 upstream | **`mini`** — auto-mirror via post-receive hook. Target: `catalyst-mini:~/git/lab-scheduler.git`. Reason: mini runs CATALYST in production. |

Push policy:

- **Dev work:** push to the dev repo / dev lane only
- **Release work:** push the selected release commit(s) to the
  stable/live lane, then let that lane mirror to the mini

Do not use the stable branch as a shared scratchpad for all
agents anymore.

## 3. CATALYST-specific rules

### 3.1  Pre-commit gate

```bash
.venv/bin/python scripts/smoke_test.py          # ~5 s, mandatory
.venv/bin/python -m crawlers wave sanity        # ~15 s, slightly stronger
.venv/bin/python -m crawlers wave all           # ~15 min, release boundaries only
```

The smoke test must stay green before any commit lands on
`v1.3.0-stable-release`. `wave sanity` is the stronger mid-flight
gate when templates or routes have been touched. `wave all` runs
only at release boundaries — do NOT run it on every commit.

### 3.1.1  Operator configuration check — mandatory at session start

Before firing any SSH or crawler workload, the agent must verify the
current operator workstation is configured correctly:

- confirm the active username and host (`whoami`, `hostname`)
- confirm the repo path exists and is the expected working copy
- confirm the Python env exists (`.venv` or `venv`)
- confirm SSH aliases / user config work without prompts before using
  remote execution
- if a second operator workstation joins (for example Satyajeet on a
  separate MacBook Pro), treat that machine as an additional **local
  verifier**, not as an ad-hoc production host

If any of those checks fail, stop and surface the misconfiguration to
the user before burning time on crawler orchestration.

### 3.1.2  LLM-supervised crawler policy

Local crawlers are not free-roaming background jobs. Every crawler run
must be supervised by an LLM agent that owns the task, records why the
run exists, and captures the result for the operator.

- every crawler run has a supervising agent and an explicit task id
- writable agents must claim files in `CLAIMS.md` before editing and
  remove the claim when shipping
- if a task grows or files change, update the claim before widening the
  write scope
- when the work is done, update the claim state again by removing the
  row in the same shipping commit
- read-only crawlers may inspect the whole repo, but they must not edit
  tracked files directly
- read-only crawlers should write findings to temporary or report files
  first, record where that output lives, and move on to the next check
- no crawler should perform git writes, rebases, or pushes unless its
  supervising agent explicitly owns that step

The purpose is simple: every machine action must have human-auditable
agent ownership, and no parallel process should be able to silently
override another agent's work.

### 3.1.3  Sidecar crawler jobs and finish-later handoffs

When a read-only crawler finds useful work that it cannot or should not
finish immediately, it should leave a structured handoff for a later
write agent instead of dropping the context on the floor.

- create sidecar job files under `tmp/agent_handoffs/<task-id>/`
- each sidecar job should be one small markdown file with:
  - task id
  - supervising agent id
  - timestamp
  - files or surfaces inspected
  - exact findings
  - recommended next edit set
  - proof command to rerun after the fix
  - whether the handoff is read-only analysis or ready-for-write
- sidecar jobs are **not** claims and do not authorize tracked-file
  edits by themselves
- a later write agent must still claim the tracked files in
  `CLAIMS.md` before applying the handoff
- read-only crawlers may keep adding sidecar jobs in parallel as long as
  they stay inside `reports/` or `tmp/agent_handoffs/`
- if a sidecar job becomes obsolete, the finishing agent should either
  delete it in the shipping commit or mark it `superseded` inside the
  file

Think of these as queued micro-lanes for future agents: crawlers keep
discovering work, write agents keep shipping bounded chunks, and the
system keeps moving even when one agent cannot carry a lane all the way
to green in a single sitting.

### 3.2  Hard vs soft attributes — read `docs/PHILOSOPHY.md` §2

**Hard (locked except at major version bumps, CHANGELOG entry under
`### Changed (BREAKING)` mandatory):**

- Data model — the 15 tables, 22 indexes, foreign keys
- Request status state machine (`REQUEST_STATUS_TRANSITIONS`)
- Immutable SHA-256 audit chain
- Tile architecture — every page is a fluid grid of self-contained
  widget tiles built from the 9 canonical macros in
  `_page_macros.html`
- Event stream — every in-place edit appends to the target's event
  stream, non-negotiable
- Two-layer visibility — `request_card_policy()` + `request_scope_sql()`
  server-side, `data-vis` client-side (visual-uniformity safety net,
  never trusted)
- 48 routes, 9 roles

**Soft (drifts between patch releases, no version bump):**

- Copy / wording
- Placement of existing tiles on a page
- Colour palette, toast styles, icon choice
- CSS hygiene

Any change to a hard attribute without a major version bump + BREAKING
entry is a policy violation; flag it to the user before committing.

### 3.3  Publishing / deploying

LOCAL bare is the canonical origin. The Mac mini is both the warm
backup mirror AND the canonical production host (`launchctl kickstart`
serves CATALYST to the lab network). Deploys are **atomic**:

```
pull → .venv/bin/python scripts/smoke_test.py → launchctl kickstart
```

**Never interrupt live users.** Never force-push
`v1.3.0-stable-release`. Never rewrite history on any branch the
mini has pulled. See `docs/DEPLOY.md` for the full deploy recipe.

### 3.4  Domain-specific invariants

- **Read `docs/PHILOSOPHY.md` before any non-trivial change.** It
  is load-bearing. It defines the Jony Ive / Apple / Ferrari design
  creed, the hard-vs-soft contract, and the demo-vs-operational
  separation.
- **`DEMO_MODE=1` on the MacBook dev environment, `DEMO_MODE=0`
  on the Mac mini production deploy.** Demo and operational data
  are physically separate directories (`data/demo/` vs
  `data/operational/`). Demo never touches operational.
- **Read `docs/PROJECT.md` §11 (Reusable abstractions) and §12
  (Testing) BEFORE adding new code.** Pick a helper off the list
  rather than inventing a parallel approach.
- **CSRF on by default** (`LAB_SCHEDULER_CSRF=1`). Every form has
  `csrf_token`; the base-template JS shim auto-injects the token
  into `fetch()` calls. Do not remove or bypass this.
- **Rate-limited login** (10 attempts / 5 min / IP), parameterised
  SQL everywhere, extension whitelist on uploads, XSS-safe templates.

### 3.5  Files and folders to leave alone

| Path | Why |
|---|---|
| `data/operational/` | Real lab data. Mac mini only. Gitignored, but don't even read it in dev sessions. |
| `data/demo/lab_scheduler.db` + `uploads/` + `exports/` | Regenerable demo state. Do not commit. |
| `scripts/smoke_test.py` | THE pre-commit gate. If you change it, run it against itself first. |
| `FOCS-submission/` | Unrelated paper bundle, gitignored, do not touch. |

### 3.6  Pre-commit recipe

```bash
cd ~/Documents/Scheduler/Main
git pull origin <dev-branch>

# ... make changes ...

.venv/bin/python scripts/smoke_test.py             # MUST pass
git add -p
git commit -m "<imperative subject ≤ 70 chars>"
git pull --rebase origin <dev-branch>              # absorb concurrent work
git push origin <dev-branch>
```

Commit rhythm is Level 1. Do not restate it here.

Fast-path single-writer recipe:

```bash
cd ~/Documents/Scheduler/Main
git status --short
git pull origin <dev-branch>

# ... make one bounded change ...

.venv/bin/python scripts/smoke_test.py
git add <files>
git commit -m "<type>: <subject>" -m "Co-Authored-By: Codex <noreply@openai.com>"
git push origin <dev-branch>
```

Stable-release promotion recipe:

```bash
# from a clean release-prep working copy
git checkout v1.3.0-stable-release
git pull origin v1.3.0-stable-release

# promote only release-approved commits from dev
git cherry-pick <approved-commit> [<approved-commit> ...]

.venv/bin/python scripts/smoke_test.py
.venv/bin/python -m crawlers wave sanity
git push origin v1.3.0-stable-release
```

### 3.7  Fast mode — ALWAYS ON

**All agents work in fast mode by default.** This is not optional.

- **Single-writer path is the default.** If one write agent owns
  the repo and `CLAIMS.md` is empty, skip claim-only commits and
  use the fast-path recipe above.
- **Parallel-write path is explicit.** The moment a second write
  agent appears, or a lane needs a hot shared file, leave fast
  mode and switch to the full claim protocol.
- **Parallel writes belong in dev.** Stable/live should aim to be
  single-writer and release-bound. If many agents are active,
  the correct answer is usually "move them to dev", not "claim
  harder on stable".
- **Pre-receive hook is fast** (~1s smoke on branch pushes).
  Full sanity only runs on tag pushes or `CATALYST_FULL_GATE=1`.
- **Batch related changes** into one commit. Don't split a
  feature into "schema commit" + "route commit" + "template
  commit" unless each is independently shippable.
- **Crawlers track useful signals, not solved problems.**
  If a crawler checks something that's been stable for weeks,
  it's noise. Remove the check or move it to a less frequent
  wave. The sanity wave must stay under 20s.
- **Think ERP.** CATALYST is a modular ERP (see
  `docs/ERP_PRIMITIVES.md`). Every feature maps to a primitive.
  New portals clone existing ones, not build from scratch.

### 3.8  Parallel agent work — claim before you edit

Multiple Claude agents can now run concurrently against this
repo (different chat sessions, same working copy). The
coordination protocol is **advisory lock + git rebase +
pre-receive sanity wave** — read `docs/PARALLEL.md` for the
full spec. Minimum rules a fresh agent must obey:

1. **If another write agent exists, claim your files before editing.**
   In single-writer fast mode, skip this. In parallel-write mode,
   append a
   row to `CLAIMS.md` at the repo root with your agent id, the
   task id (lane-prefixed), an ISO-8601 timestamp, and the
   files you intend to touch. Commit **`CLAIMS.md` alone** with
   subject `claim: <agent-id> — <task-id>` and push. This is
   your lock and must land on the central bare before you edit
   anything else.
2. **Do not touch files outside your claim.** If you discover
   you need a file held by another claim, pause and surface the
   collision to the user instead of widening the claim silently.
   If you need to widen your file set, update `CLAIMS.md` first,
   commit/push the widened claim, then continue.
3. **Pull --rebase before every push.** Absorb any concurrent
   commits immediately before you push, so the pre-receive
   hook sees a fast-forward. Never force-push, never
   `--no-verify`.
4. **Release the claim in the same commit as the work.** Remove
   your row from `CLAIMS.md` and include it in the same
   commit that ships the work; never leave a row behind. This
   step applies only when you entered parallel-write mode.
5. **Honour stale claims.** A row older than ~2 h with no
   matching `git log` activity is stale, but **do not silently
   clear it** — surface to the user first.

Read-only crawler agents are allowed to scan broadly without a
write claim, but they must keep their output in temp files,
reports, or operator-facing notes until a writable agent claims
the relevant tracked files and applies the fix.

Tasks available for claiming live in `docs/NEXT_WAVES.md`
§"Parallel task board".

## 4. Docs-in-this-repo manifest

Only load-bearing docs. Do NOT pre-read the full `docs/` folder;
pick the relevant file for the task.

| File | Role | Read when... |
|---|---|---|
| `README.md` | Project overview, quick start | Always (routine orientation) |
| `docs/PHILOSOPHY.md` | **THE** design creed — hard/soft, demo/op separation, stable-release discipline | **Before any non-trivial change** |
| `docs/PROJECT.md` | Architecture spec — schema, page map, reusable helpers, state machine, security model | Before adding new code, changing routes, or touching the DB |
| `docs/MODULES.md` | Engine map — 13 engines + 2 tool packages, each with file:line handles | Composing a new feature — pick an engine off this list |
| `docs/DEPLOY.md` | Mac mini deploy recipe + disaster checklist | Deploying, or when the mini misbehaves |
| `docs/DATA_POLICY.md` | Single-source-of-truth rules for portfolio + scheduler state | Touching any JSON state file or the `/admin/portfolio` panel |
| `docs/ROADMAP.md` | Forward plan, version-scoped | Starting a new feature — is it on the roadmap? |
| `docs/NEXT_WAVES.md` | Active plan of record (supersedes ROADMAP.md backlog) | Picking the next task — has a "Parallel task board" section |
| `docs/PARALLEL.md` | Parallel agent coordination protocol + lane taxonomy | When starting concurrent work or recovering from a claim conflict |
| `CLAIMS.md` | Live advisory lock board for parallel agents | **Read at session start, every session** |
| `CHANGELOG.md` | Release history, v1.3.0 baseline | Before a release bump or a BREAKING entry |

Other docs under `docs/` (`COMPONENT_LIBRARY.md`,
`CSS_COMPONENT_MAP.md`, `HANDOVER.md`, `ROLE_VISIBILITY_MATRIX.md`,
`SECURITY_TODO.md`) are specialist reference — read only if the
task is explicitly in their domain.

## 5. Three-Engine Development Model

CATALYST uses three engines in parallel for maximum throughput with
minimum LLM token spend:

```
┌───────────────────────────────────────────────┐
│ Engine 1: LLM (Claude / any AI agent)         │
│ → Reads code, designs changes, writes patches │
│ → Spawns parallel sub-agents                  │
│ → Orchestrates both machines via SSH          │
└──────────┬──────────────────┬─────────────────┘
           │                  │
     ┌─────▼─────┐    ┌──────▼──────┐
     │ Engine 2   │    │ Engine 3    │
     │ MacBook Pro│    │ Mac Mini    │
     │ M1 Pro 32G│    │ M4 24GB     │
     │ (local)    │    │ (SSH)       │
     └────────────┘    └─────────────┘
```

### 5.1  Task partitioning — FIRST STEP IN EVERY TASK

**Before writing any code, the LLM MUST:**
1. Identify which local-machine jobs to fire FIRST (crawlers, tests, stress)
2. Launch them in background on BOTH machines immediately
3. THEN start the LLM reasoning/editing work while machines grind

**This is not optional.** Every task starts with `ssh mini ... &` and
`./venv/bin/python -m crawlers ... &` BEFORE the LLM reads a single file.
The machines verify the PREVIOUS commit while the LLM works on the NEXT one.
This pipeline means zero idle compute.

### 5.1.2  Workstation discovery — local capacity is dynamic

The "local machine" is no longer a single MacBook. It is the set of
developer workstations currently participating in the session:

- primary local editor machine: current MacBook Pro
- production-serving verifier: Mac mini M4 24 GB via SSH
- secondary local verifier: any additional joined workstation
  (for example Satyajeet's MacBook Pro)

Agents must use the strongest available local workstation pool for
empirical work first, then offload the overflow to the mini. More
MacBooks joining means more local crawlers, more smoke runs, and less
LLM waiting.

### 5.1.1  Debug feedback log — TREAT AS CRITICAL

**`logs/debug_feedback.md` is the user's live voice.** Every entry
is a real person clicking the real app and telling you what's wrong.

**Rules:**
- Check the log at the START of every task (before anything else)
- Every entry with a CSS/layout/UI complaint MUST be fixed immediately
- Every entry with a feature request must be acknowledged and queued
- Never dismiss an entry as "already addressed" unless you verified
  the fix is live on the running server
- After fixing, re-read the log to check for new entries added while
  you were fixing — the user may be testing in real-time
- Log entries are numbered. Track which ones are fixed in the commit
  message (e.g., "Closes debug entries #27, #28, #30")

**Resilience rules:**
- Local tasks are fire-and-forget with `run_in_background`
- LLM checks results after ~5 minutes via `TaskOutput` or reading output files
- If LLM stops or errors, local tasks still complete independently
- Local tasks must never depend on LLM mid-flight — they run to completion alone
- Use `timeout` on all Bash commands (120s default, 300s for heavy crawlers)

**Rule: anything that can be verified empirically runs on a machine,
not in the LLM's reasoning budget.**

| Task type | Engine | Why |
|-----------|--------|-----|
| Code edits, design decisions | LLM | Needs reasoning |
| Smoke tests, crawlers | Local MacBook | Fast, no tokens |
| Heavy crawlers (random_walk, dead_link) | Mini via SSH | Offloads from local |
| Sanity wave (11 crawlers) | Mini via SSH | Parallel with local work |
| Route health (301 checks) | Local MacBook | Empirical, not reasoning |
| Template compilation | Local MacBook | Instant verification |
| Database stress | Local MacBook | No tokens needed |
| Full smoke_test.py | Local MacBook | Pre-commit gate |
| Security audit (XSS, SQLI) | LLM + Local grep | LLM designs, machine verifies |

### 5.2  Parallel execution pattern

```bash
# Fire local + mini simultaneously
ssh mini "cd ~/Scheduler/Main && .venv/bin/python -m crawlers wave sanity" &
./venv/bin/python -m crawlers run smoke &
./venv/bin/python scripts/smoke_test.py &
wait
```

**Always** fire both machines for verification tasks. The LLM edits
code while machines verify the previous commit. This pipeline means
the LLM never waits for test results — it ships the fix and the
machines confirm asynchronously.

### 5.2.1  Max local crawler budget

Use this default budget on the primary MacBook Pro unless the user says
otherwise:

- target roughly **90% usable machine budget**
- preserve about **10% interactive headroom** for normal human work
  such as Zoom, browser tabs, music, messaging, or light terminal use
- run up to **4 local crawler processes** at once on a single MacBook
- plus **1 local smoke/test process** (`scripts/smoke_test.py`) in parallel
- heavy waves (`random_walk`, `dead_link`, `wave all`) prefer the mini
- if two MacBooks are active, each may use the same rule on its own host
- each local crawler must still have an LLM supervisor; more machines
  increase throughput, not autonomy

Priority order:

1. local `scripts/smoke_test.py`
2. local `crawlers run smoke`
3. local `crawlers wave sanity`
4. mini heavy crawlers / overflow waves
5. second MacBook local smoke / sanity when available

Rule: keep the editing laptop comfortably usable, not mostly idle. The
goal is maximum useful throughput while still leaving enough headroom
for ordinary human foreground activity.

### 5.3  Token economy

Local machines save ~3M tokens per session by running empirical
checks instead of LLM reasoning. See `docs/SESSION_LOG.md` for
detailed accounting.

### 5.4  Module development with machines

When building a new ERP module:
1. LLM writes schema + routes + templates
2. Local runs `smoke_test.py` immediately
3. Mini runs `crawlers wave sanity` in parallel
4. LLM reads results, fixes any failures
5. Both machines re-verify
6. Commit + push (pre-receive gate runs on the bare)

This loop takes ~2 minutes per module vs ~15 minutes of pure LLM work.

### 5.5  Continuous development — always-on crawlers + three-machine budget

_Policy anchor 2026-04-15. Precondition for the compressed
commercialization timeline in `docs/COMMERCIALIZATION_POLICY.md §5`._

PRISM development is a 24×7 operation, not a working-hours activity.
Machines verify continuously; humans + LLM step in to fix what the
crawlers find. This section defines the cadence and the per-machine
load contract so the editing laptop stays responsive while the other
hosts run as hot as they can.

**Machine pool (three hosts):**

| Host | Role | Load policy when user is actively typing | Load policy when user is idle / on Codex / on another Claude session |
|------|------|-------------------------------------------|----------------------------------------------------------------------|
| Primary MacBook Pro (M1 Pro, 32 GB) | Editor + local verifier | **Aggressive by default** — use most of the machine, but preserve roughly 10% foreground headroom for the human | Same — it can run hot unless the human experience degrades |
| Mac mini (M4, 24 GB) | Production host + heavy verifier | **100%** — max out. It's a server, not an editor. | Same — 100% always. |
| iMac (dev pool) | Heavy verifier, full sudo | **100%** — max out. Not an editing surface. Full sudo access for anything dev-needed (package installs, system tweaks, storage provisioning). | Same — 100% always. |

"User is actively typing on the MBP" is detected by: (a) an interactive
Claude Code session on the MBP that is not this one, or (b) an open
Codex / Cursor / VS Code window with recent input activity. When in
doubt, default to the newer rule: leave roughly 10% interactive
headroom and use the rest.

**Continuous crawler schedule (all three machines):**

```
hourly   — crawlers wave sanity   (~15 s; low-budget, hot path)
hourly   — smoke_test.py          (~5 s; pre-commit gate sanity)
every 4h — crawlers wave rhythm   (~1 min; fastest per-category)
every 6h — crawlers wave feature  (lifecycle coverage)
daily    — crawlers wave all      (~15 min; full matrix; off-hours on mini)
daily    — wave security          (to land with §6 of ERP_MODULARIZATION_ARCHITECTURE)
weekly   — pip-audit + gitleaks + dependency-upgrade check
```

Each hourly tick is launched by a per-host launchd agent (mini) /
launchd agent (iMac) / launchd agent (MBP with headroom-aware policy).
Results land in
`reports/` with a per-run timestamp and are tailed by the supervising
LLM session on next wake-up. Crawler ownership and claim rules from
§3.1.2 still apply — hourly runs are read-only by default and never
touch tracked files without a claim.

**Why always-on crawlers:** the 2-week cohort exit gate in
`COMMERCIALIZATION_POLICY.md §1` is only meaningful if the defect
backlog stays near zero during the cohort. Hourly crawlers catch
regressions within an hour of landing, not on the next manual
smoke run. This converts "cohort feedback window" from a
noisy, days-long signal to a clean, hours-long one.

**Load-budget enforcement on the MBP:**

- Use `nice -n 10` + `renice` on hourly crawler PIDs on the MBP.
- Hard cap via `launchctl` `LowPriorityIO` + `ProcessType = Background`.
- If foreground human work becomes visibly sluggish, the MBP crawler
  daemon should back off until roughly the 10% interactive reserve is
  restored. The mini and iMac keep running unchanged.
- If the MBP battery is <20% and unplugged, the crawler daemon
  suspends (not paused — suspends until power is back).

**Full sudo on the iMac:** the iMac is designated a dev-pool host.
Agents may install packages, provision storage, adjust launchd, and
otherwise configure it freely as long as every such action is logged
via `ai-log` (per Level 1 rules). Do NOT take the same liberties on
the mini — the mini runs production, treat its config as frozen
unless a deploy wave explicitly touches it.

**First-cut deployment checklist:**

1. On the iMac: install the `lab-scheduler` working copy, `.venv`,
   and a launchd agent that runs the hourly + daily crawler schedule
   above. `ai-log` the install.
2. On the MBP: install a launchd agent that runs the same schedule
   under `nice`/`LowPriorityIO` but uses the 10%-headroom rule above
   instead of the old 50% throttle.
3. On the mini: extend the existing launchd service so that crawler
   waves run on the hourly/daily schedule alongside production
   serving. The mini is already running; this is an additive wave,
   not a new deployment.
4. Verify all three schedules land output in `reports/` that the
   supervising LLM session can tail on next wake-up.
5. Commit the launchd plists and runner scripts under
   `ops/continuous_crawlers/` so the config is versioned.

Read `ops/continuous_crawlers/README.md` (to create alongside item 5)
for the runbook once this lands.

## 6. ERP Module System

CATALYST is a modular ERP. New modules are plug-and-play:

```bash
# Create a new module in one command
scripts/new_module.sh vehicle "Vehicle Fleet" "🚗" "Fleet management"
```

This auto-registers in MODULE_REGISTRY, creates template stubs,
adds route stubs, and prints enable instructions. See
`docs/ERP_MODULE_BUILDER.md` for the full recipe.

**MODULE_REGISTRY** in `app.py` drives:
- Nav bar generation (sorted by nav_order)
- Module-enabled gating (CATALYST_MODULES env var)
- Access profile per role
- Install/upgrade scripts

## 7. Change log (of this workflow file)

- **2026-04-15** — Added §5.5 continuous-development policy: hourly
  crawlers across three-machine pool (MBP throttled to 50% when user
  is editing, mini + iMac maxed out), daily full waves, weekly
  security sweep. Added iMac as dev-pool host with full sudo.
  Precondition for the 2-week cohort exit gate in
  `docs/COMMERCIALIZATION_POLICY.md §1`.
- **2026-04-13** — Added three-engine development model (§5),
  ERP module system (§6), token economy documentation. Updated
  for v1.1 architecture (MODULE_REGISTRY, dynamic nav, Homebrew
  installer).
- **2026-04-11** — Initial WORKFLOW.md created as part of the
  two-level agent operating system rollout (Level 1 kernel in
  `~/.claude/CLAUDE.md`, Level 2 user space here). Lifted
  CATALYST-specific rules from `README.md` and `docs/PHILOSOPHY.md`;
  removed everything already covered at Level 1.
