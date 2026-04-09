# CSS Component Map

Every repeated UI element in the system, mapped to its CSS class and which templates use it. Use this to avoid ad-hoc styling — always use the component class.

## Core Components

### Cards (`.card`)
Container for any content section. Variants: `.card.compact` for tighter padding.

| Template | Usage |
|----------|-------|
| dashboard.html | Stats cards, instrument queue section, your jobs section |
| schedule.html | Queue controls, queue table |
| instrument_detail.html | Machine card, queue card, control panel card |
| request_detail.html | Main card, response card |
| stats.html | Warroom panel, data tables |
| instruments.html | Add instrument form |
| new_request.html | Request form card |
| calendar.html | Controls card |

Heading: use `card_heading()` macro from `_page_macros.html`.

---

### Stat Counters (`.stat`)
Numeric displays with labels. Always wrap in `.grid-auto-stats` container.

| Variant | Purpose |
|---------|---------|
| `.stat` | Base counter |
| `.stat.dark-stat` | Darker background variant |
| `.stat.stat-link` | Clickable (wrap in `<a>`) |
| `.stat-tone-active` | Green — active/in-progress |
| `.stat-tone-wait` | Amber — pending/queued |
| `.stat-tone-completed` | Teal — done |
| `.stat-tone-samples` | Blue — sample counts |
| `.stat-tone-week-jobs` | Purple — weekly metrics |
| `.stat-tone-open` | Orange — open items |

Used in: dashboard.html, instrument_detail.html, stats.html, visualization.html, user_detail.html

---

### Status Badges (`.badge.status-*`)
Rendered via `status_block()` macro in `_request_macros.html`.

| Class | State |
|-------|-------|
| `.badge.status-submitted` | Submitted |
| `.badge.status-under_review` | Under review |
| `.badge.status-sample_submitted` | Sample submitted |
| `.badge.status-sample_received` | Sample received |
| `.badge.status-scheduled` | Scheduled |
| `.badge.status-in_progress` | In progress |
| `.badge.status-completed` | Completed |
| `.badge.status-rejected` | Rejected |

Operation status: `.operation-status.operation-accepting`, `.operation-maintenance`, `.operation-on_hold`

---

### Pill Filters (`.stream-pill`)
Tab-like filter buttons. Base class: `.pill` (new unified base).

| Variant | Purpose |
|---------|---------|
| `.stream-pill` | Queue/schedule filters |
| `.stream-pill-pending` | Pending tone |
| `.stream-pill-done` | Completed tone |
| `.stream-pill-rejected` | Rejected tone |
| `.stream-pill-active` | Currently selected (JS-applied) |
| `.bucket-link` | Alternative pill from `quick_filter_strip()` macro |
| `.warroom-pill` | Stats page pills |

Used in: schedule.html, instrument_detail.html, stats.html, calendar.html

---

### Buttons

| Class | Purpose |
|-------|---------|
| `.btn` | Base button |
| `.btn-primary` | Primary action (accent color) |
| `.btn-small` / `.small-button` | Compact button |
| `.btn-danger` / `.danger` | Destructive action |
| `.btn-link` / `.link-button` | Text-style button |
| `.primary-action` | Legacy primary (works alongside .small-button) |
| `.btn-open-queue` | Open queue link button |
| `.btn-open-queue-sm` | Small queue button |
| `.mini-icon-button` | Icon-only button ("+") |

---

### Paginated Panes (`.paginated-pane`)
Rendered via `paginated_pane()` macro in `_page_macros.html`. Always use `max_height='none'` for no-scroll behavior.

| Pane ID | Template | Page Size |
|---------|----------|-----------|
| `quickIntake` | dashboard.html | 3 |
| `centralQueue` | schedule.html | 25 |
| `mainInstruments` | instruments.html | 25 |
| `archivedInstruments` | instruments.html | 25 |
| `instQueue` | instrument_detail.html | 5 |
| `instEvents` | instrument_detail.html | 10 |
| `reqFiles` | request_detail.html | 6 |
| `reqEvents` | request_detail.html | 10 |
| `statsInstrument` | stats.html | 10 |
| `statsWeekly` | stats.html | 10 |

---

### Tables

Column widths via `<col class="col-*">`:

| Class | Width | Used In |
|-------|-------|---------|
| `.col-name` | 16% | instruments |
| `.col-status` | 10% | instruments, schedule |
| `.col-return` | 8% | instruments |
| `.col-operators` | 16% | instruments |
| `.col-faculty` | 16% | instruments |
| `.col-location` | 14% | instruments |
| `.col-links` | 10% | instruments |
| `.col-request` | 14% | schedule |
| `.col-instrument` | 14% | schedule |
| `.col-requester` | 14% | schedule |
| `.col-time` | 14% | schedule |
| `.col-files` | 10% | schedule |
| `.col-action` | 10% | schedule |

Instrument detail queue: `.inst-queue-col-request` (30%), `.inst-queue-col-stage` (22%), `.inst-queue-col-time` (20%), `.inst-queue-col-action` (28%).

---

### Layout Grids

| Class | Columns | Used In |
|-------|---------|---------|
| `.grid-two` | 2 equal columns | dashboard, stats, sitemap, visualization |
| `.grid-auto-stats` | Auto-wrap stat counters | instrument_detail, stats |
| `.instrument-dashboard-layout` | 1fr / 2fr (33%/67%) | instrument_detail |
| `.request-workspace` | Main + sidebar | request_detail |
| `.new-request-layout` | Form + summary | new_request |

---

### Links

| Class | Purpose |
|-------|---------|
| `.text-link` | Standard inline link (blue, underline on hover) |
| `.request-link` | Link to request detail |
| `.job-meta-link` | Subtle metadata link |
| `.back-link` | Navigation back link |
| `.hover-back-btn` | Fixed floating back button |

Person links: use `person_name_link()` macro. Request links: use `request_identity()` macro.

---

### Forms

| Class | Purpose |
|-------|---------|
| `.form-grid` | Standard form layout |
| `.compact-admin-form` | Compact admin form |
| `.inline-form` | Single-line form |
| `.inline-action-stack` | Vertical action buttons |
| `.inline-action-row` | Horizontal action buttons |
| `.form-section` | Grouped form section with bottom border |
| `.queue-control-strip` | Control bar with filters |

---

### Utility Classes

| Class | Purpose |
|-------|---------|
| `.is-hidden` | Hide element (`display: none`) |
| `.hint` | Muted secondary text |
| `.muted-note` | Muted paragraph note |
| `.detail-grid` | Key-value detail display |
| `.compact-detail-grid` | Compact key-value |
| `.people-list` | List of people |
| `.compact-people-list` | Compact people list |

---

## Design Variables (`:root`)

### Spacing Scale
`--spacing-xs: 0.3rem` · `--spacing-sm: 0.5rem` · `--spacing-md: 0.75rem` · `--spacing-lg: 1rem` · `--spacing-xl: 1.25rem`

### Border Radius
`--radius-full: 999px` · `--radius-lg: 16px` · `--radius-md: 12px` · `--radius-sm: 8px`

### Font Sizes
`--font-xs: 0.7rem` · `--font-sm: 0.78rem` · `--font-md: 0.88rem` · `--font-lg: 1.1rem` · `--font-xl: 1.48rem`

### Status Colors
`--op-accepting: #5a9b68` · `--op-hold: #d1a64b` · `--op-maintenance: #c06565`

### Lifecycle Colors
`--lifecycle-done: #5d9b6a` · `--lifecycle-current: #3b6fc7`
