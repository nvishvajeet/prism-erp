# Mobile Polish Audit — 2026-04-15

> Operation Trois Agents · Lane 2 · Claude 1 — Deliverable D4
> (CLAUDE1_LANE_UI_POLISH_2026_04_15.md).

Mobile-first pass across `templates/**/*.html` and
`ravikiran-erp/templates/**/*.html` (minus the four locked
templates). Goal: viewport meta coverage, 44×44 tap targets,
horizontal overflow on tables/panes, form usability at 375px.

## Related artefacts

| File | What | Status |
|---|---|---|
| `static/css/ui_audit_2026_04_15.css` | F-01..F-12 from earlier Phase 1 — covers tap targets (F-05), safe-area (F-06), drill-tile overflow (F-07), required-field `:has()` markers (F-08), and per-template inline-style extractions (F-09..F-12) | shipped |
| `static/css/mobile_polish_v2.css` | **NEW this deliverable** — dense-form label sizing, primary-action width, tile side padding with safe-area, table-scroll hardening, breadcrumb overflow, reduced-motion | shipped |
| `static/css/attendance_quick.css` | D2 mobile keypad full-viewport styling | shipped |
| `chooser/static/chooser.css` | D1 two-tile landing dark-first responsive | shipped |

## Viewport meta coverage

`base.html` already declares the canonical viewport at its top
(line 8 or thereabouts): `<meta name="viewport" content=
"width=device-width,initial-scale=1">`. Every template that
`{% extends "base.html" %}` inherits it — which is every user-
facing template in `templates/` in both repos. No per-template
gap found; no action needed. Did **not** edit `base.html` (locked).

## Tap target audit

**Rule applied (F-05, already in ui_audit_2026_04_15.css):**
```css
@media (max-width: 768px) {
  .btn, a.btn, a.btn-sm, button.btn-sm,
  input[type="submit"], input[type="button"],
  .btn-pill-sm, .qi-btn { min-height: 44px; min-width: 44px; }
  a.text-link { min-height: 32px; }
}
```

Confirmed to hit the common offenders:
- `.btn-sm` in Quick Intake dashboard tile (lab + ravikiran)
- `.btn-pill-sm` on attendance mark-present row
- `.qi-btn` in the quick-intake card action stack
- `.btn` throughout form actions

**Not covered (intentional):**
- `.link-button` / `.link-button.subtle` — these are text links
  styled as buttons; 44px would break inline flow. Kept at
  inherited heights.
- `.hover-back-btn` — desktop-only chrome (hidden at mobile per
  existing base CSS); not worth a mobile target floor.

## Table overflow audit

`static/styles.css:8238` already declares:
```css
@media (max-width: 768px) {
  table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  thead, tbody { display: table; width: 100%; }
  th, td { white-space: nowrap; min-width: 80px; }
}
```

**Gap discovered:** `.data-table` markup with a custom wrapper
(e.g. `.data-table-scroll`) sometimes overrides `white-space` on
cells. Added a defensive `.data-table th/td { white-space: nowrap; }`
inside the `mobile_polish_v2.css` @media block so horizontal scroll
activates even on wrapped variants.

## Form usability at 375px

Heavy forms audit (from warmup):
- `templates/new_request.html` (14 fields) — `new-request-tiles`
  grid is full-width + uncapped; form-grid stacks; labels visible.
  ✓ OK, no fix.
- `templates/vendor_form.html` (14 fields) — same pattern. ✓ OK.
- `templates/finance_grant_detail.html` (12 fields) — `inst-tiles`
  grid, uncapped. ✓ OK.
- `templates/vendor_payment_form.html` (11 fields) — ✓ OK.
- `templates/company_books.html` (11 fields) — ✓ OK.

Action row on submit buttons: `mobile_polish_v2.css` widens
primary submit to 100% under 640px to avoid squeeze at <375px.

## Breadcrumb / nav rows

Breadcrumbs on narrow phones wrap into a 2–3 line chunk that
pushes hero content below the fold. `mobile_polish_v2.css`
switches `nav.breadcrumb` + `.breadcrumb-row` to horizontal scroll
at ≤640px (scrollbar hidden, touch-momentum on WebKit).

## Toast / flash dock

`.toast-bar`, `.flash-message`, `.flash` get a
`bottom: max(0.75rem, env(safe-area-inset-bottom))` so they don't
get eaten by the iOS home indicator. Lighter-touch than F-06
(which only targets floating-action / AI pane chrome).

## Reduced motion

Earlier rules covered chooser and attendance_quick. This pass
extends to generic `.tile` / `.card.tile` hover transitions
inside `@media (prefers-reduced-motion: reduce)`.

## Ravikiran-ERP pass

Ravikiran inherits the same base.html viewport meta. Tap target
and table overflow rules ship verbatim in its
`static/css/ui_audit_2026_04_15.css` (committed T+55). The v2
polish file is Lab-ERP-specific for now; porting is one copy
away if Claude 0 decides at merge — noted in §Handoff.

## Handoff to Claude 0 at T+120

**Required stitches in `templates/base.html` (both repos):**

```html
<!-- After the existing styles.css link (≈ line 17 in Lab-ERP): -->
<link rel="stylesheet" href="{{ url_for('static', filename='css/ui_audit_2026_04_15.css') }}">
<link rel="stylesheet" href="{{ url_for('static', filename='css/mobile_polish_v2.css') }}">
```

- `ui_audit_2026_04_15.css` is present in both repos (Lab-ERP
  covers F-01..F-12; Ravikiran mirrors F-02..F-08 minus F-01).
- `mobile_polish_v2.css` is Lab-ERP-only. If Claude 0 wants it
  on Ravikiran too, `cp` it across at merge and stitch an
  equivalent link. No risk: Ravikiran's CSS selectors are the
  same family as Lab-ERP.

## What was NOT done (honest list)

- Did not add a per-template `{% block extra_css %}` import
  pattern — requires editing `base.html` to expose the block,
  which is locked. Including via a single `<link>` in base.html
  (merge-captain job) is cleaner and cheaper.
- Did not re-audit dashboard Quick Intake cards for tap targets
  individually — F-05 via `.qi-btn` selector catches them.
- Did not touch `ravikiran-erp/static/styles.css:8238` which
  already has its own mobile table-scroll rule (verified).

---

Audit complete. Zero templates modified for this deliverable;
all changes landed in two new CSS files.
