# Inline-style cleanup — `inline_style_attribute` crawler

_Anchored 2026-04-15. Crawler shipped in `8f948fa crawlers: add_
_inline_style_attribute — flag literal style= in templates`._

## What the crawler catches

Every `style="..."` / `style='...'` attribute in `templates/**/*.html`
whose value is a **literal** (contains no Jinja expression). Example
offenders:

```html
<!-- flagged: literal value -->
<div style="display:flex;gap:10px;margin-top:12px">
<td style="text-align:right;font-variant-numeric:tabular-nums">

<!-- NOT flagged: render-time value -->
<div style="width: {{ pct }}%">
```

## Why this matters

Inline styles fork the token ladder in `static/styles.css`. When a
global pass updates the ladder (dark-mode, token rename, spacing
scale change), every non-inline consumer updates for free. Inline
`style=` attributes silently drift and produce the "why is THIS
one widget still using the old grey" class of bug.

The invariant is already enforced by habit in commits like
`cf1167c deploy-ready: CSRF on intake forms, zero inline tile
styles`. The crawler locks it in mechanically.

## Current baseline

**665 literal inline styles across 89 templates** (2026-04-15).
Top offenders:

| file | count |
|---|---:|
| `_hub.html` | 78 |
| `tuck_shop_terminal.html` | 38 |
| `_base_ai_pane.html` | 32 |
| `attendance_team.html` | 24 |
| `mess_student_detail.html` | 23 |
| `tuck_shop_token_issue.html` | 22 |
| `tally_export.html` | 21 |
| `mess_scan.html` | 18 |
| `personnel.html` | 17 |
| `portfolio.html` | 17 |

Run `python3 -m crawlers run inline_style_attribute` for the live
list. The report writes to `reports/inline_style_attribute_report.txt`.

## How to clear a file

Three patterns cover the majority of findings. Use the one that
matches the style value; prefer reusing an existing class over
inventing a new one.

### Pattern 1 — replace with an existing widget macro

Most inline styles are re-creating a tile/pill/row that already
has a macro in `templates/_page_macros.html`. See
`docs/CSS_COMPONENT_MAP.md` for the canonical 8 widgets.

```html
<!-- before -->
<div style="display:flex;gap:0.5rem;align-items:center">
  <span class="badge">OK</span>
  <small style="color:var(--muted)">last checked 5m ago</small>
</div>

<!-- after — use a macro or an existing utility selector -->
{% call card_heading('STATUS', 'Last check') %}
  <span class="badge">OK</span>
{% endcall %}
```

### Pattern 2 — replace with an existing class

Common inline styles that already have a selector in `styles.css`:

| inline style | existing class |
|---|---|
| `text-align:right;font-variant-numeric:tabular-nums` | `.num-cell` (add if missing) |
| `display:flex;gap:Xrem;flex-wrap:wrap` | `.row-wrap` / `.tag-list` |
| `margin-top:Xpx` near a hint paragraph | `p.hint` already spaces correctly |
| `style="width:Npx"` on a table `<th>` | `<col width="N">` or a named col class |
| `style="align-self:center"` inside a flex row | `.self-center` (add if missing) |

Before adding a new class: grep `static/styles.css` for an existing
one first. The ladder has grown organically and often already has
a selector close to what you need.

### Pattern 3 — hoist into `static/styles.css` under a semantic class

If the inline style has no existing analogue and is used more than
once, hoist it under a semantic class scoped to the page:

```css
/* styles.css — grouped with other portfolio selectors */
.portfolio-today-amt {
  text-align: right;
  font-variant-numeric: tabular-nums;
  width: 90px;
  background: transparent;
  border: 1px solid transparent;
  padding: 2px 4px;
  border-radius: 4px;
}
```

Name by feature + role (`.portfolio-today-amt`), not by style
(`.tabular-right-90`). Feature-named classes survive design
refactors; style-named classes don't.

## The path to FAIL-grade promotion

The crawler ships as **WARN-only** in `static`, `skeleton`, and
`all` waves. It is deliberately NOT in `sanity`.

1. Clear files one at a time. One file per PR is fine; 1–3 files
   per PR is ideal for review.
2. Each cleanup PR should drive `literal_inline_styles` strictly
   down. Re-run the crawler and paste the before/after count in
   the commit body.
3. When the count reaches 0, promote the crawler to the `sanity`
   wave (add to the tuple in `crawlers/waves.py`). At that point
   any new inline-style attribute added to a template blocks the
   push.

## Legitimate exceptions

None today. If you find a case where a literal inline style is
genuinely the right call (a third-party embed requires it, a
print-only style that can't live in `@media print`, a `<style>`
block Jinja-varies), add an HTML comment above the line
explaining why, then widen the crawler's exception rule rather
than allowlisting the file. The comment-then-crawler pattern is
how we've done this for `hardcoded_url_in_template`'s
`ALLOWLIST_PATHS` and we should stay consistent.
