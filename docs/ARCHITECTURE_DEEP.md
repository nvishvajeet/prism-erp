# CATALYST architecture — deep reference

*Current as of commit `557f771` on `v1.3.0-stable-release` (2026-04-14).*

A single-file Flask ERP shaped like an operating system: one process,
one SQLite file, one CSS budget, one crawler suite. This doc captures
the load-bearing pieces agents need before touching code.

---

## 1. Shape of the codebase

| Surface | Size | Role |
|---|---|---|
| `app.py` | 25,957 lines, ~245 routes, ~613 functions | Everything server-side |
| `templates/` | 138 Jinja2 files | All HTML |
| `static/styles.css` | 10,073 lines | Single stylesheet, light + dark |
| `crawlers/` | ~25 strategies, 5 waves | The test suite |

One-file discipline is deliberate. Agents read a single file to know
the whole app. New modules go inside `app.py` — they don't get their
own Python package — because the value of "one file, any organization"
outweighs the inconvenience of a big file.

---

## 2. Two portals, one process

`ERP_PORTALS` in `app.py` registers portal instances (`lab`, `hq`).
Every login belongs to a portal via `erp_user_portals`. A user with
rows for both portals can hop between them; a user with rows for only
one is auto-redirected to that portal on `/portals`.

- **`portal_text(default, *, lab=...)`** — Jinja global. Swaps strings
  per portal without forking templates. Bound in `app.jinja_env.globals`
  so partials that render outside the request context still resolve it.
- **`portal_route_enabled(module_slug)`** — gates a route to the portals
  whose `MODULE_REGISTRY[slug]["portals"]` list includes the current
  portal. 404 for portals that don't host the module.
- **`lab_portal_active(portal_slug=None)`** — resolves the portal of the
  current request; used anywhere the branch needs an explicit guard
  (email subject copy, dashboard copy, landing-page chips).

Portal slug lives in the session. Never trust `request.host` for portal
identity — Cloudflare Tunnel proxies both to the same origin.

---

## 3. Modules and nav

`MODULE_REGISTRY` (app.py:221) is the source of truth. Each entry
declares:

- `slug`, `label`, `label_lab` — display text, with lab-portal override
- `nav_order` — sort key; 0 hides from nav entirely
- `portals` — which portals expose this module
- `route_prefixes` — which `request.path` prefixes count as "in" the
  module for breadcrumb/active-state purposes
- `roles` — defaults, overridable by `/admin/modules`

HQ nav order (Nikita's 2026-04-14 spec, landed in `6bd4842`):

```
Home(1) · Finance(2) · Payments(3) · Attendance(4) · Fleet(5)
· Personnel(6) · Inbox(7) · Notifications(8) · Tasks(9)
· Compute(11) · Mess(12) · Tuck Shop(13)
```

Lab nav is computed separately via `portals=["lab", …]` membership.

---

## 4. Data model — ~80 tables

All schema defined inline in `app.py` via `CREATE TABLE IF NOT EXISTS`.
No ORM, no migrations file — schema changes land as additive SQL in
`init_db()` and `_ensure_column()` helpers that add columns when missing.

Backbone tables:

| Domain | Tables |
|---|---|
| **Identity** | users, user_roles, archived_users, erp_portals, erp_user_portals |
| **Instruments** | instruments, instrument_admins, instrument_operators, instrument_requesters, instrument_faculty_admins, instrument_maintenance, instrument_downtime, instrument_approval_config, instrument_custom_fields, instrument_group, instrument_group_member, instrument_inventory, instrument_email_templates |
| **Requests/queue** | sample_requests, approval_steps, audit_logs, request_attachments, request_messages, request_issues, request_custom_field_values |
| **Finance** | grants, projects, invoices, payments, grant_allocations, grant_expenses, grant_members, budget_rules, companies, vendors, purchase_orders, bank_statements, bank_statement_entries, audit_records, audit_signoffs |
| **People ops** | attendance, leave_requests, leave_balances, reporting_structure, salary_config, salary_payments, complaints |
| **Messaging** | messages, message_attachments, mailing_lists, mailing_list_members, notices, notice_reads, announcements, email_queue, system_notifications |
| **Vehicles + receipts** | vehicles, vehicle_logs, expense_receipts, receipt_submissions, qr_scan_log |
| **Letters + todos** | letters, user_todos |
| **Mess/Tuck shop** | mess_students, mess_entries, mess_prep_log, tuck_shop_items, tuck_shop_sales, tuck_shop_sale_items, tuck_shop_tokens |
| **Compute** | compute_jobs, software_catalog, job_input_files, job_output_files, command_queue |
| **AI + ops** | ai_advisor_queue, ai_pane_log, generated_exports, physical_files, system_settings |

`row_value(row, key, default=None)` is the shim that handles both
`sqlite3.Row` and dict rows — always use it when reading from the DB.

---

## 5. Auth + CSRF

- **Auth:** session cookie only. `login_required` decorator (app.py:3870).
  `current_user()` pulls the row from `users` based on session user_id.
  `must_change_password=1` short-circuits everything except
  `/profile/change-password` + `/logout`.
- **Roles:** `users.role` is the primary, plus `user_roles` junction for
  multi-role. `has_role()` reads both. `role_required(*roles)` decorator
  for endpoint gating.
- **Owner:** emails in `OWNER_EMAILS` env var. `is_owner(user)` is the
  universal bypass — owners pass every `can_*` check.
- **CSRF:** enforced when `LAB_SCHEDULER_CSRF=1`. Tokens rendered via
  `{{ csrf_token() }}` in every form. Crawlers set the flag to 0 so
  their test client stays form-friendly.
- **Portal gating:** `portal_route_enabled(slug)` 404s when the route's
  module isn't exposed in the current portal.

---

## 6. Approval chain + state machine

Sample requests move through a state machine powered by two tables:
`sample_requests.status` and the ordered rows in `approval_steps`.

Lifecycle (happy path):

```
submitted
  → under_review           (chain created, approvals pending)
  → awaiting_sample_submission  (all approval_steps approved)
  → sample_submitted       (requester: action=mark_sample_submitted)
  → sample_received        (operator: mark received)
  → scheduled              (operator books a planner slot)
  → in_progress
  → completed              (operator: finish_now, then results ack)
```

`build_request_status(db, request_id)` at app.py:1007 is the authority
— it reads the steps + request row and returns the canonical next
status. Handlers that mutate state call it, then
`assert_status_transition(old, new)` gates bad jumps.

**Chain creation** (`create_approval_chain`, app.py:1806):

1. Look up `instrument_approval_config` for the instrument. If set,
   each config row seeds one step, optionally pinning a specific
   `approver_user_id`.
2. Otherwise seed the default 3-step chain:
   `finance → professor → operator`.
3. For any step without an explicit approver, call
   `_default_user_for_approval_role()`, which picks from the eligible
   pool via `_load_balance_pick()` — round-robins by pending workload
   + last-acted-at, so requests don't pile on one person.

**Approval (`action=approve_step`, app.py:13449)** checks in order:

1. The step must be `pending` (no double-approvals).
2. `can_approve_step(user, step, instrument_id)` — owner/super_admin
   bypass, explicit assignee match, or role-based fallback
   (finance→finance_admin, professor→professor_approver or higher,
   operator→can_operate_instrument).
3. `approval_step_is_actionable(step, all_steps)` — every earlier
   step must be `approved`.

Rejection at any step flips the whole request to `rejected`. Two-stage
approval (Prashant categorises, then Pournima approves) is encoded via
`approval_stage` enum on the step.

---

## 7. Finance + payments flow

Two loosely-coupled halves:

- **Grants side** — grants, projects, invoices, payments,
  grant_expenses, grant_allocations. Sample requests auto-charge to
  the instrument's default grant on completion. Budget rules enforce
  caps. `/finance` dashboard unifies spend across grants, receipts,
  and payroll.
- **Payments side** — purchase_orders, vendors, companies. Two-stage
  approval: Prashant categorises → Pournima approves (encoded in
  purchase_orders.approval_stage). Receipt + audit trail via
  `receipt_submissions` and `audit_records`/`audit_signoffs`.

`/payments` aggregates: total orders, pending approvals, approved,
total paid, this-month spend, and (since 557f771) monthly salary total
from `salary_config`. Actual payroll payouts happen on
`/personnel/payroll`, which pulls from `attendance` to pro-rate.

---

## 8. AI action queue

Framed in README §"AI Action Queue" and §"For AI Agents". The runtime
surface:

- **Intake:** home-page Catalyst Assistant parses requests into
  structured drafts. Never deletes or silently drops.
- **Queue table:** `ai_advisor_queue` — every AI-routed item lands
  here with flair (`AI Draft`, `Needs Review`, etc.) and status
  (`Queued`, `Under Review`, `Approved`, `Rejected`, `Executed`).
- **Three gates:** `can_request`, `can_target`, `can_execute` — every
  item passes through all three before going live.
- **Audit:** every transition logs to `ai_pane_log` with actor + reason.
- **6-hour review:** `scripts/queue_review.py` wraps
  `app.review_operational_queues(scheduled-6h)`. Called by a scheduled
  task; writes `logs/queue_review_latest.md` summarising top themes
  and routing suggestions.

AI is intake + routing only. Every data change still needs a human
approval touch.

---

## 9. Crawler system

Under `crawlers/`. Three layers:

- **`base.py`** — `CrawlerStrategy` abstract + `CrawlResult` accumulator.
- **`harness.py`** — Flask test client + temp SQLite DB seeded with
  `ROLE_PERSONAS` + `SEED_INSTRUMENTS`. Each strategy runs in-process
  against a fresh temp DB.
- **`strategies/`** — 25 concrete strategies. Register themselves via
  `StrategyName.register()` at module import. `__init__.py` imports
  every strategy file so registration happens automatically.

Waves (defined in `waves.py`):

- **`smoke`** — 33 assertions, ~3s. Pre-commit gate.
- **`sanity`** — ~11 strategies, ~20s. Frequent dev loop.
- **`static`** / **`behavioral`** — targeted suites.
- **`all`** — every strategy, ~15 min. Full release gate.

Notable strategies:

- `visibility` — role × page matrix, 84 checks
- `lifecycle` — end-to-end request journey (submit → complete)
- `dead_link` — harvest every internal `href` across 4 roles, 7,668
  checks. After 3f55da3 the href regex uses a negative lookbehind so
  `data-href` placeholders in JS comments no longer poison the
  frontier.
- `approver_pools` — asserts `create_approval_chain()`'s load-balance
  actually round-robins across the operator pool
- `contrast_audit` — WCAG contrast on every palette combination
- `architecture` / `philosophy` — static scans enforcing handler size,
  template size, decorator coverage, data-vis coverage, tile grid use

Smoke gate runs on every push via the pre-receive hook on
`~/.claude/git-server/lab-scheduler.git` (see §11).

---

## 10. UI primitives

Six classes in `static/styles.css`:

| Primitive | CSS root | Purpose |
|---|---|---|
| **App** | `body`, `.app-shell` | Topbar + portal frame |
| **Tile** | `.tile`, `.tile-full-width`, `.tile-span-3` | Card grid cell |
| **Widget** | `.widget-*` | In-tile compositions (tables, forms) |
| **Button** | `.btn`, `.btn-primary`, `.small-button` | Actions |
| **Badge** | `.badge`, `.status-*`, `.tone-*` | Inline state |
| **Background** | `body[data-theme=light|dark]` | Light + dark theming |

Layout is iOS tile grid: tiles snap into a 3- or 4-column grid with
`tile-full-width` / `tile-span-N` modifiers. Responsive breakpoints
480 / 760 / 1200.

Every element carries `data-vis="{{ V }}"` so the `visibility`
crawler can verify role-gating at static-scan time. New templates
must add this; `philosophy` crawler enforces it.

Clickable rows use `tr.clickable-row[data-href]`, wired once in
base.html via an event-delegated handler (app.py-agnostic). Inline
controls within a clickable row escape via `.no-row-nav`.

---

## 11. Deploy + ops

**Working copy:** `~/Documents/Scheduler/Main/` (moved out of Dropbox
2026-04-11).

**Git topology (two-level):**

1. Every push goes to `origin` = `~/.claude/git-server/lab-scheduler.git`
   (LOCAL bare). Pre-receive hook runs smoke; 0 exit required for accept.
2. That bare's post-receive hook force-mirrors to
   `catalyst-mini:~/git/lab-scheduler.git` — the Mac mini that actually
   runs CATALYST on `catalysterp.org`.

**Serving:** gunicorn daemon, master pid 34651, 4 workers, SSL-terminated
via cert.pem/key.pem on `127.0.0.1:5056`. Cloudflare Tunnel maps
`catalysterp.org` → that port. Workers reload via `kill -HUP <master>`
(or the `catalyst` CLI's `update` verb).

**Demo instances:**

- `:5055` Main, `:5057` Demo-Beta, `:5058` Demo-Alpha — separate
  gunicorns pointing at parallel working copies.

**Logs:** `logs/server-live.log` (access + error combined),
`logs/debug_feedback.md` (user-submitted feedback via the widget),
`logs/queue_review_latest.md` (AI action-queue review output).

---

## 12. Release discipline

`v1.3.0-stable-release` is the current release branch. The smoke gate
is mandatory on this branch — it's enforced at both levels:

1. Local pre-commit (`.venv/bin/python scripts/smoke_test.py`).
2. Pre-receive hook on the LOCAL bare.

Commit rhythm: one commit per meaningful unit of work, push immediately.
Never leave a dirty tree across sessions. Never force-push or rewrite
history on this branch.

When a fix lands that touches `app.py`, always `kill -HUP 34651` after
the push so the live site picks up the change. Verify with
`curl -sk https://127.0.0.1:5056/login` returning 200.

---

## 13. Where to look next

- `AGENTS.md` — vendor-neutral onboarding
- `WORKFLOW.md` — machine-first rules, hard/soft attribute contract
- `docs/ERP_FUTURE_BUILDER.md` — shortest mental model for extension
- `docs/MODULE_INTEGRATION.md` — cross-module wiring matrix
- `docs/ERP_DEMO_VARIANTS.md` — demo-ready preset bundles
- `crawlers/harness.py` — everything the test harness knows about seeds

This doc stays honest by commit:
`557f771` — added Salary KPI on /payments.
`14a5ead` — fixed lifecycle crawler approver-pin.
`3f55da3` — fixed dead_link `data-href` false positive.
`d8664c8` — restored back button on instrument form-control page.
`e848287` — module-level `import re` unblocks POST /feedback.
`6bd4842` — feedback close-button fix + HQ nav reorder + 6h queue review.
