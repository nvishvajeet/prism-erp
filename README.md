# PRISM — Lab Scheduler

**Version 1.2.0** · LAN-first Flask sample-request and instrument
workflow system for MIT-WPU's shared lab facility. Sequential
approvals (finance → professor → operator), queue management,
per-request attachments, SHA-256 audit chain.

Single binary. SQLite. No build step.

---

## What's in 1.2.0

PRISM 1.2.0 is the current release on `master`. It is production-
usable on a LAN today; the 1.3.x line closes the remaining hardening
items and 1.4 / 1.5 add the two user-facing features that real
operators will miss.

### Architecture
- Tile-based UI. Every page is a fluid grid of self-contained
  widget tiles. Reference: `templates/instrument_detail.html`
  (10 tiles on a 6-column grid).
- 8 widget macros in `_page_macros.html` are the canonical
  building blocks: `card_heading`, `paginated_pane`, `metadata_grid`,
  `kpi_grid`, `status_pills_row`, `queue_action_stack`, `person_chip`,
  `approval_action_form`, `activity_feed`.
- Two-layer visibility: server-side `request_card_policy()` and
  `request_scope_sql()` are the security gate; client-side
  `data-vis` is a visual-uniformity safety net, never trusted.

### Database
- 15 tables. 22 indexes on hot query paths. Foreign keys enforced.
- Request status state machine (`REQUEST_STATUS_TRANSITIONS` +
  `assert_status_transition`). Every status write goes through the
  validator; admin overrides pass `force=True`.
- Immutable audit chain. SHA-256 links every entry to the previous
  one; `verify_audit_chain()` walks the chain and returns `False`
  if any link is broken.

### Security
- `@instrument_access_required(level)` decorator gates every route
  that takes `<int:instrument_id>`.
- CSRF token machinery in place via Flask-WTF. Enforcement gated by
  `LAB_SCHEDULER_CSRF=1`; a `base.html` JS shim auto-injects the
  token into form submits and `fetch()` calls.
- `DEMO_MODE` gates `/demo/switch` and `seed_data()` so production
  ships without the impersonation route or demo accounts.
- Rate-limited login (10 attempts / 5 minutes / IP), parameterised
  SQL everywhere, extension whitelist on uploads, XSS-safe templates
  (Jinja auto-escape on, `metadata_grid` escapes strings).

### UX
- Toast notification system replaces inline flash panels. Errors
  persist until dismissed; success / info auto-fade after 5 s.
  Honors `prefers-reduced-motion`.
- PWA manifest, theme-color meta (light + dark), apple-touch-icon,
  skip-nav link, ARIA polish on interactive elements.

### Tooling
- Crawler suite under `crawlers/`. 13 registered strategies, 8 wave
  pipelines. `python -m crawlers wave sanity` is the pre-push gate
  (~5 seconds, stops on first failure).
- `.env.example` documents every environment flag PRISM reads.

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

---

## Roadmap

Three minor releases are planned. Each is independent; land them
in order for the smoothest upgrade path, but any can ship on its
own. Everything past 1.5 is held until a real deployment generates
real bug reports.

### v1.3.0 — Hardening complete

Four changes that close the security / correctness story.

- **Handler split.** Break the 685-line `request_detail()` view
  into one handler per action (approve_step, schedule, complete,
  reject, and 10 others). The state machine already guards every
  status write — the split isolates each action so a bug in one
  path cannot bleed into another.
- **CSRF enforcement on.** Every `<form method="post">` grows a
  `csrf_token` hidden input; the three regression test scripts
  fetch the meta tag. `LAB_SCHEDULER_CSRF` defaults to `1`.
- **Input validation everywhere.** Wrap every
  `int(request.form[...])` and `float(request.form[...])` in
  `safe_int()` / `safe_float()`. Malformed input flashes a clean
  toast instead of a 500.
- **State-transition test.** Persist the exhaustive legal-pair
  check as `tests/test_status_transitions.py` and add it to the
  pre-push gates.

### v1.4.0 — Bulk operations

The bulk-actions tile on the queue is currently a placeholder.
Wire the real actions: bulk approve, bulk assign operator, bulk
schedule, bulk reject, bulk export. Each action runs per-row
through the same permission gate the single-row path uses;
failures are reported in aggregate via the toast system.

### v1.5.0 — Search

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

```bash
cd Main
python3 -m venv venv
venv/bin/pip install -r requirements.txt

./start.sh              # development (HTTP, localhost)
./start.sh --https      # production-style HTTPS on the LAN
./start.sh --trust      # trust the self-signed cert (one-time, sudo)
```

Open `http://127.0.0.1:5055`.

`start.sh` auto-restarts on crash with exponential backoff, kills
any stale process on port 5055 first, and writes everything to
`logs/server.log` with timestamps.

### Demo accounts

Demo accounts are seeded when `LAB_SCHEDULER_DEMO_MODE=1` (the
default). Password for all seeded accounts: `SimplePass123`.

| Account | Role |
|---|---|
| `admin@lab.local` | Owner (full access) |
| `finance@lab.local` | Finance admin |
| `prof.approver@lab.local` | Professor approver |
| `fesem.admin@lab.local` | Instrument admin (FESEM) |
| `anika@lab.local` | Operator |
| `sen@lab.local` | Requester |

### Environment

Every flag PRISM reads is documented in `.env.example`. Copy to
`.env` and source explicitly — PRISM does not auto-load `.env`.
Keeping loading explicit avoids the "which config is actually
live?" confusion every Flask project hits by month three.

---

## Testing

```bash
venv/bin/python smoke_test.py               # ~5 s, pre-commit gate
venv/bin/python test_visibility_audit.py    # 8 roles × all pages
venv/bin/python test_populate_crawl.py      # 500 actions end-to-end
venv/bin/python -m crawlers wave sanity     # smoke + visibility + contrast
venv/bin/python -m crawlers wave all        # full pre-release sweep
```

The visibility audit and populate crawl must stay green before
any commit lands on `master`.

**When to run what.** `smoke_test.py` or `wave sanity` before every
commit. `wave all` only at release boundaries — running it between
every edit wastes minutes on output that does not change. The
random-walk coverage crawler plateaus at ~1000 steps (configurable
via `CRAWLER_RANDOM_WALK_STEPS`); more steps duplicate already-
visited cells.

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

### Registered strategies

| Name | Aspect | What it checks |
| --- | --- | --- |
| `smoke` | regression | Critical paths × 3 roles — pre-push sanity |
| `visibility` | visibility | 8 roles × ~12 pages access matrix |
| `role_behavior` | visibility | Each role performs its signature action |
| `lifecycle` | lifecycle | End-to-end request lifecycle through the UI |
| `dead_link` | dead_links | BFS href harvest + hit across 4 roles |
| `performance` | performance | p50 / p95 / max on hot routes (warn 300 ms / fail 1500 ms) |
| `random_walk` | coverage | MCMC walk over (role × route) cells |
| `contrast_audit` | accessibility | WCAG AA contrast check on the fixed palette |
| `color_improvement` | accessibility | Palette drift + low-contrast pair hunter |
| `architecture` | regression | Handler / template / CSS size budgets |
| `philosophy` | css_hygiene | Template-level design-creed audit |
| `css_orphan` | css_hygiene | Unused selectors in `static/styles.css` |
| `cleanup` | css_hygiene | Dead Python functions / templates / stale files |

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

- **Location:** `uploads/users/<user_id>/requests/req_<id>_<request_no>/attachments/`
- **Max size:** 100 MB per file
- **Allowed:** pdf, png, jpg, jpeg, xlsx, csv, txt
- **Exports:** `exports/` (generated Excel reports)

---

## Documentation

- **`PROJECT.md`** — architecture specification. Schema, page map,
  reusable helpers, state machine, security model, changelog.
- **`TODO_AI.txt`** — active plan (forward-looking, version-scoped).
- **`.env.example`** — every environment flag PRISM reads.
- **`CHANGELOG.md`** — release-by-release history.
- **`ROLE_VISIBILITY_MATRIX.md`** — every page mapped to roles.
- **`SECURITY_TODO.md`** — hardening checklist + HTTPS migration.
- **`CSS_COMPONENT_MAP.md`** — CSS class catalog.
- **`CRAWL_PLAN.md`** — role-based access testing plan.

---

## AI agent workflow rules

1. **Pull → work → commit → push.** Default rhythm.
2. **Smoke test before every commit** (`venv/bin/python smoke_test.py`,
   ~5 s). `wave sanity` is the slightly stronger alternative.
3. **Fix root causes, not symptoms.** Verify state before acting —
   items may already be done.
4. **Commit each file change as it lands** unless a single logical
   unit genuinely spans multiple files. `git push` after every
   commit — never leave commits local.
5. **Batch terminal permissions.** Front-load shell operations into
   long chained commands rather than drip-feeding many small calls.
   List every command you will need at the top of the reply when
   the plan is predictable.
6. **Full `wave all` only at release boundaries.** The smoke test
   is the mid-flight gate. Running `wave all` between every commit
   wastes minutes on output that does not change.
7. **Read `PROJECT.md` §11 (Reusable abstractions) and §12 (Testing)
   before adding new code.** Pick the relevant helper off that list
   rather than inventing a parallel approach.
   
   ## Claude + Ollama workflow

MacBook Pro is the source of truth for the working tree.
Mac mini is a remote compute machine for Ollama.
All agents use the same Git remote as the shared handoff layer.

### Core Git rules

1. Always pull before work.
2. Commit every few minutes or after each landed file change.
3. Push after every commit.
4. Keep useful progress in Git, not only in local working state.
5. Use the same Git server / remote for Claude sessions, MacBook work, Mac mini work, and all agents.

### Model split

Claude should do:
- planning
- task decomposition
- architecture
- multi-file refactors
- auth and permissions
- state-machine reasoning
- risky debugging
- schema and migration decisions

Ollama should do:
- small bounded implementation tasks
- single-file edits
- boilerplate
- repetitive cleanup
- summaries
- first-pass drafts
- narrow refactors with explicit acceptance criteria

Ollama should not do:
- repo-wide redesign
- security-critical logic
- permission model changes
- broad stateful refactors
- hidden-coupling changes across many files

### Chat workflow

There are two entry points:
- Open Remote Ollama Chat.command
- Open Local Ollama Chat.command

When started, each script:
1. starts the Ollama server if needed
2. keeps it available for a fixed window
3. opens an interactive chat prompt immediately
4. lets the operator send messages and see replies
5. logs prompts and replies to a chat log

Default runtime with no arguments is 120 minutes.

### Logging

Remote chat log:
ollama_chats/remote_chat.log

Local chat log:
ollama_chats/local_chat.log

### Recommended loop

1. Use Claude for planning and for breaking work into bounded tasks.
2. Use Ollama only for the smaller safe tasks.
3. Review the result locally.
4. Run smoke test.
5. Commit immediately.
6. Push immediately.


## Shared Git workflow for Claude and Ollama

Claude on the MacBook and Ollama on the Mac mini must use the same Git remote.

### Core rule

There is no live shared folder across machines.
Each machine has its own clone of the same repo.
Synchronization happens only through Git.

### Machines

- MacBook:
  - primary editing machine
  - Claude and local agents run here
  - source of most review and testing

- Mac mini:
  - remote Ollama worker
  - has its own clone of the same repo
  - pulls latest work before running tasks
  - commits and pushes small bounded changes if instructed

### Git discipline

Always use this sequence:

1. git pull --rebase
2. make one small change
3. run smoke test
4. git add -A
5. git commit -m "..."
6. git push

Do not keep long-lived uncommitted work on either machine.

### Branch rule

Use one shared working branch unless there is a good reason not to.
If both machines are actively editing at the same time, use short-lived task branches and merge quickly.

### Model split

Claude should do:
- planning
- decomposition
- architecture
- risky debugging
- auth and permission logic
- multi-file refactors
- schema and migration choices

Ollama should do:
- small bounded tasks
- single-file edits
- repetitive cleanup
- boilerplate
- summaries
- first-pass drafts

### Repo-aware model use

Ollama does not automatically see the repo.
It only sees what the wrapper script gives it.

Therefore:
- use the repo chat scripts from inside the repo clone
- pass file contents explicitly to the model
- review all output before committing

### Logging

Keep model logs in:
ollama_chats/

### Default runtime

Remote and local chat scripts default to 120 minutes when started with no arguments.


## Minimal Ollama bridge

Ollama does not automatically see the repo. It only sees text passed to it.

Use the helper script `run_ollama_task.sh` from the repo root.

Workflow:
1. Ensure the target Ollama endpoint is already live.
   - remote: http://127.0.0.1:11434
   - local:  http://127.0.0.1:11435
2. Run the helper script with:
   - a source file from the repo
   - a target (remote or local)
   - an instruction
3. The script writes the model output into `ollama_outputs/`.
4. Review the output.
5. Apply changes manually or use the output as agent guidance.
6. Run smoke test.
7. Commit immediately.
8. Push immediately.

Example:
./run_ollama_task.sh PROJECT.md remote "Summarize architecture and list next 5 bounded implementation tasks"

Git remains the only sync layer across Claude, local work, and remote Ollama.