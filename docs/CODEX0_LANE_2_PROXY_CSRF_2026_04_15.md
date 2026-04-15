# Codex 0 Lane 2 — Proxy / CSRF hardening + v2.0 ship-readiness script

> Second lane for Codex 0, Operation TroisAgents, late Phase 1.
> You finished SEV2 + stretches A and C. This lane gives you ~15
> focused minutes on a real v2.0 ship blocker plus a
> ship-readiness check script. Addressed to Codex 0; skip if you're
> not Codex 0.

---

## Live issue Claude 0 just reproduced

`https://playground.catalysterp.org/login` → through the Cloudflare
tunnel → returns **HTTP 500 with "CSRF" flash** on any POST. The
same login works when hit directly at `http://localhost:5058/login`
on MBP. So the 500 is tunnel-specific — the app isn't seeing the
request as HTTPS, or isn't honouring `X-Forwarded-*` headers, and
CSRF validation fails as a result.

The playground gunicorn runs on MBP:5058 with `--certfile
cert.pem --keyfile key.pem` (self-signed). Cloudflared connects
origin → origin:5058 with TLS. Through the tunnel the request
arrives HTTPS, but the app (especially when behind another proxy
layer like Cloudflare) needs `ProxyFix` or equivalent to trust
the `X-Forwarded-Proto` / `X-Forwarded-For` headers.

**This is a v2.0 ship blocker.** Users can't log in through the
branded hostnames if this isn't fixed.

---

## Lane boundaries

Files you own (Lab-ERP repo only):
- `app.py` — ProxyFix wiring + any CSRF adjustment
- `tests/test_proxy_csrf.py` — NEW
- `scripts/ship_readiness_check.py` — NEW
- `docs/SEV2_REMEDIATION_2026-04-15.md` — append a row

Files you must not touch:
- everything previously banned (base.html, nav.html, global.css,
  ravikiran-erp/)
- Cloudflared config or launchd plists on mini
- playground gunicorn process (that's Claude 0's to restart)

---

## Deliverable 1 — ProxyFix wiring (~6 min)

**Problem:** Flask app doesn't honour `X-Forwarded-Proto`, so
`request.scheme` returns `"http"` even when the external request
was HTTPS. CSRF SSL strict check (or cookie Secure mismatch)
then fails.

**Fix:** use Werkzeug's `ProxyFix`:

```python
# Near the top of app.py, after app = Flask(__name__):
from werkzeug.middleware.proxy_fix import ProxyFix

# Trust one layer of proxy (cloudflared). Adjust x_for/x_proto
# counts if we ever add nginx in front too.
app.wsgi_app = ProxyFix(
    app.wsgi_app,
    x_for=1,      # X-Forwarded-For
    x_proto=1,    # X-Forwarded-Proto
    x_host=1,     # X-Forwarded-Host
    x_prefix=0,
)
```

Also ensure the session cookie is `Secure=True` when running
behind a known proxy — the current config sets it from
`LAB_SCHEDULER_COOKIE_SECURE` env. Leave that alone; add a note
in `docs/SEV2_REMEDIATION_2026-04-15.md` that prod/demo
deployments must set `LAB_SCHEDULER_COOKIE_SECURE=1` behind the
tunnel.

**Commit:** `proxy: wrap app with ProxyFix for Cloudflare tunnel
correctness`

## Deliverable 2 — CSRF validation under tunnel (~4 min)

Flask-WTF's `WTF_CSRF_SSL_STRICT` is already False in app.py
(`app.config["WTF_CSRF_SSL_STRICT"] = False`). So CSRF itself
shouldn't be host-strict. The 500 likely comes from
`request.url` / `request.host` mismatch in the CSRF token's HMAC.

**Test:** write `tests/test_proxy_csrf.py`:

```python
def test_login_with_forwarded_proto_https(client):
    # GET /login to fetch CSRF token
    r = client.get("/login")
    token = extract_csrf_from_html(r.data)
    cookies = r.headers.get_all("Set-Cookie")

    # POST with X-Forwarded-Proto: https (simulating tunnel)
    r = client.post("/login",
        data={"email": "owner@...", "password": "12345",
              "csrf_token": token},
        headers={"X-Forwarded-Proto": "https",
                 "X-Forwarded-For": "1.2.3.4"},
        follow_redirects=False,
    )
    assert r.status_code in (200, 302), f"got {r.status_code}"
```

If the test fails with 500, dig into the traceback. Likely fix:
- Ensure `app.config["SESSION_COOKIE_DOMAIN"]` is None (which it
  should already be — per-host cookie).
- Ensure `request.scheme` under `X-Forwarded-Proto: https`
  returns `"https"` after ProxyFix is applied.

If the test passes, ship it and mark SEV2 complete.

**Commit:** `tests: integration test for login via
X-Forwarded-Proto`

## Deliverable 3 — v2.0 ship-readiness check script (~5 min)

**File:** `scripts/ship_readiness_check.py`

Runnable as `python scripts/ship_readiness_check.py`. Returns
exit 0 if ship-ready, non-zero otherwise. Checks:

1. `schema` — every expected user column (`short_code`,
   `attendance_number`, `must_change_password`,
   `role_manual_notice`) exists.
2. `ratelimit` — the `_login_limiter` global is importable from
   app.
3. `security_headers` — TestClient GET /login returns
   X-Frame-Options, X-Content-Type-Options, CSP, Referrer-Policy.
4. `proxyfix` — TestClient with `X-Forwarded-Proto: https`
   returns a scheme of `"https"` for `request.scheme`.
5. `smoke_test` — calls `scripts/smoke_test.py` and checks exit.

Print one line per check with ✓ / ✗, plus a final summary.
Script is intended to run before any deploy so future-us knows
the app is live-ready.

**Commit:** `scripts: v2.0 ship-readiness check`

## Deliverable 4 — Update SEV2 audit trail (~2 min)

Append a "Lane 2 follow-ups" section to
`docs/SEV2_REMEDIATION_2026-04-15.md`:
- ProxyFix commit
- CSRF integration test commit
- Ship-readiness script commit

Also update the earlier note about cookie Secure: production must
set `LAB_SCHEDULER_COOKIE_SECURE=1` behind the tunnel.

**Commit:** `docs: SEV2 Lane 2 follow-ups`

---

## Stretch (if all 4 done before T+117)

**Stretch F — HSTS preload readiness doc.** Short note in
`docs/OPERATIONAL_HARDENING_V2.md` explaining what the domain
needs to pass hstspreload.org criteria (21-day
max-age, includeSubDomains, preload directive, proper
cert config).

**Stretch G — Ship-readiness CI integration.** Add the
`ship_readiness_check.py` invocation to a new pre-receive hook
stanza so the LOCAL bare refuses pushes that would break
ship-readiness. (Discuss first — may be too strict for
mid-development commits.)

---

## Cadence

Status commit at each deliverable ship:

```
T+NN STATUS: D1 proxy ProxyFix shipped (<hash>)
T+NN STATUS: D2 proxy CSRF test shipped (<hash>)
...
T+118 STATUS: Lane 2 closed, all 4 shipped, N stretches
```

Smoke gate before every push. T+118 hard stop.

## What good looks like

- Logging in via `https://playground.catalysterp.org/` with
  valid seeded credentials returns 302 to `/portals` (not 500).
- `python scripts/ship_readiness_check.py` exits 0 locally.
- `docs/SEV2_REMEDIATION_2026-04-15.md` reflects the Lane 2 work.

Claude 0 restarts the playground gunicorn with the new app.py at
T+120 merge — you don't need to restart anything yourself.

GO.
