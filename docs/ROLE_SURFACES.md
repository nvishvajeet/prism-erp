# Role surfaces — entry, login, forgot-password, Action Queue

> Specification doc. Captures four related UI/UX changes requested
> 2026-04-15 around the entry funnel, the login page, password
> recovery, and the admin Action Queue. Implementation lands later
> (after the branch-reconciliation stand-down — see "Why this is
> only a doc" at the bottom).

---

## 0. Universal queue principle (load-bearing)

**Every action that is generated in the system lands in some queue.**
No action is ever dangling, fire-and-forget, or "just an event". The
queue is what gives a human (or eventually an automated approver)
the chance to review, act, or dismiss. If you build a new feature
that creates a thing requiring a decision and you don't put it in a
queue, you've built a bug.

CATALYST already has multiple queues, one per actionable slice:

| Queue | Slice of actions | Surfaced at |
|---|---|---|
| **Action Queue** *(this doc, §4)* | Admin governance — account approvals (manual + AI), password resets, role changes | `/queue` (NEW) |
| **Schedule queue** | Sample-request approval steps (finance → professor → operator) | `/schedule` (existing) |
| **Finance queue** | Purchase orders pending approval, vendor invoices | Finance page (existing, partial) |
| **Vendor intake queue** | New vendor onboarding awaiting approval | Vendor admin (existing) |
| **AI advisor queue** | Free-text AI-pane submissions awaiting classification | `ai_advisor_queue` table, admin-pane (existing) |
| **Complaints queue** | Open complaints assigned to a manager | Complaint inbox (existing) |
| **Receipt review queue** | Receipt submissions pending finance approval | Receipt admin (existing) |
| **Issue queue** | Sample-request issues open against an operator | Per-instrument issue tab (existing) |

**Action Queue (§4)** is only ONE slice of this universal pattern —
the admin-governance slice. It is NOT a replacement for the other
queues. The user does NOT want one giant inbox that mixes sample
requests with password resets with PO approvals; each lives in its
own surface, each surface has its own page, and the admin's quick
actions get a dedicated `/queue` because they're the ones that don't
already have a strong canonical home.

**Rule of thumb when adding a new feature:**
1. Identify the action it produces.
2. Identify which existing queue that action belongs to.
3. If none fits, you need a new queue table + a surface — not a
   silent insert into a generic todo list.

---

## 1. ERP chooser (entry page)

The existing `/` route already serves an entry/landing page that lets
the visitor pick which ERP they're signing into (Lab, HQ/Ravikiran,
etc.). No changes proposed here — but every other surface in this
doc treats the entry page as the canonical "home" you can return to.

---

## 2. Login UX cleanup

**Currently** (`templates/login.html`):

- Back-to-entry only as a small bottom text link.
- Username field auto-fills `owner@catalyst.local` when `?demo=1`.
- Brand row renders `org_name` + `_portal_name` side-by-side, which
  collapses to "CATALYST CATALYST" when both are the platform default.
- Long "Tip: full email or short username" hint clutters the form.

**Target:**

1. **Back-to-home button at the top of the card** — visually obvious,
   not a tucked-away text link. Drops the bottom link.

   ```html
   <a href="{{ url_for('index') }}" class="login-back-button" data-vis="all">
     ← Choose ERP
   </a>
   ```

2. **No `owner@catalyst.local` baggage:**
   - Drop the `value="…demo_public_email…"` auto-fill on the username
     input. Keep the password auto-fill ONLY for `?demo=1`.
   - Placeholder becomes plain `Username` — no `dean`, no
     `name@mitwpu.edu.in`, no email pattern.
   - Drop the "Tip: enter full email or short username" line.

3. **Single-word brand** — collapse the subtitle when
   `org_name == _portal_name`. No more "CATALYST CATALYST".

4. **Forgot-password link** below the password field (see §3).

These four are surface-level changes to `login.html` only. No route
changes, no schema changes.

---

## 3. Forgot-password — admin-mediated reset

**Principle:** users never reset their own password directly. Every
reset is mediated by a site_admin / super_admin. This matches the
existing "no self-onboarding, every account is admin-approved"
posture and keeps the security trail.

**Flow:**

```
USER  /login → "Forgot password?" link
      ↓
      POST /forgot-password (form: username/email, no auth)
      ↓
SYS   INSERT INTO password_reset_requests (status='pending')
      INSERT INTO system_notifications (one per eligible admin)
      INSERT INTO user_todos (one per eligible admin, action_url=/admin/password-reset/<id>)
      ↓
USER  flash "If that account exists, an admin has been notified."
      ← deliberately vague, doesn't confirm existence

ADMIN sees Action Queue badge tick up
      ↓
      Opens Action Queue (or notification, or todo)
      ↓
      Clicks "Generate temp password"
      ↓
SYS   UPDATE users SET password_hash=hash(new_temp), must_change_password=1
      UPDATE password_reset_requests SET status='resolved', resolved_by_user_id=admin
      ↓
ADMIN sees the temp password ONCE on screen — relays to user out-of-band

USER  logs in with temp password → forced password change on first request
      (this enforced-rotation flow already exists, just plugs in here)
```

**New table:**

```sql
CREATE TABLE IF NOT EXISTS password_reset_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username_entered TEXT NOT NULL,         -- what they typed; doesn't have to match a user
    matched_user_id INTEGER,                -- nullable — null = no such user (don't tell requester)
    status TEXT NOT NULL DEFAULT 'pending', -- pending → resolved | rejected | expired
    requested_at TEXT NOT NULL,
    resolved_by_user_id INTEGER,
    resolved_at TEXT,
    decision_note TEXT NOT NULL DEFAULT '',
    requester_ip TEXT NOT NULL DEFAULT '',  -- audit only, not displayed to admin by default
    requester_ua TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_pwreset_status ON password_reset_requests(status, requested_at);
CREATE INDEX IF NOT EXISTS idx_pwreset_user   ON password_reset_requests(matched_user_id);
```

**New routes:**

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET`  | `/forgot-password` | none | render the request form |
| `POST` | `/forgot-password` | none (rate-limited) | enqueue request + notify admins |
| `GET`  | `/admin/password-reset` | site_admin / super_admin | list pending requests |
| `POST` | `/admin/password-reset/<id>/resolve` | site_admin / super_admin | generate temp password, mark resolved |
| `POST` | `/admin/password-reset/<id>/reject` | site_admin / super_admin | mark rejected with note |

**Rate limiting:** reuse the existing `/login` rate limit
(10 attempts / 5 min / IP) for `/forgot-password` POST.

**Audit:** every state change writes an `audit_logs` row
(`entity_type='password_reset'`).

---

## 4. Action Queue — admin governance inbox

**Scope is narrow on purpose:** this is for **admin-related actions
only**. Per-module workflows (sample request approvals, vendor
intake, leave, attendance corrections, complaints) stay in their
own pages. The Action Queue does not try to be the universal inbox.

**What appears in the Action Queue (admin items only):**

| Source table / state | Item type | Eligible reviewer roles |
|---|---|---|
| `users WHERE invite_status='pending_approval'` (manual `bulk_create_users`) | Account approval — manual | site_admin, super_admin, instrument_admin (per `can_create_users`) |
| `ai_prospective_actions WHERE action_type='create_account' AND status='awaiting_review' AND assigned_approver_id=me` | Account approval — AI-extracted from upload | the assigned approver (admin role) |
| `password_reset_requests WHERE status='pending'` | Password reset request | site_admin, super_admin |
| `users WHERE role_change_pending=1` (future) | Role change request | super_admin |

**What does NOT go in the Action Queue:**

- Sample-request approval steps (`approval_steps`) — already live on `/requests/<id>` and the Queue page (`/schedule`).
- Purchase orders (`purchase_orders WHERE status='pending_approval'`) — already counted in `nav_pending_counts.pending_approvals` and surfaced on the Finance page.
- Vendor approvals — own page.
- Sample request issues / complaints — own pages.
- Notifications, read receipts, todos a user assigned to self — separate mental models.

**Page layout** (`templates/action_queue.html`, route `/queue`):

Each row renders:

```
[BADGE]  [SUBJECT one-line]                    [SUBMITTED-BY · AGE]   [Approve] [Reject] [Open ↗]
```

- `BADGE` colour-coded by source: blue=Account-Manual, purple=Account-AI, orange=Reset, grey=Other.
- `SUBJECT` examples:
  - "New operator: Mr. Ranjit Kate (RKA)"
  - "AI proposal: 6 R&D operators from Kondhalkar's xlsx"
  - "Password reset for `kondhalkar@mitwpu.edu.in`"
- `Approve` / `Reject` are inline buttons that POST and stay on the queue.
- `Open ↗` jumps to the canonical surface (`/admin/users` for accounts, `/admin/password-reset/<id>` for resets, `/admin/ai-imports/<id>` for AI proposals).

**Critical design rule — DUAL-HOMING:**

> Every item visible in the Action Queue is **also** visible in its
> canonical subsite. The Action Queue is a consolidator, never a
> substitute. An admin who never visits `/queue` can still do their
> job from `/admin/users`, `/admin/password-reset`, etc. The queue
> is for speed, not for hiding the surface.

When one admin acts on an item, it disappears from every other
admin's queue (status flip, queries are live).

**Top-nav badge:** new key `nav_pending_counts.action_queue` =
sum of items the *viewer* can act on. Existing
`nav_pending_counts.pending_approvals` (PO subset) stays for the
Finance badge and is unchanged.

**Route gate:**

```python
@app.route("/queue")
@login_required
def action_queue():
    user = current_user()
    if not (is_owner(user) or has_any_role(user, "site_admin", "super_admin",
                                                  "instrument_admin", "finance_admin")):
        abort(403)
    items = _gather_queue_items(user)
    return render_template("action_queue.html", items=items)
```

`_gather_queue_items` issues one query per source table (UNION ALL is
tempting but per-source filtering is cleaner), aggregates the rows
into a typed list, sorts by oldest-first, deduplicates if the same
admin would see the same item twice via two role memberships.

---

## Implementation order (when reconciliation lands)

1. **Schema first** — single migration commit:
   - `password_reset_requests` table + indexes (Lab ERP DB, then propagate to Ravikiran when its schema sync happens).
2. **Login.html cleanup** — surface-only changes (§2). Smoke green.
3. **Forgot-password endpoints** — backend + admin reset page.
4. **Action Queue** — page + nav badge + dual-homed list.
5. **Notifications/todos plumbing** — wire password reset and AI proposal events into the existing notifications + user_todos plumbing.

Each is a single bounded commit, smoke-testable on its own.

---

## Why this is only a doc (right now)

The login template is in a 3-way divergent state right now:

- mini's deployed copy (md5 `0e3fd09…`)
- my local committed copy
- another agent's uncommitted edit on this MacBook (md5 `d35cdc…`)

Plus the local stable branch is on a separate commit chain from
mini's stable. Touching `login.html` or adding routes to `app.py`
without a clean reconciliation would either pile on top of in-flight
work or fail the merge later.

Capturing the spec here as the durable artefact. When the branch
state is clean, this doc is the brief; one or two bounded commits
land the work.
