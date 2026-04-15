# Three-Agent Master Plan — CATALYST ERP Final Push

> 3 agents × 3 batches × 3 hours each = 9 hours total.
> Each agent gets 20 min per hour. If one agent drops, the other
> two alternate 30/30 and pick up the missing agent's tasks.
>
> Written by Claude 1 (iMac) at end of session. The 02:00 manager
> Claude reads this, bootstraps, and runs autonomously.

---

## Agents

| Slot | Agent | Machine | Fires at |
|---|---|---|---|
| A | **Claude 1** | iMac | :00 – :20 each hour |
| B | **Codex 0** | MBP | :20 – :40 each hour |
| C | **Claude 0** | MBP (2nd session) | :40 – :00 each hour |

**Fallback (2 agents):** If any agent drops, the surviving two
go 30/30. The dropped agent's current-round tasks get absorbed
by the next agent in rotation. Handoff log stays the single
source of truth — the surviving agents read it and pick up.

---

## Batches

| Batch | Focus | Hours | Rounds |
|---|---|---|---|
| **Batch 1** | Ravikiran ERP — household-ready | 3 h | R1–R9 |
| **Batch 2** | Lab-ERP — bug-fix + polish | 3 h | R10–R18 |
| **Batch 3** | Central architecture — parity, isolation, network, agent workflow | 3 h | R19–R27 |

Each batch has 9 rounds (3 agents × 3 hours). Each round is
20 min of focused work.

---

## Rotation pattern (per hour)

```
:00 ──────── :20 ──────── :40 ──────── :00
│  Claude 1  │  Codex 0   │  Claude 0  │
│  (work)    │  (work)    │  (work)    │
│            │            │            │
│  verifies  │  verifies  │  verifies  │
│  Claude 0  │  Claude 1  │  Codex 0   │
└────────────┴────────────┴────────────┘
```

Each agent:
1. **Pulls** both repos at the start of their 20-min slot
2. **Reads** the last section of `docs/RELAY_HANDOFF_LOG.md`
3. **Verifies** the previous agent's work (try to break it)
4. **Generalises** (same bug elsewhere? same pattern in other repo?)
5. **Ships** their own assigned tasks
6. **Appends** their section to the handoff log
7. **Pushes** and goes idle

---

## BATCH 1 — Ravikiran ERP (hours 1–3)

**Goal:** Nikita can onboard people tomorrow. Demo-ready household ERP.

**Already shipped (R1–R2):**
- D1–D7 from the Codex burn (ORG_NAME, login, hub, Assets rename, /debug, attendance_quick, multi-role TODOs, household assets)
- R2 vocabulary scrub (roles, template text, dashboard copy)

### Hour 1 (R3–R5)

| Round | Agent | Tasks |
|---|---|---|
| R3 | Claude 1 | Verify R2 vocab grep. Fix remaining "Lab queue" / "Open Lab Queue" in dashboard. Seed household expense categories (Groceries, Fuel, Maintenance, Utilities, Staff Salaries, Medical, Education, Entertainment, Insurance, Misc). |
| R4 | Codex 0 | Verify R3 expense seeds work in demo. Seed 5 upcoming asset maintenance events (AC servicing May, Generator check Jun, Water Purifier filter Jul, Solar inverter annual Aug, Chimney cleaning Sep). Seed 10 realistic receipts. |
| R5 | Claude 0 | Verify R3+R4. Dashboard tiles: add "Today's Staff" attendance summary + "This Month's Spend" KPI + "Upcoming Maintenance" next-3 list. Remove lab-specific tiles that don't apply. |

### Hour 2 (R6–R8)

| Round | Agent | Tasks |
|---|---|---|
| R6 | Claude 1 | Verify R5 dashboard. Build Ravikiran logged-out landing page (not redirect-to-login — a proper branded page with "Sign in" CTA). Check schedule.html and calendar.html for remaining lab terms. |
| R7 | Codex 0 | Verify R6 landing. Seed 5 realistic service requests + 3 vendor payments + 1 month attendance records for 7 staff. Fix `base.html` nav: "Instruments" dropdown → "Assets" (Codex owns app.py, can coordinate with manager for base.html edit). |
| R8 | Claude 0 | Verify R7. Final grep: zero MITWPU/Lab/FESEM/XRD/ICP-MS in Ravikiran templates. Mobile smoke at 375px for every nav entry. Cross-contamination check: curl ravikiran.catalysterp.org, verify NO Lab-ERP content leaks. |

### Hour 3 (R9 — wrap-up)

| Round | Agent | Tasks |
|---|---|---|
| R9 | All 3 | 20 min each: independent walk-through of the full Ravikiran app as Nikita. Each agent logs issues they find. Final fixes. Declare Ravikiran DONE or list blockers. |

### Batch 1 exit gate
- `grep -rniE "MITWPU|Lab Scheduler|FESEM|XRD|ICP-MS|Central Instrumentation" templates/` → 0 user-visible hits
- `/debug` loads with eruda
- `/attendance/quick` keypad works
- Every nav entry returns 200 for super_admin
- Household assets visible on the assets list page
- Expense categories visible on receipt/vendor forms
- Dashboard shows household-relevant tiles only
- Onboarding PDF matches the live accounts

---

## BATCH 2 — Lab-ERP (hours 4–6)

**Goal:** Fix the top user complaints from debug_feedback, harden the product for Tejveer's testing.

**Source material:**
- `docs/POST_SPRINT_FEEDBACK_PLAN_2026_04_15.md` — 11 complaint clusters ranked by severity
- `logs/debug_feedback_v1.1_archived.md` on MBP — raw user voice
- `docs/OPERATION_TROIS_AGENTS_CRAWL_REPORT.md` — live-site findings

### Hour 4 (R10–R12)

| Round | Agent | Tasks |
|---|---|---|
| R10 | Claude 1 | Re-crawl debug_feedback. Reproduce the instrument-metadata-edit crash (P0 #F from the plan). Fix if traceable; document if not. Check the notifications "shows already-seen notices" bug. |
| R11 | Codex 0 | Verify R10 crash fix. Begin notifications UI rebuild — replace the dashboard noticeboard tile with an inbox-style list: read/unread state, "all caught up" empty state, click-to-dismiss. Keep the backend (`notices` + `notice_reads` tables) as-is. |
| R12 | Claude 0 | Verify R11 notifications. Fix dashboard empty-space issue (the #3 complaint — "what is this empty space here"). Audit each role's home view and eliminate dead zones by reflowing tile grid-column spans. |

### Hour 5 (R13–R15)

| Round | Agent | Tasks |
|---|---|---|
| R13 | Claude 1 | Verify R12 dashboard. Tackle grant charging MVP: add grant-picker dropdown to new_request.html form. Wire `project_id` on sample-request creation (if the column exists; if not, document the schema need). |
| R14 | Codex 0 | Verify R13 grant picker. Add the schema if needed (`ALTER TABLE sample_requests ADD COLUMN project_id`). Wire the backend: save project_id on request creation, display on request_detail + finance pages. |
| R15 | Claude 0 | Verify R14 grant wiring. Finance portal 3-panel layout polish: summary tiles + approval queue + action panel. Copy the instruments-portal discipline (existing macros: kpi_grid, queue_action_stack, activity_feed). |

### Hour 6 (R16–R18)

| Round | Agent | Tasks |
|---|---|---|
| R16 | Claude 1 | Verify R15 finance layout. Fix remaining debug_feedback items: row/KPI clickability sweep, approval-sequence visibility (hoist to top of request_detail). |
| R17 | Codex 0 | Verify R16. Run all 9 test files. Fix any regressions. Run `crawlers wave sanity`. Document any FAIL/WARN. |
| R18 | Claude 0 | Final Lab-ERP pass. Walk every nav entry as 3 different roles (super_admin, operator, requester). Log issues. Fix or document. Declare Lab-ERP DONE or list blockers. |

### Batch 2 exit gate
- `scripts/smoke_test.py` green
- All 9 test files pass
- `crawlers wave sanity` green
- Notifications tile shows read/unread + "all caught up"
- Grant picker visible on new-request form
- Dashboard has no dead zones for super_admin / operator / requester roles
- debug_feedback top 5 complaints addressed or documented

---

## BATCH 3 — Central Architecture (hours 7–9)

**Goal:** Both ERPs are structurally sound, isolated, parity-checked, and documented.

### Hour 7 (R19–R21) — Module parity

| Round | Agent | Tasks |
|---|---|---|
| R19 | Claude 1 | Module inventory: for each of the 15 modules (instruments/assets, finance, attendance, vehicles, personnel, mess, tuck-shop, inbox, notifications, receipts, letters, ca-audit, portfolio, debug, attendance-quick), verify it exists in BOTH repos. Build a parity matrix. |
| R20 | Codex 0 | For each module that exists in both repos: diff the route signatures (`@app.route` lines) between Lab-ERP and Ravikiran. Flag drift (missing routes, renamed endpoints, different decorators). |
| R21 | Claude 0 | For each module with drift: decide if the drift is intentional (Ravikiran doesn't need calibrations) or a bug (missing route that should exist). Fix bugs, document intentional differences. |

### Hour 8 (R22–R24) — Isolation + network

| Round | Agent | Tasks |
|---|---|---|
| R22 | Claude 1 | Cross-contamination audit: curl every live subdomain, grep body for the OTHER ERP's brand terms. Verify cookie names are distinct. Verify session cookies don't cross domains (SameSite=Lax + domain-scoped). |
| R23 | Codex 0 | Tunnel architecture doc: SSH to mini (read-only), cat `~/.cloudflared/config.yml`, document which hostname → which port. Verify each ingress rule. Check if `catalysterp.org` apex routes to chooser or Lab-ERP. Create `docs/NETWORK_ARCHITECTURE_2026_04_16.md`. |
| R24 | Claude 0 | Agent workflow doc: document the 3-agent relay pattern, the handoff protocol, the CLAIMS.md system, the crawler supervision model, and the sprint orchestration learnings from Operation TroisAgents. Create `docs/AGENT_WORKFLOW_2026_04_16.md`. |

### Hour 9 (R25–R27) — ERP builder + final checks

| Round | Agent | Tasks |
|---|---|---|
| R25 | Claude 1 | ERP builder summary: `docs/ERP_BUILDER_SUMMARY_2026_04_16.md` — how CATALYST's module system works, how to add a new module, how the two ERPs share code, which primitives (from ERP_PRIMITIVES.md) each module uses. Include the `scripts/new_module.sh` recipe. |
| R26 | Codex 0 | Data separation audit: verify `data/demo/` vs `data/operational/` is enforced. Verify DEMO_MODE gating. Verify Ravikiran's data dir is independent of Lab-ERP's. Check for any shared SQLite path that could leak data between tenants. |
| R27 | Claude 0 | Final executive summary: `docs/FINAL_SHIP_REPORT_2026_04_16.md` — what shipped across all 27 rounds, what's still open, ship-gate verdict for v2.0.0 tag. If green → Codex tags. If not → fix list. |

### Batch 3 exit gate
- Module parity matrix complete (15 modules × 2 repos)
- Zero cross-contamination between live subdomains
- Tunnel architecture documented
- Agent workflow documented
- ERP builder summary written
- Data separation verified
- Final ship report with GREEN/YELLOW/RED verdict

---

## Handoff protocol (same for all batches)

Each agent, every round:
1. Pull both repos
2. Read `docs/RELAY_HANDOFF_LOG.md` (last section)
3. Verify previous agent's work
4. Ship own tasks
5. Append to handoff log:
   ```
   ## Round N — <agent> — <timestamp>
   ### Shipped
   - commit: one-line
   ### Found but didn't fix
   - file:line — why
   ### Next agent should check
   - specific verification command
   ### Cross-repo note
   - if applicable
   ```
6. Push

---

## Fallback (2 agents)

If any agent drops mid-batch:
1. Surviving agents switch to **30/30** rotation (30 min each per hour)
2. The dropped agent's current-round tasks move to the NEXT agent
3. Handoff log gets a `## Round N — ABSORBED BY <agent>` note
4. The batch continues — just fewer rounds per hour

If TWO agents drop:
1. Surviving agent does **60-min solo rounds**
2. Prioritise: verify what's shipped → fix blockers → skip polish
3. Write `STATUS: SOLO — <what was skipped>` in handoff log

---

## Bootstrap for the 02:00 manager

```bash
# On whichever machine the manager runs:
cd ~/Claude/ravikiran-erp && git pull origin operation-trois-agents
cat docs/RELAY_HANDOFF_LOG.md
cd ~/Scheduler/Main && git pull origin operation-trois-agents  # if on iMac
cat docs/THREE_AGENT_MASTER_PLAN_2026_04_16.md
# You are reading this file. Start at Batch 1, Hour 1, R3.
# R1+R2 are already shipped. Handoff log has the state.
```

---

## Rate-limit budget

Each agent gets ~20 min per hour. With 3 agents:
- 60 min of compute per clock hour
- 3 hours per batch = 9 clock hours of compute per batch
- 3 batches = 27 hours of compute total
- But only 9 clock hours elapsed (3 agents run in parallel slots)

If rate limits hit: the affected agent commits partial work with
`STATUS: RATE-LIMITED` and the next agent picks up. The handoff
log ensures nothing is lost.

---

## What's already done (don't redo)

### Ravikiran (from this session's work):
- Security parity (rate limiter, CSP/HSTS, ProxyFix)
- D1-D7: ORG_NAME, login, hub de-lab, Assets rename, /debug, attendance_quick, multi-role TODOs, household assets
- R2: vocabulary scrub — roles, 10 templates, dashboard/stats/schedule
- Eruda vendored + _eruda_embed.html
- UI audit CSS (F-01..F-08)
- mobile_polish_v2.css

### Lab-ERP (from this session's work):
- Rig schedule tile on dashboard
- 53 multi-role call-site retirements
- All 9 test files green
- F-01..F-12 CSS audit (insights clip, tap targets, safe-area, inline-style extractions)
- Chooser two-tile landing
- attendance_quick.html number-pad
- dev_panel can_view_debug gate
- Budget-alerts MVP (utilization tier on grant detail)
- Seed-email fix (demo messages/grants/notices actually populate now)
- Vendor action-row polish

### Docs:
- Onboarding PDF for Nikita
- Post-sprint feedback plan (debug_feedback crawl)
- Ravikiran improvement plan (4 phases)
- Relay orchestration plan (this file's predecessor)
- Operation TroisAgents crawl report, weave report, Codex review, executive summary
- UI audit, mobile polish audit, gatekeeping audit

---

## Summary for the operator

**9 clock hours. 3 agents. 27 rounds. 3 batches.**

By the end:
1. Ravikiran is a real household ERP Nikita can demo tomorrow
2. Lab-ERP's top user complaints are fixed
3. Both ERPs are structurally audited, cross-checked, and documented
4. v2.0.0-rc1 tag is ready (or a clear fix list if not)
