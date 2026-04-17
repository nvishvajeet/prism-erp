# Rig board — shared state all agents read every burn

**Updated by:** Station Bordeaux conductor cycle
**Read by:** Station Bordeaux, Station Scotland, Station Paris

---

## Station roles

- **Station Bordeaux** — conductor. Owns queue order, health checks, handoffs, and ticket routing.
- **Station Scotland** — heavy implementation lane. Owns larger iMac / tenant / backport / architecture slices.
- **Station Paris** — fast ship lane. Owns small bounded canonical fixes, one safe commit at a time.

## Source of truth

- **Routing and priority:** `docs/active_task.md`
- **Station role model and burn log:** this file
- If this file and `docs/active_task.md` drift, **follow `docs/active_task.md` first** and then update this board.

---

## CURRENT MODE: 🔥 SPRINT-ACTIVE

**Named-station war footing is active.** Use `docs/active_task.md` for the current queue and station-specific orders.

Agents self-fire every 15 min via scheduled-tasks MCP.

---

## Priority order per burn

1. **Tejveer-first** — check `tmp/feedback-watchdog-events.jsonl` for new entries since last burn. BLOCKER/500 → hot-fix NOW, skip sprint.
2. **Nikita-first** — same pattern.
3. **Station queue** — pick the top unshipped item assigned to your station in `docs/active_task.md`.
4. **Idle** — if sprint empty + no new feedback → stand down (see below).

---

## Stand-down protocol (activates when sprint empty)

When this board says `STAND DOWN`:
- Agents extend their next-fire to **60 min** instead of 15 min
- Only routine tasks per burn:
  - pull-rebase + live probe (check 3 tenants 200)
  - check feedback-watchdog for new Tejveer/Nikita entries
  - regen dashboard
  - single commit if anything changed
- No feature development
- Claude1 flips mode back to `SPRINT-ACTIVE` when new work is ticketed

---

## Current station plan

| station | role | next lane |
|---|---|---|
| Bordeaux | conductor | health, ticket routing, handoff refresh |
| Scotland | heavy implementation | larger iMac / live / architecture slices from `active_task.md` |
| Paris | rapid ship | next small canonical live-facing fix from `active_task.md` |

---

## Live incidents (open)

none right now

---

## Last conductor update

2026-04-17 16:16 Paris — RIG board aligned with named-station model. `docs/active_task.md` remains routing truth.

## Live user roster (as of 2026-04-17)
| name | tenant | role | email |
|---|---|---|---|
| Tejveer | ravikiran | tester | tejveer |
| Nikita | ravikiran | super_admin | nikita |
| Prashant | ravikiran | super_admin | prashant |
| Vishvajeet (operator) | both | owner | vishvajeet@mitwpu.edu.in |
| Prof. Kondhalkar | catalyst (Lab) | site_admin | kondhalkar@mitwpu.edu.in |
| Dr. Bharat Chaudhari | catalyst (Lab) | super_admin (Dean) | dean.rnd@mitwpu.edu.in |

All use default password `12345`. Operator flips to new pw via `/me/security` or via DB update.

---

## Last burn log

- 2026-04-17T18:30+02:00 station-scotland — **D5+S3+D6+S4+D-series query scoping (10 commits).** S3 init_db-on-gunicorn-import + D5 check_tenant_scoping.py (soft-warn, 733→661 hits) + D6 ERP builder baseline policy doc + S4 pre-deploy schema drift check script. Deep D-series: tenant_tag scoping on 15+ query paths: admin users list, instruments list, nav dropdown, dashboard queue, personnel, approval candidates, grants list/stats, vehicles counts, message compose, receipt/ref uniqueness. All commits cherry-picked to v1.3.0-stable-release, smoke green. SSH to Mini timed out — K1-K13, D1, D3, S1, S2 remain blocked.
- 2026-04-17T16:45+02:00 station-scotland — **M4+M5+F2+D4+F3+F4+F5 shipped.** JS error forwarder (telemetry_js_error table + window.onerror hook), dev_panel telemetry/JS-error tiles, CRF form fields (applicant_class/is_magnetic/output_format), tenant_tag isolation on 8 tables, Option A/B payment branch (sample_request_payments table), secretary approve route + tile, T&C checkbox. All 7 commits cherry-picked to v1.3.0-stable-release, smoke green, Mini deployed. new_request.html + request_detail.html + dev_panel.html all updated.
- 2026-04-17T15:37+02:00 station-scotland — **WAR FOOTING BURN** Lab 200 post-migration. K1-K13 executed on Mini: purged 5 contaminated users + demo data, seeded 14 canonical users (Dean/Vishvajeet/Kondhalkar + 6 operators + 5 faculty), 22 brochure instruments + operator assignments, ravikiran_ops portal leak purged. Cherry-picked 7 Paris commits (4x CSS bundles + 3x Paris fixes) to v1.3.0-stable-release. F1 shipped (employee_id + designation on users + new_request.html prefill). M3 shipped (Admin nav visible to super_admin — Kondhalkar can now see /admin/dev_panel). Sprint items 1-6 verified already shipped. All green: Lab 200, Ravikiran 200.
- 2026-04-17T17:00+02:00 claude3-imac — Ravikiran 200 (Lab/HQ on Mini, not local). No watchdog events. 5 commits cherry-picked to v1.3.0-stable-release for Kondhalkar: admin branding fix, instrument Finance tile, login two-pane, Chart.js CSP fix, dev-panel metric center. Ravikiran HEAD unchanged at 3450ad5 — no new backports.
- 2026-04-17T16:10+02:00 claude3-imac — all 3 tenants 200, no new feedback, sprint items 1-4 verified already shipped in canonical, ravikiran backport project complete (3/3 BACKPORTs shipped: bc890fb eruda, 291f1e0 login-tests, 2e32715 two-pane-login). instrument_admin Finance tile read-only fix pushed (2300011).
- 2026-04-17T15:03+02:00 station-bordeaux — **Stations named** (Bordeaux=Claude1/MBP 50%, Scotland=Claude2/iMac 85%, Paris=Codex1/iMac 85%). 28-ticket K+S+D+F+L sprint filed in `tmp/claude2_inbox.md`. ETA ~8.5h wall-clock, target 2026-04-18 16:00 Paris. Architecture-first (K→S→D before F→L). War footing. Caps: MBP 50%, others 85%. Kondhalkar live blockers (telemetry 500 + /users/28 500) resolved earlier; 3 tenants green at 15:02.
