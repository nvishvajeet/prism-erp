# CATALYST ERP Future Builder Guide

> The shortest mental model for building the next ERP module without
> re-reading the whole codebase.

## What CATALYST really is

CATALYST is one operational spine with interchangeable domain modules.
You do not build a new ERP by inventing a new architecture. You build it
by reusing the same five layers:

1. **State** — SQLite tables in `app.py:init_db()`
2. **Logic** — Flask routes + helpers in `app.py`
3. **Visibility** — role checks + `module_enabled(...)`
4. **UI** — Jinja tiles, macros, and `static/styles.css`
5. **Proof** — smoke test + crawler coverage

If a change does not fit one of these layers, it is probably too fancy.

## The future-safe rule

When adding a module, prefer these moves in order:

1. Reuse an existing helper
2. Reuse an existing page macro
3. Reuse an existing table pattern
4. Reuse an existing crawler pattern
5. Only then add something new

This keeps the ERP easier to extend because every module feels like a
variation of the same system, not a separate product.

## The golden path for a new module

If you want a new domain such as vendors, budgets, trips, or leave
calendar, the default path is:

1. Add the table(s) in `init_db()`
2. Add access flags in `user_access_profile()`
3. Add one list route and, if needed, one detail route
4. Add one template with 2-4 tiles, not 12
5. Add one nav link gated by `module_enabled(...)`
6. Add only the most obvious integration hooks
7. Run smoke, then add deeper integrations later

That is enough for v1. The module does not need every possible view on
day one.

## The minimum viable module contract

A module is considered real when it has all of this:

- a schema owner
- at least one route
- at least one page in the nav
- role gating
- audit logging for writes
- smoke-safe behavior

Everything else is optional for the first commit.

## The module maturity ladder

Use this ladder to keep scope under control:

| Level | What it means | Example |
|---|---|---|
| `M0` | Schema only | table exists, no UI yet |
| `M1` | Usable CRUD | list + create/edit + audit trail |
| `M2` | ERP-aware | notifications, dashboard or finance/calendar integration |
| `M3` | Polished | exports, richer analytics, dedicated crawler assertions |

Most new modules should ship as `M1` first, then grow to `M2`.

## How to decide where a new feature belongs

Ask these four questions:

1. What table owns the truth?
2. Which role is allowed to change it?
3. Which existing module should see it?
4. Which one proof step will catch regression?

If you cannot answer those four quickly, the feature is still too vague.

## The seven files you usually touch

Most modules can be shipped by touching only these surfaces:

1. `app.py` — schema, access flags, routes, helpers
2. `templates/<module>.html`
3. `templates/base.html` — nav
4. `static/styles.css` — light module-specific layout only
5. `docs/ERP_MODULE_BUILDER.md` — if you introduced a new reusable pattern
6. `docs/MODULE_INTEGRATION.md` — if the module talks to another one
7. `CLAIMS.md` — claim and release the lane

If your design needs many more files than this, pause and simplify.

## Integration priorities

Do not wire everything at once. Add integrations in this order:

1. **Role visibility** — who can see and act
2. **Finance** — if the module creates spend, revenue, or budgets
3. **Notifications** — if the module has state transitions
4. **Calendar** — if the module has dates, bookings, deadlines
5. **Dashboard** — if the module has a useful summary KPI

This order keeps the ERP coherent without turning every module into a
multi-week project.

## Recommended build shapes

Use these standard shapes instead of inventing a new page model:

| Need | Recommended shape |
|---|---|
| Registry | list tile + create form tile + detail page |
| Workflow | queue tile + status badge + timeline/activity tile |
| Finance-linked records | list tile + totals tile + detail tile |
| People-linked records | registry tile + person chips + profile links |
| Date-heavy records | list tile + calendar hook + reminders later |

## Examples

### Vendor management

- State: `vendors`, `vendor_payments`, maybe `vendor_rate_cards`
- UI shape: registry + detail + payment history tiles
- First integrations: finance
- Later integrations: notifications, dashboard

### Budget alerts

- State: probably reads existing grant tables first
- UI shape: summary tile + alert history tile
- First integrations: finance + notifications
- Later integrations: dashboard

### Leave calendar

- State: likely extends attendance/leave truth, not a separate universe
- UI shape: calendar view + approval list + staff chips
- First integrations: attendance + notifications
- Later integrations: dashboard

## Anti-patterns to avoid

- Do not create a new framework inside the repo
- Do not make a module depend on five other modules for v1
- Do not start with exports, charts, and filters before basic CRUD works
- Do not add a new visual language for one module
- Do not skip audit logging on writes
- Do not block the first ship waiting for every integration

## Current corners cut in the existing ERP

These are the places where the current system works, but future builders
should resist copying the shape directly:

- giant route hubs such as `request_detail()` and `instrument_detail()`
- giant shared schema growth inside `init_db()`
- page-specific CSS expansions instead of reusing a tighter tile grammar
- repeated edit-toggle tile scaffolding in templates instead of shared
  macros

Treat those as refactor targets, not best-practice templates.

## Fastest improvements that still help future builds

If you want to improve the ERP for the next builder, the highest-ROI
changes are usually:

1. extract a helper from a giant route
2. convert repeated template structure into a macro
3. replace raw color or inline style drift with shared CSS variables
4. add one crawler affordance or operator-facing command shortcut
5. update the summary docs right after the code changes land

That combination keeps the code and the builder story aligned.

## The fastest way to pick the next build

If the roadmap gives several choices, prefer the module that:

1. Reuses existing tables or helpers
2. Solves a real operational gap
3. Needs the fewest new routes
4. Strengthens the ERP spine for future modules

That is why finance-adjacent and attendance-adjacent modules usually
have the highest ROI.

## Before you commit

Check this list:

- Did I keep the data owner clear?
- Did I reuse existing macros and tile patterns?
- Did I gate routes and nav correctly?
- Did I log every write?
- Did I run `./venv/bin/python scripts/smoke_test.py`?
- Did I remove my claim row?

If yes, the module is ready to ship and future agents will still be able
to understand it quickly.
