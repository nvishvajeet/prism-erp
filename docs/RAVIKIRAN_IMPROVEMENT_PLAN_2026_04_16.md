# Ravikiran ERP Improvement Plan

> For Codex execution under Claude 1 supervision.
> Phased: each phase is a self-contained 1-hour Codex session.
> Repo: `~/Claude/ravikiran-erp` (branch: `operation-trois-agents`).

---

## Current state (post-Operation TroisAgents)

**Shipped:**
- Security parity with Lab-ERP (rate limiter, CSP/HSTS/XFO headers, ProxyFix)
- D1 ORG_NAME → "Ravikiran" + household tagline
- D2 login.html prefill → nikita
- D3 hub.html de-lab developer note
- D4 "Instruments" → "Assets" in templates (not base.html)
- UI audit CSS (F-01..F-08 paralleled from Lab-ERP)
- Eruda vendored + `_eruda_embed.html` partial ready
- `populate_live_demo.py` instrument-code regression fixed

**Not yet shipped (from existing spec `CODEX_RAVIKIRAN_BURN_2026_04_16.md`):**
- D5 `/debug` route + debug.html with eruda
- D6 `attendance_quick.html` number-pad page
- D7 v1.5.0 multi-role TODO retirement
- Stretch B: household asset seeds (8 items)

**Known gaps (from crawl + feedback plan):**
- Live `ravikiran.catalysterp.org` still shows Lab-ERP landing (tunnel routing)
- Role vocabulary still lab-centric in many places
- No household-specific seed data (assets, vendors, expenses)
- "Sample requests" terminology throughout

---

## Phase 1 — Finish the existing spec (1 hour)

> Pick up where the killed subagent left off. D5→D7 + Stretch B.

### P1.1 Port `/debug` route + wire eruda (~10 min)

**app.py:** Add route:
```python
@app.route("/debug")
@login_required
def debug_page():
    user = current_user()
    if not (user_role_set(user) & {"super_admin", "site_admin", "tester"} or is_owner(user)):
        abort(403)
    return render_template("debug.html")
```

**templates/debug.html:** Copy from Lab-ERP (`~/Documents/Scheduler/Main/templates/debug.html`), then add `{% include "_eruda_embed.html" %}` before `{% endblock %}`.

**Verify:** `grep -n "def debug_page" app.py` returns a hit.

**Commit:** `ravikiran: port /debug route + debug.html with eruda embed`

### P1.2 Port attendance_quick number-pad (~10 min)

1. Copy `templates/attendance_quick.html` from Lab-ERP.
2. Copy `static/css/attendance_quick.css` from Lab-ERP.
3. Add route to app.py:
```python
@app.route("/attendance/quick")
@login_required
def attendance_quick_mark_page():
    user = current_user()
    if not (user_role_set(user) & {
        "super_admin", "site_admin", "operator",
        "instrument_admin", "finance_admin",
    } or is_owner(user)):
        abort(403)
    return render_template("attendance_quick.html")
```
4. Verify `/attendance/api/quick-mark` and `/attendance/api/search-staff` exist.

**Commit:** `ravikiran: port attendance_quick number-pad from Lab-ERP`

### P1.3 Multi-role TODO retirement (~15 min)

Mechanical replacement in `app.py`:
- `user["role"] == "X"` → `user_has_role(user, "X")` for user/viewer/target_user
- `user["role"] != "X"` → `not user_has_role(user, "X")`
- Skip `row["role"]` (CSV import rows)
- Skip markers inside `user_role_set()` itself
- Drop stranded TODO comments

**Verify:**
```bash
grep -c '"role"\] ==' app.py  # user/viewer/target_user patterns → 0
grep -c 'v1.5.0 multi-role' app.py  # reduced count
```

**Commit:** `ravikiran: retire v1.5.0 multi-role single-equality call sites`

### P1.4 Seed household assets (Stretch B) (~15 min)

In `scripts/populate_live_demo.py`, replace the empty/broken instrument seed
with 8 real household assets using the existing `ensure_instrument` helper
(or direct INSERT if the helper doesn't fit):

```python
household_assets = [
    ("Solar Inverter System",   "SIS-001", "Energy",     "Terrace",       4, "10kW grid-tied inverter with battery backup"),
    ("Water Purifier",          "WP-001",  "Utility",    "Kitchen",       8, "RO+UV, serves ground + first floor"),
    ("AC Split Unit — Master",  "AC-001",  "Climate",    "Master Bedroom",6, "1.5 ton inverter split, annual servicing"),
    ("Generator DG-500",        "GEN-001", "Energy",     "Utility Room",  2, "Diesel backup, auto-start on mains failure"),
    ("CCTV NVR System",         "NVR-001", "Security",   "Server Room",   3, "16-channel NVR, 8 cameras active"),
    ("Washing Machine",         "WM-001",  "Appliance",  "Laundry",       8, "Front-load 8kg, scheduled maintenance Q2"),
    ("Kitchen Chimney",         "KC-001",  "Appliance",  "Kitchen",       6, "Auto-clean, filter replacement annually"),
    ("UPS — Server Room",       "UPS-001", "Energy",     "Server Room",   4, "2kVA online UPS, battery check monthly"),
]
```

Categories: `Energy`, `Utility`, `Climate`, `Security`, `Appliance`.
Locations: real household rooms.

**Commit:** `ravikiran: seed 8 household assets for demo`

### P1.5 Smoke + status (~5 min)

```bash
.venv/bin/python scripts/smoke_test.py
git commit --allow-empty -m "STATUS: Phase 1 complete — D5-D7 + Stretch B shipped"
git push origin operation-trois-agents
```

---

## Phase 2 — Vocabulary deep-scrub (1 hour)

> Make every user-facing string household-appropriate.

### P2.1 "Sample request" → "Service request" sweep (~20 min)

The core entity in CATALYST is a "sample request". In a household
ERP, these are service/maintenance requests — "fix the AC",
"schedule chimney cleaning", "generator fuel top-up".

**Scope:** templates only (not app.py route names or DB columns).

```bash
grep -rniE "sample.request|sample_request|sample.submission|submit.*sample" \
  templates/ | grep -v base.html | wc -l
```

For each hit:
- "Sample Request" → "Service Request"
- "Submit Sample" → "Submit Request"
- "Sample Name" → "Item / Service"
- "sample_submitted" status label → "request_submitted" (UI only;
  DB status string stays the same)
- "Awaiting sample submission" → "Awaiting submission"

Do NOT rename DB columns, route endpoints, or Python variables.
Template-text-only.

**Commit:** `ravikiran: vocabulary — 'sample request' → 'service request' in templates`

### P2.2 Role vocabulary (~10 min)

| Lab-ERP role | Ravikiran display | Where |
|---|---|---|
| `professor_approver` | "Approver" | `role_display_name()` in app.py |
| `faculty_in_charge` | "Supervisor" | same |
| `instrument_admin` | "Asset Manager" | same |
| `operator` | "Technician" or "Staff" | same |
| `requester` | "Member" | same (already used in some contexts) |
| `finance_admin` | "Finance" | same (already fine) |

Edit `role_display_name()` function in app.py. Template references
use the function output, so no template changes needed.

**Commit:** `ravikiran: household role display names`

### P2.3 Nav label audit (~10 min)

`templates/base.html` is locked. But document what needs to change:

| Current nav label | Suggested | Notes |
|---|---|---|
| Instruments | Assets | D4 done in templates; base.html pending |
| Schedule / Queue | Tasks | household work queue |
| New Request | New Request | fine as-is |
| Finance | Finance | fine |
| Notifications | Notifications | fine |
| Attendance | Attendance | fine |

Write to `docs/RAVIKIRAN_NAV_HANDOFF.md` — Claude 0 / owner applies
to base.html.

**Commit:** `ravikiran: nav label handoff doc for base.html owner`

### P2.4 Dashboard copy polish (~15 min)

`templates/dashboard.html` has lab-specific copy:
- "Lab queue" → "Work queue" / "Task queue"
- "Runs Completed" → "Jobs Done"
- "Samples Done" → "Items Processed"
- "Lab requests" → "Requests"
- "Awaiting instrument lead" → "Awaiting assignment"

Grep + replace in `templates/dashboard.html` only.

**Commit:** `ravikiran: dashboard copy — household vocabulary`

### P2.5 Smoke + status

---

## Phase 3 — Household-specific features (1-2 hours)

> New features that differentiate Ravikiran from Lab-ERP.

### P3.1 Household expense categories (~20 min)

Seed expense categories appropriate for a household:
- Groceries & Kitchen
- Fuel & Transport
- Maintenance & Repairs
- Utilities (electricity, water, gas)
- Staff Salaries
- Medical & Health
- Education
- Entertainment & Subscriptions
- Insurance & Taxes
- Miscellaneous

Add to `seed_data()` or `populate_live_demo.py` as category options
for receipt submission and vendor payment categorisation.

**Commit:** `ravikiran: household expense categories`

### P3.2 Staff duty roster view (~30 min)

New template `templates/duty_roster.html`:
- Weekly grid: rows = staff members, columns = days of week
- Cells show assigned duty / shift
- Tied to existing attendance data
- Admin can assign duties via inline form (POST to existing
  attendance endpoints or a new simple endpoint)

Route: `@app.route("/attendance/roster")` — admin/super_admin only.

**Commit:** `ravikiran: staff duty roster weekly grid`

### P3.3 Asset maintenance calendar integration (~20 min)

The calendar page (`templates/calendar.html`) shows instrument
downtime. For Ravikiran, reframe as "asset maintenance schedule":
- Upcoming AC servicing
- Generator fuel check
- Water purifier filter replacement
- Annual chimney cleaning

Seed 4-5 upcoming maintenance events for the household assets
from P1.4.

**Commit:** `ravikiran: seed household asset maintenance schedule`

### P3.4 Utility bill tracking (~30 min)

New template `templates/utilities.html`:
- Monthly grid: electricity, water, gas, internet, phone
- Each row: month, amount, paid/unpaid status
- Simple form to log a new bill
- KPI tiles: this month total, YTD total, highest month

Route: `@app.route("/utilities")` — uses the existing receipt/expense
infrastructure with a utility-specific category filter.

**Commit:** `ravikiran: utility bill tracking page`

---

## Phase 4 — Demo-readiness polish (1 hour)

> Make Ravikiran demo-able to the Nagargoje family.

### P4.1 Ravikiran landing page (~15 min)

When logged out, show a household-branded landing instead of
redirecting to `/login`. Similar to Lab-ERP's `public_landing.html`
but with:
- "Ravikiran" branding
- Household tagline
- Single "Sign in" CTA (no portal chooser needed — one ERP)
- Clean dark-mode styling matching the chooser

### P4.2 Seed realistic demo data (~20 min)

Populate the demo DB with:
- 5 recent service requests (AC repair, chimney cleaning, etc.)
- 10 recent receipts (grocery, fuel, maintenance, utility bills)
- 3 vendor payments (plumber, electrician, grocery supplier)
- 1 month of attendance records for 5 staff members
- 2 vehicle log entries per vehicle

### P4.3 Ravikiran-specific dashboard tiles (~15 min)

Add household-relevant tiles to `dashboard.html`:
- "Today's Staff" attendance summary
- "This Month's Spend" expense KPI
- "Upcoming Maintenance" next 3 scheduled services
- Remove lab-specific tiles that don't apply (instrument queues,
  calibrations)

### P4.4 Mobile-first smoke test (~10 min)

Load every page at 375×667 via curl or headless, confirm:
- No horizontal overflow
- All buttons ≥ 44px
- All forms submittable
- No lab vocabulary visible

---

## Execution map

| Phase | Scope | Est | Codex sessions |
|---|---|---|---|
| P1 | Finish existing spec D5-D7 + Stretch B | 1 h | 1 |
| P2 | Vocabulary deep-scrub | 1 h | 1 |
| P3 | Household-specific features | 1.5 h | 1-2 |
| P4 | Demo-readiness polish | 1 h | 1 |
| **Total** | | **4.5 h** | **4-5 sessions** |

**Recommended order:** P1 → P2 → P4 → P3. P4 before P3 because
a demo-able product with correct vocabulary is more valuable than
new features on a product that still says "Sample Request".

---

## For Codex: how to pick up

```bash
cd ~/Claude/ravikiran-erp
git pull origin operation-trois-agents
cat ~/Documents/Scheduler/Main/docs/RAVIKIRAN_IMPROVEMENT_PLAN_2026_04_16.md
# Start at Phase 1 (or whichever phase the operator assigns)
```

Each phase is self-contained. Commit per deliverable. Push after
each commit. Smoke before push if smoke is green (known issue:
populate_live_demo instrument-code regression was fixed in
`33d7167` + `b109bf5` — verify first).
