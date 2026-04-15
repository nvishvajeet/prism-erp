# Catalyst ERP

> Open-source modular ERP. One file. Any organization. 14 modules. 15,000 lines. Zero dependencies beyond Flask + SQLite.

**Live domain:** [catalysterp.org](https://catalysterp.org)

## Git Channels

CATALYST now follows a two-lane git model:

- **Dev lane / dev repo** — all normal agent work, refactors, UI
  improvements, crawler-led fixes, and experiments
- **Stable lane / live repo** — only release-approved commits that
  are safe to deploy to the live website

The live website should only track the stable/live lane. If multiple
agents are building at once, they should collaborate in dev and
promote a bounded release bundle into stable later.

## Install

```bash
# One-liner
curl -fsSL https://raw.githubusercontent.com/nvishvajeet/catalyst-erp/main/install.sh | bash

# Or manual
git clone https://github.com/nvishvajeet/catalyst-erp.git catalyst
cd catalyst && ./catalyst init && ./catalyst start
```

## What is Catalyst ERP?

A single-file Flask ERP that runs research facilities, food service companies, and any operation that needs approvals, finance tracking, attendance, and team management. Built in one week with AI-assisted development across two machines (MacBook Pro + Mac Mini).

**Live ERP surfaces:**
- **MIT-WPU CRF** — 21 instruments, 8 roles, sample request workflow
- **Ravikiran Services** — food/hospitality at MIT ADT University, 16 staff, 3 business units
- **Compute ERP** — HPC job queue, software catalog, worker-backed execution

## New Operator Start Here

If the operator is **Satyajeet Nagargoje** or any new user joining this
system through Claude, the agent should begin by offering a simple
startup choice:

- `Onboarding mode` — explain the system in plain English first
- `Direct work mode` — skip the tutorial and go straight to the task

If the operator chooses onboarding mode, the agent should treat this
section as the default onboarding demo and explain it in chat before
doing task work.

The onboarding should be modular:

- each module should take about `5-10 minutes`
- the operator should be told they can pause after any module
- the agent should ask whether to continue to the next module
- the agent should not dump everything at once unless asked

The first guided response should cover these steps in plain English:

1. Explain what CATALYST is:
   one product with a public shell, an operational app, an ERP spine,
   and a machine-verification loop.
2. Explain what an agent is:
   a supervised AI worker that can either read/analyze or claim/edit.
3. Explain the two agent types:
   read agents explore and report; write agents claim files, edit,
   verify, commit, and push.
4. Explain the machine model:
   MacBook = editing/verification machine, Mac mini = production-serving
   verifier, extra MacBooks = more supervised local verification.
5. Explain the git safety model:
   `CLAIMS.md` + dev-vs-stable lane split + `git pull`/sync +
   pre-receive smoke/sanity checks.
6. Explain the terminal basics if needed:
   what `cd`, `ls`, `git`, `ssh`, `sudo`, Homebrew, virtualenv, smoke
   tests, HTTPS, and domains mean.
7. Explain only the basic git operations first:
   `git status`, `git pull`, `git add`, `git commit`, `git push`, and in
   simple terms what a merge means when two people changed related work.
7. Explain what tasks agents can do:
   docs reading, crawler audits, code explanation, safe implementation,
   testing, deploy verification, and reporting.
8. Explain the current strategic direction:
   `v2.0` means finishing the missing ERP domains and unifying the
   public website, Ravikiran deployment story, and Lab ERP into one
   product.
9. Start the operator with one safe task:
   first a read-only crawl or summary task, then a write task later.

If the operator asks about using agents outside CATALYST, also explain
that the same workflow works well for mathematics and theoretical
computer science:

- read agents for paper summaries, proof checks, notation review, and
  example generation
- write agents for clean notes, LaTeX drafts, experiments, scripts, and
  bounded code work
- the same basic git operations help for coauthored papers too:
  `pull` = get coauthor changes, `add` = mark your edits, `commit` =
  save a meaningful version, `push` = share it back

Full walkthrough:
[docs/SATYAJEET_ONBOARDING.md](docs/SATYAJEET_ONBOARDING.md)

## 14 Modules

| Module | Routes | What it does |
|--------|--------|-------------|
| **Instruments** | 8 | Equipment/unit management, sample requests, approval chains |
| **Finance** | 11 | Grants, invoices, payments, budget enforcement, unified spend |
| **Personnel** | 5 | Staff directory, salary config, payroll (attendance-based) |
| **Vehicles** | 4 | Fleet registry, fuel/maintenance logs, driver assignment |
| **Receipts** | 4 | Expense submission with photo/PDF, admin review |
| **Attendance** | 11 | Self + team marking, leave requests, calendar view |
| **Inbox** | 7 | Internal messaging, threads, attachments, folders |
| **Notifications** | 5 | System alerts, admin notices, category filters |
| **Tasks** | 4 | Todos (self) + Tasks (assigned), inbox-style UI |
| **Letters** | 6 | Create letters on institute letterhead, print as PDF |
| **Calendar** | 4 | Schedule views, bookings, downtime windows |
| **Stats** | 5 | Usage analytics, charts, instrument utilization |
| **Queue** | 8 | Sample request workflow, approval pipeline |
| **Admin** | 14 | User management, dev panel, infrastructure monitoring |

Enable selectively: `CATALYST_MODULES=instruments,finance,personnel,vehicles`

## Demo Variants

CATALYST can be demoed as multiple ERP sites from the same codebase:

- `Lab ERP` — instruments, finance, queue, calendar, stats
- `Ravikiran Operations ERP` — personnel, vehicles, attendance, receipts, finance
- `Compute ERP` — compute queue, software catalog, notifications, admin
- `Full Product Demo` — all active modules together

Preset bundles and demo guidance:
[docs/ERP_DEMO_VARIANTS.md](docs/ERP_DEMO_VARIANTS.md)

## Cross-Module Integration

Modules talk to each other automatically:

```
Finance ← Vehicle fleet costs + Salary outflow + Approved receipts
Dashboard ← Fleet status + Payroll due + Instrument queues
Personnel ↔ Vehicles (driver ↔ vehicle cross-links)
Personnel → Attendance (payroll auto-calculates from attendance)
Letters ← Personnel (pre-filled recipient from staff directory)
Instruments → Finance (auto-charge samples to default grant)
Notifications ← All modules (status change alerts)
```

Full matrix: [docs/MODULE_INTEGRATION.md](docs/MODULE_INTEGRATION.md)

## Architecture

```
┌──────────────────────────────────────────┐
│  app.py (16,587 lines)                    │
│  ├─ 140 routes                            │
│  ├─ 15 modules (MODULE_REGISTRY)          │
│  ├─ 8+ product roles                      │
│  ├─ 45+ database tables                   │
│  └─ SHA-256 immutable audit chain         │
├──────────────────────────────────────────┤
│  68 Jinja2 templates                      │
│  ├─ 6 UI primitives (tile/widget/badge)   │
│  ├─ 10 reusable macros                    │
│  └─ data-vis role-gating on every element │
├──────────────────────────────────────────┤
│  9,823 lines CSS                          │
│  ├─ Light + dark mode                     │
│  ├─ WCAG AA contrast                      │
│  ├─ 480px → 760px → 1200px responsive     │
│  └─ iOS tile grid system                  │
├──────────────────────────────────────────┤
│  25 crawler strategies                    │
│  ├─ Smoke, visibility, role behavior      │
│  ├─ Dead links, random walk, performance  │
│  ├─ WCAG contrast, CSS hygiene            │
│  └─ 132,700+ checks verified             │
└──────────────────────────────────────────┘
```

## Security

- CSRF protection (Flask-WTF)
- PBKDF2-SHA256 password hashing
- Google OAuth ready (just add credentials)
- Role-based access (8 roles, per-module gating)
- XSS-safe markdown renderer
- File upload validation (type + size)
- Immutable audit trail (SHA-256 chain)
- Cloudflare tunnel for HTTPS (zero-config)

## Roles

| Role | Sees | Can do |
|------|------|--------|
| Owner | Everything | God-mode, dev panel |
| Super Admin | Everything | Manage users, full access |
| Site Admin | Everything except dev | Manage site settings |
| Instrument Admin | Assigned units | Configure instruments |
| Operator | Assigned units | Process samples, mark attendance |
| Finance Admin | Finance portal | Grants, invoices, payroll |
| Approver | Approval queue | Approve/reject requests |
| Requester | Own requests | Submit samples, inbox |

## AI Action Queue

CATALYST treats AI as an intake and routing layer, not an unchecked
executor. The home-page AI entry should be understood as a
`Catalyst Assistant`: it helps people submit requests faster, extracts
metadata, and routes work into the right operational queue.

Core policy:

- AI never deletes requests.
- AI never silently drops unclear requests.
- Manual submission must always remain available alongside AI-assisted
  submission.
- Any AI-originated item should be visibly marked so reviewers know it
  came through an AI draft path.
- Sensitive changes require human review before they become live.

What enters the AI Action Queue:

- account creation / deactivation
- employee updates, manager changes, attendance marks
- expense / receipt drafts
- sample request drafts and routing suggestions
- vehicle logs
- finance / grant drafts
- password reset or role change requests
- bug reports and UX feedback

The queue is role-aware and gated in three steps:

1. `Can request` — is this user allowed to ask for this action?
2. `Can target` — is this user allowed to affect this person/entity?
3. `Can execute` — can this become live immediately, or must it go to
   human review?

Recommended visible flairs:

- `AI Draft`
- `Needs Review`
- `Manual`
- `Bug`

Suggested execution statuses:

- `Queued`
- `Under Review`
- `Approved`
- `Rejected`
- `Executed`

Security rules:

- users should only see their own requests by default
- line managers should only see requests relevant to their direct
  reports
- domain admins should only see requests in their module / portal
- AI queue admins should see pending AI-routed items, but that does not
  automatically grant full authority over finance, payroll, privileged
  roles, or owner-only actions
- every transition must be audit-logged

Named AI Action Queue admins for current operations:

- `Prashant`
- `Kondhalkar`
- `Nikita`

These admins should be able to repair metadata, approve routing, and
escalate unclear requests. If AI cannot confidently parse a request, it
must still create a queue item and send it to this admin lane rather
than discarding it.

Recommended admin panes:

- `AI Action Queue` — all pending AI-assisted requests
- `Pending Accounts` — draft accounts waiting for approval / activation
- `Quick Add Account` — fast onboarding form with optional AI-assisted
  metadata extraction
- `Pending People Changes` — exits, manager changes, role changes,
  salary-affecting updates
- `Bug and Feedback Queue` — UX issues and error reports

Quick Add Account policy:

- admins should be able to type a few details and create an account in
  front of the user
- AI may fill missing metadata, suggest usernames, role placement,
  portal assignment, and line manager
- the acting admin should confirm the draft before creation
- newly created accounts should be login-ready, force password change on
  first login, and show the admin exactly what access the new user has

## CLI

```bash
./catalyst start     # Start server
./catalyst init      # Initialize database
./catalyst test      # Run smoke test
./catalyst crawl     # Run sanity wave (26 crawlers)
./catalyst module    # Create new module
./catalyst update    # Zero-downtime update
./catalyst search    # Search from terminal
./catalyst status    # Show system stats
```

## For AI Agents

Any AI agent (Claude, GPT, Gemini, Codex) can build new modules:

- [AGENTS.md](AGENTS.md) — vendor-neutral onboarding
- [docs/SATYAJEET_ONBOARDING.md](docs/SATYAJEET_ONBOARDING.md) — practical 20-minute operator walkthrough for a new Claude user, including terminal / SSH / Homebrew / HTTPS basics
- [docs/ERP_FUTURE_BUILDER.md](docs/ERP_FUTURE_BUILDER.md) — shortest mental model for extending the ERP safely
- [docs/ERP_DEMO_VARIANTS.md](docs/ERP_DEMO_VARIANTS.md) — ready-to-run demo bundles for each ERP surface
- [docs/ERP_MODULE_BUILDER.md](docs/ERP_MODULE_BUILDER.md) — 15-minute module recipe
- [docs/ARCHITECTURE_SUMMARY.md](docs/ARCHITECTURE_SUMMARY.md) — full UI/CSS/pattern reference
- [docs/MODULE_INTEGRATION.md](docs/MODULE_INTEGRATION.md) — cross-module wiring guide

## Easiest Way To Build The Next ERP Feature

Use this order:

1. pick the table that owns the truth
2. add one route and one page
3. gate it by role + `module_enabled(...)`
4. wire one integration only if it is obvious
5. run smoke and ship

That keeps CATALYST simple enough to grow for years without turning it
into a maze of one-off subsystems.

## Docs

| File | Purpose |
|------|---------|
| [ERP_FUTURE_BUILDER.md](docs/ERP_FUTURE_BUILDER.md) | Fastest summary of how to extend the ERP safely |
| [ERP_DEMO_VARIANTS.md](docs/ERP_DEMO_VARIANTS.md) | Demo-ready Lab, Ravikiran, Compute, and full-product presets |
| [ARCHITECTURE_SUMMARY.md](docs/ARCHITECTURE_SUMMARY.md) | Complete UI/CSS/pattern reference |
| [ERP_MODULE_BUILDER.md](docs/ERP_MODULE_BUILDER.md) | Build a module in 15 minutes |
| [MODULE_INTEGRATION.md](docs/MODULE_INTEGRATION.md) | Cross-module connection matrix |
| [SESSION_LOG.md](docs/SESSION_LOG.md) | Three-engine development stats |
| [PHILOSOPHY.md](docs/PHILOSOPHY.md) | Hard/soft attribute contract |
| [WORKFLOW.md](WORKFLOW.md) | Development workflow + machines-first rule |

## Development Model

Three engines work in parallel:
- **LLM** — designs, writes code, orchestrates
- **MacBook Pro** (M1 Pro 32GB) — local crawlers, smoke tests, and aggressive verification load with about 10% headroom reserved for human use
- **Mac Mini** (M4 24GB) — remote crawlers via SSH, production deploy

132,700+ automated checks. Zero server errors. 1-year simulation passed.

## Parallel Agent Pattern

CATALYST now supports a simple finish-later model for parallel agents:

- read-only crawlers explore broadly and write findings to `reports/`
  or `tmp/agent_handoffs/<task-id>/`
- write agents claim tracked files in `CLAIMS.md` and finish bounded
  edit lanes
- sidecar handoff files should record the finding, likely file set, and
  proof command so another agent can pick up the lane later without
  restarting the crawl

This keeps all agents productive at once: some discover, some verify,
some ship.

## License

MIT. Python 3 + Flask 3. No telemetry. No external services.
