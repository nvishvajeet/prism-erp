# Gatekeeping Audit — 2026-04-15

## Warmup Summary

- Inventoried `266` `@app.route(...)` declarations in `app.py`.
- Warmup review logged `20` priority gatekeeping surfaces that should move from `login_required` plus in-body checks to explicit decorator pairs in Phase 1.
- Heuristic-only misses were manually reviewed for the `/admin`, `/finance`, `/payments`, `/vendors`, `/audit`, and `/filing` families before writing the flagged list below.
- No code changes in this warmup deliverable; this document is inventory and handoff only.

## Priority Findings

| Path | Methods | Endpoint | Line | Warmup finding |
|---|---|---|---:|---|
| `/admin/users` | `GET/POST` | `admin_users` | 19900 | login_required only; admin permissions enforced inside helper, but route lacks explicit decorator pair |
| `/admin/onboard` | `GET/POST` | `admin_onboard` | 20143 | login_required only; create-user gate is in-body via permissions lookup |
| `/admin/org/setup` | `GET/POST` | `admin_org_setup` | 20087 | login_required only; org-chart admin gate is in-body |
| `/admin/leave` | `GET` | `admin_leave_queue` | 18876 | login_required only; admin scope enforced in-body |
| `/admin/leave/<int:leave_id>/approve` | `POST` | `admin_leave_approve` | 18910 | mutating route; attendance admin scope enforced in-body |
| `/admin/attendance` | `GET` | `admin_attendance_calendar` | 18943 | login_required only; admin scope enforced in-body |
| `/admin/maintenance/upcoming` | `GET` | `admin_calibrations_upcoming` | 19106 | login_required only; site/super/owner gate is in-body |
| `/admin/audit-log` | `GET` | `audit_log_viewer` | 26061 | login_required only; owner/site/super gate is in-body |
| `/admin/ai-log` | `GET` | `ai_admin_log` | 29517 | login_required only; owner/site/super gate is in-body |
| `/admin/mailing-lists` | `GET` | `admin_mailing_lists` | 9744 | login_required only; notice-admin gate is in-body |
| `/admin/notices/new` | `POST` | `admin_notices_new` | 9665 | mutating route; notice-admin gate is in-body |
| `/finance` | `GET` | `finance_portal` | 10830 | login_required only; finance-read gate is in-body |
| `/finance/invoices/new` | `GET/POST` | `finance_invoice_new` | 11116 | login_required only; finance-edit gate is in-body |
| `/finance/invoices/<int:invoice_id>/pay` | `POST` | `finance_invoice_pay` | 11317 | mutating route; finance-edit gate is in-body |
| `/finance/grants/<int:grant_id>/form-control` | `GET/POST` | `finance_grant_form_control` | 11953 | login_required only; finance-admin gate is in-body |
| `/payments` | `GET` | `vendor_payments_list` | 21424 | login_required only; payment-management gate is in-body |
| `/payments/<int:po_id>/approve` | `POST` | `vendor_payment_approve` | 21635 | owner-only mutating route; gate is in-body |
| `/vendors/<int:vendor_id>/approval` | `POST` | `vendor_approval_action` | 21377 | mutating route; vendor-approval gate is in-body |
| `/audit` | `GET` | `ca_audit_dashboard` | 22235 | login_required only; CA/finance audit gate is in-body |
| `/filing/retention` | `GET` | `filing_retention` | 22851 | login_required only; payment-management gate is in-body |

## Template Gates To Apply

| Template | Line | Surface | Suggested guard | Why it belongs in Phase 1 |
|---|---:|---|---|---|
| [`templates/sitemap.html`](/Users/vishvajeetn/Documents/Scheduler/Main/templates/sitemap.html:19) | 19 | Entire admin section visibility | `can_edit_user or can_manage_notices or can_attendance_admin or can_view_debug or can_manage_payments` | Current gate is too broad and tied to member-management only. |
| [`templates/sitemap.html`](/Users/vishvajeetn/Documents/Scheduler/Main/templates/sitemap.html:42) | 42 | Per-item admin entries | `can_edit_user`, `can_manage_notices`, `can_attendance_admin`, `can_manage_instruments`, `can_view_debug` | Item-level admin links need narrower capability booleans than one shared admin check. |
| [`templates/notifications.html`](/Users/vishvajeetn/Documents/Scheduler/Main/templates/notifications.html:21) | 21 | “Send Notice” CTA | `can_manage_notices` | The current owner-or-member-management check leaks notice controls to the wrong role family. |
| [`templates/users.html`](/Users/vishvajeetn/Documents/Scheduler/Main/templates/users.html:122) | 122 | Create-user panel chrome | `can_invite` and `can_edit_user` | Route family is `/admin/users`; the UI should follow explicit user-admin flags once exposed. |
| [`templates/finance.html`](/Users/vishvajeetn/Documents/Scheduler/Main/templates/finance.html:13) | 13 | New invoice action cluster | `can_approve_finance` | Read-level finance users can view the portal, but mutation controls should sit behind an edit capability. |
| [`templates/finance_invoices.html`](/Users/vishvajeetn/Documents/Scheduler/Main/templates/finance_invoices.html:13) | 13 | `+ New Invoice` | `can_approve_finance` | Matches `/finance/invoices/new` mutation gate. |
| [`templates/finance_invoice_detail.html`](/Users/vishvajeetn/Documents/Scheduler/Main/templates/finance_invoice_detail.html:15) | 15 | Void/pay actions | `can_approve_finance` | Mirrors `/pay` and `/void` routes. |
| [`templates/finance_grant_detail.html`](/Users/vishvajeetn/Documents/Scheduler/Main/templates/finance_grant_detail.html:17) | 17 | Grant edit controls | `can_approve_finance` | Grant metadata/member edits are write-only surfaces. |
| [`templates/vendor_payments.html`](/Users/vishvajeetn/Documents/Scheduler/Main/templates/vendor_payments.html:17) | 17 | Audit + Filing nav buttons | `can_review_audit` and `can_manage_payments` | Prevent dead-end links for payment viewers without audit/filing rights. |
| [`templates/vendors.html`](/Users/vishvajeetn/Documents/Scheduler/Main/templates/vendors.html:50) | 50 | Vendor approve/reject controls | `can_manage_payments` plus existing `can_approve_vendors` | Finance write surfaces should disappear for non-payment roles. |
| [`templates/vendor_detail.html`](/Users/vishvajeetn/Documents/Scheduler/Main/templates/vendor_detail.html:20) | 20 | Vendor approval actions | `can_manage_payments` plus existing `can_approve_vendors` | Same approval surface, detail page variant. |
| [`templates/dev_panel.html`](/Users/vishvajeetn/Documents/Scheduler/Main/templates/dev_panel.html:165) | 165 | Audit export shortcut | `can_view_debug` or owner-only flag | Export link should align with owner/debug-admin route gating. |

## Ravikiran Parallel Findings

Inventory only for this sprint; no Ravikiran edits are proposed here. The grep sweep shows the silo still carries several Lab-ERP traces that Claude 0 should scrub in Lane 1:

- `app.py:39` — Operational data comment still says "real lab DB".
- `app.py:63-64` — message taxonomy still contains `lab_reply` and lab-facing copy.
- `app.py:89` — secret env var still uses `LAB_SCHEDULER_SECRET_KEY` naming.
- `app.py:590` — mailer default still uses `noreply@lab.local`.
- `templates/request_detail.html:164` — request flow copy says sample submitted "to the lab".
- `templates/hub.html:259-266` — developer hub still references `lab-scheduler.git` and Mac mini topology.
- `templates/portfolio.html:466` — comment says "same library as the lab scheduler".

## Full Route Inventory

| Path | Methods | Decorators | Endpoint | Line | Warmup notes |
|---|---|---|---|---:|---|
| `/` | `GET` | `app.route` | `index` | 9227 |  |
| `/activate` | `GET, POST` | `app.route` | `activate` | 20263 | mutating_no_obvious_role_check |
| `/admin/ai-log` | `GET` | `app.route, login_required` | `ai_admin_log` | 29517 | in-body-check |
| `/admin/ai-settings` | `GET, POST` | `app.route, owner_required` | `admin_ai_settings` | 26162 |  |
| `/admin/attendance` | `GET` | `app.route, login_required` | `admin_attendance_calendar` | 18943 | in-body-check |
| `/admin/audit-export` | `GET` | `app.route, owner_required` | `audit_export` | 26096 |  |
| `/admin/audit-log` | `GET` | `app.route, login_required` | `audit_log_viewer` | 26061 | in-body-check |
| `/admin/data-storage` | `GET` | `app.route, owner_required` | `admin_data_storage` | 26117 |  |
| `/admin/data-storage/migrate` | `POST` | `app.route, owner_required` | `admin_data_migrate` | 26200 |  |
| `/admin/dev_panel` | `GET` | `app.route, owner_required` | `dev_panel` | 15728 |  |
| `/admin/dev_panel/commit/<sha>` | `GET` | `app.route, owner_required` | `dev_panel_commit` | 15877 |  |
| `/admin/dev_panel/doc` | `GET` | `app.route, owner_required` | `dev_panel_doc` | 15820 |  |
| `/admin/dev_panel/tag/<tag>` | `GET` | `app.route, owner_required` | `dev_panel_tag` | 15914 |  |
| `/admin/leave` | `GET` | `app.route, login_required` | `admin_leave_queue` | 18876 | in-body-check |
| `/admin/leave/<int:leave_id>/approve` | `POST` | `app.route, login_required` | `admin_leave_approve` | 18910 | in-body-check |
| `/admin/leave/<int:leave_id>/reject` | `POST` | `app.route, login_required` | `admin_leave_reject` | 18926 | in-body-check |
| `/admin/mailing-lists` | `GET` | `app.route, login_required` | `admin_mailing_lists` | 9744 | in-body-check |
| `/admin/mailing-lists/<int:list_id>/delete` | `POST` | `app.route, login_required` | `admin_mailing_list_delete` | 9790 | in-body-check |
| `/admin/mailing-lists/new` | `POST` | `app.route, login_required` | `admin_mailing_list_create` | 9761 | in-body-check |
| `/admin/maintenance/upcoming` | `GET` | `app.route, login_required` | `admin_calibrations_upcoming` | 19106 | in-body-check |
| `/admin/notices` | `GET` | `app.route, login_required` | `admin_notices` | 9623 |  |
| `/admin/notices/<int:notice_id>/delete` | `POST` | `app.route, login_required` | `admin_notices_delete` | 9726 | in-body-check |
| `/admin/notices/new` | `POST` | `app.route, login_required` | `admin_notices_new` | 9665 | in-body-check |
| `/admin/onboard` | `GET, POST` | `app.route, login_required` | `admin_onboard` | 20143 | in-body-check |
| `/admin/org/setup` | `GET, POST` | `app.route, login_required` | `admin_org_setup` | 20087 | in-body-check |
| `/admin/portfolio` | `GET` | `app.route, owner_required` | `portfolio_panel` | 16222 |  |
| `/admin/portfolio/calendar-events` | `GET` | `app.route, owner_required` | `portfolio_calendar_events` | 16363 |  |
| `/admin/portfolio/order` | `POST` | `app.route, owner_required` | `portfolio_log_order` | 16230 |  |
| `/admin/portfolio/order/bulk` | `POST` | `app.route, owner_required` | `portfolio_log_orders_bulk` | 16289 |  |
| `/admin/portfolio/recompute-peers` | `POST` | `app.route, owner_required` | `portfolio_recompute_peers` | 16455 |  |
| `/admin/portfolio/refresh` | `POST` | `app.route, owner_required` | `portfolio_refresh` | 16429 |  |
| `/admin/users` | `GET, POST` | `app.route, login_required` | `admin_users` | 19900 | in-body-check |
| `/ai/action/<int:action_id>/decide` | `POST` | `app.route, login_required` | `ai_action_decide` | 24465 | in-body-check |
| `/ai/ask` | `POST` | `app.route, login_required` | `ai_advisor_submit` | 24311 |  |
| `/ai/log` | `GET` | `app.route, login_required` | `ai_advisor_log` | 24577 |  |
| `/ai/process` | `POST` | `app.route, login_required` | `ai_advisor_trigger_batch` | 24763 | in-body-check |
| `/api/ai-fill` | `POST` | `app.route, login_required` | `api_ai_fill` | 25276 |  |
| `/api/ai/draft-approve/<int:request_id>` | `POST` | `app.route, login_required` | `ai_draft_approve` | 29332 | in-body-check |
| `/api/ai/pane` | `POST` | `app.route, app.route, login_required` | `ai_pane_submit` | 28720 |  |
| `/api/ai/pane/history` | `GET` | `app.route, login_required` | `ai_pane_history` | 29365 |  |
| `/api/ai/pane/submit` | `POST` | `app.route, app.route, login_required` | `ai_pane_submit` | 28720 |  |
| `/api/ai/pane/summary` | `GET` | `app.route, login_required` | `ai_pane_summary` | 29380 | in-body-check |
| `/api/health` | `GET` | `app.route, app.route` | `health_check` | 922 |  |
| `/api/health-check` | `GET` | `app.route` | `api_health_check` | 12025 | missing_login_required |
| `/api/telemetry/batch` | `POST` | `app.route, login_required` | `api_telemetry_batch` | 29758 |  |
| `/attachments/<int:attachment_id>/delete` | `POST` | `app.route, login_required` | `delete_attachment` | 16766 | in-body-check |
| `/attachments/<int:attachment_id>/download` | `GET` | `app.route, login_required` | `download_attachment` | 16734 | in-body-check |
| `/attachments/<int:attachment_id>/view` | `GET` | `app.route, login_required` | `view_attachment` | 16750 | in-body-check |
| `/attendance` | `GET` | `app.route, login_required` | `attendance_page` | 18435 | in-body-check |
| `/attendance/api/quick-mark` | `POST` | `app.route, login_required` | `attendance_api_quick_mark` | 18673 | in-body-check |
| `/attendance/api/search-staff` | `GET` | `app.route, login_required` | `attendance_api_search_staff` | 18729 | in-body-check |
| `/attendance/apply-leave` | `POST` | `app.route, login_required` | `attendance_apply_leave` | 18591 |  |
| `/attendance/mark` | `POST` | `app.route, login_required` | `attendance_mark` | 18532 | in-body-check |
| `/attendance/my-qr` | `GET` | `app.route, login_required` | `qr_my_code` | 26977 |  |
| `/attendance/qr` | `GET` | `app.route, login_required` | `qr_attendance_kiosk` | 26884 | in-body-check |
| `/attendance/qr/generate-svg/<code>` | `GET` | `app.route, login_required` | `qr_code_svg` | 26985 |  |
| `/attendance/qr/scan` | `POST` | `app.route, login_required` | `qr_attendance_scan` | 26916 |  |
| `/attendance/quick-present` | `POST` | `app.route, login_required` | `attendance_quick_present` | 18569 |  |
| `/attendance/team` | `GET` | `app.route, login_required` | `attendance_team` | 18757 | in-body-check |
| `/attendance/team-leave/<int:leave_id>/approve` | `POST` | `app.route, login_required` | `attendance_team_leave_approve` | 18622 | in-body-check |
| `/attendance/team-leave/<int:leave_id>/reject` | `POST` | `app.route, login_required` | `attendance_team_leave_reject` | 18647 | in-body-check |
| `/attendance/team/mark` | `POST` | `app.route, login_required` | `attendance_team_mark` | 18787 | in-body-check |
| `/attendance/team/mark-all` | `POST` | `app.route, login_required` | `attendance_team_mark_all` | 18811 | in-body-check |
| `/audit` | `GET` | `app.route, login_required` | `ca_audit_dashboard` | 22235 | in-body-check |
| `/audit/batch` | `POST` | `app.route, login_required` | `ca_audit_batch` | 22362 | in-body-check |
| `/audit/match-entry/<int:entry_id>` | `POST` | `app.route, login_required` | `ca_audit_match_entry` | 22679 | in-body-check |
| `/audit/print/<int:signoff_id>` | `GET` | `app.route, login_required` | `ca_audit_print_signoff` | 22609 | in-body-check |
| `/audit/signoff` | `POST` | `app.route, login_required` | `ca_audit_signoff` | 22558 | in-body-check |
| `/audit/single/<int:po_id>` | `POST` | `app.route, login_required` | `ca_audit_single` | 22400 | in-body-check |
| `/audit/statement/<int:stmt_id>/review` | `GET` | `app.route, login_required` | `ca_audit_statement_review` | 22649 | in-body-check |
| `/audit/upload-statement` | `GET, POST` | `app.route, login_required` | `ca_audit_upload_statement` | 22434 | in-body-check |
| `/auth/google` | `GET` | `app.route` | `auth_google` | 12530 | in-body-check |
| `/auth/google/callback` | `GET` | `app.route` | `auth_google_callback` | 12540 | in-body-check |
| `/calendar` | `GET, POST` | `app.route, login_required` | `calendar` | 18196 | in-body-check |
| `/calendar.ics` | `GET` | `app.route, login_required` | `calendar_ics` | 18270 | in-body-check |
| `/calendar/events` | `GET` | `app.route, login_required` | `calendar_events` | 18247 | in-body-check |
| `/catalyst/clear` | `POST` | `app.route, login_required` | `catalyst_clear` | 20316 |  |
| `/catalyst/log` | `GET` | `app.route, login_required` | `catalyst_log` | 20308 |  |
| `/catalyst/save` | `POST` | `app.route, login_required` | `catalyst_save` | 20293 |  |
| `/compute` | `GET` | `app.route, login_required` | `compute_list` | 24924 | in-body-check |
| `/compute/<int:job_id>` | `GET` | `app.route, login_required` | `compute_detail` | 25052 | in-body-check |
| `/compute/<int:job_id>/cancel` | `POST` | `app.route, login_required` | `compute_cancel` | 25126 | in-body-check |
| `/compute/<int:job_id>/download-all` | `GET` | `app.route, login_required` | `compute_download_all` | 25102 | in-body-check |
| `/compute/<int:job_id>/download/<int:file_id>` | `GET` | `app.route, login_required` | `compute_download` | 25081 | in-body-check |
| `/compute/<int:job_id>/rerun` | `POST` | `app.route, login_required` | `compute_rerun` | 25154 | in-body-check |
| `/compute/admin/storage` | `GET` | `app.route, login_required` | `compute_admin_storage` | 25255 | in-body-check |
| `/compute/estimate` | `POST` | `app.route, login_required` | `compute_estimate` | 25193 |  |
| `/compute/inventory` | `GET` | `app.route, login_required` | `compute_inventory` | 25241 |  |
| `/compute/new` | `GET, POST` | `app.route, login_required` | `compute_new` | 24963 |  |
| `/compute/software` | `GET` | `app.route, login_required` | `compute_software_list` | 25213 |  |
| `/compute/software/<slug>` | `GET` | `app.route, login_required` | `compute_software_detail` | 25229 |  |
| `/debug/feedback` | `POST` | `app.route, csrf.exempt, login_required` | `debug_feedback` | 25873 |  |
| `/demo/switch/<role_key>` | `GET` | `app.route, login_required` | `demo_switch_role` | 12327 | in-body-check |
| `/dev` | `GET` | `app.route, app.route` | `dev_site` | 17169 | missing_login_required |
| `/dev/` | `GET` | `app.route, app.route` | `dev_site` | 17169 | missing_login_required |
| `/dispatch` | `GET` | `app.route, login_required` | `dispatch_console` | 24606 | in-body-check |
| `/docs` | `GET` | `app.route, login_required` | `docs` | 12279 |  |
| `/exports/<path:filename>` | `GET` | `app.route, login_required` | `download_export` | 19406 | in-body-check |
| `/exports/generate` | `POST` | `app.route, login_required` | `generate_export` | 19356 | in-body-check |
| `/favicon.ico` | `GET` | `app.route` | `favicon_ico` | 945 |  |
| `/favicon.png` | `GET` | `app.route` | `favicon_png` | 950 |  |
| `/feedback` | `POST` | `app.route, login_required` | `site_feedback_submit` | 25927 |  |
| `/filing/archive/<int:pf_id>` | `POST` | `app.route, login_required` | `filing_archive_folder` | 22976 | in-body-check |
| `/filing/destroy-plan` | `GET` | `app.route, login_required` | `filing_destroy_plan` | 23010 | in-body-check |
| `/filing/register-folder` | `POST` | `app.route, login_required` | `filing_register_folder` | 22948 | in-body-check |
| `/filing/retention` | `GET` | `app.route, login_required` | `filing_retention` | 22851 | in-body-check |
| `/finance` | `GET` | `app.route, login_required` | `finance_portal` | 10830 | in-body-check |
| `/finance/grants` | `GET, POST` | `app.route, login_required` | `finance_grants_list` | 11523 | in-body-check |
| `/finance/grants/<int:grant_id>` | `GET, POST` | `app.route, login_required` | `finance_grant_detail` | 11710 | in-body-check |
| `/finance/grants/<int:grant_id>/expenses` | `GET, POST` | `app.route, login_required` | `finance_grant_expenses` | 11867 | in-body-check |
| `/finance/grants/<int:grant_id>/form-control` | `GET, POST` | `app.route, login_required` | `finance_grant_form_control` | 11953 | in-body-check |
| `/finance/invoices` | `GET` | `app.route, login_required` | `finance_invoices_list` | 11017 | in-body-check |
| `/finance/invoices/<int:invoice_id>` | `GET` | `app.route, login_required` | `finance_invoice_detail` | 11245 | in-body-check |
| `/finance/invoices/<int:invoice_id>/pay` | `POST` | `app.route, login_required` | `finance_invoice_pay` | 11317 | in-body-check |
| `/finance/invoices/<int:invoice_id>/void` | `POST` | `app.route, login_required` | `finance_invoice_void` | 11394 | in-body-check |
| `/finance/invoices/new` | `GET, POST` | `app.route, login_required` | `finance_invoice_new` | 11116 | in-body-check |
| `/finance/spend` | `GET` | `app.route, login_required` | `finance_spend` | 11429 | in-body-check |
| `/getting-started` | `GET` | `app.route, app.route, login_required` | `getting_started` | 17188 | in-body-check |
| `/health` | `GET` | `app.route, app.route` | `health_check` | 922 |  |
| `/help` | `GET` | `app.route, app.route, login_required` | `getting_started` | 17188 | in-body-check |
| `/history/processed` | `GET` | `app.route, login_required` | `processed_history` | 17346 |  |
| `/hub` | `GET` | `app.route` | `hub` | 9004 | missing_login_required |
| `/inbox` | `GET` | `app.route, login_required` | `inbox` | 10051 | in-body-check |
| `/insights` | `GET` | `app.route, login_required` | `insights_list` | 29600 | in-body-check |
| `/insights/<int:insight_id>` | `GET, POST` | `app.route, login_required` | `insights_detail` | 29659 |  |
| `/insights/<int:insight_id>/form-control` | `GET, POST` | `app.route, login_required` | `insights_form_control` | 29684 |  |
| `/insights/new` | `GET, POST` | `app.route, login_required` | `insights_new` | 29708 |  |
| `/instruments` | `GET, POST` | `app.route, login_required` | `instruments` | 13079 | in-body-check |
| `/instruments/<int:instrument_id>` | `GET, POST` | `app.route, login_required` | `instrument_detail` | 13648 |  |
| `/instruments/<int:instrument_id>/calendar` | `GET` | `app.route, login_required, instrument_access_required` | `instrument_calendar` | 18264 |  |
| `/instruments/<int:instrument_id>/custom-fields` | `GET` | `app.route, login_required` | `instrument_custom_fields_json` | 13824 |  |
| `/instruments/<int:instrument_id>/form-control` | `GET, POST` | `app.route, login_required` | `instrument_form_control` | 13694 | in-body-check |
| `/instruments/<int:instrument_id>/history` | `GET` | `app.route, login_required, instrument_access_required` | `instrument_history` | 18046 |  |
| `/instruments/<int:instrument_id>/maintenance` | `GET, POST` | `app.route, login_required` | `instrument_maintenance_log` | 18978 | in-body-check |
| `/instruments/<int:instrument_id>/notify` | `POST` | `app.route, login_required` | `instrument_notify` | 19065 | in-body-check |
| `/leave/new` | `GET, POST` | `app.route, login_required` | `leave_request_new` | 18843 |  |
| `/letters` | `GET` | `app.route, login_required` | `letters_list` | 12927 | in-body-check |
| `/letters/<int:letter_id>` | `GET` | `app.route, login_required` | `letter_detail` | 12974 | in-body-check |
| `/letters/<int:letter_id>/print` | `GET` | `app.route, login_required` | `letter_print` | 12988 | in-body-check |
| `/letters/<int:letter_id>/update` | `POST` | `app.route, login_required` | `letter_update` | 13002 | in-body-check |
| `/letters/new` | `GET, POST` | `app.route, login_required` | `letter_new` | 12949 |  |
| `/login` | `GET, POST` | `app.route` | `login` | 12351 | mutating_no_obvious_role_check |
| `/logout` | `GET` | `app.route` | `logout` | 12493 |  |
| `/manual` | `GET` | `app.route, login_required` | `role_manual` | 17153 |  |
| `/me` | `GET` | `app.route, login_required` | `my_profile` | 16991 |  |
| `/me/testing-plan` | `GET` | `app.route, login_required` | `testing_plan_page` | 17133 |  |
| `/mess` | `GET` | `app.route, login_required` | `mess_dashboard` | 27222 | in-body-check |
| `/mess/api/lookup/<code>` | `GET` | `app.route, login_required` | `mess_api_lookup` | 27600 | in-body-check |
| `/mess/api/search-student` | `GET` | `app.route, login_required` | `mess_api_search_student` | 27570 | in-body-check |
| `/mess/api/validate-scan` | `POST` | `app.route, login_required` | `mess_api_validate_scan` | 27162 | in-body-check |
| `/mess/camera-scan` | `GET` | `app.route, login_required` | `mess_camera_scan` | 27142 | in-body-check |
| `/mess/export-tally` | `GET` | `app.route, login_required` | `mess_tally_export` | 27909 | in-body-check |
| `/mess/pass/<int:student_id>` | `GET` | `app.route` | `mess_student_pass` | 27112 | missing_login_required |
| `/mess/passes` | `GET` | `app.route, login_required` | `mess_batch_passes` | 27694 | in-body-check |
| `/mess/prep` | `GET, POST` | `app.route, login_required` | `mess_prep_log` | 27803 | in-body-check |
| `/mess/reports` | `GET` | `app.route, login_required` | `mess_reports` | 27745 | in-body-check |
| `/mess/scan` | `GET, POST` | `app.route, login_required` | `mess_scan` | 27273 | in-body-check |
| `/mess/students` | `GET` | `app.route, login_required` | `mess_students_list` | 27355 | in-body-check |
| `/mess/students/<int:student_id>` | `GET` | `app.route, login_required` | `mess_student_detail` | 27433 | in-body-check |
| `/mess/students/<int:student_id>/edit` | `POST` | `app.route, login_required` | `mess_student_edit` | 27526 | in-body-check |
| `/mess/students/<int:student_id>/photo` | `GET` | `app.route, login_required` | `mess_student_photo` | 27629 |  |
| `/mess/students/<int:student_id>/qr` | `GET` | `app.route, login_required` | `mess_student_qr` | 27493 | in-body-check |
| `/mess/students/<int:student_id>/toggle` | `POST` | `app.route, login_required` | `mess_student_toggle` | 27507 | in-body-check |
| `/mess/students/import` | `POST` | `app.route, login_required` | `mess_students_import` | 27643 | in-body-check |
| `/mess/students/new` | `GET, POST` | `app.route, login_required` | `mess_student_new` | 27376 | in-body-check |
| `/messages/<int:message_id>` | `GET` | `app.route, login_required` | `message_detail` | 10200 | in-body-check |
| `/messages/<int:message_id>/attachment/<int:att_id>` | `GET` | `app.route, login_required` | `message_attachment` | 10604 | in-body-check |
| `/messages/<int:message_id>/delete` | `POST` | `app.route, login_required` | `message_delete` | 10562 | in-body-check |
| `/messages/<int:message_id>/reply` | `POST` | `app.route, login_required` | `message_reply` | 10391 | in-body-check |
| `/messages/<int:message_id>/report` | `POST` | `app.route, login_required` | `message_report` | 10425 | in-body-check |
| `/messages/new` | `GET` | `app.route, login_required` | `message_compose` | 10293 |  |
| `/messages/new` | `POST` | `app.route, login_required` | `message_send` | 10351 |  |
| `/messages/report/<int:report_id>/review` | `POST` | `app.route, login_required` | `message_report_review` | 10514 | in-body-check |
| `/my/history` | `GET` | `app.route, login_required` | `my_history` | 16985 |  |
| `/notifications` | `GET` | `app.route, login_required` | `notifications_page` | 9848 |  |
| `/notifications/mark-read` | `POST` | `app.route, login_required` | `notification_mark_read` | 9807 |  |
| `/payments` | `GET` | `app.route, login_required` | `vendor_payments_list` | 21424 | in-body-check |
| `/payments/<int:po_id>` | `GET` | `app.route, login_required` | `vendor_payment_detail` | 21589 | in-body-check |
| `/payments/<int:po_id>/approve` | `POST` | `app.route, login_required` | `vendor_payment_approve` | 21635 | in-body-check |
| `/payments/<int:po_id>/pay` | `POST` | `app.route, login_required` | `vendor_payment_mark_paid` | 21807 | in-body-check |
| `/payments/<int:po_id>/receipt` | `POST` | `app.route, login_required` | `vendor_payment_upload_receipt` | 21839 | in-body-check |
| `/payments/approvals` | `GET` | `app.route, login_required` | `vendor_payment_approve_queue` | 21685 | in-body-check |
| `/payments/batch-approve` | `POST` | `app.route, login_required` | `vendor_payment_batch_approve` | 21732 | in-body-check |
| `/payments/books` | `GET, POST` | `app.route, login_required` | `company_books` | 21135 | in-body-check |
| `/payments/filing` | `GET` | `app.route, login_required` | `vendor_payment_filing` | 22110 | in-body-check |
| `/payments/new` | `GET, POST` | `app.route, login_required` | `vendor_payment_new` | 21504 | in-body-check |
| `/payments/print-batch` | `GET` | `app.route, login_required` | `vendor_payment_print_batch` | 22151 | in-body-check |
| `/payments/print/<int:po_id>` | `GET` | `app.route, login_required` | `vendor_payment_print` | 21774 | in-body-check |
| `/payments/reports` | `GET` | `app.route, login_required` | `vendor_payment_reports` | 21871 | in-body-check |
| `/payments/tally-export` | `GET` | `app.route, login_required` | `tally_export` | 23354 | in-body-check |
| `/payments/tally-export-page` | `GET` | `app.route, login_required` | `tally_export_page` | 23386 | in-body-check |
| `/payments/tally-import` | `GET, POST` | `app.route, login_required` | `tally_import` | 23404 | in-body-check |
| `/personnel` | `GET` | `app.route, login_required` | `personnel_list` | 20667 | in-body-check |
| `/personnel/<int:user_id>` | `GET` | `app.route, login_required` | `personnel_detail` | 20719 | in-body-check |
| `/personnel/<int:user_id>/manager` | `POST` | `app.route, login_required` | `personnel_set_manager` | 20799 | in-body-check |
| `/personnel/<int:user_id>/salary-config` | `POST` | `app.route, login_required` | `personnel_salary_config` | 20834 | in-body-check |
| `/personnel/chart` | `GET` | `app.route, login_required` | `personnel_chart` | 19982 |  |
| `/personnel/chart/edge` | `POST` | `app.route, login_required` | `personnel_chart_edge` | 20031 | in-body-check |
| `/personnel/chart/pin` | `POST` | `app.route, login_required` | `personnel_chart_pin` | 20063 | in-body-check |
| `/personnel/payroll` | `GET` | `app.route, login_required` | `payroll_view` | 20877 | in-body-check |
| `/personnel/payroll/pay` | `POST` | `app.route, login_required` | `payroll_pay` | 20931 | in-body-check |
| `/portals` | `GET` | `app.route, login_required` | `portal_picker` | 12458 |  |
| `/portals/enter/<slug>` | `GET` | `app.route, login_required` | `portal_enter` | 12471 |  |
| `/portals/switch/<slug>` | `GET` | `app.route, login_required` | `portal_switch_legacy` | 12487 |  |
| `/profile/change-password` | `GET, POST` | `app.route, login_required` | `change_password` | 17310 |  |
| `/quickentry` | `GET, POST` | `app.route, login_required` | `quick_entry` | 29543 | in-body-check |
| `/receipts` | `GET` | `app.route, login_required` | `receipts_list` | 25306 |  |
| `/receipts/<int:receipt_id>` | `GET` | `app.route, login_required` | `receipt_detail` | 25392 | in-body-check |
| `/receipts/<int:receipt_id>/file` | `GET` | `app.route, login_required` | `receipt_file` | 25429 | in-body-check |
| `/receipts/<int:receipt_id>/review` | `POST` | `app.route, login_required` | `expense_receipt_review` | 25447 | in-body-check |
| `/receipts/inbox` | `GET` | `app.route, login_required` | `receipt_inbox` | 22786 | in-body-check |
| `/receipts/new` | `GET, POST` | `app.route, login_required` | `receipt_new` | 25329 |  |
| `/receipts/review/<int:sub_id>` | `POST` | `app.route, login_required` | `receipt_review` | 22820 | in-body-check |
| `/receipts/submit` | `GET, POST` | `app.route, login_required` | `receipt_submit` | 22710 |  |
| `/requests/<int:request_id>` | `GET, POST` | `app.route, login_required` | `request_detail` | 14419 | in-body-check |
| `/requests/<int:request_id>/calendar-card` | `GET` | `app.route, login_required` | `request_calendar_card` | 19420 | in-body-check |
| `/requests/<int:request_id>/duplicate` | `GET` | `app.route, login_required` | `duplicate_request` | 16490 | in-body-check |
| `/requests/<int:request_id>/quick-receive` | `POST` | `app.route, login_required` | `quick_receive_request` | 12298 |  |
| `/requests/new` | `GET, POST` | `app.route, login_required` | `new_request` | 13950 |  |
| `/robots.txt` | `GET` | `app.route` | `robots_txt` | 955 |  |
| `/schedule` | `GET` | `app.route, login_required` | `schedule` | 16513 | in-body-check |
| `/schedule/actions` | `POST` | `app.route, login_required` | `schedule_actions` | 16707 | in-body-check |
| `/schedule/bulk` | `POST` | `app.route, login_required` | `schedule_bulk_actions` | 16584 | in-body-check |
| `/search` | `GET` | `app.route, login_required` | `global_search` | 25962 |  |
| `/sitemap` | `GET` | `app.route, login_required` | `sitemap` | 12054 | in-body-check |
| `/stats` | `GET` | `app.route, login_required` | `stats` | 19135 | in-body-check |
| `/todos` | `GET` | `app.route, login_required` | `todos_page` | 12753 |  |
| `/todos/<int:todo_id>/complete` | `POST` | `app.route, login_required` | `todo_complete` | 12894 | in-body-check |
| `/todos/<int:todo_id>/delete` | `POST` | `app.route, login_required` | `todo_delete` | 12911 | in-body-check |
| `/todos/<int:todo_id>/update` | `POST` | `app.route, login_required` | `todo_update` | 12869 | in-body-check |
| `/todos/new` | `POST` | `app.route, login_required` | `todo_new` | 12828 |  |
| `/tuck-shop` | `GET` | `app.route, login_required` | `tuck_shop_dashboard` | 27989 | in-body-check |
| `/tuck-shop/api/bank-match` | `POST` | `app.route, login_required` | `tuck_shop_api_bank_match` | 28518 | in-body-check |
| `/tuck-shop/api/sale` | `POST` | `app.route, login_required` | `tuck_shop_api_record_sale` | 28102 | in-body-check |
| `/tuck-shop/api/today-stats` | `GET` | `app.route, login_required` | `tuck_shop_api_today_stats` | 28495 | in-body-check |
| `/tuck-shop/api/token/issue` | `POST` | `app.route, login_required` | `tuck_shop_api_issue_token` | 28188 | in-body-check |
| `/tuck-shop/api/token/pending` | `GET` | `app.route, login_required` | `tuck_shop_api_pending_tokens` | 28469 | in-body-check |
| `/tuck-shop/api/token/redeem` | `POST` | `app.route, login_required` | `tuck_shop_api_redeem_token` | 28252 | in-body-check |
| `/tuck-shop/api/token/void` | `POST` | `app.route, login_required` | `tuck_shop_api_void_token` | 28373 | in-body-check |
| `/tuck-shop/bank-reconcile` | `POST` | `app.route, login_required` | `tuck_shop_bank_reconcile` | 28561 | in-body-check |
| `/tuck-shop/items` | `GET, POST` | `app.route, login_required` | `tuck_shop_items_manage` | 28061 | in-body-check |
| `/tuck-shop/items/<int:item_id>/edit` | `POST` | `app.route, login_required` | `tuck_shop_item_edit` | 28399 | in-body-check |
| `/tuck-shop/items/<int:item_id>/toggle` | `POST` | `app.route, login_required` | `tuck_shop_item_toggle` | 28085 | in-body-check |
| `/tuck-shop/report` | `GET` | `app.route, login_required` | `tuck_shop_daily_report` | 28291 | in-body-check |
| `/tuck-shop/report/csv` | `GET` | `app.route, login_required` | `tuck_shop_report_csv` | 28419 | in-body-check |
| `/tuck-shop/terminal` | `GET` | `app.route, login_required` | `tuck_shop_terminal` | 28044 | in-body-check |
| `/tuck-shop/token/issue` | `GET` | `app.route, login_required` | `tuck_shop_token_issue` | 28152 | in-body-check |
| `/tuck-shop/token/redeem` | `GET` | `app.route, login_required` | `tuck_shop_token_redeem` | 28225 | in-body-check |
| `/users/<int:user_id>` | `GET, POST` | `app.route, login_required` | `user_profile` | 17914 | in-body-check |
| `/users/<int:user_id>/history` | `GET` | `app.route, role_required` | `user_history` | 18033 | missing_login_required |
| `/users/<int:user_id>/reset-password.eml` | `GET` | `app.route, login_required` | `download_reset_password_eml` | 17992 | in-body-check |
| `/vehicles` | `GET` | `app.route, login_required` | `vehicles_list` | 20328 | in-body-check |
| `/vehicles/<int:vehicle_id>` | `GET` | `app.route, login_required` | `vehicle_detail` | 20479 | in-body-check |
| `/vehicles/<int:vehicle_id>/archive` | `POST` | `app.route, login_required` | `vehicle_archive` | 20606 | in-body-check |
| `/vehicles/<int:vehicle_id>/edit` | `POST` | `app.route, login_required` | `vehicle_edit` | 20569 | in-body-check |
| `/vehicles/<int:vehicle_id>/log` | `POST` | `app.route, login_required` | `vehicle_add_log` | 20527 |  |
| `/vehicles/new` | `POST` | `app.route, login_required` | `vehicle_create` | 20437 | in-body-check |
| `/vendors` | `GET` | `app.route, login_required` | `vendor_list` | 21201 | in-body-check |
| `/vendors/<int:vendor_id>` | `GET` | `app.route, login_required` | `vendor_detail` | 21338 | in-body-check |
| `/vendors/<int:vendor_id>/approval` | `POST` | `app.route, login_required` | `vendor_approval_action` | 21377 | in-body-check |
| `/vendors/bulk` | `POST` | `app.route, login_required` | `vendor_bulk_create` | 21230 | in-body-check |
| `/vendors/new` | `GET, POST` | `app.route, login_required` | `vendor_new` | 21281 | in-body-check |
| `/visualizations` | `GET` | `app.route, login_required` | `visualizations` | 19265 | in-body-check |
| `/visualizations/export` | `POST` | `app.route, login_required` | `generate_visualization_export` | 19369 | in-body-check |
| `/visualizations/group/<path:group_name>` | `GET` | `app.route, login_required` | `group_visualization` | 19326 | in-body-check |
| `/visualizations/instrument/<int:instrument_id>` | `GET` | `app.route, login_required, instrument_access_required` | `instrument_visualization` | 19299 |  |
