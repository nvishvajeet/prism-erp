# PRISM / Lab Scheduler — Agent Workflow

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
> **Level 2 — User space (this file):** PRISM-specific rules only.
> Everything expressible at Level 1 has been removed to keep the
> token cost minimal.
>
> **Conflict resolution:** Level 1 infrastructure invariants
> (topology, SSH, "never open a bare in Sourcetree", "one bare per
> project") are absolute. Level 1 routine defaults (commit rhythm,
> pre-read rules, ai-log scope) can be narrowed or replaced by this
> file for PRISM only. Safety rules from the system prompt outrank
> both levels.

---

## 1. What this project is

PRISM is a LAN-first Flask sample-request and instrument workflow
system for MIT-WPU's shared lab facility. Sequential approvals
(finance → professor → operator), queue management, per-request
attachments, SHA-256 audit chain. Single binary, SQLite, no build
step. **Version 1.3.0 is the first stable release**; every hard
attribute is locked.

Primary entry point: `app.py` (≈7,000 lines). This is the product.

## 2. Topology

PRISM is the only project on this laptop with a Level-2 mini
mirror — because the mini actually **runs** PRISM in production.
The post-receive hook on the Level 1 bare force-mirrors every
push to the mini so the mini's `~/git/lab-scheduler.git` stays
current; the mini then does `git pull` + `launchctl kickstart`
to deploy atomically.

| Thing | Path |
|---|---|
| Level 1 bare (canonical origin) | `~/.claude/git-server/lab-scheduler.git` |
| Working copy | `~/Documents/Scheduler/Main/` *(moved out of Dropbox on 2026-04-11 to avoid pack-file corruption)* |
| Default branch | `v1.3.0-stable-release` |
| Level 2 upstream | **`mini`** — auto-mirror via post-receive hook. Target: `prism-mini:~/git/lab-scheduler.git`. Reason: mini runs PRISM in production. |

Push to `origin` only. The Level 1 bare's hook mirrors to the
mini. No GitHub, no Bitbucket — PRISM is private.

## 3. PRISM-specific rules

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
serves PRISM to the MIT-WPU lab network). Deploys are **atomic**:

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
cd ~/Library/CloudStorage/Dropbox/Scheduler/Main   # (or ~/Claude/lab-scheduler after migration)
git pull origin

# ... make changes ...

.venv/bin/python scripts/smoke_test.py             # MUST pass
git add -p
git commit -m "<imperative subject ≤ 70 chars>"
git push origin v1.3.0-stable-release
```

Commit rhythm is Level 1. Do not restate it here.

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
| `CHANGELOG.md` | Release history, v1.3.0 baseline | Before a release bump or a BREAKING entry |

Other docs under `docs/` (`COMPONENT_LIBRARY.md`,
`CSS_COMPONENT_MAP.md`, `HANDOVER.md`, `ROLE_VISIBILITY_MATRIX.md`,
`SECURITY_TODO.md`) are specialist reference — read only if the
task is explicitly in their domain.

## 5. Change log (of this workflow file)

- **2026-04-11** — Initial WORKFLOW.md created as part of the
  two-level agent operating system rollout (Level 1 kernel in
  `~/.claude/CLAUDE.md`, Level 2 user space here). Lifted
  PRISM-specific rules from `README.md` and `docs/PHILOSOPHY.md`;
  removed everything already covered at Level 1.
