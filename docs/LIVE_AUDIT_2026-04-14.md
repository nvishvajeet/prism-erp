# CATALYST Live Audit — 2026-04-14

## Scope

This audit was run on `v1.3.0-stable-release` after the stable hardening
and preference-cookie shipment. The goal was to:

- deep-crawl the current ERP surfaces
- verify major role paths still render cleanly
- sanity-check the live operational database shape
- write down the current feature surface and the next practical build plan

## Current Live Product Surface

CATALYST currently operates as a two-portal ERP:

- `lab` — Lab R&D
- `hq` — Ravikiran Group HQ

Current module registry surface:

- Instruments
- Finance
- Receipts
- Inbox
- Notifications
- Attendance
- Tasks
- Letters
- Queue
- Calendar
- Stats
- Fleet
- Personnel
- Payments
- Mess
- QR Kiosk
- Tuck Shop
- Compute
- Admin

## Current Live Role Surface

Operational DB snapshot at audit time:

- active users: 23
- active roles present:
  - `finance_admin`: 1
  - `instrument_admin`: 1
  - `member`: 6
  - `operator`: 7
  - `owner`: 2
  - `professor_approver`: 3
  - `super_admin`: 2

Operational domain counts at audit time:

- sample requests: 10
- active instruments: 21
- grants: 4
- vehicles: 2
- vendors: 5
- messages: 0
- notices: 0
- letters: 0
- compute jobs: 0
- receipts: 0

## Live Data Verification

The operational database contains real active admin identities, including:

- `dean.rnd@mitwpu.edu.in` (`super_admin`)
- `dean@catalyst.local` (`super_admin`)

Non-destructive operational-mode route probes as the dean user returned `200`
for all of the following:

- `/`
- `/sitemap`
- `/finance`
- `/admin/users`
- `/notifications`
- `/inbox`
- `/attendance`
- `/vehicles`
- `/compute`
- `/letters`

This confirms the live route shell and the current operational schema are
coherent for the highest-privilege operational user.

## Crawl Results

### Local sanity wave

Passed:

- smoke
- visibility
- role landing
- topbar badges
- empty states
- dev panel readability
- XHR contracts
- contrast audit
- AGENTS.md contract
- parallel claims
- deploy smoke

### Mini sanity wave

The same sanity wave passed on the Mac mini mirror as well.

### Full wave

The full wave was mostly green:

- smoke: pass
- visibility: pass
- role_landing: pass
- contrast_audit: pass
- architecture: pass with warnings
- philosophy: pass with warnings
- css_orphan: pass
- role_behavior: pass
- approver_pools: pass
- dead_link: pass
- performance: pass
- random_walk: pass
- color_improvement: pass
- cleanup: pass with warnings

One wave remains red:

- `lifecycle`: 3 failures

Recorded failure details:

- finance approval: `403`
- professor approval: `403`
- operator approval: `403`

Interpretation:

- this is currently a crawler-level release-audit issue, not a confirmed live-site
  outage
- the live operational dean probe is healthy
- the failure needs a focused follow-up because it affects confidence in the
  end-to-end demo lifecycle gate

## Important Findings

### 1. Live route shell is healthy

The live shell, key admin modules, and major portal surfaces rendered correctly
on the operational database during the dean probe.

### 2. Temporary-password gate is working

The operational `instrument_admin` probe redirected to
`/profile/change-password`. This is expected because that account currently has
`must_change_password = 1`.

### 3. Owner identity is email-driven, not role-label-driven

One operational user with literal role `owner` did not receive the same access
surface as the configured owner email identities. This is because top-level
owner power is keyed off `OWNER_EMAILS`, not the string value `users.role =
'owner'`.

This is not changed in this audit because it is a policy-sensitive permission
decision, not a cosmetic fix.

### 4. Operational schema is real but still sparse in newer modules

Several newer modules exist in code and route surface but are still sparse or
not yet populated in the operational DB. That is fine for launch posture, but
it means future release crawls should distinguish:

- route health
- schema existence
- meaningful live data occupancy

## Current Feature Summary

### Lab ERP

- request intake and queue management
- multi-step approvals
- instrument roster and detail pages
- calendar and stats
- grants and finance read surfaces
- inbox and notifications
- receipts and letters
- compute portal

### HQ ERP

- vehicles / fleet
- personnel
- attendance
- tuck shop
- mess
- vendor / payment-adjacent surfaces

### Cross-cutting

- role manuals
- portal picker
- dev panel
- audit logging
- non-tracking preference cookies for smoother UI

## Future Plan

### Immediate release-hardening

1. Fix the lifecycle crawler so full-wave release gates reflect the current app
   truth again.
2. Add an operational-mode crawler/profile pass that probes real schema shape
   without mutating production data.
3. Decide whether `owner` should remain email-authoritative or also become a
   first-class privileged role label.

### Near-term product gains

1. Vendor management completion:
   registry, payment history, and cross-links from finance.
2. Invoice PDF generation:
   operator/admin-friendly export from finance.
3. Budget alerts:
   80% / 100% grant utilization notifications.
4. Leave calendar:
   unify attendance and leave visibility into a clearer staff view.
5. Vehicle trip logging:
   complete the live fleet loop from asset to movement history.

### Build-system simplification

1. Separate crawler expectations from live operational expectations.
2. Keep portal/module coverage documented from the module registry, not by
   hand-maintained memory.
3. Add one release-audit doc per major hardening pass so the team can compare
   drift over time.

## Ship Recommendation

As of this audit:

- stable smoke is green
- local and mini sanity waves are green
- live dean/admin probe is green
- the main unresolved issue is the red `lifecycle` crawler path

Recommendation:

- acceptable to continue shipping stable updates to the live lane
- do a focused follow-up on the lifecycle crawler before using `wave all` as a
  hard release gate
