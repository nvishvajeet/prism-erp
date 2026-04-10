# PRISM roadmap — wave plan after v1.3.3

_Anchored on 2026-04-10. Each "wave" is a bounded, crawler-verified
patch that lands on the `v1.3.x` line and keeps the sanity crawler
green end-to-end._

## Current state (v1.3.3)

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

### W1.3.4 — dashboard role orientation (1-hour patch)

* Use `current_role_display` + `current_role_hint` from the context
  processor to render a single-line "You are viewing as X — do Y"
  intro above the dashboard tiles.
* Add the same hint to the `/sitemap` page so new users land with a
  clear orientation.
* Trim the Member Admin "Create / Invite" tile with an explicit
  "next-step" arrow pointing at the newly-created user's profile
  (where the new role + instrument tiles live).

### W1.3.5 — per-role landing crawler

* New `crawlers/strategies/role_landing.py` that logs in as each
  persona, hits `/`, `/schedule`, `/me`, and asserts the expected
  tile markers exist (e.g. requester sees `tile-dash-week` but NOT
  `tile-dash-quick-intake`; operator sees `tile-inst-queues`).
* Wire it into a new `waves.py` entry called `landing` that runs
  alongside `sanity` but is allowed to warn rather than fail.

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

### W1.3.8 — performance + cleanup

* Enable `PRAGMA journal_mode = WAL` permanently (currently sometimes
  off during populate).
* Add a `slow_queries` crawler that replays the canonical request
  list page and times every SQL call, flagging anything over 50ms.
* Retire the last known CSS fossils (~229 orphans still in the
  allowlist as warnings — turn each into either a deletion or an
  explicit prefix).

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
