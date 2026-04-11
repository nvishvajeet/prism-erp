# PRISM — Lab Scheduler

**Version 1.3.0** · LAN-first Flask sample-request and instrument
workflow system for MIT-WPU's shared lab facility. Sequential
approvals (finance → professor → operator), queue management,
per-request attachments, SHA-256 audit chain.

Single binary. SQLite. No build step.

> **v1.3.0 is the first stable release.** See `PHILOSOPHY.md` for
> the hard-attribute contract that governs every subsequent change.
> See `DEPLOY.md` for how PRISM is hosted on the Mac mini and
> reached from the lab network.

---

## What's in 1.3.0

PRISM 1.3.0 is the first stable release. Every hard attribute
(data model, routes, roles, audit chain, tile architecture, event
stream) is now locked. Soft attributes (copy, placement, colours)
may still drift between patch releases.

### Architecture (hard)

- Tile-based UI. Every page is a fluid grid of self-contained
  widget tiles. Reference: `templates/instrument_detail.html`
  (10 tiles on a 6-column grid).
- 9 widget macros in `_page_macros.html` are the canonical
  building blocks: `card_heading`, `paginated_pane`,
  `metadata_grid`, `kpi_grid`, `chart_bar`, `status_pills_row`,
  `queue_action_stack`, `person_chip`, `approval_action_form`,
  `activity_feed`, `input_dialog`, `empty_state`. These are the
  atoms — do not reinvent them inside a template.
- Two-layer visibility: server-side `request_card_policy()` and
  `request_scope_sql()` are the security gate; client-side
  `data-vis` is a visual-uniformity safety net, never trusted.
- **Event stream.** Every in-place edit on a machine, request,
  or job appends one entry to the event stream of the thing it
  touched. Non-negotiable.

### Database (hard)

- 15 tables. 22 indexes on hot query paths. Foreign keys enforced.
- Request status state machine (`REQUEST_STATUS_TRANSITIONS` +
  `assert_status_transition`). Every status write goes through the
  validator; admin overrides pass `force=True`.
- Immutable audit chain. SHA-256 links every entry to the previous
  one; `verify_audit_chain()` walks the chain and returns `False`
  if any link is broken.

### Security (hard)

- `@instrument_access_required(level)` decorator gates every route
  that takes `<int:instrument_id>`.
- CSRF on by default in 1.3.0 (`LAB_SCHEDULER_CSRF=1`). Every
  `<form method="post">` has a `csrf_token` hidden input; the
  base-template JS shim auto-injects the token into `fetch()`
  calls.
- `DEMO_MODE` gates `/demo/switch` and `seed_data()`. Production
  deploys on the Mac mini ship with `LAB_SCHEDULER_DEMO_MODE=0`.
  Demo and operational data are physically separate (see
  `PHILOSOPHY.md` §4).
- Rate-limited login (10 attempts / 5 minutes / IP), parameterised
  SQL everywhere, extension whitelist on uploads, XSS-safe templates
  (Jinja auto-escape on, `metadata_grid` escapes strings).

### UX (soft — drifts between releases)

- Toast notification system replaces inline flash panels.
- PWA manifest, theme-color meta (light + dark), apple-touch-icon,
  skip-nav link, ARIA polish.
- Owner-only development console at `/admin/dev_panel` showing
  git progress, roadmap, document viewer, and recent commits.

### Tooling

- Crawler suite under `crawlers/`. 13 registered strategies, 8 wave
  pipelines. `python -m crawlers wave sanity` is the pre-push gate
  (~5 seconds, stops on first failure).
- `.env.example` documents every environment flag PRISM reads.

### Baseline metrics (v1.3.0)

| Metric | Value |
|---|---|
| `app.py` | ~7,000 lines |
| Routes | 48 |
| DB tables | 15 (22 indexes) |
| Templates | 28 |
| `static/styles.css` | ~7,180 lines |
| Roles | 9 |
| Visibility audit | 171 / 171 PASS |
| Populate crawl | 500 actions, 0 × 5xx, 0 exceptions |
| Random-walk coverage | 99.2% of (role × route) cells, 0 × 5xx |
| Performance p95 | < 5 ms on every hot route |

---

## Roadmap

PRISM 1.3.0 is the stable baseline. Future releases layer
user-facing features **only** — hard attributes are locked.

### v1.4.0 — Bulk operations (soft additions)

The bulk-actions tile on the queue is currently a placeholder.
Wire the real actions: bulk approve, bulk assign operator, bulk
schedule, bulk reject, bulk export. Each action runs per-row
through the same permission gate the single-row path uses;
failures are reported in aggregate via the toast system.

### v1.5.0 — Search (soft additions)

SQLite FTS5 virtual table over `sample_name`, `description`,
`request_no`, and requester name. New search box on the queue and
dashboard; results link into the existing card view. FTS5 ships
with SQLite, so no new dependency.

### Held

Email notifications, cost / invoicing, mobile breakpoint pass,
approval delegation, read-only `/api/v1`, audit log viewer,
OAuth / SAML SSO, multi-tenant. None of these earn their complexity
budget without a real deployment and real user feedback. See
`TODO_AI.txt` for the rationale on each.

---

## Running

### Development (MacBook)

```bash
cd Main
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

./start.sh              # development (HTTP, localhost)
./start.sh --https      # production-style HTTPS on the LAN
./start.sh --trust      # trust the self-signed cert (one-time, sudo)
```

Open `http://127.0.0.1:5055`.

`start.sh` auto-restarts on crash with exponential backoff, kills
any stale process on port 5055 first, and writes everything to
`logs/server.log` with timestamps.

### Production (Mac mini)

See `DEPLOY.md`. The Mac mini at `100.115.176.118` is the
canonical production host. It serves PRISM to every machine on
the Tailscale network, 24×7. Deploys are `git pull` → smoke test
→ `launchctl kickstart` — atomic, never interrupting live users.

### Demo accounts

Demo accounts are seeded **only** when `LAB_SCHEDULER_DEMO_MODE=1`.
This is the default on the MacBook dev environment and **off** on
the Mac mini production deploy. Password for all seeded accounts:
`SimplePass123`.

| Account | Role |
|---|---|
| `admin@lab.local` | Owner (full access) |
| `finance@lab.local` | Finance admin |
| `prof.approver@lab.local` | Professor approver |
| `fesem.admin@lab.local` | Instrument admin (FESEM) |
| `anika@lab.local` | Operator |
| `sen@lab.local` | Requester |

Demo and operational data are physically separated. Demo never
touches the operational database. See `PHILOSOPHY.md` §4.

### Environment

Every flag PRISM reads is documented in `.env.example`. Copy to
`.env` and source explicitly — PRISM does not auto-load `.env`.

---

## File manifest (v1.3.0)

v1.3.0 collapses the engine to a hand-countable set of code files.
Everything else is either assets (templates, css, images), data
(`data/demo/`, `data/operational/`), or docs.

| File / package | Role | Significance |
|---|---|---|
| `app.py` | The Flask engine | Routes, views, DB schema, state machine, audit chain, email, exports, auth, CSRF. This is the product. |
| `smoke_test.py` | End-to-end health check | ~5-second smoke test. Pre-commit gate. Exercises every hot route under every role and asserts real writes land. |
| `populate_live_demo.py` | Demo data seeder | Populates `data/demo/lab_scheduler.db` with 24 users, 10 instruments, 33 requests. Demo-only — never runs in production mode. |
| `crawlers/` | QA crawler suite | 13 strategies + 8 wave pipelines. `python -m crawlers wave sanity` is the slightly-stronger pre-commit gate; `wave all` runs at release boundaries. |
| `tests/test_status_transitions.py` | State-machine unit test | Validates every allowed transition in `REQUEST_STATUS_TRANSITIONS`. Runs under `pytest` or directly. |
| `templates/` | Jinja templates | Tile-architected HTML. 28 pages + `_page_macros.html` (9 canonical widgets). |
| `static/` | CSS, JS, images | Single `styles.css` (≈7,180 lines) + calendar.js + instrument_images/. |
| `data/demo/` | Demo runtime state | SQLite DB + uploads + exports. Regenerable. Gitignored. |
| `data/operational/` | Production runtime state | Real lab DB + uploads + exports. Gitignored. Mac mini only. |
| `PHILOSOPHY.md` | The design creed | Hard-vs-soft attributes, demo/operational split, stable-release discipline. Read every session. |
| `DEPLOY.md` | Production deploy guide | Mac mini atomic deploy recipe. |
| `PROJECT.md` | Architecture spec | Schema, page map, reusable helpers, state machine. |
| `TODO_AI.txt` | Forward plan | Version-scoped backlog. |
| `CHANGELOG.md` | Release history | |
| `README.md` | This file | |
| `.env.example` | Config manifest | Every environment flag PRISM reads. |

That is the whole product — 3 Python files at the root plus the
crawlers package and a single test file.

## Testing

```bash
.venv/bin/python smoke_test.py               # ~5 s, pre-commit gate
.venv/bin/python -m crawlers wave sanity     # smoke + visibility + contrast
.venv/bin/python -m crawlers wave all        # full pre-release sweep
.venv/bin/python -m pytest tests/            # unit tests (status state machine)
```

`smoke_test.py` must stay green before any commit lands on `master`.

**When to run what.** `smoke_test.py` or `wave sanity` before every
commit. `wave all` only at release boundaries. The random-walk
coverage crawler plateaus at ~1000 steps (configurable via
`CRAWLER_RANDOM_WALK_STEPS`); more steps duplicate already-visited
cells.

---

## Crawler suite

Each crawler is a `CrawlerStrategy` subclass registered against an
aspect (visibility, lifecycle, coverage, performance, accessibility,
dead_links, css_hygiene, regression, data_integrity). Drop a new
file into `crawlers/strategies/`, import it in
`crawlers/strategies/__init__.py`, and the CLI picks it up
automatically.

```bash
python -m crawlers list                     # registered strategies
python -m crawlers describe <name>          # docstring + aspect
python -m crawlers run <name|all>           # run one (or all)
python -m crawlers list-waves               # wave pipelines
python -m crawlers wave <name>              # run a named wave
```

Every run writes a JSON log + plain-text summary under `reports/`.

### Wave pipelines

| Wave | Strategies | Purpose |
| --- | --- | --- |
| `sanity` | smoke → visibility → contrast_audit | **Pre-push gate** (stops on first failure) |
| `static` | architecture → philosophy → css_orphan | No-DB structural analysis |
| `behavioral` | role_behavior → visibility | Behavioural RBAC |
| `lifecycle` | lifecycle → dead_link | End-to-end journeys + dead-link sweep |
| `coverage` | random_walk → performance | MCMC coverage + perf sampling |
| `accessibility` | contrast_audit → color_improvement | WCAG + palette drift |
| `cleanup` | cleanup → css_orphan → philosophy | Dead-code retirement |
| `all` | every wave in order | Full pre-release gate (slow) |

The `sanity` wave has `stop_on_fail=True`; the others run through
to collect a complete backlog of findings.

---

## File uploads

- **Location:** `data/{demo,operational}/uploads/users/<user_id>/requests/req_<id>_<request_no>/attachments/`
  (active folder chosen by `LAB_SCHEDULER_DEMO_MODE`)
- **Max size:** 100 MB per file
- **Allowed:** pdf, png, jpg, jpeg, xlsx, csv, txt
- **Exports:** `data/{demo,operational}/exports/` (generated Excel reports)

---

## Documentation

- **`PHILOSOPHY.md`** — THE PHILOSOPHY. Jony Ive / Apple / Ferrari
  design creed, hard-vs-soft attribute contract, demo-vs-operational
  separation, stable-release discipline. **Read every session.**
- **`DEPLOY.md`** — Mac mini production deployment + disaster
  checklist.
- **`PROJECT.md`** — architecture specification. Schema, page map,
  reusable helpers, state machine, security model.
- **`TODO_AI.txt`** — active plan (forward-looking, version-scoped).
- **`.env.example`** — every environment flag PRISM reads.
- **`CHANGELOG.md`** — release-by-release history.
- **`ROLE_VISIBILITY_MATRIX.md`** — every page mapped to roles.
- **`SECURITY_TODO.md`** — hardening checklist + HTTPS migration.
- **`CSS_COMPONENT_MAP.md`** — CSS class catalog.
- **`CRAWL_PLAN.md`** — role-based access testing plan.

---

## Remote server access for other agents

PRISM's canonical git remote lives on a Mac mini in India, reachable
only over Tailscale. Other agents (Claude Code instances on other
machines, CI jobs, a second developer) can connect to it through the
same SSH-to-git bridge this repo already uses.

### What the remote is

- **Host:** `vishwajeet@100.115.176.118` (Tailscale IP, not public)
- **Repo path:** `~/git/lab-scheduler.git` (bare)
- **Branch of record:** `v1.3.0-stable-release`
- **Transport:** SSH with `publickey` auth — no password, no HTTPS,
  no GitHub mirror. The Mac mini is the origin.

### Prerequisites for a new agent / machine

1. **Tailscale** installed and logged into the same tailnet. Without
   Tailscale the IP `100.115.176.118` is unreachable.
2. **SSH key** generated locally (`ssh-keygen -t ed25519`) and the
   public key (`~/.ssh/id_ed25519.pub`) appended to
   `~/.ssh/authorized_keys` on the Mac mini. One-shot:
   ```bash
   ssh-copy-id -i ~/.ssh/id_ed25519.pub vishwajeet@100.115.176.118
   ```
3. **`~/.ssh/config` hygiene.** If the host's default config has
   macOS-only keys like `UseKeychain`, add this guard at the very
   top so non-macOS ssh clients don't choke:
   ```
   IgnoreUnknown UseKeychain,AddKeysToAgent
   ```
4. **Force the right identity.** If ssh-agent has other keys loaded
   the Mac mini will hit `MaxAuthTries` before reaching the right
   one. Always pin the key explicitly:
   ```
   Host prism-mini
       HostName 100.115.176.118
       User vishwajeet
       IdentityFile ~/.ssh/id_ed25519
       IdentitiesOnly yes
   ```

### Clone

```bash
git clone vishwajeet@100.115.176.118:~/git/lab-scheduler.git Scheduler
cd Scheduler
git checkout v1.3.0-stable-release
git config core.sshCommand "ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes"
```

The `core.sshCommand` line persists the right SSH invocation on the
clone, so `git pull` / `git push` work without environment hacks.

### Verify

```bash
ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes \
    vishwajeet@100.115.176.118 "hostname && ls ~/git/lab-scheduler.git"
git ls-remote origin
```

Both should succeed silently. If either prompts for a password or
returns `Permission denied (publickey)`, fix the key / config
before running any git commands.

### Agent kickoff prompt

Copy-paste this into a new Claude Code session (or equivalent agent
harness) on any machine that has met the prerequisites above:

> You are joining the PRISM / Lab Scheduler project as a secondary
> agent. The canonical git remote is a Mac mini reachable only over
> Tailscale at `vishwajeet@100.115.176.118:~/git/lab-scheduler.git`,
> branch `v1.3.0-stable-release`. Before touching any code:
>
> 1. Confirm Tailscale is up (`tailscale status`) and the mini is
>    reachable (`ping -c1 100.115.176.118`).
> 2. Verify SSH works with an explicit identity:
>    `ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes vishwajeet@100.115.176.118 hostname`
> 3. Clone with `git clone vishwajeet@100.115.176.118:~/git/lab-scheduler.git`,
>    then `git config core.sshCommand "ssh -i ~/.ssh/id_ed25519 -o IdentitiesOnly=yes"`
>    inside the clone.
> 4. Read `PHILOSOPHY.md`, `README.md`, `ROADMAP.md`, and
>    `HANDOVER.md` before editing anything.
> 5. Default rhythm: **pull → work → smoke test → commit → push.**
>    The pre-push gate is `.venv/bin/python -m crawlers wave sanity`.
>    Never skip it. Never force-push. Never rewrite history on
>    `v1.3.0-stable-release`.
> 6. Hard attributes (data model, routes, roles, audit chain, tile
>    architecture) are locked — see `PHILOSOPHY.md` §2. Soft
>    attributes (copy, colour, layout) are fair game.
>
> Your first action is to run `git pull` and report the latest
> three commits on `v1.3.0-stable-release`, then wait for a task.

---

## AI agent workflow rules

1. **Read `PHILOSOPHY.md` first, every session.** It is
   load-bearing. Any change that violates it does not ship.
2. **Pull → work → commit → push.** Default rhythm. No local-only
   commits.
3. **Smoke test before every commit** (`.venv/bin/python
   smoke_test.py`, ~5 s). `wave sanity` is the slightly stronger
   alternative.
4. **Fix root causes, not symptoms.** Verify state before acting —
   items may already be done.
5. **Commit each file change as it lands** unless a single logical
   unit genuinely spans multiple files. `git push` after every
   commit.
6. **Batch terminal permissions.** Front-load shell operations into
   long chained commands rather than drip-feeding many small calls.
7. **Full `wave all` only at release boundaries.** The smoke test
   is the mid-flight gate.
8. **Read `PROJECT.md` §11 (Reusable abstractions) and §12 (Testing)
   before adding new code.** Pick the relevant helper off that list
   rather than inventing a parallel approach.
9. **Hard attributes are locked.** Changes to the data model,
   routes, roles, audit chain, or tile architecture require a major
   version bump and a CHANGELOG entry under `### Changed (BREAKING)`.
   See `PHILOSOPHY.md` §2.
10. **The website stays up.** Deploys to the Mac mini are atomic:
    pull → smoke → kickstart. Never interrupt live users.
11. **Portfolio recommendation refresh — one per day.** Whenever a
    Claude (or other LLM) agent touches this repo, check whether
    `~/Downloads/portfolio-plan/commentary_state.json` was generated
    today (compare its `generated_at` field to the current local
    date). If it is missing or stale:
    - Run `cd ~/Downloads/portfolio-plan && ./run.sh quick` to
      refresh the deterministic Python pipeline (NAVs, Nifty z-score,
      drift, 14-day forecast, daily_state.json).
    - Read `daily_state.json`, `market_snapshot.json`,
      `analysis_state.json`, and (if present) `news_digest.json` +
      `macro_state.json`.
    - Write a fresh `commentary_state.json` to the portfolio-plan
      directory with the schema documented in
      `~/Downloads/portfolio-plan/README.md` (`generated_at`,
      `model`, `nifty_z`, `multiplier`, `today_total`, `text`,
      `verdict`). Keep the `text` under 200 words; the `verdict` is
      one line.
    - If the file is already fresh for today, do NOT regenerate —
      one recommendation per day, and the time of day shapes the
      verdict (before 13:30 IST = same-day NAV; after = T+1).
    - The deterministic per-fund amounts are authoritative. The LLM
      adds context, never overrides numbers. Never recommend selling
      equity. The Flask `/admin/portfolio` panel reads
      `commentary_state.json` automatically — no restart, no commit.
    See `~/Downloads/portfolio-plan/README.md` for the full rules
    that govern that sibling repo.
