# ERP Module Template — Build a new module in 15 minutes

> Copy-paste recipe for adding a new ERP module (Vehicle Management,
> Procurement, Asset Tracking, etc.) by cloning the instrument/grant
> patterns already proven in production.

---

## Section 1: The 5 pages every module needs

### 1A. LIST page (`/<module>`)

```html
{% extends "base.html" %}
{% from "_page_macros.html" import card_heading, paginated_pane with context %}
{% block content %}

<section class="<module>-tiles">

  {# Tile 1: Header + optional create form #}
  <article class="card tile tile-<module>-header">
    {% call card_heading("", "<Module> Registry") %}
      {% if can_create %}<button type="button" class="mini-icon-button" id="toggle<Module>Create">+</button>{% endif %}
    {% endcall %}
    {% if can_create %}
    <div class="edit-panel is-hidden" id="<module>CreatePanel">
      <form method="post" class="form-grid compact-admin-form">
        <input type="hidden" name="action" value="create_<entity>">
        <!-- entity fields -->
        <button type="submit">Add <Entity></button>
      </form>
    </div>
    {% endif %}
  </article>

  {# Tile 2: Active entity list #}
  <article class="card tile tile-<module>-active">
    {{ card_heading("", "Active <Entities>") }}
    {% call paginated_pane('main<Entities>', page_size=25, max_height='none') %}
    <table class="sortable-table">
      <thead><tr><th>Name</th><th>Status</th><th>Links</th></tr></thead>
      <tbody id="main<Entities>Body">
        {% for item in entities %}
        <tr data-pane-item>
          <td><a href="{{ url_for('<module>_detail', <entity>_id=item['id']) }}">{{ item["name"] }}</a></td>
          <td><span class="operation-status operation-{{ item.status }}"><span class="operation-dot"></span><strong>{{ item.status }}</strong></span></td>
          <td><a class="text-link" href="{{ url_for('<module>_detail', <entity>_id=item['id']) }}">Detail</a></td>
        </tr>
        {% endfor %}
      </tbody>
    </table>
    {% endcall %}
  </article>

  {# Tile 3: Archived (conditional) #}
  {% if archived_entities %}
  <article class="card tile tile-<module>-archived">
    {{ card_heading("", "Archived") }}
    <!-- same table structure, filtered for archived -->
  </article>
  {% endif %}

</section>
{% endblock %}
```

### 1B. DETAIL page (`/<module>/<id>`)

```html
{% extends "base.html" %}
{% from "_page_macros.html" import card_heading, paginated_pane, stat_blob, metadata_grid, person_chip, status_pills_row, empty_state with context %}
{% block breadcrumb_<module> %}{{ entity["name"] }}{% endblock %}
{% block content %}

<header class="inst-header">
  <div class="inst-header-main">
    <h2 class="inst-header-title">{{ entity["name"] }}</h2>
    <span class="inst-header-code">{{ entity["code"] }}</span>
    <span class="operation-status operation-{{ entity.status }} operation-status-compact inst-header-status">
      <span class="operation-dot"></span><strong>{{ entity.status }}</strong>
    </span>
  </div>
</header>

<div class="inst-tiles">
  {# Tile: Info (photo + metadata_grid) #}
  <section class="card tile tile-info">
    {{ card_heading("", "<Entity>") }}
    {{ metadata_grid(info_items, compact=True) }}
  </section>

  {# Tile: KPI counters #}
  <section class="card tile tile-stats">
    {{ card_heading("", "At A Glance") }}
    <div class="tile-stat-stack">
      {{ stat_blob(counts.pending, "Pending", "#", tone='wait') }}
      {{ stat_blob(counts.active, "Active", "#", tone='active') }}
      {{ stat_blob(counts.done, "Completed", "#", tone='completed') }}
    </div>
  </section>

  {# Tile: Team (person_chip in team-columns) #}
  <section class="card tile tile-team">
    {{ card_heading("", "Team") }}
    <div class="team-columns">
      <div class="team-col">
        <h3 class="section-kicker">Managers</h3>
        {% for p in managers %}{{ person_chip(p.name, user_id=p.id) }}{% endfor %}
      </div>
    </div>
  </section>

  {# Tile: Activity (event stream) #}
  <section class="card tile tile-activity">
    {{ card_heading("", "Recent Activity") }}
    {% call paginated_pane('entityEvents', page_size=6, max_height='none') %}
    <table class="activity-table">
      <tbody id="entityEventsBody">
        {% for e in timeline_entries %}
        <tr data-pane-item><td><div class="activity-row">
          <strong>{{ e.title }}</strong>
          <small class="muted">{{ e.at }} — {{ e.actor }}</small>
        </div></td></tr>
        {% endfor %}
      </tbody>
    </table>
    {% endcall %}
  </section>

  {# Tile: Metadata edit (toggleable) #}
  {% if can_edit %}
  <section class="card tile tile-edit" id="metaEditTile">
    {% call card_heading("", "Metadata") %}
      <button type="button" class="link-button" data-toggle-target="#metaEditForm">Edit</button>
    {% endcall %}
    <form method="post" class="meta-edit-form" id="metaEditForm" hidden>
      <input type="hidden" name="action" value="update_metadata">
      <!-- editable fields -->
      <button type="submit">Save Changes</button>
    </form>
  </section>
  {% endif %}
</div>
{% endblock %}
```

### 1C. FORM CONTROL page (`/<module>/<id>/form-control`)

Three full-width tiles inside `<div class="inst-tiles">`:
1. **Approval Sequence** — 6-step grid with per-step notify checkbox
2. **Custom Fields** — dynamic rows with `<template id="fieldRowTemplate">`
3. **Pricing / Budget Rules** — entity-specific config fields

Clone `instrument_form_control.html` or `finance_grant_form_control.html`.

### 1D. EXPENSES / TRANSACTIONS sub-page (`/<module>/<id>/expenses`)

```html
<section class="finance-tiles">
  <article class="card tile tile-finance-kpi">
    {{ card_heading("SUMMARY", count ~ " transactions") }}
    <!-- KPI grid: total, count -->
  </article>
  <article class="card tile tile-finance-outstanding">
    {{ card_heading("TRANSACTIONS", "All charges") }}
    <ul class="finance-invoice-list">
      {% for t in transactions %}
      <li class="finance-invoice-row"><!-- type badge, description, amount, meta --></li>
      {% endfor %}
    </ul>
  </article>
  {% if can_edit %}
  <article class="card tile">
    {{ card_heading("ADD", "Record new") }}
    <form method="post" class="form-grid"><!-- fields --></form>
  </article>
  {% endif %}
</section>
```

### 1E. DASHBOARD TILE (on `/`)

Add a stat_blob or card tile to the dashboard route context and
render it inside the existing dashboard grid.

---

## Section 2: The 4 schema tables every module needs

```sql
-- 1. Main entity table
CREATE TABLE IF NOT EXISTS <entities> (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE,
    status TEXT DEFAULT 'active',   -- active | on_hold | archived
    category TEXT,
    -- domain-specific columns --
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 2. Admin/assignment junction table
CREATE TABLE IF NOT EXISTS <entity>_admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    <entity>_id INTEGER NOT NULL REFERENCES <entities>(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    role TEXT DEFAULT 'admin',      -- admin | operator | viewer
    UNIQUE(<entity>_id, user_id, role)
);

-- 3. Approval config table
CREATE TABLE IF NOT EXISTS <entity>_approval_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    <entity>_id INTEGER NOT NULL REFERENCES <entities>(id),
    step_order INTEGER NOT NULL,
    approver_role TEXT NOT NULL,
    approver_id INTEGER REFERENCES users(id),
    notify_submitter INTEGER DEFAULT 0
);

-- 4. Custom fields table
CREATE TABLE IF NOT EXISTS <entity>_custom_fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    <entity>_id INTEGER NOT NULL REFERENCES <entities>(id),
    field_label TEXT NOT NULL,
    field_type TEXT DEFAULT 'text',  -- text | number | select | file
    is_required INTEGER DEFAULT 0,
    field_options TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0
);
```

---

## Section 3: The 6 route handlers every module needs

```python
# 1. List (GET + POST create)
@app.route("/<module>", methods=["GET", "POST"])
def <module>_list():
    if request.method == "POST" and request.form.get("action") == "create_<entity>":
        # INSERT into <entities>, log_action(), redirect
        pass
    entities = db.execute("SELECT * FROM <entities> WHERE status != 'archived'").fetchall()
    return render_template("<module>.html", entities=entities)

# 2. Detail (GET + POST inline actions)
@app.route("/<module>/<int:entity_id>", methods=["GET", "POST"])
def <module>_detail(entity_id):
    if request.method == "POST":
        action = request.form.get("action")
        # update_metadata, change_status, archive, add_downtime, etc.
    entity = db.execute("SELECT * FROM <entities> WHERE id = ?", (entity_id,)).fetchone()
    return render_template("<module>_detail.html", entity=entity, ...)

# 3. Form control (GET + POST)
@app.route("/<module>/<int:entity_id>/form-control", methods=["GET", "POST"])
def <module>_form_control(entity_id):
    if request.method == "POST":
        action = request.form.get("action")
        # save_approval_notify, save_custom_fields, save_pricing
    return render_template("<module>_form_control.html", ...)

# 4. JSON API for custom fields
@app.route("/<module>/<int:entity_id>/custom-fields")
def <module>_custom_fields_api(entity_id):
    fields = db.execute("SELECT * FROM <entity>_custom_fields WHERE <entity>_id = ?", (entity_id,)).fetchall()
    return jsonify([dict(f) for f in fields])

# 5. Expenses/transactions (GET + POST)
@app.route("/<module>/<int:entity_id>/expenses", methods=["GET", "POST"])
def <module>_expenses(entity_id):
    if request.method == "POST":
        # INSERT expense row, log_action()
        pass
    return render_template("<module>_expenses.html", ...)

# 6. Archive/delete (POST)
# Handled inside the detail route via action == "archive_<entity>"
```

---

## Section 4: Copy-paste recipe — new module in 15 minutes

```bash
# Example: adding a "vehicles" module

# 1. Copy template files
cp templates/instruments.html templates/vehicles.html
cp templates/instrument_detail.html templates/vehicle_detail.html
cp templates/instrument_form_control.html templates/vehicle_form_control.html
cp templates/finance_grant_expenses.html templates/vehicle_expenses.html

# 2. Find-replace entity names in each template
sed -i '' 's/instrument/vehicle/g; s/Instrument/Vehicle/g' templates/vehicles.html
sed -i '' 's/instrument/vehicle/g; s/Instrument/Vehicle/g' templates/vehicle_detail.html
sed -i '' 's/instrument/vehicle/g; s/Instrument/Vehicle/g' templates/vehicle_form_control.html
sed -i '' 's/grant_expense/vehicle_expense/g; s/grant/vehicle/g' templates/vehicle_expenses.html

# 3. Add schema tables to ensure_schema() in app.py
#    Copy the 4-table pattern from Section 2, replace <entity> with vehicle.

# 4. Add routes — copy the instrument route block (~200 lines),
#    rename instrument -> vehicle, instrument_id -> vehicle_id.
#    Six handlers: list, detail, form_control, custom_fields_api,
#    expenses, (archive inside detail).

# 5. Register in module system
#    Add "vehicles" to ALL_MODULES set in app.py line ~123.

# 6. Add nav entry
#    In templates/sitemap.html, add a link to url_for('vehicles_list').
#    In base.html, add a breadcrumb block: {% block breadcrumb_vehicle %}{% endblock %}.

# 7. Add CSS grid alias (optional — reuse inst-tiles or add):
#    .vehicles-tiles { /* same as .inst-tiles */ }

# 8. Run smoke test
.venv/bin/python scripts/smoke_test.py
```

---

## Section 5: Common requirements for future modules

Every module can mix-and-match these capabilities from existing primitives:

| Capability | Primitive # | Key table/macro |
|---|---|---|
| Entity CRUD | 1, 2 | `<entities>` table + list/detail templates |
| Approval workflow | 5 | `<entity>_approval_config` + `approval_action_form` macro |
| Custom fields | 6 | `<entity>_custom_fields` + `fieldRowTemplate` pattern |
| Pricing / billing | 14 | Price columns + `instrument_form_control` tile 3 |
| Inventory / stock tracking | 17 (new) | `instrument_inventory` + tile-inventory pattern |
| Activity feed / event stream | 9 | `log_action()` + `activity_feed` macro |
| Team assignments | 8 | Junction table + `person_chip` in `team-columns` |
| Calendar integration | 16 | `<entity>_downtime` + `/calendar` route |
| KPI dashboard tiles | 12 | `stat_blob` / `kpi_grid` macro |
| Mailing list integration | 20 (new) | `mailing_lists` + `mailing_list_members` tables |
| Expense tracking | 21 (new) | `grant_expenses` pattern + expenses sub-page |
| File attachments | — | `request_attachments` pattern + `enctype="multipart/form-data"` |
| Email templates | 22 (new) | `instrument_email_templates` + form-control tile 4 |
| Leave / attendance | 18 (new) | `leave_requests` + `reporting_structure` + `attendance` |
| Status machine | 7 | `control-mode-row` + `intake-toggle.js` |
| Notification broadcast | 15 | `<entity>_notify` route + severity form |

---

## Appendix: Macro quick-reference

| Macro | Purpose |
|---|---|
| `card_heading(kicker, title, hint)` | Tile header with optional action slot |
| `paginated_pane(pane_id, page_size, max_height)` | Scrollable paginated table wrapper |
| `stat_blob(value, label, href, tone, dark, sub)` | Single KPI counter |
| `kpi_grid(items, variant)` | Grid of KPI counters |
| `person_chip(name, user_id, link, avatar, size, subtitle)` | Avatar + name chip |
| `metadata_grid(items, compact)` | Key-value `<dl>` grid |
| `status_pills_row(pills, active, row_id, data_attr)` | Filter pill row |
| `queue_action_stack(row, operators, post_action, ...)` | Inline accept/assign forms |
| `activity_feed(entries, pane_id, page_size, threaded)` | Paginated event timeline |
| `empty_state(message, hint, action_label, action_href)` | Zero-data placeholder |
| `toggleable_form(form_id, trigger_label, open, variant)` | Disclosure-wrapped form |
| `input_dialog(form_action, action_name, ...)` | Comment/message input panel |
| `approval_action_form(step, allow_file, allow_note)` | Approve/reject toggle |

## Appendix: CSS grid families

| Class | Used by | Columns |
|---|---|---|
| `.inst-tiles` | instrument_detail, form_control | 6-col grid, tiles span 1-6 |
| `.instruments-tiles` | instruments list | 6-col, all tiles span 6 |
| `.finance-tiles` | finance grants, grant detail, expenses | 4-col responsive |
| `.request-tiles` | request_detail | mirrors inst-tiles |

New modules should reuse `.inst-tiles` (detail pages) or
`.instruments-tiles` (list pages). Create a `.<module>-tiles` alias
only if the grid needs different column spans.
