# Operation Trois Agents — Weaving Report

> Claude 1 Final Lane · Deliverable 2 · 2026-04-15 T+118+
> Six cross-lane weave checks per
> `docs/CLAUDE1_LANE_FINAL_CRAWL_WEAVE_2026_04_15.md`.

## Overall verdict — **PARTIAL (one RED fix required before tag)**

| Check | Verdict | One-line |
|---|---|---|
| W1 · Nav → Route | **PASS** | `/attendance/quick` registered, nav link wires with `url_for('attendance_quick_mark_page')` |
| W2 · Form → Save | **PASS** | `attendance_quick.html` POSTs to `/attendance/api/quick-mark`; route exists |
| W3 · Silo | **FAIL** | Ravikiran landing H1 still reads *"MITWPU Central Instrumentation Facility"* |
| W4 · Role weave | **DEFERRED** | `playground.catalysterp.org` is 502; cannot exercise role-seeded accounts remotely |
| W5 · Chooser weave | **PASS** | Both tiles render; no external network calls; both hrefs correct |
| W6 · Doc weave | **PASS** | Three audit docs cross-reference; SEV2 doc has commit hashes filled (c234035) |

---

## W1 — Nav → Route · **PASS**

- Route is registered: `app.py:27481` `@app.route("/attendance/quick")`, endpoint `attendance_quick_mark_page`, role gate `{super_admin, site_admin, operator, instrument_admin, finance_admin, is_owner}`.
- Template renders with `{% extends "base.html" %}`, no BuildError.
- Nav stitch: `templates/attendance.html:23` has
  `<a class="btn" href="{{ url_for('attendance_quick_mark_page') }}" data-vis="{{ V }}">Quick Mark (#)</a>`.
- `base.html` doesn't need a direct nav entry for this surface — it's linked from the attendance page.

## W2 — Form → Save · **PASS**

- `templates/attendance_quick.html` uses `fetch('/attendance/api/quick-mark', …)` — JSON POST, not an HTML form submission.
- That route exists: `app.py:19153` `@app.route("/attendance/api/quick-mark", methods=["POST"])` with role gate + CSRF token check.
- Search endpoint `/attendance/api/search-staff` also wired.
- No 404 on either.

Full form audit not re-run (warmup pass already cleared 155/156 forms).

## W3 — Silo · **FAIL**

| Grep | Result |
|---|---|
| `grep -rniE "MITWPU\|Central Instrumentation\|FESEM\|ICP-?MS\|XRD" ravikiran-erp/templates/` | **0 hits** in template bodies (good) |
| live page body from `https://ravikiran.catalysterp.org/` | H1 text: *"MITWPU Central Instrumentation Facility"* (BAD) |

The grep of the templates folder is clean but the live page serves contaminated text. Either:
- The live Ravikiran process is running against a different code tree (stale deploy), or
- There's a DB-stored `org_name` / `org_tagline` value feeding the template that still reads MITWPU.

`ravikiran-erp/templates/public_landing.html:70-90` is the likely render site. If it reads `{{ hq_portal.title }}` from a dict where the value lives in DB or a module-level constant, that's where the string lives.

Lab-ERP → Ravikiran direction: `grep -rniE "Ravikiran|Personal ERP" templates/` on lab-scheduler found 5 occurrences:
- `company_books.html`, `receipt_form.html` — placeholder text (`"e.g. Ravikiran Services"`) in forms that reference the operating company. **Legitimate reference** — Ravikiran is one of the real companies on the books — NOT a silo break.
- `public_landing.html` — references a `hq_portal` block that links to Ravikiran HQ on the legacy Lab-ERP landing. Pre-existing design choice, not a Phase-1 regression.

Chooser direction: `grep -riE "Ravikiran" chooser/templates/` → **0 hits**. Clean.

## W4 — Role weave · **DEFERRED**

Plan: log into `playground.catalysterp.org` with `test.<role>` accounts and verify 403/200 alignment.

Blocker: `playground.catalysterp.org` returns **502** from Cloudflare — origin (MBP:5058) unreachable. The role-weave matrix cannot be collected remotely this pass.

Smoke gate runs with 3 roles (`owner`, `requester`, `operator`) locally on every push — all green for every Phase 1 commit. That's the regression safety net for role handling. The full 9-role matrix is a Phase 4 idea that needs `playground` back up.

Not a ship blocker on its own — move to `STATUS: BLOCKER:` only if the origin stays down past the rc1 tag.

## W5 — Chooser weave · **PASS**

Local probe at `http://localhost:5060/` (started manually, `python chooser/app.py`):
- `/health` → `{"service":"catalyst-chooser","status":"ok"}`
- `/` → 200, 1780 bytes, both tiles, both hrefs correct:
  - `https://mitwpu-rnd.catalysterp.org` ✓
  - `https://ravikiran.catalysterp.org` ✓
- `/static/chooser.css` → 200
- External network audit: body contains only the two internal hrefs; no `fonts.googleapis.com`, no CDN, no third-party `http(s)://`. Clean.
- Note: the apex `https://catalysterp.org/` currently routes to Lab-ERP (cookie `catalyst_operational-live_session`), not to the chooser. That's a tunnel cut-over item, not a chooser bug.

## W6 — Doc weave · **PASS**

Cross-references present:
- `docs/UI_AUDIT_2026_04_15.md` → §"Handoff to Codex 0 (gatekeeping)" references insights / finance / vendors context flags
- `docs/GATEKEEPING_AUDIT_2026_04_15.md` → §"Template Gates to Apply" enumerates template paths with line numbers
- `docs/SEV2_REMEDIATION_2026-04-15.md` → commit hashes filled in (verified via `c234035 tests: lock ship-readiness gate and lane2 hashes`)

Plus sprint docs:
- `docs/OPERATION_TROIS_AGENTS.md` is the plan
- `docs/CLAUDE1_LANE_*`, `docs/CODEX0_LANE_*` — per-lane specs
- `docs/POST_SPRINT_FEEDBACK_PLAN_2026_04_15.md` — my handoff plan from the archived debug log

---

## Numbered fix list (blocking issues only)

1. **RED — Ravikiran landing H1 still says "MITWPU Central Instrumentation Facility"**. User-visible silo break. Likely fix: swap the value in `ravikiran-erp/app.py` `ORG_NAME` / `ORG_TAGLINE` constants (or whatever the landing reads from) to household vocabulary. ~5 min. **Must close before publicising the `ravikiran.catalysterp.org` URL.**

2. **YELLOW (deploy gap, not code gap) — security headers not reaching clients.** `app.py:995-1017` sets CSP/HSTS/XFO/XCT/Referrer-Policy via `after_request`. Live subdomain responses don't carry them. Mini needs to pull + `launchctl kickstart` once the tag lands.

3. **YELLOW — `playground.catalysterp.org` 502.** Origin down. Blocks role-weave W4 and the smoke proof for Codex 0's Lane 2 ProxyFix work. Restart the MBP:5058 launchd service, confirm `admin@lab.local / 12345` logs in cleanly.

Everything else (chooser cut-over at the apex, NXDOMAIN on `mitwpurn.`, the legacy `hq_portal` block in Lab-ERP `public_landing.html`, the CSS comment mentioning "Ravikiran HQ splash") is non-blocking.

`STATUS: T+NN Claude1 — weaving PARTIAL: 1 RED (ravikiran H1), 2 YELLOW (deploy lag, playground 502), 3 PASS, 1 DEFERRED.`
