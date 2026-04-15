# Codex 0 Task Spec — Ravikiran ERP 1-Hour Burn

> Written by Claude 1 (iMac), post-Operation-TroisAgents.
> Supervised lane: Codex 0 executes, Claude 1 reviews each commit.
> Target: close visible Ravikiran gaps before public release.
> Budget: 60 min. Hard stop at T+60.

---

## Context

Ravikiran-ERP is a CATALYST fork for the Nagargoje household / estate.
It lives at `~/Claude/ravikiran-erp` (iMac) and
`ssh://vishvajeetn@100.109.225.52/Users/vishvajeetn/.claude/git-server/ravikiran-erp.git`
(canonical bare on MBP).

The Operation TroisAgents sprint shipped security parity (L3) +
UI polish (L2) + eruda vendor + CSS overrides. What's left is
the **vocabulary / branding / feature-parity gap** that makes
Ravikiran read as a real household product instead of a
lab-instrument app with a name change.

**Branch:** `operation-trois-agents` (same as the sprint).
**Smoke:** `.venv/bin/python scripts/smoke_test.py` — currently
fails on `populate_live_demo.py:363` due to missing instrument
codes. **Codex 0 already fixed this** in `33d7167` + `b109bf5`.
Verify smoke passes before starting new work.

---

## Hard rules

1. Push ONLY to `origin` (the LOCAL bare on MBP over LAN).
2. No edits to Lab-ERP (`~/Scheduler/Main/`). This lane is
   Ravikiran-only.
3. No `launchctl` commands, no mini restarts, no tunnel changes.
4. Commit per deliverable. Push after each commit.
5. If blocked, write `STATUS: BLOCKER:` to a commit message and
   stop.

---

## Deliverable 1 — `ORG_NAME` + `ORG_TAGLINE` vocabulary (~5 min)

**Problem:** `app.py:51-52` sets:
```python
ORG_NAME = os.environ.get("PRISM_ORG_NAME", "PRISM")
ORG_TAGLINE = os.environ.get("PRISM_ORG_TAGLINE", "Lab & Research Management")
```

"Lab & Research Management" is not household vocabulary. The login
page renders "PRISM" branding from these constants.

**Fix:**
```python
ORG_NAME = os.environ.get("PRISM_ORG_NAME", "Ravikiran")
ORG_TAGLINE = os.environ.get("PRISM_ORG_TAGLINE", "Household & Estate Operations")
```

Also grep for any other `"PRISM"` literal in `app.py` that feeds
user-visible text (excluding env-var key names). Replace with
`ORG_NAME` reference if hardcoded.

**Verification:**
```bash
grep -nE '"PRISM"' app.py  # should be 0 user-facing hits
```

**Commit:** `ravikiran: ORG_NAME 'Ravikiran' + household tagline`

---

## Deliverable 2 — login.html demo prefill fix (~5 min)

**Problem:** `templates/login.html:22` prefills `admin@lab.local`
in demo mode:
```html
<input ... value="{% if _demo_prefill %}admin@lab.local{% endif %}">
```

This email doesn't exist in the Ravikiran seed. Should be `nikita`
(the canonical Ravikiran super_admin from
`app.py:5401` `real_team` list).

**Fix:** In `templates/login.html`:
- Line 22: `admin@lab.local` → `nikita`
- Line ~3 (comment): update the comment to reference
  `nikita / 12345` instead of `admin@lab.local / 12345`.

Also check the login.html `<span class="login-brand-name">PRISM</span>`
at line 12 — swap to `{{ org_name }}` or `Ravikiran`.

**Verification:**
```bash
grep -n "lab.local\|PRISM" templates/login.html  # should be 0
```

**Commit:** `ravikiran: login page demo prefill + brand name fix`

---

## Deliverable 3 — `hub.html` de-lab pass (~10 min)

**Problem:** `templates/hub.html` is a developer-facing project hub
page with 8+ "Lab Scheduler" references, "lab-scheduler.git" paths,
and Lab-ERP-specific build guidance. It's the only template with
heavy Lab-ERP vocabulary that wasn't cleaned in the sprint's D5.

**Two options** (pick based on whether the Ravikiran deployment
serves this page):

**(a) If hub.html is user-visible on Ravikiran:** rewrite the
references to household vocabulary. Replace:
- "Lab Scheduler" → "Ravikiran ERP" (or "CATALYST Household ERP")
- "lab-scheduler.git" → "ravikiran-erp.git"
- "prism-mini" path references → keep as infrastructure docs
  (they're the same mini)
- Dev-team references (Kondhalkar, Dean Rao, etc.) → remove or
  genericize. These are Lab-ERP personas, not Ravikiran.

**(b) If hub.html is NOT user-visible** (i.e. only developers
access it, not Nikita/Pournima/Abasaheb): leave the content as-is
but add a comment at the top:
```html
<!-- NOTE: This is a developer-facing reference page. Lab-ERP
     terminology is intentional — it documents the upstream
     codebase. Not user-visible in production. -->
```

Check: is there a nav link to `/hub` in `base.html` or `nav.html`?
If yes → option (a). If no → option (b).

**Verification:**
```bash
grep -n "Lab Scheduler" templates/hub.html  # document count
```

**Commit:** `ravikiran: hub.html de-lab pass (option a|b)`

---

## Deliverable 4 — nav "Instruments" → "Assets" audit (~10 min)

**Problem:** Ravikiran's `base.html` nav still labels the primary
entity list as "Instruments" (lines 96-123). In a household ERP,
these entities represent appliances, equipment, household assets —
not lab instruments. But the underlying `instruments` table and
routes are the same.

**Decision gate:** ask the operator (or assume): does "Instruments"
make sense in a household context, or should it be "Assets"?

**If rename:**
- `templates/base.html` is **locked** (Claude 1 / Claude 0 owns
  base.html edits in the sprint). So: document the rename in a
  handoff section of this spec. Do NOT edit base.html.
- What Codex CAN do: grep for user-facing "Instruments" in OTHER
  templates (not base.html) and swap to "Assets":
  ```bash
  grep -rnE '"Instruments"|>Instruments<' templates/ | grep -v base.html
  ```
  These would be breadcrumb text, page titles, heading text in
  detail/list pages.

**Verification:**
```bash
grep -rnE '"Instruments"|>Instruments<' templates/ | grep -v base.html
# should be 0 after the swap (or documented intentional keeps)
```

**Commit:** `ravikiran: rename 'Instruments' to 'Assets' in templates (not base.html)`

---

## Deliverable 5 — Port `/debug` route + wire eruda embed (~10 min)

**Problem:** Claude 1 vendored `eruda.min.js` into
`static/vendor/eruda/` and created `templates/_eruda_embed.html`
(the loader + mobile CSS shim) during the sprint. But the `/debug`
route doesn't exist on Ravikiran — Codex 0 shipped it only on
Lab-ERP.

**Fix:**
1. Add route to `app.py`:
   ```python
   @app.route("/debug")
   @login_required
   def debug_page():
       user = current_user()
       if not (user_role_set(user) & {"super_admin", "site_admin", "tester"} or is_owner(user)):
           abort(403)
       return render_template("debug.html")
   ```
2. Create `templates/debug.html`:
   ```html
   {% extends "base.html" %}
   {% block content %}
   <meta name="viewport" content="width=device-width,initial-scale=1">
   <section style="max-width:32rem;margin:1.5rem auto;padding:1rem;">
     <h1 style="margin-bottom:0.5rem;">Debug Report</h1>
     <p style="margin-bottom:1rem;color:#666;">
       Send a quick mobile report with a title, severity, notes,
       and an optional camera capture.
     </p>
     <form action="{{ url_for('debug_feedback') }}" method="post"
           enctype="multipart/form-data">
       <input type="hidden" name="csrf_token" value="{{ csrf_token() }}">
       <input type="hidden" name="page"
              value="{{ request.args.get('page', '/debug') }}">
       <label style="display:block;margin-bottom:0.75rem;">
         <span style="display:block;margin-bottom:0.35rem;">Title</span>
         <input type="text" name="title" required
                style="width:100%;padding:0.8rem;border:1px solid #ccc;border-radius:0.5rem;">
       </label>
       <label style="display:block;margin-bottom:0.75rem;">
         <span style="display:block;margin-bottom:0.35rem;">Severity</span>
         <select name="severity"
                 style="width:100%;padding:0.8rem;border:1px solid #ccc;border-radius:0.5rem;">
           <option value="info">Info</option>
           <option value="warning">Warning</option>
           <option value="bug" selected>Bug</option>
           <option value="critical">Critical</option>
         </select>
       </label>
       <label style="display:block;margin-bottom:0.75rem;">
         <span style="display:block;margin-bottom:0.35rem;">Description</span>
         <textarea name="description" rows="8" required
                   style="width:100%;padding:0.8rem;border:1px solid #ccc;border-radius:0.5rem;"></textarea>
       </label>
       <label style="display:block;margin-bottom:0.75rem;">
         <span style="display:block;margin-bottom:0.35rem;">Photo (optional)</span>
         <input type="file" name="photo" accept="image/*" capture="environment">
       </label>
       <button type="submit" class="btn btn-primary"
               style="width:100%;padding:0.8rem;">Submit Report</button>
     </form>
   </section>
   {% include "_eruda_embed.html" %}
   {% endblock %}
   ```
3. Verify `/debug/feedback` POST route exists (it does — line 14811).

**Verification:**
```bash
grep -n "def debug_page" app.py  # should exist
ls templates/debug.html          # should exist
```

**Commit:** `ravikiran: port /debug route + debug.html with eruda embed`

---

## Deliverable 6 — Port `attendance_quick.html` template (~5 min)

**Problem:** Lab-ERP has the Nikita-requested mobile number-pad
page at `templates/attendance_quick.html`. Ravikiran doesn't.

**Fix:**
1. Copy Lab-ERP's `templates/attendance_quick.html` into
   Ravikiran's `templates/`.
2. Copy Lab-ERP's `static/css/attendance_quick.css` into
   Ravikiran's `static/css/`.
3. Add route to `app.py`:
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
4. Verify `/attendance/api/quick-mark` and `/attendance/api/search-staff`
   exist on Ravikiran. If not, document as a handoff.

**Verification:**
```bash
ls templates/attendance_quick.html static/css/attendance_quick.css
grep -n "def attendance_quick_mark_page" app.py
```

**Commit:** `ravikiran: port attendance_quick number-pad page from Lab-ERP`

---

## Deliverable 7 — v1.5.0 multi-role TODO retirement (~10 min)

**Problem:** Ravikiran's `app.py` still has the full set of
`# TODO [v1.5.0 multi-role]` markers — Lab-ERP had 79, we retired
53 to `user_has_role()`. Ravikiran hasn't had the same pass.

**Fix:** Use the same script approach as Lab-ERP (see
`refactor(roles): retire 53 v1.5.0 multi-role call sites` commit
`aa82972` on Lab-ERP's `feature/insights-module` branch):

1. For every `<user_var>["role"] == "<role>"` where user_var is
   `user`, `viewer`, or `target_user`: replace with
   `user_has_role(<user_var>, "<role>")`.
2. For every `<user_var>["role"] != "<role>"`: replace with
   `not user_has_role(<user_var>, "<role>")`.
3. Do NOT touch `row["role"]` in CSV import paths (line ~19574
   equivalent) — those are NOT user objects.
4. Do NOT touch the 3 markers inside `user_role_set()` itself —
   that IS the primitive.
5. Drop stranded TODO comments whose next code line no longer
   contains `["role"]`.

**Verification:**
```bash
grep -c 'user_has_role(' app.py    # should be > 30
grep -c '"role"\] ==' app.py       # should be 0 for user/viewer/target_user patterns
grep -c 'v1.5.0 multi-role' app.py # should be < 60 (set-in patterns remain)
```

**Commit:** `ravikiran: retire v1.5.0 multi-role single-equality call sites`

---

## Stretch items (if time permits before T+55)

### Stretch A — `mobile_polish_v2.css` port
Copy `static/css/mobile_polish_v2.css` from Lab-ERP into Ravikiran.
Add `<link>` stitch note (base.html is locked; document handoff).

### Stretch B — Populate real household assets
Ravikiran's `seed_data()` (or `populate_live_demo.py`) still seeds
lab instruments (FESEM, ICP-MS, etc.) from Lab-ERP's fixture data.
The sprint scrub (`ef2b7cb`) emptied them but didn't replace with
household equivalents. Seed 5-8 household assets:
- Solar Inverter System (SIS-001)
- Water Purifier (WP-001)
- AC Split Unit – Master Bedroom (AC-001)
- Generator – DG-500 (GEN-001)
- CCTV NVR System (NVR-001)
- Washing Machine – Front Load (WM-001)
- Kitchen Chimney (KC-001)
- UPS – Server Room (UPS-001)

Use the existing `ensure_instrument()` helper from
`populate_live_demo.py` or seed directly.

### Stretch C — Tunnel verification doc
SSH to mini, run `cat ~/.cloudflared/config.yml` (read-only), and
document which hostname → which port. Commit as
`docs/TUNNEL_VERIFICATION_2026_04_16.md` on Ravikiran. This
proves whether `ravikiran.catalysterp.org` actually hits port 5057.

---

## Cadence

- T+0: verify smoke green after `33d7167` + `b109bf5`
- T+5: D1 shipped
- T+10: D2 shipped
- T+20: D3 shipped
- T+30: D4 shipped
- T+40: D5 shipped
- T+45: D6 shipped
- T+55: D7 shipped (or partial + stretch)
- T+60: final status commit

---

## Exit gate

All 7 deliverables committed and pushed. Smoke green (or documented
as a known pre-existing failure with explanation). Each deliverable's
verification command returns the expected value.

Final status:
```
STATUS: T+60 Codex0 — Ravikiran burn closed. Shipped D1..D7 (or
partial). Smoke: GREEN|KNOWN-FAIL. Stretch: N attempted.
```
