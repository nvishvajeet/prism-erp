# CATALYST — Component Library

> **Tomorrow's prompt:** "Make a finance portal."
>
> **Tomorrow's answer:** Open this doc, pick one **page pattern**, one
> or two **tile patterns**, one **data loader**, one **action
> handler**, add a **route**, and add a **crawler scenario**. Nothing
> new is invented. Everything is composed from the catalog below.
>
> This file is a catalog of what's already in the tree. Anything
> listed here is a safe component — it already passes the sanity wave
> and follows DATA_POLICY.md.

---

## Page patterns (choose one shape per new page)

| # | Pattern | When to use | Reference implementation |
|---|---|---|---|
| P1 | **Dashboard — tile grid with role hint** | Per-role landing or admin overview | `templates/dashboard.html` + `index()` app.py:3754 |
| P2 | **Detail page — lifecycle strip + conversation + actions** | A single record with multi-stage state | `templates/request_detail.html` + `request_detail()` app.py:4909 |
| P3 | **List page — filter bar + card grid + pagination** | A queryable collection with filters | `templates/instruments.html` + `instruments()` app.py:4220, or `templates/users.html` + `user admin` at `app.py:7500` |
| P4 | **Report page — KPI tiles + charts + table** | Stats / analytics / visualization | `templates/stats.html` + `stats()` app.py:7167 |
| P5 | **Calendar page — month grid + filter rail** | Time-based scheduling views | `templates/calendar.html` + `calendar()` app.py:7095 |
| P6 | **Admin control page — settings tile stack** | CRUD + toggles for a subsystem | `templates/user_detail.html` + `user_profile()` app.py:6605 |
| P7 | **Form page — single form + cancel** | Create/update a single record | `templates/new_request.html` + `new_request()` app.py:4720 |

All pages extend `base.html` and wrap their body in
`{% set V = viewer_kind %}`-style variables so the `data-vis="{{ V }}"`
safety net applies automatically.

---

## Tile patterns (pick 2–6 per page)

Tiles are the atomic composition unit. Every tile lives inside an
`<article class="card tile ...">` with a `data-vis="{{ V }}"` attribute.

| # | Tile | Used for | Where |
|---|---|---|---|
| T1 | **KPI tile** — one big number + label | Stats cards | `templates/stats.html` — `.tile-kpi` |
| T2 | **Role hint badge tile** — current role + next-action hint | Dashboard + sitemap header | `.tile-dash-role-hint`, `.tile-sitemap-role-hint` in `static/styles.css` |
| T3 | **Form tile** — single form for an action | Any detail or admin page | any `<form method="post">` wrapped in `.card.tile` |
| T4 | **Lifecycle strip** — horizontal step tracker | Request detail progress | `templates/request_detail.html` lifecycle_steps section |
| T5 | **Timeline tile** — vertical audit log | Request detail + instrument history | `request_timeline_entries()` app.py:612 rendered in `templates/request_detail.html` |
| T6 | **Approval chain tile** — step list with actor + action | Any approval workflow | approval chain tile in `templates/request_detail.html:~225` |
| T7 | **Conversation tile** — message thread + reply form | Request detail chat | `get_request_message_thread()` app.py:1779 rendered in request detail |
| T8 | **Attachment grid tile** — file cards with download/view/delete | Request detail + user profile | `request_card_visible_attachments()` + attachment macro |
| T9 | **Issue flag tile** — create + respond + resolve issue | Request detail | `get_request_issues()` + issue form |
| T10 | **Chip grid tile** — checkbox chips for multi-select | Layered role grant, instrument assignment | `.extra-role-chip` in `templates/user_detail.html` |
| T11 | **Metric chart tile** — chart + legend | Stats + visualizations | `templates/stats.html` + chart_rows helper |
| T12 | **Filter bar tile** — filter form above a list | List pages | `request_filter_values()` app.py:2001 + filter form in `templates/schedule.html` |
| T13 | **Quick-action row** — horizontal row of action buttons | Top of detail pages | button row at top of `templates/request_detail.html` |
| T14 | **Empty state tile** — friendly "no rows yet" | Every list page | `{% if not rows %}...{% endif %}` in all list templates |
| T15 | **In-place edit tile** — view-mode ↔ edit-mode toggle | Admin controls | `data-toggle-target` + `data-toggle-alt` pattern (grep `data-toggle-target`) |
| T16 | **Commentary tile** — LLM overnight narrative | Portfolio page | `pf.commentary` render in `templates/portfolio.html` |

---

## Macros — the promoted components

Import these at the top of any new template. Never inline their HTML.

| Macro | File | Renders |
|---|---|---|
| `person_chip(user_id, name, email=None, href=None)` | `templates/_page_macros.html:186` | User pill with link to `/users/<id>` |
| `status_pill(status)` | `templates/_request_macros.html` | Colored status badge |
| `role_badge(role)` | `templates/_page_macros.html` | Role label pill |
| `attachment_tile(attachment)` | `templates/_request_macros.html` | File card with type icon + size + download |
| `timeline_entry(entry)` | `templates/_request_macros.html` | One audit-log line with actor + timestamp |
| `approval_step(step, can_manage)` | `templates/_request_macros.html` | Approval row with remarks + reassign form |

Whenever you find yourself writing HTML that matches one of these, use
the macro instead. If you need a new component, **add it to
`_page_macros.html` or `_request_macros.html`, do not inline it.**

---

## Data loaders — call these, don't re-query

| Loader | File:line | Returns |
|---|---|---|
| `current_user()` | app.py:2529 | session user row |
| `user_access_profile(user)` | app.py:2664 | dict of what this user can see/do |
| `user_role_set(user)` | app.py:3626 | frozenset of primary ∪ layered roles |
| `visible_instruments_for_user(user)` | app.py:2914 | instruments this user is allowed to see |
| `request_scope_sql(user)` | app.py:2947 | (where-clauses, params) to scope any request query |
| `get_request_attachments(request_id)` | app.py:1747 | all attachment rows |
| `get_request_notes(request_id)` | app.py:1760 | dict by note_kind |
| `get_request_message_thread(request_id)` | app.py:1779 | full conversation rows |
| `get_request_issues(request_id)` | app.py:1812 | open + resolved issues |
| `request_timeline_entries(user, request_row, logs)` | app.py:612 | timeline with visibility filter already applied |
| `approval_candidate_options(role, instrument_id)` | app.py:1685 | valid approvers for reassign dropdown |
| `dashboard_analytics(user)` | app.py:2322 | KPI payload for dashboard tiles |
| `stats_payload(user, filters)` | app.py:2144 | full stats payload for `/stats` |
| `stats_payload_for_scope(...)` | app.py:2176 | scoped stats (per-instrument or per-group) |
| `calendar_events_payload(user, filters, start, end)` | app.py:6952 | JSON event feed for calendar widget |
| `dashboard_analytics(user)` | app.py:2322 | tile KPIs on dashboard |
| `instrument_groups_all()` | app.py:3677 | admin-curated instrument bundles |
| `instrument_group_member_ids(group_id)` | app.py:3686 | instrument ids in a group |

These loaders already apply RBAC scoping and DATA_POLICY rules. Call
them; don't roll your own `SELECT`.

---

## Action handlers — copy this shape for new POSTs

Every POST action lives inside a `request.method == "POST"` block in
the page's handler, dispatched by `action = request.form["action"]`.
Copy this shape:

```python
if action == "<new_action_name>":
    if not <permission_function>(user, target):
        abort(403)
    # 1. parse form
    field = request.form.get("field", "").strip()
    if not field:
        flash("Field is required.", "error")
        return redirect(url_for("<view_name>", id=<id>))
    # 2. mutate ONE table
    execute("UPDATE <table> SET <col>=?, updated_at=? WHERE id=?",
            (field, now_iso(), <id>))
    # 3. emit audit event
    log_action(user["id"], "<entity_type>", <id>, "<new_action_name>",
               {"field": field[:120]})
    # 4. flash + redirect
    flash("Saved.", "success")
    return redirect(url_for("<view_name>", id=<id>))
```

This shape is enforced by the sanity wave. Any action that skips
`log_action` will be caught by the lifecycle crawler.

---

## Permission helpers — use these, don't write ad-hoc checks

All of these live in `app.py` and are grepped via `^def can_`:

| Check | Where | Returns |
|---|---|---|
| `can_view_request(user, request_row)` | app.py:1281 | request visibility |
| `can_upload_attachment(user, request_row)` | app.py:1330 | upload gate |
| `can_delete_attachment(user, attachment, request_row)` | app.py:1348 | delete gate |
| `can_post_message(user, request_row)` | app.py:1356 | reply gate |
| `can_edit_request_note(user, request_row, note_kind)` | app.py:1367 | sticky note edit gate |
| `can_approve_step(user, step, instrument_id)` | app.py:2732 | approval gate |
| `can_flag_request_issue(user, request_row)` | app.py:1579 | issue raise gate |
| `can_respond_request_issue(user, request_row)` | app.py:1589 | issue respond gate |
| `can_view_user_profile(viewer, target_user)` | app.py:1597 | profile view gate |
| `can_manage_instrument(user_id, instrument_id, role)` | app.py:2823 | manage gate |
| `can_operate_instrument(user_id, instrument_id, role)` | app.py:2836 | operate gate |
| `can_access_stats(user)` | app.py:2998 | /stats gate |
| `can_access_schedule(user)` | app.py:3002 | /schedule gate |
| `can_access_calendar(user)` | app.py:3006 | /calendar gate |
| `can_manage_members(user)` | app.py:2724 | admin users gate |
| `can_use_role_switcher(user)` | app.py:2728 | dev role switch |
| `user_has_role(user, role)` | app.py:3647 | layered role membership check |
| `user_access_profile(user)` | app.py:2664 | full access dict |

**If you need a new permission check**, add a `can_<verb>_<noun>()`
function here. Do not inline the check in the handler.

---

## Worked example — "Make a finance portal"

Given tomorrow's ask: "Build a finance portal where finance_admin can
see all pending-finance-approval requests, approve or reject them in
bulk, and see finance KPIs (pending count, average approval time, SLA
breaches)."

**Step 1 — pick the page pattern.** P4 (Report page — KPI tiles +
charts + table) fits best. Copy the shape of `templates/stats.html`.

**Step 2 — pick the tiles.**
- T1 KPI tile × 3 (pending count, average time to approve, breaches)
- T12 filter bar tile (date range, instrument)
- T3 form tile wrapping a table of pending requests with checkboxes
  (bulk approve / bulk reject buttons)
- T11 metric chart tile (weekly approved-vs-pending)
- T6 approval chain tile reused for "recently approved" list

**Step 3 — pick the data loaders.** No new SELECT needed. Compose:
```python
# in a new handler finance_portal()
user = current_user()
if not user_has_role(user, "finance_admin") and not can_manage_members(user):
    abort(403)

# reuse stats_payload_for_scope for the KPIs
stats = stats_payload(user, report_filter_values())

# raw pending steps — one new small query, scoped
where_sql, where_params = request_scope_sql(user)
pending = query_all(
    "SELECT aps.*, sr.sample_name, sr.title, sr.instrument_id "
    "FROM approval_steps aps "
    "JOIN sample_requests sr ON sr.id = aps.sample_request_id "
    f"WHERE aps.status='pending' AND aps.approver_role='finance_admin' AND {' AND '.join(where_sql)} "
    "ORDER BY aps.created_at", tuple(where_params))

return render_template("finance_portal.html",
                       stats=stats, pending=pending,
                       can_manage=can_manage_members(user))
```

**Step 4 — pick the action handler shape.** Bulk approve reuses the
single-step approve_step logic in a loop:
```python
if action == "bulk_approve_finance":
    if not user_has_role(user, "finance_admin"):
        abort(403)
    step_ids = [int(x) for x in request.form.getlist("step_id")]
    for step_id in step_ids:
        step = query_one("SELECT * FROM approval_steps WHERE id = ?", (step_id,))
        if step and step["status"] == "pending" and step["approver_role"] == "finance_admin":
            execute("UPDATE approval_steps SET status='approved', acted_at=?, "
                    "approver_user_id=?, remarks=? WHERE id=?",
                    (now_iso(), user["id"], "bulk approved via finance portal", step_id))
            log_action(user["id"], "approval_step", step_id, "approve_step",
                       {"via": "finance_portal_bulk"})
    flash(f"Approved {len(step_ids)} finance steps.", "success")
    return redirect(url_for("finance_portal"))
```

**Step 5 — add the route.**
```python
@app.route("/finance", methods=["GET", "POST"])
@login_required
def finance_portal():
    ...
```

**Step 6 — add the crawler scenario.** Add one line to
`role_behavior.py`:
```python
# ---- finance_admin: finance portal ------------------------
with harness.logged_in("finance@lab.local"):
    resp = harness.get("/finance", follow_redirects=True)
    self._score(result, resp.status_code, "finance_admin: /finance")
```

**Step 7 — link from sitemap + dashboard.** Add a tile on dashboard
for finance_admin (role_hint detects role via `user_has_role(user,
"finance_admin")`). Add an entry to `sitemap.html`. Update
`ROLE_VISIBILITY_MATRIX.md` if you want the access matrix to assert
it.

**Total new code: one template, one handler, one permission check
(reused), one crawler line. ~2 hours.** Everything else is
composed from the catalog.

---

## What does NOT go in the component library

- Raw `<div class="foo">` markup — must be a macro
- Inline SQL in templates — always via a loader
- Ad-hoc role checks via `user["role"] == "finance_admin"` — always
  via `user_has_role()` or a `can_*()` helper
- New top-level routes for existing data — extend an existing page
  with a tile instead

When you find yourself violating one of these, promote the thing into
this catalog first, then ship the feature.

---

## How to extend this catalog

When you add a new component that is reusable:

1. If it's a **page pattern**, add a row to the "Page patterns" table
   with a reference implementation file:line.
2. If it's a **tile pattern**, add a row to the "Tile patterns" table
   with the CSS class and the template that first uses it.
3. If it's a **macro**, add it to `_page_macros.html` or
   `_request_macros.html` and add a row to the "Macros" table.
4. If it's a **data loader**, define it at the top of its engine's
   section in `app.py` and add a row to the "Data loaders" table.
5. If it's a **permission**, define it as `can_<verb>_<noun>()` near
   the other permission helpers and add a row to the "Permission
   helpers" table.

One row per component. File:line where it lives. One sentence of what
it returns. That's the whole contract.
