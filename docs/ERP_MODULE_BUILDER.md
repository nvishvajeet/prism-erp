# PRISM ERP Module Builder

> Build a complete ERP module in 15 minutes using PRISM's component library.

## Architecture Overview

PRISM is a single-file Flask ERP (`app.py`, ~7 000 lines) with:

- **SQLite database** — schema defined in `init_db()` (~line 3433). WAL mode, foreign keys enforced.
- **Jinja2 templates** — every page extends `templates/base.html` and imports macros from `templates/_page_macros.html`.
- **CSS** — single file `static/styles.css` using CSS custom properties (`--ink`, `--muted`, `--accent`, `--panel`, etc.) with automatic dark-mode support via `[data-theme="dark"]`.
- **Role-based access** — `user_access_profile(user)` returns a dict of boolean capabilities; routes check these before rendering.
- **Module toggle** — `PRISM_MODULES` env var controls which modules are enabled. `module_enabled(name)` gate in templates and routes.

## The 6 Primitives

Every PRISM page is built from 6 primitives:

1. **App** — A module (instruments, finance, attendance, etc.). Registered in `ALL_MODULES` at the top of `app.py` and toggled via `PRISM_MODULES`.
2. **Tile** — A card container (`.card.tile`). Self-contained section with a heading and body. Pages are grids of tiles.
3. **Widget** — A data display inside a tile (`stat_blob`, `metadata_grid`, `kpi_grid`, `paginated_pane`, `activity_feed`).
4. **Button** — Action triggers (`.btn`, `.btn-primary`, `.text-link`, `.link-button`).
5. **Badge** — Status indicators (`.badge.status-*`, `.operation-status`).
6. **Background** — Page layout (`.inst-tiles` grid, `.inst-header`, `section` containers).

## Step-by-Step: Build a Module

### Step 1: Schema (in `app.py` `init_db()`)

Add your `CREATE TABLE` inside the `cur.executescript(...)` block in `init_db()` (starts at line ~3441). Follow the existing pattern:

```sql
CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

For columns added after initial release, use `ALTER TABLE` with a try/except pattern (search `app.py` for `ALTER TABLE` examples — PRISM uses this for backward-compatible schema migration inside `init_db()`).

### Step 2: Routes (in `app.py`)

Every route follows this pattern:

```python
@app.route("/vehicles", methods=["GET", "POST"])
@login_required
def vehicles():
    user = current_user()
    # Access check — use user_access_profile() or a module-specific check
    if not user_access_profile(user)["can_access_vehicles"]:
        abort(403)

    if request.method == "POST":
        action = request.form.get("action", "").strip()
        if action == "create_vehicle":
            # validate, INSERT, log_action(), flash(), redirect
            name = request.form.get("name", "").strip()
            if not name:
                flash("Name is required.", "error")
                return redirect(url_for("vehicles"))
            execute("INSERT INTO vehicles (name, code) VALUES (?, ?)", (name, code))
            log_action(user["id"], "vehicle", new_id, "vehicle_created", {"name": name})
            flash(f"{name} added.", "success")
            return redirect(url_for("vehicles"))
        abort(400)

    # GET — query and render
    rows = query("SELECT * FROM vehicles WHERE status = 'active' ORDER BY name")
    return render_template("vehicles.html", vehicles=rows)
```

Key helpers available to every route:
- `query(sql, params)` — returns list of Row dicts
- `query_one(sql, params)` — returns single Row or None
- `execute(sql, params)` — INSERT/UPDATE/DELETE, returns cursor
- `log_action(user_id, entity_type, entity_id, action, details_dict)` — audit trail (mandatory for all writes)
- `current_user()` — returns the logged-in user Row
- `flash(message, category)` — categories: `"success"`, `"error"`, `"info"`

### Step 3: Access Profile

Add your module's capability flags to `user_access_profile()` (search for `def user_access_profile` in `app.py`). The function returns a dict of booleans keyed by capability name:

```python
"can_access_vehicles": role in {"super_admin", "site_admin", "operator"},
"can_edit_vehicles": role in {"super_admin", "site_admin"},
```

### Step 4: Template (`templates/vehicles.html`)

Every template follows this exact boilerplate:

```html
{% extends "base.html" %}
{% from "_page_macros.html" import card_heading, paginated_pane with context %}
{% block content %}

{# ── Header tile ──────────────────────────────────────────── #}
<div class="inst-header" data-vis="{{ V }}">
  <div class="inst-header-top" data-vis="{{ V }}">
    <div data-vis="{{ V }}">
      <h2 class="inst-header-title" data-vis="{{ V }}">Vehicle Fleet</h2>
      <p class="inst-header-code" data-vis="{{ V }}">Manage all vehicles</p>
    </div>
  </div>
</div>

{# ── Tile grid ────────────────────────────────────────────── #}
<section class="inst-tiles vehicle-tiles" data-vis="{{ V }}">

  {# Tile 1: Active vehicles #}
  <div class="card tile tile-vehicle-list" data-vis="{{ V }}">
    {{ card_heading('Fleet', 'Active Vehicles') }}
    {% call paginated_pane('vehicleList', page_size=10) %}
    <table class="data-table" data-vis="{{ V }}">
      <thead data-vis="{{ V }}"><tr data-vis="{{ V }}">
        <th data-vis="{{ V }}">Name</th>
        <th data-vis="{{ V }}">Category</th>
        <th data-vis="{{ V }}">Status</th>
      </tr></thead>
      <tbody data-vis="{{ V }}">
        {% for v in vehicles %}
        <tr data-pane-item data-vis="{{ V }}">
          <td data-vis="{{ V }}"><a href="{{ url_for('vehicle_detail', vehicle_id=v['id']) }}" data-vis="{{ V }}">{{ v["name"] }}</a></td>
          <td data-vis="{{ V }}">{{ v["category"] }}</td>
          <td data-vis="{{ V }}"><span class="badge status-{{ v['status'] }}" data-vis="{{ V }}">{{ v["status"] }}</span></td>
        </tr>
        {% endfor %}
      </tbody>
    </table>
    {% endcall %}
  </div>

</section>

{% endblock %}
```

Critical template rules:
- **Every visible element** must carry `data-vis="{{ V }}"` — this is the two-layer visibility system (hard attribute, do not skip).
- **`data-pane-item`** on each `<tr>` or repeating element enables `paginated_pane` JS pagination.
- Use `card_heading(kicker, title, hint='')` for every tile header.

### Step 5: CSS (`static/styles.css`)

Follow the tile class naming convention:

```css
/* ── Vehicle Fleet module ────────────────────────────────── */
.vehicle-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(22rem, 1fr));
  gap: var(--grid-gap, 1rem);
}

.tile-vehicle-list { /* any tile-specific overrides */ }
```

The grid layout inherits from `.inst-tiles` if you reuse that class, or define your own `.<module>-tiles` section.

### Step 6: Navigation (`templates/base.html`)

Add a nav link gated by `module_enabled()` and the user's access profile. Insert in the nav section (around line 90-185 in base.html):

```html
{% if module_enabled('vehicles') and access_profile_user.can_access_vehicles %}
<a class="{% if endpoint == 'vehicles' %}nav-active{% endif %}"
   href="{{ url_for('vehicles') }}" data-vis="{{ V }}">Vehicles</a>
{% endif %}
```

### Step 7: Module Registration

1. Add the module name to `ALL_MODULES` set at the top of `app.py`:

```python
ALL_MODULES = {
    "instruments", "finance", "inbox", "notifications",
    "attendance", "queue", "calendar", "stats", "admin",
    "vehicles",  # <-- new
}
```

2. The module is enabled by default (when `PRISM_MODULES` env var is unset). To disable, set `PRISM_MODULES` to a list that excludes it.

3. Add a comment to the module registry block:

```python
#   vehicles     - Vehicle Fleet (list, detail, booking)
```

## Template Macros Reference

All macros live in `templates/_page_macros.html`. Import with:
```html
{% from "_page_macros.html" import macro_name with context %}
```

| Macro | Purpose | Usage |
|---|---|---|
| `paginated_pane(pane_id, page_size=10, max_height='28rem')` | Client-side pagination wrapper | `{% call paginated_pane('myPane') %}...{% endcall %}` |
| `page_intro(kicker, title, hint='')` | Full-width page introduction header | `{{ page_intro('Module', 'Page Title') }}` |
| `stat_blob(value, label, href='#', tone='', sub='')` | Single KPI stat card | `{{ stat_blob(42, 'Active Items', tone='success') }}` |
| `chart_bar(label, value, width_pct)` | Horizontal bar chart row | `{{ chart_bar('Category A', 15, 75) }}` |
| `input_dialog(form_action, action_name, ...)` | Form with textarea + submit | `{{ input_dialog('/route', 'send_message') }}` |
| `empty_state(message, hint='', action_label='', action_href='')` | Empty placeholder when no data | `{{ empty_state('No vehicles yet', hint='Add one above') }}` |
| `card_heading(kicker, title, hint='')` | Tile header with kicker + title | `{{ card_heading('Fleet', 'Active Vehicles') }}` |
| `status_pills_row(pills, active='')` | Horizontal filter pill bar | `{{ status_pills_row(['all','active','retired']) }}` |
| `person_chip(name, user_id=None, link=True)` | Avatar + name inline chip | `{{ person_chip('Alice', user_id=3) }}` |
| `metadata_grid(items, compact=False)` | Key-value grid for entity metadata | `{{ metadata_grid([('Make','Toyota'),('Year','2024')]) }}` |
| `kpi_grid(items, variant='card')` | Grid of KPI stat blobs | `{{ kpi_grid([{'value':5,'label':'Active'}]) }}` |
| `approval_action_form(step, allow_file=False)` | Approve/reject action buttons | `{{ approval_action_form(step) }}` |
| `queue_action_stack(row, operators, post_action)` | Queue row action buttons | `{{ queue_action_stack(row, ops, '/action') }}` |
| `activity_feed(entries, pane_id, page_size=6)` | Paginated event stream | `{{ activity_feed(events, 'actFeed') }}` |
| `toggleable_form(form_id, trigger_label, open=False)` | Collapsible form section | `{% call toggleable_form('addForm','Add New') %}...{% endcall %}` |

## Complete Example: Building a "Vehicle Fleet" Module

This walks through every file change to add a minimal vehicle management module.

### 1. Schema — `app.py` inside `init_db()`

Add after the last `CREATE TABLE` block:

```sql
CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL DEFAULT 'car',
    license_plate TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    notes TEXT NOT NULL DEFAULT '',
    assigned_to INTEGER DEFAULT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (assigned_to) REFERENCES users(id)
);
```

### 2. Module registration — `app.py` top

```python
ALL_MODULES = {
    "instruments", "finance", "inbox", "notifications",
    "attendance", "queue", "calendar", "stats", "admin",
    "vehicles",
}
```

Add to the comment block:
```python
#   vehicles     — Vehicle Fleet (list, detail, assignment)
```

### 3. Access profile — `app.py` `user_access_profile()`

Add to the returned dict:
```python
"can_access_vehicles": role in {"super_admin", "site_admin", "operator", "instrument_admin"},
"can_manage_vehicles": role in {"super_admin", "site_admin"},
```

### 4. Routes — `app.py`

```python
# ── Vehicle Fleet ─────────────────────────────────────────────────

@app.route("/vehicles", methods=["GET", "POST"])
@login_required
def vehicles():
    user = current_user()
    if not module_enabled("vehicles"):
        abort(404)
    if not user_access_profile(user)["can_access_vehicles"]:
        abort(403)

    can_manage = user_access_profile(user)["can_manage_vehicles"]

    if request.method == "POST" and can_manage:
        action = request.form.get("action", "").strip()
        if action == "create_vehicle":
            name = request.form.get("name", "").strip()
            code = request.form.get("code", "").strip()
            category = request.form.get("category", "car").strip()
            license_plate = request.form.get("license_plate", "").strip()
            if not name or not code:
                flash("Name and code are required.", "error")
                return redirect(url_for("vehicles"))
            execute(
                """INSERT INTO vehicles (name, code, category, license_plate)
                   VALUES (?, ?, ?, ?)""",
                (name, code, category, license_plate),
            )
            new = query_one("SELECT id FROM vehicles WHERE code = ?", (code,))
            if new:
                log_action(user["id"], "vehicle", new["id"], "vehicle_created",
                           {"name": name, "code": code})
            flash(f"{name} added to fleet.", "success")
            return redirect(url_for("vehicles"))
        abort(400)

    active = query("SELECT * FROM vehicles WHERE status = 'active' ORDER BY name")
    retired = query("SELECT * FROM vehicles WHERE status = 'retired' ORDER BY name")
    return render_template("vehicles.html",
                           vehicles_active=active,
                           vehicles_retired=retired,
                           can_manage=can_manage)


@app.route("/vehicles/<int:vehicle_id>")
@login_required
def vehicle_detail(vehicle_id):
    user = current_user()
    if not module_enabled("vehicles"):
        abort(404)
    if not user_access_profile(user)["can_access_vehicles"]:
        abort(403)
    vehicle = query_one("SELECT * FROM vehicles WHERE id = ?", (vehicle_id,))
    if not vehicle:
        abort(404)
    assignee = None
    if vehicle["assigned_to"]:
        assignee = query_one("SELECT id, name, email FROM users WHERE id = ?",
                             (vehicle["assigned_to"],))
    return render_template("vehicle_detail.html", vehicle=vehicle, assignee=assignee)
```

### 5. Template — `templates/vehicles.html`

```html
{% extends "base.html" %}
{% from "_page_macros.html" import card_heading, paginated_pane, empty_state with context %}
{% block content %}

<div class="inst-header" data-vis="{{ V }}">
  <div class="inst-header-top" data-vis="{{ V }}">
    <div data-vis="{{ V }}">
      <h2 class="inst-header-title" data-vis="{{ V }}">Vehicle Fleet</h2>
      <p class="inst-header-code" data-vis="{{ V }}">{{ vehicles_active|length }} active</p>
    </div>
  </div>
</div>

<section class="inst-tiles vehicle-tiles" data-vis="{{ V }}">

  {# Tile: Active fleet #}
  <div class="card tile tile-vehicle-list" data-vis="{{ V }}">
    {{ card_heading('Fleet', 'Active Vehicles') }}
    {% if vehicles_active %}
    {% call paginated_pane('vehicleActive', page_size=10) %}
    <table class="data-table" data-vis="{{ V }}">
      <thead data-vis="{{ V }}"><tr data-vis="{{ V }}">
        <th data-vis="{{ V }}">Name</th>
        <th data-vis="{{ V }}">Code</th>
        <th data-vis="{{ V }}">Category</th>
        <th data-vis="{{ V }}">License</th>
      </tr></thead>
      <tbody data-vis="{{ V }}">
        {% for v in vehicles_active %}
        <tr data-pane-item data-vis="{{ V }}">
          <td data-vis="{{ V }}"><a href="{{ url_for('vehicle_detail', vehicle_id=v['id']) }}" data-vis="{{ V }}">{{ v["name"] }}</a></td>
          <td data-vis="{{ V }}">{{ v["code"] }}</td>
          <td data-vis="{{ V }}">{{ v["category"] }}</td>
          <td data-vis="{{ V }}">{{ v["license_plate"] or "---" }}</td>
        </tr>
        {% endfor %}
      </tbody>
    </table>
    {% endcall %}
    {% else %}
    {{ empty_state('No vehicles in fleet', hint='Add one below') }}
    {% endif %}
  </div>

  {# Tile: Add vehicle (admin only) #}
  {% if can_manage %}
  <div class="card tile tile-vehicle-create" data-vis="{{ V }}">
    {{ card_heading('New', 'Add Vehicle') }}
    <form method="POST" data-vis="{{ V }}">
      <input type="hidden" name="csrf_token" value="{{ csrf_token }}" />
      <input type="hidden" name="action" value="create_vehicle" />
      <div class="form-grid" data-vis="{{ V }}">
        <label data-vis="{{ V }}">Name <input name="name" required data-vis="{{ V }}" /></label>
        <label data-vis="{{ V }}">Code <input name="code" required data-vis="{{ V }}" /></label>
        <label data-vis="{{ V }}">Category <input name="category" value="car" data-vis="{{ V }}" /></label>
        <label data-vis="{{ V }}">License plate <input name="license_plate" data-vis="{{ V }}" /></label>
      </div>
      <button type="submit" class="btn btn-primary" data-vis="{{ V }}">Add Vehicle</button>
    </form>
  </div>
  {% endif %}

</section>

{% endblock %}
```

### 6. Nav link — `templates/base.html`

Add before the Dev link (admin-only section):

```html
{% if module_enabled('vehicles') and access_profile_user.can_access_vehicles %}
<a class="{% if endpoint == 'vehicles' %}nav-active{% endif %}"
   href="{{ url_for('vehicles') }}" data-vis="{{ V }}">Fleet</a>
{% endif %}
```

### 7. CSS — `static/styles.css`

```css
/* ── Vehicle Fleet module ────────────────────────────────── */
.vehicle-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(22rem, 1fr));
  gap: var(--grid-gap, 1rem);
}
```

### Verification checklist

After building your module:

- [ ] `init_db()` creates the table (delete `lab_scheduler.db` to re-init, or use ALTER TABLE)
- [ ] Module name is in `ALL_MODULES`
- [ ] Access flags exist in `user_access_profile()`
- [ ] Route checks `module_enabled()` and access profile before serving
- [ ] Template extends `base.html`, uses `data-vis="{{ V }}"` on every element
- [ ] CSRF token is in every form (`<input type="hidden" name="csrf_token" value="{{ csrf_token }}" />`)
- [ ] `log_action()` called on every write operation
- [ ] Nav link is gated by `module_enabled()` and access profile
- [ ] Smoke test passes: `.venv/bin/python scripts/smoke_test.py`
