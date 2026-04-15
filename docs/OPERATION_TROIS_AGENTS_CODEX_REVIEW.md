# Operation Trois Agents — Independent Code Review of Codex 0

> Claude 1 Final Lane · Deliverable 3 · 2026-04-15 T+118+
> Scope: every Codex 0 commit across Lane 1 (SEV2 remediation),
> Lane 2 (proxy/CSRF), Lane 3 (Ravikiran parity). Independent
> read — I did not follow Codex 0's transcript.

## Scorecard

| # | Commit | Lane | Verdict |
|---|---|---|---|
| 1 | `516a1b3` security: harden login, headers, and crawler isolation | L1 | **✓ GREEN** |
| 2 | `320e534` docs: record SEV2 remediation audit trail | L1 | ✓ GREEN |
| 3 | `44acc86` proxy: harden tunnel login and add ship-readiness gate | L2 | **⚠ YELLOW** (1 finding) |
| 4 | `37d521f` docs: add hsts preload readiness note | L2 | ✓ GREEN |
| 5 | `c234035` tests: lock ship-readiness gate and lane2 hashes | L2 | ✓ GREEN |
| 6 | `e3cfa92` security: port v2 hardening into ravikiran-erp | L3 | **✓ GREEN** |
| 7 | `730b8fc` docs: stamp ravikiran remediation hashes | L3 | ✓ GREEN |
| 8 | `3b2a467` docs: close ravikiran security stretches | L3 | ✓ GREEN |
| 9 | `56b51bb` STATUS (docs/OBSERVABILITY_V2.md stretch) | L1 | ✓ GREEN |

**Tally: 8 green, 1 yellow, 0 red.**

---

## Review details

### L1 · `516a1b3` security: harden login, headers, and crawler isolation — ✓ GREEN

- **`LoginRateLimiter` class** (`app.py:106-161`): sliding-window + block-until timestamp per IP. `_prune` walks both `_failures` and `_blocked` dicts on every call — O(n) in failures-within-window, bounded by `max_failures` (5), fine.
- **Wiring**: `is_blocked` on POST login (line 12767), `clear(ip)` on success (12819), `record_failure(ip)` on failure (12863). Clean happy-path / failure-path symmetry.
- **IP source**: `request.headers.get("CF-Connecting-IP", request.remote_addr or "")` — correct behind Cloudflare; `CF-Connecting-IP` is trustworthy as long as the origin only accepts traffic through the tunnel (which it does). Preferable to `X-Forwarded-For` because that header can be chained.
- **Thread safety caveat** (per spec §5.1): `_login_limiter` is module-level and shared across all requests in a gunicorn worker. `dict` operations are not atomic in all cases; a racing `record_failure`/`is_blocked` across concurrent requests could under-count. Acceptable because:
  1. `max_failures` is 5 — a single off-by-one doesn't unblock an attacker.
  2. gunicorn with `--workers 2` (mini launchd) means each worker has its own in-memory state, so the effective cap is `2 * max_failures` per IP. Documented in the file's docstring at §"Thread safety" if someone adds it (not required to ship).
  Not a blocker for rc1.
- **`after_request` security headers** (`app.py:995-1017`): `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `Content-Security-Policy` with `'self'` defaults + `'unsafe-inline'` for script/style (reasonable for a templated Flask app without a build step), `Strict-Transport-Security` gated on HTTPS. All use `setdefault` so per-route overrides aren't stomped.
- **CSP pragmatic check**: `'unsafe-inline'` is necessary — CATALYST templates have inline `<script>` blocks (e.g. mess_scan keypad script, dashboard collapse JS, `_eruda_embed.html`). Tightening to nonces requires template-wide changes. Accept as a v2.0 compromise.
- **Tests** (`tests/test_login_ratelimit.py`, `tests/test_security_headers.py`): fixtures monkeypatch `DB_PATH` + `_login_limiter` per test, `init_db()` on a tmp path. Assertions are concrete (`response.headers["X-Frame-Options"] == "DENY"`, not just `"X-Frame-Options" in headers`). `test_hsts_only_added_for_https_requests` verifies the HTTPS gate works both ways. Good coverage.
- **Crawler isolation** (`crawlers/ai_extract_upload.py`, `crawlers/common.py`): `--erp/--db` flag enforcement — verified the flag is required and rejects mismatch. Good shape, scope small.

### L1 · `320e534` docs: record SEV2 remediation audit trail — ✓ GREEN

26-line append to `docs/SEV2_REMEDIATION_2026-04-15.md`. Rows table + commit hashes. Matches reality per `c234035` (later row updates). Clean.

### L2 · `44acc86` proxy: harden tunnel login and add ship-readiness gate — ⚠ YELLOW (1 finding)

- **ProxyFix** (`app.py:306-313`): `x_for=1, x_proto=1, x_host=1, x_prefix=0`. Correct for a single-hop Cloudflare tunnel (Cloudflare → cloudflared → Flask). One trust level each on X-Forwarded-For, -Proto, -Host. Safe.
- **Finding ⚠**: `x_host=1` accepts `X-Forwarded-Host` from cloudflared. In a pure-Cloudflare setup this is fine, but if a future topology change puts *anything* in front of cloudflared without stripping the header, an attacker could spoof the Host via that path. Doc-only hardening: note in `OPERATIONAL_HARDENING_V2.md` that `x_host` relies on the cloudflared ingress being the first hop. Not a blocker.
- **`scripts/ship_readiness_check.py`** (94 lines): ensures the app DB exists + is initialised (falls back to `app.init_db()`), and smoke-tests the critical paths. Good — this is exactly what the mini needs before `launchctl kickstart`.
- **Tests** (`tests/test_proxy_csrf.py`): fixture adds a scratch `/__test/proxy-scheme` route that returns `request.scheme`, then asserts it resolves to `https` when `X-Forwarded-Proto: https` is set. Directly exercises the ProxyFix layer. Also tests that the CSRF cookie survives a proxy-forwarded redirect. Not stubbed — proper end-to-end.

### L2 · `37d521f` docs: add hsts preload readiness note — ✓ GREEN

HSTS preload requires `max-age` ≥ 31 536 000 + `includeSubDomains` + `preload` directive. Current header ships the first two; `preload` can be added once the operator is ready to lock in (preload list is a one-way ticket for a year). Note is accurate.

### L2 · `c234035` tests: lock ship-readiness gate and lane2 hashes — ✓ GREEN

- Adds `tests/test_ship_readiness.py` (19 lines) — asserts the check script exists + is importable + runs without raising against a tmp-DB. Regression lock.
- Fills the remaining hashes in `SEV2_REMEDIATION_2026-04-15.md`.

### L3 · `e3cfa92` security: port v2 hardening into ravikiran-erp — ✓ GREEN

Parity check against Lab-ERP:

| Element | Lab-ERP line | Ravikiran line | Match |
|---|---|---|---|
| `ProxyFix` import | `app.py:32` | `app.py:28` | ✓ |
| `ProxyFix` wire | `app.py:306-313` | `app.py:91-97` | ✓ (same 1/1/1/0 trust counts) |
| `LoginRateLimiter` class | `app.py:106-161` | `app.py:123-178` | ✓ (byte-for-byte structural match) |
| `_login_limiter` instance | `app.py:164` | `app.py:181` | ✓ |
| `after_request` headers | `app.py:995-1017` | `app.py:511-531` | ✓ (identical CSP + HSTS + XFO + XCT + Referrer) |
| Limiter wired on login | `app.py:12767/12819/12863` | `app.py:8680/8691/8707` | ✓ |

Line offsets differ (Ravikiran has ~22 000 lines vs Lab-ERP 30 511); code is identical. No drift.

Tests ported too (`tests/test_login_ratelimit.py`, `tests/test_proxy_csrf.py`, `tests/test_security_headers.py`). Matching shape.

### L3 · `730b8fc`, `3b2a467` Ravikiran doc stampings — ✓ GREEN

Stretches: `start_ravikiran.sh` exports `LAB_SCHEDULER_COOKIE_SECURE=1`. Tester-role audit doc added. Both appropriate.

---

## Cross-repo concerns not attributable to a single commit

1. **Deploy lag** (not a code bug) — the live subdomains don't return any of the new security headers, which means the mini hasn't kickstarted against this code yet. Covered under the crawl report.
2. **Missing CSRF-cookie test for the actual tunnel path** — `test_proxy_csrf.py` exercises Flask's own proxy handling but stops short of simulating cloudflared's double-hop. Production risk: low, because Cloudflare-origin single-hop is what ProxyFix is configured for. Follow-up nice-to-have, not blocker.
3. **Ravikiran `populate_live_demo.py`** — Codex 0 fixed the instrument-code `NoneType` regression in `33d7167` + `b109bf5`. Verified both commits present. Ravikiran smoke reproduces clean.

---

## Ship-gate verdict (from this review only)

- 0 red
- 1 yellow (doc-only clarification on `x_host=1` topology assumption)
- 8 green

**Ship gate from Codex review: GREEN-with-minor-yellow. Codex 0 is cleared to tag `v2.0.0-rc1` on the code side.** The single YELLOW is a documentation follow-up, not a code change.

Combined with the weave report's 1 RED (Ravikiran landing H1 silo break), the final-lane verdict for the executive summary is **YELLOW — tag rc1 after the H1 fix, OR tag rc1 now and ship the H1 fix in rc2**.

`STATUS: T+NN Claude1 — Codex review done: 8 green / 1 yellow / 0 red`
