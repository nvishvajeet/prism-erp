# Testing Plan — Tejveer

_Drafted 2026-04-15. Audience: Tejveer (new CATALYST tester).
Anchor commit: `d002ff5` on `feature/insights-module` — the
commit that added the `tester` role + your account._

Welcome. Read this front-to-back once, then keep it open while
you work. Total time to read + Day-One walk: ~2.5 hours.

---

## 1. First login (5 minutes)

**Where:**
- Production Ravikiran site: **`https://catalysterp.org/login`**
- (If you're asked to test a demo instance instead, the URL is
  different — the operator will tell you.)

**Credentials:**
- Username: `tejveer`
- Password: `12345`

**Steps:**

1. Open `https://catalysterp.org/login` in a fresh browser tab
   (no autofill, no leftover cookies from another account).
2. Type `tejveer` + `12345` → click **Sign in**.
3. You'll be redirected to a **forced password change** screen.
   This is expected — the temporary password is only good for
   one login.
4. Pick a new password:
   - **Minimum 8 characters**
   - **Must contain at least one digit and one letter**
   - **Cannot equal `12345`** (the old password)
   - Don't reuse a password from another site — this one has
     real admin-adjacent reach.
5. Re-type the new password to confirm → **Change password**.
6. You land on the portal picker (or the Lab portal if you have
   only one).

**Write the new password down somewhere offline.** If you lose
it, you have to ask the operator to reset it — that's a 15-min
interruption for both of you.

**If login fails:**
- `Bad credentials` → double-check spelling; caps-lock off.
- `CSRF token missing / 400` → reload the login page in a fresh
  tab. Cookies from a previous session can confuse it.
- `Account locked` → 10 failed attempts in 5 minutes locks the
  IP. Wait 5 min + try once more.
- Still stuck after two retries → message the operator on
  WhatsApp with a screenshot. Backup contact: Nikita
  (email placeholder — operator will paste her live address
  here once confirmed).

---

## 2. Day-one walk (2 hours)

Hit every surface below in order. You won't edit anything today —
your role is READ + REPORT. For each page, note three things:

1. Does it load without visible errors?
2. Does it show data consistent with what you'd expect to see?
3. Are there visual bugs (misalignment, overlapping text, cut-off
   buttons, broken images, missing labels)?

Tick each line as you go. Don't skip — the order matters for
building a mental model.

### 2.1 Schedule / Calendar

- **Path:** `/schedule`
- **Expected:** a table or calendar of upcoming instrument
  bookings. Rows should show instrument name, requester, time
  window, status.
- **Visual bugs to look for:**
  - Rows that wrap awkwardly on narrow windows
  - Status badges with wrong color (e.g. "completed" rendered
    red instead of green)
  - Filter controls that don't close when you click away
- **If you see this, file a bug:** `[schedule] <symptom>` in the
  tag.

### 2.2 Calendar view

- **Path:** `/calendar`
- **Expected:** month/week view showing bookings as blocks.
- **Visual bugs:** blocks overlapping when they shouldn't;
  weekend shading inconsistent; today's date not highlighted.

### 2.3 Instruments list

- **Path:** `/instruments`
- **Expected:** grid or table of instruments. Icons, names,
  status pills, operator assignments.
- **Visual bugs:** empty-state card missing when the list is
  empty; icons misaligned; status pills inconsistent with what
  the detail page says.

### 2.4 Single instrument detail page

- Pick one instrument from the list → click the row.
- **Expected:** tabs/panes for metadata, queue, team, maintenance,
  history. Your role = tester = read-only — edit buttons should
  be absent or visibly disabled.
- **Visual bugs:** tabs that don't switch; metadata truncated;
  "edit" affordances that SHOULDN'T exist for your role appearing
  anyway (that's a §4 security finding, not a §2 cosmetic bug).

### 2.5 Users list (READ-only for you)

- **Path:** `/admin/users`
- **Expected:** a list of users with their roles. You can see
  everyone; you CANNOT edit anyone.
- **Visual bugs:** role badges that don't match the role column;
  search that clears unexpectedly; pagination that skips rows.
- **SECURITY CHECK (also §4):** if you see an "Edit" or "Delete"
  button that actually works when you click it — that's a SEV2
  bug. File via the break-glass channel (§4).

### 2.6 Stats / dashboards

- **Path:** `/stats` or `/`
- **Expected:** tiles showing counts, charts, or summary numbers
  per module. Top-bar badges for "things needing your attention."
- **Visual bugs:** charts that don't render; tile counts that
  disagree with what the underlying list shows (e.g. dashboard
  says "7 pending" but the queue shows 9).

### 2.7 Messages / reports

- **Path:** `/inbox`, `/messages`, `/notifications`
- **Expected:** inbox-style list of notifications addressed to
  your account. Since you're new, this may be nearly empty — that
  is fine. Look for the **empty-state card** — it should have a
  helpful message, not a blank page.
- **Visual bugs:** empty state missing; links to `/messages/:id`
  returning 404; unread count disagreeing with list.

### 2.8 Portal switcher (Lab ↔ HQ)

- Your role has access to **both Lab and HQ portals**.
- Switch between them via the portal-picker (top-right or
  initial landing). URL changes: Lab portal = same site in lab
  mode; HQ = finance / personnel / vehicles / mess.
- **Expected:** the module nav visibly changes when you switch.
  Lab has Instruments, Queue, Calendar; HQ has Personnel,
  Vehicles, Receipts, Mess, etc.
- **Visual bug:** nav items from the wrong portal appearing.
  That overlaps with the known 112-route module-gating leak —
  a first-hand confirmation of it from you is valuable. Tag
  your bug `[bleed]` if you spot this.

---

## 3. Bug-report template

**Filing a bug = 3 minutes if you follow the template. Don't
skip fields.**

### 3.1 Title format

**`[module] <one-line symptom> — Rx,Cy on /path`**

Examples:

- `[schedule] status badge green for completed-AND-rejected rows — R3,C4 on /schedule?status=all`
- `[instruments] edit button appears for tester role — R2,C6 on /instruments/5`
- `[bleed] /personnel renders full table despite Lab portal active — on /personnel`

`Rx,Cy` is "row x, column y" in a table, or "section x, column y"
on a page. Skip if not relevant.

### 3.2 Required fields

```markdown
## YYYY-MM-DD HH:MM — [module] <title>

**URL:** <paste full URL>
**Role:** tester
**Portal:** lab / hq
**What I did:** <one or two sentences>
**What I saw:** <what actually happened>
**What I expected:** <what should have happened>
**Screenshot:** <path or link>
**Severity guess:** SEV1 / SEV2 / SEV3 / SEV4
**Reporter:** tejveer
```

Severity scale (same as `INCIDENT_RUNBOOK.md §2` in the
sahajpur-university repo — one line each):

| SEV | Meaning |
|---|---|
| 1 | Data loss · cross-tenant leak · auth outage · audit chain break |
| 2 | A whole portal down >30 min · tester role sees something it shouldn't · login broken |
| 3 | A portal is slow · cosmetic issue · non-critical feature broken |
| 4 | Typo · misalignment · tooltip missing · "fix when you have time" |

**Pick the higher SEV when in doubt.** A triager downgrades if
warranted; they never upgrade after the fact.

Where to file: append to `lab-scheduler/logs/debug_feedback.md`
(newest at top) and commit with subject
`feedback: tejveer — <short summary>`. One bug = one commit.

### 3.3 The in-page debugger (`?debug=1`)

Every page supports an overlay debugger that captures a video +
audio narration of what you're seeing. This is often faster than
typing a full report.

**Turn it on:** append `?debug=1` to any URL (e.g.
`https://catalysterp.org/schedule?debug=1`). A small debugger
panel appears at the bottom-right of the screen.

**Flow:**

1. Navigate to where the bug is visible.
2. Click **Record** in the debugger panel.
3. **Speak** what's wrong ("the status badge is green but the
   status says rejected") — the debugger captures your voice
   + the screen.
4. **Click-to-pin** the specific element you're pointing at.
   This drops a marker in the recording tied to that DOM node
   + its CSS path.
5. Click **Stop**. A transcript + video preview appears.
6. Review. If it captures what you meant, click **Submit**.
   The debugger attaches the recording + a structured metadata
   blob (URL, role, page state, pinned element path) to a bug
   report that's pre-filled using the §3.2 template.

**Hold-⌘ shortcut (TBD — ships with task 0103):** once
`<commit-SHA-placeholder>` lands, holding ⌘ for 1 second on any
element pins it without opening the debugger panel. Until that
commit lands, use the panel's Record → click-to-pin flow
above. This section will be updated with the SHA once 0103
ships.

---

## 4. Security-verification checklist (tester-role integrity)

Your role is designed to be **read-everywhere, write-nowhere-
destructive**. The following five actions MUST fail with 403
(Forbidden) when you try them. If any of them *succeed* for
your account, that's a SEV2 security bug — route through the
**break-glass channel**, not the normal debugger.

### The five no-go actions

1. **User deletion**: try to click "Delete" on any row in
   `/admin/users`. Expected: button absent OR button returns
   403 when clicked.
2. **Role edit**: open a user detail page at
   `/admin/users/<id>` and try to change their role. Expected:
   edit controls absent OR 403 on submit.
3. **Approval bypass**: find a pending sample request at
   `/requests/<id>`. Try to click "Approve" (skipping your
   role's approval step). Expected: button absent OR 403.
4. **Bulk data edit**: try to use any "Bulk edit" / "Import
   CSV" / "Mass update" surface. Expected: absent OR 403.
5. **Instrument calibration reset**: on an instrument detail
   page, try "Reset calibration data" or similar destructive
   operator-only action. Expected: absent OR 403.

### If ANY of these succeed

**Do not continue testing that surface.** Immediately:

1. Screenshot the UI state + URL.
2. Note the exact steps that led to it.
3. **Do not click further** — you might trigger real damage.
4. **Break-glass channel**:
   - WhatsApp the operator with subject
     `SEV2 SECURITY — tester bypassed <action>`
   - Also file a bug with the `[security]` tag + `SEV2` severity
   - Do NOT just rely on the normal debugger submit —
     security bypass is urgent enough to interrupt.

The operator will acknowledge within 15 minutes (per
`INCIDENT_RUNBOOK.md §2` SEV1/2 SLA).

---

## 5. What NOT to test

Out of scope for you:

- **Load / performance testing.** That's a separate engagement
  with different tools.
- **Security-by-obfuscation probing.** Don't try to manipulate
  URLs, cookies, JWT tokens, etc. to bypass auth — that's a
  different engagement with explicit scope + rules. Your role
  is UX + consistency + read-only sanity, not pen-testing.
- **Production data entry.** Don't create real user accounts,
  don't add real instruments, don't submit real sample requests
  that would route to a real operator. If you accidentally
  do — cancel immediately and flag to the operator.
- **Destructive actions on another user's behalf.** Don't
  "pretend to be" another user by asking them for credentials;
  if a role-behavior question arises, flag it and the operator
  will test it with the right account.

If you're unsure whether something is in scope, **ask the
operator first** via WhatsApp. "Can I click X" is a valid
15-second question.

---

## 6. Daily checklist (30-second morning routine)

Every weekday morning, before any deep testing:

1. **Login** at `https://catalysterp.org/login`. Re-auth if
   session expired overnight.
2. **Sanity ?debug=1 on the home page** — check the debugger
   panel still renders. If it doesn't, file a `[debugger]`
   SEV3 bug before doing anything else.
3. **Check yesterday's bugs.** Open
   `https://catalysterp.org/inbox` or the dedicated bug-tracker
   URL the operator provides. Look for:
   - Any bug you filed that has an operator response (e.g.
     `> FIXED: <SHA>` appended) — verify the fix actually
     fixes what you saw. If it does, reply `verified by
     tejveer on YYYY-MM-DD`. If it doesn't, reply `not
     fixed — <describe what's still wrong>` and re-file at
     higher SEV.
   - Any bug marked "needs repro" — try to reproduce with
     more detail.
4. **Standup format** (send once per day, async):
   - Yesterday: bugs filed, verifications done
   - Today: what you plan to test
   - Blockers: anything preventing you from testing

### Reporting cadence

- **SEV1/SEV2 bugs**: file immediately, ping operator on WhatsApp.
- **SEV3 bugs**: file by end of the testing session.
- **SEV4 bugs**: batch up during the week, file up to 10 per
  commit to avoid spamming the log.
- **End-of-week summary**: every Friday, open a short review
  with the operator listing all bugs filed + their statuses.

---

## 7. Role × page matrix — test the whole site as every role

§1–§6 above cover your tester-role walk. This section adds a
second phase: after you're confident the site works for YOU, walk
the site **as every other role** to verify each role sees what
it should and is blocked from what it shouldn't.

### 7.1 Prerequisite — test accounts

You cannot change your own role (deliberately — tester role has
no role-switcher). Instead, the operator seeds one test account
per role on the CATALYST DB. You log in as each, walk the matrix
in §7.3, log out, log in as the next.

**Accounts to be seeded (blocking — see open-question at bottom
of this plan):**

| Username | Role | Purpose |
|---|---|---|
| `test.super_admin` | `super_admin` | Full-admin view (matches Nikita's view) |
| `test.site_admin` | `site_admin` | Site-wide settings + users, but no schema surgery |
| `test.instrument_admin` | `instrument_admin` | One instrument's admin view |
| `test.faculty` | `faculty_in_charge` | Faculty oversight view |
| `test.operator` | `operator` | Queue-mover view (the most common role) |
| `test.professor` | `professor_approver` | Academic-approval queue |
| `test.finance` | `finance_admin` | Finance-approval queue + payroll |
| `test.requester` | `requester` | Sample-submission view (end-user) |

All passwords `12345`, `must_change_password=1` on first login.
Display name starts with `TEST ` so real operators never confuse
these with real team members. These accounts are seeded in
`app.py` `real_team` list alongside `nikita`/`prashant`/`tejveer`
(seeded on every boot, idempotent, see seed-commit).

**If these accounts don't exist yet**: skip §7 and focus on §2
until the operator seeds them.

### 7.2 Live-site safety rails — READ ONCE, INTERNALIZE

**The website is LIVE. Real data flows through it. Every mis-step
has real-world consequences.** Five non-negotiable rules:

1. **Never create real entities.** Don't submit a real sample
   request. Don't add a real instrument. Don't upload a real
   receipt. If you need to test a form submit, use the words
   `TEST_TEJVEER_<timestamp>` in the most obvious text field so
   the operator can grep + delete afterward. Cancel the submit
   before final confirm if at all possible.
2. **Never delete anything.** Not even things you created by
   accident. Flag to the operator to delete.
3. **Never approve, reject, or close another user's work.** When
   logged in as `test.operator` or `test.professor`, your
   queue may show REAL pending work from real users. Look, don't
   touch. Filing a bug = OK. Clicking "Approve" on a real
   request = NOT OK.
4. **Never change settings that persist.** Don't toggle portal
   configuration. Don't edit office locations on real user
   profiles. Don't change password requirements. If you see such
   a toggle, the test is "does the toggle render and look
   correct?" — not "does toggling actually work?"
5. **Never use a real person's account.** Not even if you have
   their credentials. Use `test.*` accounts exclusively. Real
   accounts carry real audit trails; your test activity would
   contaminate them.

**If you accidentally do any of the above**: stop immediately.
Tell the operator on WhatsApp with the word URGENT. They'll
reverse the damage. Honesty here is infinitely more valuable than
saving face — the operator needs accurate data to decide what to
undo.

### 7.3 The matrix — per role

For each role below: log in, hit the **primary pages** (should
work cleanly), then hit the **forbidden pages** (should 403 or
redirect). One role per testing session; don't switch roles
mid-session.

Format per cell:
- ✅ = should work, file bug if broken
- 🚫 = should BLOCK (403 / redirect), file `[security] SEV2`
  bug if it actually lets you in

---

**test.super_admin** (= Nikita's view)

| Surface | Path | Expected |
|---|---|---|
| Dashboard | `/` | ✅ all tiles render with real counts |
| Users | `/admin/users` | ✅ full list + edit/delete buttons visible |
| Settings | `/admin/settings` | ✅ renders (don't toggle anything) |
| Instruments | `/instruments` | ✅ + add/edit controls visible |
| Schedule | `/schedule` | ✅ all requests visible across instruments |
| Approvals | `/approvals` | ✅ sees all queues (may be empty) |
| Insights | `/insights` | ✅ admin dashboard (top pages, actions) |
| Dev panel | `/dev` | 🚫 DEMO_MODE only — should 404 on prod |

**test.site_admin**

| Surface | Path | Expected |
|---|---|---|
| Dashboard | `/` | ✅ fewer tiles than super_admin |
| Users | `/admin/users` | ✅ list + edit; 🚫 cannot promote to super_admin |
| Settings | `/admin/settings` | ✅ some subset (not everything super_admin sees) |
| Schedule | `/schedule` | ✅ read all |
| Approvals | `/approvals` | ✅ visible |
| Dev panel | `/dev` | 🚫 403 or 404 |

**test.instrument_admin**

| Surface | Path | Expected |
|---|---|---|
| Dashboard | `/` | ✅ scoped to their instrument |
| Instruments list | `/instruments` | ✅ shows all, but only their own is editable |
| Their instrument | `/instruments/<their_id>` | ✅ full admin tabs |
| Other instrument | `/instruments/<other_id>` | ✅ read; 🚫 edit buttons |
| Schedule | `/schedule` | ✅ filtered to their instrument by default |
| Admin users | `/admin/users` | 🚫 403 |
| Settings | `/admin/settings` | 🚫 403 |

**test.faculty** (faculty_in_charge)

| Surface | Path | Expected |
|---|---|---|
| Dashboard | `/` | ✅ oversight view of their instruments |
| Their instruments | `/instruments/<id>` | ✅ read + some edits |
| Approvals | `/approvals` | ✅ their approval queue |
| Admin users | `/admin/users` | 🚫 403 |

**test.operator**

| Surface | Path | Expected |
|---|---|---|
| Dashboard | `/` | ✅ "today's queue" view |
| Schedule | `/schedule` | ✅ filtered to their queue |
| Request detail | `/requests/<id>` | ✅ operator actions visible (don't click on real data) |
| Intake mode | instrument page, intake toggle | ✅ renders; 🚫 don't toggle on real instrument |
| Admin users | `/admin/users` | 🚫 403 |
| Approvals | `/approvals` | 🚫 403 (not an approver role) |

**test.professor** (professor_approver)

| Surface | Path | Expected |
|---|---|---|
| Dashboard | `/` | ✅ approval-focused tiles |
| Under review | `/requests?status=under_review` | ✅ their approval queue |
| Request detail | `/requests/<id>` | ✅ approve/reject buttons visible — DO NOT CLICK on real requests |
| Instruments | `/instruments` | ✅ read |
| Admin users | `/admin/users` | 🚫 403 |

**test.finance** (finance_admin)

| Surface | Path | Expected |
|---|---|---|
| Dashboard | `/` | ✅ finance-focused tiles |
| Finance grants | `/finance/grants` | ✅ full access |
| Payroll | `/payroll` | ✅ full access |
| Request detail | `/requests/<id>` | ✅ finance approval visible — do not click on real data |
| Admin users | `/admin/users` | 🚫 403 |

**test.requester** (end-user role)

| Surface | Path | Expected |
|---|---|---|
| Dashboard | `/` | ✅ "my requests" view, limited tiles |
| New request | `/requests/new` | ✅ form renders; don't actually submit |
| My requests | `/requests?mine=1` | ✅ read-only list |
| Instruments | `/instruments` | ✅ read-only |
| Admin users | `/admin/users` | 🚫 403 |
| Approvals | `/approvals` | 🚫 403 |
| Schedule | `/schedule` | ⚠️ may show, may filter to own requests — log what you see |

---

### 7.4 Completeness tracking

Keep a simple checklist in your daily log (§8). One line per
role × primary page:

```
2026-04-17 test.operator /schedule  ✅ fine, queue renders
2026-04-17 test.operator /requests/<id>  ⚠️ bug 042 filed
2026-04-17 test.operator /admin/users  ✅ 403 as expected
2026-04-17 test.professor /requests?status=under_review  …
```

At end-of-week, you can grep your log for `⚠️` or `SEC` to produce
the summary for the operator.

Target: **one role per day**. Don't try to cover all 8 in one
session — the mental context-switch between roles is the thing
that makes you miss bugs. Monday = super_admin, Tuesday =
site_admin, and so on through Wednesday week 2.

---

## 8. The error log — how bugs get to dev

Bugs logged here are meant to be **processed by dev with minimal
friction**. Format matters because it lets dev grep + batch, not
hand-read every entry.

### 8.1 Primary channel — `/debug/feedback`

Already live. When you click Record in the debugger, speak +
click through the bug, then click Stop, the transcript + click
events land in:

```
lab-scheduler/logs/debug_feedback.md
```

One block per submission, with your username + timestamp. Dev
grep's this file to triage. Do not edit or curate this file;
the debugger owns it.

### 8.2 Structured supplement — your daily log

Alongside voice feedback, keep a plain-text daily log in your own
notes app or a shared doc. Use this one line per bug, following
§3's title format:

```
2026-04-17 10:42 SEV2 [schedule] status badge red instead of green — R3,C2 on /schedule — role=test.operator
2026-04-17 10:58 SEV3 [portal] nav wrong after lab→hq switch — R1,C4 on /calendar — role=test.super_admin
2026-04-17 11:15 SEC  [users] tester saw Delete button — R5,C1 on /admin/users/12 — role=tejveer — see WhatsApp URGENT
```

Fields (pipe-free, use em-dashes or `—`):
1. Date + time (local)
2. Severity — `SEV1`, `SEV2`, `SEV3`, `SEV4`, `SEC` (security), `UX`
3. Module tag in brackets — `[schedule]`, `[portal]`, `[users]`, etc.
4. One-line symptom
5. Grid cell + URL
6. Which role you were logged in as
7. If SEV1/SEV2/SEC: reference to the WhatsApp URGENT message

This log is **YOURS** — keep it on your laptop, send a copy every
Friday to the operator. It's your accountability trail, not the
team's. The team's canonical record is `/debug/feedback`
submissions.

### 8.3 How dev processes it

- `grep "SEV1\|SEV2\|SEC"` → immediate-attention queue
- `grep "^2026-04-17"` → "what did Tejveer find on this date"
- `grep "role=test.operator"` → role-specific findings
- `grep "\[schedule\]"` → module-specific findings
- End-of-week summary: dev writes a short PR-like reply to each
  SEV3+ bug, referencing commit SHA where the fix lands, so you
  can verify on next login.

**Be honest.** "I tried X, I saw Y, I expected Z" is worth ten
times "X is broken." The expected-vs-observed gap is the whole
signal. If you don't know what was expected, say so — "I'm not
sure if this is a bug; let me know" — and dev tells you.

### 8.4 Scale

One tester, live site, ~8-hour workday → expect 5–20 bugs per
day in the first week (volume decays as you map the surface).
SEV1/2 should be rare; if you file more than 3 SEV2s in a day,
slow down and re-verify — something's either very wrong or you're
mis-triaging. Either way the operator needs to know.

---

## What this plan does NOT cover

- CATALYST architecture context (see `CATALYST/docs/` if you're
  curious, but not required for your testing role).
- The ERP product roadmap — irrelevant to your work today.
- Other testers — if/when additional testers join, this plan
  gets versioned (`TESTING_PLAN_TEJVEER_v2.md`), not replaced.

---

## Questions this plan left intentionally open

(These are for the operator to answer within the first week;
Tejveer, you don't need to decide these.)

- Where exactly does `debug_feedback.md` live? (Currently
  `lab-scheduler/logs/debug_feedback.md`; may move if a
  dedicated tracker is set up.)
- Bug-tracker URL — separate from the `inbox` or integrated?
- Nikita's email for the break-glass contact in §1.
- Commit SHA placeholder in §3 once task 0103 (hold-⌘ shortcut)
  ships.
- **§7 prerequisite: seed the eight `test.*` accounts** in
  `app.py` `real_team` list. Until that ships, §7 is theoretical.
  One small commit (~10 LOC), should fit in a single 15-min
  burst; flagged as task `0108` in the next planning round.

Flag any of these questions to the operator as they come up.
Answers live as appendices here once confirmed.

---

**Welcome to the team. Your reports compound — every bug you
file becomes (eventually) a permanent automated check. The
first month's work is disproportionately valuable.**
