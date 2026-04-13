# CATALYST — Security Hardening & HTTPS Migration Tracker

Last updated: 2026-04-10 (after Phase 6 W6.1-W6.9)

This file is the **deployment-time security checklist**. The
`PROJECT.md` § 10 Security section is the architecture reference;
this file is the operational checklist for taking CATALYST from
development to a production LAN deployment.

---

## Done

### Authentication & sessions
- [x] Passwords hashed with `pbkdf2:sha256` (`werkzeug.security`)
- [x] `SESSION_COOKIE_HTTPONLY = True`
- [x] `SESSION_COOKIE_SAMESITE = "Lax"`
- [x] `SESSION_COOKIE_SECURE` controlled by `LAB_SCHEDULER_COOKIE_SECURE`
- [x] 12-hour session lifetime with rolling refresh
- [x] **Login rate limit** — 10 attempts per 5 minutes per IP, in-memory
- [x] **Generic `@rate_limit(max=N, window=S)` decorator** for write endpoints

### Authorization
- [x] **8-role hierarchy** in `ROLE_ACCESS_PRESETS`: requester, finance_admin, professor_approver, faculty_in_charge, operator, instrument_admin, site_admin, super_admin
- [x] **Instrument-scoped access** via `instrument_admins` / `instrument_operators` / `instrument_faculty_admins` junction tables
- [x] **`@instrument_access_required(level)`** decorator (W6.2) — `view` / `open` / `manage` / `operate` levels, fetches instrument, returns 404 / 403, injects row into view
- [x] **`assigned_instrument_ids(user)`** cached in Flask `g` per request (W6.4)
- [x] **`request_scope_sql(user, alias)`** — central deny-by-default query gate
- [x] **`request_card_policy()`** — server-side field + action policy per (user, request)
- [x] **`request_card_field_allowed()`** — never sends unauthorized data
- [x] **Tag/scope tables** — `access_tags`, `user_access_tags`, `instrument_access_tags` (backward-compatible)
- [x] **`@login_required`**, **`@role_required(*roles)`**, **`@owner_required`** decorators

### Request workflow safety
- [x] **State machine** (W6.5) — `REQUEST_STATUS_TRANSITIONS` dict + `assert_status_transition()` wired into 14 update sites. Admin overrides pass `force=True`. Bad transitions surface as a clean toast via the `InvalidStatusTransition` Flask error handler.
- [x] **Audit chain** — SHA-256 hash chain over every state change. `verify_audit_chain()` validates integrity.

### Input safety
- [x] **All SQL parameterized** — no string concatenation in any query
- [x] **`secure_filename()`** on every uploaded file
- [x] **Extension whitelist** — pdf, png, jpg, jpeg, xlsx, csv, txt
- [x] **`allowed_file()` guards `"." in filename`** — extensionless filenames are rejected before any `rsplit('.', 1)`
- [x] **100 MB max upload** (`MAX_CONTENT_LENGTH`)
- [x] **`safe_int()` / `safe_float()`** helpers
- [x] **Sample count `>= 1`** — server validator + `min="1"` on the input
- [x] **`metadata_grid` auto-escapes strings** — only `Markup` blocks bypass escaping. Closes a stored XSS vector through `instrument.notes` and any free-text routed through the macro.

### Security headers
- [x] `X-Content-Type-Options: nosniff`
- [x] `X-Frame-Options: DENY`
- [x] `Referrer-Policy: strict-origin-when-cross-origin`
- [x] `X-XSS-Protection: 1; mode=block`
- [x] `Content-Security-Policy` (self + FullCalendar CDN + image hosts)
- [x] `Strict-Transport-Security` (conditional on `LAB_SCHEDULER_COOKIE_SECURE=true`)

### CSRF
- [x] **Machinery in place** (W6.6) — `flask_wtf.CSRFProtect`, `<meta name="csrf-token">` in base.html, JS shim that auto-injects the token into form submits and `fetch()` calls
- [ ] **Enforcement gated by `LAB_SCHEDULER_CSRF=1`** — requires the W6.11 rollout (every form template + tests). See TODO_AI.txt.

### Demo / production gates
- [x] **`DEMO_MODE` flag** (W6.7) — `LAB_SCHEDULER_DEMO_MODE=0` makes `/demo/switch/*` return 404 and stops `seed_data()` from inserting demo accounts
- [x] **Owner status via env var** (`OWNER_EMAILS`), not a database role

### File serving
- [x] All uploads served through Flask routes, not static file mapping
- [x] Path traversal check: `full_path.resolve()` must start with `UPLOAD_DIR.resolve()`
- [x] Attachment download requires `can_view_request()` for the parent request

### PWA / accessibility
- [x] **`static/manifest.json`** — name, icons, theme colors
- [x] **theme-color meta** — light + dark variants
- [x] **`apple-mobile-web-app-*`** meta tags
- [x] **Skip-nav link** — first tab stop, jumps to `#main-content`
- [x] **ARIA on instrument dropdown** — `aria-haspopup`, `aria-expanded` synced via JS, Escape-to-close

### Verification
- [x] **Visibility audit** — 8 roles × ~12 pages, **171/171 baseline**
- [x] **Populate crawl** — 500 actions end-to-end, **0 5xx, 0 exceptions**
- [x] **Crawler suite** — `python -m crawlers run all` exposes 13 strategies (visibility, role_behavior, lifecycle, dead_link, performance, random_walk, contrast_audit, color_improvement, architecture, philosophy, css_orphan, cleanup, smoke)

---

## Remaining (Track A in TODO_AI.txt)

These are the security-relevant items still to land. Detailed
plans live in `TODO_AI.txt` — this is the operational summary.

### Block-on-merge gaps

- [ ] **W6.10 — Split `request_detail()`** into action handlers. The 682-line function is the largest single attack surface; isolating each action makes per-route security audits practical.
- [ ] **W6.11 — Flip CSRF enforcement on.** Add the hidden token input to ~30 form templates, update the three test scripts to send the token, default `LAB_SCHEDULER_CSRF=1` in `start.sh`. Until this lands, CSRF is theoretical.
- [ ] **W6.13 — Server-side input validation everywhere.** Wrap every `int(request.form[…])` and `request.form["…"].strip()` in `safe_int()` / `safe_float()` / `safe_str()`. ~30 form handlers still use bare casts that throw on bad input.
- [ ] **W6.14 — `log_action()` completeness audit.** Static-analysis test that asserts every `execute("UPDATE …")` / `execute("INSERT …")` is followed within 10 lines by a `log_action(`.
- [ ] **W6.15 — Database backup + restore script.** LAN deployment has no backup story. SQLite makes this trivial.
- [ ] **W6.16 — Replace Werkzeug dev server with `waitress`** for the production startup path.
- [ ] **W6.20 — `init_db()` idempotency smoke test.** Schema migrations are best-effort; needs an end-to-end test that runs `init_db()` twice on fresh + populated databases.

### Future enhancements

- [ ] **W7.12 — OAuth2 / SAML SSO** for institutional login. Replaces local password story.
- [ ] **WebAuthn / passkeys for admin roles.** Stronger auth for super_admin / site_admin (requires JS WebAuthn API + `py_webauthn`).
- [ ] **Markdown sanitization** if any field ever allows raw HTML/Markdown (`bleach` package). Currently all user text goes through Jinja auto-escape and the `metadata_grid` Markup-block discipline.
- [ ] **Tag management admin UI.** The `access_tags` tables exist but have no UI to populate them. Needed before per-field tag scoping is useful.
- [ ] **Per-field tag scoping** — extend `request_card_field_allowed()` to check tags.
- [ ] **Session invalidation on password change** — clear all sessions when password is updated.

---

## HTTPS Migration

The application is fully prepared for HTTPS. When ready:

### 1. Install TLS-capable reverse proxy

**Recommended: Caddy** (automatic HTTPS, zero-config)

```caddyfile
# /etc/caddy/Caddyfile (LAN with self-signed cert)
lab-scheduler.local {
    tls internal
    reverse_proxy 127.0.0.1:5055
}
```

```caddyfile
# /etc/caddy/Caddyfile (with Let's Encrypt)
scheduler.example.edu {
    reverse_proxy 127.0.0.1:5055
}
```

The repo already has a `Caddyfile` and `start.sh --https` flow for
the self-signed development certificate.

### 2. Enable secure cookies

```bash
export LAB_SCHEDULER_COOKIE_SECURE=true
export LAB_SCHEDULER_HTTPS=true
```

This activates:
- `SESSION_COOKIE_SECURE = True`
- `Strict-Transport-Security` (HSTS)

### 3. Bind Flask to localhost only

In `app.py`, the dev server binds to `0.0.0.0:5055` to allow LAN
access. For the reverse-proxy deployment, switch the bind to
`127.0.0.1:5055` so only the proxy reaches Flask.

### 4. HTTP → HTTPS redirect

Caddy does this automatically. For nginx:
```nginx
server {
    listen 80;
    server_name lab-scheduler.local;
    return 301 https://$host$request_uri;
}
```

### 5. Verify no mixed content

All internal links use `url_for()`. External image URLs (Unsplash)
use HTTPS. The CSP header restricts loading sources.

### 6. Tighten SameSite cookies

After confirming all navigation is same-origin:
```python
app.config["SESSION_COOKIE_SAMESITE"] = "Strict"
```

---

## Production deployment checklist

Run through this list before flipping the production switch.

### Configuration
- [ ] `LAB_SCHEDULER_SECRET_KEY` set to a strong random value (not the dev default)
- [ ] `LAB_SCHEDULER_COOKIE_SECURE=true`
- [ ] `LAB_SCHEDULER_DEMO_MODE=0`
- [ ] `LAB_SCHEDULER_CSRF=1` *(after W6.11 lands)*
- [ ] `LAB_SCHEDULER_DEBUG` unset (or `=0`)
- [ ] `OWNER_EMAILS` set to the real production owner address(es)
- [ ] `SMTP_HOST` / `SMTP_PORT` configured *(if email is in scope — see W7.3)*
- [ ] All env vars documented in `.env.example` *(W6.19)*

### Infrastructure
- [ ] TLS certificate installed (self-signed CA for LAN, or Let's Encrypt for public DNS)
- [ ] Caddy / nginx installed and configured
- [ ] Firewall rules — restrict port 443 to LAN / VPN subnets only
- [ ] DNS entry pointing to server IP
- [ ] VPN configuration *(if remote access needed)*
- [ ] Certificate distribution to lab machines *(for self-signed CA)*
- [ ] Database file permissions — readable only by the Flask process user
- [ ] `lab_scheduler.db` excluded from any backup destination that's web-accessible
- [ ] Reverse proxy blocks `.py`, `.git/`, `README.md`, `PROJECT.md`, `TODO_AI.txt`, `lab_scheduler.db`
- [ ] Werkzeug dev server replaced with `waitress` *(W6.16)*

### Verification
- [ ] Visibility audit green (`venv/bin/python test_visibility_audit.py`)
- [ ] Populate crawl green (`venv/bin/python test_populate_crawl.py`)
- [ ] Crawler suite green (`venv/bin/python -m crawlers run all`)
- [ ] All protected routes return 403 for unauthorized users (spot-check across roles)
- [ ] Session cookies marked `Secure` in browser dev tools
- [ ] HSTS header present in responses
- [ ] CSP header present, no console violations
- [ ] No mixed content warnings in browser console
- [ ] Audit log integrity verified (`verify_audit_chain()`)
- [ ] Public port scan from external IP — no 5055 reachable
- [ ] First admin account created via secure path *(not the seed)*
