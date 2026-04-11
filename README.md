# PRISM

**Lab Scheduler for MIT-WPU's shared instrument facility.**
Finance → professor → operator sequential approvals.
Queue, attachments, SHA-256 audit chain.
Single binary. SQLite. No build step.

Current stable tag: **`v1.5.0`** — multi-role users graduated as a
first-class hard attribute. [CHANGELOG](CHANGELOG.md) ·
[Philosophy](docs/PHILOSOPHY.md) ·
[Architecture](docs/PROJECT.md) ·
[Live demo](https://nvishvajeet.github.io/demo.html)

---

## What it does

One instrument. One request form. Three sequential approvals
(finance, professor-approver, operator). Each request carries
its own attachments, message history, issue thread, and an
immutable SHA-256 audit chain any admin can verify end-to-end.
Every page is a fluid grid of self-contained tiles — not a
bespoke layout per route — so the UI stays legible across 9
roles and 48 routes without per-page design work.

## Design creed

Apple / Jony Ive / Ferrari on a lab workflow tool. Every pixel
earns its place. Every tile is a canonical macro from the
shared widget library. Every route respects the hard-attribute
contract in [`docs/PHILOSOPHY.md §2`](docs/PHILOSOPHY.md).
**Hard** = data model, route shapes, roles, audit chain, tile
architecture, event stream. Changes to hard attributes only
through major version bumps with a `### Changed (BREAKING)`
CHANGELOG entry. **Soft** = copy, colour, placement, hover
state — drift freely between patch releases.

Release cadence is **iOS-style** (see PHILOSOPHY §3.1): every
commit that passes the pre-receive sanity wave is a candidate
for a tag, and tags are cut deliberately and often. Patch
releases in this project are minutes apart, not weeks.

## Quickstart — clone to live server in five lines

```bash
git clone <repo> lab-scheduler
cd lab-scheduler
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python app.py
open http://127.0.0.1:5055/login
```

Demo-mode credentials: `admin@lab.local` / `12345` (and
role-named aliases `operator@lab.local`, `requester@lab.local`,
`approver@lab.local`, `finance@lab.local`,
`instrument_admin@lab.local`, `site_admin@lab.local`, all with
the same password). See [`docs/DEPLOY.md`](docs/DEPLOY.md) for
production deployment on the Mac mini via launchd + Tailscale
Serve.

## The live demo

Public HTTPS demo is proxied from the laptop via a Cloudflare
quick tunnel — any browser on the internet, no tailnet required.
Visit the **Demo** tab on
[nvishvajeet.github.io](https://nvishvajeet.github.io/demo.html)
for the one-click landing. The `/login?demo=1` query param
pre-fills the admin credentials so visitors land signed in with
one button press. Seven deep-link cards below the CTA jump
straight into Dashboard, Instruments, Instrument detail, Queue,
New request form, Dev panel, and Sitemap.

## Architecture in 30 seconds

**Backend.** Single Flask binary. `app.py` is ~8,000 lines of
deliberate monolith — no microservices, no build step, no
background workers, one SQLite file. See
[`docs/PROJECT.md`](docs/PROJECT.md) for the engine map and
[`docs/MODULES.md`](docs/MODULES.md) for the 13-engine + 2
tool-package decomposition with file:line handles for every
engine.

**Database.** 15 tables + 22 hot-path indexes + the
`user_roles` junction (v1.5.0) + `instrument_group` membership.
Foreign keys enforced. Immutable audit chain. Request status
state machine (`REQUEST_STATUS_TRANSITIONS`) validated on every
write via `assert_status_transition()`.

**Frontend.** No build step. No framework. Vanilla Jinja
templates extending a single `base.html`, composed from 9
canonical widget macros in
[`templates/_page_macros.html`](templates/_page_macros.html).
The tile architecture is the hard constraint: every page is a
`.*-tiles` grid of `.tile`-family articles. The
`philosophy_propagation` crawler rejects any template that
drifts away from this contract at push time.

**Crawlers.** 22 strategies across 11 waves. `wave sanity`
(~17 s, 11 strategies) is the pre-receive gate on the central
bare — no commit lands without it going green. `wave all`
(~15 min, every registered strategy) is the release-boundary
stress test. See [`docs/NEXT_WAVES.md`](docs/NEXT_WAVES.md) for
the active plan and [`docs/PARALLEL.md`](docs/PARALLEL.md) for
the multi-agent work protocol.

## Mission Control — the dev panel

`/admin/dev_panel` is the operator's cockpit. Sign in as
`admin@lab.local`, visit the page, and see:

- **STABLE RELEASE** — latest semver tag with short SHA,
  tagged-at date, tag subject, and the commits-since-tag depth
  hint ("N commits on trunk since this tag — candidates for the
  next patch")
- **LATEST SHIPPED** — HEAD commit headline, author, date, and a
  cross-reference to the stable tag depth
- **v1.5.0 PRE-SEED** — remaining `# TODO [v1.5.0 multi-role]`
  markers in `app.py` (count decrements as each call site retires
  on the v1.5.x patch stream)
- **PROJECT TIMELINE** — every shipped tag grouped by minor-line
  (`v1.3.x`, `v1.4.x`, `v1.5.x`) with the latest tagged entry
  highlighted as **LATEST** — the full iOS-cadence history at
  a glance
- **NOW SHIPPING hero** — 4-cell release / hot-wave / commits-today
  / crawlers-last-ran at-a-glance
- **PROGRESS + HISTORY + DEPLOY + ROADMAP** — git state (ahead /
  behind / dirty), the last 6 commits, production host info,
  version-scoped progress meters

## Docs manifest

| File | Role |
|---|---|
| [`docs/PHILOSOPHY.md`](docs/PHILOSOPHY.md) | **Load-bearing.** Hard/soft contract, stable-release discipline, iOS cadence, demo/operational separation. Read before any non-trivial change. |
| [`docs/PROJECT.md`](docs/PROJECT.md) | Architecture spec — schema, page map, reusable abstractions (tile-family pattern), state machine, security model |
| [`docs/MODULES.md`](docs/MODULES.md) | Engine map — 13 engines + 2 tool packages with file:line handles |
| [`docs/NEXT_WAVES.md`](docs/NEXT_WAVES.md) | Forward plan — parallel task board, future technology bets, wave history |
| [`docs/PARALLEL.md`](docs/PARALLEL.md) | Multi-agent work protocol — read vs write agents, claim board, git hygiene, 5% merge budget, failure mode recovery |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | Mac mini deploy recipe + launchd + Tailscale Serve + disaster checklist |
| [`docs/ERP_VISION.md`](docs/ERP_VISION.md) | v2.0 direction — PRISM as the first portal of an internal ERP |
| [`CHANGELOG.md`](CHANGELOG.md) | Release history, every tag on the v1.x line |
| [`CLAIMS.md`](CLAIMS.md) | Live advisory lock board for concurrent agent work |
| [`AGENTS.md`](AGENTS.md) | Vendor-neutral entry point for any AI coding agent (Claude, Codex, Gemini, Cursor, Aider, Copilot) |

## Tests + crawlers

```bash
.venv/bin/python scripts/smoke_test.py            # ~5s pre-commit gate
.venv/bin/python -m crawlers wave sanity          # ~17s pre-push gate, 11 strategies
.venv/bin/python -m crawlers wave behavioral      # per-role signature actions + ui_uniformity + future_fixes
.venv/bin/python -m crawlers wave all             # ~15min release-boundary stress
.venv/bin/python tests/test_multi_role.py         # v1.5.0 helper contract (13 assertions)
.venv/bin/python tests/test_time_ago.py           # .row-time-hint humanisation
.venv/bin/python tests/test_status_transitions.py # state machine invariants (101 cases)
.venv/bin/python tests/test_seed_fixes.py         # v1.5.0 pre-seed TODO marker behaviour
```

`reports/` and `logs/` are gitignored — crawlers write private
per-run artifacts there. See `docs/PARALLEL.md` for why tracking
them in git would break the read-agent parallelism story.

## The ship helper

```bash
scripts/ship.sh "subject line" [file ...]
```

One command: `git add → smoke_test → git commit → git pull
--rebase → git push`. Refuses to run if untracked files are
present without explicit file arguments (the anti-absorption
rule from `v1.4.7`). Designed for 5-minute ship blocks in
single-operator sessions.

## License + credits

Built by Vishvajeet N for MIT-WPU. Python 3.14 + Flask 3. No
telemetry. No external services on the happy path (Tailscale /
Cloudflare tunnels are opt-in for public demo access only).
Demo data and operational data are physically separated per
[`docs/PHILOSOPHY.md §4`](docs/PHILOSOPHY.md).

---

**iOS-cadence tag stream to `v1.5.0`:**
`v1.3.8 → v1.4.1 → v1.4.2 → v1.4.3 → v1.4.4 → v1.4.5 →
v1.4.6 → v1.4.7 → v1.4.8 → v1.4.9 → v1.4.10 → v1.5.0`
