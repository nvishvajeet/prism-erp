# CATALYST Demo Variants

> Ready-to-run demo presets for each major ERP surface we currently
> present: lab, Ravikiran operations, and compute.

## Why this file exists

When we say "demo-ready", we should mean more than "the app boots".
Each demo variant should have:

- a clear module bundle
- a recognizable story
- seeded data that makes the pages feel alive
- one obvious login/demo path
- one short explanation of what the viewer should try first

This file is the shortcut for that.

## Variant 1 — Lab ERP

**Audience:** shared instrumentation labs, research facilities, CRFs

**Preset**

```bash
CATALYST_MODULES=instruments,finance,inbox,notifications,attendance,queue,calendar,stats,admin
```

**What the demo should prove**

- request submission and approval flow
- operator queue and scheduling
- grant-linked finance behavior
- role-scoped request visibility
- audit and attachments working together

**Best first-click journey**

1. log in as requester
2. view submitted request
3. switch to approver/admin
4. move the request through approval and queue surfaces

## Variant 2 — Ravikiran Operations ERP

**Audience:** service businesses, hospitality, operations teams

**Preset**

```bash
CATALYST_MODULES=finance,personnel,vehicles,attendance,receipts,todos,inbox,notifications,admin
```

**What the demo should prove**

- staff and payroll structure
- vehicle and driver linkage
- receipt-to-finance flow
- task/inbox coordination
- attendance feeding operations reality

**Best first-click journey**

1. open personnel
2. inspect a vehicle-linked staff profile
3. view receipts and finance surfaces
4. open tasks/inbox to show day-to-day coordination

## Variant 3 — Compute ERP

**Audience:** HPC labs, technical facilities, compute clusters

**Preset**

```bash
CATALYST_MODULES=compute,notifications,inbox,admin
```

**What the demo should prove**

- software catalog
- job submission
- queue ordering
- job detail, logs, and output flow
- worker-backed execution contract

**Best first-click journey**

1. open compute dashboard
2. submit a job
3. inspect queue ordering
4. open a finished or needs-attention job

## Variant 4 — Full Product Demo

**Audience:** product overview, sales/demo, internal validation

**Preset**

```bash
CATALYST_MODULES=instruments,finance,receipts,inbox,notifications,attendance,todos,letters,queue,calendar,stats,vehicles,personnel,compute,admin
```

**What the demo should prove**

- one codebase, many ERP shapes
- cross-module integrations
- shared nav / role / notification system
- CATALYST as product platform, not one vertical app

## How to keep a demo variant ready

For every demo variant, keep these true:

1. at least one page should have meaningful seeded rows
2. the landing page should make the module bundle legible
3. the role-switch or login path should be obvious
4. the first interaction should not dead-end into an empty state
5. smoke should pass on the same preset

## Demo design rules that helped the first site

These rules are what made the first working site fast to build, and
they still scale:

1. one spine, many variants
2. one design language across public shell and app interior
3. one data owner per workflow
4. one route should tell one story, not five
5. one page should have a small number of strong tiles
6. one obvious first action per demo
7. one smoke-safe flow before polish

## Next demo-ready upgrades

The best next upgrades for all variants are:

- a small demo reset command per variant
- one dashboard tile that explains the current variant
- one seeded walkthrough record for each major module bundle
- one crawler recipe per variant
