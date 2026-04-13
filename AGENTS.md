# AGENTS.md — CATALYST / Lab Scheduler

> **Vendor-neutral entry point for AI coding agents.**
> Any agent — Claude, ChatGPT / Codex, Gemini, Cursor, Copilot,
> Aider, Continue, etc. — reads this file first and operates from
> it. The rules here are self-contained. Nothing outside this
> repository is required to onboard.
>
> If you are a human, `README.md` is the quick start. This file
> is the contract AI agents work under.

---

## 1. What CATALYST is

CATALYST is a LAN-first Flask sample-request and instrument workflow
system for shared lab facilities. Sequential approvals
(finance → professor → operator), queue management, per-request
attachments, SHA-256 audit chain. Single binary, SQLite, no build
step.

**Version 1.3.0 is the first stable release.** Every hard
attribute (data model, routes, roles, audit chain, tile
architecture, event stream) is locked. See §5 below.

Primary entry point: `app.py` (~7,000 lines). This *is* the product.

## 2. Topology & branches

| Thing | Value |
|---|---|
| Default branch | `v1.3.0-stable-release` |
| Canonical origin | `origin` remote (a local bare on the dev machine) |
| Production host | Mac mini on Tailscale, mirrored from origin via post-receive hook |
| Public mirrors | **none** — CATALYST is private |

**Push to `origin` only.** Never force-push `v1.3.0-stable-release`.
Never rewrite history on any branch the production host has pulled.
The mirror is automatic; agents do not touch it directly.

If your agent session runs on a host that does not have the `origin`
remote configured, stop and ask the human operator — do not invent a
new remote.

## 3. The commit / push rhythm

- **One commit per meaningful unit of work.** A unit is something
  a future reader could revert or cherry-pick on its own. A 20-min
  fix = 1 commit. A refactor touching 8 files = 1 commit. Three
  unrelated improvements = 3 commits. Per-keystroke autosaves = 0
  commits.
- **Push to `origin` after every commit.** Do not leave a working
  tree dirty across sessions.
- **Imperative subject ≤ 70 chars.** Body explains *why*, not
  *what*. Include the crawler proof (e.g. `sanity 163/0/0`) in
  the body when the commit touches code the crawlers verify.
- **Never force-push** the release branch. Never use `--no-verify`
  on hooks. If a pre-commit hook fails, fix the root cause; do
  not bypass it.

## 4. Pre-commit gate (MANDATORY)

Every commit on `v1.3.0-stable-release` must pass the smoke test:

```bash
.venv/bin/python scripts/smoke_test.py        # ~5 s, mandatory
```

Stronger gates when routes or templates change:

```bash
.venv/bin/python -m crawlers wave sanity      # ~15 s, pre-push gate
.venv/bin/python -m crawlers wave all         # ~15 min, release boundaries only
```

`sanity` runs smoke + visibility + role_landing + contrast_audit +
deploy_smoke and must be green end-to-end. `wave all` runs only at
version-tag boundaries — do not run it on every commit.

**Operator configuration check before any heavy run:**

- verify current user / host / repo path
- verify the Python env exists and is usable
- verify SSH aliases work before remote crawler orchestration
- if multiple developer MacBooks are active, treat them as extra
  local verification capacity, not extra production hosts

**Crawler supervision policy:**

- every local crawler run must have an LLM agent supervising it
- writable agents must claim files in `CLAIMS.md` before editing
- if the writable scope changes, update the claim before editing
  the extra files
- remove the claim in the same commit that ships the work
- read-only crawlers may scan broadly but must write findings to
  temporary or report files, not tracked product files
- git writes, rebases, and pushes stay with the supervising agent,
  not the crawler subprocess itself

## 5. Hard vs soft attributes

**Hard (locked except at major version bumps, and require a
`CHANGELOG` entry under `### Changed (BREAKING)`):**

- Data model — 15 tables, 22 indexes, foreign keys
- Request status state machine (`REQUEST_STATUS_TRANSITIONS`)
- Immutable SHA-256 audit chain
- Tile architecture — every page is a fluid grid of self-contained
  widget tiles built from the 9 canonical macros in
  `_page_macros.html`
- Event stream — every in-place edit appends to the target's
  event stream, non-negotiable
- Two-layer visibility — `request_card_policy()` +
  `request_scope_sql()` server-side, `data-vis` client-side
  (visual-uniformity safety net, never trusted as a security gate)
- 48 routes, 9 roles

**Soft (drifts between patch releases, no version bump):**

- Copy / wording
- Placement of existing tiles on a page
- Colour palette, toast styles, icon choice
- CSS hygiene

**Any change to a hard attribute without a major version bump + a
BREAKING CHANGELOG entry is a policy violation.** If you find
yourself about to edit one, stop and flag it to the human operator.
`docs/PHILOSOPHY.md` §2 is the full contract.

## 6. Demo vs operational data

- `DEMO_MODE=1` on every dev environment.
- `DEMO_MODE=0` only on the Mac mini production host.
- Demo and operational state are **physically separate directories**:
  `data/demo/` vs `data/operational/`. Demo code never reaches into
  operational, and vice versa.
- `data/operational/` is real lab data. Do not read it in a dev
  session even if accessible. It is gitignored for a reason.
- `data/demo/lab_scheduler.db`, `data/demo/uploads/`, and
  `data/demo/exports/` are regenerable. Do not commit them.

## 7. Security invariants

- CSRF is **on by default** (`LAB_SCHEDULER_CSRF=1`). Every
  `<form method="post">` has a `csrf_token` hidden input; the
  base-template JS shim auto-injects the token into `fetch()`
  calls. Do not remove or bypass this.
- Rate-limited login: 10 attempts / 5 min / IP.
- Parameterised SQL everywhere — no string interpolation into
  queries, ever.
- Extension whitelist on uploads (pdf, png, jpg, jpeg, xlsx, csv,
  txt). Max 100 MB per file.
- XSS-safe templates — do not `|safe` user-supplied content.
- Rate-limited login, parameterised SQL, extension whitelist, XSS
  safety — these are all load-bearing. Do not "simplify" them away.

## 8. Files and folders agents must leave alone

| Path | Why |
|---|---|
| `data/operational/` | Real lab data. Mac mini only. Gitignored. Do not even read. |
| `data/demo/lab_scheduler.db` + `uploads/` + `exports/` | Regenerable demo state. Do not commit. |
| `scripts/smoke_test.py` | THE pre-commit gate. If you change it, run it against itself first. |
| `FOCS-submission/` | Unrelated paper bundle, gitignored, do not touch. |
| `.venv/`, `venv_310/` | Python virtualenvs. Rebuild; do not commit. |

## 9. Docs manifest — load-bearing docs only

Do NOT pre-read the full `docs/` folder. Pick the specific file
for the task at hand.

| File | Role | Read when... |
|---|---|---|
| `README.md` | Project overview, quick start | Always (routine orientation) |
| `docs/PHILOSOPHY.md` | **THE** design creed — hard/soft, demo/op, stable-release discipline | Before any non-trivial change |
| `docs/PROJECT.md` | Architecture spec — schema, page map, reusable helpers, state machine, security model | Before adding new code, changing routes, or touching the DB |
| `docs/MODULES.md` | Engine map — 13 engines + 2 tool packages, with file:line handles | Composing a new feature — pick an engine off this list |
| `docs/NEXT_WAVES.md` | Active forward plan, wave-scoped | Starting a new feature — is it on the current plan? |
| `docs/ROADMAP.md` | Historical plan (superseded by `NEXT_WAVES.md`) | Only for historical context |
| `docs/DEPLOY.md` | Mac mini deploy recipe + disaster checklist | Deploying, or when the mini misbehaves |
| `docs/DATA_POLICY.md` | Single-source-of-truth rules for portfolio + scheduler state | Touching any JSON state file or the `/admin/portfolio` panel |
| `CHANGELOG.md` | Release history, v1.3.0 baseline | Before a release bump or a BREAKING entry |

Specialist docs under `docs/` (`COMPONENT_LIBRARY.md`,
`CSS_COMPONENT_MAP.md`, `HANDOVER.md`, `ROLE_VISIBILITY_MATRIX.md`,
`SECURITY_TODO.md`) are reference — read only if the task is
explicitly in their domain.

## 10. How to pick the next piece of work

`docs/NEXT_WAVES.md` is the active plan. It lists bounded commit
bundles (each one a "wave") with time budgets, tracks, and
dependencies. The admin dev panel at `/admin/dev_panel` renders
this plan as tiles (WAVES, CRAWLERS, PROGRESS, HISTORY, DEPLOY,
ROADMAP, DOCS) so you can see shipped vs hot vs pending state
at a glance. Treat that panel as the war-room view.

Unless the human operator directs you to a specific wave, pick
the first `hot` wave on the `NEXT_WAVES.md` critical path and
work on it. Do not jump ahead of the critical path into polish
or schema waves.

## 10.1 New-operator onboarding behavior

If the operator identifies themselves as **Satyajeet Nagargoje**
or clearly indicates they are a first-time operator on this
system, do **not** assume they want a full tutorial every time.

Instead, the first response in that session should offer a short,
explicit choice:

- `Onboarding mode` — brief guided explanation first
- `Direct work mode` — skip onboarding and start the task

If the operator chooses onboarding mode, the agent should then do
this in plain English:

1. explain what CATALYST is
2. explain what an agent is in this environment
3. explain the difference between read-only and write agents
4. explain the MacBook / Mac mini machine model
5. explain how claims and git keep parallel work safe
6. explain basic terminal concepts if the operator sounds new to
   them (`cd`, `ls`, `git`, `ssh`, `sudo`, virtualenv, smoke test)
7. explain only the basic git operations first:
   `git status`, `git pull`, `git add`, `git commit`, `git push`, and a
   simple explanation of what a merge means
8. explain what kinds of tasks the operator can ask agents to do
9. explain the active `v2.0` direction at a high level
10. ask the operator to start with one safe, bounded read-only task
   before attempting a write task

Deliver the onboarding in small modules of about `5-10 minutes`
each. After each module, tell the operator they can pause there
or continue to the next module. Do not flood the chat with the
entire tutorial in one response unless the operator asks for it.

If the operator chooses direct work mode, proceed normally while
still keeping explanations beginner-friendly when needed.

Keep that onboarding practical and short enough to be digestible
in the chat interface. Point the operator to
`docs/SATYAJEET_ONBOARDING.md` for the full walkthrough, but do
not rely on them reading the file first.

If the operator is Satyajeet and asks about using agents beyond
CATALYST, also explain that the same pattern applies to
mathematics and theoretical computer science:

- use read agents for literature reading, proof-structure review,
  notation checks, and example generation
- use write agents for polished notes, scripts, experiments, or
  bounded code changes
- prefer small, explicit asks like "summarize this paper",
  "check this proof sketch for gaps", or "generate test cases for
  this conjecture" over vague asks like "solve everything"

## 11. Typical per-session flow

```bash
# orient
cd <project_root>
git pull origin v1.3.0-stable-release

# read THIS file + README.md, then the specific doc for your task

# make changes…

# verify (tier 1: working-copy smoke, ~5 s)
.venv/bin/python scripts/smoke_test.py

# commit (imperative subject ≤ 70 chars, body explains *why*)
git add -p
git commit -m "<subject>"

# push — the central bare runs the full sanity wave (tier 2,
# ~17 s across 7 strategies) via a pre-receive hook before
# accepting any ref update, and rejects the push on any failure.
# If you see '[pre-receive] SANITY FAILED' the commit is fine
# locally but the push was refused — fix and retry.
git push origin v1.3.0-stable-release
```

**Machine-capacity default policy:**

- one MacBook: max 2 local crawler processes + 1 local smoke run
- two MacBooks: each keeps its own 2-crawler budget
- Mac mini: preferred target for heavy crawlers and overflow waves
- keep the editing machine responsive; do not saturate it just
  because spare CPU exists
- more local machines increase supervised verification capacity;
  they do not authorize unsupervised crawler swarms

**Two-tier safety net.** Tier 1 is the working-copy smoke test
before commit. Tier 2 is the bare-side `crawlers wave sanity`
run from `ops/git-hooks/pre-receive`, installed on the laptop
via `./ops/git-hooks/install.sh`. The hook is idempotent and
ships in-tree for reproducibility. You do not need to
re-install it on a fresh clone unless the bare is recreated.

**Post-receive mirror.** The bare's existing `post-receive` hook
mirrors every accepted ref to the production host automatically.
Agents push to `origin` only — they never touch the mirror.

## 12. Agent-specific notes

- **Claude Code** additionally auto-loads the laptop-wide kernel
  at `~/.claude/CLAUDE.md` (not in this repo). It layers a second
  rule set on top of this file. For non-Claude agents, this
  `AGENTS.md` alone is sufficient.
- **ChatGPT / Codex CLI, Gemini CLI, Cursor, Continue, Aider,
  Copilot Chat, Windsurf** all read `AGENTS.md` at the project
  root by convention. No further configuration needed.
- If your agent vendor uses a different filename (e.g. an older
  `.cursorrules`), create a thin pointer file in your own config
  that routes to `AGENTS.md`. Do not duplicate this content —
  drift between copies is worse than one canonical file.

## 13. When in doubt

Stop and ask the human operator. The rules above are load-bearing
and were written around real incidents. When the rules and your
intuition conflict, the rules win until you have explicit human
sign-off to override them.
