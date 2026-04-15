# Agent Relay Orchestration — 8 rounds, 2 ERPs

> 4 rounds Ravikiran, then 4 rounds Lab-ERP.
> Claude (iMac) fires at :30 past each hour.
> Codex (MBP) fires at :00 each hour.
> Each round: 20 min work, then handoff file update, then idle until the other agent's slot.

---

## Schedule

| Round | Time | Agent | Repo | Focus |
|---|---|---|---|---|
| R1 | 01:30 | **Claude** | ravikiran-erp | D5-D7 from existing spec + household asset seeds |
| R2 | 02:00 | **Codex** | ravikiran-erp | Review R1, fix deeper, vocabulary scrub (P2.1-P2.4) |
| R3 | 02:30 | **Claude** | ravikiran-erp | Review R2, household features (P3.1-P3.2), cross-check |
| R4 | 03:00 | **Codex** | ravikiran-erp | Review R3, demo-readiness polish (P4.1-P4.3), final Ravikiran pass |
| R5 | 03:30 | **Claude** | lab-scheduler | Crawl all Lab-ERP modules, fix bugs from debug_feedback |
| R6 | 04:00 | **Codex** | lab-scheduler | Review R5, deepen fixes, module wiring check |
| R7 | 04:30 | **Claude** | lab-scheduler | Review R6, cross-repo module parity check |
| R8 | 05:00 | **Codex** | lab-scheduler | Final Lab-ERP pass, ERP builder summary doc, tag prep |

---

## Handoff protocol

After each round, the finishing agent:

1. **Commits all work** with prefix `relay-RN:` (e.g. `relay-R1: ...`).
2. **Appends to the handoff file** at
   `docs/RELAY_HANDOFF_LOG.md` (on whichever repo they worked on):
   ```
   ## Round N — <agent> — <timestamp>
   ### What I shipped
   - commit1: one-line
   - commit2: one-line
   ### What I found but didn't fix
   - file:line — description — why deferred
   ### What the next agent should check
   - verify X still works after my change to Y
   - the Z module has a potential issue at file:line
   ### Cross-repo note (if applicable)
   - Lab-ERP has the same bug at file:line — port the fix
   ```
3. **Pushes** to origin.
4. **Idles** until their next slot.

The NEXT agent:
1. `git pull origin operation-trois-agents`
2. Reads `docs/RELAY_HANDOFF_LOG.md` — specifically the last round's section
3. **Verifies** the previous agent's fixes (tries to break them)
4. **Generalises** fixes (if the previous agent fixed one template, check all templates for the same pattern)
5. **Deepens** (if the previous agent did a surface fix, look for the root cause)
6. Ships their own fixes + appends their handoff section

---

## What each agent brings

**Claude (iMac):**
- Full repo access to both Lab-ERP and ravikiran-erp clones
- SSH to MBP (origin bare) and mini (read-only)
- Can run smoke_test.py, crawlers, and verification scripts
- Templates, CSS, docs — no restriction
- Can edit app.py on ravikiran-erp (not Lab-ERP during sprint, but post-sprint = OK)

**Codex (MBP):**
- Direct filesystem access to both repos
- Can edit app.py freely
- Runs smoke_test.py locally
- Has the live tunnel context (cloudflared, launchd plists)

---

## Round-by-round detail

### R1 — Claude — Ravikiran (01:30)

Pick up from the killed subagent (D1-D4 shipped, D5-D7 pending):

1. **D5** Port `/debug` route + wire eruda embed
2. **D6** Port `attendance_quick.html` + CSS + route
3. **D7** v1.5.0 multi-role TODO retirement
4. **Stretch B** Seed 8 household assets

Handoff note for Codex R2: list what landed, what failed, and
which templates still have lab vocabulary.

### R2 — Codex — Ravikiran (02:00)

1. **Verify R1**: run smoke, try `/debug`, try `/attendance/quick`
2. **P2.1** "Sample request" → "Service request" in templates
3. **P2.2** Role display names → household vocabulary
4. **P2.4** Dashboard copy polish → household terms

Handoff note for Claude R3: list vocabulary changes made, any
places where the rename was ambiguous, and any broken references.

### R3 — Claude — Ravikiran (02:30)

1. **Verify R2**: grep for remaining lab terms, test renamed UI
2. **P3.1** Household expense categories seed
3. **P3.3** Asset maintenance calendar events seed
4. **Cross-check**: any fix Codex made in R2 that applies to Lab-ERP too → note it

Handoff note for Codex R4: household data seeded, cross-repo
notes, any template that still looks wrong.

### R4 — Codex — Ravikiran (03:00)

1. **Verify R3**: load the demo, walk through as Nikita
2. **P4.1** Ravikiran landing page (logged-out experience)
3. **P4.2** Seed realistic demo data (requests, receipts, vehicle logs)
4. **Final grep**: zero "MITWPU/Lab/FESEM/XRD/ICP-MS" in templates
5. **Tunnel check**: verify `ravikiran.catalysterp.org` actually routes to port 5057

Handoff: Ravikiran declared done or list remaining items.

### R5 — Claude — Lab-ERP (03:30)

1. **Re-crawl debug_feedback_v1.1_archived.md** for any Lab-ERP-specific bugs not yet addressed
2. **Fix** the top 3 actionable items from the crawl
3. **Module wiring check**: for each module (finance, attendance, vehicles, personnel, mess, tuck-shop, inbox, notifications, receipts, letters, ca-audit), verify the route exists, the nav link works, and the page renders
4. **Cross-repo port**: any fix from R1-R4 that applies to Lab-ERP

### R6 — Codex — Lab-ERP (04:00)

1. **Verify R5**: try to break Claude's fixes
2. **Deepen**: for each R5 fix, check if the same bug pattern exists elsewhere
3. **Notifications system**: begin the inbox-pattern rebuild if scope allows (this is the #1 user complaint)
4. **Grant charging**: assess feasibility of a bounded first-pass

### R7 — Claude — Lab-ERP (04:30)

1. **Verify R6**: test notification changes, grant surface
2. **ERP module parity audit**: for each module that exists in BOTH repos, verify the code structure matches. Flag drift.
3. **CSS/template parity**: any template fix from Ravikiran R1-R4 that should propagate to Lab-ERP
4. **Test suite**: run all 9 test files, fix any regressions

### R8 — Codex — Lab-ERP (05:00)

1. **Verify R7**: run full crawler wave, all tests
2. **ERP builder summary doc**: `docs/ERP_BUILDER_SUMMARY_2026_04_16.md` — what modules exist, how they're wired, how to add a new one, how the two ERPs share code
3. **Tag prep**: if everything is green, prep the `v2.0.0-rc1` tag commit
4. **Final handoff**: list anything still open for the operator

---

## Cross-repo module parity checklist

Both ERPs share the same codebase. When fixing a module in one,
check if the fix applies to the other:

| Module | Lab-ERP | Ravikiran | Notes |
|---|---|---|---|
| Instruments / Assets | ✓ | ✓ (renamed to Assets D4) | |
| Finance (grants, invoices, payments) | ✓ | ✓ | |
| Attendance | ✓ | ✓ | |
| Vehicles | ✓ | ✓ | |
| Personnel | ✓ | ✓ | |
| Mess | ✓ | ✓ | |
| Tuck Shop | ✓ | ✓ | |
| Inbox / Messages | ✓ | ✓ | |
| Notifications | ✓ | ✓ | needs rebuild (both) |
| Receipts | ✓ | ✓ | |
| Letters | ✓ | ✓ | |
| CA Audit | ✓ | ✓ | |
| Portfolio | ✓ | ✓ | Lab-only? check Ravikiran |
| Debug / Feedback | ✓ | pending D5 | |
| Attendance Quick | ✓ | pending D6 | |

---

## Deliverables at the end of 8 rounds

1. Ravikiran ERP fully household-branded, demo-ready for Nikita
2. Lab-ERP top debug-feedback bugs fixed
3. Module parity audit between both repos
4. ERP builder summary doc
5. All tests green on both repos
6. `RELAY_HANDOFF_LOG.md` on both repos documenting every round
7. Onboarding PDF already shipped (ONBOARDING_CREDENTIALS_2026_04_16.pdf)
