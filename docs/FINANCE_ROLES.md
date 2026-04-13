# Finance Role Model — Three-Tier Design

> Status: **Design draft** — no code changes yet.
> Date: 2026-04-12

---

## 1. Overview

CATALYST's finance module currently has a single flat role (`finance_admin`).
This document specifies a three-tier model that mirrors the instrument
portal's access pattern: entity-level ownership (PI), operational
processing (Officer), and full administrative control (Admin).

| Tier | Role name        | Analogy (instrument portal) | Scope              |
|------|------------------|-----------------------------|--------------------|
| 1    | `grant_pi`       | `instrument_admin`          | Own grant(s) only  |
| 2    | `finance_officer` | `operator`                 | All grants (process)|
| 3    | `finance_admin`  | `super_admin`               | Full control        |

---

## 2. Role Definitions

### 2.1 Grant PI (Principal Investigator)

A faculty member who **owns** one or more grants. Assigned per-grant,
exactly like instrument_admin is assigned per-instrument.

**Can:**
- View budget, spending, and charged samples for their own grant(s)
- Approve or reject charges to their grant (approval step, mirrors
  instrument approval config)
- View invoices and receipts tied to their grant

**Cannot:**
- View other PIs' grants or financial data
- Record payments, issue receipts, or create invoices
- Create, delete, or edit grant metadata

### 2.2 Finance Officer

Staff who processes day-to-day financial operations. Analogous to an
instrument operator — they execute work across all entities.

**Can:**
- View all grants, invoices, and receipts (read-all)
- Record payments against invoices
- Issue receipts and generate receipt references
- Create and edit invoices
- View charge history across all grants

**Cannot:**
- Create or delete grants (that is finance_admin territory)
- Approve charges (that is the PI's role)
- Modify grant ownership or PI assignments

### 2.3 Finance Admin (existing role, upgraded)

Broad oversight and configuration. Equivalent to super_admin scoped
to the finance module.

**Can:**
- Create, edit, and delete grants
- Assign and reassign Grant PIs to grants
- View all financial data across all grants
- Approve large expenditures (above a configurable threshold)
- Override or escalate stalled PI approvals
- Manage finance officer assignments

**Cannot:**
- Nothing within the finance module is restricted (full control)

---

## 3. Permission Matrix

| Action                        | grant_pi | finance_officer | finance_admin |
|-------------------------------|----------|-----------------|---------------|
| View own grant budget         | yes      | yes             | yes           |
| View all grant budgets        | —        | yes             | yes           |
| Approve charges (own grant)   | yes      | —               | yes           |
| Record payment                | —        | yes             | yes           |
| Issue receipt                 | —        | yes             | yes           |
| Create/edit invoice           | —        | yes             | yes           |
| Create/delete grant           | —        | —               | yes           |
| Assign Grant PI               | —        | —               | yes           |
| Override stalled approval     | —        | —               | yes           |
| View finance nav link         | yes      | yes             | yes           |

---

## 4. Grant-Level Access Model

Mirrors the instrument-level access pattern:

- `grants` table already has `grant_pi_user_id` (single PI per grant).
- New **`grant_admins`** join table (mirrors `instrument_admins`):

```sql
CREATE TABLE grant_admins (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    grant_id    INTEGER NOT NULL REFERENCES grants(id),
    user_id     INTEGER NOT NULL REFERENCES users(id),
    role        TEXT NOT NULL DEFAULT 'pi',   -- 'pi' or 'officer'
    created_at  TEXT NOT NULL,
    UNIQUE(grant_id, user_id)
);
```

- A user with a row in `grant_admins` where `role = 'pi'` can see and
  approve charges for that specific grant.
- The existing `grant_pi_user_id` column on `grants` remains as the
  canonical single-PI shortcut; `grant_admins` extends it for
  multi-PI grants in the future.

---

## 5. Approval Workflow

Charges to a grant follow the same pattern as instrument request
approval:

```
Charge submitted
  → PI approval required (grant_pi for that grant)
    → Approved  → Finance officer records payment → Receipt issued
    → Rejected  → Charge returned to requester with reason
```

- Configurable per-grant: `approval_required` flag (default true).
- Large expenditure threshold: charges above `N` require finance_admin
  approval in addition to PI approval (two-step).
- Stalled approvals (no PI action within configurable window) can be
  escalated by finance_admin.

---

## 6. Nav Visibility

The `/finance` nav link appears for all three roles, but the landing
page scope differs:

| Role             | Finance landing page shows               |
|------------------|------------------------------------------|
| `grant_pi`       | Only their grant(s) — budget, charges    |
| `finance_officer` | All grants — processing queue, invoices |
| `finance_admin`  | All grants + admin panel (create/delete) |

The `module_enabled('finance')` gate in `base.html` remains the
top-level toggle. Within the finance pages, `request_scope_sql()`
style filtering narrows visibility by role.

---

## 7. Schema Changes Summary

| Change                          | Type   | Migration needed |
|---------------------------------|--------|-----------------|
| `grant_admins` table            | New    | Yes             |
| `users.role` enum: add values   | Alter  | Yes (add `grant_pi`, `finance_officer`) |
| `grants.approval_required`      | New col| Yes (default 1) |
| `grants.large_threshold`        | New col| Yes (default NULL = no threshold) |

No changes to the existing 15-table hard schema — `grant_admins` is
a new 16th table, which requires a major version bump per the
hard-attribute contract in `docs/PHILOSOPHY.md`.
