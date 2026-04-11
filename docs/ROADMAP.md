# PRISM roadmap — wave plan after v1.3.5

> **Active plan:** `docs/NEXT_WAVES.md` supersedes the "Wave
> backlog" section of this file as of 2026-04-11 @ `18cef1f`.
> The section below is kept for historical context only — edits
> go in `NEXT_WAVES.md`.

_Anchored on 2026-04-10. Each "wave" is a bounded, crawler-verified
patch that lands on the `v1.3.x` line and keeps the sanity crawler
green end-to-end._

## Current state (v1.3.5)

* Skeleton: tile grids on every page, `.inst-tiles` / `.dash-tiles`
  / `.users-tiles` / `.user-detail-tiles` fluid layouts.
* In-place edit: generic `data-toggle-target` handler in `base.html`,
  used by instrument / user / request metadata tiles.
* Admin UX: `user_detail.html` now carries three tiles — User Metadata,
  Role, Instrument Access — with matrix-style per-lane (admin /
  operator / faculty) checkboxes and category quick-grant buttons.
* Demo data: `siteadmin@lab.local` + `sen@lab.local` (faculty_in_charge)
  seeded so every canonical role persona can be logged in.
* Crawlers: 13 strategies, 8 waves. Sanity wave = 142 pass / 0 fail.

## Wave backlog

### W1.3.4 — dashboard role orientation ✅ SHIPPED (commit 7a4d11c)

* Dashboard + sitemap render a `tile-dash-role-hint` /
  `tile-sitemap-role-hint` badge using `current_role_display` +
  `current_role_hint` from `inject_globals`. One shared badge style
  in `static/styles.css`.

### W1.3.5 — per-role landing crawler ✅ SHIPPED (commit 7a4d11c)

* `crawlers/strategies/role_landing.py` asserts `role-hint-badge` +
  the display name render on `/` and `/sitemap` for every
  `ROLE_PERSONAS` entry — 16 checks in ~1.3s.
* Wired into the `sanity` wave as a hard gate and the `behavioral`
  wave for completeness.
* Harness bootstrap now forces persona roles via `UPDATE` after the
  `INSERT OR IGNORE`, so ROLE_PERSONAS stays authoritative.

### W1.3.6 — instrument groups as first-class entities

* New table `instrument_group(id, name, description)` +
  `instrument_group_member(group_id, instrument_id)`.
* Admin/users assignment matrix gains a "By Group" tab that lists
  each group as a single row with the same three lane checkboxes —
  ticking grants membership to every instrument in that group.
* Migration seeds two starter groups: "Electron Microscopy" and
  "Spectroscopy" from the existing category column.

### W1.3.7 — multi-role users

* Drop the single-role `users.role` column in favour of a
  `user_roles(user_id, role)` junction table.
* `current_user()` returns a frozen set of roles; all existing
  `user["role"]` lookups become `primary_role(user)` (the highest
  privilege role the user holds, used for display + topbar).
* Permission functions (`can_manage_members`, `can_approve_step`,
  etc.) iterate the role set and accept if any single role passes.
* Migration assigns each existing user a single-entry row in the
  new table to keep behaviour identical.

### W1.3.8 — performance + cleanup (partial ✅)

* ✅ `PRAGMA journal_mode = WAL` + `synchronous = NORMAL` pinned in
  both `init_db()` and `get_db()` so every connection PRISM opens
  is born in WAL.
* ✅ `crawlers/strategies/slow_queries.py` monkey-patches
  `query_all` / `query_one` / `execute`, times every SQL call, and
  flags distinct fingerprints over 50ms (warn) or 250ms (fail).
  Baseline: 37 distinct queries across 5 hot routes, 0 over budget.
* ⏳ CSS fossil retirement — still pending (~229 orphans in the
  allowlist). Requires a careful grep-and-delete pass per prefix.

### W1.4.0 — stable release

* Lock the sanity wave as the pre-push CI gate on the Mac mini.
* Ship a `make seed-operational` target that bootstraps an empty
  operational DB with a single super_admin read from env vars.
* Publish the `HANDOVER.md` section on "first-time Mac mini
  bootstrap" as the README quickstart.

## Crawler waves at a glance

| wave         | purpose                                  | fail on                |
|--------------|------------------------------------------|------------------------|
| `sanity`     | smoke + visibility + contrast_audit      | any failure            |
| `static`     | css_orphan + dead_link + philosophy      | threshold breach       |
| `behavioral` | role_behavior + random_walk              | crash / 500            |
| `lifecycle`  | lifecycle (full request happy path)      | state-machine break    |
| `coverage`   | architecture + performance               | handler-size regression|
| `accessibility` | contrast_audit (full)                 | WCAG AA miss           |
| `cleanup`    | css_orphan + dead_link with auto-trim    | warn only              |
| `landing`    | (new) per-role landing content markers   | warn only              |
| `all`        | everything in order                      | any failure            |

## Guardrails

* Every wave must stay under 30 seconds end-to-end on the MacBook.
* Every patch must land a crawler proof in the commit message.
* Every new tile must carry a `data-vis="{{ V }}"` attribute and use
  a `.tile-*` class so the philosophy crawler accepts it.
