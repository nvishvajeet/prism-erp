# CATALYST Build Acceleration Playbook

> The shortest repeatable path from "new ERP/module idea" to a stable
> first ship, without re-crawling the whole repo.

This playbook is for builders who already know the basic CATALYST
surfaces and want the *fastest safe execution order*.

Read this after:

1. `WORKFLOW.md`
2. `docs/PARALLEL.md`
3. `docs/ERP_MODULE_BUILDER.md`

## What "fast" means in CATALYST

Fast does **not** mean "touch fewer files at any cost."

Fast means:

1. choose a shape that already exists
2. make the first version believable
3. wire only the first integration that proves value
4. leave the rest as explicit sidecar follow-up
5. keep smoke and sanity green while parallel agents continue moving

That is how CATALYST gets to a working ERP quickly without becoming
harder to extend on the next wave.

## The 15-minute module path

If the request is "add one real module," the default sequence is:

1. Create the schema in `init_db()`
2. Add access flags in `user_access_profile()`
3. Add one list route or one detail route
4. Add one template with 2-4 tiles
5. Add one nav hook only if the route is actually user-facing
6. Add `log_action(...)` for every write path
7. Add only one integration from the list below
8. Run `./venv/bin/python scripts/smoke_test.py`
9. Run `./venv/bin/python -m crawlers wave sanity`

That is enough for a stable `M1`.

## The 5 ERP shapes

Most new work in this repo is one of five shapes. Pick the shape first.

### 1. Registry

Use when the entity is mostly "rows with ownership and status."

Examples:
- vendors
- vehicles
- users
- instruments

Build:
- one list page
- one create/edit path
- one detail page only if the record has meaningful history

### 2. Workflow Queue

Use when something moves through states and handoffs.

Examples:
- sample requests
- approvals
- AI prospective actions
- leave review

Build:
- queue/list page
- detail page with state history
- status badges
- notifications on state transitions

### 3. Finance Ledger

Use when the main truth is money, payment, billing, or approval.

Examples:
- receipts
- invoices
- payments
- budget alerts

Build:
- totals tile
- list tile
- one write flow
- one approval step if required

### 4. Personnel Surface

Use when the main truth is a person, manager line, or role-dependent
action surface.

Examples:
- onboarding
- attendance views
- salary config
- complaints

Build:
- person-linked rows
- role-gated actions
- manager/admin routing

### 5. Operational Asset

Use when the thing is a machine, device, or physical resource.

Examples:
- instruments
- compute software/jobs
- vehicles

Build:
- registry/detail
- status + assignment
- operational log
- one notification hook

## The 3 integration tiers

Do not wire every module to every other module on day one. Use tiers.

### Tier 1 — required for the first believable ship

Add only these:

1. access gating
2. audit logging
3. one status/notification hook if the record changes hands

### Tier 2 — first ERP-aware integration

Add whichever one actually proves the module belongs in the ERP:

1. finance roll-up
2. dashboard tile
3. person/profile link
4. calendar/deadline view

Choose one, not all four.

### Tier 3 — polish / phase two

Leave these for later unless the roadmap says otherwise:

1. exports
2. analytics
3. secondary dashboards
4. advanced filters
5. AI/admin automation layers

## The sidecar rule

If you discover follow-up work while building, do not silently expand
the lane. Create a sidecar handoff.

Use:

- `tmp/agent_handoffs/<task-id>/handoff.md` for finish-later work
- `reports/` for crawl proofs or machine-generated evidence

Every sidecar should say:

1. what was inspected
2. what was not shipped
3. why it was deferred
4. the smallest next write scope
5. the proof command that should be rerun

This is the main trick that lets parallel agents move fast without
duplicate investigation.

## The 30-minute ERP variant path

If the request is "spin up a new ERP variant" rather than "add a module,"
the shortest safe sequence is:

1. pick the smallest module bundle in `docs/ERP_COMPOSITION.md`
2. pick the initial users/roles
3. seed only enough demo or live rows to make the path believable
4. verify portal boundaries and nav visibility
5. verify login + first action + one proof flow

For a new ERP variant, the first ship is good when:

1. the landing/login path is obvious
2. one real role can do one real job
3. the enabled modules feel coherent together
4. there is no cross-portal data bleed

## The "do not overbuild" checklist

Pause if any of these are happening:

1. you are designing exports before CRUD works
2. you are adding three new routes for one first workflow
3. you are adding CSS for one page that should be a tile variation
4. you are introducing a second source of truth for an existing record
5. you are touching more than one integration tier in the same lane

When that happens, cut scope and ship the smaller layer first.

## The fastest proof stack

Pick the smallest proof that matches the change.

### Module-only changes

Run:

```bash
./venv/bin/python scripts/smoke_test.py
```

### Structural/template changes

Run:

```bash
./venv/bin/python -m crawlers wave sanity
```

### Deep portal/routing changes

Run:

```bash
./venv/bin/python -m crawlers wave roleplay
./venv/bin/python -m crawlers wave sanity
```

### Release-adjacent confidence

Run locally plus mini:

```bash
./venv/bin/python scripts/cluster_wave.py cluster
```

## The highest-ROI refactors for future speed

If there is time left after shipping, these changes make the next build
faster than the current one:

1. move repeated template structures into macros
2. split giant route helpers into read-model builders and write handlers
3. replace inline style or old class drift with shared tile grammar
4. add one crawler for a bug class that just bit the team
5. update the builder docs immediately after the code lands

## Which doc to update after you ship

Update only the docs that actually changed meaning:

| If you changed... | Update... |
|---|---|
| reusable module pattern | `docs/ERP_MODULE_BUILDER.md` |
| cross-module wiring | `docs/MODULE_INTEGRATION.md` |
| fastest future builder path | `docs/ERP_FUTURE_BUILDER.md` |
| parallel delivery process | `docs/PARALLEL.md` |
| roadmap priority / next lane | `docs/NEXT_WAVES.md` |

## Final decision rule

If you have two possible next moves, choose the one that:

1. reuses more existing structure
2. touches fewer ownership boundaries
3. proves a real workflow sooner
4. leaves a cleaner sidecar for later agents

That is the path that keeps CATALYST fast to build *and* fast to extend.
