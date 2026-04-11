# Role-Visibility Matrix

Comprehensive map of every page and UI element to the roles that can see/access it. Generated from role-based crawl on 2026-04-09.

## Roles

| Abbr | Role | Description |
|------|------|-------------|
| REQ | `requester` | External users who submit samples |
| FIN | `finance_admin` | Finance office staff |
| PROF | `professor_approver` | Faculty approvers |
| FIC | `faculty_in_charge` | Faculty assigned to instruments |
| OP | `operator` | Instrument operators |
| IA | `instrument_admin` | Instrument-level admins |
| SA | `site_admin` | Site-wide admin |
| SU | `super_admin` | Full system admin |
| OWN | `owner` | Email-based owner (all access) |

**Note**: REQ, FIN, and FIC can gain instrument-area access if they have instrument assignments (via `instrument_operators`, `instrument_admins`, or `instrument_faculty_admins` tables). When they do, they see the expanded nav and instrument queues but NOT operator actions.

---

## 1. Page-Level Access

| Page | REQ | FIN | PROF | FIC | OP | IA | SA | SU | OWN |
|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Home `/` | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Instruments `/instruments` | * | - | Y | * | * | * | Y | Y | Y |
| Instrument Detail `/instruments/<id>` | * | - | Y | * | * | * | Y | Y | Y |
| Queue `/schedule` | * | - | Y | * | * | * | Y | Y | Y |
| Calendar `/calendar` | * | - | Y | * | * | * | Y | Y | Y |
| Statistics `/stats` | * | - | Y | * | * | * | Y | Y | Y |
| Map `/sitemap` | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| New Request `/requests/new` | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| Request Detail `/requests/<id>` | own | scope | Y | scope | scope | scope | Y | Y | Y |
| Admin Users `/admin/users` | - | - | - | - | - | - | - | Y | Y |

`*` = only if user has instrument assignments · `own` = own requests only · `scope` = scoped to assigned instruments

---

## 2. Navigation Bar

### Roles WITHOUT instrument access (REQ, FIN without assignments)
- Home, Queue, Map, New Request

### Roles WITH instrument access (PROF, OP, IA, SA, SU, OWN, or REQ/FIN/FIC with assignments)
- Home
- Instruments (if `can_access_instruments`)
- Queue (if `can_access_schedule`)
- Calendar (if `can_access_calendar`)
- Statistics (if `can_access_stats`)
- Map
- New Request

---

## 3. Dashboard (`/`)

### Stats Cards (This Week / This Month)
Shown to roles with `can_access_stats`. Hidden for pure REQ and FIN.

### Instrument Queues Section
Shown when `has_instrument_area_access AND instrument_fifo_queue` has data.

| Element | Who sees it |
|---------|-------------|
| Quick-intake panel (Assign/Accept) | OP, IA, SA, SU, OWN — roles with `can_operate_queue` |
| Instrument queue cards (read-only) | Anyone with instrument area access |
| "Open Queue" button | Anyone with instrument area access |

### Your Jobs Card
Shown when user does NOT have instrument area access (pure REQ, FIN).

---

## 4. Instruments Page (`/instruments`)

| Element | Who sees it |
|---------|-------------|
| Full instrument table (all instruments) | PROF, SA, SU, OWN (`can_view_all_instruments`) |
| Scoped instrument table (assigned only) | OP, IA, FIC, REQ with assignments |
| "+" Add Instrument button | SU, OWN (`can_add_instrument`) |
| Instrument links (Queue/Calendar/History) | Users who can open that instrument's detail |
| "Restricted" label in Links column | Users who can't access that specific instrument |
| Archived Instruments section | SU, OWN (`can_view_archived`) |

---

## 5. Queue Page (`/schedule`)

| Element | Who sees it |
|---------|-------------|
| Filter pills (All/Pending/Approvals/etc.) | All who can access page |
| Search bar, instrument/date/sort filters | All who can access page |
| REQUEST, INSTRUMENT, STATUS, REQUESTER, TIME, FILE columns | All who can access page |
| ACTION column (Assign dropdown) | OP, IA, SA, SU, OWN (`can_operate_queue`) |
| "Approvals" pill | All (but count reflects scoped data) |
| Data scope | PROF, SA, SU, OWN see all · others see assigned instruments |

---

## 6. Calendar Page (`/calendar`)

| Element | Who sees it |
|---------|-------------|
| Instrument filter pills | All who can access page |
| Status filter pills | All who can access page |
| Operator dropdown | All who can access page |
| Week/Month/Day view toggle | All who can access page |
| Calendar events | Scoped to user's instruments (or all for PROF/SA/SU/OWN) |

---

## 7. Statistics Page (`/stats`)

| Element | Who sees it |
|---------|-------------|
| Operations Control counters | All who can access page |
| Instrument Status Board tiles | All who can access page |
| Throughput Trend chart | All who can access page |
| Status Breakdown chart | All who can access page |
| Instrument Stats table | All who can access page |
| Weekly Stats table | All who can access page |
| Data scope | Scoped per role's instrument access |

---

## 8. Request Detail (`/requests/<id>`)

| Field | REQ | FIN | PROF | FIC | OP | IA | SA | SU |
|-------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Remarks | Y | Y | Y | Y | Y | Y | Y | Y |
| Results Summary | Y | - | Y | Y | Y | Y | Y | Y |
| Submitted Documents | Y | Y | Y | Y | Y | Y | Y | Y |
| Conversation | Y | Y | Y | Y | Y | Y | Y | Y |
| Events | Y | Y | Y | Y | Y | Y | Y | Y |
| Requester Identity | Y | - | Y | Y | Y | Y | Y | Y |
| Operator Identity | Y | - | Y | Y | Y | Y | Y | Y |

### Actions

| Action | REQ | FIN | PROF | FIC | OP | IA | SA | SU |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Reply | Y | Y | Y | Y | Y | Y | Y | Y |
| Upload Attachment | Y | Y | Y | Y | Y | Y | Y | Y |
| Mark Submitted | Y | - | - | - | - | - | - | - |
| Finish Fast | - | - | - | - | Y | Y | Y | Y |
| Reassign | - | - | - | - | Y | Y | Y | Y |
| Mark Received | - | - | - | - | Y | Y | Y | Y |
| Update Status | - | - | - | - | - | Y | Y | Y |

---

## 9. Instrument Detail (`/instruments/<id>`)

| Element | Who sees it |
|---------|-------------|
| Machine info card (left) | All who can access |
| Queue card (right) | All who can access |
| Control panel | Users who `can_manage_instrument()` for this instrument |
| Edit instrument fields | IA (if assigned), SA, SU, OWN |
| Operator/Faculty assignment | SA, SU, OWN |
| Archive/Restore | SU only |
| Approval config | SU, OWN |
| "Create New Request" button | All who can access |
| Hover back button | All who can access |

---

## 10. Admin Users (`/admin/users`)

| Element | SU | OWN |
|---------|:---:|:---:|
| Create/Invite User form | Y (OWN only creates) | Y |
| Members table | Y | Y |
| Elevate Member action | Y | Y |
| Delete Member action | Y | Y |
| Admins table | Y | Y |
| Owners table | Y | Y |

---

## 11. data-vis System

The `data-vis` attribute is set on all elements to `{{ V }}` which includes all roles. The client-side JS (base.html line 189-198) checks `document.body.data-user-role` against each element's `data-vis` list and hides mismatches with `display: none`.

**Current state**: Since `V` includes all roles, `data-vis` is effectively a no-op — all elements are visible to all roles. Real visibility is controlled server-side via Jinja conditionals and Python route guards.

**Future use**: To use `data-vis` for fine-grained client-side filtering, set specific role lists on individual elements instead of `{{ V }}`.

---

## Bugs Fixed During Crawl

1. **Instruments page crash** — `sqlite3.Row.get()` not supported. Fixed: use bracket access `instrument["location"]` instead.
2. **Dashboard Assign/Accept visible to non-operators** — Quick-intake forms showed to all users with instrument access. Fixed: only pass `pending_receipt_lookup_rows` and `operators` when `can_operate_queue` is True.
3. **`faculty_in_charge` missing from ROLE_ACCESS_PRESETS** — Fell back to requester preset (fully locked down). Fixed: added as proper preset with instrument access + stats + read-only queue permissions.
4. **`faculty_in_charge` missing from admin role dropdowns** — Added to both Create User and Elevate Member selects in users.html.
