# UI crawl findings — Lab ERP × 9 roles · Ravikiran static review

> Generated 2026-04-15 by crawling every role × ~25 pages on Lab
> ERP via `app.test_client()`, plus a static template review of
> Ravikiran. This is the punch list; fixes land later in bounded
> commits.

## Methodology

- **Lab ERP**: logged in as 9 personas (owner, super_admin × 2,
  site_admin, instrument_admin, finance_admin, professor_approver,
  operator, requester) against 25 routes each.
- **Ravikiran**: templates on mini inspected read-only; app not
  serving, so no live crawl possible.
- **Severity**: 🔴 live bug · 🟡 UX friction · 🟢 polish.
- **Scope**: UI / navigation only. Schema, data, and infra live
  elsewhere (`ERP_TOPOLOGY.md`, `ROLE_SURFACES.md`).

## Cross-cutting findings — all roles affected

### 🔴 1. Nikita is locked out of everything

On the demo DB seeded by `populate_live_demo`, **`nikita` is
active but every route redirects to `/profile/change-password`**.
`must_change_password=1` is presumably set somewhere in seed. Until
she finishes the forced password change she can't reach Help,
Home, anything. She cannot even navigate around to learn what the
app is — the redirect catches every GET.

**Fix**: either drop `must_change_password=1` at seed (the
operational DB doesn't have her at all anyway), or let `/help`
and `/` bypass the must-change-password gate so a first-login user
can at least read the onboarding page before being forced to the
password form.

### 🔴 2. `role_manual` endpoint is broken in nav

`templates/base.html:263` checks `endpoint in ['user_profile',
'admin_users']` for the Settings breadcrumb — fine. But other
templates reference `url_for('role_manual')` implicitly; the route
does not exist (function is defined differently). Live crawl
shows `/role_manual` → 404 for every role. If anything in the
codebase links to this endpoint name, it throws BuildError.

**Fix**: search for `url_for('role_manual')` and repoint at `/help#role-guide` or remove
the link.

### 🟡 3. Admin module is owner-only in nav

Previously identified (see `ROLE_SURFACES.md` §4):
`MODULE_REGISTRY["admin"].nav_access = lambda ap, is_owner: is_owner`
restricts the entire Admin nav group to the owner role. Site
admins, super admins, and instrument admins type `/admin/users`
directly (it returns 200 for them) but have no visible link.
Kondhalkar explicitly complained about this ("user management
portal is not seen anymore").

**Fix**: widen `nav_access` to `is_owner or ap["can_create_users"]`.

### 🟡 4. `/portals` redirects to `/` for every role

Every role gets `302 → /` from `/portals`. The portal switcher is
either silently disabled or only accepts specific portal slugs. If
the user is mapped to only one portal, `/portals` should either
(a) show just that one portal and do nothing, or (b) 404 with a
message. Silent redirect to home is confusing.

**Fix**: if only-one-portal, show the portal picker anyway with
that single option ("You are in: Lab ERP") and a link to switch
if other portals exist — same pattern as the login "Choose ERP"
entry page.

### 🟡 5. `/getting_started` (with underscore) is 404; `/getting-started` (hyphen) works

Minor, but any accidentally-typed or old-URL bookmark hits the
underscore form and fails. The route defines both `/help` and
`/getting-started` (hyphen) but not the underscore variant.

**Fix**: add `@app.route("/getting_started")` as a third alias
(one-line change).

### 🟢 6. Role-gated pages all show the same "Access Restricted" stub

Crawler saw `403` for legitimate gating, but the page body is just
"Access Restricted" with no explanation or next-step link. A
professor_approver hitting `/finance` gets the same empty page as
a requester hitting `/admin/users`. Different mental states,
same dead end.

**Fix**: make the 403 page dynamic — show *why* this was blocked
("Finance reports are for finance_admin and super_admin; you are
a professor_approver"), plus a primary CTA back to the role's
actual landing page.

## Per-role surface audits

### Owner

- Home page loads; all nav visible. No issues.
- **🟢 Home has a "dev_panel_readability" indicator** — good; keeps
  the dev mental model surfaced.

### super_admin — Dean (`dean@catalyst.local`)

- 15 of 25 routes OK. 10 routes 404 (but most are aliases or routes
  living at different paths like `/payments/books`, `/leave/new`).
- **🟡 `/vendors` returns 404 for Dean but 200 for owner.** Same
  module, different role, same HTTP path. Module-gate mismatch.
  Owner gets the whole cake, super_admin shouldn't be filtered out
  of vendor admin — they're supposed to oversee it.
- **🟢 `/complaints` 404** — if this module is planned for this
  role, either wire the route or remove it from the role's menu.
  Right now the complaints schema exists but the UI path doesn't.

### super_admin — Nikita (`nikita`)

- See cross-cutting #1: **locked out of everything.**

### site_admin (`siteadmin@catalyst.local`)

- Similar set of working/broken as super_admin Dean.
- **🟡 Sees `/admin/users` (as it should), but nav doesn't
  advertise it** (cross-cutting #3).

### instrument_admin (Kondhalkar)

- Same set. Type-in `/admin/users` works; nav hidden.
- **🟡 New 6 R&D operators sitting in `pending_approval` on
  operational DB** — but Kondhalkar can't find the queue screen
  without being told "type /admin/users". The Action Queue
  (`ROLE_SURFACES.md` §4) fixes this.
- **🟢 Cannot access `/finance`** — correct. But also no module
  visible in nav for "operators I supervise" — only the instrument
  detail page. Worth surfacing a dedicated "my operators" tile.

### finance_admin (Meera)

- `/admin/users` gated 403 — **consistent with role contract**.
- Hits `/finance` correctly.
- **🟢 `/vendors` 404** — vendors are a finance-adjacent concept.
  Finance admin should at least be able to see the vendor list.

### professor_approver

- Correctly gated on `/admin/users`, `/finance`.
- **🟢 Still has `/stats` and `/calendar` access** — good.
- **🟢 No visible "pending approvals assigned to me" tile on
  home.** The existing approval_steps logic is there but the
  professor lands on the generic dashboard. They should see
  pending approvals first.

### operator (Anika)

- **🔴 Has `/finance` access (200)** — operators are not supposed
  to see finance reports. Privilege creep.
- `/admin/users` correctly gated.
- **🟢 No dedicated "my instruments" landing** — operator lands on
  same dashboard as everyone else; could be role-specialised.

### requester (User One)

- Correctly gated: `/schedule`, `/stats`, `/instruments`,
  `/finance`, `/calendar`, `/admin/users` all 403.
- **🟢 `/sitemap` (Settings) 200** — minor: shows admin links that
  do nothing when clicked because of role gates. Filter the
  sitemap to role-accessible items only.
- **🟢 `/inbox` and `/notifications` both accessible** — both
  exist, unclear which is the "main" inbox for a requester.
  Consolidate or name them clearly.

## Ravikiran static template review

Ravikiran's template set mirrors CATALYST (same `base.html`,
`dashboard.html`, `login.html`, `finance.html`, etc. — it's an
older fork). Because the Ravikiran server isn't running, I could
only inspect templates on disk:

- `login.html` is 38 lines vs CATALYST's 57 → missing the
  entry-page hint cards, the demo prefill, and the Google OAuth
  block. Not a bug — Ravikiran doesn't need those — but the
  login UX is simpler than CATALYST's.
- **🟡 Templates include `admin_attendance.html`, `admin_leave.html`,
  `admin_mailing_lists.html`, `admin_notices.html`, `finance.html`,
  `finance_grant_detail.html`** — all present but unlinked until
  the app serves. When Ravikiran goes live, do a fresh role crawl.
- **🟢 `dashboard.html` is 391 lines** — CATALYST's is in the same
  ballpark (~420). The dashboards are structurally similar; a UI
  improvement to CATALYST's dashboard should port cleanly.

Ravikiran-specific findings will come once the app is serving.
Put this on the open-items list; see `ERP_TOPOLOGY.md` "Open
work toward full silo" §3.

## Prioritised fix list (when the window opens)

1. **🔴 Nikita lock-out** — one-line seed fix: drop the
   `must_change_password=1` or let `/help` bypass.
2. **🔴 `/admin/users` invisible in nav** — widen admin module
   `nav_access`, covered by `ROLE_SURFACES.md` plan.
3. **🔴 Operator sees finance** — tighten the `/finance` role gate.
4. **🟡 `/portals` silent-redirect** — show single-portal state.
5. **🟡 Vendor/complaints/leave module-gating inconsistent** —
   audit MODULE_REGISTRY access lambdas.
6. **🟡 403 page is blank** — role-aware error page.
7. **🟢 Sitemap shows unreachable admin links to requesters** —
   filter by role.
8. **🟢 Role-specialised dashboards** — professor/operator/requester
   each could benefit from a dedicated landing, not the generic one.

Each of the 🔴 items is a single bounded commit. The 🟡 ones
benefit from coordinated review with another agent (module-access
lambdas are shared across roles). The 🟢 items are
design-polish-grade; queue for a dedicated UX pass.
