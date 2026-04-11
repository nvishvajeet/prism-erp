# PRISM — Engine & Module Map

> **Purpose.** PRISM is a single-file Flask app (`app.py`, ~7600 lines).
> This map labels the **engines** (major subsystems) and their
> **subparts** (routes, tables, helpers, templates, crawlers) so that
> tomorrow you can pick two engines and compose a new feature out of
> them without re-reading the whole file.
>
> Every row below is an addressable handle: `file:line` where it lives,
> name you can grep for, and the crawler that exercises it. If a row
> says `—` for a slot, that slot is currently missing (candidate work).
>
> **How to use this map.** When you want a new feature, pick:
> 1. One **engine** that owns the primary state it mutates.
> 2. One or two **subparts** from other engines it needs to read.
> 3. One **tile** template pattern to render it.
> 4. One **crawler** to cover it (add to `crawlers/waves.py`).
>
> That's the whole cookbook. No new microservices. No new frameworks.

---

## Engine inventory (13 engines)

| # | Engine | Primary state | Entry route | Owning handler |
|---|---|---|---|---|
| E1 | **Auth & Session** | `users`, Flask session | `/login`, `/logout` | `login()` app.py:4197 |
| E2 | **User Admin** | `users`, `user_roles` | `/admin/users`, `/users/<id>` | `user_profile()` app.py:6605 |
| E3 | **Instrument Registry** | `instruments`, `instrument_admins/operators/faculty_admins`, `instrument_group*` | `/instruments`, `/instruments/<id>` | `instrument_detail()` app.py:4324 |
| E4 | **Request Lifecycle** | `sample_requests`, status machine | `/requests/new`, `/requests/<id>` | `request_detail()` app.py:4909 |
| E5 | **Approval Engine** | `approval_steps`, `instrument_approval_config` | actions on `/requests/<id>` | `create_approval_chain()` app.py:940 |
| E6 | **Attachments & Messages** | `request_attachments`, `request_messages`, `request_issues` | `/attachments/*`, POST actions on `/requests/<id>` | `save_uploaded_attachment()` app.py:1859 |
| E7 | **Schedule / Queue** | `sample_requests.scheduled_at` | `/schedule`, `/schedule/bulk`, `/schedule/actions` | `schedule()` app.py:6123 |
| E8 | **Calendar** | derived from E4+E7 | `/calendar`, `/calendar/events`, `/instruments/<id>/calendar` | `calendar()` app.py:7095 |
| E9 | **Stats & Visualizations** | read-only over E4 | `/stats`, `/visualizations*` | `stats()` app.py:7167 |
| E10 | **Audit & Timeline** | `audit_logs` (hash-chained) | read via E4 detail page | `log_action()` app.py:284, `verify_audit_chain()` app.py:307 |
| E11 | **Exports** | `generated_exports`, `exports/` dir | `/exports/*`, `/visualizations/export` | `generate_export_workbook()` app.py:2401 |
| E12 | **Announcements** | `announcements` | rendered on `/`, `/sitemap` | inline in `index()` app.py:3754 |
| E13 | **Portfolio (LLM overnight)** | `data/portfolio/*.json` | `/admin/portfolio*` | `portfolio_panel()` app.py:5949 |

Plus two dev-only engines:

| # | Engine | Purpose |
|---|---|---|
| D1 | **Dev Panel** | git + progress dashboard at `/admin/dev_panel` (app.py:5748) |
| D2 | **Crawler Suite** | 14 strategies in `crawlers/strategies/` grouped into 8 waves in `crawlers/waves.py` |

---

## E1 — Auth & Session

| Subpart | Where |
|---|---|
| Login form | `templates/login.html` |
| Login handler | `login()` app.py:4197 |
| Logout | `logout()` app.py:4213 |
| Session loader | `current_user()` app.py:2529 |
| Decorators | `login_required` app.py:2744, `role_required` app.py:2754, `owner_required` app.py:2770, `instrument_access_required` app.py:2783 |
| Password change | `change_password()` app.py:6570 |
| Invite activation | `activate()` app.py:7575 |
| Demo role switcher | `demo_switch_role()` app.py:4178 |
| Crawler coverage | `smoke`, `visibility`, `role_landing`, `role_behavior` |

## E2 — User Admin

| Subpart | Where |
|---|---|
| Admin users page | `user_profile()` app.py:6605, action branches 6614+ |
| Create / delete user | `create_user`, `delete_member` actions app.py:7512, 7534 |
| Role change (primary) | `change_role` action app.py:6658 |
| Layered role grant | `update_user_role_set` action app.py:6696; helpers `grant_user_role()` app.py:3651 / `revoke_user_role()` app.py:3660 / `user_role_set()` app.py:3626 |
| Instrument access grant | `update_user_instruments` action app.py:6731 |
| User detail template | `templates/user_detail.html` (extra-roles tile + instrument access tile) |
| Crawler coverage | `role_behavior` (create_user), `visibility` (per-role page reach) |

## E3 — Instrument Registry

| Subpart | Where |
|---|---|
| Listing | `instruments()` app.py:4220 → `templates/instruments.html` |
| Detail + config | `instrument_detail()` app.py:4324 → `templates/instrument_detail.html` |
| Create | `create_instrument` action app.py:4227 |
| Update metadata / operation | `update_metadata` app.py:4359, `update_operation` app.py:4429 |
| Archive / restore | app.py:4468, 4479 |
| Downtime | `add_downtime` app.py:4486; table `instrument_downtime` app.py:3199 |
| Approval config | `save_approval_config` app.py:4505; table `instrument_approval_config` app.py:3221 |
| Groups (admin bundles) | `instrument_groups_all()` app.py:3677, `instrument_group_member_ids()` app.py:3686 |
| Crawler coverage | `visibility`, `role_behavior`, `lifecycle` (step 5 admin history) |

## E4 — Request Lifecycle (**core engine**)

| Subpart | Where |
|---|---|
| Submit new | `new_request()` app.py:4720 → `templates/new_request.html` |
| Detail + 25+ action branches | `request_detail()` app.py:4909 → `templates/request_detail.html` |
| Duplicate | `duplicate_request()` app.py:6100 |
| Quick-receive shortcut | `quick_receive_request()` app.py:4149 |
| Status state machine | `assert_status_transition()` app.py:443, `request_status_group()` app.py:469 |
| Status summary for card | `request_status_summary()` app.py:482, `request_lifecycle_steps()` app.py:523 |
| Card policy (role → visible fields) | `request_card_policy()` app.py:1563, `request_card_field_allowed()` app.py:1407, `request_card_actions()` app.py:1438 |
| Metadata snapshot to disk | `write_request_metadata_snapshot()` app.py:1163; path helpers `request_folder_path()` app.py:1105 |
| In-place admin edit | `update_request_metadata` action app.py:5098 |
| Admin status override | `admin_set_status` app.py:5140, `admin_schedule_override` app.py:5348, `admin_complete_override` app.py:5416 |
| Rejection | `reject` action app.py:5539 |
| Crawler coverage | `lifecycle` (end-to-end journey), `smoke`, `visibility` |
| Known gaps (see audit) | admin_schedule_override + admin_complete_override have **no UI form** in `request_detail.html`; amendment workflow for completed jobs missing |

## E5 — Approval Engine

| Subpart | Where |
|---|---|
| Chain builder | `create_approval_chain()` app.py:940 (reads `instrument_approval_config`, falls back to finance→professor→operator) |
| Default user picker | `_default_user_for_approval_role()` app.py:911 |
| Actionable check | `approval_step_is_actionable()` app.py:1025 |
| Approve / reject actions | `approve_step` app.py:5213, `reject_step` app.py:5243 |
| Reassign approver | `assign_approver` app.py:5260 |
| Candidate query | `approval_candidate_options()` app.py:1685, `candidate_allowed_for_step()` app.py:1725 |
| Role labels | `approval_role_label()` app.py:399 |
| Permission check | `can_approve_step()` app.py:2732 |
| Template tile | approval chain tile in `templates/request_detail.html` (~line 225) |
| Tables | `approval_steps` app.py:3119, `instrument_approval_config` app.py:3221 |
| Crawler coverage | `lifecycle` (finance + professor steps) |
| Known gaps | no reorder/skip UI; no SLA timer; approval role names hardcoded in validation sets; `approver_actor_id` not persisted |

## E6 — Attachments, Messages & Issues

| Subpart | Where |
|---|---|
| Upload | `save_uploaded_attachment()` app.py:1859, action `upload_attachment` app.py:5082 |
| Generated (system) attachment | `save_generated_attachment()` app.py:1921 (used by sample-slip PDF) |
| Download / view / delete routes | app.py:6497, 6513, 6529 |
| Allowed types | `attachment_type_choices()` app.py:1743, `allowed_file()` app.py:1036 |
| Permissions | `can_upload_attachment()` app.py:1330, `can_delete_attachment()` app.py:1348 |
| Messages (conversation) | `post_message` action app.py:4948, thread loader `get_request_message_thread()` app.py:1779 |
| Notes (single sticky per kind) | `save_note` action app.py:4948 (same branch), loader `get_request_notes()` app.py:1760 |
| Issues (flag / respond / resolve / reopen) | actions app.py:5001, 5019, 5042, 5063; loader `get_request_issues()` app.py:1812 |
| Sample slip PDF | `generate_sample_slip_pdf()` app.py:1976 |
| Tables | `request_attachments` app.py:3145, `request_messages` app.py:3169, `request_issues` app.py:3181 |
| Crawler coverage | `lifecycle` (post_message step) |

## E7 — Schedule / Queue

| Subpart | Where |
|---|---|
| Page | `schedule()` app.py:6123 → `templates/schedule.html` |
| Bulk actions | `schedule_bulk_actions()` app.py:6192 (`bulk_assign`) |
| Per-card actions | `schedule_actions()` app.py:6275 (`take_up`, `quick_assign`, `plan_next_slot`, `mark_received`, `start_now`, `finish_now`) |
| Next slot compute | `compute_next_schedule_slot()` app.py:1539 |
| Filters | `schedule_filter_values()` app.py:2024 |
| Release queued requests on config change | `release_submitted_requests_for_instrument()` app.py:968 |

## E8 — Calendar

| Subpart | Where |
|---|---|
| Main calendar | `calendar()` app.py:7095 → `templates/calendar.html` |
| Events feed (JSON) | `calendar_events()` app.py:7144, builder `calendar_events_payload()` app.py:6952 |
| Per-instrument calendar | `instrument_calendar()` app.py:7161 |
| Request calendar card | app.py:7450 |
| Filters | `calendar_filter_values()` app.py:2031 |

## E9 — Stats & Visualizations

| Subpart | Where |
|---|---|
| Main stats page | `stats()` app.py:7167 → `templates/stats.html` |
| Visualizations hub | `visualizations()` app.py:7297 → `templates/visualization.html` |
| Per-instrument viz | `instrument_visualization()` app.py:7331 |
| Group viz | `group_visualization()` app.py:7358 |
| Payload builder | `stats_payload()` app.py:2144, `stats_payload_for_scope()` app.py:2176 |
| Dashboard analytics | `dashboard_analytics()` app.py:2322 |
| Chart helpers | `chart_rows()` app.py:2149 |
| Filters | `report_filter_values()` app.py:2351, `resolve_report_window()` app.py:2361 |
| Permission | `can_access_stats()` app.py:2998 |

## E10 — Audit & Timeline

| Subpart | Where |
|---|---|
| Append event | `log_action()` app.py:284, `log_action_at()` app.py:288 |
| Hash-chain verify | `verify_audit_chain()` app.py:307 |
| Per-request timeline | `request_timeline_entries()` app.py:612 |
| Per-instrument timeline | `instrument_timeline_entries()` app.py:733 |
| Action label dictionary | `timeline_action_label()` app.py:574 |
| Visibility filter | `request_card_event_allowed()` app.py:1465, `request_card_visible_timeline()` app.py:1480 |
| Table | `audit_logs` app.py:3132 |

## E11 — Exports

| Subpart | Where |
|---|---|
| Workbook builder | `generate_export_workbook()` app.py:2401 |
| Generate (POST) | `generate_export()` app.py:7388, `generate_visualization_export()` app.py:7401 |
| Download | `download_export()` app.py:7438 |
| Table | `generated_exports` app.py:3212 |

## E12 — Announcements

| Subpart | Where |
|---|---|
| Table | `announcements` app.py:3231 |
| Render point | tile on `index()` / dashboard |
| *Status* | admin CRUD UI minimal; candidate engine to extend |

## E13 — Portfolio (LLM overnight commentary)

| Subpart | Where |
|---|---|
| Panel page | `portfolio_panel()` app.py:5949 → `templates/portfolio.html` |
| Log order | `portfolio_log_order()` app.py:5957 |
| Bulk import orders | `portfolio_log_orders_bulk()` app.py:6016 |
| Refresh NAV | `portfolio_refresh()` app.py:6074 |
| State loader | `_portfolio_state()` app.py:5885 |
| NAV history | `_portfolio_load_nav_history()` app.py:5818 |
| Value series | `_portfolio_compute_value_series()` app.py:5850 |
| *Commentary file* | `data/portfolio/commentary_state.json` — written nightly by Mac mini cron |

---

## D1 — Dev Panel

`/admin/dev_panel` (`dev_panel()` app.py:5748). Shows git status/log + progress across roadmap waves. Doc viewer at `/admin/dev_panel/doc` (app.py:5760) reads markdown from `docs/`.

## D2 — Crawler Suite

14 strategies in `crawlers/strategies/`:

| Strategy | Aspect | Scope |
|---|---|---|
| `smoke.py` | regression | critical paths × 3 roles |
| `visibility.py` | visibility | 8 roles × ~12 pages access matrix |
| `role_landing.py` | visibility | role-hint badge on /, /sitemap |
| `role_behavior.py` | visibility | each role performs its signature action |
| `lifecycle.py` | lifecycle | end-to-end request journey (submit → complete) |
| `contrast_audit.py` | a11y | WCAG light+dark |
| `color_improvement.py` | a11y | chart palette |
| `dead_link.py` | hygiene | internal link validator |
| `cleanup.py` | hygiene | dead Python / templates |
| `css_orphan.py` | hygiene | unused CSS selectors |
| `architecture.py` | hygiene | handler-size drift |
| `philosophy_propagation.py` | hygiene | tile + data-vis creed |
| `performance.py` | perf | page timing |
| `slow_queries.py` | perf | SQL fingerprint timing |
| `random_walk.py` | chaos | random click crawl |

Waves in `crawlers/waves.py`:

| Wave | Purpose | Gate |
|---|---|---|
| `sanity` | pre-push gate | `smoke + visibility + role_landing + contrast_audit`, stop_on_fail=True |
| `behavioral` | RBAC behavior | `role_behavior + visibility + role_landing` |
| `lifecycle` | end-to-end | `lifecycle` |
| `hygiene` | dead code | `dead_link + architecture + philosophy_propagation` |
| `a11y` | colors | `contrast_audit + color_improvement` |
| `coverage` | perf + audit | `performance + slow_queries + random_walk` |
| `cleanup` | triage | `cleanup + css_orphan + philosophy_propagation` |
| `full` | everything | all strategies |

---

## Cross-engine dependency map (who reads whom)

```
E1 Auth ─┬─► everything (login_required)
         └─► E2 User Admin (session user row)

E2 User Admin ──► E3 Instrument Registry (instrument_admins/operators/faculty_admins)
               └─► E5 Approval Engine (approver candidates)

E3 Instruments ──► E4 Request Lifecycle (sample_requests.instrument_id FK)
               └─► E5 Approval Engine (instrument_approval_config)

E4 Request Lifecycle ─┬─► E5 Approval Engine (creates chain on submit)
                      ├─► E6 Attachments (uploads/messages/issues)
                      ├─► E7 Schedule (scheduled_at field)
                      ├─► E10 Audit (every action logs)
                      └─► E11 Exports (read-only aggregation)

E7 Schedule ──► E4 Request Lifecycle (status transitions)
             └─► E8 Calendar (derived view)

E9 Stats ─────► E4 Request Lifecycle (read-only aggregation)
             └─► E10 Audit (timeline data)

E12 Announcements ──► E1 Auth (visible on dashboard based on role)

E13 Portfolio ──► standalone (only depends on data/portfolio/*.json)
```

---

## Composing new features — recipe examples

**Recipe A: "Approval SLA dashboard"**
- Engines: E5 (source of pending steps) + E9 (rendering shell) + E10 (breach events)
- New columns: `instrument_approval_config.sla_hours` (additive)
- New tile: `dashboard.html` tile listing `approval_steps` where `julianday('now') - julianday(created_at) > sla_hours/24.0`
- New crawler: add to `role_behavior` for site_admin

**Recipe B: "Amendment workflow for completed requests"**
- Engines: E4 (source) + E6 (issue trail) + E10 (audit)
- New action: `request_amendment` on `request_detail()` POST; creates a child `sample_request` with `parent_request_id` (new column) and copies metadata
- New tile: "Request Amendment" disclosure on completed requests
- Keep `completion_locked=1` unchanged on parent — amendment lives in child row

**Recipe C: "Admin-configurable approval role names"**
- Engines: E5 + E3
- New table: `approval_roles(name, label, sort_order)` OR reuse `instrument_approval_config` as the source of truth
- Replace hardcoded `{finance, professor, operator}` in app.py:4511 with a query
- Populate dropdowns from this query in `templates/instrument_detail.html`

**Recipe D: "Announcement CRUD UI"**
- Engine: E12 (currently has table but minimal UI)
- New route: `/admin/announcements` with CRUD actions
- New template: `templates/admin_announcements.html` (new tile-based page)
- New crawler scenario: `role_behavior` super_admin creates an announcement

---

## Shared database objects — reused across engines

Some tables are read and written by multiple engines. These are the
"wiring" of the system; any change to them ripples widely. They follow
DATA_POLICY Rule 1 (single home) but are legitimately **shown** in
many places.

| Table | Owning engine | Also read by | Written by | Why it's shared |
|---|---|---|---|---|
| `users` | E2 User Admin | E1, E3, E4, E5, E6, E7, E9, E10, E13 | E1 (login), E2 (admin actions), E2 (password change) | Every authenticated request loads the session user |
| `user_roles` (junction) | E2 User Admin | E1 (session `current_role_set`), E5 (approver candidates) | E2 `grant_user_role()` / `revoke_user_role()` only | Layered role grants |
| `instruments` | E3 Instrument Registry | E4, E5, E7, E8, E9, E11 | E3 only | Every request references an instrument |
| `instrument_admins` / `instrument_operators` / `instrument_faculty_admins` | E3 | E4 (permissions), E5 (approver candidates), E7 (operator assignment) | E3 via `sync_instrument_assignments()` only | Permission wiring |
| `instrument_approval_config` | E3 Instrument Registry | E5 (`create_approval_chain` reads) | E3 `save_approval_config` only | Per-instrument approval chain config |
| `sample_requests` | E4 Request Lifecycle | E5, E6, E7, E8, E9, E10, E11 | E4 only (via state machine in `assert_status_transition`) | The core record |
| `approval_steps` | E5 Approval Engine | E4 (detail page render), E10 (timeline) | E5 actions `approve_step`/`reject_step`/`assign_approver` only | Multi-step approval progress |
| `request_attachments` | E6 Attachments | E4 (detail), E11 (exports) | E6 `save_uploaded_attachment()` + `save_generated_attachment()` | File provenance |
| `request_messages` | E6 | E4, E10 (timeline proxy) | E6 `post_message` / `save_note` | Conversation thread |
| `request_issues` | E6 | E4, E10 | E6 `flag_issue` / `respond_issue` / `resolve_issue` / `reopen_issue` | Issue trail |
| `audit_logs` | E10 Audit | **everyone reads, nobody else writes** | E10 `log_action()` / `log_action_at()` only | Hash-chained history; projected into timelines |
| `instrument_downtime` | E3 | E7 (schedule gaps), E8 (calendar) | E3 `add_downtime` | Planned outage windows |
| `generated_exports` | E11 | — | E11 `generate_export()` / `generate_visualization_export()` | Tracks generated files for download |
| `announcements` | E12 | E1 (dashboard render) | E12 (currently minimal UI) | Banner content |
| `instrument_group` / `instrument_group_member` | E3 | E2 (quick-grant shortcut) | E3 (admin edits) | Admin-curated bundles — bundles only, never grant permission directly |

**Read this table before any schema change.** If you're adding a
column to a shared table, you may be touching every engine in the
right column. Use `git grep <table_name>` to find every reader before
you migrate.

**The single-writer rule** (DATA_POLICY §3) is especially strict for
shared tables. Never write to `sample_requests.status` outside
`assert_status_transition()`. Never write to `approval_steps.status`
outside `approve_step` / `reject_step`. Never write to `audit_logs`
outside `log_action()`.

---

## Naming conventions (so you can grep)

- **Actions** are POST form `action=...` strings. Grep `action == "xyz"` to find handlers.
- **Tables** are lowercase snake_case singular or plural as per SQLite convention; grep `CREATE TABLE IF NOT EXISTS <name>` for schema.
- **Permissions** are always `can_<verb>_<noun>()`; grep `^def can_` for the whole set (currently ~20).
- **Templates** are always `<noun>_<variant>.html`; tile patterns live in `_page_macros.html` / `_request_macros.html`.
- **Crawlers** are `<aspect>_<focus>.py` (e.g. `role_behavior.py`, `slow_queries.py`).

When you add a new engine, give it an E-number in this file and follow the same subpart table format. When you add a subpart, add one row — no new section needed.
