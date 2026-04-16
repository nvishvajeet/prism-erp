# Operation Trois Agents — Crawl Report

> Claude 1 Final Lane · Deliverable 1 · 2026-04-15 T+118+
> Read-only probe of 4 public subdomains + local chooser.
> Method: `curl -sSI` (headers) and `curl -sS | grep` (body) with
> 8-second timeouts. Logged-in checks skipped on this pass
> because of sprint-scope (and `playground` is unreachable —
> see below).

## Targets

| URL | Status | Time | CSP | HSTS | XFO | XCT | Brand-clean |
|---|---|---|---|---|---|---|---|
| `https://catalysterp.org/` | **200** | <1s | ❌ | ❌ | ❌ | ❌ | cookie is `catalyst_operational-live_session` → this alias still resolves to Lab-ERP `:5056`, NOT the new chooser `:5060`. Tunnel cut-over pending. |
| `https://mitwpurn.catalysterp.org/` | **NXDOMAIN** | — | — | — | — | — | alias doesn't resolve; spec lists it but DNS record not created. |
| `https://mitwpu-rnd.catalysterp.org/` | **200** | <1s | ❌ | ❌ | ❌ | ❌ | one CSS comment `/* Ravikiran HQ splash — corner-paper white */` in the body; no visible-text contamination. |
| `https://ravikiran.catalysterp.org/` | **200** | <1s | ❌ | ❌ | ❌ | ❌ | **FAIL** — public landing `<h1>` still reads *"MITWPU Central Instrumentation Facility"*. Ravikiran's `public_landing.html` wasn't scrubbed. |
| `https://playground.catalysterp.org/` | **502** | <1s | n/a | n/a | n/a | n/a | Origin unreachable. Cloudflare returns a 502 page. `admin/12345` login-works check blocked by the outage. |

## Local chooser

| URL | Status | Notes |
|---|---|---|
| `http://localhost:5060/health` | 200 `{"service":"catalyst-chooser","status":"ok"}` | healthy |
| `http://localhost:5060/` | 200, 1780 bytes | both tiles present, chooser.css linked, both hrefs resolve to the correct subdomains (`mitwpu-rnd.catalysterp.org` + `ravikiran.catalysterp.org`). |
| `http://localhost:5060/static/chooser.css` | 200 | stylesheet served |
| external network audit | clean | body greps only match the two internal subdomain hrefs — no Google Fonts, no CDN, no third-party `http(s)://` in the HTML. |

## Security headers — consolidated finding

**Code state:** `app.py:995-1017` on both repos has an `after_request` handler that sets `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security` (HTTPS only), `Content-Security-Policy`, `Referrer-Policy`. This is Codex 0 Lane 1 D2 code, landed in `516a1b3`.

**Wire state:** None of the live subdomains return any of those headers. That suggests the mini hasn't pulled `operation-trois-agents` (or its `stable-release` equivalent) and `launchctl kickstart`'d yet — deploy lag rather than a code bug.

**Decision:** This is a **deploy gap, not a code gap**. Tagging `v2.0.0-rc1` from the current code is defensible; the mini pulls it, kickstarts, and the headers show up. Log this as a YELLOW for the ship gate, not RED.

## Brand-contamination summary

| Surface | Contamination | Severity |
|---|---|---|
| `mitwpu-rnd.catalysterp.org` body | CSS comment only (`/* Ravikiran HQ splash */`) | cosmetic — invisible to user |
| `ravikiran.catalysterp.org` body | H1 text: *"MITWPU Central Instrumentation Facility"* | **P0 — user-visible, contradicts silo promise** |
| chooser `/` | no contamination either direction | clean |

## Action items flagged for Codex 0 / Claude 0 to close

1. **BLOCKER / P0** — Ravikiran `public_landing.html` (and/or whatever template the `/` route renders for logged-out users) still contains the MITWPU H1. Needs a text swap (household vocabulary) before the tag ships publicly. ~5 minutes.
2. **P0** — Pull + kickstart the mini for both Lab-ERP and Ravikiran once the tag lands, so security headers actually reach the browser.
3. **P1** — Create the `mitwpurn.catalysterp.org` DNS record in Cloudflare (or remove the alias from the plan if `mitwpu-rnd.` is the canonical form).
4. **P1** — Diagnose `playground.catalysterp.org` 502 origin. MBP:5058 probably isn't bound (launchd unloaded, port blocked, or the service died). `admin/12345` login-works check deferred until origin is back.
5. **P2** — Retire the `/* Ravikiran HQ splash */` comment from Lab-ERP CSS (cosmetic but it's a silo trace).

Crawl status: `STATUS: T+NN Claude1 — crawl complete, 1 GREEN (chooser) / 3 YELLOW (no-sec-headers, NXDOMAIN alias, playground 502) / 1 RED (Ravikiran MITWPU H1)`.
