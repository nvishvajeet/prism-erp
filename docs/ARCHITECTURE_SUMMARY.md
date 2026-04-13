# CATALYST Architecture Summary

> Complete reference for the UI/UX system, CSS architecture, and
> ERP module patterns. Read this before building anything.

## System Stats (2026-04-13)

| Metric | Value |
|--------|-------|
| app.py | 16,587 lines |
| styles.css | 9,684 lines |
| Templates | 68 |
| Routes | 140 |
| Modules | 15 |
| Roles | 9 crawler personas / 8+ product roles |
| Instruments | 21 |
| Crawler strategies | 25 |

## The 6 UI Primitives

Every CATALYST page is built from exactly 6 primitives:

### 1. App (Module)
A self-contained ERP feature area registered in `MODULE_REGISTRY`.
Each has: routes, templates, nav entry, access gates, optional schema.
Examples: instruments, finance, receipts, attendance, inbox.

### 2. Tile
A `<section class="card tile">` in a CSS grid. The fundamental
container. Always has a `card_heading()` as first child.
Spans: `tile-span-3` (half), `tile-full-width` (full row).

### 3. Widget
A data display INSIDE a tile. Types:
- `stat_blob()` — KPI counter with tone color
- `metadata_grid()` — label/value pairs
- `paginated_pane()` — scrollable table with pagination
- `person_chip()` — avatar + name + email
- `status_pills_row()` — filter pill buttons
- `empty_state()` — "no data" placeholder with CTA
- `chart_bar()` — horizontal bar chart row

### 4. Button
Action triggers. Classes:
- `.btn` — base (neutral background)
- `.btn-primary` — accent background
- `.btn-sm` — small
- `.btn-pill-sm` — compact pill
- `.text-link` — inline link
- `.link-button` — looks like link, behaves as button
- `.qi-btn` — quick intake actions (accept/decline/view)

### 5. Badge
Status indicators. Pattern: `<span class="badge status-{status}">`.
Colors: pending=amber, approved=green, rejected=red, partial=blue.
Variants: `.badge-sm`, `.badge-green`, `.badge-amber`.

### 6. Background
Page-level layout. Grid containers:
- `.dashboard-tiles` — 6-col, gap 0.5rem, dense flow
- `.inst-tiles` — 6-col, gap 0.35rem, dense flow
- `.finance-tiles` — 6-col
- `.instruments-tiles` — 6-col
- `.inst-header` — page header with title + actions

## CSS Architecture

### Custom Properties
```
--bg, --panel, --ink, --muted, --line, --accent, --danger, --warm
--hover-soft, --surface, --lifecycle-ok/warn/danger
```
All have dark-mode overrides in `:root[data-theme="dark"]`.

### Tile Rules
- `.tile { max-height: 600px }` — default cap
- Content pages override: `.inst-tiles > .tile { max-height: none }`
- `.tile > * { overflow: visible }` — no internal scroll
- `.tile-scroll` — opt-in scroll for specific content

### Grid Spans
- `.tile-span-3` → `grid-column: span 3` (half width)
- `.tile-full-width` → `grid-column: 1 / -1` (full width)
- Never use inline `style="grid-column: ..."` on tiles

### Responsive Breakpoints
- `1200px` — 4-column layouts
- `760px` — 1-column layouts
- `480px` — small phone (single column, stacked header)

### Dark Mode
Every color uses CSS custom properties. Dark theme via
`:root[data-theme="dark"]`. Toggle in base.html JS.

## Template Patterns

### Every template MUST:
1. `{% extends "base.html" %}`
2. Import macros: `{% from "_page_macros.html" import ... with context %}`
3. Have `data-vis="{{ V }}"` on every element
4. Have `<input type="hidden" name="csrf_token" value="{{ csrf_token() }}">` in every POST form
5. Use `card_heading()` as first child of every tile
6. Use `empty_state()` for empty lists (not raw `<p>`)
7. Use CSS classes for grid spans (never inline styles)

### Page header pattern:
```html
<header class="inst-header" data-vis="{{ V }}">
  <div class="inst-header-main" data-vis="{{ V }}">
    <a class="text-link back-link" href="...">← Back</a>
    <h2 class="inst-header-title">Page Title</h2>
  </div>
  <div class="inst-header-actions" data-vis="{{ V }}">
    <a class="btn btn-primary" href="...">Primary Action</a>
  </div>
</header>
```

### Tile pattern:
```html
<section class="card tile tile-span-3" data-vis="{{ V }}">
  {{ card_heading("KICKER", "Title") }}
  <!-- content -->
</section>
```

### Clickable rows:
```html
<tr class="clickable-row" data-href="{{ url }}">...</tr>
```
With JS: `document.querySelectorAll('.clickable-row[data-href]')...`

## Role Access Model

8 roles, hierarchical capabilities:

| Role | Cap count | Key access |
|------|-----------|------------|
| super_admin | 17 | Everything |
| site_admin | 14 | Users, settings, instruments |
| instrument_admin | 10 | Assigned instruments, queue |
| operator | 10 | Assigned instruments, queue |
| professor_approver | 13 | Approvals, instruments |
| finance_admin | 10 | Finance, grants, invoices |
| faculty_in_charge | — | Not seeded |
| requester | 3 | Own requests, inbox, notifications |

Access via `user_access_profile(user)` → dict of booleans.
Modules gated by `module_enabled('name')` + access profile.

## Module Registry

```python
MODULE_REGISTRY = {
    "instruments": {"label": "Instruments", "nav_order": 1, ...},
    "finance": {"label": "Finance", "nav_order": 2, ...},
    ...
}
```

Nav bar generated dynamically from registry. To add a module:
```bash
scripts/new_module.sh vehicle "Vehicle Fleet" "car" "Fleet management"
```

## Quality Gates

### Pre-commit:
```bash
./venv/bin/python scripts/smoke_test.py  # ~5s, mandatory
```

### Pre-push (automatic via pre-receive hook):
```bash
.venv/bin/python -m crawlers run smoke  # ~2s on branch push
.venv/bin/python -m crawlers wave sanity  # ~30s on tag push
```

### Deep crawl:
```bash
# Mac mini safety gate
ssh vishwajeet@100.115.176.118 "cd ~/Scheduler/Main && .venv/bin/python -m crawlers wave sanity" &

# Local exploratory deep walk
./venv/bin/python -m crawlers run random_walk --steps 50000

# Local broader exploration
./venv/bin/python -m crawlers wave coverage
```

`random_walk` writes to `reports/random_walk_log.json` and
`reports/random_walk_report.txt`.

## Verification Matrix

| Check | Tool | Count |
|-------|------|-------|
| Route health | Python test client | 371 (7 roles × 53 routes) |
| Smoke test | crawlers/smoke | 33 |
| Visibility | crawlers/visibility | 84 |
| Dead links | crawlers/dead_link | 4,481 |
| Random walk | crawlers/random_walk | 800 |
| WCAG contrast | crawlers/contrast_audit | 13 |
| Template syntax | Jinja2 env | 52 |
| CSRF coverage | grep audit | 100% |

## Deployment Checklist

1. Set `LAB_SCHEDULER_DEMO_MODE=0`
2. Set `OWNER_EMAILS=real@email.com`
3. Set `LAB_SCHEDULER_SECRET_KEY=<random 64 chars>`
4. Set `LAB_SCHEDULER_CSRF=1`
5. Set `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` (optional)
6. Run `./venv/bin/python scripts/smoke_test.py`
7. Start with `gunicorn app:app -w 4 --bind 0.0.0.0:5055`

## Current Structural Hotspots

These are not outages, but they are the main places future builders
should avoid copying blindly:

- `request_detail()` is still the biggest route hub and remains the
  clearest decomposition target.
- `instrument_detail()` is operationally rich but too broad to be the
  default pattern for new module pages.
- `init_db()` is still one large shared migration surface.
- `static/styles.css` is still above the crawler comfort budget and
  carries too many page-specific exceptions.
- Several templates are over the architecture crawler's preferred size
  budget, especially `base.html`, `instrument_detail.html`, and
  `portfolio.html`.
