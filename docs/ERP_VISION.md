# CATALYST → ERP — vision, portal template, notifications bus

_Anchored 2026-04-11 @ `5bc3142`. Strategic anchor doc for the v2.0.0
"ERP multi-portal" release line. Not a build plan — a frame. The
v1.4.x waves in `NEXT_WAVES.md` keep shipping unchanged; this file
reframes what we're building so every v1.4 commit pays down v2.0
debt._

## The frame shift

**CATALYST as it stands today is not "a lab scheduling app". It is
the first portal of an internal ERP.** The scheduling flow,
approval chain, instrument matrix, role system, audit log, tile
grammar, and crawler taxonomy we have already built are **domain-
neutral building blocks** that happen to be wired into a
lab-operations example. Swap "instrument" for "conference room",
"sample request" for "leave request", and 90% of the code works
unchanged.

Scale the thinking up: an ERP for an organisation of ~1000
people, internal only (tailnet / VPN), LAN-grade latency, modest
write volume (tens to hundreds of operations per minute, not
thousands per second). At that scale, the right architecture is
**many thin, honest portals riding one shared spine**. Not a
microservice mesh. Not a BPM engine. A single Python process
with a small set of hard-locked patterns and many soft, per-
portal feature modules.

The current "CATALYST" product becomes the **Lab Operations portal**
— one of ~8-12 portals in the finished ERP:

```
┌─────────────────────────────────────────────────────────────┐
│                    ERP shell (base.html, topbar, auth)      │
│ ┌─────────┬──────────┬──────────┬─────────┬──────────┐     │
│ │  Lab    │Attendance│ Finance  │  HR     │ Facilities│ …  │
│ │  Ops    │          │          │         │           │    │
│ └─────────┴──────────┴──────────┴─────────┴──────────┘     │
│                                                              │
│  Shared spine:                                               │
│   • users + roles + sessions                                 │
│   • audit_logs (hash-chained event stream)                   │
│   • notifications bus (new, §4)                              │
│   • approval chain primitives (approval_steps)               │
│   • tile macros + 6-col grid + design creed                  │
│   • crawler taxonomy (skeleton / testing / roleplay /        │
│                       feature / backend / data)              │
└─────────────────────────────────────────────────────────────┘
```

Every portal ships its own tables, routes, tile templates, and
crawler strategies — but uses the same spine. The "What is a
portal?" contract is §3 below.

---

## 1. What we already have that generalises

An honest inventory, not a sales pitch. Each item below is a
building block that survives the jump from lab-ops to a generic
ERP unchanged or with trivial renaming.

### 1.1 UI grammar (template layer)

| Primitive               | File / concept                              | Generalisation                         |
|-------------------------|---------------------------------------------|----------------------------------------|
| `card_heading`          | `_page_macros.html`                         | Any portal section heading             |
| `stat_blob`             | `_page_macros.html`                         | Any metric-as-tile (count + label)     |
| `chart_bar`             | `_page_macros.html`                         | Any proportional / progress display    |
| `empty_state`           | `_page_macros.html`                         | Any empty-collection page              |
| `.inst-tiles` / `.dash-tiles` / `.users-tiles` | `styles.css` 6-col grid       | Every portal's index + dashboard       |
| `data-vis="{{ V }}"`    | `base.html` + philosophy crawler            | Per-role theme variables everywhere    |
| `.tile-*` class family  | `styles.css`                                | Any visual tile on any page            |
| In-place edit `data-toggle-target` | `base.html`                      | Any inline-editable field              |
| Role-hint badge         | `base.html` `tile-dash-role-hint`           | Shows "logged in as: X" on every page  |
| Matrix-style checkboxes | `user_detail.html` role × instrument       | Any resource × capability matrix       |

**None of the above say "lab" or "instrument" in their DNA.**
The 6-column tile grid is a portal-layout kit. `chart_bar` does
not know what a sample is. `data-vis` is a theme hook. This is
the most portable layer in the codebase.

### 1.2 Backend primitives

| Primitive                   | Current use                               | Portable reading                          |
|-----------------------------|-------------------------------------------|-------------------------------------------|
| `@login_required`           | Every route                               | Any authenticated route                   |
| `@owner_required`           | Dev panel                                 | Any superuser surface                     |
| `current_user()` + `current_role_display` | Every request               | Any per-session context                   |
| `visible_instruments_for_user` | Scoped access                          | `visible_<resource>_for_user` pattern     |
| `can_manage_members`, `can_approve_step`, `can_access_stats` | Permission helpers | `can_<verb>_<object>` family              |
| `query_all` / `query_one` / `execute` | All SQL                         | DB helper layer (portable to Postgres)    |
| `audit_logs` (hash-chained) | Every mutation                             | ERP-wide tamper-evident event stream      |
| `approval_steps` table      | Finance → Professor → Operator            | **Any** multi-step approval workflow      |
| `_load_balance_pick()`      | Approver round-robin                       | Any pooled-assignment problem             |
| `DEMO_MODE` + `LIVE_DEMO_MODE` | Per-env seeding                         | Same pattern per portal                   |
| `inject_globals` context processor | `current_role_display`, etc.      | ERP-wide theme + session context          |

The `approval_steps` primitive is the **most under-used powerful
thing** in the codebase right now. It is polymorphic in
`entity_type + entity_id` but currently only wired to
`sample_requests`. Point it at `leave_requests`, `purchase_orders`,
`expense_claims`, `change_requests` and we have four more portals
almost for free.

### 1.3 RBAC (the reason this scales)

- `ROLE_PERSONAS` — 9 canonical personas (owner, global_admin,
  faculty_admin, instrument_admin, operator, requester, finance,
  professor, student). Half of these rename naturally to an
  ERP: owner → `org_owner`, global_admin → `it_admin`,
  instrument_admin → `resource_admin`, operator → `fulfiller`,
  requester → `employee`, finance unchanged, professor →
  `department_head`, student → `guest`.
- `role × page visibility matrix` enforced by the `visibility`
  crawler. **This is the single biggest de-risker for a 1000-
  person deployment.** The crawler renders every role × every
  route and fails on any unexpected 200 / 403. Adding a new
  portal means extending the matrix — everything else is
  enforced automatically.
- Per-role landing content via `current_role_hint` + role-aware
  dashboard tiles. Every portal can expose a different "today"
  tile to every role without touching `base.html`.

### 1.4 Crawler taxonomy — the ERP QA spine

The 6-category taxonomy we built in `crawlers/taxonomy.py`
(`5bc3142`) is **deliberately ERP-shaped**, not lab-shaped:

| Category  | Purpose in a one-portal world | Purpose in an ERP                    |
|-----------|-------------------------------|--------------------------------------|
| skeleton  | Layout + CSS + a11y           | Every portal's tile grammar is consistent |
| testing   | Regression smoke              | Every portal's critical paths stay green |
| roleplay  | RBAC across 9 personas        | Per-portal role × route matrix         |
| feature   | E2E happy path                | One lifecycle strategy per portal     |
| backend   | SQL + route budgets           | Per-portal perf ceiling               |
| data      | Integrity invariants          | Per-portal consistency rules          |

When a new portal is added, we do **not** add a new category.
We add one strategy **per category**, prefixed with the portal
name. E.g. an Attendance portal ships:

    crawlers/strategies/attendance_skeleton.py   → skeleton wave
    crawlers/strategies/attendance_smoke.py      → testing wave
    crawlers/strategies/attendance_rbac.py       → roleplay wave
    crawlers/strategies/attendance_lifecycle.py  → feature wave
    crawlers/strategies/attendance_perf.py       → backend wave
    crawlers/strategies/attendance_invariants.py → data wave

The `rhythm` wave automatically picks the shortest representative
per category, so the 5-minute-loop budget stays constant as the
ERP grows from one portal to twelve.

---

## 2. What we need that we don't have yet

Seven gaps, ordered by blast radius if we hit 1000 users. None
are v1.4.x blockers — they land as v1.5 / v1.6 / v2.0 waves — but
every v1.4.x commit should avoid painting us into a corner on any
of them.

1. **Postgres.** SQLite + WAL is comfortable to ~200 concurrent
   readers and ~20 sustained writers per second. At 1000 users
   with bursty writes (morning stand-ups, payroll run, year-end
   inventory) we will hit the single-writer lock. Plan: abstract
   SQL through `query_all`/`query_one`/`execute` (already done)
   so the DB driver swap is a day's work in one file.
2. **Real service runtime.** `python app.py` is a dev server. A
   1000-user deployment needs `gunicorn -w 4 -k gevent` behind
   nginx, with `/static` served directly. `scripts/start.sh
   --service` is the right seam; add a `--production` mode.
3. **SSO.** In-app login with bcrypt is fine for 25 people, a
   liability for 1000. Target: Google Workspace OIDC as the
   primary, local password as the fallback for service
   accounts and offline recovery. One `/auth/callback` route,
   no change to `users` table shape.
4. **Background jobs.** Notifications, scheduled exports,
   overnight reports, reminder emails-that-aren't-emails (see §4).
   Current code does all of these synchronously in the request
   thread. A Redis-backed RQ queue (~50 lines of glue) solves
   this without introducing Celery-level complexity.
5. **Rate limiting + abuse protection.** Internal ERP means
   mostly benign, but accidental 10,000-row CSV exports, runaway
   scheduled reports, and a mis-scripted curl loop are real.
   Add flask-limiter on hot routes, per-user caps.
6. **Multi-tenancy (conditional).** If this ERP ever hosts more
   than one org, we need row-level scoping on every query.
   Decision point: row-level `org_id` column on every table vs
   schema-per-tenant. For a single 1000-person org, skip
   entirely. For an ISV offering to multiple orgs, row-level is
   the cheaper default given our SQL layer.
7. **Secrets.** Currently `.env` per host. At N hosts this
   becomes a keyring problem. 1Password service account or
   `macOS keychain` wrapped via a launchd env hook for the mini;
   HashiCorp Vault or AWS Secrets Manager if the ERP ever runs
   off-prem.

---

## 3. What *is* a portal? (the contract)

A portal is the smallest unit of new functionality in the ERP.
Building one means writing exactly the following, nothing more:

```
portals/<portal_name>/
    __init__.py           # package
    schema.sql            # CREATE TABLE for this portal's tables
    routes.py             # @blueprint.route handlers
    templates/            # *.html using base.html + _page_macros.html
    roles.py              # portal-specific role additions (optional)
    tiles.py              # dashboard tile contributions
    permissions.py        # can_<verb>_<object> helpers
    crawler_strategies/   # one strategy per category (6 files)
```

Plus one line in `app.py`: `app.register_blueprint(portal)`. Plus
a row in `PORTAL_REGISTRY` in the shell. That's it.

Every portal **must** satisfy these invariants (enforced by
crawlers):

* **UI grammar.** Every page extends `base.html` and uses macros
  from `_page_macros.html`. Never reinvent tiles. Philosophy
  crawler will fail otherwise.
* **Role-scoped queries.** Every SELECT that returns portal data
  is filtered by `visible_<resource>_for_user(user)` or a
  permission helper. Visibility crawler enforces this.
* **Audit trail.** Every mutation emits to `audit_logs` with a
  namespaced `entity_type` like `attendance.timesheet` or
  `finance.invoice`. Data crawler samples N random mutations
  per run and asserts they landed in `audit_logs`.
* **Notifications hook.** User-facing state changes emit
  through the notifications bus (§4). E.g. an approval request
  that changes owner emits `attendance.timesheet.assigned` to
  the new owner. Feature crawler asserts the notification
  landed in the recipient's inbox.
* **Dashboard tile.** The portal contributes at least one tile
  to the central `/` dashboard, showing a per-user summary of
  "what do I need to act on?". Skeleton crawler asserts the tile
  renders for every role in `ROLE_PERSONAS`.

Portals **must not**:

* Talk to each other directly. All cross-portal signalling goes
  through the event stream + notifications bus.
* Introduce a new JS framework or CSS file. Use
  `static/styles.css` + inline `<script>` blocks.
* Define new auth. Use `@login_required` + permission helpers.
* Mutate rows they don't own. The `entity_type` prefix in
  `audit_logs` is the ownership contract.

---

## 4. Notifications bus — "email without email"

### The ask

> "Can we just have an event based notification system which sort
> of mimics the email system without actually sending emails.
> Like an internal database event based entry text based."

### Why this is the right call

Building an actual email system for an internal 1000-person ERP
is a trap:

* SMTP deliverability is a full-time job (SPF, DKIM, DMARC,
  reputation, bounce handling).
* Email is a leak vector — PII goes off-tailnet the moment SMTP
  hits an external relay.
* Users already have Gmail / Outlook for *external* email; they
  don't want another inbox noisy with ERP state churn.
* Mobile-push dependency means an Apple / Google relationship,
  certificates, entitlements. No.
* The actual user need is "I want to know when something needs
  my attention, and I want to click a link". That is a
  well-defined bounded notifications service, not email.

### What to build instead

An in-database notifications bus, per-user inbox, hooked into
the existing `audit_logs` hash chain. One new table, one helper,
one blueprint, one inbox UI. Zero external dependencies.

### Schema

```sql
CREATE TABLE IF NOT EXISTS notifications (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient_id   INTEGER NOT NULL,         -- users.id
    kind           TEXT NOT NULL,            -- "lab.request.approved", "attendance.timesheet.locked"
    severity       TEXT NOT NULL DEFAULT 'info',  -- info / warn / action / success
    subject        TEXT NOT NULL,            -- one-line, <=80 chars, shown in inbox row
    body           TEXT NOT NULL DEFAULT '', -- plain text, optional, shown on expand
    link_url       TEXT NOT NULL DEFAULT '', -- deep link into the portal that raised it
    entity_type    TEXT NOT NULL DEFAULT '', -- "sample_request", "timesheet", etc.
    entity_id      INTEGER,
    audit_log_id   INTEGER,                  -- hash-chain pointer back to source
    emitter_id     INTEGER,                  -- users.id of whoever caused it (null = system)
    read_at        TEXT,                     -- ISO8601 when user marked it read
    dismissed_at   TEXT,                     -- ISO8601 when user dismissed it
    created_at     TEXT NOT NULL,
    FOREIGN KEY (recipient_id) REFERENCES users(id),
    FOREIGN KEY (audit_log_id) REFERENCES audit_logs(id),
    FOREIGN KEY (emitter_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS ix_notifications_recipient_unread
    ON notifications(recipient_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_notifications_entity
    ON notifications(entity_type, entity_id);
```

### Helper (the single entry point every portal uses)

```python
def emit_notification(
    *,
    recipient_id: int,
    kind: str,                 # namespaced "<portal>.<object>.<action>"
    subject: str,
    body: str = "",
    link_url: str = "",
    entity_type: str = "",
    entity_id: int | None = None,
    severity: str = "info",
) -> int:
    """Create a notification AND a hash-chained audit entry.

    Returns the new notifications.id. Safe to call multiple times
    per request — the notifications are per-recipient, so fanout
    for a group action is just N calls.
    """
    payload = {
        "kind": kind,
        "subject": subject,
        "body": body,
        "link_url": link_url,
        "recipient_id": recipient_id,
    }
    audit_id = append_audit_log(
        entity_type=entity_type or "notification",
        entity_id=entity_id or 0,
        action=kind,
        actor_id=current_user_id(),
        payload=payload,
    )
    return execute(
        """INSERT INTO notifications
           (recipient_id, kind, severity, subject, body, link_url,
            entity_type, entity_id, audit_log_id, emitter_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (recipient_id, kind, severity, subject, body, link_url,
         entity_type, entity_id, audit_id, current_user_id(),
         now_iso()),
    )
```

Two properties this gives us for free:

1. **Tamper-evident.** The audit-log entry is hash-chained. A
   notification that claims to exist but doesn't have a matching
   `audit_logs` row (or whose row's hash doesn't validate) is
   rejected at rendering time. Data crawler asserts this
   invariant.
2. **Polymorphic.** The same helper works for every portal. A
   new portal calls `emit_notification(kind="attendance.leave.approved", …)`
   and the inbox renders it with the right icon + deep link. No
   portal-specific inbox code.

### Kinds and naming

`<portal>.<object>.<action>` lowercased, dot-separated. Examples:

| Kind                                  | Trigger                                  | Recipient            |
|---------------------------------------|------------------------------------------|----------------------|
| `lab.request.submitted`               | A sample request is created              | Next approver in chain|
| `lab.request.approved`                | Approval step advances                   | Requester            |
| `lab.request.rejected`                | Approval rejected                        | Requester            |
| `lab.request.sample_ready`            | Operator marks sample ready              | Requester            |
| `lab.instrument.downtime_scheduled`   | Admin schedules maintenance              | Everyone in pool     |
| `attendance.timesheet.assigned`       | HR assigns a timesheet                   | Assignee             |
| `attendance.leave.needs_approval`     | Leave request lands in manager queue     | Manager              |
| `finance.invoice.overdue`             | Daily sweep job finds overdue invoice    | Invoice owner        |
| `hr.review.scheduled`                 | Annual review scheduled                  | Reviewee + reviewer  |

Each kind is registered once in `portals/<p>/notifications.py`
with a human-readable name + an icon class. The inbox template
reads that registry to render the row.

### Inbox UI

One new route: `/inbox`. One new template: `inbox.html`. Uses
exactly the tile macros we already have (`card_heading`,
`stat_blob`, `chart_bar`, `empty_state`). Columns:

```
 Unread: 7   Acting:  3   Informational: 28   [Mark all read]
──────────────────────────────────────────────────────────────
  [▶]  lab.request.approved        Your request LR-221 is ready
       2h ago · Requester → Operator                      [open]
  [!]  attendance.leave.needs_approval  Shah requested 3d leave
       4h ago · HR → Manager                              [open]
  [✓]  finance.invoice.paid        Invoice INV-902 was paid
       yesterday                                          [open]
```

The `[open]` link goes to `link_url`. The `[▶] / [!] / [✓]` icon
comes from `severity` (action / warn / info / success). Clicking
an action-severity row marks it read and opens the deep link in
the same tab. Keyboard shortcut `i` from anywhere goes to the
inbox. (`W1.4.1` keybinds wave already plans `n` and `?`; add
`i` to the same commit.)

Topbar bell badge: uses the same `.topbar-count-badge` style the
W1.4.1 polish wave plans for approvals/requests. Count is
`COUNT(*) WHERE recipient_id = current_user AND read_at IS NULL
AND severity IN ('action','warn')`. Purely informational
notifications don't drive the badge count.

### Wiring into existing CATALYST flow (the "retrofit" wave)

The retrofit is small because `approval_steps` already knows who
the next actor is. In each place CATALYST advances an approval step
today, add one call:

```python
emit_notification(
    recipient_id=next_approver_id,
    kind="lab.request.needs_approval",
    subject=f"{request_no} · {sample_name} — needs your approval",
    body=f"Submitted by {requester_name} on {submitted_at}.",
    link_url=url_for("request_detail", request_id=request_id),
    entity_type="sample_request",
    entity_id=request_id,
    severity="action",
)
```

That's it. Five to eight sites in `app.py` get the retrofit call.
Every future portal emits through the same helper from day one.

### Crawler coverage

New strategy `notifications_lifecycle` in the `feature` category:

1. Seed users, create a sample request as `shah@lab.local`.
2. Advance the request through the approval chain as each approver.
3. After each step, assert the **next** approver has exactly
   one new unread `action`-severity notification with the right
   `kind`, and the **previous** actor has none.
4. Mark all read, assert `topbar-count-badge` disappears.
5. Walk the audit chain for every emitted notification, assert
   the hash links match (`data` invariant).

Budget: ~3 seconds. Drops into the `feature` wave and the `all`
wave. Eventually the `rhythm` wave picks it up if it's the
fastest feature-category representative.

### Build estimate

A single v1.4.x wave, ~1 day:

1. **Commit 1:** schema migration + `emit_notification()` +
   `/inbox` GET + template. No wiring, no badge. `feature`-wave
   `notifications_lifecycle` crawler proves the emit path works
   end-to-end.
2. **Commit 2:** retrofit 5-8 emit sites in the existing
   approval + sample-ready + rejection flows. Lifecycle crawler
   extended to assert every step emits the right kind.
3. **Commit 3:** topbar bell badge + `i` keyboard shortcut +
   polish. Visibility crawler extended to assert the badge only
   renders when `recipient_id=current_user AND unread`.

This is the first real ERP-spine feature. Ship it on the v1.4.x
line (call it **W1.4.4 — notifications bus**, slotted after
W1.4.1 polish and before W1.4.3 release gate) and the v2.0.0
multi-portal work inherits it for free.

---

## 5. Worked example — "Attendance" portal from these parts

To prove the contract is real, here is what building the second
portal looks like end-to-end. No code, just the shape. Assume
§4 notifications bus is live.

**Tables** (one new file `portals/attendance/schema.sql`):

```sql
CREATE TABLE attendance_timesheets (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL,
    period_start    TEXT NOT NULL,   -- ISO date
    period_end      TEXT NOT NULL,
    status          TEXT NOT NULL,   -- draft / submitted / approved / locked
    total_hours     REAL NOT NULL DEFAULT 0,
    submitted_at    TEXT,
    approved_at     TEXT,
    locked_at       TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE attendance_entries (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    timesheet_id    INTEGER NOT NULL,
    entry_date      TEXT NOT NULL,
    hours           REAL NOT NULL,
    note            TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (timesheet_id) REFERENCES attendance_timesheets(id) ON DELETE CASCADE
);

CREATE TABLE attendance_leaves (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL,
    leave_type      TEXT NOT NULL,   -- sick / vacation / personal
    start_date      TEXT NOT NULL,
    end_date        TEXT NOT NULL,
    reason          TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Reused from the spine** (not re-implemented):

- **Approval chain.** A leave request is an `approval_steps` row
  pointing at `attendance_leaves.id` with `entity_type = "attendance_leave"`.
  The existing `_default_user_for_approval_role("manager")`
  picks the right manager via load balancing. **Zero new
  approval code.**
- **Audit log.** Every mutation on `attendance_timesheets` or
  `attendance_leaves` emits to `audit_logs` with entity_type
  `attendance.timesheet` or `attendance.leave`. Same helper.
- **Notifications.** Every state transition emits through
  `emit_notification()` with `kind="attendance.leave.needs_approval"`
  / `"attendance.timesheet.locked"` / etc.
- **Visibility scoping.** New helper `visible_timesheets_for_user(user)`
  follows the same pattern as `visible_instruments_for_user` —
  employees see their own, managers see their reports, HR sees
  everyone.
- **Tiles.** The dashboard gets a new
  `portals/attendance/tiles.py` that contributes one tile:
  "This week: 32/40 hours logged" using `stat_blob`, plus
  "Pending leave approvals: 3" using `stat_blob`. Dashboard
  renders it automatically because the portal is registered.

**New files** (`portals/attendance/` blueprint):

- `schema.sql` — 3 tables above
- `routes.py` — 4 routes: `/attendance/`, `/attendance/timesheet/new`,
  `/attendance/leave/new`, `/attendance/approvals`
- `templates/timesheet_new.html`, `leave_new.html`, `approvals.html`,
  `index.html` — all extending `base.html`
- `permissions.py` — `can_edit_timesheet(user, ts)`,
  `can_approve_leave(user, leave)`
- `tiles.py` — dashboard contribution described above
- `crawler_strategies/attendance_*.py` — six files, one per
  category

**Scale of new work:** ~800 lines of new code for the entire
portal. Compared to the ~7900 lines of CATALYST today, a second
portal is ~10% of the first portal's size because every
spine primitive is reused.

**Crawler impact:** six new strategies plug into existing
waves. The `rhythm` wave picks whichever attendance strategy is
fastest in each category (probably `attendance_smoke` for
testing and `attendance_invariants` for data). Budget stays
under 5 minutes.

---

## 6. Readiness scorecard — v1.3.0 at `5bc3142`

What the current codebase is or isn't ready for, on the ERP
roadmap. No colour theatre — just PASS / WARN / FAIL as our
crawlers would score it.

| Dimension                      | Status | Notes                                                |
|--------------------------------|--------|------------------------------------------------------|
| UI grammar (tiles, macros)     | PASS   | Already fully generic. Philosophy crawler enforces.  |
| RBAC primitives                | PASS   | 9 personas, visibility crawler, per-role landing.    |
| Approval chain primitive       | PASS   | Polymorphic via `entity_type`; only wired to sample_requests today. |
| Audit log (event stream)       | PASS   | Hash-chained, append-only, universally applicable.   |
| Crawler taxonomy               | PASS   | Six ERP-shaped categories, already shipped.          |
| Notifications bus              | FAIL   | Does not exist. §4 is the build spec — 1 day of work.|
| Blueprint / portal isolation   | WARN   | `app.py` is a single file. Blueprint extraction is a 2-day refactor. |
| DB engine                      | WARN   | SQLite WAL good to ~200 concurrent. Postgres swap is a day. |
| Runtime                        | WARN   | Flask dev server. gunicorn + nginx is half a day.    |
| SSO                            | WARN   | Local bcrypt only. Workspace OIDC is a 1-2 day add.  |
| Background jobs                | WARN   | Synchronous. RQ + Redis is 2 hours.                  |
| Rate limiting                  | WARN   | None. flask-limiter is 1 hour.                       |
| Multi-tenant                   | N/A    | Skip for a single-org ERP.                           |
| Secrets mgmt                   | WARN   | `.env`. Fine at 1 host; needs a plan at 5+.          |

**Headline:** we are ready for **two portals and ~100 users** on
today's infra (mini + launchd + SQLite + Flask dev server).
Going to ~1000 users needs the seven gaps in §2 landed, of which
**Postgres, gunicorn, and notifications are the first three**
and together are ~3 days of work.

---

## 7. How v1.4.x pays down v2.0.0 debt

Every v1.4.x wave is framed below as "what does this do for the
ERP?" so we don't ship polish that paints us into a corner.

| v1.4.x wave                     | ERP dividend                                                   |
|---------------------------------|----------------------------------------------------------------|
| W1.3.7 `deploy_smoke`           | Remote-probe crawler works against any portal on any host     |
| W1.3.8 launchd                  | Production-grade runtime seam; swap `--service` for `--production` for gunicorn  |
| W1.3.9 tailscale serve          | Every portal inherits "tailnet only, HTTPS, trusted cert" for free |
| W1.4.0 HTTPS cookies            | `Secure` cookies + `X-Forwarded-Proto` trust — SSO-ready     |
| **W1.4.1 polish batch**         | `.topbar-count-badge` style is the template for the inbox bell badge |
| **W1.4.4 notifications bus** (new) | First piece of true ERP spine. Unblocks every future portal |
| W1.4.3 stable release gate      | CHANGELOG format is the release pattern for v2.0.0           |
| W1.5.0 multi-role users         | Required for ERP — people wear multiple hats                  |
| W1.5.1 instrument groups        | Generalises to "resource groups" — one rename away from ERP-wide |
| W2.0.0 ERP multi-portal         | The payoff wave. Attendance portal as the pilot.              |

**W1.4.4 is the new wave this document adds to NEXT_WAVES.md.**
It slots between W1.4.1 (polish) and W1.4.3 (release gate)
because the polish batch's `.topbar-count-badge` class is a
prerequisite for the inbox bell.

---

## 8. Decisions this document asks you to make

Not now, soon:

1. **Do we want v2.0.0 to be "ERP multi-portal" on the roadmap?**
   If yes, I update `NEXT_WAVES.md` to add a v2.0.0 block
   pointing at this file. If no, this file stays as a thinking
   doc.
2. **Is W1.4.4 notifications bus in v1.4.x or pushed to v1.5.x?**
   Recommendation: v1.4.x. It is small (1 day), it unblocks the
   ERP spine, and it pays down polish debt (the bell badge
   becomes meaningful instead of cosmetic).
3. **Do we want the second portal to be Attendance, Finance, or
   something else?** Attendance is the easiest pilot because
   its approval chain is identical to lab requests. Finance is
   the highest-value because it pulls real org data. HR (leave +
   reviews) is the most politically charged. My recommendation:
   **Attendance** as the proof of the portal contract, then
   Finance once the contract is proven.
4. **When do we rename the repo from `lab-scheduler` to
   something ERP-shaped?** The longer we wait, the worse the
   repo URL mismatch feels. Candidates: `catalyst-erp`,
   `org-erp`, `one-portal`. I have no strong opinion; name is
   your call. The central git topology in `~/.claude/git-server/`
   supports renaming via a single `git mv` on the bare + working
   copy update. 20 minutes.

---

## 9. The smallest possible next step

If the above is too big to commit to: **just build W1.4.4 notifications
bus as a 1-day wave**. That alone:

* Proves `emit_notification()` is generic.
* Gives every existing approval step a notification trail.
* Creates the `/inbox` route pattern that every future portal
  will use.
* Adds one `feature`-category crawler (`notifications_lifecycle`).
* Lands the polish-wave bell badge with *real* content.

Nothing else from §§ 1-8 needs to be true for W1.4.4 to ship.
If we only ever build this one piece of spine and never touch
the ERP dream again, the codebase is still better. That's the
test for whether a spine addition is worth it, and W1.4.4
passes cleanly.

---

## Anchor + proof

* Plan-anchor commit: `5bc3142` (v1.3.9/W1.4.0 HTTPS code prep).
* Full `wave all` at this anchor: **4233 passed / 0 failed / 249
  warn** across 15 strategies in ~29s. Failures are zero. Warns
  are the known CSS-orphan backlog and palette suggestions
  tracked separately.
* Sanity wave: **160 / 0 / 0** in ~15s including `deploy_smoke`
  silent-skip.
* Rhythm wave: **199 / 0 / 0** in ~15.6s across all six
  categories.

The codebase is in its healthiest state since v1.3.0 was cut.
There is no technical reason not to start spinning up the
notifications bus this week.
