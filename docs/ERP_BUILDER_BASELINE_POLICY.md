# ERP Builder Baseline Policy

**Scope:** Every tenant spawned from the ERP builder (`~/Documents/Scheduler/Main/`, the canonical source).
**Status:** MANDATORY — operator directive 2026-04-17 16:10 Paris.
**Version:** 1.0.0 (2026-04-17)

This document codifies the minimum baseline every new tenant MUST inherit from the builder at spawn time. No tenant is valid without meeting all requirements here.

---

## Required at spawn

### 1. tenant_tag on all user-owned tables

Every table that holds per-tenant data MUST have a `tenant_tag TEXT NOT NULL` column with a default matching the tenant's tag:

| Table | tenant_tag default |
|---|---|
| users | `<tenant>` |
| instruments | `<tenant>` |
| sample_requests | `<tenant>` |
| payments | `<tenant>` |
| vendors | `<tenant>` |
| grants | `<tenant>` |
| vehicles | `<tenant>` |
| attendance | `<tenant>` |
| sample_request_payments | `<tenant>` |

The builder's `init_db()` already carries these columns. Any new table added to the builder that holds user-owned data MUST also receive `tenant_tag` at creation time.

### 2. TENANT_TAG runtime variable

`app.py` (or the tenant wrapper) MUST derive `TENANT_TAG` from `PROJECT_FILE_STEM` or an env override:

```python
TENANT_TAG = os.environ.get("CATALYST_TENANT_TAG",
    PROJECT_FILE_STEM.replace("_erp", "").rstrip("_")) or "lab"
```

`PROJECT_FILE_STEM` is derived from the DB filename — `lab_erp_...` → `lab`, `ravikiran_erp_...` → `ravikiran`. A new tenant `acme_erp_...` → `acme` automatically.

### 3. Scoped SELECT queries

Every `SELECT … FROM <tenant_table>` MUST include `WHERE tenant_tag = ?` (or `AND tenant_tag = ?`). Cross-tenant reads are a **data isolation violation**.

The pre-receive CI gate (`scripts/check_tenant_scoping.py`) enforces this. In soft-warn mode initially; escalates to `--hard-fail` once legacy query paths are fixed.

### 4. init_db() on every gunicorn worker import

`app.py` must run `init_db()` at module scope (not just in `if __name__ == "__main__"`):

```python
else:
    if os.environ.get("LAB_SCHEDULER_SKIP_INIT_DB") != "1":
        init_db()
```

This closes the schema-drift class of bugs where a new deploy with new columns lands on gunicorn workers that never ran `init_db()`.

### 5. Runtime root env vars

The tenant's service launcher MUST export:
- `<TENANT>_ERP_RUNTIME_ROOT=<path>` — the gunicorn working directory
- `<TENANT>_ERP_DATA_DIR=<path>/data` — the DB and upload root

Generic names (`CATALYST_DATA_DIR`) are fallbacks only. The Mini deploy hook aborts if `<TENANT>_ERP_RUNTIME_ROOT` is not set.

### 6. Session cookie namespaced per tenant

Flask session cookie name MUST differ per tenant. It is derived from `PROJECT_FILE_STEM + _runtime_slug`. Never share a session cookie name between two tenants.

---

## Builder spawn checklist

When creating a new tenant from the ERP builder, verify every box:

- [ ] DB filename carries tenant prefix: `<tenant>_erp_data_operational_live.db`
- [ ] `PROJECT_FILE_STEM` resolves to the correct tenant tag
- [ ] `CATALYST_TENANT_TAG` override set in the service plist if PROJECT_FILE_STEM can't derive it
- [ ] `init_db()` called at module scope (S3 pattern)
- [ ] `tenant_tag` column present in all user-owned tables with correct default
- [ ] `<TENANT>_ERP_RUNTIME_ROOT` set in service plist / launchd
- [ ] `<TENANT>_ERP_DATA_DIR` set in service plist / launchd
- [ ] Session cookie name differs from all existing tenants
- [ ] Gunicorn launcher uses `<tenant>_erp_app:app`, NOT bare `app:app`
- [ ] Copy `docs/DATA_ISOLATION_POLICY_2026_04_17.md` into new tenant's `docs/`
- [ ] Copy `docs/RUNTIME_ROOT_POLICY_2026_04_17.md` into new tenant's `docs/`
- [ ] Copy this file (`docs/ERP_BUILDER_BASELINE_POLICY.md`) into new tenant's `docs/`
- [ ] `scripts/check_tenant_scoping.py` wired into the new tenant's pre-receive hook

---

## Policy docs that MUST be copied to every tenant

1. `docs/DATA_ISOLATION_POLICY_2026_04_17.md`
2. `docs/RUNTIME_ROOT_POLICY_2026_04_17.md`
3. `docs/ERP_BUILDER_BASELINE_POLICY.md` (this file)

---

## Enforcement chain

| Layer | Mechanism |
|---|---|
| Source | `scripts/check_tenant_scoping.py` — pre-receive gate (D5) |
| Schema | `tenant_tag` column in all user-owned tables, non-nullable |
| Runtime | `<TENANT>_ERP_RUNTIME_ROOT` checked by deploy hook |
| Boot | `init_db()` at gunicorn worker import (S3) |
| Cookie | SESSION_COOKIE_NAME derived from PROJECT_FILE_STEM |
| Builder | This policy doc — checked at every new-tenant spawn |

Any deviation from the above is a BLOCKER incident and outranks all feature work.
