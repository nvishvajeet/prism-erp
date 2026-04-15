# Claude 1 Lane — UI polish + mobile-first + attendance-number page

> Long-form task spec for Claude 1, Operation TroisAgents, Phase 1
> extended window. Addressed to Claude 1 on the iMac; every other
> agent should skip this file.

Claude 0 is the conductor. Phase 1 hard stop is T+118. This spec
is deliberately long so you can run autonomously with no pings
except ~15-min status commits. Fallback work is queued at the end
so you never run out before T+118.

---

## Mission

Close the visible UX gaps that Tejveer will hit first. The backend
ships clean (Codex 0 has gatekeeping + security); Claude 0 has
the chooser scaffold, Ravikiran silo, and the attendance-number
schema + quick-mark API. This lane makes those features
**visible** on the front end — chooser looks like a real landing,
attendance-by-number has a mobile page, and the app overall
respects phone form factors.

Six deliverables, all UI/templates/CSS. No `app.py` edits.

---

## Lane boundaries (HARD)

Repos you touch:
- `~/Documents/Scheduler/Main` (lab-scheduler) via your iMac clone
- `~/Claude/ravikiran-erp` — **yes**, constraint lifted for this
  sprint. Clone it the same way if you don't have it yet.

Files you own this lane:
- `chooser/templates/index.html` — full styling pass
- `chooser/static/chooser.css` — NEW
- `templates/attendance_quick.html` — NEW (the number-pad page)
- `static/css/attendance_quick.css` — NEW
- `static/css/mobile_polish_v2.css` — NEW (global mobile tweaks)
- `templates/**/*.html` everywhere **except** the four locked ones
  (below). Edit existing templates only to fix clipped fields,
  missing save buttons, overflow:hidden panes. No redesigns.
- `ravikiran-erp/templates/**/*.html` same constraint.

Files you MUST NOT touch:
- `templates/base.html` (either repo) — Claude 0 owns at merge
- `templates/nav.html` (either repo) — Claude 0 owns at merge
- `templates/profile.html` — Codex 0 may touch as stretch
- `templates/login.html` — rate-limit flash wiring is Codex 0's
- `static/css/global.css` — banned for everyone
- `app.py` in either repo
- `chooser/app.py` — Claude 0's
- `~/.cloudflared/*` on mini

---

## Deliverable 1 — Chooser styling (~15 min)

**Current state:** `chooser/templates/index.html` is a bare HTML
stub with two `<a class="tile">` anchors and zero CSS. Port 5060.

**Spec:** turn the stub into a proper two-tile landing page.

- Full-viewport layout. Dark-mode first (matches CATALYST brand).
- Two tiles side-by-side on desktop (≥ 900px), stacked on mobile.
- Each tile is a large tappable card (min 44px tap target per
  iOS HIG). Hover/focus states. Prominent title + one-line
  description + CTA arrow.
- "MITWPU R&D" tile uses academic/lab visual vocabulary.
- "Personal ERP" tile uses household/estate vocabulary.
- Footer with CATALYST wordmark + small-print "choose a portal
  to continue".
- No third-party dependencies (no Google Fonts, no CDN). System
  font stack only.

**Files:**
- `chooser/templates/index.html` — add `<link rel="stylesheet"
  href="/static/chooser.css">` and the structure.
- `chooser/static/chooser.css` — NEW. Write the full stylesheet.
- Adjust `chooser/app.py` only if you need to point at the
  static dir — don't touch route logic. (Note: `chooser/app.py`
  is Claude 0's; if you need a `static_folder="static"` arg on
  the Flask constructor, write it into a `chooser/STATIC_NOTE.md`
  and Claude 0 will apply at merge.)

**Acceptance:**
- `python chooser/app.py` then
  `curl -sS localhost:5060/` returns 200 with both tiles.
- `open http://localhost:5060/` in a browser shows a polished
  two-tile page at desktop and mobile widths.
- No console errors. No external network calls (check Network tab).
- Zero mention of "Ravikiran" or "Lab-ERP" in the visible text.

**Commit:** `chooser: full two-tile landing styling (dark mode,
responsive)`

---

## Deliverable 2 — Attendance-number mobile page (~20 min)

**Current state:** Claude 0 added `users.attendance_number` column
+ populated sequentially + extended `/attendance/quick-present`
API to accept numeric codes. The old admin-only
`attendance_team.html` / `personnel.html` quick-mark UIs use a
3-letter-code text input. Nikita wants: **mobile page, big number
pad, type or tap the number, show name, Mark Present.**

**Spec:** new route target `/attendance/quick` (NOT `/attendance/quick-mark` — that's JSON API).

**Since you can't add the route in `app.py`:** instead, build the
template + CSS + JS. Claude 0 will wire the route at merge. Write
the expected route signature at the top of the template in an
HTML comment so Claude 0 can find it:

```html
<!--
ROUTE (Claude 0 wires at merge):
  @app.route("/attendance/quick", methods=["GET"])
  @login_required
  def attendance_quick_mark_page():
      # Role gate: super_admin, site_admin, operator, instrument_admin
      return render_template("attendance_quick.html", today=date.today())
-->
```

**Template: `templates/attendance_quick.html`**
- `<meta name="viewport" content="width=device-width,initial-scale=1">`
- Extends `base.html` (use `{% extends "base.html" %}` — do NOT
  edit base.html itself).
- Big numeric display at top showing the code being typed.
- 3×4 numeric keypad (1..9, 0, backspace, submit). Big buttons
  (min 64×64 px).
- Below the keypad: empty state = "Enter your attendance number",
  filled state = "Marking: NAME (code N)" populated via AJAX to
  `/attendance/staff-search?code=N` (existing endpoint).
- Mark Present button — calls POST `/attendance/quick-mark` with
  `{code: N, status: "present"}` (existing JSON API). Success →
  show big green check + name, auto-reset after 2 seconds.
- Error handling: unknown code → red X + "unknown number N".
- No keyboard input allowed on the hidden input — force the
  keypad (better for kiosk on phone).

**CSS: `static/css/attendance_quick.css`**
- Full-screen overlay, flex centered.
- High-contrast so it's readable across a kiosk phone.
- Tap targets ≥ 64px.
- No scroll needed at 375×667 (iPhone SE) — layout fits.

**JS:** inline in the template or new file — either is fine.
- `fetch('/attendance/staff-search?code=' + N)` to preview the
  name.
- `fetch('/attendance/quick-mark', {method: "POST", headers: {
  "Content-Type": "application/json", "X-CSRF-Token": csrf},
  body: JSON.stringify({code: N, status: "present"})})`.
- CSRF token from `<meta name="csrf-token" content="...">` in
  base.html.

**Acceptance:**
- At 375×667 viewport, page renders without scrolling.
- Tapping 1, 4 shows "Marking: Tejveer" (or whichever user has
  attendance_number = 14) within 300ms.
- Mark Present on a valid code → green check + reset.
- Mark Present on code 99999 → red X + "unknown number".

**Commit:** `attendance: mobile-first quick-mark number pad page
(Nikita 2026-04-15)`

---

## Deliverable 3 — Attendance number visible on profile (~5 min)

**Check first:** did Codex 0 already do this as their Stretch A?
(Read `docs/CODEX0_LANE_SEV2_2026_04_15.md` Stretch A and
`git log origin/operation-trois-agents --grep 'profile' --oneline`.)

- If Codex 0 shipped it: **skip this deliverable**, note "skipped
  — Codex 0 shipped" in your status commit, move on.
- If not: **small addition** to `templates/profile.html`:
  ```html
  <div class="profile-attendance-code">
    <span class="label">Attendance number</span>
    <span class="value">#{{ current_user.attendance_number
                            or "not assigned" }}</span>
  </div>
  ```
  Minimal inline styling, matches the existing profile card
  structure. Pick the right insertion point (right after the
  user's name/role display).

**Commit:** `profile: show attendance number` (only if not
already shipped by Codex 0)

---

## Deliverable 4 — Responsive polish sweep (~15 min)

**Scope:** every template under
`templates/**/*.html` + `ravikiran-erp/templates/**/*.html`,
except the locked four.

**Audit checks, per template:**
1. Does it inherit `<meta name="viewport" …>` from base.html?
   If not, note in audit doc (do not edit base.html).
2. Are tap targets ≥ 44×44 px at mobile width? Common offenders:
   small icon-only buttons, dense table action rows.
3. Does any table use `overflow-x: auto` to scroll horizontally
   on mobile, or does it cut off?
4. Are forms usable at 375px width? Labels readable, inputs
   full-width.

**Fix approach:** one new stylesheet,
`static/css/mobile_polish_v2.css`, with media-query overrides
at `@media (max-width: 640px)`. Include in templates you fix via
`{% block extra_css %}<link rel="stylesheet"
href="{{ url_for('static', filename='css/mobile_polish_v2.css') }}">
{% endblock %}` — if the template doesn't have an `extra_css`
block, skip and add it to your handoff doc.

**Audit doc:** `docs/MOBILE_POLISH_2026_04_15.md` — one row per
template, what you found, what you fixed, what remains for
Claude 0's merge pass.

**Commit:** `ui: mobile responsive polish across templates
(mobile_polish_v2.css + audit doc)`

---

## Deliverable 5 — Ravikiran template scrub pass 2 (~10 min)

**Context:** Claude 0 did the app.py-level Ravikiran branding
scrub (instruments, personas, `@prism.local` → `@ravikiran.local`).
Templates in `ravikiran-erp/templates/` may still have "Lab",
"MITWPU", "Central Instrumentation", "FESEM", "XRD", "ICP-MS"
in visible text.

**Process:**
1. From `~/Claude/ravikiran-erp`:
   ```bash
   grep -rniE "MITWPU|mitwpu|Lab|FESEM|ICP-?MS|XRD|Raman|Central Instrumentation|Kondhalkar|Dean Rao" templates/
   ```
2. For each hit, decide: (a) generic household equivalent, or
   (b) remove/comment out. Prefer (a) — don't leave empty divs.
3. Nav labels like "Instruments" → "Inventory" or "Assets" (or
   leave; check what Ravikiran household contextually needs —
   if instruments make sense, keep, if not, rename).

**Acceptance:** the grep above returns zero hits in
`ravikiran-erp/templates/` after your pass.

**Commit:** `ravikiran: template scrub pass 2 (visible text
de-lab)`

---

## Deliverable 6 — Final status commit + handoff (~3 min)

```
STATUS: T+NN Claude1 — UI polish lane complete. Shipped:
  1. chooser styling (<commit>)
  2. attendance_quick.html mobile number pad (<commit>)
  3. profile attendance number (shipped | skipped)
  4. mobile_polish_v2.css + audit doc (<commit>)
  5. ravikiran template scrub pass 2 (<commit>)
  Handoff-to-Claude-0: attendance_quick.html has ROUTE comment
  at the top for nav stitching + route registration.
```

---

## Fallback / stretch work (if the six land before T+110)

### Stretch A — eruda drop-in for tester role
Self-host the eruda.min.js file under
`static/vendor/eruda/eruda.min.js` (MIT-licensed in-page
devtools, ~200KB). Include in a template ONLY when
`current_user.role in {"tester", "super_admin"}` AND
`?debug=1` in URL. Gives Tejveer full DevTools on his phone.

### Stretch B — Attendance quick page for Ravikiran too
Port the same template to `ravikiran-erp/templates/attendance_quick.html`
with Ravikiran's column name / API path. Check if the API
exists there; if not, handoff to Claude 0 in the audit doc.

### Stretch C — Form save-button audit follow-up
Re-run the P0/P1 audit from warmup against BOTH repos and tick
off everything shipped. Note anything still broken for Claude 0's
T+120 merge pass.

### Stretch D — Dark mode audit
Both chooser and attendance_quick are dark-first. Audit whether
base.html's dark mode (if any) respects `prefers-color-scheme:
dark` media query. Note gaps in a new doc; do not edit base.html.

### Stretch E — Accessibility pass
`aria-label` on icon-only buttons, `role="button"` where
appropriate, keyboard focus outlines not suppressed, `tabindex`
sanity. Audit doc + patches to your own new templates. Don't
retrofit across the whole app — out of scope.

---

## Cadence

Status commits every 15 minutes minimum:

```
T+65  STATUS: started UI polish lane, chooser styling in progress
T+80  STATUS: chooser shipped, attendance_quick in progress
T+95  STATUS: attendance_quick shipped, responsive polish running
T+110 STATUS: polish + ravikiran scrub shipped
T+118 STATUS: lane complete, N stretches
T+120 STATUS: closed
```

## Commit hygiene

- One commit per deliverable minimum. Split larger if >250 lines.
- Smoke gate before EVERY push in lab-scheduler. No exceptions.
  (Ravikiran-erp has no smoke gate hook; run the lab smoke from
  the iMac clone.)
- Push each commit as it lands.
- Commit prefix: `chooser:`, `attendance:`, `ui:`, `ravikiran:`,
  `profile:` as fitting.

## Blocker protocol

Push `STATUS: BLOCKER:` and stop if:
- Ravikiran-erp branch `operation-trois-agents` doesn't exist on
  origin — Claude 0 needs to create it before you can push.
- A template you need to fix is locked (one of the four). Note
  it in your audit doc and move on; do not edit.
- Chooser port 5060 is already bound on iMac — use any free port
  for testing.

Otherwise assume-and-document. Inline `<!-- NOTE: assumed X -->`
comments are fine.

## What good looks like at T+120

- Five of six deliverables shipped (Deliverable 3 may legitimately
  be "skipped — Codex 0 shipped").
- Chooser looks professional at localhost:5060 (desktop + mobile).
- `templates/attendance_quick.html` renders correctly and has the
  ROUTE comment for Claude 0 to pick up at merge.
- Zero "Lab / MITWPU / FESEM / XRD" strings in
  `ravikiran-erp/templates/` by grep.
- `docs/MOBILE_POLISH_2026_04_15.md` enumerates what was fixed
  and what remains.
- 2+ stretches attempted.
- Final STATUS commit.
- Smoke green on lab-scheduler.

Claude 0 merges your work into nav/base at T+120. Don't worry
about nav stitching — that's the conductor's job.

GO.
