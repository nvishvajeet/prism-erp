# CSS Component Map

The catalog of canonical CSS class families and the widget macros
that wrap them. Use this to avoid ad-hoc styling — every reusable
component has a class or a macro. Build new pages by composition,
not by writing new selectors.

This file reflects the post-Phase 5 architecture. The legacy
class families that were retired in W5.7 (`.grid-auto-stats`,
`.warroom-*`, `.bucket-link`, `.request-workspace`, `.grid-two`,
`.stream-pill`, `.role-toggle`, `.instrument-carousel`,
`.event-stream*`, etc.) are gone — do not reintroduce them.

---

## The 8 widget macros (`templates/_page_macros.html`)

Templates compose these. If you find yourself writing one of these
inline, stop and use the macro.

### `card_heading(prefix, title)`
Uniform tile header. Every `.tile` opens with this.

### `paginated_pane(id, page_size, max_height='none', css_class='')`
The only way to render a long list. Never use `overflow: auto`.
The `id` is unique per pane on a page; the JS engine in `base.html`
registers it and handles next/prev controls.

### `metadata_grid(items, compact=False)`
`<dl>` grid for label/value pairs.
- `items` is a list of `(label, value)` tuples or
  `(label, value, css_class)` triples.
- **String values are auto-escaped.** This is XSS-safe by default.
- Pass HTML via a `{% set var %}<a>...</a>{% endset %}` block —
  Jinja produces a `Markup` object that bypasses escaping safely.
- Never use string concatenation with `~` to build HTML; the result
  will be escaped.

### `kpi_grid(items, variant='card')`
KPI counter row. Variants: `card` (default), `dense` (finance),
`bare` (no background).

### `status_pills_row(pills, active, on_change)`
Filter pill bar. Replaces the legacy `.stream-pill`, `.role-toggle`,
and `.warroom-pill` families with a single `.filter-pill-row` /
`.filter-pill` pair.

### `queue_action_stack(row, operators, can_accept, can_assign)`
Per-row Accept Sample + Quick Assign forms. Used in
`schedule.html`, `instrument_detail.html`, and `dashboard.html`.

### `person_chip(name, user_id, size='md', link=True, avatar=True)`
Avatar circle + name (with optional link). Replaces ad-hoc team
lists everywhere.

### `approval_action_form(step, allow_file=False, allow_note=True)`
Approve / reject form for one approval step. Lives in the
`tile-approval` tile.

### `activity_feed(entries, pane_id, page_size=6, threaded=False)`
Wraps the timeline pattern. `threaded=True` enables left/right
message alignment for the request_detail conversation view.

### `empty_state(heading, body, icon=None)`
Every list / table needs an empty branch. Use this macro instead
of inline "no items" markup.

### `input_dialog(...)`
Universal disclosure pattern (replaces ad-hoc `<details>` and
modal divs).

---

## Tile architecture

Every page is a `*-tiles` grid container holding `card tile tile-{name}`
children. The 12 page-tile containers currently in the system:

| Container class       | Page                          |
|-----------------------|-------------------------------|
| `.dashboard-tiles`    | `dashboard.html`              |
| `.schedule-tiles`     | `schedule.html` (the Queue)   |
| `.request-tiles`      | `request_detail.html`         |
| `.inst-tiles`         | `instrument_detail.html`      |
| `.instruments-tiles`  | `instruments.html`            |
| `.stats-tiles`        | `stats.html`                  |
| `.finance-tiles`      | `finance.html`                |
| `.calendar-tiles`     | `calendar.html`               |
| `.pending-tiles`      | `pending.html`                |
| `.users-tiles`        | `users.html`                  |
| `.user-detail-tiles`  | `user_detail.html`            |
| `.viz-tiles`          | `visualization.html`          |

Reference implementation: **`instrument_detail.html` → `.inst-tiles` →
10 tiles on a 6-column grid.** CSS lives under "INSTRUMENT DETAIL —
TILE ARCHITECTURE" in `static/styles.css`. Match its rhythm.

### Common tile variants

| Class                       | Purpose                                       |
|-----------------------------|-----------------------------------------------|
| `.tile`                     | Base card variant — every tile carries it     |
| `.tile-info`                | Info panel with photo + metadata grid         |
| `.tile-stat-stack`          | Vertical stack of stat blobs                  |
| `.tile-queue`               | Queue table tile (compose with `tile-queue-schedule` etc.) |
| `.tile-pills`               | Holds the `status_pills_row` filter bar       |
| `.tile-filters-body`        | Search + dropdown filter cluster              |
| `.tile-bulk`                | Bulk-actions tile (visible when ≥1 row checked) |
| `.tile-control`             | Admin control panel                           |
| `.tile-activity`            | `activity_feed` host                          |
| `.tile-approval`            | `approval_action_form` host                   |
| `.tile-edit`                | Inline edit panels                            |
| `.tile-downtime`            | Upcoming downtime tile                        |
| `.tile-request-header-*`    | Request detail header sub-tiles               |
| `.tile-request-meta`        | Metadata grid tile on request_detail          |
| `.tile-request-files`       | Files pane on request_detail                  |
| `.tile-request-events`      | Activity feed on request_detail               |
| `.tile-request-actions-body`| Approve / reject / status change panel        |
| `.tile-dash-week` / `-month`/ `-quick-intake` / `-instrument-queues` / `-your-jobs` / `-downtime` | Dashboard sub-tiles |

---

## Canonical class families

These survived the W5.7 hygiene pass and are the building blocks
for any new component.

### `.card` — base container
Every visible content section. The `.tile` modifier adds tile
spacing on top.

### `.tile-*` — tile variants
See the table above.

### `.section-*` — section dividers within a tile
- `.section-head`, `.section-title`, `.section-kicker`
- `.section-actions` — right-aligned action buttons in a head
- `.section-collapse-btn` — collapse toggle

### `.meta-*` — metadata grids and stacks
- `.meta-grid` / `.meta-grid-compact` — `<dl>` grid (output of `metadata_grid`)
- `.meta-grid-row` — one row inside a meta grid
- `.meta-stack` — vertical stack alternative
- `.meta-section` / `.meta-separator` — section dividers
- `.meta-edit-form` / `.meta-edit-grid` / `.meta-edit-notes` /
  `.meta-edit-actions` / `.meta-edit-assignments` — inline edit
  forms (instrument detail metadata edit)

### `.paginated-pane-*` — pagination engine
- `.paginated-pane` — outer wrapper
- `.paginated-pane-controls` — page nav buttons
- `.paginated-pane-scroll` — the scroll container (clipped, never auto-overflowing)

### `.kpi-grid-*` — KPI counter grids
- `.kpi-grid` (default `card` variant)
- `.kpi-grid-card` / `.kpi-grid-dense` / `.kpi-grid-bare`

### `.filter-pill-*` — filter pill bar
- `.filter-pill-row` — horizontal container
- `.filter-pill` — base button
- `.filter-pill.is-active` — selected state (JS-applied)
- `.filter-pill-label` / `.filter-pill-count` — label text + count badge

### `.stat` — single stat blob
- `.stat-tone-active` (green) — active / in-progress
- `.stat-tone-wait` (amber) — pending / queued
- `.stat-tone-completed` (teal) — done
- `.stat-tone-samples` (blue) — sample counts
- `.stat-tone-week-jobs` (purple) — weekly metrics
- `.stat-tone-open` (orange) — open items

### `.toast-*` — toast notification stack (W6.8)
- `.toast-stack` — fixed-position container, top-right
- `.toast` — base toast
- `.toast-success` / `.toast-error` / `.toast-info` — variants
- `.toast-close` — dismiss button
- `.toast-leave` — exit animation state

### Status badges (`.badge.status-*`)
Rendered via `status_block()` macro in `_request_macros.html`.

| Class                              | Status                       |
|------------------------------------|------------------------------|
| `.badge.status-submitted`          | Submitted                    |
| `.badge.status-under_review`       | Under review                 |
| `.badge.status-awaiting_sample_submission` | Awaiting sample      |
| `.badge.status-sample_submitted`   | Sample submitted             |
| `.badge.status-sample_received`    | Sample received              |
| `.badge.status-scheduled`          | Scheduled                    |
| `.badge.status-in_progress`        | In progress                  |
| `.badge.status-completed`          | Completed                    |
| `.badge.status-rejected`           | Rejected                     |
| `.badge.status-cancelled`          | Cancelled                    |

Operation status: `.operation-status.operation-accepting`,
`.operation-on_hold`, `.operation-maintenance`.

### Buttons

| Class                 | Purpose                                       |
|-----------------------|-----------------------------------------------|
| `.btn`                | Base button                                   |
| `.btn-primary`        | Primary action (accent color)                 |
| `.btn-small` / `.small-button` | Compact button                       |
| `.btn-danger`         | Destructive action                            |
| `.btn-link` / `.link-button` | Text-style button                      |
| `.btn-open-queue` / `.btn-open-queue-sm` | Queue link buttons         |
| `.mini-icon-button`   | Icon-only ("+", "×")                          |

### Forms

| Class               | Purpose                                       |
|---------------------|-----------------------------------------------|
| `.form-grid`        | Standard form layout                          |
| `.compact-admin-form` | Compact admin form                          |
| `.inline-form`      | Single-line form                              |
| `.inline-action-stack` | Vertical action button stack               |
| `.inline-action-row`| Horizontal action button row                  |
| `.form-section`     | Grouped form section with bottom border       |

### Links

| Class               | Purpose                                       |
|---------------------|-----------------------------------------------|
| `.text-link`        | Standard inline link                          |
| `.request-link`     | Link to request detail                        |
| `.job-meta-link`    | Subtle metadata link                          |
| `.back-link`        | Navigation back link                          |

### Accessibility helpers

| Class               | Purpose                                       |
|---------------------|-----------------------------------------------|
| `.skip-nav`         | Visually hidden until focused; jumps to `#main-content` |
| `.is-hidden`        | Hide element (`display: none`)                |
| `.hint`             | Muted secondary text                          |
| `.muted-note`       | Muted paragraph note                          |

---

## Design tokens (`:root` variables)

### Spacing scale
`--spacing-xs: 0.3rem` · `--spacing-sm: 0.5rem` · `--spacing-md: 0.75rem`
· `--spacing-lg: 1rem` · `--spacing-xl: 1.25rem`

### Border radius
`--radius-full: 999px` · `--radius-lg: 16px` · `--radius-md: 12px`
· `--radius-sm: 8px`

### Font sizes
`--font-xs: 0.7rem` · `--font-sm: 0.78rem` · `--font-md: 0.88rem`
· `--font-lg: 1.1rem` · `--font-xl: 1.48rem`

### Status colors
`--op-accepting: #5a9b68` · `--op-hold: #d1a64b` · `--op-maintenance: #c06565`

### Lifecycle colors
`--lifecycle-done: #5d9b6a` · `--lifecycle-current: #3b6fc7`

### Theme accents
The accent color is `#3b6d99` (`<meta name="theme-color">` light)
and `#1a2230` (dark). Both are wired to `:root[data-theme="dark"]`
in `static/styles.css`.

---

## Discipline rules

1. **No new top-level class families** without a corresponding
   macro in `_page_macros.html`. Patterns that show up twice get a
   macro; one-off styling lives inside the tile that needs it.

2. **No `overflow: auto` inside content panes.** Use
   `paginated_pane`. The W5.7 hygiene pass deleted every legacy
   scroll container.

3. **No HTML strings concatenated with `~` in `metadata_grid`
   items.** Use `{% set var %}...{% endset %}` blocks; the result
   is `Markup` and bypasses escaping safely. Plain strings get
   auto-escaped.

4. **Every visible element carries `data-vis="{{ V }}"`.** Tested
   by the visibility audit (`crawlers/strategies/visibility.py`),
   171/171 baseline.

5. **Light + dark theme parity.** Every new color must have a
   `:root[data-theme="dark"]` override. The contrast crawler
   (`crawlers/strategies/contrast_audit.py`) catches WCAG AA
   regressions.

6. **`prefers-reduced-motion` honor.** Any animation must include
   the `@media (prefers-reduced-motion: reduce)` opt-out — see the
   `.toast` family for the pattern.
