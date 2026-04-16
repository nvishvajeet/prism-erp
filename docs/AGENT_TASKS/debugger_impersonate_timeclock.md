# Ship: Tejveer debugger — impersonate-Nikita + time-clock + weekly payout

> **Target agent:** Claude 1 (or any coding agent picking this up).
> **Scope:** Debugger role that can impersonate another user (Tejveer
> acts *as* Nikita for testing) + a passive time-clock that
> accumulates logged minutes and rolls up into a weekly ₹200/hr
> payroll row every Friday.
> **Branch:** claim a branch off `v1.3.0-stable-release`.
> **Estimated effort:** 4–6 hours focused; hard-stop at 8h.
> **Scope lock:** the two features ship together because the
> time-clock's whole value is logging *debugging time*, so they
> share the same session-swap plumbing.
>
> Written 2026-04-16 after user confirmed "since nikita is allowed
> to take actions" — meaning the debugger's actions must persist
> and flow through all downstream workflows exactly as the
> impersonated user's would. Read-only debug mode was explicitly
> rejected.

## 1. Why

The rig now has a designated QA tester (Tejveer) whose job is to
reproduce bugs that surface in Ravikiran's live ERP. To reproduce
a bug that only Nikita can trigger — a permission path, a
workflow step that requires super_admin — Tejveer needs to *be*
Nikita for the duration of a testing session, not just view her
dashboard.

Because his actions reflect Nikita's permissions and persist to
live data, every side-effect (notifications, approvals, audit
signatures, workflow state advances) must look identical to
what would happen if Nikita herself clicked. The only difference
is in the audit log: a companion field records that Tejveer was
the effective human behind the session, so post-hoc we can tell
who really drove any given change.

Tejveer is paid ₹200 per clocked hour, rolled up weekly on
Friday with the final hour rounded up. The time-clock captures
any period when his browser is actively hitting the app (a
standard idle-timeout heartbeat) so nobody has to manually log
hours.

## 2. Hard scope — in / out

### In

- New `debugger` capability on `users` via `is_debugger BOOLEAN`.
- Session-level impersonation: a `super_admin`-gated `/admin/impersonate/<user_id>` endpoint that swaps the current request's effective user for the remainder of the session.
- `session["impersonating_id"]` + `session["impersonated_by"]`.
- `current_user()` in `app.py` returns the *impersonated* user so downstream logic is unchanged.
- Audit trail: every `audit_logs` row written while impersonating gets a new column `effective_actor_id` populated with the real human (Tejveer). Existing `actor_id` stays as the impersonated user (Nikita) so downstream workflows see the expected actor.
- Banner on every page during impersonation: `"⚠ Debug session — acting as Nikita (signed in as Tejveer) · Exit"` with the exit as a POST to `/admin/impersonate/exit`.
- Time-clock table: `debugger_sessions` (id, actor_id, started_at, last_seen_at, ended_at, total_seconds, impersonating_id_at_start).
- Heartbeat: every rendered page for a debugger user pushes a small `fetch('/admin/debugger/heartbeat', {method: 'POST'})` once per minute; updates `last_seen_at`. No action → auto-close after 5 min of no heartbeat.
- Weekly rollup cron: Friday 20:00 IST run of `scripts/debugger_payout_weekly.py` which sums all `debugger_sessions` for the week, rounds UP to whole hours, writes a `payroll_rows` line "Debugger hours — week of YYYY-MM-DD — N hours × ₹200 = ₹X" attributed to Tejveer. Idempotent (safe to re-run).
- A dashboard tile on the debugger's own dashboard (not the impersonated view): "This week: 2h 45m · ₹600 → Friday payout · rounds up to 3h · ₹600".
- Crawler regression strategy covering: (a) debugger can impersonate, (b) non-super_admin cannot, (c) exit restores Tejveer session, (d) audit trail has both IDs, (e) heartbeat increments clock, (f) rollup is idempotent.

### Out (explicitly not this PR)

- Fine-grained "which users can Tejveer impersonate" allowlist — v1 is "any user in same tenant, as long as current user is `super_admin`" (future: a `debugger_allowed_targets` join table).
- Mobile-optimised debugger UI — the banner + exit link work on mobile by virtue of the existing responsive layout; a dedicated mobile debug console is v2.
- Impersonation of users across tenants — explicitly blocked in v1 (tenants are physically separate machines + DBs).
- Payroll *payment* — this PR writes the payroll row; the actual bank-transfer / UPI push is a separate feature on the ravikiran accountant's queue.
- Timezone-aware weekly boundaries for non-India deployments — v1 is hard-coded Asia/Kolkata Friday 20:00.
- Payroll overrides / corrections UI — if a week's rollup is wrong, Pournima/Prashant edit the row directly; a self-service correction surface is v2.
- "Read-only debug mode" — we explicitly chose writable impersonation. Don't add a read-only toggle.

## 3. Database schema

Add to `init_db()` in `app.py`:

```sql
-- Extend users with a debugger flag. Idempotent via PRAGMA check.
-- (Follow the pattern of _ensure_vendor_approval_columns at ~line 21619.)
-- ALTER TABLE users ADD COLUMN is_debugger INTEGER NOT NULL DEFAULT 0;

-- Every debug session (login to auto-close or explicit exit).
CREATE TABLE IF NOT EXISTS debugger_sessions (
  id                         INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id                   INTEGER NOT NULL REFERENCES users(id),
  impersonating_id_at_start  INTEGER REFERENCES users(id),
  started_at                 TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at                   TIMESTAMP,
  total_seconds              INTEGER NOT NULL DEFAULT 0,
  closed_reason              TEXT CHECK (closed_reason IN ('logout','idle_timeout','explicit_exit','week_cutover'))
);
CREATE INDEX IF NOT EXISTS idx_dbg_sessions_actor_week ON debugger_sessions(actor_id, started_at);

-- Extend audit_logs with the real-actor pointer. Only meaningful
-- when actor_id ≠ effective_actor_id (i.e. during impersonation).
-- ALTER TABLE audit_logs ADD COLUMN effective_actor_id INTEGER REFERENCES users(id);

-- Payroll rows table already exists per HR module; reuse it.
-- The rollup inserts rows with a recognizable subject:
--   subject = 'debugger.weekly.' || yyyy_mm_dd_of_friday
-- so the idempotency check can SELECT WHERE subject = that.
```

Use the existing `_ensure_vendor_approval_columns`-style idempotent
ALTER pattern for the two column adds. Do NOT blanket-ALTER every
startup — check `PRAGMA table_info()` first.

## 4. The `current_user()` swap

Grep for `def current_user(` in `app.py`. Current shape returns
a `sqlite3.Row` from a direct session-to-user lookup. Change:

```python
def current_user() -> sqlite3.Row | None:
    uid = session.get("user_id")
    if not uid:
        return None
    # If we're inside a debug-impersonation session, return the
    # impersonated user's row. Downstream permission checks and
    # audit writes use this, so Tejveer effectively operates as
    # Nikita for the rest of the request.
    impersonated = session.get("impersonating_id")
    target_id = impersonated if impersonated else uid
    return query_one("SELECT * FROM users WHERE id = ?", (target_id,))
```

Add a companion helper:

```python
def effective_actor() -> sqlite3.Row | None:
    """The REAL human driving the request (Tejveer). Used for the
    banner and for audit trail's effective_actor_id column."""
    uid = session.get("user_id")
    if not uid:
        return None
    return query_one("SELECT * FROM users WHERE id = ?", (uid,))
```

Every `audit_logs` insert site (grep `INSERT INTO audit_logs`)
must pass `effective_actor_id = effective_actor()["id"]` when it
differs from the `actor_id`. Do this as a small helper
`_audit_actor_ids()` that returns the tuple — keeps the diff surgical.

## 5. Routes

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/admin/impersonate/<int:user_id>` | Start impersonation. Guard: effective_actor is `super_admin` AND target user is in same tenant (always true in v1 since tenants are physically separate) AND target is active. Writes a `debugger_sessions` row with `impersonating_id_at_start = user_id`. Sets `session["impersonating_id"]`. Redirects to `/`. |
| `POST` | `/admin/impersonate/exit` | End the current impersonation. Updates `debugger_sessions.ended_at = NOW`, `closed_reason = 'explicit_exit'`, increments `total_seconds` from `(last_seen_at - started_at)`. Pops `session["impersonating_id"]`. Redirects to `/admin/debugger` (dashboard). |
| `POST` | `/admin/debugger/heartbeat` | Updates `debugger_sessions.last_seen_at = NOW` for the open session of the effective_actor. 204 No Content on success. Fire-and-forget from the client. |
| `GET`  | `/admin/debugger` | Debugger dashboard: impersonation target picker (dropdown of users), current week's clocked total + ₹, last 4 weeks rollup, button to start a session. |
| `GET`  | `/admin/debugger/sessions.json` | JSON dump of the current user's own sessions; super_admin can also query `?user_id=X`. |

### Guards

- `/admin/impersonate/*` routes: require `effective_actor()["role"] == "super_admin"` AND `effective_actor()["is_debugger"] == 1`. Tejveer's row should have `role='super_admin', is_debugger=1`. Nikita has `role='super_admin', is_debugger=0` so she can't accidentally impersonate.
- `/admin/debugger*` routes: require `is_debugger = 1`.
- The target user MUST be `active = 1` and not already `is_debugger = 1` (prevents chained impersonation).

### CSRF

Every POST must use the shared `{{ csrf_token() }}` pattern.
The heartbeat JSON POST from JS reads the same token out of the
existing `<meta name="csrf-token">` header (CATALYST already
exposes it; grep `csrf-token` in `base.html`).

## 6. Banner during impersonation

In `templates/base.html`, right under the existing topbar,
before `{% block content %}`:

```jinja
{% if session.get('impersonating_id') and current_user %}
<div class="debug-banner" role="alert" data-vis="{{ V }}">
  <span class="debug-banner-label" data-vis="{{ V }}">DEBUG SESSION</span>
  <span class="debug-banner-text" data-vis="{{ V }}">
    Acting as <strong>{{ current_user['name'] or current_user['email'] }}</strong>
    · signed in as <em>{{ effective_actor['name'] or effective_actor['email'] }}</em>
  </span>
  <form method="post" action="{{ url_for('impersonate_exit') }}" data-vis="{{ V }}">
    {{ csrf_token() }}
    <button type="submit" class="debug-banner-exit" data-vis="{{ V }}">Exit debug session</button>
  </form>
</div>
{% endif %}
```

Pass `effective_actor` into the template context from
`context_processor` in `app.py` (grep `context_processor` for
the existing one).

CSS in `static/styles.css` under `/* debugger banner */`: keep
it amber, sticky top, one row tall. Under 20 lines of CSS.

## 7. Heartbeat JS

One small module `static/debugger_heartbeat.js`:

```javascript
(function () {
  if (!document.querySelector('.debug-banner')) return;
  const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
  if (!csrf) return;
  const tick = () => {
    fetch('/admin/debugger/heartbeat', {
      method: 'POST',
      headers: { 'X-CSRFToken': csrf },
      credentials: 'same-origin',
    }).catch(() => {});
  };
  tick();                        // one at page load
  setInterval(tick, 60_000);     // once per minute while tab open
})();
```

Referenced in `base.html`:

```jinja
{% if session.get('impersonating_id') %}
<script src="{{ url_for('static', filename='debugger_heartbeat.js') }}" defer></script>
{% endif %}
```

## 8. Idle-timeout close

On every request through the debugger's session, if
`(now - debugger_sessions.last_seen_at) > 5 minutes`, close the
open session (`ended_at = last_seen_at`, `closed_reason =
'idle_timeout'`, compute `total_seconds`). This lives in a tiny
helper called once from `before_request`.

Logout also closes the open session (`closed_reason = 'logout'`).

## 9. Weekly payout rollup

`scripts/debugger_payout_weekly.py`:

```
For each debugger user:
  this_friday = last_friday_at_20_00_local()
  previous_friday = this_friday - 7 days
  total_seconds = SUM(total_seconds) FROM debugger_sessions
     WHERE actor_id = <user> AND started_at >= previous_friday AND started_at < this_friday

  hours_exact = total_seconds / 3600
  hours_rounded_up = ceil(hours_exact)         # round up to whole hour
  amount_rupees = hours_rounded_up * 200

  subject = 'debugger.weekly.' + this_friday.strftime('%Y-%m-%d')
  if payroll_rows has a row with this subject for this user:
    update it
  else:
    insert it
```

Install as a launchd calendar job on the host that owns
Ravikiran's payroll run (iMac for ravikiran, mini for mitwpu-rnd).
Calendar interval: Friday 20:00 local. Plist template alongside
the others in `~/Library/LaunchAgents/local.catalyst.debugger-payout.plist`.

## 10. Debugger dashboard tile

On `/admin/debugger` (GET):

```
┌────────────────────────────────────────┐
│ Debugger · Tejveer                     │
│                                        │
│ This week:  2h 45m logged              │
│             rounds up to 3h            │
│             = ₹600 · payout Fri 20:00  │
│                                        │
│ Last 4 weeks:                          │
│   2026-04-12  4h   ₹800                │
│   2026-04-05  3h   ₹600                │
│   2026-03-29  6h  ₹1200                │
│   2026-03-22  2h   ₹400                │
│                                        │
│ Start debug session →                  │
│  [ Target user: [Nikita ▾] ]           │
│  [ Start ]                             │
└────────────────────────────────────────┘
```

Use `card_heading`, `stat_blob` from `_page_macros.html`. Data
sourced from `debugger_sessions` (live) + `payroll_rows` (past).

## 11. Nav entry

Admin dropdown, below "Structure" (once that lands):

```jinja
{% if current_user and current_user['is_debugger'] %}
  <a href="{{ url_for('debugger_dashboard') }}" data-vis="{{ V }}">Debugger</a>
{% endif %}
```

Shown only to users with `is_debugger=1` — so Nikita/Pournima
never see this entry, only Tejveer does.

## 12. Deploy

After PR lands on `v1.3.0-stable-release`:

```bash
# push stable + reload every tenant
ssh catalyst-mini  'cd ~/Scheduler/Main && git pull --rebase && launchctl kickstart -k gui/$(id -u)/local.catalyst && launchctl kickstart -k gui/$(id -u)/local.catalyst.mitwpu'
ssh catalyst-imac  'cd ~/Scheduler/Main && git pull --rebase && .venv/bin/pip install -r requirements.txt && launchctl kickstart -k gui/$(id -u)/local.catalyst.ravikiran'

# MBP (playground + sahajpur-erp + labdemo)
kill $(cat /tmp/sahajpur-erp.pid); pkill -KILL -f 'gunicorn.*5061'
sleep 1
cd ~/Documents/Scheduler/Main && set -a; source .env.sahajpur; set +a
nohup .venv/bin/gunicorn app:app -w 2 -b 0.0.0.0:5061 --access-logfile logs/server-sahajpur.log --error-logfile logs/server-sahajpur.log --daemon --pid /tmp/sahajpur-erp.pid
# (same pattern for labdemo if you touched it)

# flip Tejveer's is_debugger on Ravikiran
ssh catalyst-imac "sqlite3 /Users/nv/Scheduler/Main/data/operational/lab_scheduler.db \"UPDATE users SET is_debugger=1 WHERE email='tejveer'\""

# install the weekly payout launchd job on iMac
scp ops/launchd/local.catalyst.debugger-payout.plist catalyst-imac:.Library/LaunchAgents/
ssh catalyst-imac 'launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/local.catalyst.debugger-payout.plist'
```

### Smoke

1. Log into ravikiran.catalysterp.org as `tejveer` / `12345`.
2. Navigate to `/admin/debugger`. Dashboard renders.
3. Pick "Nikita" → Start. URL bounces to `/`. Debug banner shows "Acting as Nikita · signed in as Tejveer".
4. Click through a workflow Nikita has access to (e.g. approve a vendor payment). Verify: `audit_logs.actor_id = nikita.id` AND `audit_logs.effective_actor_id = tejveer.id`.
5. Open another tab on the site — banner still there.
6. Wait 6 minutes idle, hit any route — session auto-closes. `debugger_sessions.closed_reason = 'idle_timeout'`. Banner gone.
7. Manually edit `debugger_sessions.last_seen_at` back, trigger the weekly rollup script → creates a `payroll_rows` line.
8. Run sanity wave — must be green.

## 13. Commit message

```
feat(debugger): impersonate + time-clock + weekly ₹200/hr rollup

Adds a debugger capability so Tejveer (QA tester on ravikiran) can
sign in as himself and impersonate another super_admin for the
session. Downstream actions persist with actor_id = impersonated
user; audit_logs adds effective_actor_id pointing at Tejveer for
post-hoc traceability. The session is idle-timed-out at 5 min and
its total_seconds flow into a Friday 20:00 IST weekly rollup that
writes a payroll_rows line at ₹200/h, rounded up to whole hours.

Scope:
- users.is_debugger, debugger_sessions, audit_logs.effective_actor_id
- routes: /admin/impersonate/{<id>,exit}, /admin/debugger{,/heartbeat,/sessions.json}
- context: current_user() returns impersonated row, effective_actor() returns real
- banner + heartbeat JS; launchd weekly rollup script

Refs: docs/AGENT_TASKS/debugger_impersonate_timeclock.md

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

## 14. Don't-do list

- **Don't** allow impersonation across tenants (physical separation
  is the security boundary).
- **Don't** make the heartbeat interval < 30 s — Ravikiran's site
  is often on slow home Wi-Fi; 60 s is the right cadence.
- **Don't** suppress audit-log writes during impersonation. Every
  action must still audit; the additional `effective_actor_id`
  column is the only change.
- **Don't** round to the *nearest* hour. User was explicit: always
  round **up** to whole hours, even if only 10 minutes were logged.
- **Don't** reuse Nikita's session cookie. The session stays
  Tejveer's; impersonation is a server-side switch, not a
  client-side identity swap.
- **Don't** add a generic "admin impersonate any user" surface for
  Nikita. Only `is_debugger=1` users can impersonate.

## 15. Exit gate

- [ ] Tejveer can log in, start a debug session, act, exit, and
      the dashboard reflects elapsed time.
- [ ] Audit log for a workflow action during impersonation has
      the two IDs correctly populated.
- [ ] Idle timeout fires after 5 min of no heartbeat.
- [ ] Weekly rollup runs in isolation (run it manually before
      waiting for Friday) and is idempotent on re-run.
- [ ] Nikita cannot see `/admin/debugger`, cannot access
      `/admin/impersonate/<id>` (both 403).
- [ ] Sanity wave green.
- [ ] Smoke-tested on all three tenants that have debugger users.
      (Ravikiran is the only one for now; set `is_debugger=1` for
      Tejveer there.)
- [ ] `docs/AGENT_TASKS/debugger_impersonate_timeclock.md`
      moved to `docs/AGENT_TASKS/done/` with the commit hash.
