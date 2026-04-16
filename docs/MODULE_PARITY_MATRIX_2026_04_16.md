# Module Parity Matrix: Lab-ERP vs Ravikiran-ERP

**Generated:** 2026-04-16  
**Lab-ERP:** `/Documents/Scheduler/Main/` -- 30,526 LOC, 270 routes  
**Rav-ERP:** `~/Claude/ravikiran-erp/` -- 14,979 LOC, 118 routes  
**Method:** Automated grep of `@app.route`, `render_template`, and `CREATE TABLE` in `app.py` for both repos.

---

## Parity Matrix

| Module | Lab routes | Rav routes | Lab templates (unique) | Rav templates (unique) | DB tables match? | Drift verdict |
|---|---|---|---|---|---|---|
| **Instruments** | 8 | 8 | 4 (`instruments.html`, `instrument_form_control.html`, etc.) | 4 (`instruments.html`, etc.) | YES (14 vs 13 -- Lab has `instrument_inventory_items`) | MATCH |
| **Finance** | 11 | 11 | 4 (`finance_*.html`, `tally_*.html`) | 0 (uses shared base rendering) | PARTIAL (10 vs 8 -- Lab has `purchase_orders`, `deadstock_items`) | DIVERGED |
| **Attendance** | 16 | 12 | 2 (`attendance_quick.html`, `attendance_team.html`) | 2 (same) | YES (1:1) | DIVERGED |
| **Personnel / HR** | 9 | 0 | 3 (`personnel.html`, `personnel_detail.html`, `payroll.html`) | 0 | NO (Lab has `salary_config`, `salary_payments`, `archived_users`, `reporting_structure`; Rav has only `reporting_structure`) | LAB-ONLY |
| **Leave** | 1 | 1 | 2 (`leave_new.html`, `admin_leave.html`) | 2 (same) | YES (2:2 `leave_requests`, `leave_balances`) | MATCH |
| **Payroll** | 0 (under `/personnel/payroll`) | 0 | 1 (`payroll.html`) | 0 | NO (Lab has `salary_config`, `salary_payments`) | LAB-ONLY |
| **Mess** | 27 | 6 | 6 (`mess_students.html`, `mess_student_new.html`, etc.) | 3 (subset) | NO (Lab: 6 tables; Rav: 3 -- missing `mess_prep_log`, `qr_scan_log`, `mess_entries`) | LAB-ONLY |
| **Calendar** | 9 | 6 | 0 (inline / shared) | 0 | YES (no dedicated tables) | DIVERGED |
| **Queue (Requests)** | 5 | 5 | 3 (`new_request.html`, `quick_entry.html`, etc.) | 1 (`request_detail` area) | YES (`sample_requests`, `request_*` tables present in both) | MATCH |
| **Inbox / Notifications** | 12 | 9 | 4 (inbox, notifications, messages) | 3 (missing message report templates) | PARTIAL (Lab has `complaints`; Rav missing) | DIVERGED |
| **Audit** | 11 | 2 | 4 (`ca_audit_*.html`) | 0 | NO (Lab: 5 tables incl. `bank_statements`, `audit_signoffs`; Rav: 1 `audit_logs` only) | LAB-ONLY |
| **Admin / Users** | 31 | 23 | 9 (`admin_*.html`, `activate.html`, `portal_picker.html`) | 3 (`admin_leave.html`, `admin_mailing_lists.html`, `activate.html`) | PARTIAL (Lab has `erp_portals`, `erp_user_portals`, `companies`, `telemetry_*`; Rav missing all) | DIVERGED |
| **Structure Editor (Org Chart)** | 0 (nested under `/admin/org/setup` + `/personnel/chart`) | 0 | 1 (`admin_org_setup.html`) | 0 | PARTIAL (both have `reporting_structure`; Lab has richer schema) | LAB-ONLY |
| **Compute** | 12 | 0 | 9 (`compute_*.html`) | 0 | NO (Lab: `compute_jobs`, `job_input_files`, `job_output_files`, `software_catalog`; Rav: 0) | LAB-ONLY |
| **Vendors** | 5 | 0 | 8 (`vendor_payment_*.html`) | 0 | NO (Lab: `vendors`; Rav: 0) | LAB-ONLY |

**Summary:** 3 MATCH, 4 DIVERGED, 8 LAB-ONLY, 0 RAV-ONLY.

---

## Top 5 Drift Items

1. **Compute module entirely absent in Rav-ERP** -- 12 routes, 9 templates, 4 DB tables (compute jobs, software catalog). This is a lab-specific HPC/batch-job system with no household equivalent yet.

2. **Personnel/HR + Payroll missing from Rav-ERP** -- 9 routes for org chart, salary config, payroll runs. Tables `salary_config`, `salary_payments`, `archived_users` do not exist in Rav. Household ERP has no payroll concept currently.

3. **Mess module 27 vs 6 routes** -- Lab version has full student management, QR scanning, camera scan, tally export, prep log, student import. Rav has a stripped skeleton (6 routes). Missing 21 routes and 3 DB tables (`mess_prep_log`, `qr_scan_log`, `mess_entries`).

4. **Audit module 11 vs 2 routes** -- Lab has a full chartered-accountant audit workflow: bank statement upload, reconciliation, batch matching, signoff printing. Rav retains only the basic `audit_logs` table and an export route.

5. **Vendor payments entirely absent in Rav-ERP** -- 5 routes covering vendor registration, approval workflows, bulk import, PO printing. The `vendors` table and all payment-filing routes are Lab-only.

---

## Cross-Contamination Risk Assessment

### High-risk: Lab-specific terms still present in Ravikiran-ERP

| Term | Occurrences in Rav `app.py` | Location | Risk |
|---|---|---|---|
| `FESEM` | 5 | Demo/fixture data (lines 5145, 5213, 5218, 5262, 5424) | **HIGH** -- hardcoded instrument names in seed data visible to household users |
| `XRD` | 3 | Demo/fixture data (lines 5145, 5148, 5425) | **HIGH** -- same as above |
| `ICP-MS` | 1 | Fixture instrument mapping (line 5424) | **MEDIUM** -- internal comment but leaks via demo mode |
| `sample_request` | 403 refs | Core table name + all request handling | **LOW** (structural) -- renaming is a v2 concern; functionally correct but semantically misleading for household context |
| `instrument_name` | 20+ | Route handlers, email templates, display strings | **LOW** (structural) -- "instrument" is the generic CATALYST term; household variant reinterprets it as "service/asset" |
| `lab_scheduler` | 3 | DB filename (`lab_scheduler.db`), env var prefix (`LAB_SCHEDULER_*`), export prefix | **MEDIUM** -- DB file and env vars carry the lab brand into the household deployment |
| `"Lab Result Ready"` | 1 | Email subject (line 681) | **HIGH** -- user-facing email contains "Lab" |
| `"Lab Reply"` | 1 | Communication note type (line 65) | **MEDIUM** -- visible in request conversation UI |
| `"Lab Facility"` | 1 | Email footer (line 696) | **HIGH** -- user-facing |
| `noreply@lab.local` | 1 | Email sender address (line 682) | **HIGH** -- user-facing sender |

### Template contamination (Rav `templates/`)

- `_page_macros.html` -- references `sample_requests` in code comments (low risk)
- `calendar_card.html` -- 15+ refs to `sample_request` dict keys (structural, not user-facing text)
- `request_detail.html` -- references `sample_request` in Jinja context (structural)
- `schedule.html` -- placeholder text says "Request, sample, requester, operator" (user-facing, should be adapted)
- `instrument_form_control.html` -- "Price per sample" label (user-facing, lab-specific)

### Naming divergence: PRISM vs CATALYST

Rav-ERP uses `/prism/log`, `/prism/save`, `/prism/clear` routes (3 routes) where Lab-ERP uses `/catalyst/log`, `/catalyst/save`, `/catalyst/clear`. The Rav-ERP `app.py` contains 42 references to "prism" and 0 to "catalyst" -- this is an intentional rename for the household variant but means the two codebases have diverged on the ERP brand namespace.

### Recommended actions

1. **Immediate:** Replace hardcoded lab instrument names (FESEM, XRD, ICP-MS) in Rav demo fixtures with household-appropriate names (e.g., "Solar Panel Array", "Water Purifier", "Generator").
2. **Immediate:** Change email strings -- "Lab Result Ready", "Lab Reply", "Lab Facility", `noreply@lab.local` -- to household variants.
3. **Short-term:** Rename `lab_scheduler.db` to `ravikiran_erp.db` and update env var prefix from `LAB_SCHEDULER_*` to `RAVIKIRAN_*`.
4. **Medium-term:** Audit template placeholder text ("sample", "operator") and adapt for household domain language.
5. **Deferred:** The `sample_requests` table name is deeply embedded (403 refs). Renaming to a generic `service_requests` is a v2 migration task.
