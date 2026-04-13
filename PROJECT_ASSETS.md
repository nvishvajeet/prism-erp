# CATALYST Lab Scheduler — Reusable Assets for New Projects

> **Purpose:** Any AI agent building a new project on this machine
> can read this file to know what patterns, components, and code
> exist here and are safe to copy or adapt.

## Quick Facts

| Key | Value |
|---|---|
| Stack | Flask + Jinja2 + SQLite + vanilla JS |
| Theme | Dark/light via CSS custom properties on `:root[data-theme]` |
| Layout | Tile grid — every page is a CSS grid of `.card.tile` containers |
| Auth | Session-based, role-gated (9 roles), `@login_required` + `@role_required` |
| Deploy | Gunicorn behind mkcert HTTPS on Mac mini |

---

## 1. Jinja Macros (copy-ready UI primitives)

Source: `templates/_page_macros.html` and `templates/_request_macros.html`

### Page-Level Macros

| Macro | What It Does | When to Reuse |
|---|---|---|
| `stat_blob(value, label, href, tone)` | KPI counter block, 11 color tones | Any dashboard needing number tiles |
| `paginated_pane(pane_id, page_size)` | Client-side pagination wrapper | Long lists without server paging |
| `page_intro(kicker, title, hint)` | Section header with optional action button | Page or section openers |
| `card_heading(kicker, title, hint)` | Tile header row | Top of any `.card.tile` |
| `empty_state(message, hint, action_label)` | Centered "nothing here" placeholder | Zero-data states |
| `status_pills_row(pills, active)` | Horizontal filter pill bar with counts | Any filter UI |
| `person_chip(name, user_id, size)` | Avatar + name badge (sm/md/lg) | User references |
| `metadata_grid(items)` | Label/value `<dl>` pairs | Detail panels |
| `kpi_grid(items, variant)` | Grid of KPI blocks (card/bare/dense) | Summary dashboards |
| `input_dialog(form_action, ...)` | Comment/message form with optional file upload | Any input UI |
| `activity_feed(entries, threaded)` | Timeline with left/right alignment | Audit logs, comment threads |
| `toggleable_form(form_id, trigger_label)` | `<details>` disclosure pattern (3 variants) | Progressive disclosure |
| `chart_bar(label, value, width_pct)` | Horizontal bar chart row | Simple visual comparisons |
| `approval_action_form(step)` | Two-tap approve/reject toggle | Workflow actions |
| `queue_action_stack(row, operators)` | Accept + Quick Assign inline forms | Assignment UIs |

### Request-Specific Macros

| Macro | What It Does |
|---|---|
| `request_identity(row)` | Request number + sample count badge |
| `instrument_name_link(row)` | Instrument hyperlink with permission gate |
| `person_name_link(user_id, name)` | User profile link |
| `requester_block(row)` | Requester info with visibility control |
| `status_block(row)` | Status badge with group/summary |
| `attachment_list(row, map)` | File list with "show more" |

---

## 2. CSS Design System

Source: `static/styles.css` (first 200 lines = all variables)

### Color Tokens

```css
/* Light mode (default) */
--bg: #f5f4f0;  --panel: #ffffff;  --ink: #1d1d1f;
--accent: #0066cc;  --warm: #e8a735;  --danger: #c23b22;

/* Dark mode — auto-switches via :root[data-theme="dark"] */
--bg: #1a1a1a;  --panel: #242424;  --ink: #e5e5e5;
```

### Spacing & Sizing Scale

```css
--spacing-xs: 0.3rem;  --spacing-sm: 0.5rem;
--spacing-md: 0.75rem; --spacing-lg: 1rem;  --spacing-xl: 1.25rem;
--radius-sm: 8px;  --radius-md: 12px;  --radius-lg: 16px;
--font-xs: 0.7rem;  --font-sm: 0.78rem;  --font-md: 0.88rem;
```

### Status Tone System

11 tone variants (open, completed, samples, week-jobs, etc.) each
providing `--tone-{name}-bg`, `--tone-{name}-fg`, `--tone-{name}-accent`.
Reusable for any status-based coloring.

### Key Component Classes

- `.tile`, `.card` — Container primitives
- `.stat-blob`, `.dark-stat` — KPI blocks
- `.filter-pill-row` — Horizontal filter tabs
- `.person-chip-{sm,md,lg}` — User badges
- `.meta-grid` — Label/value pairs
- `.paginated-pane` — Pagination wrapper
- `.empty-state` — Zero-data placeholder
- `.chart-row`, `.chart-fill` — Bar charts

---

## 3. Backend Patterns

Source: `app.py`

### Authentication Decorators

```python
@login_required          # Redirect to login if no session
@role_required("admin")  # Enforce role membership
```

### Database Helpers

```python
get_db()                          # Flask g-scoped SQLite connection
query_all(sql, params) -> list    # Fetch all rows
query_one(sql, params) -> Row     # Fetch first row or None
execute(sql, params) -> int       # INSERT/UPDATE/DELETE, returns lastrowid
```

### Utility Functions

```python
log_action(actor, entity_type, entity_id, action, payload)  # SHA-256 audit chain
format_dt(v) -> "2026-04-13 10:42:15 UTC"
time_ago(v) -> "2 hours ago"
format_date(v) -> "Apr 13, 2026"
```

### Module System

9 toggleable modules via `CATALYST_MODULES` env var. Each module has:
- Routes, templates, nav badge counts
- `module_enabled(name)` check in templates and routes

### Route Pattern

All routes follow `/<resource>/[<id>]/[<action>]` with GET/POST split.
Form submissions use POST + hidden `action` field. Redirects preserve
filter state via `back` query param.

---

## 4. JavaScript Utilities

Source: `static/`

| File | What It Does | Reusable? |
|---|---|---|
| `sortable-table.js` | Click-to-sort table headers | Yes — drop into any table page |
| `keybinds.js` | `n` → new, `?` → help overlay | Pattern reusable, not file |
| `approval-toggle.js` | Two-tap approve/reject with JSON response | Pattern for any toggle action |

---

## 5. Tile Architecture

Every page is a CSS grid of self-contained tiles. Each tile wraps
1-3 Jinja macros and is composed, never written inline.

```html
<div class="dashboard-tiles">
  <div class="card tile tile-kpi">
    {{ kpi_grid(items, variant="card") }}
  </div>
  <div class="card tile tile-queue">
    {{ paginated_pane("queue", page_size=10) }}
    ...
  </div>
</div>
```

12 canonical page containers: dashboard, schedule, request, instrument,
instruments, stats, finance, calendar, users, user-detail, viz.

---

## 6. File Upload Pattern

```python
ALLOWED_EXTENSIONS = {"pdf", "png", "jpg", "jpeg", "xlsx", "csv", "txt"}
secure_filename()  # Werkzeug sanitization
save_instrument_image(id, file)  # Server-side optimization
```

Separate `UPLOAD_DIR` and `EXPORT_DIR` for demo vs operational mode.

---

## 7. Key Docs (read before building)

| Doc | What | When |
|---|---|---|
| `WORKFLOW.md` | Level-2 project rules, pre-commit gate | First session |
| `docs/PHILOSOPHY.md` | Hard/soft attribute contract | Before any schema change |
| `docs/CSS_COMPONENT_MAP.md` | Widget catalog with screenshots | Building new pages |
| `docs/ERP_MODULE_BUILDER.md` | Template for adding modules | Adding features |
| `docs/PROJECT.md` | Schema, security model, abstractions | Deep reference |
| `AGENTS.md` | AI agent onboarding checklist | First time building |

---

## 8. What NOT to Copy

- SQLite schema specifics (lab-domain, not general-purpose)
- Role definitions (9 lab-specific roles)
- Request status machine transitions (domain-locked)
- Audit trail SHA-256 chain (over-engineered for small projects)
