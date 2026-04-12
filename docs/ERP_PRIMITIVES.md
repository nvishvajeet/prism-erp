# ERP Primitives — Abstract Pattern Map

> Maps every reusable pattern in the PRISM instrument portal to an
> abstract ERP primitive. Use this when building a new portal
> (finance, attendance, notifications, inventory, etc.).

## Primitive catalogue

### 1. Entity Registry

**What it does.** A sortable, paginated table listing all entities
of one type, with category grouping, status dots, and inline
links to detail/history/queue views.

**Instrument implementation.**
`templates/instruments.html` — `instrument_row` macro renders each
row; `paginated_pane('mainInstruments')` handles pagination.
Route: `app.py:7107 instruments()`.

**Already cloned in.** Finance grants list (`templates/finance_grants.html`,
`/finance/grants`).

**Wiring for a new portal.** Create a `<entity>_row` macro in
the list template. Feed it from a route that queries the entity
table, passes `visible_links` and `turnaround_map`-style metrics.
Import `paginated_pane` and `card_heading` from `_page_macros.html`.

---

### 2. Entity List Page

**What it does.** The full page shell hosting the Entity Registry
tile, an optional create-form tile, and an optional archived-
entities tile. Three tiles in a `<section class="instruments-tiles">`
fluid grid.

**Instrument implementation.**
`templates/instruments.html` — tile 1 (header + create), tile 2
(active list), tile 3 (archived list).

**Already cloned in.** `/finance/grants` (list + archived).

**Wiring for a new portal.** Extend `base.html`, import the two
macros, replicate the three-tile section. Add a POST handler for
the create form in the route.

---

### 3. Entity Detail Page

**What it does.** A multi-tile dashboard for a single entity:
header with status dot, info/photo tile, stats tile, queue tile,
team tile, activity tile, metadata-edit tile, danger-zone tile.

**Instrument implementation.**
`templates/instrument_detail.html` — 10 tile sections inside
`<div class="inst-tiles">`. Route: `app.py:7212 instrument_detail()`.

**Already cloned in.** `/finance/grants/<id>` (detail with KPIs
and metadata edit).

**Wiring for a new portal.** Copy the tile grid skeleton. Each
tile is an `<article class="card tile tile-<name>">` with a
`card_heading` call. Populate from the route's context dict.

---

### 4. Entity Config Page

**What it does.** Admin-only page for configuring an entity's
workflow rules: approval sequence, custom fields, pricing/billing.

**Instrument implementation.**
`templates/instrument_form_control.html` — three full-width tiles
(approval sequence, custom fields, pricing). Route:
`app.py:7627 instrument_form_control()`.

**Already cloned in.** None.

**Wiring for a new portal.** Clone the three-tile layout. The
approval-sequence tile reads from `approval_config`; the custom-
fields tile uses a `<template>` element for dynamic row addition.

---

### 5. Workflow Pipeline Config

**What it does.** Configures a multi-step approval sequence (up
to 6 steps) with per-step notification toggles. Each step binds
an approver role and optional named user.

**Instrument implementation.**
`instrument_form_control.html` tile 1 (Approval Sequence) +
`_page_macros.html:approval_action_form` macro for the runtime
approve/reject toggle on `request_detail.html`.

**Already cloned in.** None (the grant portal uses a simpler
two-step approval hard-coded in the route).

**Wiring for a new portal.** Store steps in an
`<entity>_approval_config` table with `(entity_id, step_order,
approver_role, approver_id, notify_submitter)`. Render config
with the grid pattern from form-control; render runtime actions
with `approval_action_form`.

---

### 6. Dynamic Form Builder

**What it does.** Admin-configurable custom fields (text, number,
select, file) attached to an entity. Requesters fill these at
submission time.

**Instrument implementation.**
`instrument_form_control.html` tile 2 (Custom Fields) —
`<template id="fieldRowTemplate">` + JS re-indexing on submit.
Server stores fields in `instrument_custom_fields` table.

**Already cloned in.** None.

**Wiring for a new portal.** Create an `<entity>_custom_fields`
table. Clone the template + JS pattern. On the submission form,
loop over active fields and render inputs by `field_type`.

---

### 7. Entity Status Machine

**What it does.** A finite set of operational states (accepting /
on_hold / maintenance for instruments; active / suspended / closed
for grants) with a visual dot indicator and an inline toggle for
authorized users.

**Instrument implementation.**
`instrument_detail.html` tile "Control Panel" — radio-button
group wired by `static/intake-toggle.js` with 2-tap arming for
destructive transitions. CSS: `.operation-status`,
`.control-mode-row`.

**Already cloned in.** Grant status (active/suspended/closed) on
the grant detail page.

**Wiring for a new portal.** Define the state set and transition
rules. Clone the `control-mode-row` markup and the
`intake-toggle.js` pattern. Backend handler validates transitions
and logs to the event stream.

---

### 8. Role Assignment Matrix

**What it does.** Displays people assigned to an entity in
role-grouped columns (operators, faculty, subscribers) using
`person_chip` components, with a checkbox-grid editor for
reassignment.

**Instrument implementation.**
`instrument_detail.html` tile "Team" (display) + tile "Metadata"
fieldsets (edit). Macro: `_page_macros.html:person_chip`.

**Already cloned in.** None (grants show a single "PI" field,
not a matrix).

**Wiring for a new portal.** Create a junction table
`<entity>_assignments(entity_id, user_id, role)`. Render display
with `person_chip` in `team-columns`; render edit with the
checkbox-grid fieldset pattern.

---

### 9. Event Stream

**What it does.** Append-only activity timeline showing every
mutation on an entity. Paginated, rendered with the
`activity_feed` or inline `activity-table` pattern.

**Instrument implementation.**
`instrument_detail.html` tile "Recent Activity" —
`instrument_timeline_entries` fed from `log_action()` calls.
Macro: `_page_macros.html:activity_feed`.

**Already cloned in.** Request detail page (threaded conversation
view). Hard attribute: every in-place edit appends to the event
stream.

**Wiring for a new portal.** Call `log_action(user_id, entity_type,
entity_id, action, details_dict)` on every mutation. Render with
`activity_feed(entries, pane_id)`.

---

### 10. Inline Edit Pattern

**What it does.** A toggleable form (hidden by default) that lets
authorized users edit entity metadata in place without navigating
away. Uses the generic `data-toggle-target` handler from
`base.html`.

**Instrument implementation.**
`instrument_detail.html` tile "Metadata" — `#metaEditForm` toggled
by the "Edit" link button. POST action `update_metadata`.

**Already cloned in.** Grant metadata edit on the grant detail
page.

**Wiring for a new portal.** Add a `<form hidden>` inside a tile
with a toggle button using `data-toggle-target="#formId"`. Handle
the POST in the route, log to event stream.

---

### 11. Entity Work Queue

**What it does.** A filterable, paginated table of pending work
items for an entity, with status-pill filters, inline accept/assign
action forms, and bucket-based row filtering.

**Instrument implementation.**
`instrument_detail.html` tile "Queue" — `status_pills_row` macro
for filters, `queue_action_stack` macro for inline actions,
JS pill-filter IIFE for client-side bucket toggling.

**Already cloned in.** None (the schedule page has a global queue
but not per-entity).

**Wiring for a new portal.** Query pending items filtered by
entity_id. Render with `paginated_pane` + `status_pills_row` +
`queue_action_stack`. Wire the JS pill filter (copy the IIFE
pattern from instrument_detail).

---

### 12. Entity KPI Dashboard

**What it does.** A compact grid of clickable stat counters
showing key metrics for an entity (pending, active, completed,
this-week, avg turnaround).

**Instrument implementation.**
`instrument_detail.html` tile "At A Glance" — uses `stat_blob`
macro from `_page_macros.html`. Also available as `kpi_grid`
wrapper macro.

**Already cloned in.** Grant budget KPIs on the grant detail page.
Dashboard page uses the same `stat_blob` pattern globally.

**Wiring for a new portal.** Compute metrics in the route. Pass
a list of dicts to `kpi_grid(items)` or call `stat_blob` directly
inside a tile.

---

### 13. Navigation Hierarchy (Breadcrumb)

**What it does.** Context breadcrumb trail showing the path from
the portal root to the current entity. Rendered in `base.html`
via `block breadcrumb_*` overrides.

**Instrument implementation.**
`instrument_detail.html` — `{% block breadcrumb_instrument %}`.
`base.html` renders the breadcrumb bar from these blocks.

**Already cloned in.** Global — every page uses this.

**Wiring for a new portal.** Define a `breadcrumb_<portal>` block
in `base.html`. Override it in the detail template.

---

### 14. Entity Billing Config

**What it does.** Admin-editable pricing, payment instructions,
and payment-proof requirements shown to requesters before
submission.

**Instrument implementation.**
`instrument_form_control.html` tile 3 (Pricing & Payment
Instructions) — three fields (price_per_sample,
payment_instructions, payment_proof_note).

**Already cloned in.** None.

**Wiring for a new portal.** Add pricing columns to the entity
table. Clone the three-field form tile. Display the instructions
on the submission form.

---

### 15. Notification Broadcast

**What it does.** Lets an admin post a notice (subject, body,
severity) to all users subscribed to an entity.

**Instrument implementation.**
`instrument_detail.html` tile "Notify Subscribers" — POSTs to
`instrument_notify` route. Severity levels: info, warning,
critical.

**Already cloned in.** None.

**Wiring for a new portal.** Create a `<portal>_notify` route.
Query subscribers from the assignment junction table. Render
the form with subject/body/severity fields.

---

### 16. Downtime / Scheduling Block

**What it does.** Displays upcoming downtime windows for an entity
with an inline add-form for authorized users. Links to a calendar
view.

**Instrument implementation.**
`instrument_detail.html` tile "Downtime" — list of
`upcoming_downtime` entries with start/end/reason, plus a
`<details>` inline editor.

**Already cloned in.** None.

**Wiring for a new portal.** Create a `<entity>_downtime` table
with `(entity_id, start_time, end_time, reason)`. Render the
list + inline form. Link to the calendar route.

---

## How to add a new ERP portal in 30 minutes

### Prerequisites

- Read `docs/PROJECT.md` section 11 (Reusable abstractions) to
  pick helpers off the existing list.
- Read `docs/PHILOSOPHY.md` section 2 (Hard vs soft attributes)
  to understand what you can and cannot change.

### Step-by-step

1. **Define the entity table.** Add a migration in `app.py`'s
   `ensure_schema()` with the entity columns. Include `status`,
   `created_at`, `updated_at` at minimum.

2. **Create the list template.** Copy the three-tile skeleton from
   `instruments.html`. Replace `instrument_row` with your entity's
   row macro. Wire `paginated_pane` for the main table.

3. **Create the detail template.** Copy the tile grid from
   `instrument_detail.html`. Keep the tiles you need (info, stats,
   queue, team, activity, metadata-edit). Remove tiles that do not
   apply. Every tile is a self-contained `<article class="card tile">`.

4. **Create the config template (optional).** If the entity has
   configurable workflows, clone `instrument_form_control.html`
   for approval sequence + custom fields + billing.

5. **Add routes.** Three routes minimum:
   - `/<portal>` — list page (GET + POST for create)
   - `/<portal>/<id>` — detail page (GET + POST for actions)
   - `/<portal>/<id>/config` — config page (GET + POST)

6. **Wire the macros.** Import from `_page_macros.html`:
   - `card_heading` — every tile header
   - `paginated_pane` — every scrollable table
   - `stat_blob` / `kpi_grid` — KPI counters
   - `person_chip` — people display
   - `metadata_grid` — key-value pairs
   - `status_pills_row` — filter tabs
   - `queue_action_stack` — inline queue actions
   - `activity_feed` — event timeline
   - `empty_state` — zero-data placeholders

7. **Add to navigation.** Register the portal in the sitemap
   (`templates/sitemap.html`) and add breadcrumb blocks in
   `base.html`.

8. **Run the gate.** `.venv/bin/python scripts/smoke_test.py`
   must pass before committing.

### Macro quick-reference

| Macro | File | Purpose |
|---|---|---|
| `card_heading` | `_page_macros.html` | Tile header with optional action slot |
| `paginated_pane` | `_page_macros.html` | Scrollable + paginated table wrapper |
| `stat_blob` | `_page_macros.html` | Single KPI counter |
| `kpi_grid` | `_page_macros.html` | Grid of KPI counters |
| `person_chip` | `_page_macros.html` | Avatar + name chip |
| `metadata_grid` | `_page_macros.html` | Key-value pair grid |
| `status_pills_row` | `_page_macros.html` | Filter pill row |
| `queue_action_stack` | `_page_macros.html` | Inline accept/assign forms |
| `activity_feed` | `_page_macros.html` | Paginated event timeline |
| `empty_state` | `_page_macros.html` | Zero-data placeholder |
| `toggleable_form` | `_page_macros.html` | Disclosure-wrapped form |
| `input_dialog` | `_page_macros.html` | Comment/message input panel |
| `approval_action_form` | `_page_macros.html` | Approve/reject toggle |

### CSS grid

New portals use the same `.inst-tiles` grid (or create an
`.<portal>-tiles` alias). Each tile is `.card.tile` with a
`grid-column: span N` to control width within the 6-column grid.

---

### 17. Inventory Tracking

**What it does.** Tracks consumables, spare parts, reagents, and
accessories for an entity with quantity, minimum-stock alerts, and
unit costing.

**Instrument implementation.**
`instrument_detail.html` tile "Inventory" — table with item name,
qty, min qty, unit cost, stock status badge (in stock / low stock /
out of stock). Inline `<details>` add-item form. Table:
`instrument_inventory(id, instrument_id, item_name, category,
quantity, minimum_quantity, unit, unit_cost, notes, created_at,
updated_at)`.

**Wiring for a new portal.** Create an `<entity>_inventory` table
with the same columns. Clone the tile-inventory markup. Add
`add_inventory_item` POST action to the detail route.

---

### 18. Leave / Attendance

**What it does.** Daily attendance marking (present/absent/leave),
leave request workflow with team-manager and admin approval, leave
balance tracking, and reporting-structure-based delegation.

**Implementation.**
`templates/attendance.html` — combined view with calendar grid,
leave application form, team-leave approval queue.
Tables: `attendance(id, user_id, date, status, marked_by,
marked_at)`, `leave_requests(id, user_id, leave_type, start_date,
end_date, reason, status, approved_by, ...)`,
`reporting_structure(id, user_id, manager_id)`,
`leave_balances(id, user_id, leave_type, balance, year)`.

**Wiring for a new portal.** The attendance pattern is
self-contained. Clone `attendance.html` and its routes
(`/attendance`, `/attendance/mark`, `/attendance/apply-leave`,
`/attendance/team-leave/<id>/approve`). Adapt
`reporting_structure` for your entity's hierarchy.

---

### 19. Messaging / Inbox

**What it does.** Internal threaded messaging with attachments,
read/unread tracking, reply chains, and routing to specific users
or roles.

**Implementation.**
`templates/inbox.html` — message list with unread count.
`/messages/<id>` — threaded detail view.
Tables: `messages(id, sender_id, recipient_id, subject, body,
is_read, parent_id, ...)`, `message_attachments(id, message_id,
filename, filepath, ...)`.
Macros used: `input_dialog` for compose, `paginated_pane` for
list, `activity_feed` (threaded=True) for conversation.

**Wiring for a new portal.** Clone the inbox routes and templates.
The pattern is generic — replace sender/recipient with any two
entity roles.

---

### 20. Mailing Lists

**What it does.** Named distribution lists with member management.
Used by notification broadcast to reach groups of users
(instrument subscribers, department members, grant team).

**Implementation.**
`/admin/mailing-lists` — CRUD interface.
Tables: `mailing_lists(id, name, description, created_by,
created_at)`, `mailing_list_members(id, list_id, user_id,
added_at)`.

**Wiring for a new portal.** Create `<entity>_mailing_lists` and
`<entity>_mailing_list_members` tables, or reuse the global
tables with a `context_type` discriminator column.

---

### 21. Grant Expenses

**What it does.** Non-sample charges (equipment, reagents, vendor
payments, travel) recorded against a grant budget with receipt
tracking and expense-type categorisation.

**Implementation.**
`templates/finance_grant_expenses.html` — KPI summary + expense
list + add-expense form.
Table: `grant_expenses(id, grant_id, description, amount,
expense_type, receipt_number, notes, recorded_by, recorded_at)`.
Route: `/finance/grants/<id>/expenses` (GET + POST).

**Wiring for a new portal.** Clone the expenses sub-page pattern.
Create `<entity>_expenses` with the same columns. The KPI tile +
list + add form is a reusable three-tile layout.

---

### 22. Email Templates

**What it does.** Per-entity customisable email notification
templates for workflow events (submitted, approved, completed).
Admin edits subject and body templates with placeholder variables.

**Implementation.**
`instrument_form_control.html` tile 4 "Message Templates" —
fieldset per event type with subject + body textarea.
Table: `instrument_email_templates(id, instrument_id, event_type,
subject_template, body_template, updated_at)`.

**Wiring for a new portal.** Create `<entity>_email_templates`
with the same schema. Clone the form-control tile. Define your
event types (e.g. "expense_submitted", "budget_exceeded") and
placeholder variables.
