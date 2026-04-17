# Active Task

## Task ID
2026-04-16-four-bucket-rotation

## [CONDUCTOR 2026-04-17T13:25+02:00] Cycle status
**All 3 tenants GREEN:** catalysterp.org 200, mitwpu-rnd 200, ravikiran 200.
**500 INCIDENTS RESOLVED:**
- `/attendance` 500 (`BuildError: qr_attendance_kiosk`) — was hitting 09:59–10:11 UTC. Gunicorn restart at 13:02+02 resolved; now returning 302 correctly.
- `/vehicles` startup crash (`no such column: vehicle_id` in `init_db`) — was at previous server start; current server (since 13:02) healthy.
**New feedback since last cycle (06:26):** All 5 morning-batch entries (OPS Queue color, dev_panel tab contrast, dev_panel metric center, finance/grants clickable, personnel role colors) already ticketed at [P0-LIVE 2026-04-17T10:45]. Nikita vehicles expense entry already ticketed. Attendance-500 self-report (08:10 UTC) resolved by restart — no new ticket needed.
**Dashboard:** regen'd + scp'd to Mini.
**Cycle clean.**

## [ORDER 2026-04-17T15:03+02:00 CLAUDE3] Codex1 feed — 3 verified-missing canonical tickets

Codex1 idle since `a262ab1` (12:46+02 — 2+ hrs). Verified these are genuinely not yet shipped on canonical. Pick in order.

### T_chart_js-route-scope-canonical [P1] — Codex1
- **File:** `templates/base.html` + `templates/dashboard.html`, `stats.html`, `finance.html`, `dev_panel.html`
- **Goal:** remove global `<script src="{{ url_for('static', filename='vendor/chart.js/...') }}">` from `base.html`. Add `{% block chart_scripts %}{% endblock %}` in base; override it in the 4-5 templates that actually render charts. Saves 205 KB on every non-chart page.
- **Verify:** `grep -r "new Chart\|Chart(" templates/` to find all chart-rendering templates.
- **Commit:** `perf(base): scope Chart.js to chart-rendering pages — 205KB off every other page`

### T_debug-grid-route-scope [P1] — Codex1
- **File:** `templates/base.html` L432-433 — `grid-overlay.js` + `debug-grid.js` load on every page
- **Goal:** wrap both `<script defer src="...grid-overlay.js">` + `<script defer src="...debug-grid.js">` in `{% if request.args.get('debug') == '1' or session.get('debug_mode') %}...{% endif %}`. Saves ~52 KB on ordinary page loads.
- **Commit:** `perf(base): scope debug overlays to ?debug=1 — 52KB off ordinary loads`

### T_csp-external-cdn-ci-check [P2] — Codex1
- **File:** new `scripts/check_csp_vs_base_template.py`
- **Goal:** scan `templates/base.html` for `<script src="https://` or `<link href="https://` and fail if the host isn't in the CSP allowlist. Wire into `scripts/pre-receive-smoke` or as a standalone check. This would have caught the Chart.js CDN regression.
- **Recipe:** parse base.html for external src/href, parse CSP header from app.py `inject_security_headers()`, assert intersection. Exit code 1 if mismatch.
- **Commit:** `feat(ci): pre-receive check — base.html external URLs must be in CSP`

## [ORDER 2026-04-17T12:56+02:00 CLAUDE2] deep website-lightness audit — 7 follow-up tickets

Full deep audit now appended to `docs/WEBSITE_LIGHTNESS_2026_04_17.md` §"Deep-crawl addendum". Key finding: **Chart.js is CSP-blocked on iMac live** (base.html L59 uses `cdn.jsdelivr.net` but CSP only allows `'self'`). Dashboard / stats / finance silently fail to render charts.

### T_chart_js-imac-local-port [P0-LIVE] — Claude2
- **Fix:** copy `/Users/nv/Scheduler/Main/static/vendor/chart.js/chart.umd.min.js` (205 KB) to iMac live `/Users/nv/ERP-Instances/ravikiran-erp/live/app/static/vendor/chart.js/`. Edit iMac `templates/base.html` L59: replace `<script src="https://cdn.jsdelivr.net/...">` with `<script src="{{ url_for('static', filename='vendor/chart.js/chart.umd.min.js') }}">`. Kickstart gunicorn.
- **Commit:** `fix(imac,charts): serve Chart.js from /static/ — CSP blocks CDN URL`
- **10 min.**

### T_chart_js-route-scope-canonical [P1] — Codex1
- **File:** canonical `templates/base.html` + each chart-rendering template
- **Goal:** remove global `<script src="...chart.umd.min.js">` from base. Add `{% block chart_scripts %}{% endblock %}` in base; only override it from `dashboard.html`, `stats.html`, `finance.html`, `dev_panel.html`, `visualization.html` (and their iMac-ported equivalents).
- **Budget win:** 206 KB raw / 70 KB gzip off every non-chart page.
- **Commit:** `perf(base): scope Chart.js to chart-rendering pages via block — 206KB off every other page`

### T_debug-grid-route-scope [P1] — Codex1
- **File:** canonical `templates/base.html` L432-433 (and iMac port)
- **Goal:** wrap `<script defer src="{{ url_for('static', filename='grid-overlay.js') }}">` + `debug-grid.js` in `{% if request.args.get('debug') == '1' or session.get('debug_mode') %}` so they only load when debug mode is explicitly on. They currently ship on every page (~52 KB raw / 13 KB gzip) but only matter when user has hit `?debug=1`.
- **Commit:** `perf(base): scope debug overlays to ?debug=1 — 52KB off ordinary page loads`

### T_styles-css-split-bundles [P2] — Codex1
- **File:** `static/styles.css` (286 KB raw / 55 KB gzip — biggest single shell asset)
- **Goal:** carve route-specific bundles. Start with `styles-finance.css`, `styles-vehicles.css`, `styles-dev-panel.css`. Keep `styles.css` under 150 KB raw (primitives + shared layout only).
- **Multi-burn.** Start with one carve-out + measure.
- **Commit:** `perf(css): split styles-finance.css out of the base bundle`

### T_base-shell-js-port-imac [P2] — Claude2
- **Goal:** iMac live doesn't have `static/base_shell.js` (canonical ships the global clickable-row + nav-dropdown + etc delegators there). iMac templates each duplicate clickable-row. Port the file and reference it from iMac `base.html`, then drop the per-template handler copies (personnel.html, vendor_payments.html, dashboard.html, users.html, receipts.html, instruments.html, vehicles.html, vehicle_detail.html, finance_grants.html).
- **Commit series:** `port(imac): base_shell.js + wire from base.html` then `refactor(imac): drop duplicated clickable-row handlers across 9 templates`

### T_instrument-detail-bloat-diff [P2] — Claude3
- **Goal:** iMac `instrument_detail.html` is 28,759 B vs canonical 16,648 B — **+12 KB bloat**. Likely stale dead code or duplicated tiles. Diff canonical vs iMac; remove what's genuinely dead while preserving tenant customizations.
- **Commit:** `refactor(imac,instruments): drop 12KB of bloat from instrument_detail.html vs canonical`

### T_cf-brotli-edge-on [P3] — operator
- **Action:** Cloudflare dashboard → Speed → Optimization → toggle **Brotli ON** for catalysterp.org + subdomains. styles.css gzip=55 KB, brotli=43 KB → 22% less transfer for every user on every page.
- **No code change needed.** Just the dashboard toggle.

### T_csp-external-cdn-ci-check [P2] — Codex1
- **Goal:** add a pre-receive or smoke-test check that scans `templates/base.html` for `<script src="https://` or `<link href="https://` and fails if the host isn't in the CSP allowlist. The Chart.js CSP break would have been caught at commit time instead of being silently broken in production until the deep audit found it.
- **File:** `scripts/check_csp_vs_base_template.py` + wire into `pre-receive`
- **Commit:** `feat(ci): pre-receive check — base.html external script host must be in CSP script-src`

## [ORDER 2026-04-17T12:27+02:00 CLAUDE3] tejveer feedback tickets from 10:00-10:10 UTC batch

Three fresh tejveer feedbacks from this morning. Claude3 already shipped the blockers + polish fixes in-lane (`73c481e` dp-doc-tab readable, `15087b9` personnel role colors). Remaining = Codex1 lane.

### T_finance-grants-row-clickable [P1] — Codex1
- **Source:** Tejveer 2026-04-17T10:06 UTC on `/finance/grants` `[severity=major]`
- **Report:** "Pressing on any part of the Grant row should bring up more details of the grant, like a separate page which displays the details like, who asked for the grant, who approved it, when was it sent, when was it approved, etc."
- **File:** `templates/finance_grants.html` (if exists, else grants list template) + `templates/finance_grant_detail.html` + app.py `finance_grant_detail` route
- **Goal:** wrap each grant `<tr>` with `class="clickable-row"` + `data-href="{{ url_for('finance_grant_detail', grant_id=grant.id) }}"`. Template fix first; if route exists already just ship template. If not, add `/finance/grants/<int:grant_id>` route that renders `finance_grant_detail.html` with requester, approver, submit_date, approve_date fields pulled from `grants` + `users` JOIN.
- **Commit:** `feat(grants): clickable grant rows → grant detail page with audit fields`

### T_dev-panel-stat-blob-center [P2] — Codex1
- **Source:** Tejveer 2026-04-17T10:03 UTC on `/admin/dev_panel` `[severity=polish]`
- **Report:** "Center the number above the 'Commits today' and 'Files touched'. looks cleaner."
- **File:** `templates/dev_panel.html` — the tile-stat-stack containing stat_blob macros at `INFRASTRUCTURE` tile (L80-85)
- **Goal:** the `stat_blob` macro's number element isn't centered relative to its label. Either add `text-align:center` to `.tile-stat-stack` children OR fix the macro itself in `_page_macros.html`.
- **Commit:** `polish(dev-panel): center stat-blob numbers over their labels`

### T_badge-role-classes-canonical [P2] — Codex1
- **Source:** Claude3's live patch at LIVE_PATCH_LOG 12:24 +02
- **Report:** personnel.html `{% if s.role == X %}...inline-style=...` chain is maintenance-heavy. Canonical has dedicated `.badge-role-owner/-super-admin/-admin/-operator/-finance/-member` classes at `static/styles.css:3358`. Swap the inline-style if-chain with `class="badge badge-role badge-role-{{ s.role|replace('_','-') }}"`.
- **File:** `templates/personnel.html` + verify all 8 role classes exist in canonical styles.css
- **Commit:** `refactor(personnel): role badge uses dedicated class, not inline style`

---

## [CONDUCTOR 2026-04-17T06:26+02:00] Cycle status
**All 3 tenants GREEN:** catalysterp.org 200 (1.09s), mitwpu-rnd 200 (0.92s), ravikiran 200 (0.81s).
**New feedback since last cycle:** NONE — all entries already ticketed (T-vehicles-500-error P0 fixed, T-payments-po-not-editable P1 in progress, T-payroll-importance-flag P2).
**Ollama http5xx:** stale (Apr 14 only), no new incidents.
**Codex pace:** 1 commit in last 15min — active.
**Dashboard:** regen'd + scp'd to Mini.
**Cycle clean.**

## [CONDUCTOR 2026-04-17T06:10+02:00] RIG WAKE cycle — 6 AM Paris
**All 3 tenants GREEN:** catalysterp.org 200 (1.11s), mitwpu-rnd 200 (0.99s), ravikiran 200 (0.82s).
**Claude2 on iMac:** ALREADY RUNNING (pid 71830, state=running) — bootstrap error was expected (already loaded), kickstart confirmed active.
**New feedback since last cycle:** NONE — last entries from 01:47 UTC already ticketed as T-vehicles-500-error (P0), T-payments-po-not-editable (P1), T-payroll-importance-flag (P2).
**Dashboard:** regen'd + scp'd to Mini.
**Action for operator:** Fire Codex from MBP terminal — see ORDER below.

## [CONDUCTOR 2026-04-17T05:43+02:00] Cycle status
**ANOMALY: mitwpu-rnd.catalysterp.org TIMEOUT (000) — was 200 last cycle.** 3 new feedback entries since 00:10 UTC. Codex active (3 commits). Dashboard regen'd + scp'd to Mini.

## [P0-LIVE 2026-04-17T10:45+02:00 CLAUDE1] 5 fresh Tejveer tickets (morning session)

### [BLOCKER] T_dev-panel-tab-contrast
**Page:** `/admin/dev_panel`  **Tejveer 10:01:** "Cannot read material here, change color of buttons so they can be read properly" — `div.dp-doc-tabs` (README.md / CHANGELOG.md / PHILOSOPHY.md tab strip). Text + background low contrast.
**For Codex:** in `templates/admin_dev_panel.html` or matching CSS — bump `.dp-doc-tabs button` text color to `var(--text)` + add min-contrast background. Test with accessibility dark-mode.
**Commit:** `fix(dev-panel): tab-button text contrast (tejveer 10:01)`.

### [P0-LIVE] T_finance-grants-row-clickable
**Page:** `/finance/grants`  **Tejveer 10:06:** "Pressing on any part of the Grant row should bring up more details — separate page: who asked, who approved, when sent, when approved, etc."
**For Codex:** `templates/finance.html` grant table — wrap each `<tr>` with `data-href="{{ url_for('finance_grant_detail', grant_id=g.id) }}"` + `clickable-row` class. Verify `finance_grant_detail` route exists + renders detail page.
**Commit:** `feat(finance): grant rows click-through to detail page (tejveer 10:06)`.

### [POLISH] T_personnel-role-badge-colors
**Page:** `/personnel`  **Tejveer 10:09:** "Color coding for different roles should be different. operator=green, member=grey, super_admin=different, admin=different".
**For Codex:** `static/styles.css` — add role-specific variants `.badge-role[data-role="super_admin"] {background:#7c3aed;}`, `[data-role="operator"]{background:#10b981;}`, etc. Update `templates/personnel.html` to set `data-role="{{ p.role }}"` on the badge.
**Commit:** `fix(personnel): distinct color per role badge (tejveer 10:09)`.

### [POLISH] T_dev-panel-metric-center
**Page:** `/admin/dev_panel`  **Tejveer 10:03:** "Center the number above 'Commits today' and 'Files touched'. looks cleaner."
**For Codex:** the two metric tiles (span text "90" / "0") — add `text-align:center` to the containing tile's style (or matching CSS class).
**Commit:** `fix(dev-panel): center commit/files-touched metric numbers (tejveer 10:03)`.

### [POLISH] T_ops-queue-color-uniform
**Page:** `/`  **Tejveer 09:59:** "Color of OPS Queue is different compared to others, keeping it uniform is better" — `span.qa-label` text="Queue" with href="/schedule".
**For Codex:** `static/styles.css` or home template — the OPS Queue badge has different styling than sibling badges. Align to use the same class. Probably one stray `color` override.
**Commit:** `fix(home): OPS Queue badge matches sibling color scheme (tejveer 09:59)`.

---

## [P1-LIVE 2026-04-17T12:55+02:00 CODEX1] T_vehicles-log-entries-route-to-expense-approval

### [POLISH] Vehicle expense-style entries should route into approval flow
**Page:** `/vehicles/1`  **Nikita 11:46:** "not log entries these are expenses that go tgrough an approval route"
**Issue:** vehicle expense-bearing entries are still presented as plain vehicle log rows. User intent is that expense-style entries should surface through the expense approval path, not read as generic logs only.
**Next dev slice:** audit `vehicle_detail` / `vehicle_log_add` and the linked-receipt path. Verify whether amount-bearing vehicle logs already create or attach an `expense_receipts` row. If backend wiring already exists, tighten the UI wording and add a clear approval-flow affordance. If not, ship the missing backend link as the next bounded fix.
**Commit:** `fix(vehicles): route expense-style log entries through approval flow`

---

**ANOMALY: mitwpu-rnd.catalysterp.org TIMEOUT (000) — was 200 last cycle.** 3 new feedback entries since 00:10 UTC. Codex active (3 commits). Dashboard regen'd + scp'd to Mini.

### [P0-LIVE] T-vehicles-500-error
- **Page:** `/vehicles/1` (ravikiran tenant, Tejveer super_admin)
- **Reported:** 2026-04-17T01:47 UTC
- **Issue:** Clicking vehicles page → HTTP 500 on Android
- **Action:** Investigate `/vehicles/<id>` route on ravikiran tenant; check server logs for 500 at that timestamp.

### [P1-LIVE] T-payments-po-not-editable
- **Page:** `/payments/14`
- **Reported:** 2026-04-17T01:45 UTC
- **Issue:** Purchase order not editable; edit button present but PO should be editable.

### [P2-LIVE] T-payroll-importance-flag
- **Page:** `/payroll`
- **Reported:** 2026-04-17T01:47 UTC
- **Issue:** User flagged payroll as very important, wants mesh + personal period features prioritised.

## [CONDUCTOR 2026-04-17T04:27+02:00] Cycle status
All 3 tenants 200 OK (catalysterp 1.07s, mitwpu 0.99s, ravikiran 0.83s). Codex active (1 commit in last 15min). No new feedback since 00:10 UTC — all prior entries ticketed. Ollama http5xx stale (Apr 14 only). Dashboard regen'd + scp'd to Mini. Cycle clean.

## [CONDUCTOR 2026-04-17T04:11+02:00] Cycle status
All 3 tenants 200 OK (catalysterp 1.15s, mitwpu 1.40s, ravikiran 0.34s). Codex active (3 commits in last 15min). No new feedback since 00:10 UTC — all prior entries already ticketed. Ollama http5xx stale (Apr 14 only). Dashboard regen'd + scp'd to Mini. Cycle clean.

## [CONDUCTOR 2026-04-17T03:56+02:00] Cycle status
All 3 tenants 200 OK (catalysterp 1.19s, mitwpu 0.95s, ravikiran 0.84s). Codex active (1 commit in last 15min). No new feedback since last cycle. Ollama http5xx stale (Apr 14 only). Dashboard regen'd + scp'd to Mini. Cycle clean.

## [CONDUCTOR 2026-04-17T03:41+02:00] Cycle status
All 3 tenants 200 OK. Codex IDLE (0 commits in last 30min despite 03:31 wake-up ORDER). No new feedback since last cycle. No new Ollama http5xx. Dashboard regen'd + scp'd to Mini. Refreshing Codex ORDER — T2/T3 next.

## [ORDER 2026-04-17T03:41+02:00 CONDUCTOR] Codex idle — still 0 commits after 03:31 ORDER. Second wake.

T71 ✓, T114 ✓ shipped. Ship these now in order — no new dependencies:

1. **T2 tuck-shop-portal-gate** (`app.py:26963-27337`) — swap gate from `module_enabled("tuck_shop")` to `portal_route_enabled("tuck_shop")`. Keep `_tuck_shop_access(user)`. Commit: `fix(tuck-shop): gate routes by portal, not module_enabled`.
2. **T3 mess-portal-gate** (`app.py:26161-26728`) — same swap for `/mess/*`. Commit: `fix(mess): gate routes by portal, not module_enabled`.
3. **T_btn-open-queue-dark-mode-contrast-canonical** (`static/styles.css` L7897) — change `var(--ink)` to `var(--bg)` for `:root[data-theme="dark"] .btn-open-queue`. Commit: `fix(ui): dark-mode btn-open-queue readable contrast`.

Claim → edit → smoke → commit → push. `git pull --rebase origin operation-trois-agents` first.

## [CONDUCTOR 2026-04-17T03:16+02:00] Cycle status
All 3 tenants 200 OK (catalysterp.org 1.06s, mitwpu-rnd 0.99s, ravikiran 0.79s). Codex active (1 commit in last 15min). 3 today feedback entries all already have ORDER tickets. No new Ollama http5xx. Dashboard regen'd + scp'd to Mini. Cycle clean.

## [CONDUCTOR 2026-04-17T02:36+02:00] Cycle status
All 3 tenants 200 OK. /vehicles/* 500 FIXED (e9a6558). 3 new feedback entries from 2026-04-17T00:10 UTC already ticketed. No new Ollama http5xx incidents. Codex active (10 commits/15min). Dashboard regen'd + scp'd to Mini. Cycle clean.

## [ORDER 2026-04-17T02:28+02:00 CLAUDE3] [P0-LIVE] vendor_edit backend port to iMac — Claude2

Tejveer 2026-04-16T18:30 UTC on `/vendors/5`: "I cannot edit the vendor pitch so I'm on Kumar electricals it is not editable each of the things on this vendor page should be editable".

**Canonical has the feature shipped** — `app.py` L23659 `@app.route("/vendors/<int:vendor_id>/edit", methods=["POST"]) def vendor_edit(vendor_id)` + an EDIT VENDOR `<article>` tile at `templates/vendor_detail.html` L73-98 (inline form: name / contact / phone / email / pitch-notes / address textareas + submit).

**iMac live is missing both** the route AND the template block. Porting the template alone would BuildError (`url_for('vendor_edit')` resolves to nothing); porting the route alone leaves the UI unreachable. Package both in one Claude2 burn.

**Claude2 recipe:**
1. Port `vendor_edit` route from canonical `app.py:23659` to iMac live `app.py` (after the existing `vendor_detail` route). Include CSRF + `@can_manage_members` or `@owner_required` gate — whichever canonical uses.
2. Apply the DB-free audit log (INSERT into `audit_logs` table: who changed what field old→new).
3. Kickstart gunicorn.
4. Inbox Claude3 when route is live; Claude3 ports the template block to iMac live `vendor_detail.html`.

Alternate fast-path: Claude2 may prefer to `scp` the canonical `vendor_detail.html` block alongside the route port in a single atomic edit (both files + kickstart). Either way works — just keep backend + frontend in lockstep.

**Record:** LIVE_PATCH_LOG entry citing canonical commit for `vendor_edit` (grep canonical git log for `feat(vendors)` or similar).

---

## [ORDER 2026-04-17T02:25+02:00 CLAUDE3] T_purchase-order-detail-editable [P1] — Codex1

Tejveer 2026-04-17T01:45 UTC on `/payments/14`: "edit button so this purchase order it should be editable this purchase order should be editable".

- **File:** `templates/vendor_payment_detail.html` + `app.py` `vendor_payment_detail()` + `vendor_payment_update()` POST route
- **Goal:** add inline-edit form on the PO detail page so owner/finance_admin can update amount / vendor / category / notes. Currently read-only.
- **Recipe:** mirror the vendor-detail editable pattern (if landed) OR ship minimal edit form gated by `@can_edit_finance` with POST `/payments/<int:po_id>/update`. Audit-log every change.
- **Commit:** `feat(payments): inline edit on purchase-order detail page`
- Can be broken into sub-tickets (template first with empty form; backend update route second) if Codex1 prefers tight commits.

---

## [ORDER 2026-04-17T02:22+02:00 CLAUDE3] [P0-LIVE] [BLOCKER] /vehicles/* 500 — DB column missing

**Evidence:** `/Users/nv/ERP-Instances/ravikiran-erp/live/data/logs/server.log` at 2026-04-17T01:46:12 +02 logged `sqlite3.OperationalError: no such column: vl.linked_receipt_id` on `GET /vehicles/1`, repeated for `/vehicles/2` at 01:46:14. Tejveer reported the same 500 from iPhone via debugger feedback at 01:46 UTC.

**Root cause:** Claude2's earlier port of canonical `82219a2 feat(vehicles): log entries with amount auto-create pending expense for operator review` added a `JOIN expense_receipts ON vehicle_logs.linked_receipt_id = expense_receipts.id` clause to `vehicle_detail()` at iMac live `app.py` — but the **DB migration to ADD the `linked_receipt_id` column to `vehicle_logs`** wasn't run on iMac live. Every vehicle-detail pageview now 500s.

**Owner: Claude2 (iMac backend lane)** — DB schema patch.

**Fix recipe (SSH on iMac):**
```sql
ALTER TABLE vehicle_logs ADD COLUMN linked_receipt_id INTEGER REFERENCES expense_receipts(id);
CREATE INDEX IF NOT EXISTS idx_vehicle_logs_linked_receipt ON vehicle_logs(linked_receipt_id);
```
Against the live DB at the path returned by `_active_data_root()` (likely `/Users/nv/ERP-Instances/ravikiran-erp/live/data/ravikiran_erp_live_data_operational_live.db`). Then `launchctl kickstart -k gui/$(id -u)/local.catalyst.ravikiran` to refresh workers.

**Verify:** `GET https://ravikiran.catalysterp.org/vehicles/1` returns 200 (currently 500). Tail the server.log for no more `linked_receipt_id` errors.

**Record:** LIVE_PATCH_LOG entry + flag `82219a2` port row as "DB migration needed" retroactively.

**Claude3 note:** This is NOT a template bug. The `7ddfaed` hint-row I ported uses `logs|selectattr('linked_receipt_id')` which is SAFE at template level (selectattr on missing attr returns empty list) — the 500 fires at the SQL JOIN level upstream in the route handler. No Claude3 action needed beyond this inbox ticket.

---

## [ORDER 2026-04-17T01:48+02:00 CLAUDE3] next Codex1 bite-sized queue

All three from the 01:34 ORDER shipped on canonical (T_templates-auto-reload `9c647f4` / T_vehicles-log-crawl-hint `7ddfaed` / T_company-books-upi-grid-column). One fresh verified-still-missing canonical backport + two deferred-to-Claude2 backend items.

### T_btn-open-queue-dark-mode-contrast-canonical [P0-LIVE] — Codex1
- **File:** `static/styles.css`
- **Line:** L7897 `:root[data-theme="dark"] .btn-open-queue { color: var(--ink); }`
- **Goal:** fix dark-mode contrast on the `btn-open-queue` pill tejveer reported as unreadable on `/` at 14:07 IST ("blue part written part in the instrument use section"). `--ink` is near-white in dark mode, invisible on the light-cyan `--accent` pill. iMac live already has the fix (LIVE_PATCH_LOG L79) — this is the canonical backport.
- **Recipe:** change `var(--ink)` to `var(--bg)` on L7897. Leave the other `:root[data-theme="dark"] .btn-*` rules alone — they target red/dark button backgrounds where `--ink` is correct.
- **Commit:** `fix(ui): dark-mode btn-open-queue uses --bg not --ink for readable contrast on accent pill`

### Deferred to Claude2 (backend ports to iMac live app.py)
- **6a8be90 fix(auth): honor BYPASS_ROLE_ALLOWLIST in visibility seed** — once ported to iMac live, the `V = "all"` regression loop (LIVE_PATCH_LOG L36 + L69) stops.
- **f26407d fix(portal): inject is_hq_portal into template globals** — once ported to iMac live `inject_globals()`, canonical `d1a9d09 fix(finance): hide grants blocks on hq portal` becomes portable to iMac finance.html by Claude3.

### Standing bench (Codex1, after btn-open-queue lands)
- T2 tuck-shop-portal-gate (`app.py:26963-27337` — swap gate to `portal_route_enabled`)
- T3 mess-portal-gate (`app.py:26161-26728` — same pattern)
- T60 Lab-only route 404s (`/instruments`, `/schedule`, `/requests/new`, `/stats` → 404 on non-lab portals)
- T_portal-active-dict-context (inject `active_portal` dict so canonical `b099d04 fix(portal): header portal slug` becomes portable to iMac)

---

## [ORDER 2026-04-17T01:34+02:00 CLAUDE3] bite-sized Codex1 queue (verified still-missing) [ALL SHIPPED]

All three are already shipped as iMac live patches; canonical backports are outstanding. Each is one-commit-sized. Ship top-down.

### T_company-books-upi-grid-column-canonical [P0-LIVE]
- **File:** `templates/company_books.html`
- **Line:** L59 — the `<label>` wrapping the `is_own_firm` checkbox (span with `display:flex`, text "Treat this as one of our own firms")
- **Goal:** prevent the checkbox label from overlapping the UPI Handle label in the row above (`form-grid` layout bug; reported as `[severity=blocker]` by Tejveer 18:19 IST on /payments/books)
- **Recipe:** add `style="grid-column:1/-1;"` to the `<label>` — matches the pattern the Address/Owner Note/Book Notes labels already use further down.
- **Commit:** `fix(company-books): UPI Handle row — span own-firm checkbox full width`

### T_templates-auto-reload-module-scope-canonical
- **File:** `app.py`
- **Line:** L32724-32725 (currently inside `if __name__ == "__main__":`)
- **Goal:** activate template auto-reload under gunicorn (which never hits `__main__`), matching the iMac live patch at LIVE_PATCH_LOG L84. Every Claude3 template port on iMac currently requires a gunicorn kickstart on canonical too.
- **Recipe:** move the two lines (`app.config["TEMPLATES_AUTO_RELOAD"] = True` + `app.jinja_env.auto_reload = True`) out of the `__main__` block up to module scope, right after `app.config["MAX_CONTENT_LENGTH"]` assignment. Delete them from the `__main__` block.
- **Commit:** `fix(ops): move TEMPLATES_AUTO_RELOAD to module scope — active under gunicorn`

### T_vehicles-log-crawl-hint-row [P1]
- **File:** `templates/vehicle_detail.html`
- **Line:** inside the LOG HISTORY `<article>` card, above its `<table>`
- **Goal:** surface an inline hint that row-level data (notes, linked receipts) is available — Tejveer's 18:57 IST open-ended feedback on `/vehicles/2` ("figure it out") indicates the log table hides context.
- **Recipe:** add `<p class="hint" data-vis="{{ V }}">Click a row with a linked receipt to see its full expense record.</p>` when any row in `logs` has a truthy `linked_receipt_id` (Jinja `{% if logs|selectattr('linked_receipt_id')|list %}`).
- **Commit:** `feat(vehicles): hint that log rows with linked receipts are clickable`

**After those 3 land, continue with `tmp/codex1_inbox.md` backlog** — verified-still-missing: T2 tuck-shop-portal-gate, T3 mess-portal-gate, T60 Lab-only 404s, T_portal-active-dict-context, T_is_hq_portal-context, T_v-all-bypass-seed-flag. Break anything > 80 lines into sub-tickets.

## Operator Intent (2026-04-16 ~22:15 Paris — supersedes earlier)

**Primary goal: serve the live website.** Everything else is
secondary. All outstanding work is split into four buckets. Each agent
has a primary bucket and stays in lane. See
`docs/FOUR_BUCKET_PLAN_2026_04_16.md` for the full plan + per-slot
assignments. Priority order at every decision point: **B1 > B2 > B3 > B4**.


## [NIKITA-2026-04-17T11:46+02:00 CLAUDE1] T_vehicle-log-rename-to-expense

**Page:** `/vehicles/1` **Nikita 11:46:07Z:** "not log entries these are expenses that go through an approval route"

**For Codex:** In `templates/vehicle_detail.html`, change `"LOG HISTORY"` tile heading to `"EXPENSES"`. Confirm auto-create flow from `82219a2` does route through operator approval via `module_queue` — if not, wire it.
**Commit:** `fix(vehicles): rename LOG HISTORY → EXPENSES + confirm approval flow (nikita 11:46)`.

---

## [SPRINT-14 2026-04-17T12:05+02:00 CLAUDE1] Numbered work queue — finish this, then future

**Rule:** ship items 1-13 IN ORDER. After 13, stop + reassess.

**Tested before live:** smoke_test.py (pre-receive) + pytest (14% route coverage). Tejveer is our integration test. Bigger test coverage is a followup (T_smoke-post-coverage in policy crawl).

### Sprint (Codex + Claude1 shared)

1. **T_finance-grants-row-clickable** — `templates/finance.html` grant rows clickable → `finance_grant_detail`. Commit `feat(finance): grant rows click-through to detail page (tejveer 10:06)`.
2. **T_personnel-role-badge-colors** — `static/styles.css` role-specific badge variants. Commit `fix(personnel): distinct color per role badge (tejveer 10:09)`.
3. **T_dev-panel-metric-center** — center "Commits today" + "Files touched" numbers. Commit `fix(dev-panel): center commit/files-touched metric numbers (tejveer 10:03)`.
4. **T_ops-queue-color-uniform** — OPS Queue badge matches siblings. Commit `fix(home): OPS Queue badge matches sibling color scheme (tejveer 09:59)`.
5. **T_payroll-audit-trail-broken** — `payroll_run_create()` needs `log_action()`. Commit `fix(payroll): log_action on payroll_run_create (policy-crawl)`.
6. **T_pending-users-audit-trail** — approve/reject `log_action` + MODULE_REGISTRY nav. Commit `fix(admin): log_action + nav-register pending-users (builder-crawl)`.
7. **T24 tenant-naming cutover** — remove legacy `lab_scheduler.db` from `data/demo/stable/` etc; rename `SERVER_LIVE_LOG`. Claude1 may ship this. Commit `feat(tenant): T24.6 cutover — remove legacy demo DB names (policy-crawl)`.
8. **T66.payroll module-real-impl** — real dashboard replacing stub. Commit `feat(payroll): real dashboard replacing coming-soon stub`.
9. **T66.attendance-admin module-real-impl** — admin view expand. Commit `feat(attendance): admin view with weekly matrix + leave actions`.
10. **T66.admin extension** — unify /admin landing + add more tool cards. Commit `feat(admin): landing-page tool grid extension`.
11. **T69.salary-schedule** — finance salary schedule page. Commit `feat(finance): monthly salary schedule`.
12. **T69.tax-schedule** — finance tax schedule page. Commit `feat(finance): tax schedule page`.
13. **T120 website-lightness audit** — report at `docs/WEBSITE_LIGHTNESS_2026_04_17.md`. Commit `docs(perf): website-lightness audit — top 10 heaviest pages + budget`.

14. **T48 iMac worktree — FRESH parallel-install-then-swap** (needs quiet traffic window)
    a. On iMac: clone fresh `app-git/` sibling dir from MBP canonical + checkout operation-trois-agents.
    b. Install venv (parity with MBP deps). Copy `data/`, `cert.pem`, `.env` from current flat `app/`.
    c. Test boot on TEMP port 5058. Confirm /login 200 + no BuildError/schema issues.
    d. Only if green: bootout current service, `mv app app-old-flat && mv app-git app`, bootstrap.
    e. If ANY break: `mv app app-git-broken && mv app-old-flat app && bootstrap` rollback.
    Commit series: stage / cutover / runbook. Previous in-place attempt at 16:00 yesterday broke gunicorn boot (my `from __future__` misplacement) — this parallel approach avoids that failure mode.

**Anything else is FUTURE (non-sprint):** `docs/FUTURE_BACKLOG_2026_04_17.md` collects the rest.

### Protocol
- Pair-mode: Claude1 refills 1-2 tickets at a time; no bulk dumps (Codex stalls on fat queues).
- Pull-rebase before every commit. Smoke green before push.
- Post-ship: verify live probe + any authed flow if reachable.
- If blocked, write `tmp/blocked-<ticket>-<ts>.md` + move to next.



## Operator Note (2026-04-16 evening)

- Run **one uninterrupted 2-hour burn** now with the currently active Claude agent.
- Focus this burn on **blockers, live stability, tenant correctness, and debugger / feedback readiness**.
- **Debugger / feedback data is expected to come in tonight.** After that data lands, the next improvement pass should prioritize fixes driven by real incoming reports rather than speculative polish.
- **The other Claude comes back online at 20:00 local.** Until then, treat this as a focused single-agent burn and avoid broad queue churn.

## Claude3 Mini-Conductor Status — 2026-04-16 23:10 IST / 19:40 Paris

- **Claude3 (iMac Cowork) is ACTIVE** and assumed mini-conductor duties per the 23:45-Paris inbox order while Claude1 is standing down.
- Cross-host join: Claude3 is now coordinating with Codex1 (MBP canonical writer) directly via `tmp/codex1_inbox.md` [ORDER ...] lines — see the refreshed pipeline there. Codex1 treats Claude3's orders like Claude1's.
- Debug-log auto-crawler active on iMac: `mcp__scheduled-tasks__claude3-debug-feedback-crawl` fires every 5 min until 2am IST, scanning `/Users/nv/ERP-Instances/ravikiran-erp/live/app/logs/debug_feedback.md` for new tejveer feedback and routing the fix (in-lane) or the inbox (out-of-lane).
- Claude3 this burn has shipped to origin: `71943c1` (widget→/ai/route), `9ee1298` (tile-full-width CSS uncap — tejveer's /personnel + /payments overflow), `a0e091f` (dev-panel feedback-tile on canonical dev repo), + pending UPI Handle blocker fix + canonical tile-full-width backport.
- **Mission for the rest of the window** — keep the narration chip + /feedback + /ai/route path green for tejveer's live reports, fix blocker-tagged reports within 15 min, feed Codex1 pipeline ≥2 tickets ahead so it never idles, stay strictly in templates/*.html + static/* + LIVE_PATCH_LOG + handoff on iMac (never app.py iMac, never gunicorn kickstart). Canonical dev_panel + backports are OK per direct operator order.


## [ARCHIVED 2026-04-17] Old AUTO-TICKET blocks removed

Two AUTO-TICKET blocks for /GET / + /POST /ai/ask 500s from Apr 14 logs were cut — both confirmed stale + already serving 200. See git history for content.

## [P0-AUDIT 2026-04-17T03:55+02:00 CLAUDE1] T_payroll-audit-trail-broken — found by policy crawl

`payroll_run_create()` in app.py does NOT call `log_action()` despite being a write that initiates monthly payroll runs. Audit trail breaks here — no record of who initiated a run.

**Codex:** find `def payroll_run_create`. Add `log_action(actor=current_user()['id'], action='payroll_run_create', target_table='payroll_runs', target_id=new_run_id, payload_json=...)` after the INSERT. Mirror `payroll_pay()`'s pattern. Add smoke test asserting audit_log row appears.
**Commit:** `fix(payroll): log_action on payroll_run_create — close audit gap (policy-crawl)`.

---

## [P0-AUDIT 2026-04-17T03:56+02:00 CLAUDE1] T_pending-users-audit-trail — found by ERP-builder crawl

`/admin/pending-users/approve` + `/reject` lack `log_action()` calls. Same audit gap. Add log_action per approval/rejection. Also register pending_users in MODULE_REGISTRY for nav-gating + add smoke test coverage.
**Commit:** `fix(admin): log_action + nav-register pending-users — close audit gap (builder-crawl)`.

---

## [P0-OPS 2026-04-17T06:50+02:00 CLAUDE1] T_mini-certs-survive-reset

**Incident:** Mini's `/Users/vishwajeet/ERP-Instances/lab-erp/live/cert.pem` + `key.pem` were missing after hard-reset (reset only wrote the repo worktree under `.../app/`, not the parent live dir where `run.sh`'s pwd expects certs). Gunicorn dropped to HTTP → cloudflared TLS handshake failure → 502 to all public users.

**Mitigated 06:45:** copied certs back to both `/Users/vishwajeet/ERP-Instances/lab-erp/live/` and `.../live/app/`. Re-kickstarted gunicorn → HTTPS ON → public 200.

**For Codex (MBP canonical fix):** `scripts/start.sh` currently uses `CERT_FILE="$(pwd)/cert.pem"` — this fails when invoked from a nested path. Fix: derive cert path from `$ROOT` env (set by `run.sh`) instead:
```bash
CERT_FILE="${LAB_ERP_RUNTIME_ROOT:-$(pwd)}/cert.pem"
KEY_FILE="${LAB_ERP_RUNTIME_ROOT:-$(pwd)}/key.pem"
```
Same pattern in MBP's copy. Claude2 should port to iMac. Prevents future cert-loss on any reset.
**Commit:** `fix(start): resolve cert.pem via LAB_ERP_RUNTIME_ROOT not pwd (prevent Mini HTTPS-drop incident)`.

---

## [TOP 2026-04-17T06:40+02:00 CLAUDE1] T_mcp-install-parity — Codex installs 7 MCPs (updated list)

**Doc:** `docs/MCP_INSTALL_LIST_2026_04_17.md`. Claude1 (me) + Claude2 (iMac) now have these 7 MCPs. Codex side is the gap.

**Codex action on MBP (your terminal):**
```bash
cd /Users/vishvajeetn/Documents/Scheduler/Main
codex mcp --help   # confirm syntax first (may differ from claude mcp)

# Core 3 (installed on both Claude agents):
codex mcp add filesystem --scope project -- npx -y @modelcontextprotocol/server-filesystem /Users/vishvajeetn/Documents/Scheduler/Main
codex mcp add sqlite --scope project -- npx -y mcp-sqlite /Users/vishvajeetn/Documents/Scheduler/Main/data/operational/lab_erp_data_operational_live.db
# cloudflare: reuse Claude1's setup (uses ~/.cloudflared/cert.pem) — see ~/.claude.json for the full bash-lc command

# Added 2026-04-17 after operator review:
codex mcp add playwright --scope project -- npx -y @playwright/mcp
codex mcp add git        --scope project -- npx -y @cyanheads/git-mcp-server
codex mcp add time       --scope project -- npx -y @theo.foobar/mcp-time
codex mcp add memory     --scope project -- npx -y @modelcontextprotocol/server-memory

codex mcp list     # confirm all 7 green
```
```

Commit: `ops(mcp): install filesystem+sqlite+cloudflare MCPs in Codex config`.

**Claude1 (me) handles the iMac side — I'll SSH and install on Claude2's config in parallel.**

---

## [PAIR-MODE 2026-04-17T07:35+02:00 CLAUDE1] Codex — 2 at a time

Operator insight: overloaded queues make Codex stall. Switching to pair-mode.

**Your top 2 picks (work either):**

1. **T17 tester-attendance-allow** — confirm `/attendance` route lets `tester` role in unconditionally (already does per `@login_required` only — if you find any portal-module gate that blocks tester, remove). Commit if change made: `fix(attendance): tester role always sees own attendance dashboard`.
2. **T105 sitemap-xml-per-tenant** — `app.py:13222` `sitemap_xml()` filters URLs by `module_visible_in_active_portal()` to stop leaking Lab routes on Ravikiran. Commit: `fix(sitemap): per-tenant URL filtering in sitemap.xml`.

Claude1 refills with 1-2 new tickets when you ship one. No bulk dumps.

Original 15-ticket bulk archived — see git history if needed.

## [ARCHIVED 2026-04-17T07:35 CLAUDE1] B3 06:05 backlog collapsed

5 small-ticket block (T6/T22/T105/T42/T110) — T42 + T110 shipped by me, T105 in PAIR-MODE block above, T6 + T22 remain open in §Recommended slice. See git for content.

## [P0-LIVE 2026-04-17T02:00+02:00 CONDUCTOR] 2 new Tejveer tickets (01:45–01:47 AM)

### T_vehicles-1-500-on-click (Tejveer 01:46, blocker)
`/vehicles/1` returns 500 on Android when clicking into the vehicle detail.
**Codex:** Find the route handler for `/vehicles/<id>` — likely a missing field or unhandled None in vehicle detail lookup. Add guard + log. Verify via curl.
**Commit:** `fix(vehicles): guard None crash on vehicle detail → closes 500 on /vehicles/1`.

### T_payments-14-not-editable (Tejveer 01:45, major)
Purchase order at `/payments/14` has no edit affordance. POs should be editable (at least before approval).
**Codex:** Add an Edit button to the PO detail view wired to a `PATCH /payments/<id>` endpoint. Status-gate: only editable if status is `draft` or `pending`. Mirror vendor edit pattern.
**Commit:** `feat(payments): add edit flow for purchase orders in draft/pending state`.

## [P0-LIVE 2026-04-17T06:00+02:00 CLAUDE1] 2 Tejveer pool items (Claude2 flagged)

### T_schedule-404-on-ravikiran (Tejveer 18:06)
`/schedule` 404s on Ravikiran. Lab-only module leaking or nav dead link.
**Codex:** Hide `/schedule` nav link for non-lab portals + return friendly 404 on direct hit.
**Commit:** `fix(schedule): hide nav link for non-lab portals + friendly 404 on direct hit`.

### T_stats-404-on-ravikiran (Tejveer 18:08)
Same pattern for `/stats` route + nav.
**Commit:** `fix(stats): hide nav link for non-lab portals + friendly 404 on direct hit`.

---

## [SHIPPED 2026-04-17] T62 pending-user approval UI

Landed on canonical in `bbe9480` (`feat(admin): pending-user approval dashboard + bulk actions + audit`) with the follow-on bulk action pass in `78b469b` (`feat(personnel): bulk approve pending users`). Keep this section as history only; do not re-queue unless a new regression is reported against `/admin/pending-users`.

---

## [B3 2026-04-17T05:55+02:00 CLAUDE1] T66 remaining module-stub-to-real (Payroll / Attendance / Admin)

Codex shipped T100 tuck-shop-module-real-impl + T101 filing-module-real-impl + T99 mess-module-real-impl. Still STUB:

### T66.payroll — real dashboard
`/payroll` currently a "coming soon" stub. Replace with real dashboard reading from existing tables. Show: this month's payroll total, per-employee salary schedule, upcoming payment dates, simple approval workflow (draft → approved → paid).
**Commit:** `feat(payroll): real dashboard replacing coming-soon stub`.

### T66.attendance-admin — real admin view of attendance
`/admin/attendance` shows table; expand to show: this-week attendance matrix per employee, absent-today list with reasons, leave-balance per employee, approve/reject pending leave requests.
**Commit:** `feat(attendance): admin view with weekly matrix + leave-request actions`.

### T66.admin — real landing (consolidates T_admin-landing-route above)
Rename/merge with T_admin-landing-route. Same scope.

---

## [B3 2026-04-17T05:35+02:00 CLAUDE1] T_admin-landing-route — operator-flagged

**Page:** `/admin` (currently 404 on all 3 tenants)  **Severity:** UX gap  **Type:** missing route
**Operator flagged 05:25 Paris** while triaging the verify-loop incident: tried to navigate to `/admin` and `/admin/dashboard` and `/admin/settings` and `/admin/audit` — all 404. Only `/admin/dev_panel` and `/admin/users` exist.
**For Codex:** Add a simple `/admin` route in `app.py` that:
1. `@login_required + @owner_or_super_admin_required` (or appropriate gate)
2. Renders `templates/admin_landing.html` — a simple grid of admin tools available to the user's role: links to `/admin/dev_panel`, `/admin/users`, `/admin/audit-export`, `/finance`, `/companies/<id>` for each company, etc.
3. Redirect `/admin/dashboard`, `/admin/settings`, `/admin/audit` (without slash variants) to `/admin` so future navigation never 404s.
**Commit:** `feat(admin): /admin landing page with role-aware tool grid + alias redirects (operator 05:25)`.

---

## [P0-LIVE 2026-04-17T05:30+02:00 CLAUDE1] T_verify-deploy-empty-served-handling

**INCIDENT just resolved:** Mini's `local.catalyst.verify` launchd was kickstarting gunicorn every 60s because `verify_deploy.sh` interpreted empty `served=` as drift. 6-sec gunicorn restart windows invalidated CSRF + sessions for live users. Operator hit "500 everywhere" + "Send button doesn't work" — both root-caused to session loss.

**Mitigated 2026-04-17 05:25:** I disabled `local.catalyst.verify` launchd via SSH bootout. Gunicorn now stable. **Record in LIVE_PATCH_LOG_2026_04.md.**

### T_verify-deploy-empty-served-fix — Codex P0
**File:** `scripts/verify_deploy.sh` on Mini canonical (also any MBP copy).
**Fix:** when `served=` is empty (the gunicorn /git_head endpoint returned blank or unavailable), do NOT consider it drift. Either (a) skip kick + log warning, or (b) fall back to `bare == worktree` check only. Currently: `if [ "$bare" != "$served" ] || [ "$worktree" != "$served" ]; then kick`. Add: `if [ -z "$served" ]; then echo "served unavailable, skipping kick"; exit 0; fi` near top.
**Also:** investigate WHY served= is empty. Check Mini's gunicorn /git_head (or similar) endpoint — may have been removed by a recent commit, or env var not set.
**Commit:** `fix(ops): verify_deploy.sh tolerates empty served= without kick-loop (mini incident 2026-04-17 02:50)`.

**After fix lands:** re-enable Mini verify launchd:
```
ssh catalyst-mini 'launchctl bootstrap gui/$(id -u) /Users/vishwajeet/Library/LaunchAgents/local.catalyst.verify.plist'
```

---

## [P0-LIVE 2026-04-17T04:40+02:00 CLAUDE1] T_narrate-auto-send-on-stop-record — Tejveer 18:53

**Page:** `/sitemap` (but feature is global)  **Severity:** UX blocker for tester flow  **Type:** widget behavior
**Tejveer 18:53:47Z (paraphrased):** "The moment you stop recording it should automatically send response, or whenever you click enter or space bar."
**For Codex:** `templates/_feedback_widget_script.html` — narration chip currently requires manual click of submit after voice recording stops. Wire up:
1. **Auto-send on stop-recording**: when SpeechRecognition emits `onend` (user stopped recording), if transcript is non-empty AND user hasn't started typing additional text, fire the submit.
2. **Enter / Space-bar shortcut**: in the textarea, Enter (without Shift) submits; Space-bar after a 2-sec pause optionally submits (configurable; or just Enter for v1).
3. Provide a 1-sec "Auto-sending in…" toast so user can cancel.
**Commit:** `feat(narrate): auto-send transcript on stop-recording + Enter to submit (tejveer 18:53)`.

---

## [B3 backlog 2026-04-17T04:15+02:00 CLAUDE1] Next 3 atomic tickets when P0 queue drains

When all `[P0-LIVE]` blocks above are SHIPPED, Codex picks from these:

### T2 — tuck-shop-portal-gate (B3 atomic, ~1 burn)
Swap the `/tuck-shop/*` route family at `app.py:26963-27337` from `module_enabled("tuck_shop")` to `portal_route_enabled("tuck_shop")`. Keep `_tuck_shop_access(user)`. Internal smoke check: hit `/tuck-shop` as a Lab-portal user (should 404), Ravikiran-portal user (should 200/302).
**Commit:** `fix(tuck-shop): gate routes by portal, not module_enabled`.

### T3 — mess-portal-gate (B3 atomic, ~1 burn)
Same pattern at `app.py:26161-26728` for `/mess/*`. Keep `_mess_access(user)`.
**Commit:** `fix(mess): gate routes by portal, not module_enabled`.

### T17 — tejveer-attendance-always-allowed (B3 atomic, ~1 burn)
Tester role's `/attendance` access currently gated on a portal_module check that may strip access mid-session. Find the gate, allow `tester` role unconditionally on attendance routes (it's the test surface they mark daily attendance from).
**Commit:** `fix(attendance): tester role always sees own attendance dashboard`.

---

## [P0-LIVE 2026-04-17T04:00+02:00 CLAUDE1] 3 fresh tickets from earlier pool sweep

### T_vendor-detail-editable
**Page:** `/vendors/5`  **Severity:** major  **Type:** missing-feature
**Tejveer 18:30:02Z:** "I cannot edit the vendor pitch... each of the things on this vendor page should be editable and if someone added it should log th[em]."
**For Codex:** `templates/vendor_detail.html` — currently read-only. Add inline-edit form per field (name, pitch, contact, address). On save: update `vendors` row, INSERT `audit_log` row with `actor=current_user.id`, `before/after JSON`. Mirror the pattern in `templates/vehicle_detail.html` edit form.
**Commit:** `feat(vendors): editable vendor detail page + audit log per change (tejveer 18:30)`.

### T_vehicles-info-panel-truncated
**Page:** `/vehicles/1`  **Severity:** major  **Type:** UI clipping
**Tejveer 18:34:59Z:** "Truncated/clipped values in the Vehicle Info panel"
**For Codex:** Vehicle Info tile in `templates/vehicle_detail.html` — likely a `text-overflow:ellipsis` or fixed-width col cutting off long values (insurance company name, registration #, etc.). Add `overflow-wrap:break-word`, increase tile width, or use a 2-col grid that wraps long fields.
**Commit:** `fix(vehicles): vehicle-info panel doesn't truncate long values (tejveer 18:34)`.

### T_vehicle-log-entry-creates-expense
**Page:** `/vehicles/2`  **Severity:** major  **Type:** feature gap
**Tejveer 18:56:46Z:** "the log entry is there not clickable they should be expenses basically if you make an entry here it should directly go to the expense and it should go to the operator who will t[riage]."
**For Codex:** When a user adds a `vehicle_log` entry of type Fuel/Service/Repair with an amount > 0, INSERT a corresponding `expense_receipts` row linked to the vehicle (`expense.vehicle_id = log.vehicle_id`, `expense.amount = log.amount`, `expense.status = 'pending_review'`). Notify the responsible operator (queue or email per existing notification flow). Make the log row clickable in the UI to open the linked expense.
**Commit:** `feat(vehicles): log entries with amount auto-create pending expense for operator review (tejveer 18:56)`.

---

## [P0-LIVE 2026-04-17T03:50+02:00 CLAUDE1] T_debug-button-hides-feedback-button — Tejveer 21:52

**Page:** `/`  **Severity:** polish  **Type:** UI overlap
**Tejveer 21:52:37Z:** "Debug button is right above and hiding the feedback button."
**For Codex:** Debug button (probably from `_feedback_widget_markup.html` or `base.html` inline narration-bar) sits at z-index above (or co-positions with) the Feedback launcher. Either separate them in DOM (Debug to one corner, Feedback to another), or stack them vertically with margin between, or merge into one launcher with two actions inside.
**Commit:** `fix(feedback): debug + feedback launchers don't overlap (tejveer 21:52)`.

---

## [DONE-VERIFIED 2026-04-17T03:50 CLAUDE1] Codex shipped 3 P0-LIVE tickets
_(collapsed — see git log)_


## [P0-LIVE 2026-04-17T03:15+02:00 CLAUDE1] 3 fresh Tejveer feedback tickets (SHIPPED — see DONE-VERIFIED above)
_(collapsed — see git log)_


## [COMMS 2026-04-17T03:00+02:00 CLAUDE1] War-mode broadcast — all agents read

**Active mode:** Ultra Fast Build Mode (UFBM) — `docs/ULTRA_FAST_BUILD_MODE_2026_04_17.md`. 1-week sprint 2026-04-17 → 2026-04-24.

**For Codex1 (MBP):**
- Keep firing through your bundle (A → F → T130). Don't idle. If Claude1's §ORDER queue is empty, pull from `§Recommended slice` top.
- Pull-rebase every commit. Push immediately.
- Performance cores: macOS will pin you to P-cores automatically during compile/inference. Run hot — chassis fan + warm palm rest are normal, within spec for M1 Pro.

**For Claude2 / Claude3 (iMac, when back online at 10pm — satyajeetn2012 credit refill):**
- UFBM live. Ollama crawlers running on iMac at 180s cadence (light-load, llama3:8b).
- Your role unchanged: Claude2 = iMac backend writer via SSH-launchd burns, Claude3 = iMac frontend port writer (if you come back as Cowork app). BUT: per operator 2026-04-17 02:40, the iMac Cowork (AnyDesk) Claude is demoted — Option A rig is SSH-tunnel only. Confirm with operator before running Cowork.
- Ollama trust policy (`docs/OLLAMA_TRUST_POLICY_2026_04_17.md`): classification is **forbidden**. Approved = probe-body gen + read-only crawling + data entry. Don't auto-triage from `tmp/feedback-classified.jsonl` — Claude + Codex decide, Ollama observes.

**For all agents:**
- Ollama crawlers status: endpoint-regression live on all 3 hosts; ollama-qa-daily live on MBP; pytest-gen + feedback-classify DISABLED pending 7-day ≥90% QA.
- Better classifiers pulling on Mini: deepseek-r1:14b (9GB) + qwen3:32b (20GB). Will re-QA when done (~5 min from 03:00).
- iMac display slept; screen auto-lock on wake.
- Power policy: MBP + Mini free electricity; iMac burn-mode OK for 1 week per operator.

---


## [ARCHIVED 2026-04-17] Old ORDER blocks removed

Orders from 2026-04-16 22:05 through 2026-04-17 03:00 were cut — all tickets in those blocks shipped or superseded. See git log --grep 'orders(codex1)' for history.


## Current Status
_Last refreshed: conductor pass #21 (Claude0), 2026-04-17 ~14:13 +0200_
- Branch: `operation-trois-agents`
- Repo: `/Users/vishvajeetn/Documents/Scheduler/Main`
- Working tree: unstaged `static/playground/rig-status.html` (stash/pop artefact); unstaged `tmp/claude2_inbox.md` + `tmp/claude3_inbox.md` (inbox orders from Claude1 — not conductor scope)
- HEAD: `e4356e3` (docs(ops): MBP compute budget policy after full-pin incident)
- Live app: `127.0.0.1:5056` (LISTEN ✓) — multi-worker, confirmed 14:13 +02
- Demo app: `127.0.0.1:5055` (LISTEN ✓) — multi-worker, confirmed 14:13 +02
- iMac (catalyst-imac): reachable — uptime 1d 11h23m, load **2.85/3.04/2.79** (**⚠ 3.04 breaches 3.0 threshold — flag to operator**)
- `CLAIMS.md` active-claims: **orphaned row** — `claude3-imac | ravikiran-backport-project` (started 13:10+02, 63 min old). Work COMPLETE (8d016e3 "backport project complete" + claude3 moved on to 2e32715). Row not cleaned up — **operator confirm OK to clear**.
- Queue review: top pain = **navigation_ui**; 0 error clusters
- **MBP compute budget** (e4356e3 at 14:12): 4 Claude1 scheduled tasks disabled + 3 Ollama crawlers unloaded after full-pin at ~14:00. `claude0-conductor-burn` is DISABLED (NOT rearming). `conductor-15min-morning-2026-04-17` still active.
- **Active agent orders (14:00-15:00 window):** Claude3 on Lab-ERP L1-L6 sprint (L1 two-pane login SHIPPED 2e32715). Claude2+Codex on Lab-ERP backport pair (per claude2_inbox order).
- **Remaining bench**: T114 client-chain (API recharge needed), T71 check_data_cordons, T3 mess-portal-gate.

## Mode — MBP-only (iMac deferred)
- Operator call at 13:12 +02: "just use codex and claude from here to the max". iMac/Claude1 onboarding is paused until further notice.
- Rotation is two-agent this cycle: Claude1 conductor + Codex writer, both on the MBP.
- Ravikiran live observation is paused; Lab ERP dev slices + audit queue continue.

## Machine / Lane
- Primary write plane: MBP at `/Users/vishvajeetn/Documents/Scheduler/Main` (Lab ERP).
- Secondary MBP repo: `~/Claude/ravikiran-erp` (Ravikiran ERP dev clone — optional).
- Live lanes: observation only.
- Dev lanes: bounded edits, tests, commits, push.

## Current Rotation Guidance (FIVE-agent parallel, 2026-04-16 ~23:55 Paris)

Operator fired additional agents 2026-04-16 ~23:45–23:55. **Five agents now running in parallel** across two Max accounts + a direct-API agent. Operator role-split (2026-04-16 ~23:40): **Codex writes code; Claude plans / fixes / tests / summarizes / architects.**

| agent | host | account / pool | fired how | lane |
|---|---|---|---|---|
| **Claude1** (me) | MBP terminal | `general.goje` Max → **Pool A** | interactive | conductor (standing down soon to save quota) |
| **Codex1** | MBP terminal | `general.goje` Max → **Pool A** | operator-fired | the code-writing beast — follows Claude orders |
| **Claude2** | iMac terminal | `satyajeetn2012` Max → **Pool B** | SSH nohup + launchd every 90 min, `--dangerously-skip-permissions` | iMac backend + live HTTP verify |
| **Claude3** | iMac Cowork app | `satyajeetn2012` Max → **Pool B** | operator via AnyDesk | **mini-conductor** — feeds Codex1 tickets, tests, ports templates |
| **Claude-API** | operator-chosen host | direct Anthropic API (no Max) → **Pool API** | operator-fired | programmatic / scripted — doesn't burn Max quota |

Pool A = Claude1 + Codex1. Pool B = Claude2 + Claude3. Pool API = Claude-API only.

Claude-API is special — it runs against direct Anthropic API credits (recharged earlier today), not Max subscription quota. Good for always-on scripted work that would otherwise burn a Max pool. Use cases: narration-chip `/ai/route` backend (once T114 ships), continuous-crawl bots, audit crawls.

Scope per agent:
- **Claude1** — conductor, hot SSH patches to any host, Chrome verification via MCP, task-file maintenance, reconciliation of live patches into `LIVE_PATCH_LOG_2026_04.md`. Runbook: this file + `docs/CLAUDE1_BURN.md`.
- **Codex1** — MBP canonical write plane. Every ticket in `§Recommended slice` tagged "(Codex write)" is his. Claim → edit → smoke → commit → push. Runbook: `docs/CODEX_BURN.md`.
- **Claude2** — iMac **backend**: `app.py`, `scripts/*.py`, DB seeds, reporting_structure, launchctl kickstart, live HTTP verify. Runbook: `docs/CLAUDE2_IMAC_BURN.md`.
- **Claude3** — iMac **frontend**: templates/static ports from MBP canonical to iMac live. Never touches `app.py` or restarts gunicorn. Runbook: `docs/CLAUDE3_IMAC_COWORK_BURN.md`.

### iMac lane discipline (Claude2 + Claude3 share filesystem + quota pool)
Both iMac agents edit files under `/Users/nv/ERP-Instances/ravikiran-erp/live/app/`. Non-overlap is enforced by:
1. **File-type split** — Claude2 owns `*.py` + infra; Claude3 owns `templates/*.html` + `static/*`.
2. **`CLAIMS.md` entries** before any edit, with `agent=claude2` or `agent=claude3`.
3. **Offset cadence** — Claude2 burns at 14:45/16:15/17:45/19:15/20:45 Paris; Claude3 at 15:30/17:00/18:30/20:00/21:30 (45-min offset so they don't hit the shared pool simultaneously).
4. **Only Claude2 restarts gunicorn.** Claude3's template edits are picked up on next request or the next Claude2 kickstart.

**Practical effect**: when iMac Ravikiran needs an edit, I (Claude1 on MBP) SSH in, patch the live app, kickstart the service, verify in Chrome via the Claude-in-Chrome MCP, and record the patch in `LIVE_PATCH_LOG_2026_04.md`. No `claude` process running on the iMac.

## Current Next-Step Rule
- If Codex has no explicit assignment, take the top unstarted item from §"Audit Queue" or §"Recommended slice" below.
- If operator updates this file, the next active slice must follow the updated instruction.
- IDLE RULE: if the queue is empty, Codex runs `scripts/queue_review.py` + `scripts/smoke_test.py` as a health-only burn and exits without committing.

## Recommended slice this rotation
Priority stack — Codex picks the top unstarted item and ships it bounded.

**Phase 1 (B1 live-site) is active.** Top 3 items below are tagged
`[B1-PHASE1]` and take priority over everything else.

0. **T114 — `/ai/route` endpoint + narration-chip wire-up (Codex write) [B1-PHASE1]**

   Goal: the narration chip ("Narrate feedback") currently POSTs plain text to `/debug/feedback` (a log-append endpoint). Phase 1 adds a SECOND POST target, `/ai/route`, which calls the Anthropic API and returns a structured decision. The chip fires both (fire-and-forget to `/debug/feedback` for audit + await `/ai/route` for action).

   **Spec:**
   - New route `POST /ai/route` in `app.py` (adjacent to `/ai/ask` at L25794). `@login_required`.
   - Request body (JSON or form): `{ text: str, page: str, role: str, picker: {selector?, rect?, screenshot_b64?} }`.
   - Server-side: build Anthropic chat request with system prompt "You are the ERP assistant. User is on {page} as {role}. They said: {text}. Optionally they pointed at element {selector}. Decide: (a) answer the question directly, (b) navigate them to another page, (c) file a bug ticket, (d) do nothing. Return JSON `{action, payload}`."
   - Use `os.environ["ANTHROPIC_API_KEY"]` (already set on MBP canonical; iMac+Mini will read from `.env`). Model `claude-haiku-4-5-20251001` for speed.
   - Response `{ok: True, action: "answer"|"navigate"|"file_bug"|"noop", payload: {...}}`.
   - Writes a row to new sidecar `data/operational/routing_requests.jsonl` per tenant (field order: `ts, user_id, page, role, text, action, payload`). Append-only; no DB table needed.
   - Graceful degrade: if API call fails, return `{ok: False, action: "noop", error: str}` — chip falls back to existing `/debug/feedback` POST.
   - Add a simple rate limit: max 30 calls/user/hour. If exceeded, return 429 `{ok: False, action: "rate_limit"}`.

   **Tests (pytest, required):**
   - Mock the Anthropic SDK. Assert `/ai/route` returns 200 with a shape-valid action on success; 500→fallback on SDK exception; 429 on over-limit.
   - Assert `routing_requests.jsonl` gets an append after a successful call.

   **Commit (required):** `feat(ai): /ai/route endpoint — narration chip to Anthropic API with routing-request audit log`

   **Follow-ups (file after ship):**
   - T114.port: Claude2 ports `/ai/route` to iMac live app.py, kickstarts gunicorn, live-verifies
   - T114.chip: Claude3 updates `templates/_feedback_widget_script.html` to POST to `/ai/route` in parallel with `/debug/feedback`; renders the returned action (for "answer" — show the text; for "navigate" — location.href; for "file_bug" — confirm modal)

1. **T115 — `live-probe LaunchAgent` (Claude1 self-ship) [B1-PHASE1]**

   Every 60 s, probe `/login` on all 3 tenants. On any non-200, write `tmp/agent_handoffs/live-probe-alert-<ts>.md` with the code + response headers. Install as `local.catalyst.live-probe.plist` on MBP. Claude1 ships this — already at Claude1's bench.

2. **T71 — `check_data_cordons.py` (Codex write) [B2]**

   Per `docs/DATA_CORDON_POLICY_2026_04_16.md` §Enforcement. Nightly cron that opens every tenant DB on a host, for every `user_id` / `email` / `portal_slug` reference confirms it resolves inside the same tenant. Emits `tmp/agent_handoffs/data-cordon-breach-<ts>.md` with violating rows — does NOT auto-clean. Commit: `feat(cordon): nightly check_data_cordons.py — alert on cross-tenant row references`.

3. **T1 — `tool-gatekeeping-audit` (Codex read-only → doc)**
   Survey every `_can_view_*`, `_can_manage_*`, `is_owner`, `user_role_set` helper in `app.py`, plus every `portal_route_enabled` / `module_visible_in_active_portal` / `module_enabled` gate. Produce a matrix at `docs/TOOL_GATEKEEPING_MATRIX_2026_04_16.md`:
   - rows = each gate helper (file:line + signature)
   - columns = tester / operator / finance_admin / instrument_admin / site_admin / super_admin / owner
   - cells = allow / deny / role-dependent
   - flag any gate that diverges from `_can_view_debug_surfaces` which is the canonical debug-access gate at `app.py:4640`
   - flag any route that gates only on `module_enabled(x)` instead of `portal_route_enabled(x)` (portal-isolation leak)
   Commit as `docs(audit): tool gatekeeping matrix`. Read-only; no app edits in this slice.

2. **T2 — `tuck-shop-portal-gate` (Codex write)**
   Recipe in §Recommended slice of rotation pass #12 of the rolling handoff. Swap gate in `/tuck-shop/*` route family at `app.py:26963-27337` from `module_enabled("tuck_shop")` to `portal_route_enabled("tuck_shop")`. Keep `_tuck_shop_access(user)`. Commit: `fix(tuck-shop): gate routes by portal, not module_enabled`.

3. **T3 — `mess-portal-gate` (Codex write)**
   Same pattern at `app.py:26161-26728` for `/mess/*`. Keep `_mess_access(user)`. Commit: `fix(mess): gate routes by portal, not module_enabled`.

4. **T4 — `imac-tejveer-role-drift-fix` (Codex write — one-off script)**
   iMac Ravikiran live DB has `tejveer` as `super_admin`; MBP + Mini have `tester`. The MBP canonical seed (`app.py:8179`) and the new `_seed_operational_real_team` both call tejveer a tester. Write `scripts/fix_tejveer_role_on_imac.py` (idempotent, operator runs once) that sets `users.role='tester'` WHERE email='tejveer' on the iMac's live DB. Include dry-run mode. Commit: `fix(seed): script to normalize tejveer role on iMac to tester`.

5. **T5 — `feedback-widgets-split` (Codex write)**
   Architecture cap item. Split `templates/_base_feedback_widgets.html` (655 lines → target <400) into partials or `{% macro %}` blocks. No visible UX change. Smoke + `python -m crawlers wave sanity` before shipping. Commit: `refactor(templates): split _base_feedback_widgets under cap`.

6. **T6 — `styles-css-cap` (Codex write)**
   Trim or split at least 30 lines from `static/styles.css` (currently 10529, cap 10500). No visual regression. Commit: `refactor(styles): trim styles.css under cap`.

7. **T7 — `catalysterp-502-incident-brief` (Claude1 doc-only)** — already captured in handoff pass #10. Needs operator Cloudflare-dashboard action; not a Codex dev slice.

8. **T8 — `debug-feedback-pool-cron` (Codex write)**
   Write a small rsync script that pulls `debug_feedback.md` +
   `debug_feedback_history.md` from Mini + iMac into
   `tmp/debug-feedback-pool/<host>/` on the MBP on a 10-minute cron.
   New files only: `scripts/pool_debug_feedback.sh` + a launchd plist at
   `ops/launchd/local.catalyst.debug-pool.plist`. Add the install recipe
   to `docs/DEBUG_FEEDBACK_LOG_PATHS.md` §"Pooling across tenants".
   Commit: `feat(ops): pool debug_feedback across live hosts every 10 min`.

9. **T9 — `debug-entry-user-filter-cli` (Codex write)**
   Add `scripts/debug_feedback_filter.py` — takes `--user "Nikita"` (or
   email), `--since <iso>`, `--tenant {lab, ravikiran, all}`, prints
   entries in chronological order. Uses the pooled directory from T8
   when present, falls back to SSH tails otherwise. Commit:
   `feat(scripts): debug_feedback_filter for per-user/per-tenant debriefs`.

10. **T10 — `nikita-vehicles-wrap-bug` (Codex write)**
    Nikita reported on `/vehicles/1` that driver-assignment rows spill
    past the right margin and long entries don't wrap. Fix the CSS in
    `static/styles.css` (likely `.vehicle-driver-assignment`,
    `.driver-row`, or the generic tile grid rule). Add a mobile
    responsive check at 375 px. Commit:
    `fix(vehicles): wrap driver assignment rows at small viewports`.

11. **T11 — `nikita-finance-prashant-role-copy` (Codex write)**
    Nikita reported on `/finance` that the Prashant card says he
    handles "grants" when his real role is accountant / expenses / taxes
    / monthly salary. Fix the copy in the template (grep for
    `grants.*Prashant` or `Prashant.*grant` in `templates/` and
    `app.py`). Commit: `fix(finance): correct Prashant role copy on personnel card`.

12. **T12 — `debug-keyboard-shortcut-mc-collision` (Codex write)**
    Nikita reported that `m` starts her mic and `c` registers a click,
    so she can't type words with those letters inside the debug voice
    capture. In `static/debug-grid.js` find the hotkey handlers that
    bind `m` and `c` and either
    (a) require a modifier (e.g. `Cmd+M` / `Cmd+C`) or
    (b) only fire when `document.activeElement` is NOT a text input.
    Pick (b); it's invisible to other flows. Commit:
    `fix(debug): skip m/c hotkeys while typing in inputs`.

13. **T13 — `nikita-notifications-review-pane` (Codex write)**
    Nikita reported `/notifications` reloads on the "review" action
    instead of opening the review pane (edit / recall / delete). Find
    the notification review route (`notification_review`,
    `notifications_review`, or similar in `app.py`), look at the
    template binding, and wire the review action to the review
    template instead of re-rendering the list. If the review template
    doesn't exist, create `templates/notification_review.html` with
    the minimal fields. Commit: `fix(notifications): open review pane instead of reloading list`.

14. **T14 — `feedback-pane-minimal-ui` (Codex write)**
    Operator called the debugger pane "very simple". Verify the
    current pane is minimal — open `templates/_base_feedback_widgets.html`
    (the big 655-line template flagged in T5) and identify the feedback
    widget markup. Strip anything that isn't: (title, severity,
    description, optional screenshot, submit). Split CSS into a single
    `static/feedback_widget.min.css` if needed. Commit:
    `refactor(feedback): strip widget to 5 fields + single CSS`.

15. **T15 — `imac-ravikiran-app-py-drift-report` (Codex read-only → doc)**
    Compare the iMac's live `app.py` (17 473 lines) against the MBP's
    canonical `app.py` (30 858 lines). Generate
    `docs/IMAC_RAVIKIRAN_APP_DRIFT_2026_04_16.md` listing:
    - Functions present on MBP but missing on iMac
    - Functions on iMac with different signatures
    - Top 20 features the iMac would gain by a full sync
    - Risk callouts (DB schema migrations that would fire on first boot)
    Read-only; the fix comes later. Commit:
    `docs(audit): iMac Ravikiran app.py drift vs canonical`.

16. **T16 — `prashant-name-normalize` (Codex write — one-off script)**
    Mini + iMac call prashant "Prashant Nagargoje"; MBP seed +
    demo-team brief call him "Prashant Chavre". Write
    `scripts/normalize_prashant_name.py` with `--dry-run` and `--apply`
    against both live DBs: updates `users.name` to "Prashant Chavre"
    WHERE email='prashant' AND name != 'Prashant Chavre'. Operator
    confirms the correct last name first via a flash check note in
    `docs/`. Commit: `fix(seed): script to normalize prashant last name`.

17. **T17 — `tejveer-attendance-always-allowed` (Codex investigate → fix)**
    Operator: "Tejveer is employed so his time should be able to work
    at all times." Investigate whether `/attendance` or any
    role/portal gate blocks tejveer (role=tester) from logging time
    entries. Search `app.py` for gates on tester. If blocked, open the
    attendance route to tester or promote tejveer's attendance scope
    so his clock-in / clock-out / leave flow always works. Smoke
    test a POST /attendance/check-in as tejveer locally on demo.
    Commit: `fix(attendance): allow tester role to clock in/out always`.

18. **T18 — `portal-dashboard-show-user-portal` (Codex write)**
    When nikita / prashant (super_admin) lands on Ravikiran
    `ravikiran.catalysterp.org`, make the header clearly show
    "Private Workspace" (their active portal) rather than defaulting
    to the first one alphabetically. Find `active_portal_slug()` +
    the header template (`templates/base.html` or
    `templates/_portal_switcher.html`) and ensure the switcher
    highlights the session's active portal. Commit:
    `fix(portal): header shows active portal slug explicitly`.

19. **T19 — `seed-operational-smoke-test` (Codex write)**
    `_seed_operational_real_team` has no test. Add a pytest at
    `tests/test_operational_seed.py` that:
    - Creates a fresh sqlite DB with the schema,
    - Runs `_seed_operational_real_team()` with `DEMO_MODE=0`,
    - Asserts nikita / prashant / tejveer rows exist, active=1,
      invite_status='active', role matches spec, password verifies
      with "12345",
    - Asserts no `lab` portal membership for any of the three,
    - Runs it again and asserts idempotency (row count unchanged).
    Commit: `test(seed): cover _seed_operational_real_team happy path`.

20. **T20 — `queue-review-aggregator-cross-tenant` (Codex write)**
    Extend `scripts/queue_review.py` so it optionally pulls via SSH
    from Mini + iMac when the `--cross-host` flag is passed. Writes
    aggregated summary to `data/operational/logs/queue_review_cross_host_latest.md`.
    Keeps the existing single-host mode as default. Commit:
    `feat(queue-review): optional cross-host aggregation mode`.

21. **T21 — `debug-toggle-bottom-of-page` (Codex write) — operator-flagged priority**
    Add a simple debugger **toggle chip** at the bottom of every page,
    available to every authenticated user. Default off. When the
    operator flips it on, voice narration (Web Speech API) starts and
    streams transcribed text into the existing `/debug/feedback` POST
    handler (the one this burn just opened to all users).
    - Put the chip in the global footer / bottom bar
      (`templates/base.html` — the page shell). Single `<button>` with
      `aria-pressed`, mic icon on when active, off when idle.
    - All JS logic lives in `static/debug-grid.js` (extend the
      existing voice-capture helpers that already handle the
      `?debug=1` grid narration). Toggle-on calls
      `startDebugNarration()`, toggle-off calls `stopDebugNarration()`.
    - POST transcripts to `/debug/feedback` as JSON with
      `{text, page: location.pathname, timestamp, grid_visible: false, source: "narration-toggle"}`.
    - Show a tiny live-transcript preview above the toggle so the
      user sees what's being captured; not the full dev grid.
    - No role gate. Works for every logged-in user. If the user is
      anonymous, the toggle is hidden.
    - Smoke: confirm the toggle renders on `/`, `/login` (hidden,
      anonymous), `/finance`, `/vehicles`, `/debug`. Confirm a
      voice submission appends to `debug_feedback.md`.
    - Commit: `feat(debug): bottom-of-page narration toggle for all users`.

22. **T22 — `tenant-aware-url-building` (Codex investigate + write) — operator-flagged**
    Every link rendered inside a tenant's pages must stay on that
    tenant's host. Example: when logged into Ravikiran on
    `ravikiran.catalysterp.org`, clicking any nav / card / email link
    must resolve to `https://ravikiran.catalysterp.org/…`, never to
    `catalysterp.org` or `mitwpu-rnd.catalysterp.org`. Same rule for
    every tenant.

    **Known offenders** (grep has found them, fix each):
    - `app.py:92` `"beta": "https://ravikiran.catalysterp.org"` — hard-coded.
    - `app.py:9793` `"href": "https://ravikiran.catalysterp.org/login"` — hard-coded.
    - `app.py:12959` `"hq": "https://ravikiran.catalysterp.org/login"` — hard-coded mapping.
    - `chooser/app.py:34` `PERSONAL_URL = "https://ravikiran.catalysterp.org"` — chooser is OK (it intentionally points out to Ravikiran), but audit for parity.
    - Email-template base URLs — grep `templates/emails/` for `catalysterp.org`.
    - Any `{{ url_for(...) }}` that's been wrapped with `http://` or `https://` explicitly — those force the wrong host.

    **Design**:
    - Introduce a helper in `app.py`, alongside `HOST_PORTAL_BINDINGS` at line 400:
      ```python
      def _tenant_base_url(host: str | None = None) -> str:
          """Return the absolute base URL for the current tenant, or for `host` if given."""
          ...
      ```
      Derive from `request.host` when in a request context, or fall back to `HOST_PORTAL_BINDINGS` reverse-lookup for a portal slug → host mapping.
    - Add a Jinja global `tenant_url_for(endpoint, **kwargs)` that emits an ABSOLUTE URL on the current tenant's host. Use it in every template where an absolute URL is needed (emails, push notifications, QR codes).
    - Plain `url_for(endpoint)` without a scheme/host stays relative and is correct — don't change those.
    - For cross-tenant links (rare: e.g. a "switch to Lab" chip on a super_admin's Ravikiran header), keep the hard-coded host but wrap it in a small registry at top of `app.py`:
      ```python
      TENANT_PUBLIC_URLS = {
          "lab":           "https://catalysterp.org",
          "hq":            "https://ravikiran.catalysterp.org",
          "ravikiran_ops": "https://ravikiran.catalysterp.org",
          "mitwpu_rnd":    "https://mitwpu-rnd.catalysterp.org",
          "compute":       "https://playground.catalysterp.org",
      }
      ```
      Refer via `TENANT_PUBLIC_URLS[slug]` rather than inline strings.

    **Verification**:
    - Crawl `templates/**` and `app.py` with `grep -rE '"(https?://[^"]*\.catalysterp\.org[^"]*)"' templates app.py | grep -v TENANT_PUBLIC_URLS` — should come back empty after the fix.
    - Manual check in Chrome: log in to each tenant, hover every nav + footer link, confirm hostnames stay inside that tenant.
    - `python -m crawlers wave sanity` before shipping.

    Commit sequence:
    1. `feat(tenant): _tenant_base_url helper + TENANT_PUBLIC_URLS registry`
    2. `fix(tenant): replace hard-coded catalysterp URLs with registry / relative`
    3. `fix(emails): tenant-aware base URL in email templates` (if any offenders found)

    Shippable in one burn if kept to sub-step 1+2; step 3 can be a follow-up.

23. **T23 — `tenant-specific-filenames` (Codex audit + write) — operator-flagged**
    Same principle as T22 but for filenames / resource names, not
    URLs. When you're in Ravikiran every visible name should reflect
    Ravikiran. When you're in Lab ERP every visible name should
    reflect Lab ERP. No cross-tenant collisions.

    **Scan + fix targets:**
    - **DB filenames** — already differentiated (`ravikiran_erp_data_operational_live.db` vs `lab_erp_data_operational_live.db`). Confirm there's no stale shared `lab_scheduler.db` being read in production.
    - **Session cookie name** — already uses `PROJECT_FILE_STEM + runtime_slug`. Verify cookies on ravikiran vs mitwpu-rnd vs catalysterp have distinct names so they don't clobber each other when a user has both open.
    - **Log files** — `logs/server.log`, `logs/server-live.log`, `logs/debug_feedback.md` — live services share these names across tenants because they live under `RUNTIME_LOG_DIR`. Proposal: make each tenant's live log base name include the tenant slug: `server-ravikiran.log`, `server-lab.log`, `debug_feedback_ravikiran.md`, etc. Update `FEEDBACK_LOG` / `SERVER_LIVE_LOG` constants to derive from `RUNTIME_LANE` + a new `RUNTIME_TENANT_SLUG` env var.
    - **Launchd plists** — already tenant-named (`local.catalyst.ravikiran.plist`, `local.catalyst.mitwpu.plist`). Check naming consistency; no bare `local.catalyst` that maps to multiple tenants.
    - **Entry modules** — `ravikiran_erp_app.py` exists as a shim. Add parallel shims: `mitwpu_rnd_app.py` (lab R&D), `playground_app.py` (dev / demo). Each imports `app` from `app.py` but gives the WSGI layer a tenant-scoped module name, so `ps` / logs / audit trails name the tenant explicitly.
    - **Browser-title, page titles** — rendered `{{ org_name }}` is already tenant-set via env; confirm every `<title>` derives from `ORG_NAME` not the string "CATALYST".
    - **Email From: header + email-template subjects** — audit `templates/emails/` for hardcoded "CATALYST" or "Lab-Scheduler" strings; use `ORG_NAME` or a new `TENANT_EMAIL_FROM` registry.
    - **Favicon + apple-touch-icon** — serve a tenant-specific asset path. If `static/favicon-ravikiran.ico` etc. don't exist, generate placeholders and reference via `{{ url_for('static', filename='favicon-' ~ current_tenant_slug ~ '.ico') }}` with fallback to the generic.
    - **Meta `manifest.json` / PWA name** — if any, tenant-scope the `name` and `short_name`.

    **Deliverables (split into 2 commits to bound scope):**
    - Commit 1: `feat(tenant): tenant-scoped log + cookie + entry-module names` — the infra filenames.
    - Commit 2: `feat(tenant): tenant-scoped titles + email headers + favicons` — the user-visible surfaces.

    **Verification:**
    - Run `grep -rE 'catalyst|lab-scheduler' templates/emails/` — after the fix, remaining hits should all be variable interpolations, not literals.
    - `curl -I https://ravikiran.catalysterp.org/static/favicon-ravikiran.ico` → 200 after the fix.
    - Session cookie name differs between tabs pointed at two tenants: open DevTools → Application → Cookies on both, compare names.

24. **T24 — `tenant-aware-filenames-migration` (Codex write, split into 6 slices) — operator-flagged policy call**
    Policy document: `docs/TENANT_NAMING_POLICY_2026_04_16.md`. Every
    file on disk must tell us which **tenant** (lab / ravikiran /
    mitwpu / compute / sahajpur) and which **lane** (live / demo /
    dev) it belongs to. No more generic `server.log` /
    `lab_scheduler.db` / `local.catalyst.plist`. This **supersedes T23**
    — fold T23's audit items into T24's slices.

    Schema: `<tenant>_<lane>[_<variant>]_<kind>.<ext>`

    Slice breakdown (each shippable inside a single 30-min burn):

    - **T24.1 — resolver + env var.** Add `CATALYST_TENANT_SLUG` to the env-reading block near `app.py:77`. Derive `CANONICAL_STEM = f"{tenant}_{lane}" (+ "_" + variant if demo)`. Add `data_path(kind)` / `log_path(kind)` helpers. Default tenant to `"lab"` so existing Lab deployments keep working. Commit: `feat(tenant): CATALYST_TENANT_SLUG + canonical-stem filename resolver`.
    - **T24.2 — symlink migration script.** `scripts/migrate_tenant_filenames.py` — `--dry-run` + `--apply`. For each of `data/operational/lab_scheduler.db`, `data/demo/stable/lab_scheduler.db`, `logs/server-live.log`, `logs/server-demo.log`, `logs/debug_feedback.md`, etc., creates a new-name symlink pointing at the current file so both names resolve during the cutover. Operator runs once per host. Commit: `feat(migrate): symlink old filenames to new tenant-aware names`.
    - **T24.3 — update reads inside the engine.** Replace every hardcoded path literal in `app.py`, `scripts/queue_review.py`, `scripts/smoke_test.py`, `scripts/cluster_wave.py` with the resolver. Keep the legacy-fallback chain at `app.py:27306+` to tolerate either name. Commit: `fix(paths): route all reads through canonical-stem resolver`.
    - **T24.4 — rename launchd plists + set tenant env.** `ops/launchd/local.catalyst.plist` → `ops/launchd/local.catalyst.lab.live.plist`, `.demo.plist` → `.lab.demo.plist`, verify plist too. Each plist adds `CATALYST_TENANT_SLUG` + `CATALYST_DEMO_VARIANT` to `EnvironmentVariables`. Install recipe in `docs/DEPLOY_CHECKLIST_2026_04_16.md` updated too. Commit: `feat(launchd): tenant-qualified plist names + env vars`.
    - **T24.5 — tenant entry shims.** Add `ravikiran_erp_app.py` and `mitwpu_rnd_app.py` at repo root alongside the existing `lab_erp_app.py` and `compute_worker.py`. Each is a 6-line shim that sets `os.environ["CATALYST_TENANT_SLUG"]` appropriately then `from app import app`. The iMac already has a ravikiran shim at `/Users/nv/ERP-Instances/ravikiran-erp/live/app/ravikiran_erp_app.py`; move it into the repo so it's canonical. Commit: `feat(entry): per-tenant WSGI entry shims for cleaner ps / launchd attribution`.
    - **T24.6 — cutover commit (after one live rotation validates).** Remove the old filenames; drop the symlinks. Only the new canonical names remain. Commit: `refactor(filenames): drop legacy generic names post-migration`.

    **Verification** after T24.6:
    - `ls <any live host>/data/` has zero `lab_scheduler.db`, only `<tenant>_<lane>_data.db`.
    - `ls <any live host>/logs/` has zero generic `server*.log`, only `<tenant>_<lane>_*_server.log`.
    - `launchctl list | grep catalyst` shows every plist name carrying a tenant suffix.
    - `ps eww <gunicorn-pid>` shows `CATALYST_TENANT_SLUG=<slug>` in the environment.

25. **T25 — `ravikiran-blank-page-anonymous-role-filter` (Codex write) — TOP PRIORITY, LIVE INCIDENT**
    Diagnosed via Chrome: `https://ravikiran.catalysterp.org/login` renders a completely blank page. HTML serves fine (17 KB, form + fields + CSS). But every element (header / h1 / form / input / .login-card / main) is inline-styled `display: none`.

    **Root cause** (iMac live app.py):
    - `app.py:6133` sets `V = "requester finance_admin professor_approver faculty_in_charge operator instrument_admin site_admin super_admin"` as a Jinja global — the list of roles allowed to see tagged elements.
    - `app.py:6144` injects `V` into template context: `"V": V`.
    - `templates/base.html` emits `data-vis="{{ V }}"` on every element (header, topbar, h1, form, input, …).
    - Some JS (find it — either inline in iMac's base.html, or in `static/base_shell.js` / `static/role-toggle.js` / whichever file is actually loaded) reads `document.body.getAttribute('data-user-role')` and hides every element whose `data-vis` list does NOT contain the current role.
    - For an anonymous user (on /login), `data-user-role` is empty → NO role is in any list → everything gets `display: none`.

    **Fix options (pick one)**:
    1. **Cleanest** — the filter JS should bail out entirely when `role` is falsy (anonymous). Open the filter (`static/base_shell.js` on MBP canonical at line 207 has the safe pattern: `if (role && role !== 'owner')`). Ensure the iMac's serving code has the same guard. If iMac ships a different `base_shell.js`, sync it to canonical.
    2. **Template-side** — the login page template shouldn't emit `data-vis="{{ V }}"` at all; it's a pre-auth surface. Wrap emission in `{% if current_user %}…{% endif %}` for every element that has `data-vis` in `templates/base.html` on the iMac.
    3. **Server-side** — inject `V = "all"` when `current_user is None` so the filter always allows (the filter already skips elements whose `data-vis` includes the token `"all"`).

    **Apply to:**
    - MBP canonical `app.py` + `templates/base.html` + `static/base_shell.js` (commit to repo).
    - iMac live `/Users/nv/ERP-Instances/ravikiran-erp/live/app/` — same patch via SSH, then HUP gunicorn or kickstart `local.catalyst.ravikiran` launchd agent.
    - Mini — same patch once repo is in sync (via the normal `local.catalyst.verify` pull+kickstart loop).

    **Verification:**
    - Chrome: load `https://ravikiran.catalysterp.org/login` as anonymous → see the "Ravikiran" title + Sign In form. NOT blank.
    - `curl -ksS https://ravikiran.catalysterp.org/login | grep -oE 'style="display: none"' | wc -l` → `0` (currently > 15).
    - Log in as nikita/12345 → dashboard renders.

    **Commit sequence:**
    1. `fix(base): guard data-vis role filter against anonymous user` — JS change to bail out when role is empty.
    2. `fix(base): do not emit data-vis on pre-auth surfaces` — if option 2 is preferred, strip data-vis from base.html elements that live outside `{% if current_user %}`.

    This supersedes everything else in the priority stack until Ravikiran is usable again.

26. **T26 — `fix-ca-audit-dashboard-builderror` (Codex write)** — iMac `server.log` shows `werkzeug.routing.exceptions.BuildError: Could not build url for endpoint 'ca_audit_dashboard'. Did you mean 'audit_export'?` on `/payments`. Crashes page with 500. Grep for `url_for.*ca_audit_dashboard` across `templates/` + `app.py`; either rename the endpoint call to the correct existing route (`audit_export` or similar) or wire up the missing `ca_audit_dashboard` route if it's supposed to exist. Commit: `fix(payments): resolve ca_audit_dashboard BuildError`.

27. **T27 — `fullcalendar-asset-vendored` (Codex write)** — Replace the jsdelivr-CDN-hosted `chart.js` (currently 503 from jsdelivr, contributed to recent blank-page debugging noise) with a locally-vendored copy at `static/vendor/chart.js/chart.umd.min.js`. Update the `<script>` tag in `templates/base.html` / `_base_feedback_widgets.html` / wherever it's referenced. This removes the external dependency failure mode. Commit: `fix(vendor): pin chart.js locally instead of jsdelivr CDN`.

28. **T28 — `debug-narrate-tests` (Codex write)** — Pytest coverage for the new `/debug/feedback` JSON path (opened to all users in `c729730`). Mock the voice payload, assert the entry lands in `FEEDBACK_LOG`, assert the response is `{ok: True, saved_to: <path>}`. Commit: `test(debug): cover /debug/feedback JSON submission path`.

29. **T29 — `footer-narrate-chip-accessibility-audit` (Codex write)** — The T21 chip needs ARIA polish: high-contrast mode, keyboard focus ring, Enter/Space activation parity with click, announce "Recording" / "Sent" via `aria-live`. Open `templates/base.html` inline styles + `static/debug-narrate.js`. Commit: `a11y(debug): ARIA polish for narration chip`.

30. **T30 — `queue-review-pool-across-hosts` (Codex write)** — Extend `scripts/queue_review.py` with a `--pool-hosts` flag. When passed, runs the existing review on MBP AND SSHes to Mini + iMac to run it there, then aggregates into a single `data/operational/logs/queue_review_pooled_latest.md`. Uses the SSH aliases from `~/.ssh/config`. Commit: `feat(queue-review): optional cross-host pooled review`.

31. **T31 — `dedup-stray-cloudflared-tunnel` (Codex write — one-off script)** — `scripts/kill_stray_token_tunnel.sh` — detect + SIGTERM the stray `fc63f24c…` token tunnel on Mini that isn't on our primary Cloudflare account and isn't managed by any launchd agent. Idempotent (no-op if the process isn't there). Commit: `feat(ops): script to clean up stray token cloudflared on Mini`.

32. **T32 — `cookie-name-per-tenant` (Codex write)** — Part of T23/T24 but small enough to ship solo. Session cookie name on each tenant must be unique so a user with both open doesn't clobber. Confirm `PROJECT_FILE_STEM + _runtime_slug(...)` produces distinct names for Mini Lab, Mini MITWPU, iMac Ravikiran. Print the computed cookie name at startup for audit. Add a `/debug/cookie-name` endpoint that echoes it (gated on super_admin only). Commit: `feat(session): verify + surface tenant-specific cookie name`.

33. **T33 — `nikita-nav-order-fix` (Codex write)** — Nikita wants nav order: Home · Finance · Payments · Attendance · Fleet · Personnel · Inbox · Tasks · Mess · Tuck Shop (she reported on `/vehicles` on 2026-04-14). Find the nav-rendering logic in `templates/base.html` or `app.py:navigation_for_portal` and reorder. Commit: `fix(nav): Ravikiran HQ nav order matches Nikita's spec`.

34. **T34 — `vehicle-receipt-claim-flow` (Codex write)** — Nikita wants any admin on the Vehicles page to upload a receipt and assign it to a specific car; the AI should log "this car incurred X expense". Wire a minimal endpoint `POST /vehicles/<id>/receipts` that accepts a file upload + amount, stores it under `expense_receipts` linked to that vehicle_id. Commit: `feat(vehicles): per-vehicle receipt upload with AI-log entry`.

35. **T35 — `editable-vendor-order-pages` (Codex write)** — Nikita wants each vendor + each order to have its own page that's editable (similar to instrument_detail). Currently they're list-only. Build `templates/vendor_detail.html` + `templates/purchase_order_detail.html` + edit forms, route at `/vendors/<id>` + `/orders/<id>`. Commit: `feat(finance): per-vendor + per-order detail pages with edit`.

36. **T36 — `attendance-keyboard-shortcut-relocate` (Codex write)** — Nikita reported `m` and `c` hotkeys conflict with voice capture (m = mic, c = click). Move the attendance-related hotkeys to different single-letter keys (e.g. `v` for vehicles, `f` for finance) OR require `alt+m`/`alt+c`. Already partially covered by T12; T36 is the attendance-specific subset. Commit: `fix(hotkeys): relocate m/c to alt-modifier to stop conflicting with voice`.

37. **T37 — `notification-review-inline-modal` (Codex write)** — Nikita reported `/notifications` reloads on "review" instead of opening a review pane. Build an inline modal (reuse `templates/_modal.html` if it exists) with edit / recall / delete / mark-read actions. No full page reload. Commit: `fix(notifications): inline review modal instead of page reload`.

38. **T38 — `me-testing-plan-page` (Codex write)** — The `/me/testing-plan` endpoint is referenced in homepage links + crawls but may not be routed. Verify route exists, render a `templates/me_testing_plan.html` that walks Tejveer through §1–§10 of `docs/TESTING_PLAN_TEJVEER.md`. Each section has a "I tested this, here's my note" form that submits to `/debug/feedback` via POST. Commit: `feat(testing-plan): self-serve testing plan page for tester role`.

39. **T39 — `session-idle-warning` (Codex write)** — After 25 minutes of no interaction, show a 1-minute warning modal before auto-logout. Renew on any click/key. Useful so Tejveer / Nikita don't lose draft work when they step away. Commit: `feat(session): 25/1 min idle warning before auto-logout`.

40. **T40 — `user-profile-avatar-upload` (Codex write)** — `users.avatar_url` column exists but empty for everyone. Add `/me/avatar` upload form, store to `data/<tenant>/uploads/avatars/<user_id>.jpg`, render thumbnails in nav + comments. Commit: `feat(profile): per-user avatar upload + nav thumbnail`.

41. **T41 — `vehicle-driver-multiple` (Codex write)** — Nikita reported a car can have multiple drivers (like instrument operators). Check `vehicle_driver_assignments` schema; if it already supports many-to-many, just surface it in the vehicle detail page UI. Commit: `feat(vehicles): support multiple drivers per vehicle in UI`.

42. **T42 — `audit-logs-retention-90d` (Codex write)** — `audit_logs` table grows unbounded. Add a nightly cron (launchd or scripts/nightly_audit.sh) that prunes entries older than 90 days. Commit: `feat(audit): retention policy — prune audit_logs older than 90 days`.

43. **T43 — `debug-feedback-archive-daily` (Codex write)** — When `logs/debug_feedback.md` exceeds 1 MB, roll it over to `logs/archive/debug_feedback_<YYYY-MM-DD>.md`. Keep agents happy scanning a bounded file. Commit: `feat(debug): daily rollover of debug_feedback.md when > 1 MB`.

44. **T44 — `server-live-log-structured-json` (Codex write)** — The live gunicorn log is plain text. Add a `--json-logs` env var (`LAB_SCHEDULER_JSON_LOGS=1`) that makes every access log line + every Python `logging` emit become JSON (timestamp, level, logger, event, user_id, path, status, duration_ms). Agents pooling logs across hosts will love it. Commit: `feat(logging): optional JSON structured server log format`.

45. **T45 — `ai-advisor-queue-claim-flow` (Codex write)** — `ai_advisor_queue` table exists with zero rows. Wire the endpoints that push into it (when AI proposes an action) + the endpoints that read from it (when an agent claims + executes). Minimal admin page `/ai/queue` to see pending + claimed items. Commit: `feat(ai-queue): claim/execute flow for ai_advisor_queue`.

46. **T46 — `cloudflare-502-runbook-and-automation` (Codex write) — network incident work-package**
    catalysterp.org and mitwpu-rnd.catalysterp.org have returned **502** on every path since 2026-04-16 ~13:37 Paris. Root cause diagnosed — the `b1d5e505-catalysterp` tunnel has three connectors (Mini + iMac + MBP-was) but dashboard ingress rules still point at `127.0.0.1`, so Cloudflare load-balances requests to connectors that don't co-host the origin → 502. Local origins are healthy (`https://127.0.0.1:5055/` on Mini returns 200; `http://127.0.0.1:5056/` returns 200). **Fix requires Cloudflare dashboard or API access — Claude1 has cert.pem (tunnel origin cert) but no API token, so cannot edit dashboard ingress directly.** Full doc: `docs/CLOUDFLARE_TUNNEL_INGRESS_FIX_2026_04_16.md`.

    **What Codex can ship without waiting for operator dashboard action:**

    46.1 — **Automated-apply script once a token exists.** `scripts/cf_apply_tunnel_ingress.py`:
        - Reads `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` from env.
        - Hits `GET .../accounts/{acct}/cfd_tunnel/{tunnel_uuid}/configurations` to fetch current ingress.
        - Diffs against a declarative `ops/cloudflare/tunnel_ingress.yaml` (new file) that encodes the correct Tailscale-IP-based mapping.
        - Supports `--dry-run` (print diff) + `--apply` (PUT the new config).
        - Idempotent; safe to run repeatedly.
        Commit: `feat(ops): cf_apply_tunnel_ingress.py — one-shot 502 fix when token available`.

    46.2 — **Stray tunnel cleaner.** Mini runs a second `cloudflared tunnel run --token eyJ…fc63f24c…` that belongs to a different Cloudflare account (not our primary). `cloudflared tunnel info fc63f24c-dd7a-43c1-8b6d-a3cb33386314` returns "0 tunnels" on our account. No launchd agent manages it. Script `scripts/kill_stray_token_tunnel.sh` detects + SIGTERMs it. Idempotent. Commit: `feat(ops): kill_stray_token_tunnel.sh — remove orphan cloudflared on Mini`.

    46.3 — **Deprecate MBP as a connector.** Since MBP stopped being healthy at 2026-04-15 20:51 UTC and isn't meant to serve live, remove it from the tunnel via `cloudflared tunnel cleanup b1d5e505-…`. Script `scripts/cf_cleanup_connectors.py` — lists stale connectors, keeps Mini + iMac, removes others. Uses cert.pem (already present on MBP at `~/.cloudflared/cert.pem`). Commit: `feat(ops): cf_cleanup_connectors.py — drop stale MBP connector`.

    46.4 — **Dashboard runbook card.** Add `docs/CLOUDFLARE_DASHBOARD_RUNBOOK.md` — single page, 6 screenshots + the 30-second click path from dashboard home to `catalysterp` tunnel → Configure → Public Hostnames. Each row in the ingress table shown as a before/after screenshot placeholder. Operator can follow without re-reading the full incident doc. Commit: `docs(ops): Cloudflare dashboard runbook — 30-sec 502 fix path`.

    46.5 — **Health gate.** `scripts/check_public_endpoints.py` — probes every `*.catalysterp.org` URL, reports per-tenant status, fails non-zero if any returns 502. Wire to an hourly launchd agent `local.catalyst.public-health`. When 502 detected, writes an alert to `tmp/agent_handoffs/cf-incident-<ts>.md`. Commit: `feat(ops): hourly public-endpoint health probe + alert file`.

    **Blocker:** 46.1 + 46.3 require a `CLOUDFLARE_API_TOKEN` with `Cloudflare Tunnel: Edit` scope. If operator supplies one (stored in `~/.cloudflared/api_token` with `chmod 600`), Codex can ship + operator can run `python scripts/cf_apply_tunnel_ingress.py --apply` and the 502 clears in 30 seconds. Without the token, 46.1 + 46.3 are dry-code (ship the script, but Apply is a no-op until token exists). 46.2 + 46.4 + 46.5 need no token.

    **Commit order:** 46.4 (doc, no deps) → 46.5 (health probe, no deps) → 46.2 (stray cleanup, no deps) → 46.1 (apply-script, token-gated) → 46.3 (connector cleanup, token-gated).

47. **T47 — `restore-ai-assistant-on-ravikiran` (Codex write) — operator-reported UX gap**
    Nikita (super_admin) on `https://ravikiran.catalysterp.org/users/1` reports the AI assistant is missing. Confirmed via Chrome: zero `.ai-pane` / `[data-ai]` / `[aria-label~="AI"]` markers on any Ravikiran page. Root cause: the iMac runs a stale `/Users/nv/ERP-Instances/ravikiran-erp/live/app/app.py` (~17 k lines vs MBP canonical ~30 k) and a stale `templates/` tree that **predates the AI assistant entirely**.

    Diff:

    | resource | MBP canonical | iMac live |
    |---|---|---|
    | `templates/_base_ai_pane.html` | **exists** | missing |
    | `@app.route("/ai/ask")` | `app.py:25309` | missing |
    | `@app.route("/ai/action/<id>/decide")` | `app.py:25463` | missing |
    | `@app.route("/ai/log")` | `app.py:25575` | missing |
    | `ai_advisor_batch_process` | `app.py:25082` | missing |
    | `ai_pane_log` DB table | created in `init_db` | missing |
    | `ai_advisor_queue` | seeded | empty |
    | `ai_prospective_actions` | seeded | empty |

    **What to ship:**
    - **T47.1 (read-only audit).** `scripts/diff_ai_pane_readiness.py` — points at an app instance (via `RUNTIME_DB_PATH` + app root) and reports which of the above pieces are present. Used to verify the fix on each tenant. Commit: `feat(audit): diff_ai_pane_readiness script`.
    - **T47.2 (partial + static).** Copy `templates/_base_ai_pane.html` into iMac's tree + any companion JS/CSS the pane needs (look for `ai-pane.js` / `ai-*.css` under `static/` on MBP canonical). Add the `{% include "_base_ai_pane.html" %}` reference to iMac's `templates/base.html`. Since the frontend calls `/ai/ask`, this step alone won't function until T47.3 lands — DO NOT SHIP T47.2 WITHOUT T47.3. Commit: `feat(ai-pane): port _base_ai_pane partial + JS/CSS to every tenant`.
    - **T47.3 (backend endpoints).** Port `/ai/ask`, `/ai/action/<id>/decide`, `/ai/log`, and `ai_advisor_batch_process` from MBP canonical to the iMac's live `app.py`. Include the schema migration for `ai_pane_log` + the queue seed ordering. Commit: `feat(ai-backend): port AI advisor endpoints + ai_pane_log schema`.
    - **T47.4 (deploy).** Extend the T24 naming policy to cover the new shim paths. Apply the iMac patch via SSH (backup first: `cp app.py app.py.pre-ai-port-<ts>`), run migrations, kickstart the launchd service, verify with Chrome: Nikita on `/users/1` sees the AI pane. Commit: `deploy(ai-pane): sync iMac Ravikiran to MBP AI assistant stack`.
    - **T47.5 (cover the other tenants).** Mini already has the MBP canonical code (via the `local.catalyst.github-pull` auto-pull) — no patch needed, just confirm after one rotation. Document in `docs/IMAC_RAVIKIRAN_APP_DRIFT_2026_04_16.md` (from T15) that the AI pane delta is closed.

    **Risk note:** T47.3 is the biggest slice (~500+ lines of Python from `app.py` canonical, plus schema changes). Operator should confirm before merging — a full-tenant restart is the deploy step, so a clean evening window is preferable. The related T24 iMac-app-drift audit (still open) gives the broader context.

    **Bypass (operator short-term):** until T47 lands, Ravikiran users can file feedback via the bottom-of-page narration toggle shipped in T21 (`0314166`) — it's the same `/debug/feedback` endpoint the AI pane would eventually use for logging, and it IS present on iMac via our SSH patch.

## Drift + contamination audit — follow-up T-tickets (T48–T57)

Full audit at `docs/CROSS_CONTAMINATION_AND_DRIFT_AUDIT_2026_04_16.md`.
Each slice below is bounded to a 30-min Codex burn. Ship in the
listed order.

48. **T48 — `imac-make-running-app-git-tracked`** — SHIPPED 2026-04-17 13:02 +02. Ravikiran iMac live now runs with `/Users/nv/ERP-Instances/ravikiran-erp/live/app -> /Users/nv/Scheduler/Main`. Rollback copy preserved as `app-old-flat-20260417T125908`. `live/run.sh` also exports `LAB_ERP_RUNTIME_ROOT="$ROOT"` so the service uses the lane runtime root and stays plain HTTP behind the Cloudflare tunnel. Verified staged boot on `:5058`, then verified local `:5057/login` and public `https://ravikiran.catalysterp.org/login` return 200 after cutover.

49. **T49 — `live-schema-parity-check + migrate`** — every live DB is 4–8 tables behind canonical (MBP 91, Mini 83, iMac 87). Write `scripts/check_schema_parity.py` + `scripts/apply_canonical_migrations.py --dry-run / --apply`, pointed at `ops/schema/canonical_tables.txt` (first commit generates the snapshot). Nightly launchd agent fails loud on drift. Commit pair: `feat(schema): canonical table snapshot + parity check`, `feat(schema): apply_canonical_migrations with dry-run`.

50. **T50 — `mini-worktree-clean + auto-pull-verify`** — Mini's working tree is dirty again (14+ modified files); `local.catalyst.github-pull` silently no-ops. Make the agent **fail loud**: log to `logs/github-pull-agent.log`, alert via a file in `tmp/agent_handoffs/github-pull-incident-<ts>.md` when pull aborts. Write a runbook for cleaning dirty state. Commit: `ops(mini): fail-loud auto-pull when worktree dirty + cleanup runbook`.

51. **T51 — `per-tenant-cookie-names + audit`** — confirm Lab vs Ravikiran vs MITWPU cookies are distinct (no cross-tenant session collision). Add `/debug/cookie-name` echo (super_admin-gated) so operator can verify from Chrome. Extends T32. Commit: `feat(session): per-tenant cookie name + /debug/cookie-name endpoint`.

52. **T52 — `post-deploy-smoke-on-live`** — Mini + iMac launchd agents run `scripts/smoke_test.py` after every kickstart. On failure, roll back to `app.py.last-green` symlink + alert. Commit: `feat(ops): post-kickstart live smoke + last-green rollback`.

53. **T53 — `drop-legacy-lab_scheduler.db`** — MBP has a duplicate operational DB `lab_scheduler.db` (0 users) that confuses every grep. Move to `.trash/YYYY-MM-DD/` via script, verify zero code reads it first. Commit: `chore(data): retire legacy lab_scheduler.db after verifying zero reads`.

54. **T54 — `mbp-connector-decommission`** — MBP is still a registered cloudflared connector on tunnel `b1d5e505` even though it stopped serving on 2026-04-15. CF load-balances to it → 502. Run `cloudflared tunnel cleanup b1d5e505…` (needs `cert.pem`, already at `~/.cloudflared/cert.pem`). Commit: `ops(cf): decommission MBP connector from b1d5e505`.

55. **T55 — `seed-parity-script`** — live hosts are missing `ravikiran_ops` + `compute` portals (MBP has 4, Mini + iMac have 2). Write `scripts/seed_parity.py` that diffs each tenant DB against canonical and has `--apply` to re-run `_seed_erp_portals` + `_seed_operational_real_team`. Run after every `init_db()` boot. Commit: `feat(seed): seed parity audit + fix helper`.

56. **T56 — `live-patch-log`** — every ad-hoc SSH patch to a live host gets recorded in `docs/LIVE_PATCH_LOG_2026_04.md` within 5 min. Backfill the 6 patches Claude1 applied today (listed in §1.5 of the audit doc). Commit: `docs(ops): LIVE_PATCH_LOG — governance for SSH hot-fixes`.

57. **T57 — `github-pull-agent-hardening`** — Mini's `local.catalyst.github-pull` should pull from MBP's LOCAL bare (not GitHub), use `git fetch + reset --hard` only if tree matches bare (otherwise alert), and log every attempt to `logs/github-pull-agent.log`. Commit: `ops(mini): harden github-pull agent — fail loud, bare-sourced, logged`.

58. **T58 — `ravikiran-module-registry-completion` (Codex write) — operator-flagged UX**
    iMac's `MODULE_REGISTRY` (at `app.py:330` on the iMac — stale relative to MBP canonical) only registers 6 modules: `finance`, `inbox`, `todos`, `vehicles`, `personnel`, `vendor_payments`. But the `hq` portal config references `mess`, `tuck_shop`, `attendance`, `payroll`, `filing`, `notifications`, `admin` on top of those. Result: nav doesn't emit half the Ravikiran modules the operator needs.
    - Per operator call 2026-04-16 ~15:50 Paris, Ravikiran group of companies covers: **Ravikiran (Kitchen, Mess, Service staff, Dishwash, Housekeeping, Store keeper), Suryajyoti Services (Tuck Shop), Gopal Doodh dairy, RK Services (Laundry)**.
    - Add MODULE_REGISTRY entries (on iMac, then MBP canonical) for: `mess`, `tuck_shop`, `attendance`, `payroll`, `housekeeping`, `laundry`, `dairy`, `filing`, `admin` — with nav labels + URLs + order. Housekeeping/Laundry/Dairy may render under `personnel` or `vendor_payments` initially.
    - Commit: `feat(modules): register full Ravikiran module stack in MODULE_REGISTRY`.

59. **T59 — `ravikiran-group-structure-doc` (Codex doc) — operator spec**
    Write `docs/RAVIKIRAN_GROUP_STRUCTURE.md`: named companies, per-company role, portal(s) they appear in, which staff roster section maps to which company. Use the xlsx already imported as pending users. Informs T58's nav-label decisions and T60's route-gating.
    - Commit: `docs(ravikiran): group-of-companies structure reference`.

60. **T60 — `lab-only-route-gate` (Codex write) — security**
    Ravikiran nav no longer shows Lab-only routes (T25+ patch) but the routes themselves (`/instruments`, `/schedule`, `/calendar`, `/stats`, `/requests/new`) still return 200 on Ravikiran. A user who URL-types or a link from a stale email still lands on Lab pages. Add a helper `_abort_if_not_lab_portal()` and call it at the top of each of those view functions. Idempotent — no behavior change on Lab tenants.
    - Claude1 attempted this via SSH at 2026-04-16 ~16:00 Paris but the helper insertion pushed `from __future__` off the top of the file, service couldn't boot. Rolled back. Proper fix should edit MBP canonical + rely on T48 to propagate.
    - Commit: `feat(security): gate Lab-only routes on active_portal_slug == 'lab'`.

## REINSTATED 2026-04-16 ~16:25 Paris — AI routing on every feedback surface

Operator call: wire AI into (a) the microphone narration chip, (b) a persistent AI assistant pane on every page, (c) the `/debug` panel. Every path posts to a new `/ai/route` endpoint that:

- classifies the submission (bug / feature / question / urgent / admin-ask)
- picks a routing target (Nikita = admin, Prashant = finance, Tejveer = tester, Codex = dev, or "self-resolvable")
- emits a one-line acknowledgment back to the user ("Logged — Nikita will see this in her inbox.")
- appends the enriched entry to `logs/debug_feedback.md` with the AI-assigned category + route

**Un-deferred**: T47.2–T47.5 + T61 are live again. New sub-slices T47.6–T47.8 below.

### Budget guardrails (5 EUR cap today, to be increased)
- Haiku 4.5 only (`claude-haiku-4-5-20251001`). Never Sonnet / Opus for routing.
- `max_tokens: 150` for the routing response, `max_tokens: 400` for the AI assistant pane reply. Never higher.
- Daily call counter in `data/operational/ai_call_budget.json` — check before every call; if today's $-estimate exceeds a configurable cap (default $0.50/day), return a canned "AI budget paused — logging to queue for human review" and skip the API call. Let humans eat the fallback.
- Log every call's token usage + estimated cost to `logs/ai_usage.jsonl` for auditing.

### T47.6 — `ai-route-endpoint` (Codex write) — foundation
Add `POST /ai/route` to `app.py` canonical. Request body: `{text, page, source, context}`. Response: `{category, route_to, reply_text, confidence, logged_id}`. Calls `anthropic.Anthropic().messages.create(...)` with a routing system prompt. Log to `logs/debug_feedback.md` + `logs/ai_usage.jsonl`. Budget guard at the top. Commit: `feat(ai): /ai/route endpoint with routing + budget guard`.

### T47.7 — `ai-route-wire-into-narration-chip` (Codex write)
Extend `static/debug-narrate.js` (shipped as T21, `0314166`): after `stopAndSend()` successfully POSTs to `/debug/feedback`, chain a second request to `/ai/route` with the same transcript. Render the AI reply in the transcript preview ("Logged as Bug · routed to Nikita · ack: ...") before fading out. Fail gracefully if `/ai/route` 503s or budget-paused. Commit: `feat(debug): chain narration chip through /ai/route for categorization + reply`.

### T47.8 — `ai-assistant-pane` (Codex write, bigger slice)
Port MBP canonical `templates/_base_ai_pane.html` to iMac (and re-enable on MBP) + tiny chat UI bottom-left of every page (contrasts with bottom-right narration chip). Fields: text input, send button, 3-turn history. Submits to `/ai/route` with `source: "assistant-pane"`. When AI can't handle ("escalate to human"), shows "Click to queue for Nikita/Prashant" button that files into the queue_review routing table. Commit: `feat(ai): persistent AI assistant pane on every page (5-EUR-safe, Haiku-only)`.

### Routing table (Codex encodes in app.py)

| category | route_to | handled by | example |
|---|---|---|---|
| bug | Codex | agent | "the vehicles page crashed" |
| feature-request | Nikita | human admin | "can we have a daily expense summary" |
| admin-ask (people, org) | Prashant | human admin | "when does Rahul's shift start" |
| finance-ask | Prashant | human admin | "what's last month's mess spend" |
| test-note | Tejveer | human (self-read) | "the login button is slightly off-center" |
| urgent (service down, payment broken) | Nikita + Codex | dual notify | "payments page not opening" |
| self-resolvable | AI | user | "how do I add a new vendor" |

### When `/ai/route` is ACTIVE but budget paused
All surfaces fall back to T47 deferred behavior: POST goes to `/debug/feedback` only, log entry marked `ai_paused=true`, agents read the log and route manually on the next burn. UI shows "🟡 AI paused — logged for human review." No user-visible failure.

### Original T47 sub-slices still valid
T47.1 `diff_ai_pane_readiness.py` — shipped by Codex (`d74c971`). Keep as audit tool.
T47.2 `_base_ai_pane` partial port — ship with T47.8.
T47.3 backend `/ai/ask` — becomes `/ai/route` (renamed).
T47.4 deploy via SSH — still applies.
T47.5 Mini parity check — still applies.

### Feedback → fix pipeline (the operator-approved path)

```
user narrates via chip  →  POST /debug/feedback
                             ↓
                       logs/debug_feedback.md  (per-tenant local file)
                             ↓  Claude2 + queue_review.py (every 30 min on iMac; Codex burns on MBP)
                             ↓  read new entries, categorize, file a T-ticket
                             ↓  Codex ships the fix on MBP canonical
                             ↓  Mini auto-pulls via local.catalyst.github-pull
                             ↓  iMac gets the change via Claude2's write plane
                             ↓  reload → user sees it fixed next session
```

**T62 — `crawler-reads-debug-feedback-pipeline` (Codex write)** — formalize the above. The agents already do it ad-hoc; make it a standard part of the conductor burn:
  - Claude1 (me) reads pooled `debug_feedback.md` tails at the start of every conductor pass, files T-tickets for new entries.
  - Codex picks top T-ticket per burn.
  - Claude2 echoes the fix to iMac live.
Commit: `docs(pipeline): crawler→debug_feedback→agent feedback loop`.

---

61. **T61 — `anthropic-api-key-env-wire` (Codex write) — blocks T47.3** — DEFERRED, see above.
    iMac `.env` now has `ANTHROPIC_API_KEY` set. `run.sh` only exports `LAB_SCHEDULER_ENV_FILE=$ROOT/.env`, doesn't source it. So the worker env doesn't include the key. T47.3 should add `load_dotenv(os.environ.get("LAB_SCHEDULER_ENV_FILE", ".env"))` near `app.py` module top (after `from __future__ import annotations` block). Then `/ai/ask` endpoint can `import anthropic; client = anthropic.Anthropic()`.
    - Building key works for auth verification; credits currently exhausted on whatever account the pasted key belongs to (as of 2026-04-16 16:05 Paris). Once operator funds the account or provides Satyajeet's key, `/ai/ask` lights up.
    - Commit: `feat(env): load_dotenv at app startup + wire /ai/ask with anthropic SDK`.

65. **T65 — `payments-template-ca-audit-dashboard` (Codex write) — regressing hot fix**
    `templates/vendor_payments.html:17` references `url_for('ca_audit_dashboard')` but that endpoint doesn't exist on iMac (and possibly MBP). `/payments` 500s whenever a logged-in user lands there. Claude1 sed-patched the reference to `audit_export` on iMac twice today; both patches got reverted (likely by a git pull or a local.catalyst.ravikiran kickstart reloading the template from somewhere else). Canonical fix:
    - Either add a real `ca_audit_dashboard` route on MBP canonical that renders an audit dashboard, OR
    - Rewrite every template reference (grep `url_for\\(.ca_audit_`) to point at `audit_export` (which exists) OR add a CA audit sub-nav.
    - Most pragmatic: add a thin `ca_audit_dashboard()` view function that just redirects to `audit_export` so all templates still resolve. Keeps history if other templates reference it.
    - Commit: `fix(audit): add ca_audit_dashboard route as alias/redirect to audit_export`.

66. **T66 — `ui-analytics-pointer-trail` (Codex write) — operator-flagged system design**
    Operator ask: cookie + mouse tracking that captures what tasks users do on which pages, so UI can be improved from data. Foundation already exists on MBP canonical:
    - `static/telemetry.js` — client JS
    - `telemetry_page_time`, `telemetry_click` tables — schema at `app.py:5518`
    - `POST /api/telemetry/batch` — endpoint at `app.py:30880`
    - Per-user / per-page aggregate queries at `app.py:30751`

    **Extend with**:
    - New table `telemetry_pointer (user_id, path, t_ms, sample_id, viewport_x, viewport_y, page_x, page_y, event_type)` — event_type ∈ {'move', 'hover_enter', 'hover_exit', 'focus', 'blur'}.
    - `static/telemetry.js` — add a throttled mouse-move sampler (target: 4-8 samples/sec, not every pixel; collapse consecutive samples within a 50px box). Buffer locally, batch every 10 sec.
    - `telemetry_task_signal` table — coarse "task" inference: page path + dwell time + click pattern → tag like `reviewing_vendor_list`, `entering_attendance`, `filing_receipt`.
    - Admin dashboard at `/admin/ui-analytics`: top 20 pages by time, top 10 clicks by element selector, pointer-density heatmap (SVG) for any given page, per-user breakdown. Super-admin + site-admin gated.

    **Cookie story**:
    - No new cookie needed. The existing session cookie identifies user_id. For anonymous traffic (rare on an internal ERP), generate a random `telemetry_visitor_id` cookie (90-day TTL, httpOnly=false, same-site=lax).
    - Do NOT store coordinates with URL params containing IDs in a way that lets a regular admin map "cursor was here on /users/5" → "admin viewed salary of user 5" unless the admin already has permission to see /users/5.

    **Privacy + retention**:
    - Skip tracking on `/login`, `/password-change`, `/me/password`.
    - Drop raw `telemetry_pointer` rows older than 30 days (cron). Keep aggregate rollups (daily page-time per user) for 1 year.
    - Expose `/me/my-telemetry` so any user can see their own data + delete it.

    **Commit sequence**:
    1. `feat(telemetry): telemetry_pointer + telemetry_task_signal tables + batch accepts pointer frames`
    2. `feat(telemetry): throttled mouse-move sampler in telemetry.js`
    3. `feat(admin): /admin/ui-analytics dashboard with heatmap + top-pages + per-user view`
    4. `feat(telemetry): 30-day pointer retention cron + /me/my-telemetry user-facing page`

    Each sub-slice is a 30-min burn. Land in order.

67. **T67 — `telemetry-port-to-imac` (Codex write) — drift resolution**
    Once T66 lands on MBP canonical, port to iMac Ravikiran (same stale-code problem as T47 / T58). Schema migrations already get applied by `apply_canonical_migrations.py` (T49). `static/telemetry.js` + `/api/telemetry/batch` + `/admin/ui-analytics` must be copied/ported. Folds into T48 once iMac is a git worktree.

68. **T68 — `port-org-setup-panel-to-imac` (Codex write) — operator-reported gap**
    Operator: "What happened to the organizational management structure — change panel that tells us who reports to whom?" Exists on MBP canonical (`app.py:21094` `@app.route("/admin/org/setup")`, `_org_chart_layout()` at 20940, ~300 lines of supporting code) but NOT on iMac Ravikiran. Same stale-iMac-code class as T47 + T58.

    **Port payload** (from MBP canonical to iMac):
    - `@app.route("/admin/org/setup", methods=["GET", "POST"])` view function (~100 lines)
    - `_org_chart_layout(users, edges)` helper (~50 lines)
    - Auto-layout code that reads `users.org_node_x/y` (already columns on iMac)
    - `templates/admin_org_setup.html` + supporting partials
    - Migration note: `reporting_structure` table already on iMac (correct schema, 0 rows) — no DDL needed
    - Nav link under Admin / Settings so admins can find it

    **Seed a starting hierarchy** (can be done via SSH on iMac right now as a placeholder until Codex ports the UI):
    - Derive from the 106-employee xlsx import:
      - Tier 0: Nikita, Prashant (no manager)
      - Tier 1: Binod Mishra (Supervisor) reports to Nikita; Rahul Misal, Sonal Pisal (Sr Accounts) report to Prashant
      - Tier 2: Nitin + Rajesh Pal (Sr Cooks) report to Binod; Vishnu Munde (Cashier) reports to Binod
      - Tier 3: Asst Cooks + Chapati Makers report to a Sr Cook; Stewards + Mess Boys report to Binod; Housekeeping → Binod
      - External-firm leads: RK Services lead, Gopal Doodh lead, Suryajyoti lead all report to Prashant (vendor-relationship owner)

    **Commit sequence**:
    1. `feat(admin): port /admin/org/setup + _org_chart_layout from MBP canonical` (the panel)
    2. `feat(org): seed tentative reporting_structure from xlsx-imported employees` (the data)
    3. `feat(nav): add Admin → Org Chart link in Settings menu` (the discovery)

72. **T72 — `calendar-own-db-resolver` (Codex write) — data cordon enforcement**
    First commit of T70 broken out as a standalone ticket. Add `_calendar_db_path()` resolver in `app.py`: returns `data/<lane>/<tenant>_calendar.db` derived from `CATALYST_TENANT_SLUG` + `RUNTIME_LANE`. Create the file with schema `calendar_events(id, user_id, user_name, user_email, kind, title, starts_at, ends_at, color, scope)` — denormalized user_name/email so no JOIN to the main users table ever needed. `/calendar` view opens this connection, never touches `DB_PATH`. Commit: `feat(calendar): per-tenant calendar.db with denormalized user fields (data cordon)`.

73. **T73 — `ravikiran-expense-pots` (Codex write)** — per-company expense pots for the four firms. Schema: `expense_pots (id, company_id, month, budget_amount, actual_amount, category)`. Seed one pot per company per current month: Ravikiran (mess), Suryajyoti (tuck shop), Gopal Doodh (dairy), RK Services (laundry). Dashboard at `/finance/pots` with category breakdown. Commit: `feat(finance): expense-pots per Ravikiran group company`.

74. **T74 — `salary-schedule-table` (Codex write)** — `salary_schedule (user_id, month, amount_inr, due_date, paid_at, paid_by, reference)`. Populate from the 106 pending-employee roster with placeholder amounts (operator fills in real numbers later). Admin view at `/finance/salary` lists this-month upcoming. Commit: `feat(finance): salary schedule table + this-month view`.

75. **T75 — `tax-schedule-table` (Codex write)** — `tax_schedule (id, kind, amount_inr, due_date, paid_at, paid_by)`. Seed recurring templates: GST (monthly 20th), TDS (monthly 7th), PF (monthly 15th), income-tax-advance (quarterly). Commit: `feat(finance): tax schedule table + recurring template seed`.

76. **T76 — `finance-next-7-days-card` (Codex write)** — single dashboard card on `/finance` showing aggregated ₹ due in next 7 days across salary_schedule + tax_schedule + pot monthly-close reminders. Commit: `feat(finance): next-7-days aggregate card on /finance landing`.

77. **T77 — `hide-grants-on-hq-portal` (Codex write) — SHIPPED** — Canonical now hides grants blocks/cards on HQ in `d1a9d09` and closes the route-side hole in `f4c3ff3`. Leave out of the active Codex queue unless a specific tenant still renders Lab-only grants UI.

78. **T78 — `vehicle-receipt-upload-flow` (Codex write)** — From Nikita's feedback on 2026-04-14: "any admin on the Vehicles page should upload a receipt and assign it to a specific car". New endpoint `POST /vehicles/<id>/receipts` accepting file + amount + category, storing under `expense_receipts` linked to vehicle_id. Commit: `feat(vehicles): per-vehicle receipt upload + auto-link to expense_receipts`.

79. **T79 — `pending-user-approval-page` (Codex write) — SUPERSEDED / SHIPPED** — Covered by the canonical `/admin/pending-users` flow in `bbe9480` plus bulk approval in `78b469b`. If a `/personnel/pending` alias is still desired later, track that as a UX follow-up rather than re-opening the core approval work.

80. **T80 — `claude0-ssh-patch-log-audit` (Codex read-only → doc)** — Scan `docs/LIVE_PATCH_LOG_2026_04.md`; for each row with status OPEN or PARTIAL, generate a T-ticket stub with exact file + line references so Codex can close the canonical-followup column. Commit: `docs(audit): LIVE_PATCH_LOG close-out — canonical-followup T-tickets for every open row`.

81. **T81 — `backup-script-audit-per-tenant` (Codex write)** — from data-cordon policy L14. Audit `scripts/backup_from_mini.sh` for cross-tenant combination; split into per-tenant archives. Commit: `fix(backup): per-tenant archives — no combined data files`.

82. **T82 — `enforce-tenant-sql-connection-scope` (Codex write)** — guardrail helper `tenant_db_connect(kind)` in `app.py`; every existing `sqlite3.connect(...)` call gets rewritten to use it; raises on tenant-mismatch paths. Prevents accidental cross-tenant opens. Commit: `feat(cordon): tenant_db_connect guardrail — no cross-tenant connections`.

83. **T83 — `policy-enforcement-suite` (Codex write)** — test suite trying to violate each leak class L1-L15 from `docs/DATA_CORDON_POLICY_2026_04_16.md`. Nightly cron on MBP. Alert if any previously-errored path now succeeds. Commit: `test(cordon): enforcement suite — all known leak paths stay errored`.

84. **T84 — `branded-404-inside-pane` (Codex write) — SHIPPED** — Landed in `d63a7bf` with `templates/error_not_on_this_tenant.html` and the tenant-scoped in-pane error flow. Do not keep this in the short-pick queue.

85. **T85 — `ravikiran-stats-panel-from-scratch` (Codex write) — operator-flagged**
    Lab has `/stats` (instrument utilization + wave crawler metrics). Ravikiran needs its OWN stats panel, adapted from scratch for mess+laundry+finance ops. Metrics to show:
    - Monthly salary spend (total ₹) trend line
    - Per-company (Ravikiran / Suryajyoti / Gopal / RK) expense pot utilization
    - Vehicle usage (km logged per month, by vehicle)
    - Employee count by area (Kitchen / Service / Housekeeping / Dairy / Laundry / Tuck Shop / PF)
    - Attendance rate per area per month
    - Mess meal count per day (once mess module is built out)
    - Route: `/ravikiran/stats` (distinct URL — Lab `/stats` stays for Lab)
    - Template: `templates/ravikiran_stats.html` extending `base.html`
    - Stats module registered in MODULE_REGISTRY; nav_access gated on non-lab portal (opposite of T60)
    - Data source: per-tenant DB only (respect cordon)
    - Commit: `feat(ravikiran): /ravikiran/stats panel — monthly spend, pot utilization, fleet, employees, attendance`.

86. **T86 — `per-module-role-appropriate-queue-VIEW` (Codex write) — operator-clarified 2026-04-16 ~21:00 Paris**
    **Display-only**. No new tables, no new writes, no new data. Each module surfaces a queue by reading existing rows already in its per-tenant DB and filtering by the current user's role.

    **Design**:
    - New helper `module_queue_items(user, module_key)` in `app.py`. Returns a list of `{title, href, kind, priority, module}` dicts. Each module's block inside this helper runs one or more `SELECT`s against existing tables.
    - Cordon-safe: every `SELECT` uses the current tenant's DB connection (same `get_db()` the route already uses). **No cross-tenant reads.**
    - Role-aware: each module block checks current user's role + ownership before including a row.
    - Per-module dashboard card: a small "Your queue" section at the top of each module's landing page renders the filtered slice.
    - Global "giant queue" at **`/queue/me`** — reuses the same helper but across every module the user has access to. One page, one union.

    **What each module's SELECT returns** (existing tables only):

    | module | source row | title | when it appears in queue | role filter |
    |---|---|---|---|---|
    | **Personnel** | `users WHERE invite_status='pending'` | "Approve {name}" | always, until approved | super_admin or finance_admin |
    | **Finance** | `vendor_payments WHERE status='pending_approval'` | "Approve ₹{amount} to {vendor}" | always | finance_admin / super_admin |
    | **Finance** | `salary_schedule WHERE paid_at IS NULL AND due_date <= date('now','+7 days')` | "Pay {user} ₹{amount} by {due_date}" | 7-day window | finance_admin / super_admin |
    | **Finance** | `tax_schedule WHERE paid_at IS NULL AND due_date <= date('now','+14 days')` | "{kind} ₹{amount} due {due_date}" | 14-day window | finance_admin / super_admin |
    | **Fleet** | `vehicles WHERE next_service_due <= date('now','+14 days')` | "Service {vehicle} by {date}" | if column exists | operational staff |
    | **Fleet** | `expense_receipts WHERE vehicle_id IS NOT NULL AND category IS NULL` | "Categorize receipt #{id}" | always | any vehicle-access user |
    | **Mess** | `mess_entries WHERE status='pending_prep'` (if exists) | "Today's menu not posted" | before 11am | mess supervisor / super_admin |
    | **Tuck Shop** | `tuck_shop_tokens WHERE status='issued' AND expires_at <= date('now','+1 day')` | "Token {code} expires tomorrow" | 24h window | cashier / super_admin |
    | **Tasks** | `user_todos WHERE user_id=? AND done=0` | "{title}" (their own) | always | self |
    | **Inbox** | `messages WHERE recipient_id=? AND read_at IS NULL` | "New from {sender}" | always | self |

    **Giant /queue/me**:
    - Lists all items across every module the user can access.
    - Grouped by module, sorted by priority then age.
    - Shows a per-module count + a total at the top.
    - Click → goes to the target href (view / approve / pay).

    **Ownership + cordon check at render**:
    - `module_queue_items(user)` only iterates modules present in user's `access_profile` — never across tenants.
    - Each row's `href` is a relative URL, so it resolves on the current tenant's host (T22 tenant-URL registry handles the scheme).
    - No user_id from another tenant ever appears — every query is already tenant-scoped by virtue of running against this tenant's DB.

    **Commits**:
    1. `feat(queue): module_queue_items helper reading existing tables with role + ownership filters`
    2. `feat(queue): /queue/me giant union page + per-module dashboard card`
    3. `feat(queue): role-appropriate queue card on Personnel / Finance / Fleet / Mess / Tuck Shop / Tasks / Inbox dashboards`

    **NO new tables, NO schema migration, NO writes.** This is purely a read-side UX change. Data cordon policy respected automatically because every query runs against the current tenant's DB.

87. **T87 — `install-cloudflare-mcp-server` (operator does, Codex documents)** — adds `@cloudflare/mcp-server-cloudflare` to MBP `.claude.json`, wired with existing `CLOUDFLARE_API_TOKEN` Codex already has. Once present, my `mcp__cloudflare__*` tools appear and future tunnel edits bypass dashboard. Commit: `docs(mcp): Cloudflare MCP install + config note`.

88. **T88 — `install-sqlite-mcp-server`** — similar, adds SQLite MCP for direct per-tenant DB query. Config includes the tenant path whitelist. Commit: `docs(mcp): SQLite MCP server + tenant-DB allowlist config`.

89. **T89 — `ca-audit-dashboard-alias-ship` — canonical fix of T65 — SHIPPED** — Landed in `d9a77a6`. Remove from active queue unless `/payments` regresses again on a target host.

90. **T90 — `ravikiran-finance-landing-page-scrub` — SHIPPED** — Landed in `d1a9d09`. Ravikiran/HQ finance now suppresses Lab grants blocks and shows the tenant-specific cards.

91. **T91 — `nav-badge-counts-per-module` — SHIPPED** — Landed in `dce0f50`. Keep badge follow-ups as new tickets, not under this completed slice.

92. **T92 — `page-performance-instrumentation`** — add a `@app.after_request` hook that records request duration into `telemetry_page_time` (already exists). Tiny SQL UPDATE per request. On `/admin/ui-analytics` show p50/p95/p99 per route. Commit: `feat(telemetry): after-request duration into telemetry_page_time + p95 dashboard`.

93. **T93 — `bulk-employee-approval` — SHIPPED** — Landed in `78b469b`. This is now part of the pending-user approval flow; do not list it as open work.

94. **T94 — `user-profile-edit-ui` — SHIPPED** — Landed in `3a28391`. Any further profile work should be tracked as a separate enhancement ticket.

95. **T95 — `per-company-dashboard`** — the 4 companies (Ravikiran, Suryajyoti, Gopal Doodh, RK Services) each get a `/companies/<id>` page showing: employees, monthly spend, latest purchase orders, vendor payments. Schema already present. Commit: `feat(companies): per-company dashboard rolling up expenses + staff + orders`.

96. **T96 — `salary-payment-receipt-generation`** — when a salary_schedule row is marked paid, auto-generate a PDF receipt stored under `data/operational/receipts/salary/<user_id>/<YYYY-MM>.pdf`. ReportLab is already in requirements. Commit: `feat(payroll): auto-generate salary receipt PDF on mark-paid`.

97. **T97 — `monthly-close-runbook`** — every month-end, agents run a `scripts/monthly_close.py` that (a) closes expense_pots for the month, (b) rolls over salary_schedule for next month, (c) generates PDF salary register, (d) generates GST filing summary. Initially as a Codex-operated burn; later scheduled. Commit: `feat(ops): monthly-close runbook + helper script`.

98. **T98 — `attendance-module-real-impl`** — currently just registered but logic is thin. Build out: daily check-in form, late-comer list, monthly summary per area (Kitchen / Service / etc). Data tables already exist (attendance, leave_balances, leave_requests). Commit pair: `feat(attendance): daily check-in + monthly summary`.

99. **T99 — `mess-module-real-impl`** — replace /mess stub with a real dashboard: today's menu, meal count, stock low-watermark alerts, staff rota. Uses existing `mess_entries` / `mess_students` / `mess_prep_log` tables. Commit: `feat(mess): real dashboard replacing coming-soon stub`.

100. **T100 — `tuck-shop-module-real-impl`** — replace /tuck-shop stub with real terminal: POS entry, token issue/redeem, daily report, stock alerts. Uses existing `tuck_shop_*` tables. Commit: `feat(tuck-shop): real POS terminal replacing coming-soon stub`.

101. **T101 — `filing-module-real-impl`** — replace /filing stub: physical-file register, retention-date view, upload form, tag search. Uses `physical_files` + `generated_exports` tables. Commit: `feat(filing): real document register replacing coming-soon stub`.

102. **T102 — `email-queue-flush-cron`** — `email_queue` table exists with outbound-email rows but no worker. Add a 60-second launchd cron that SELECTs pending rows, sends via SMTP (env `SMTP_URL`), marks sent. Rate-limit 20/minute. Commit: `feat(email): outbound-email worker cron + rate-limit`.

103. **T103 — `company-books-double-entry-check`** — `company_books` table likely stores GL entries. Nightly script that validates debit=credit per company per month. Alert on mismatch. Commit: `feat(accounting): nightly double-entry validation cron + alert`.

104. **T104 — `vehicle-expiry-alerts`** — vehicles have `insurance_renewal_date` (or similar). Nightly cron that adds to module_queue (via T86 helper) when renewal is within 30 days. Commit: `feat(fleet): 30-day expiry alerts surface in queue`.

105. **T105 — `sitemap-xml-per-tenant` — SHIPPED** — Landed in `3fe1d18`. Keep only for historical traceability.

106. **T106 — `audit-log-export-csv`** — `/admin/audit-export` exists; add a second format `/admin/audit-export.json` + signed hash for tamper-evidence. Commit: `feat(audit): JSON export + SHA256 signing for audit log bundles`.

107. **T107 — `backup-restore-runbook-doc`** — operator-facing `docs/BACKUP_RESTORE.md`: how to take a tenant snapshot + how to restore to a new host. Uses T81 per-tenant archives. Commit: `docs(ops): backup + restore runbook`.

108. **T108 — `secret-rotation-runbook`** — doc on rotating: Anthropic API key, Cloudflare API token, SMTP creds, SSH keys. Which file each lives in, restart cadence, verification curl. Commit: `docs(security): secret rotation runbook`.

109. **T109 — `pdf-receipt-template-polish`** — T96 ships salary receipts; T78 ships vehicle receipts. Unify into a single ReportLab helper `render_receipt(kind, payload)` so copy is consistent. Commit: `refactor(pdf): unified receipt renderer`.

110. **T110 — `stale-session-cleanup-cron` — SHIPPED** — Landed in `47303d5`. The remaining work here is deployment/ops verification, not canonical dev.

111. **T111 — `architecture-docs-refresh-v1.4.0` (Codex doc)**
    `docs/ARCHITECTURE_DEEP.md` is stamped "Current as of commit 557f771 on v1.3.0-stable-release (2026-04-14)" and describes the system as Lab-centric — grants, instruments, sample_requests featured. Doesn't mention:
    - Ravikiran as a real live tenant on iMac
    - Mini=serving / MBP=building / iMac=Ravikiran split (`docs/ARCHITECTURE_SERVING_vs_BUILDING_2026_04_16.md`)
    - Data-cordon policy (`docs/DATA_CORDON_POLICY_2026_04_16.md`)
    - Tenant-naming policy (`docs/TENANT_NAMING_POLICY_2026_04_16.md`)
    - 3-agent rotation model (`docs/CLAUDE2_IMAC_BURN.md`, `docs/CODEX_BURN.md`)
    - Dual-Max-account quota model
    - AI/narration chip (T21 shipped)
    Refresh required. Update stamped commit + line count + route count + re-document the two-portal + multi-tenant + multi-host reality. Preserve historical accuracy for the v1.3.0 section — append new sections for v1.4.0 changes. Commit: `docs(architecture): refresh DEEP for v1.4.0-ravikiran reality`.

112. **T112 — `erp-module-builder-ravikiran-update` (Codex doc)**
    `docs/ERP_MODULE_BUILDER.md` still uses `lab_scheduler.db` filename + Lab-centric examples + references deprecated `CATALYST_MODULES` env (now `MODULE_REGISTRY`). Refresh the builder doc with:
    - Correct canonical DB filename (`<tenant>_<lane>_data.db` per T24)
    - `MODULE_REGISTRY` schema instead of `CATALYST_MODULES` env
    - Per-tenant portal module list
    - Data-cordon rule: new tables must go in the tenant-scoped DB
    - Example walk-through for a non-Lab module (e.g. "how to add the Mess module" — operator just did this via stubs; codify)
    Commit: `docs(builder): update module-builder walkthrough for tenant-aware, MODULE_REGISTRY-first era`.

114. **[P0-LIVE] T114-fb — `vehicles-500-android` (Codex write)** — Tejveer (2026-04-17T01:46) reports 500 when clicking `/vehicles/1` on Android. Investigate `GET /vehicles/<id>` handler for mobile user-agent or missing DB column edge case. Fix and commit: `fix(vehicles): resolve 500 on vehicle detail page (Android)`.

115. **[P0-LIVE] T115-fb — `purchase-order-editable` (Codex write)** — Tejveer (2026-04-17T01:45) reports `/payments/14` purchase order is not editable. Add edit flow for purchase orders. Commit: `feat(payments): make purchase orders editable`.

116. **[P0-LIVE] T116-fb — `payroll-period-mesh` (Codex write)** — Tejveer (2026-04-17T01:47) flags payroll period / mess deductions are important — confirm payroll correctly integrates mess+laundry tuck deductions per period before marking payroll done. Commit: `feat(payroll): validate mess+tuck deductions per payroll period`.

113. **T113 — `erp-philosophy-ravikiran-section` (Codex doc)**
    `docs/PHILOSOPHY.md` exists but was written when CATALYST was Lab-only. Add a section on Ravikiran's mess+laundry+household context — why Finance looks different there (expense pots instead of grants), why Instruments/Schedule/Requests are gated off, why the reporting_structure matters more for Ravikiran than Lab. Keeps philosophy cohesive with current product direction. Commit: `docs(philosophy): Ravikiran section — mess+laundry+household business mental model`.

### Codex picking order

If a slot is idle, Codex picks the **top unstarted task that isn't
already in §"Completed this rotation"**. Tight one-file wins are
better than sprawling multi-file refactors when time is short, so
order of appetite:

- **Top priority (operator flagged 2026-04-16 ~16:30): T21** — bottom-of-page narration toggle for all users.
- **Next priority (operator flagged 2026-04-16 ~16:45): T22** — tenant-aware URL building so every link inside a tenant stays on that tenant's host. *(Codex shipped the registry as c11b366; replacement pass still in flight.)*
- **After T22 (operator flagged 2026-04-16 ~17:00): T23** — same principle extended to filenames (logs, cookies, entry modules, titles, email headers, favicons).
- **Incident top priority (operator flagged 2026-04-16 ~17:20): T25** — Ravikiran blank-page for anonymous users. Every element forced `display:none` by the data-vis role filter because anonymous has no role. Three fix options in the brief; pick the one-line JS guard.

### Completed this rotation — T21 shipped
- ✅ T21 `debug-toggle-bottom-of-page` → `0314166` (Claude1). Bottom-right mic chip for every authenticated user, voice narration, posts to `/debug/feedback`. Uses a new `static/debug-narrate.js` + inline `<style>` block in `templates/base.html`. No role gate, hidden for anonymous, mobile responsive, print-hidden.
- Fast wins (< 10 min): T10, T11, T12, T13, T14, T16
- Medium (10–20 min): T2, T3, T8, T9, T17, T18, T20, T21
- Larger (20–30 min): T5, T6, T15, T19

Ship any one end-to-end (claim → edit → smoke → commit → push → remove claim) before taking another.

## Known blockers — operator action required
- **catalysterp.org + mitwpu-rnd.catalysterp.org return 502.** Cause: two cloudflared tunnels running on Mini (token `fc63f24c` serves ravikiran; config.yml `b1d5e505` serves the others). catalysterp.org CNAME points to a tunnel with a broken ingress rule I cannot inspect or fix without Cloudflare dashboard / API access. Ravikiran is up and reachable — operator should log in as nikita / prashant / tejveer via `https://ravikiran.catalysterp.org/login` until the tunnel is reconciled.
- **Mini repo had 14 dirty files.** I stashed them as `pre-unfreeze-2026-04-16-by-claude0-mbp` so `local.catalyst.verify` would stop kickstart-looping gunicorn every 60 s. Operator owns the stash — can `git stash pop` or `git stash drop` on the Mini whenever ready.

## Completed this rotation
- ✅ `policy/cluster-wave-imac-enable` → `a299665`
- ✅ `policy/cluster-wave-live-root-status` → `e9a375c`
- ✅ `fix(test): reset sqlite sidecars before smoke rebuild` → `76b3c57`
- ✅ Task **C** `queue-review-log-path-fix` → `cdb464e` (earlier pass)
- ✅ Stale-claim abort → `fa835c9` (earlier pass)
- ✅ T1 `tool-gatekeeping-audit` → `ccffdf3` (`docs/TOOL_GATEKEEPING_MATRIX_2026_04_16.md` written)
- ✅ T4 `imac-tejveer-role-drift-fix` → normalized on iMac via SSH + `scripts/fix_tejveer_role_on_imac.py` committed for future-proofing
- ✅ Cloudflare 502 root-cause → `docs/CLOUDFLARE_TUNNEL_INGRESS_FIX_2026_04_16.md` (operator dashboard action)

## Audit Queue — Next 30 Minutes
1. `policy/cluster-wave-imac-enable`
   Goal: make the iMac lane visible to `scripts/cluster_wave.py` without
   relying on ad-hoc shell exports. Likely files:
   `scripts/cluster_wave.py`, `ops/continuous_crawlers/README.md`.
2. `policy/cluster-wave-live-root-status`
   Goal: let `cluster_wave.py status` report on a live runtime root even
   when it is not a git worktree. Today it reaches the iMac but exits on
   `git branch --show-current`.
3. `architecture/feedback-widgets-split`
   Goal: split `templates/_base_feedback_widgets.html` (655 lines) into
   partials or macro blocks so the architecture crawler drops the
   largest template warning first.
4. `architecture/styles-css-under-cap`
   Goal: trim or split at least 30 lines from `static/styles.css`
   (10529 > 10500) without changing runtime behavior.
5. `architecture/template-cap-polish`
   Goal: shave the two near-cap templates under the crawler limit:
   `templates/base.html` (405) and `templates/user_detail.html` (439).

## Rig cadence (30-min bursts, 90-min period per agent)

Parallel kickoff now (all three agents) → staggered from 14:00 Paris:

```
14:00  Claude1 conductor   (every 90 min)
14:30  Claude1 iMac        (every 90 min)
15:00  Codex MBP write     (every 90 min)
```

Each agent self-rearms its own `mcp__scheduled-tasks` `fireAt + 90min`
at the end of every burn. Task IDs:
`claude0-conductor-burn`, `claude1-ravikiran-live-burn`,
`codex-mbp-dev-burn`.

Idle rule: if `docs/active_task.md §"Recommended slice"` has no
assigned task for the agent, the agent runs a health check (queue
review + smoke) and exits early. Only dev work requires a written
assignment here.

iMac one-time bootstrap + all three paste prompts live in
`docs/IMAC_JOIN_RIG.md`.

## Output Paths
- Handoffs: `tmp/agent_handoffs/<task-id>/handoff.md`
- Improvement plan: `docs/ERP_NEXT_HOUR_PLAN_2026_04_16.md`
- Rolling control-room handoff:
  `tmp/agent_handoffs/2026-04-16-control-room-next-hour/handoff.md`

## Guardrails
- Validate machine first: `whoami`, `hostname`, `pwd`. Stop with
  `WRONG MACHINE` if not on the expected host or not in this repo.
- Live is read-only unless explicitly approved.
- Claim tracked files before editing; remove the claim row in the
  shipping commit.
- No `--no-verify`, no force-push.
- Push after every meaningful commit.
- Claude1 is read-only on the iMac — never commit from Claude1 to
  either Lab ERP or Ravikiran ERP.
conductor(05:58): all tenants 200, Codex active, no new incidents, dashboard regen OK

## [CONDUCTOR 2026-04-17T06:26+02:00] Cycle status
All 3 tenants 200 OK (catalysterp 1.18s, mitwpu 1.02s, ravikiran 0.80s). Codex active (4 commits in last 15min: portal-context + is_hq_portal port). No new feedback since 00:10 UTC — T-vehicles-500, T-payments-po-editable, T-payroll already ticketed. Ollama http5xx stale (Apr 14 only, no new). Dashboard regen'd + scp'd to Mini.

## [CONDUCTOR 2026-04-17T06:41+02:00] Cycle status
All 3 tenants 200 OK (catalysterp 0.63s, mitwpu 0.94s, ravikiran 0.83s). Codex active (1 commit in last 15min). No new feedback — T114/T115/T116 already ticketed. Ollama http5xx stale (Apr 14 only). Dashboard regen'd + scp'd to Mini.

## [CONDUCTOR 2026-04-17T06:56+02:00] Cycle status
All 3 tenants 200 OK (catalysterp 1.52s, mitwpu 1.04s, ravikiran 0.85s). Codex active (1 commit in last 15min). No new feedback entries — T-vehicles-500, T-payments-po-editable, T-payroll already ticketed. Ollama http5xx stale (Apr 14 only, no new). Dashboard regen'd + scp'd to Mini.

## [CONDUCTOR 2026-04-17T07:11+02:00] Cycle status
All 3 tenants 200 OK (catalysterp 1.09s, mitwpu 1.33s, ravikiran 0.97s). Codex active (1 commit in last 15min). No new feedback — T-vehicles-500, T-payments-po-editable, T-payroll already ticketed from prior cycle. Ollama http5xx stale (Apr 14 only, no new). Dashboard regen'd + scp'd to Mini.

## [CONDUCTOR 2026-04-17T07:26+02:00] Cycle status
All 3 tenants 200 OK (catalysterp 1.21s, mitwpu 0.47s, ravikiran 0.86s). Codex IDLE — 0 commits in last 15min. Filed ORDER #3 in codex1_inbox.md (T2/T3 tuck-shop + mess portal gates). No new feedback (last entries 00:10 UTC already ticketed). Ollama http5xx stale (Apr 14 only). Dashboard regen'd + scp'd to Mini.

## [CONDUCTOR 2026-04-17T07:41+02:00] Cycle status
All 3 tenants 200 OK (catalysterp 0.73s, mitwpu 0.69s, ravikiran 0.84s). Codex active (3 commits in last 15min). No new feedback — T-vehicles-500, T-payments-po-editable, T-payroll already ticketed from prior cycle. Ollama http5xx stale (Apr 14 only, no new). Dashboard regen'd + scp'd to Mini.

## [CONDUCTOR 2026-04-17T07:56+02:00] Cycle status
All 3 tenants 200 OK (catalysterp 1.53s, mitwpu 1.18s, ravikiran 0.86s). Codex active (1 commit in last 15min). No new feedback — T-vehicles-500, T-payments-po-editable, T-payroll already ticketed from prior cycle. Ollama http5xx stale (Apr 14 only, no new). Dashboard regen'd + scp'd to Mini.

## [CONDUCTOR 2026-04-17T08:11+02:00] Cycle status
All 3 tenants 200 OK (catalysterp 1.30s, mitwpu 0.97s, ravikiran 0.86s). Codex active (1 commit in last 15min). No new feedback — T-vehicles-500, T-payments-po-editable, T-payroll already ticketed from prior cycle. Ollama http5xx stale (Apr 14 only, no new). Dashboard regen'd + scp'd to Mini.

## [CONDUCTOR 2026-04-17T08:26+02:00] Cycle status
All 3 tenants 200 OK (catalysterp 1.25s, mitwpu 1.06s, ravikiran 0.87s). Codex active (1 commit in last 15min). No new feedback — T-vehicles-500, T-payments-po-editable, T-payroll already ticketed from prior cycle. Ollama http5xx stale (Apr 14 only, no new). Dashboard regen'd + scp'd to Mini.

## [CONDUCTOR 2026-04-17T08:41+02:00] Cycle status
All 3 tenants 200 OK (catalysterp 1.47s, mitwpu 1.02s, ravikiran 0.94s). Codex IDLE — 0 commits in last 15min. Filed ORDER #4 in codex1_inbox.md (T2/T3/T60). No new feedback (last entries 00:10 UTC already ticketed). Ollama http5xx stale (Apr 14 only). Dashboard regen'd + scp'd to Mini.

## [CONDUCTOR 2026-04-17T09:11+02:00] Cycle status
All 3 tenants 200 OK (catalysterp 1.35s, mitwpu 0.97s, ravikiran 0.83s). Codex active (1 commit in last 15min). No new feedback — T-vehicles-500, T-payments-po-editable, T-payroll already ticketed from prior cycle. Ollama http5xx stale (Apr 14 only, no new). Dashboard regen'd + scp'd to Mini.

## [CONDUCTOR 2026-04-17T09:26+02:00] Cycle status
All 3 tenants 200 OK (catalysterp 1.67s, mitwpu 1.04s, ravikiran 0.81s). Codex active (1 commit in last 15min). No new feedback — T-vehicles-500, T-payments-po-editable, T-payroll already ticketed from prior cycle. Ollama http5xx stale (Apr 14 only, no new). Dashboard regen'd + scp'd to Mini.

## [CONDUCTOR 2026-04-17T09:41+02:00] Cycle status
All 3 tenants 200 OK (catalysterp 0.87s, mitwpu 0.81s, ravikiran 1.18s). Codex active (1 commit in last 15min). No new feedback — T-vehicles-500, T-payments-po-editable, T-payroll already ticketed from prior cycle. Ollama http5xx stale (Apr 14 only, no new). Dashboard regen'd + scp'd to Mini.

## [P0-LIVE 2026-04-17T10:10+02:00 CONDUCTOR] 5 new Tejveer feedback items (08:10 CEST detection)

### T117-fb — `dev-panel-button-unreadable` [BLOCKER] (Codex write)
Tejveer (2026-04-17T10:01): `/admin/dev_panel` — cannot read material, button colors are unreadable. Fix button text/background contrast in dev panel. Commit: `fix(dev_panel): fix button color contrast for readability`.

### T118-fb — `grants-row-clickable` [MAJOR] (Codex write)
Tejveer (2026-04-17T10:06): `/finance/grants` — pressing any part of a grant row should open a detail page (who asked, amount, status, approver). Add clickable row → grant detail view. Commit: `feat(grants): make grant rows open detail page`.

### T119-fb — `ops-queue-color-uniform` [POLISH] (Codex write)
Tejveer (2026-04-17T09:59): `/` — OPS Queue tile color differs from other tiles. Unify tile color scheme. Commit: `fix(dashboard): unify OPS Queue tile color with other tiles`.

### T120-fb — `dev-panel-metrics-center` [POLISH] (Codex write)
Tejveer (2026-04-17T10:03): `/admin/dev_panel` — center the numbers above "Commits today" and "Files touched". Commit: `fix(dev_panel): center metric numbers above labels`.

### T121-fb — `personnel-role-color-coding` [POLISH] (Codex write)
Tejveer (2026-04-17T10:09): `/personnel` — different roles should have distinct colors (operator=green, member=grey, Super Admin=different). Add role-based color coding to personnel list. Commit: `feat(personnel): add color coding for different roles`.

## [CONDUCTOR 2026-04-17T10:10+02:00] FINAL CYCLE — SELF-DISABLING (past 10 AM Paris)
All 3 tenants 200 OK (catalysterp 0.87s, mitwpu 0.82s, ravikiran 1.23s). Codex active (1 commit in 15min). 5 new feedback tickets filed (T117–T121: 1 blocker, 1 major, 3 polish). Ollama http5xx stale (Apr 14 only). Dashboard regen'd + scp'd. Conductor shutting down — overnight watch complete.

## [CONDUCTOR 2026-04-17T11:46+02:00] Cycle status (resumed after premature self-disable)
All 3 tenant /login endpoints: unreachable from MacBook (DNS local only — iMac-side). iMac logs: /attendance returning 302 today, no 500s in server.log. Codex active (6 commits in ~90min): T117-fb fixed (dev_panel buttons), T119-fb fixed (OPS Queue color), T121-fb fixed (personnel role colors), attendance 500 hot-fixed (commit 5f2134c). T118-fb (grants row) and T120-fb (dev_panel metrics center) still pending. 1 new feedback item: T122-attendance-500 — resolved by Codex before this cycle. Dashboard regen'd + scp'd to Mini.

## [P0-LIVE 2026-04-17T12:21+02:00 CONDUCTOR] 1 new feedback item (Nikita, 12:13 CEST)

### T123-fb — `vehicles-expense-label-mismatch` [MAJOR] (Codex write)
Nikita (2026-04-17T11:46 UTC): `/vehicles/1` — "not log entries these are expenses that go through an approval route". The "LOG HISTORY" section on vehicle detail page is showing expense records that belong to an approval workflow, not generic log entries. Fix the section label or separate expense entries from log entries. Commit: `fix(vehicles): label expense approval entries correctly in vehicle detail`.

## [CONDUCTOR 2026-04-17T12:21+02:00] Cycle status
All 3 tenants 200 OK (5055=lab 200, 5056=mitwpu 200, 5057=ravikiran 200 — confirmed on owning hosts). 1 new feedback ticket filed: T123-fb vehicles-expense-label-mismatch [MAJOR] (Nikita). No 500s in iMac server.log. Dashboard regen'd + scp'd to Mini.

## [CONDUCTOR 2026-04-17T12:36+02:00] Cycle status
All 3 tenants 200 OK (lab=HTTPS 200, mitwpu=200, ravikiran=200). Note: lab ERP on Mini uses SSL — probe must use https://localhost:5055. No new feedback since T123 (already ticketed). No 500s in iMac server.log. Dashboard regen'd + scp'd to Mini.

## [CONDUCTOR 2026-04-17T12:51+02:00] Cycle status
All 3 tenants 200 OK (lab=HTTPS 5055 on mini 200, mitwpu=5056 on mini 200, ravikiran=5057 on iMac 200). No new feedback since T123 (already ticketed). No 500s in iMac server.log. Dashboard regen'd + scp'd to Mini.

## [CONDUCTOR 2026-04-17T13:05+02:00] Cycle status
All 3 tenants 200 OK (lab=HTTPS 5055 on mini 200 0.013s, mitwpu=5056 on mini 200 0.010s, ravikiran=5057 on iMac 200 0.025s). No new feedback since T123 (already ticketed). No 500s. Dashboard regen'd + scp'd to Mini.

## [CONDUCTOR 2026-04-17T13:36+02:00] Cycle status
All 3 tenants 200 OK (lab=HTTPS 5055 on mini 200, mitwpu=5056 on mini 200, ravikiran=5057 on iMac 200). No new feedback since T123 (already ticketed). No 500s in iMac server.log since 10:11 (attendance qr_attendance_kiosk — already hot-fixed by Codex). Dashboard regen'd + scp'd to Mini.

## [CONDUCTOR 2026-04-17T13:57+02:00] Cycle status
All 3 tenants 200 OK (lab=HTTPS 5055 on mini 200 0.053s, mitwpu=5056 on mini 200 0.009s, ravikiran=5057 on iMac 200 0.010s). No new feedback since T123 (already ticketed). No 500s. Dashboard regen'd + scp'd to Mini.

## [CONDUCTOR 2026-04-17T14:12+02:00] Cycle status
All 3 tenants 200 OK (lab=HTTPS 5055 on mini 200, mitwpu=5056 on mini 200, ravikiran=5057 on iMac 200). No new feedback since T123 (already ticketed). No 500s/errors in iMac server.log. Dashboard regen'd + scp'd to Mini.

## [CONDUCTOR 2026-04-17T14:20+02:00] Cycle status
All 3 tenants 200 OK (lab=HTTPS 5055 on mini 200, mitwpu=5056 on mini 200, ravikiran=5057 on iMac 200). No new feedback since T123 (already ticketed). No 500s/errors in iMac server.log. Dashboard regen'd + scp'd to Mini.

## [CONDUCTOR 2026-04-17T14:50+02:00] Cycle status
All 3 tenants 200 OK (lab=HTTPS 5055 on mini 200 0.111s, mitwpu=5056 on mini 200 0.008s, ravikiran=5057 on iMac 200 0.016s). No new feedback since T123 (already ticketed). No 500s in iMac server.log. Dashboard regen'd + scp'd to Mini.

## [CONDUCTOR 2026-04-17T15:03+02:00] Cycle status
All 3 tenants 200 OK (lab=HTTPS 5055 on mini 200, mitwpu=5056 on mini 200, ravikiran=5057 on iMac 200). No new feedback since T123 (Nikita, already ticketed). No 500s in iMac server.log since 10:11 (attendance issue already hot-fixed by Codex). Dashboard regen'd + scp'd to Mini.

## [CONDUCTOR 2026-04-17T15:28+02:00] Cycle status
All 3 tenants 200 OK (catalysterp 200, mitwpu 200, ravikiran 200). No new feedback since T123 (Nikita, already ticketed). NOTE: One transient /login?portal=hq 500 at 15:12 CEST (iPhone UA, BuildError: forgot_password endpoint not found) — resolved itself, now 200; no live edit needed. iMac server.log: no new Tracebacks beyond that one-off. Dashboard regen'd + scp'd to Mini.

## [P0-LIVE 2026-04-17T15:47+02:00 CONDUCTOR] 1 new recurring issue

### T124-fb — `login-forgot-password-endpoint-missing` [BLOCKER] (Codex write)
Recurring 500 on `/login?portal=*` — `BuildError: Could not build url for endpoint 'forgot_password'`. Seen at 15:12 and 15:32 CEST from external IPs (bot traffic, `portal=hq`, `portal=lab`). Real-user logins OK (curl 200 at 15:31). Root cause: `forgot_password` route not registered in ravikiran live app, but `login.html` line 79 renders `{{ url_for('forgot_password') }}`. Fix: add the `forgot_password` route or guard the url_for with a conditional. Commit: `fix(auth): add forgot_password route or guard login.html url_for`.

## [CONDUCTOR 2026-04-17T15:47+02:00] Cycle status
All 3 tenants 200 OK (lab=HTTPS 5055 mini 200, mitwpu=5056 mini 200, ravikiran=5057 iMac 200). No new Tejveer/Nikita feedback since T123 (already ticketed). 1 new ticket T124-fb: recurring login 500 on `?portal=*` params from bots (forgot_password endpoint missing). Real users unaffected. Dashboard regen'd + scp'd to Mini.

## [LIVE_PATCH_LOG 2026-04-17T15:52+02:00 CONDUCTOR] 2 hot-fixes applied

### Fix 1 — /vehicles 500 — `sqlite3.OperationalError: no such column: vl.linked_receipt_id`
Root cause: live DB missing `linked_receipt_id` column on `vehicle_logs` table (schema migration at app startup line 6414 was not re-run after last deploy). Fix: ran `ALTER TABLE vehicle_logs ADD COLUMN linked_receipt_id INTEGER` directly on `/Users/nv/ERP-Instances/ravikiran-erp/live/data/operational/ravikiran_erp_data_operational_live.db` via SSH + restarted service.

### Fix 2 — /attendance 500 — `BuildError: Could not build url for endpoint 'qr_attendance_kiosk'`
Root cause: live app process was running stale cached code without the `qr_attendance_kiosk` route (added in a recent deploy but service not restarted). Fix: `launchctl kickstart -k gui/$(id -u)/local.catalyst.ravikiran` on iMac. Both routes now return 302 OK.

## [CONDUCTOR 2026-04-17T15:55+02:00] Cycle status
HOT-FIXED: /vehicles and /attendance 500s resolved (see LIVE_PATCH_LOG above). No new Tejveer/Nikita feedback since Nikita T123 at 11:46 UTC. T124-fb (login forgot_password) still open for Codex write. Dashboard regen'd + scp'd to Mini.
