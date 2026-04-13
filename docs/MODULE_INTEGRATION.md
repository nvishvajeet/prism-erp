# Module Integration Map

How CATALYST ERP modules connect to each other. Every cross-module
query, template link, and notification is listed here so future
developers know what breaks when they change a table or route.

## Integration matrix

| Source Module | Target Module | Integration | Route / Code Location |
|---------------|---------------|-------------|----------------------|
| Finance | Vehicles | Fleet costs KPI in finance overview | `finance_portal()` queries `vehicle_logs` SUM, passes `vehicle_spend` to `finance.html` |
| Finance | Personnel | Salary outflow KPI in finance overview | `finance_portal()` queries `salary_payments` SUM, passes `salary_outflow` to `finance.html` |
| Finance | Receipts | Approved receipts in unified spend view | `finance_spend()` queries `expense_receipts WHERE status='approved'`, merged into `all_entries` |
| Dashboard | Vehicles | Fleet Status tile (active count, fuel, insurance) | `index()` queries `vehicles`, `vehicle_logs`; passes `dash_fleet_status` to `dashboard.html` |
| Dashboard | Personnel | Payroll Due tile (unpaid count, pending amount) | `index()` queries `salary_config`, `salary_payments`; passes `dash_payroll_due` to `dashboard.html` |
| Personnel | Attendance | Clickable days_worked links to attendance page | `payroll.html` links each days_worked cell to `attendance_page(user_id=, year=, month=)` |
| Personnel | Vehicles | Assigned vehicles on employee profile | `personnel_detail()` queries `vehicles WHERE assigned_driver_user_id`; shown in `personnel_detail.html` |
| Vehicles | Personnel | Driver profile link on vehicle detail | `vehicle_detail()` joins `users` for assigned driver; links to `personnel_detail` |
| Letters | Personnel | Pre-filled letter recipient from employee profile | `personnel_detail.html` has "Write Letter" button linking to `letter_new(recipient=name)` |
| Notifications | Vehicles | Alert owners on maintenance logged | `vehicle_add_log()` calls `notify()` for maintenance log_type |
| Notifications | Personnel | Alert employee on salary payment | `payroll_pay()` calls `notify()` for the paid employee |
| Notifications | Receipts | Alert submitter on receipt approval/rejection | `receipt_review()` calls `notify()` for approve and reject actions |
| Instruments | Finance | Default grant charging on new requests | `new_request()` links to `invoices.grant_id` for external billing |
| Compute | Notifications | Job completion / failure / dependency alerts | `compute_api_complete_job()` calls `notify()` for user + admin attention flows |
| Compute | Inbox | Operationally adjacent but not yet directly wired | candidate future integration: job discussion or admin follow-up thread |
| Compute | Admin | Worker-backed queue managed by admin roles | `compute_dashboard()` / `compute_software_list()` gate admin actions by owner/super/site admin |
| Demo variants | Module registry | Different ERP sites from one codebase | `CATALYST_MODULES` presets in `docs/ERP_COMPOSITION.md` and `docs/ERP_DEMO_VARIANTS.md` |

## Data flow diagram

```
Dashboard (index)
  |-- queries --> vehicles (fleet status tile)
  |-- queries --> salary_config + salary_payments (payroll due tile)
  
Finance Portal (finance_portal)
  |-- queries --> vehicle_logs (fleet costs KPI)
  |-- queries --> salary_payments (salary outflow KPI)

Finance Spend (finance_spend)
  |-- queries --> payments (invoice payments)
  |-- queries --> grant_expenses (grant expenses)
  |-- queries --> expense_receipts (approved receipts)

Personnel Detail (personnel_detail)
  |-- queries --> vehicles (assigned vehicles)
  |-- links  --> letter_new (write letter button)

Payroll (payroll_view)
  |-- links  --> attendance_page (clickable days_worked)

Notifications (system_notifications)
  <-- vehicle_add_log (maintenance events)
  <-- payroll_pay (salary payments)
  <-- receipt_review (approval/rejection)
  <-- compute_api_complete_job (job finished / needs attention)
```

## Adding a new module -- integration checklist

When building a new module, check each existing module:

1. **Does the new module generate COSTS?** Add to Finance spend view
   (`finance_spend()` UNION query) and add a KPI blob to `finance.html`.
2. **Does it involve PEOPLE?** Link to Personnel module (employee
   profiles, assigned resources).
3. **Does it have STATUS CHANGES?** Add `notify()` calls so affected
   users get system notifications.
4. **Does it need APPROVAL?** Wire into the approval workflow and add
   notification on approve/reject.
5. **Does it have DATES/DEADLINES?** Add to Calendar module if enabled.
6. **Should it appear on DASHBOARD?** Add a summary tile in `index()`
   gated to operational roles (owner, admin).
7. **Does it produce DOCUMENTS?** Link to Letters module for pre-filled
   correspondence.
8. **Does it create machine work or asynchronous jobs?** Define the
   worker contract, secret names, completion notifications, and admin
   recovery flow up front.
