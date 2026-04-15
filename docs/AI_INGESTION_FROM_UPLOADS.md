# AI ingestion from uploads — post-mortem and target flow

**Trigger**: Kondhalkar (user 9, instrument_admin) uploaded
`data/<runtime-lane>/<runtime-instance>/ai_uploads/9/2026-04-15_Instrument_list_with_operator_name.xlsx`
via the in-app AI upload form on 2026-04-15 12:45. The file sat in the
directory for ~45 minutes; nothing in CATALYST processed it. A human
then asked an external AI agent to "crawl the request and work on it".
The agent parsed the xlsx, reverse-engineered the schema, and wrote
directly to the DB. This doc captures what that should have been, and
the smallest steps to get there.

## What actually happened

1. File landed in `data/<runtime-lane>/<runtime-instance>/ai_uploads/9/`. No app-side hook fired.
2. No record in any queue, audit, or notification table.
3. An AI agent was invoked *manually* (by a human, outside the app).
4. Agent wrote **14 rows** of live data via raw SQL:
   - 6 new `users` rows (operators)
   - 1 new `instruments` row (INST-022)
   - 14 new `instrument_operators` links
5. First attempt got `invite_status` wrong (`pending` vs the correct
   `pending_approval` — the canonical value used at `app.py:18536`
   inside `bulk_create_users`). Human had to catch and flag it.
6. Only the 6 users ended up in an approval-gated state. The new
   instrument and the 14 operator↔instrument links bypassed every
   approval gate because **CATALYST has no approval gate for those**.
7. No `audit_logs` entry was written — the manual SQL path skipped
   `log_action(...)` that the app's own code paths use.
8. No notification to Kondhalkar ("your upload is being processed"),
   no notification to admins ("new proposal awaiting review"), no
   notification to the affected operators ("you've been added").

## Gaps, ranked by blast radius

| # | Gap | Blast radius |
|---|-----|--------------|
| A | Uploads aren't coupled to any processing pipeline — they just sit in a folder | High — the work only happens if a human remembers |
| B | No typed proposal record — every import is bespoke | High — same bugs will recur per-submission |
| C | `instruments` and `instrument_operators` have no approval gate | Medium — a malicious or mistaken upload creates live data |
| D | No audit trail for AI-initiated writes | Medium — can't answer "who added INST-022?" |
| E | Invite state machine isn't documented anywhere the next AI (or new teammate) can find it | Medium — caused the initial `pending` vs `pending_approval` bug |
| F | No notifications — neither submitter, admin, nor affected users are informed | Low-medium — usability |

## Target flow (AI + human oversight, not AI unchecked)

Four stages, each small:

```
  upload form                  ↓ POST /ai/upload
  ------------                 ↓
  1. INGEST  →  file saved + ai_upload row created (status=received)
                ↓
  2. EXTRACT →  worker reads file, produces typed proposal JSON:
                  { users:[{action:create, name, email, short_code, role, matched_existing:false}],
                    instruments:[{action:match_existing, code:INST-001, confidence:0.98}, …],
                    links:[{operator:"RKA", instrument:"INST-001"}, …] }
                ↓ ai_import_proposals.status = pending_review
  3. REVIEW  →  admin opens /ai/imports/<id>; sees diff; clicks Approve
                ↓
  4. APPLY   →  run through the app's own bulk_create_users +
                (new) bulk_create_instruments + (new) bulk_link_operators
                each logs via log_action() and fires notifications
```

**Non-negotiable**: stage 4 must call the app's *existing* code paths
(or new well-factored functions), not hand-rolled SQL. That's how the
state machine stays consistent.

## The smallest concrete next steps

1. **Document the invite-state contract** — add a ten-line section to
   `docs/ARCHITECTURE_DEEP.md` (or a new `INVITE_LIFECYCLE.md`) naming
   the exact values and transitions: `pending_approval → active`,
   `active → archived`. One grep-able source of truth so the next AI
   doesn't re-derive it from `app.py`.
2. **Log action on AI uploads** — wherever `/ai/upload` writes the
   file, also `log_action(user_id, "ai_upload", …, "uploaded", {path})`.
   One-line change. Closes gap D for this path immediately.
3. **Add a `pending_ai_imports` badge** to the admin nav, populated
   from the existing `ai_pane_log` table (or a new lightweight one).
   Give admins visibility without needing to go hunt files.
4. **Ship a minimal extract-worker** — one Python module
   (`crawlers/ai_extract_upload.py`) that takes an xlsx path and
   returns a proposal JSON. Don't wire it to UI yet — just expose it
   as a CLI so admins can run `python -m crawlers.ai_extract_upload
   data/<runtime-lane>/<runtime-instance>/ai_uploads/9/<file>` and see the proposal in the terminal.
   Half a day of work, zero UI surface.

Stages 3 (REVIEW UI) and 4 (APPLY via existing paths) are bigger.
Ship 1–4 above first, then re-evaluate.

## The Kondhalkar import specifically

- Backup: `data/demo/lab_scheduler.db.bak-kondhalkar-import-20260415_131650`
- 6 users in `pending_approval` — will appear in the admin queue via
  `app.py:18677-18685` next time a site_admin opens the Members page.
- INST-022 and 14 operator↔instrument links are **live**, bypassed
  every gate. If we later add an approval gate for instruments /
  operator-links, these should be retroactively treated as
  "grandfathered approved" with an audit note.
