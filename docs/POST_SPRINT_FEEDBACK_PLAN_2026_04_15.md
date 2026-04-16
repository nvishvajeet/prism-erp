# Post-sprint feedback plan — 2026-04-15

> Written by Claude 1 (iMac) during the Operation Trois Agents sprint,
> after Lane 2 closed at T+115 and before Phase 4 weave at T+150.
> Based on a crawl of `logs/debug_feedback_v1.1_archived.md` (1 401
> lines, 30 distinct user complaints, 2026-04-12 → 04-13) and the
> current server logs. Intended as the first-agent-in handoff when
> the sprint's weave finishes.
>
> Owner: next write-agent to open the repo after Phase 4.

---

## 0. Source data

- **User-voice log:** `logs/debug_feedback_v1.1_archived.md` on the
  MacBook Pro (`vishvajeetn@100.109.225.52`) at
  `/Users/vishvajeetn/Documents/Scheduler/Main/logs/debug_feedback_v1.1_archived.md`
  — archived for v1.1 shipping; active file `logs/debug_feedback.md`
  is currently empty, so the archive is the substantive signal.
  Extracted: 30 free-text complaints mixed with click markers.
- **Server logs:** `logs/server-imac.log` (clean), `logs/server-ravikiran.log`
  (one recurring `sqlite3.OperationalError: no such table: users`).
- **Roadmap state:** `docs/NEXT_WAVES.md`, `docs/V2_GAP_MAP.md`,
  `docs/ROADMAP.md`, and the in-flight sprint docs
  (`docs/OPERATION_TROIS_AGENTS.md`,
  `docs/CLAUDE1_LANE_UI_POLISH_2026_04_15.md`,
  `docs/CODEX0_LANE_SEV2_2026_04_15.md`).

---

## 1. Server-side P0 — blocks any stable tag

```
sqlite3.OperationalError: no such table: users
Ravikiran server 500 on GET /
(traceback in logs/server-ravikiran.log)
```

Ravikiran ERP is hitting a cold DB. `init_db()` isn't running before
the first request on the Ravikiran process.

**Related, already flagged (STATUS: T+45 Claude1):** the
`ef2b7cb` branding scrub on Ravikiran removed instrument codes that
`scripts/populate_live_demo.py:363` still references. Local smoke
fails with `TypeError: 'NoneType' object is not subscriptable`.
Pre-receive on the Ravikiran bare didn't gate that.

**Fix:** two Ravikiran-app-side touches (NOT Claude 1's lane
during sprint; handoff for post-sprint):
1. Ensure `init_db()` runs on startup. Simplest: add an
   `app.before_serving` / `before_first_request` equivalent, or
   call `init_db()` from the gunicorn pre-fork hook, or baseline
   the DB at launchd-service start.
2. Fix `scripts/populate_live_demo.py:363` so missing instrument
   codes don't crash the seeder. One-line `continue` on `None`
   lookup is enough; the upstream scrub just removed codes the
   seeder assumed.

Touches: `ravikiran-erp/app.py`, `ravikiran-erp/scripts/populate_live_demo.py`.

---

## 2. Complaint clusters — ranked by re-appearance

Same user hitting the same issue multiple times = real priority.

| # | Theme | Hits | Severity |
|---|---|---|---|
| A | Notifications UI broken (size jitter, stale "seen" notices, wrong placement, should be inbox-style) | 6 | **P0 for v2.0** |
| B | Grant ↔ instrument ↔ sample charging missing (no way to tag a sample / run to a grant bucket) | 5 | **P0 for v2.0** |
| C | Finance portal UX quality ("looks done by yourself", needs 3-panel summary / approvals / actions) | 4 | P1 |
| D | Home-page empty space after recent tile churn | 3 | P1 |
| E | Approval-sequence visibility ("how does sample approval work" should be at top of request) | 2 | P1 |
| F | **System crash on instrument metadata edit** | 1 | **P0 for stable** |
| G | Password-reset UX — copy-pin or email-pin, no system prompt | 1 | P2 |
| H | Quick Intake rebuild — search + 6 tone-coloured tiles + per-tile quick actions | 1 | P2 |
| I | Noticeboard "all caught up" empty state | 1 | P2 (partially shipped) |
| J | Row / KPI clickability — convert text to links | 2 | P2 |
| K | Portfolio-manager role concept — grants per-person owner | 1 | v2.1+ feature |

Notifications (A), charging (B), and the metadata crash (F) are the
only P0s that block a v2.0 tag. Everything else can land after.

---

## 3. Stable-release gate (pre-`v2.0.0-rc1`)

Sequence:

1. **Ravikiran DB init** (§1) — unblocks `ravikiran.catalysterp.org`
   from 500s once HTTPS is live. Touches `ravikiran-erp/app.py`,
   `ravikiran-erp/scripts/populate_live_demo.py`. ~30 min.
2. **Instrument metadata edit crash (F)** — reproduce with a
   super_admin on `/instruments/<id>`, capture the traceback,
   patch. Only user-reported hard crash in the log. ~20–45 min
   depending on root cause.
3. **Notifications system rebuild (A)** — operator's explicit
   direction: "keep the backend, rebuild the UI using the inbox
   pattern — can't reply." Concrete:
   - inbox-shaped list w/ read/unread state (already have the
     `notices` + `notice_reads` tables — see `active_notices_for_user`
     in `app.py`)
   - "all caught up" empty state
   - persistent read-state fix (currently seen notices still
     appear on the dashboard tile — that's the "shows up here"
     complaint)
   - move UI out of dashboard into a nav-accessible
     panel/dropdown
   Touches: `templates/notifications.html`,
   `templates/_dashboard_noticeboard_tile.html` (or equivalent),
   maybe a new `templates/_nav_notifications.html`. Needs
   coordination with whoever owns nav.html at that point. ~4 h.
4. **Grant charging (B)** — v2.0 ERP-completeness item. Concrete:
   - grant-picker on sample-request creation +
     instrument-maintenance forms (`project_id` column already
     exists in v2.0 peer-aggregate schema — see
     `docs/V2_GAP_MAP.md` §"What is already strong enough")
   - "Charge to grant" inline action on request detail +
     instrument detail
   - approval flow (roles `finance_admin` + `professor_approver`
     already gated via context processor)
   Touches: `app.py` route bodies, `templates/new_request.html`,
   `templates/request_detail.html`,
   `templates/instrument_detail.html` + new macros. ~6–8 h.

**Tag `v2.0.0-rc1` when 1–4 land and `scripts/smoke_test.py` +
`crawlers wave sanity` + `crawlers wave all` are all green on the
stable-release branch.**

---

## 4. First patch wave (v2.0.1 / v2.0.2)

5. **Finance portal 3-panel layout (C)** — summary tiles +
   approval queue + action panel. Clone the instruments-portal
   discipline. Bounded to `templates/finance*.html` + existing
   routes. ~3 h.
6. **Dashboard empty-space reflow (D)** — per-role audit of the
   home grid; eliminate dead zones the operator keeps tracing.
   The rig-schedule tile (`8a96315`) already filled one slot;
   repeat for the others (requester, finance_admin,
   professor_approver home views). ~2 h.
7. **Approval-sequence visibility (E)** — hoist the step indicator
   to the top of request detail. Existing `approval_action_form`
   macro just needs placement + polish. ~30 min.

---

## 5. Feature backlog (v2.1+)

8. Password-reset PIN flow (G) — `/admin/reset-password/<uid>`
   returns a modal with a short PIN + "Copy" + "Email to user"
   buttons. No system prompt.
9. Quick Intake v2 (H) — full rebuild from the operator's verbatim
   spec: search bar + 6 tone-coloured status tiles + per-tile
   accept/decline/assign quick actions.
10. Row/KPI clickability sweep (J) — `.card`, `.finance-kpi-value`,
    `.tile-*` surfaces get `clickable-row` conversion per
    `tmp/agent_handoffs/audit-erp-polish/AUDIT.md`.
11. Noticeboard empty state (I) — verify on every role landing;
    partially shipped.
12. Portfolio-manager role (K) — new role + assignment matrix
    (grants ↔ portfolio owner). Depends on v1.5.0 multi-role.
13. Instruments pagination/wrap — verify `paginated_pane` works at
    all role scopes (complaint mentions "see like 20 instruments
    before there is wrap-around").

---

## 6. What the sprint's Lane 2 already cashed

From Claude 1's `operation-trois-agents` work (so the next agent
doesn't re-do any of this):

- **F-01 insights-tiles silent clip** — fixed via
  `static/css/ui_audit_2026_04_15.css`.
- **F-05..F-07 mobile polish** — 44×44 tap targets, safe-area
  insets, drill-tile overflow.
- **F-08 required-field `*` markers** — 96 Lab-ERP + 85 Ravikiran
  fields flagged via one `:has()` rule, zero template diff.
- **F-09..F-12 inline-style extractions** — `mess_scan.html`,
  `portfolio.html`, `request_detail.html` cleaned to scoped
  utility classes.
- **D1 chooser styling** — two-tile dark-first responsive
  landing at port 5060 (`e24a3ee`).
- **D2 attendance quick-mark keypad** — mobile number pad,
  ROUTE comment at top of template for Claude 0 to wire
  (`bcc1b70`).
- **D5 Ravikiran visible-text de-lab pass 2** — 4 hits
  (receipt_form, user_detail, request_detail, _eruda_embed)
  cleaned; `hub.html` deferred (7+ devdoc refs, needs dedicated
  pass).
- **`mobile_polish_v2.css` + audit doc** — D4 (`5b11a9b` +
  `docs/MOBILE_POLISH_2026_04_15.md`).
- **V2_GAP_MAP code-vs-doc true-up** — vendors + inventory
  promoted from "missing" → "partial" (`fe194ef`).

None of the above needs to be redone. All stitched into
`base.html` via the one-line `<link>` handoff documented in
`docs/UI_AUDIT_2026_04_15.md` (Claude 0's Phase 2 merge task).

---

## 7. Recommended first action for the post-sprint agent

**Hour 1 burn list (ordered by unblock value):**

1. Ravikiran DB init + populate_live_demo:363 patch (§1) — highest
   unblock impact; one Ravikiran page going from 500 to 200 lets
   every downstream Ravikiran item proceed. 30 min.
2. Instrument metadata edit crash (§3 item 2) — capture the
   traceback first, then fix. 20–45 min.
3. Approval-sequence visibility (§4 item 7) — bounded,
   template-only, 30 min.
4. Noticeboard empty-state verification + row-clickability spot
   fixes (§5 items 10, 11) — bounded, 15 min each.

**Out-of-scope for a 1-hour burn:** notifications rebuild (4 h),
grant charging (6–8 h), finance 3-panel (3 h), dashboard reflow
(2 h). Those are dedicated multi-hour chunks. Queue them as
distinct NEXT_WAVES.md rows.

---

## 8. How to update this plan when something lands

Each time an item ships:
- add the commit SHA in the relevant section
- mark with `✅ SHIPPED` and the release it ships in
- move remaining work into `docs/NEXT_WAVES.md` under the
  appropriate v-number

When all §3 items are ✅, this doc becomes the v2.0.0 release notes
scaffold.
