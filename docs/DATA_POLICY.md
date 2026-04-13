# CATALYST — Data Management Policy

> **One source of truth. Held in one place. Shown in many.**
>
> This document is the contract that keeps CATALYST from drifting into the
> state where "the instrument name on page A doesn't match the one on
> page B." If you ever find yourself tempted to cache, duplicate, or
> mirror a piece of canonical data, read this doc first.

---

## The six rules

### Rule 1 — Every fact has exactly one home
Every piece of data in CATALYST has exactly one **owning table and
column**. All other places that show that fact are **views**, not
copies. If you need the fact, you `JOIN` to the owning table — you do
not re-store it.

Canonical homes (memorize these):

| Fact | Owning table.column | Anywhere else |
|---|---|---|
| Primary role of a user | `users.role` | nowhere — `user_roles` is a layered *superset* |
| Extra roles a user holds | `user_roles(user_id, role)` | nowhere — `users.role` is never a substitute |
| Who owns / operates / faculty-manages an instrument | `instrument_admins`, `instrument_operators`, `instrument_faculty_admins` | nowhere — instruments don't store owner id |
| Current status of a request | `sample_requests.status` | derived via `request_status_group()` app.py:469 for UI bucketing only |
| Approval progress of a request | `approval_steps` (one row per step) | `sample_requests.status` never stores `finance_approved` etc. — that's derived from `approval_steps` |
| Actor of an approval action | `approval_steps.acted_at` + `approval_steps.remarks` | **currently missing**: actor user_id — see MODULES.md E5 gaps |
| Instrument approval chain configuration | `instrument_approval_config(instrument_id, step_order, approver_role, approver_user_id?)` | `create_approval_chain()` app.py:940 reads this on every submit — never cached |
| Instrument active/archived | `instruments.is_active` | no boolean mirror elsewhere |
| Audit trail | `audit_logs` (hash-chained) | displays build timelines via `request_timeline_entries()` app.py:612 — read-only projection |
| Files attached to a request | `request_attachments` + on-disk `data/.../requests/<id>/attachments/` | filesystem is *mirror* of table rows; table is authoritative |
| Messages / notes on a request | `request_messages` | — |
| Issues flagged on a request | `request_issues` | — |
| Announcements | `announcements` | — |
| User → instrument grant shortcut | `instrument_group` / `instrument_group_member` | these are **bundles only** — they never grant permission directly, they populate the junction tables above on save |

### Rule 2 — Displays are views, not state
A template that shows a fact must compute it from the owning table at
render time (or accept it via a freshly-fetched dict keyed by id). It
**must not** read a cached copy from a different table.

*Example.* The role pill shown on the dashboard reads
`current_role_display` in `inject_globals()` app.py:3698, which derives
from `users.role`. The role chips on `/users/<id>` read from
`user_role_set(target_user)` app.py:3626, which joins `users.role` ∪
`user_roles`. Both derive from the same home; neither is cached.

### Rule 3 — Mutations go through a single handler
Every fact has exactly one handler that writes it. If two handlers
update the same column, one of them is wrong.

Current single-write rules:

| Fact | Write path |
|---|---|
| `users.role` (primary) | `change_role` action in `user_profile()` app.py:6658 — and that handler also calls `grant_user_role()` app.py:3651 to keep the junction in sync |
| `user_roles` rows | `update_user_role_set` action app.py:6696 (via `grant_user_role` / `revoke_user_role`) |
| `sample_requests.status` | `assert_status_transition()` app.py:443 is the gate; every status-mutating branch in `request_detail()` must call it (search `assert_status_transition` to audit) |
| `approval_steps.status` | `approve_step` app.py:5213 and `reject_step` app.py:5243 only |
| `instruments.*` | `update_metadata` / `update_operation` / `save_approval_config` in `instrument_detail()` |
| `instrument_admins` etc. | `sync_instrument_assignments()` app.py:2936 — never direct `INSERT` |

If you add a new write path for any of these, you are making a bug.
Extend the existing handler instead.

### Rule 4 — Every write emits one audit event
Every mutation calls `log_action()` app.py:284 with:
- actor_id (from `current_user()` session)
- entity_type + entity_id (the row changed)
- action name (snake_case verb, e.g. `"approve_step"`, `"update_metadata"`)
- payload dict (the fields that changed — small, no secrets, no full blobs)

This is how the timeline on request detail, the instrument history
page, and the user history page all get populated from a single
source. **If you skip `log_action` you break the timeline.** The
audit table is hash-chained via `verify_audit_chain()` app.py:307 for
tamper-evidence — don't retroactively rewrite rows.

### Rule 5 — Derivations are functions, not columns
If a value can be computed from other columns, it is a function call,
not a stored column. This keeps the database normalized and the
derivations consistent.

| Derived value | Function (not a column) |
|---|---|
| Display status of a request | `request_display_status()` app.py:386 |
| Bucket (submitted/active/done/rejected) | `request_status_group()` app.py:469 |
| Card policy per viewer | `request_card_policy()` app.py:1563 |
| Visible attachments for viewer | `request_card_visible_attachments()` app.py:1476 |
| Whether a step is actionable | `approval_step_is_actionable()` app.py:1025 |
| Instrument visibility per user | `visible_instruments_for_user()` app.py:2914 |
| User access profile | `user_access_profile()` app.py:2664 |

**Exception — performance.** Only if profiling shows the derivation is
a measurable hot path (> 50 ms per call, flagged by `slow_queries`
crawler) do we consider caching. In that case:
1. Add a memoization within a single request handler (dict keyed by id).
2. Never persist the cache across requests.
3. Never write a "cached copy" column to the owning table.

### Rule 6 — Schema is additive only
New columns and new tables are allowed. Column renames, column
deletions, and type changes are **forbidden** without a full
ROADMAP-scale migration plan. This is PHILOSOPHY.md §2 and it is what
lets us ship weekly without breaking existing rows.

When you add a new column:
1. Add it to `init_db()` via an `ALTER TABLE` guarded by a `try/except
   OperationalError` so it's idempotent.
2. Default it to a backfillable value (NULL or a safe constant).
3. Update the writer handler (Rule 3) to populate it on new rows.
4. Update the reader helper (Rule 5) to expose it to templates.
5. Add a crawler assertion that the new column is never NULL after a
   write (sanity or lifecycle wave).

---

## The "shown in many" side — how to render without duplication

When you put the same fact on multiple pages, all of the following
must be true:

1. **One loader.** There is one function in `app.py` that fetches the
   fact. All pages call this function — not their own bespoke query.
   Example: `get_request_attachments()` app.py:1747 is called by the
   request detail page, the admin history page, and the export
   generator. None of them write their own `SELECT * FROM
   request_attachments`.
2. **One template partial.** There is one macro in
   `templates/_request_macros.html` or `templates/_page_macros.html`
   that renders it. All pages `{% import %}` that macro. No page
   inlines its own copy of the HTML. This is how the `person_chip`,
   `status_pill`, `role_hint_badge`, and `attachment_tile` components
   work today.
3. **One label helper.** Any string that depends on the fact (e.g.
   "Approved by finance on 2026-03-19") is computed in one helper
   (`timeline_action_label()` app.py:574, `approval_role_label()`
   app.py:399, `note_kind_label()` app.py:1360). Templates call the
   helper — they do not build the string themselves.

If you find yourself writing the same f-string in two templates,
promote it to a helper before shipping.

---

## Audit checklist before shipping a new feature

Run through this list before every commit that touches data:

- [ ] Does my new fact have exactly one owning table.column? (Rule 1)
- [ ] Are all displays pulling from that column at render time? (Rule 2)
- [ ] Is there exactly one handler that writes this fact? (Rule 3)
- [ ] Does that handler call `log_action()` with a stable action name? (Rule 4)
- [ ] Are any derived strings expressed as functions, not stored? (Rule 5)
- [ ] If I added a column, is the migration additive and idempotent? (Rule 6)
- [ ] Is there exactly one loader + one template macro + one label helper? ("shown in many")
- [ ] Did I add a crawler assertion (sanity or lifecycle wave)?
- [ ] Does `python -m crawlers wave sanity` stay green?

If any of these is "no", the change is not ready to commit.

---

## What this policy buys us

- **No drift.** Every page shows the same value because every page
  reads the same home.
- **Fast feature composition.** Tomorrow's "finance portal" is a new
  template that imports existing macros + calls existing loaders. Zero
  new state.
- **Safe refactors.** A new owning handler is additive — the old one
  can be deprecated on its own schedule.
- **Trustworthy audit.** The hash-chained `audit_logs` is the one
  place that records history; everything else is a projection.
- **Cheap testing.** The crawler suite already asserts most invariants
  because they derive from single sources.

When in doubt: **one fact, one home, one writer, one loader, one
macro, one label.** Everything else is a view.
