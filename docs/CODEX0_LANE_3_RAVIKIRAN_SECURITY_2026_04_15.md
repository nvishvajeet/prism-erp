# Codex 0 Lane 3 — Ravikiran security parity

> Third lane for Codex 0 after Lane 1 (SEV2 remediation on
> Lab-ERP) and Lane 2 (ProxyFix + ship-readiness). You've made
> Lab-ERP ship-ready; this lane carries the same work to the
> Ravikiran-ERP wrapper so both ERPs enter v2.0 with matching
> security posture. Addressed to Codex 0; skip if you're not.

---

## Context

Ravikiran-ERP was forked from Lab-ERP pre-v2.0 and is still
behind on the security work you just finished. Claude 0's
warmup contamination audit found 117 grep hits (most
now cleaned), but Ravikiran's **app.py** still lacks:

1. Login rate limiter
2. Security response headers middleware
3. ProxyFix wrapping the WSGI app
4. Context-processor permission flags
5. `ship_readiness_check.py` equivalent
6. Audit trail

Constraint unlock for this lane only: **you MAY edit
`ravikiran-erp/app.py`.** Other agents (Claude 0 and Claude 1)
are not touching it right now; no conflict risk.

---

## Lane boundaries

Repo: `/Users/vishvajeetn/Claude/ravikiran-erp`.
Branch: `operation-trois-agents`.

Files you own:
- `ravikiran-erp/app.py` — mirror of the Lab-ERP changes
- `ravikiran-erp/tests/test_security_headers.py` — NEW (if tests/ exists)
- `ravikiran-erp/tests/test_login_ratelimit.py` — NEW
- `ravikiran-erp/tests/test_proxy_csrf.py` — NEW
- `ravikiran-erp/scripts/ship_readiness_check.py` — NEW
- `ravikiran-erp/docs/SEV2_REMEDIATION_RAVIKIRAN_2026_04_15.md` — NEW

Files you must NOT touch:
- `ravikiran-erp/templates/**` (Claude 1's territory, closed)
- `ravikiran-erp/static/**` (Claude 1)
- Lab-ERP repo (nothing to do there this lane)
- Any launchd plist / Cloudflared config

No pre-receive smoke hook exists on `ravikiran-erp.git` bare.
Run the Lab-ERP smoke from MBP against your ravikiran clone
manually (cross-clone smoke — it'll catch obvious import
breakage) OR just run `python -c "import app; print('ok')"`
from the Ravikiran working copy before pushing.

---

## Deliverables

### 1. Port the LoginRateLimiter (~5 min)

Copy the `LoginRateLimiter` class from Lab-ERP's app.py (the one
you just shipped in Lane 1) into Ravikiran's app.py. Wire into
Ravikiran's `/login` handler (`grep -n "def login" app.py` —
same handler shape as Lab-ERP).

**Commit:** `security: port login rate limiter from Lab-ERP`

### 2. Port security response headers (~3 min)

Same `_add_security_headers` after_request helper. Same CSP
string. Same setdefault semantics.

**Commit:** `security: port after_request security headers`

### 3. ProxyFix wrapping (~2 min)

Ravikiran's Cloudflare ingress targets port 5057 (or iMac in
phase 2), same proxy chain as Lab-ERP. Apply ProxyFix the same
way:

```python
from werkzeug.middleware.proxy_fix import ProxyFix
app.wsgi_app = ProxyFix(
    app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=0,
)
```

**Commit:** `proxy: wrap Ravikiran wsgi_app with ProxyFix`

### 4. Context-processor permission flags (~5 min)

Ravikiran has an existing context processor (`grep -n
"@app.context_processor" ravikiran-erp/app.py` — around line
5627, `inject_globals`). Extend (or add sibling) to expose the
same 5 flags you added to Lab-ERP:

- `can_edit_user`
- `can_approve_finance`
- `can_manage_instruments` (Ravikiran has no instruments today —
  set to False)
- `can_view_debug`
- `can_invite`

Use the same role-derivation logic. If a role doesn't map
cleanly (Ravikiran's role taxonomy is slightly narrower), pick
the safest interpretation and add an inline `# NOTE:` comment.

**Commit:** `gatekeeping: expose permission flags in Ravikiran
context_processor`

### 5. Ship-readiness script (~3 min)

Copy `scripts/ship_readiness_check.py` from Lab-ERP into
`ravikiran-erp/scripts/`. Update the expected column list to
Ravikiran's schema (no `short_code`, no `attendance_number` —
Ravikiran doesn't have those yet; add only what IS there:
`must_change_password`, `phone` if it exists, `avatar_url`,
`role_manual_notice`).

Make the script runnable as
`python ravikiran-erp/scripts/ship_readiness_check.py`. Exit 0
if all checks pass.

**Commit:** `scripts: ship-readiness check for Ravikiran`

### 6. Remediation audit trail (~2 min)

`ravikiran-erp/docs/SEV2_REMEDIATION_RAVIKIRAN_2026_04_15.md`
— mirror the Lab-ERP audit trail table, each row referencing
the Ravikiran commit hash.

**Commit:** `docs: Ravikiran SEV2 remediation audit trail`

---

## Stretch if done by T+135

**Stretch H — ravikiran `start_ravikiran.sh` security.** The
start script uses `--access-logfile -`. If there's a way to add
the env var LAB_SCHEDULER_COOKIE_SECURE=1 (which should be set
behind the tunnel in production), do it in the script with a
comment explaining why. Small change, high value.

**Stretch I — Ravikiran `tester` role wiring audit.** Claude 0's
warmup noted "tester role has ~zero wiring in Ravikiran app.py".
Do a deeper inventory: grep `tester` across Ravikiran's
app.py, list what decorators / role checks mention it, write
findings to `ravikiran-erp/docs/TESTER_ROLE_AUDIT.md`. No code
change — inventory only — so that a future sprint knows what's
safe to add.

---

## Cadence

```
T+NN STATUS: Codex0 — Ravikiran Lane 3 D1 shipped (<hash>)
...
T+NN STATUS: Codex0 — Ravikiran Lane 3 closed, all 6 shipped
```

No hard stop this lane — we're past T+120 and into the weaving
window, but Claude 0 is doing the weaving in Lab-ERP only. So
you have runway until ~T+160 (a loose cap). Stop when you feel
the Ravikiran app is at parity with Lab-ERP's security posture.

## What good looks like

- `python ravikiran-erp/scripts/ship_readiness_check.py` exits 0.
- A diff comparing the 5 security touches between Lab-ERP and
  Ravikiran `app.py` shows the patterns are the same.
- The new docs file lists every fix with a commit hash.

GO.
