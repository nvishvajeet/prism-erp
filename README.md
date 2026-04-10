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
