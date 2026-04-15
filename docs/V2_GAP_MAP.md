# CATALYST v2.0 Gap Map

_Created 2026-04-13 on `v1.3.0-stable-release`._

This file turns the `v2.0` idea into a shipping board.

`v2.0` is **not** "add more pages." It is the point where:

- the public website,
- the Ravikiran-facing deployment,
- the lab operations portal,
- and the ERP spine

all feel like one product with one identity and one operating model.

The rule for this document is simple: no fantasy features. Every row is
classified from the actual codebase as it exists today.

## 1. What v2.0 must mean

`v2.0` should ship only when all of the following are true:

1. `CATALYST` is the only active product identity across the public
   site, app chrome, docs, demo accounts, and deploy surface.
2. The public website and the app share one design language rather than
   feeling like separate projects.
3. The ERP core is clear: people, work, money, resources, approvals,
   notifications, and audit all use the same primitives.
4. Ravikiran and the lab deployment are both first-class surfaces of the
   same platform, not forks with cosmetic overlap.
5. The release is operationally boring: local crawlers, Mac mini
   verification, smoke, sanity, and deploy discipline are all green.

## 2. Current state from the codebase

The current app is already beyond a scheduler. The module registry in
`app.py` exposes these active ERP-shaped domains:

- instruments
- finance
- receipts
- inbox
- notifications
- attendance
- todos
- letters
- vehicles
- personnel
- admin

That means the `v2.0` question is no longer "can CATALYST become an ERP?"
The code already proves it can. The real question is: **what is still
missing for the product to deserve a major-version identity?**

## 3. Readiness matrix

| Surface | Status | Evidence in repo | Gap to close for v2.0 |
|---|---|---|---|
| Product identity (`CATALYST`) | `mostly shipped` | README, app branding, nav labels already use `CATALYST` | remove remaining naming drift in public-facing copy and deployment/documentation edges |
| Public website / product shell | `partial` | root `index()` route + `portfolio.html` exist | needs a deliberate public-site information architecture, stronger capability storytelling, and shared design tokens with app surfaces |
| Ravikiran deployment layer | `partial` | README names Ravikiran as a live deployment | needs explicit deployment-specific public pages / copy / onboarding instead of README-only representation |
| Lab request workflow | `shipped` | request, queue, calendar, stats, instrument routes are live | main gap is refactor and semantic cleanup, not feature absence |
| Finance portal | `shipped but expanding` | invoices, grants, payments, spend routes/templates exist | vendor registry, invoice PDF export; budget alerts **partial** (pct tier shown on grant detail, notify() wiring deferred) |
| Attendance / leave | `partial` | attendance, leave request, team leave approval routes exist | missing visual leave calendar and broader HR summary surfaces |
| Vehicles / fleet | `partial` | vehicles list/detail/log/edit/archive routes exist | trip logging needs clearer start/end, distance, purpose, and trends/reminders |
| Personnel / payroll | `partial` | personnel list/detail/salary config routes exist | needs tighter payroll + attendance + document-vault integration |
| Inbox + notifications spine | `shipped` | `/inbox`, `/notifications` live | continue unifying cross-module events so every portal uses the same pattern |
| Tasks / letters / receipts | `shipped` | routes + templates exist | mostly polish, consistency, and cross-linking |
| Vendor / procurement | `missing` | no dedicated vendor registry / PO / quote / GRN flow yet | needs a real procurement domain, likely starting inside finance |
| Inventory / consumables | `missing` | no first-class inventory module in registry | needs stock, reorder, issue/consume, supplier linkage |
| REST / integration layer | `missing` | health endpoints exist, but not a true ERP API surface | needs a scoped, documented API for mobile and external systems |
| Structural portability | `partial` | module registry exists, but `app.py` is still monolithic | route/domain extraction or at least helperization required before v2.0 scale |

## 4. What is already strong enough to keep

These should be treated as `v2.0` assets, not rework targets:

- role-aware access model
- audit trail / event chain
- crawler suite and wave discipline
- machine-assisted verification model
- tile / macro UI grammar
- finance and lab workflows already running in production
- notifications and inbox as cross-module surfaces

`v2.0` should preserve these and build on them.

## 5. The real blockers

The biggest blockers are not "we need 20 new features." They are:

### 5.1 Product framing blocker

The public-facing website, Ravikiran presentation, and app interior do
not yet read as one deliberate product system.

For `v2.0`, we need:

- one public homepage story
- one deployment story
- one module overview
- one visual language
- one onboarding path from public site into demo/app

### 5.2 ERP-completeness blocker

Three domains are still below `v2.0` grade:

- vendor/procurement
- inventory/consumables
- operational finance automation (invoice PDFs, budget alerts)

Without those, the app is powerful, but not yet a rounded ERP.

### 5.3 Structural blocker

The crawl shows the codebase is feature-rich but too heavy in a few
places:

- `request_detail()` is oversized
- `instrument_detail()` is oversized
- `user_profile()` is oversized
- several templates are above the crawler budget
- `static/styles.css` is above the architecture budget
- CSS orphan debt is still too high

`v2.0` should not ship on a shape that already feels over-extended.

## 6. Recommended v2.0 release structure

### Phase A — Spine completion

Ship the missing ERP primitives first:

1. vendor management
2. invoice PDF generation
3. budget alerts
4. leave calendar
5. trip logging upgrade
6. inventory / consumables

### Phase B — Surface unification

Unify website and app:

1. rewrite the public homepage as the product shell for CATALYST
2. add a deployment/capability story for Ravikiran and Lab ERP
3. add a first-class module overview page
4. align typography, spacing, palette, and motion across website and app

### Phase C — Structural cleanup

Refactor the code and templates that are currently over budget:

1. split `request_detail()` into helpers
2. split `instrument_detail()`
3. split `user_profile()`
4. reduce `styles.css` and retire orphan selectors
5. remove raw color literals from flagged templates

### Phase D — Release hardening

Before tagging `v2.0`, require:

- local smoke green
- local `wave all` green or known-nonblocking-only
- Mac mini sanity green
- persistent demo data refreshed
- public-site crawl pass complete
- docs and release notes updated

## 7. First six executable waves

These are the best first waves to run on the `v2.0` path.

| wave-id | outcome | why first |
|---|---|---|
| `W2.0.a1` | Vendor registry inside finance | closes the biggest missing finance/procurement gap |
| `W2.0.a2` | Invoice PDF export | turns existing invoices into a complete operational artifact |
| `W2.0.a3` | Budget alerts | makes grants proactive instead of passive |
<!--
W2.0.a3 status (2026-04-16 · claude-imac-erp-a): PARTIAL.
Shipped: `grant_utilization()` helper in app.py, utilization tier
(ok/warn/crit at 80% / 100%) surfaced on `finance_grant_detail.html`
via KPI tone + alert strip. Deferred: notify() on first transition
to warn/crit — needs a `grant_alert_state` dedupe table so we don't
re-notify on every page render. See TODO in finance_grant_detail().
-->

| `W2.0.a4` | Leave calendar | upgrades attendance from records to planning |
| `W2.0.a5` | Fleet trip logging | turns vehicles into a real operations domain |
| `W2.0.b1` | Public website / Ravikiran unification pass | makes the outside of the product match the inside |

## 8. Exit criteria for the tag

Do not tag `v2.0.0` until all of these are true:

- vendor management exists
- invoice PDFs exist
- budget alerts exist
- leave calendar exists
- trip logging is complete enough to capture start, end, distance, and purpose
- inventory direction is either shipped or explicitly cut from the `v2.0.0` promise
- public website and app identity are visually unified
- structural debt is reduced to below the current crawler warning hotspots
- release verification is green locally and on the Mac mini

## 9. Recommended next action

The fastest credible next step is:

1. use this file as the `v2.0` source of truth
2. add the first six `W2.0.*` rows to `docs/NEXT_WAVES.md`
3. start implementation with `W2.0.a1` vendor registry

That path turns `v2.0` from ambition into a sequence of shippable
waves.
