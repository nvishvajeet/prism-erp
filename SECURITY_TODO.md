# Lab Scheduler — Security Hardening & HTTPS Migration Tracker

Last updated: 2026-04-07

---

## Done Now

### Bug Fixes (from recent AI changes)
- [x] Fixed `i.active = 1` -> `i.status = 'active'` in stats war-room query (crash)
- [x] Fixed `sqlite3.Row` not JSON-serializable in stats template (crash)
- [x] Fixed `stats_payload_for_scope` returning Row objects instead of dicts (crash)
- [x] Fixed `page_intro` macro called with unsupported `data_vis` kwarg in `user_detail.html` (crash)

### CSRF Protection
- [x] Installed `flask-wtf` and enabled `CSRFProtect` globally
- [x] Added `<meta name="csrf-token">` to `base.html` for all pages
- [x] Added JS auto-injection: all `<form method="post">` elements get a hidden `csrf_token` field on page load
- [x] Updated `fetch()` calls (dashboard quick-receive) to send `X-CSRFToken` header
- [x] All POST routes are now CSRF-protected by default

### Security Headers
- [x] `X-Content-Type-Options: nosniff`
- [x] `X-Frame-Options: DENY`
- [x] `Referrer-Policy: strict-origin-when-cross-origin`
- [x] `X-XSS-Protection: 1; mode=block`
- [x] `Content-Security-Policy` (self + FullCalendar CDN + Unsplash images)
- [x] `Strict-Transport-Security` (conditional: only when `LAB_SCHEDULER_COOKIE_SECURE=true`)

### Cookie Configuration (HTTPS-ready)
- [x] `SESSION_COOKIE_HTTPONLY = True`
- [x] `SESSION_COOKIE_SAMESITE = "Lax"`
- [x] `SESSION_COOKIE_SECURE` controlled by `LAB_SCHEDULER_COOKIE_SECURE` env var
- [x] 12-hour session lifetime with rolling refresh

### Authorization Model
- [x] **Role-based access** via `ROLE_ACCESS_PRESETS` (8 roles: requester, finance_admin, professor_approver, faculty_in_charge, operator, instrument_admin, site_admin, super_admin)
- [x] **Instrument-scoped access** via `instrument_admins`, `instrument_operators`, `instrument_faculty_admins` junction tables
- [x] **Request-level access** via `can_view_request()` — checks role + instrument scope + requester ownership
- [x] **Field-level visibility** via `request_card_policy()` / `request_card_field_allowed()` — server-side, never sends unauthorized data
- [x] **Action-level permissions** via `request_card_actions()` — each action button gated by role + instrument scope
- [x] **Deny-by-default** in `request_scope_sql()` — unrecognized roles get `1 = 0` (no data)
- [x] **Tag/flair scope system** — `access_tags`, `user_access_tags`, `instrument_access_tags` tables created. Backward-compatible: no tags configured = no restriction. When tags are set on an instrument, only users sharing at least one tag can access.

### Route-Level Authorization Audit
All routes verified to have proper auth:
- [x] `/` — `@login_required`, scoped by `request_scope_sql()`
- [x] `/instruments` — `@login_required`, `can_access_instruments` check, filtered by assigned instruments
- [x] `/instruments/<id>` — `@login_required`, `can_open_instrument_detail()` check
- [x] `/instruments/<id>` POST — each action checks `can_edit`, `can_archive_instrument`, etc.
- [x] `/requests/new` — `@login_required`
- [x] `/requests/<id>` — `@login_required`, `can_view_request()` check, 403 if denied
- [x] `/requests/<id>` POST — each action checks specific permission (`can_post_message`, `can_manage`, etc.)
- [x] `/requests/<id>/quick-receive` — `@login_required`, `can_operate_instrument` check
- [x] `/schedule` — `@login_required`, scoped by `request_scope_sql()`
- [x] `/schedule/actions` POST — `@login_required`, checks `can_manage` or `can_operate` per action
- [x] `/attachments/<id>/download` — `@login_required`, `can_view_request()` check, path traversal prevention
- [x] `/attachments/<id>/view` — same as download
- [x] `/attachments/<id>/delete` — `@login_required`, `can_delete_attachment()` check
- [x] `/calendar` — `@login_required`, `can_access_calendar()` check
- [x] `/calendar/events` — `@login_required`, scoped by `request_scope_sql()`
- [x] `/stats` — `@login_required`, `can_access_stats()` check
- [x] `/visualizations` — `@login_required`, `can_access_stats()` check
- [x] `/visualizations/instrument/<id>` — `@login_required`, scope check
- [x] `/visualizations/group/<name>` — `@login_required`, `can_view_group_visualization()` check
- [x] `/exports/generate` — `@login_required`, `can_access_stats()` check
- [x] `/exports/<filename>` — `@login_required`, `can_access_stats()` + creator/super_admin check
- [x] `/admin/users` — `@login_required`, `can_manage_members()` check
- [x] `/users/<id>` — `@login_required`, `can_view_user_profile()` check
- [x] `/demo/switch/<role>` — `@login_required`, `can_use_role_switcher()` check
- [x] `/login`, `/logout`, `/activate` — public (correct)
- [x] `/sitemap` — `@login_required`

### File Serving Security
- [x] All uploads served through Flask routes, not static file mapping
- [x] Path traversal check: `full_path.resolve()` must start with `UPLOAD_DIR.resolve()`
- [x] Attachment download requires `can_view_request()` for the parent request
- [x] Extension whitelist: pdf, png, jpg, jpeg, xlsx, csv, txt
- [x] Max upload size: 100 MB
- [x] Filenames sanitized via `werkzeug.utils.secure_filename()`

### Existing Security Controls
- [x] Passwords hashed with `pbkdf2:sha256`
- [x] All SQL uses parameterized queries (no SQL injection)
- [x] Jinja2 autoescaping enabled (XSS prevention)
- [x] Immutable audit log with SHA-256 hash chain
- [x] Owner status via environment variable, not database role

---

## Ready for HTTPS Switch

The application is fully prepared for HTTPS. When ready:

### 1. Install TLS-capable reverse proxy

**Recommended: Caddy** (automatic HTTPS, zero-config)

```
# /etc/caddy/Caddyfile (LAN with self-signed cert)
lab-scheduler.local {
    tls internal
    reverse_proxy 127.0.0.1:5055
}
```

```
# /etc/caddy/Caddyfile (with Let's Encrypt)
scheduler.example.edu {
    reverse_proxy 127.0.0.1:5055
}
```

### 2. Enable secure cookies

```bash
export LAB_SCHEDULER_COOKIE_SECURE=true
```

This activates:
- `SESSION_COOKIE_SECURE = True` (cookies only sent over HTTPS)
- `Strict-Transport-Security` header (HSTS)

### 3. Bind Flask to localhost only

In `app.py`, the server already binds to `127.0.0.1:5055`. The reverse proxy handles external connections.

### 4. HTTP -> HTTPS redirect

Caddy does this automatically. For nginx:
```
server {
    listen 80;
    server_name lab-scheduler.local;
    return 301 https://$host$request_uri;
}
```

### 5. Verify no mixed content

All internal links use `url_for()` which generates protocol-relative paths.
External image URLs (Unsplash) already use HTTPS.
The CSP header restricts loading sources.

### 6. Tighten SameSite cookies

After confirming all navigation is same-origin:
```python
app.config["SESSION_COOKIE_SAMESITE"] = "Strict"
```

---

## Needs IT / Infrastructure

- [ ] **TLS certificates** — self-signed CA for LAN, or Let's Encrypt for public DNS
- [ ] **Caddy/nginx installation** on the server
- [ ] **Firewall rules** — restrict port 443 to LAN/VPN subnets only
- [ ] **DNS entry** — `lab-scheduler.local` or equivalent pointing to server IP
- [ ] **VPN configuration** — if remote users need access, VPN must route to server subnet
- [ ] **Certificate distribution** — for self-signed CA, distribute root cert to lab machines

---

## Later Security Improvements

### Authentication Enhancements
- [ ] **Rate limiting on login** — Flask-Limiter or SQLite-based counter; lock after N failed attempts per IP
- [ ] **WebAuthn/passkeys for admin roles** — stronger auth for super_admin/site_admin (requires JS WebAuthn API + `py_webauthn` package)
- [ ] **OAuth2/LDAP integration** — for institutions with existing identity providers (`Authlib` or `python-ldap`)
- [ ] **Session invalidation on password change** — clear all sessions when password is updated

### Input Validation
- [ ] **Sample count server-side validation** — reject 0 or negative values (current: allows 0)
- [ ] **File extension crash fix** — handle filenames with no extension gracefully
- [ ] **Null checks on optional fields** — in card display templates
- [ ] **Markdown sanitization** — if allowing markdown in description/notes fields (`bleach` package)

### Authorization Refinements
- [ ] **Populate access tags** — assign tags to instruments and users via admin UI
- [ ] **Tag management admin page** — CRUD for `access_tags`, assign to users/instruments
- [ ] **Per-field tag scoping** — extend `request_card_field_allowed()` to check tags
- [ ] **Flask-Login migration** — replace manual session management with standardized `current_user` proxy
- [ ] **Flask-Principal** — declarative permission objects instead of scattered `if` checks

### Infrastructure Hardening
- [ ] **Separate static assets** — serve CSS/JS via reverse proxy, Flask handles only dynamic routes
- [ ] **Block sensitive paths** — proxy must not serve `.py`, `.git/`, `README.md`, `lab-scheduler.db`
- [ ] **Database file permissions** — ensure SQLite file is readable only by the Flask process user
- [ ] **Production secret key** — set `LAB_SCHEDULER_SECRET_KEY` via environment variable (not the dev default)
- [ ] **Disable debug mode** — verify `debug=False` before production deployment

---

## Verification Checklist

### Readiness Now
- [x] All pages render without errors (tested all routes)
- [x] CSRF tokens injected on all forms
- [x] Security headers set on all responses
- [x] Cookie config is HTTPS-ready (just needs env var flip)
- [x] No hardcoded `http://` URLs in application code
- [x] All SQL is parameterized
- [x] All uploads served through authenticated Flask routes
- [x] Deny-by-default authorization (unrecognized roles get no data)
- [x] Field-level and action-level visibility enforced server-side
- [x] Audit log with hash-chain integrity verification

### Final HTTPS Cutover
- [ ] Caddy/nginx installed and configured
- [ ] TLS certificate active (self-signed or Let's Encrypt)
- [ ] `LAB_SCHEDULER_COOKIE_SECURE=true` set in environment
- [ ] HTTP -> HTTPS redirect active
- [ ] Firewall restricts access to LAN/VPN subnets
- [ ] No public exposure verified (port scan from external IP)
- [ ] No mixed content warnings in browser console
- [ ] All protected routes return 403 for unauthorized users (spot-check)
- [ ] Audit log integrity verified (`verify_audit_chain()`)
- [ ] Session cookies marked Secure in browser dev tools
- [ ] HSTS header present in responses
