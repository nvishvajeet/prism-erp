# Tester Guided Flow — design + shipped this commit

**Target:** every route in the ERP gets tested, systematically, by a tester (Tejveer, lab tester, or any user with `tester` role). No skipping, no guessing which page to open.

**UX:** floating pane at bottom of every page shows current step, test hint, and [Prev / Report Issue / Skip / Mark Tested → Next] buttons. One click = navigates to the next checklist route.

---

## Flow

```
1. Tester goes to /tester/plan (existing checklist page)
2. Clicks "Start Guided Run"
   → server creates session['tester_run'] = {current:0, visited:[], tenant:'lab', started_at, total:30}
   → redirects to step 1's route (e.g. /manual)
3. Every page renders the guided pane at the bottom (base.html includes it if session.tester_run exists)
4. Tester tests the page, clicks "Mark Tested → Next"
   → /tester/advance increments current, redirects to step 2's route
5. If issue found: "Report Issue" → opens the feedback widget pre-tagged with the current step + route
6. Repeat until step N is reached
7. "Finish" → /tester/summary shows stats (total, tested, skipped, issues) + clears session
```

## Data model (session-only for MVP — no new tables)

`session['tester_run']` is a dict:
```python
{
    "current": 0,             # int, 0-indexed
    "tenant": "lab",          # 'lab' or 'ravikiran'
    "started_at": "2026-04-17T19:45:00Z",
    "visited": [],            # list of (step_n, status, ts) tuples
                              # status: 'tested' | 'skipped' | 'issue'
    "total": 30,
}
```

No DB migration. Session-only is enough for MVP — if the tester refreshes, it persists via cookie. A future iteration can persist to `tester_plan_runs` table for audit trail.

## Routes added this commit

| method | route | purpose |
|---|---|---|
| POST | `/tester/start` | init session + redirect to step 0's route. Query: `?tenant=lab\|ravikiran`. |
| POST | `/tester/advance` | mark current as `tested`, bump current, redirect. Tail: `/tester/summary` at end. |
| POST | `/tester/skip` | mark current as `skipped`, bump, redirect. |
| POST | `/tester/prev` | mark current as `pending`, decrement, redirect. |
| POST | `/tester/report-issue` | mark current as `issue`, feed the state to feedback widget, redirect. |
| GET | `/tester/summary` | end-of-run page: stats + per-step table. Clears session. |
| GET | `/tester/pane-data` | JSON used by the pane JS to read {current, route, title, hint, total}. |

## Checklist definition (Python constants in app.py)

Two lists of dicts: `TESTER_ROUTES_LAB` (30 entries) and `TESTER_ROUTES_RAVIKIRAN` (25 entries). Each entry:
```python
{"route": "/instruments", "title": "Instruments list", "hint": "22 rows visible (CRF brochure)"}
```

Source: `docs/TESTER_CHECKLIST_2026_04_17.md` (already in tree). Scraped into Python at module-load time from the markdown table.

## The pane (templates/_tester_pane.html)

Sticky bottom bar, 60px tall, shown only when `session.tester_run` exists AND `current_user` has `tester` role OR is in owner/super_admin. Contents:

```
┌───────────────────────────────────────────────────────────────────────────┐
│ TESTER · Step 5 of 30 · /instruments                         1 issue     │
│ "22 rows visible, all brochure instruments"                             │
│         [← Prev]  [Report Issue]  [Skip]  [Mark Tested → Next]          │
└───────────────────────────────────────────────────────────────────────────┘
```

Keyboard shortcuts (via data-hotkey + existing keybinds.js):
- `→` or `Enter` → Mark Tested → Next
- `←` → Prev
- `S` → Skip
- `I` → Report Issue

## End-of-run summary (/tester/summary)

```
## Run complete
- Started: 2026-04-17 19:45
- Ended:   2026-04-17 20:32 (47 min)
- Pages tested: 27/30
- Skipped: 2
- Issues flagged: 3

| step | route           | status  | ts          |
| ---- | --------------- | ------- | ----------- |
| 1    | /manual         | tested  | 19:45:12    |
| 2    | /               | tested  | 19:46:38    |
| 3    | /instruments    | issue   | 19:48:11    |
| ...  | ...             | ...     | ...         |

[Start a new run]
```

## Next iterations (not this commit)

- **DB persistence** (`tester_plan_runs` + `tester_plan_steps`). Audit trail + cross-tab resume.
- **Auto-advance on navigation:** if tester clicks a `<a>` other than Next, record the step as "tested" anyway.
- **Screen recording:** `getDisplayMedia()` → `webm` blob attached to the run.
- **Diff-based test suggestions:** "these templates changed since last deploy — test them first."
- **Per-role dynamic checklist:** operator sees 30, member sees 6.

## Why this is top priority

Operator 2026-04-17: "We have testers coming for the ERPs. Good quality debugging is hard to come by." Tejveer + Lab tester are arriving. Without a guided pane, they'd have to remember which pages to visit + do so in a random order, missing coverage.

This pane turns testing from "go play around" to "click Next 30 times — all routes covered."
