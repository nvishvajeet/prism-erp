# Deploy Policy — Lab ERP + Ravikiran ERP

**Written:** 2026-04-17 Paris by Station Bordeaux (Claude1, MBP).
**Scope:** every tenant spawned from the ERP-builder (`~/Documents/Scheduler/Main/`).

---

## TL;DR

| Trigger | What happens | Who is affected | Downtime |
|---|---|---|---|
| **Dev push to `v1.3.0-stable-release`** | Mini's post-receive hook runs `checkout -f` + `launchctl kickstart -k` | All logged-in users on that tenant | **1-3 seconds of 502** during gunicorn restart |
| **Daily safety-net cron (03:00 local)** | Re-pull `origin/v1.3.0-stable-release`, hard-reset, kickstart | Nobody normally (low-traffic hour) | 1-3 sec |
| **New-version client toast** | `/api/version` returns the deployed git sha; browser polls every 60 s; if sha changes, toast "New version available — click to refresh" | Active users | Zero downtime (user chooses when to reload) |
| **Manual feature-ship (risky changes)** | Operator triggers `scripts/deploy_graceful.sh` which uses gunicorn SIGHUP (graceful reload, no worker kill) | Nobody (rolling restart) | 0 sec |

## How current users get the latest code

**Three layers, in increasing "user-notice" terms:**

### Layer 1: Session cookie survives restart
Gunicorn kickstart = all workers drop, but Flask session cookies are stored client-side. When a user's next request arrives at the new workers, their session resumes. **No re-login needed.**

What doesn't survive:
- In-flight HTTP request at the exact kickstart moment → gets 502, user sees "retry" state.
- Client-side JS state (unsaved form, open modal) — JS keeps running in the browser, talks to new backend on next call.

### Layer 2: `/api/version` poll + client-side toast
Every authed page includes `static/version_check.js`. The script polls `/api/version` every 60 seconds. The endpoint returns:

```json
{"sha": "abc1234", "deployed_at": "2026-04-17T19:12:30Z", "tenant": "lab"}
```

If the sha changes from what the page booted with, a toast appears:

> **New version available** — click to refresh and pick up the latest

User clicks → `window.location.reload()` → browser fetches new HTML + new JS from the updated server → user is now on the latest code. Zero re-login.

### Layer 3: Hard-refresh prompt after 24 h
If a user's tab has been open > 24 h, the version-check toast escalates to a modal that requires acknowledgment. Prevents users on ancient code from hitting schema-drift 500s.

---

## Server restart cadence (non-dev)

| Cadence | Mechanism | Purpose |
|---|---|---|
| **Per-commit** (dev mode, today) | Post-receive hook kickstart | Fastest iteration |
| **Daily 03:00 local** (standing rule) | launchd plist `local.catalyst.daily-redeploy` runs `scripts/daily_redeploy.sh` | Safety net — picks up any push that hook missed + clears memory leaks + re-runs `init_db()` for schema-drift close on cold start |
| **Weekly Sunday 04:00 local** (standing rule) | launchd plist `local.catalyst.weekly-maintenance` runs `scripts/weekly_maintenance.sh` | `git gc`, log rotation, sqlite `VACUUM`, disk-space audit, backup-prune |
| **Manual** | Operator types in Terminal | Emergency rollback, forced sync |

**Not planned:**
- Hourly restarts — pointless on M-series + low-traffic tenants.
- Restart on config change — launchd plist doesn't change often.
- Restart on log size — log rotation is a separate cron.

---

## Feature-ship flow (for risky changes)

When shipping something bigger than a 20-line diff (e.g., F-series schema migrations, security hardening, new auth flow):

1. **Pre-flight check** — smoke_test.py green + a test tenant user can still navigate the path.
2. **Announcement** — flash a banner to every active session: "Deploy in 60 seconds — save your work." Banner is controlled by `/admin/notices` with `severity=info` + `auto_hide_in=60` seconds.
3. **Graceful reload** — `scripts/deploy_graceful.sh` sends `SIGHUP` to gunicorn master. Old workers finish their in-flight request then exit; new workers boot in parallel. Net result: zero 502's.
4. **Post-flight probe** — hit `/api/health-check` + 3 key authed routes. If any 5xx, auto-revert + log.
5. **Success toast** — broadcast "Deploy complete" to all active sessions via the notice system.

The current `launchctl kickstart -k` works for routine dev pushes (acceptable 1-3 sec window). `deploy_graceful.sh` is reserved for user-visible features.

---

## Shipped this commit (policy enforcement)

- `docs/DEPLOY_POLICY_2026_04_17.md` — this doc.
- `app.py` — `GET /api/version` → returns current sha + deployed_at + tenant.
- `static/version_check.js` — client poll + toast.
- `templates/base.html` — includes `version_check.js` for authed users.

## Follow-up tickets (queued)

- **DP1** — `scripts/daily_redeploy.sh` + `ops/launchd/local.catalyst.daily-redeploy.plist` + install.
- **DP2** — `scripts/weekly_maintenance.sh` + plist + install.
- **DP3** — `scripts/deploy_graceful.sh` (SIGHUP-based rolling reload).
- **DP4** — `/admin/notices`-based deploy announcement banner.
- **DP5** — Hard-refresh modal for tabs open > 24 h.

DP1 is ≤ 60 lines of bash + plist — Codex ticket, ships in one burn. Rest are medium.

---

## Rollback

All deploys are git-based. To rollback:

```bash
ssh catalyst-mini 'cd ~/Scheduler/Main && git reset --hard <prev-sha> && launchctl kickstart -k gui/$(id -u)/local.catalyst'
```

Also sync the ERP-Instances copy:
```bash
ssh catalyst-mini 'cp ~/Scheduler/Main/app.py ~/ERP-Instances/lab-erp/live/app/app.py && launchctl kickstart -k gui/$(id -u)/local.catalyst.mitwpu'
```

Rollback is 5 seconds. Always preferred over trying to hot-patch a broken deploy.
