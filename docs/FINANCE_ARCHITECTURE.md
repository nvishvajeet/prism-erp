# Finance Portal Architecture — Design from User Feedback

> Captured 2026-04-12T16:51. This is the definitive design for the
> Finance module.

## Core concept

The Finance portal mirrors the Instrument portal:
- **Instrument → Grant** (the entity everything charges to)
- **Sample request → Expense/charge** (the transaction)
- **Operator → Finance officer** (processes payments)
- **Instrument admin → Grant PI / Portfolio manager** (owns the entity)

## What happens in the department

1. **Grants fund everything.** Every sample costs money. Samples are
   charged to a grant's budget.
2. **Internal samples** — charged to internal grants (free, but tracked
   for budget consumption).
3. **External samples** — customer pays, receipt issued, payment
   recorded before sample is tested.
4. **Equipment purchases** — reagents, new machines charged to grants.
5. **Vendors** — external suppliers paid from grants (no login, but
   expenses logged in the system).

## Finance roles

| Role | What they do | Maps to |
|---|---|---|
| **Grant PI / Portfolio manager** | Owns 1+ grants, approves charges, tracks expenses | instrument_admin |
| **Finance officer** | Processes payments, issues receipts, records transactions | operator |
| **Finance admin** | Creates grants, broad oversight, approves large expenses | site_admin |
| **Dean / Director** | Views all grants, budget summaries | super_admin |

One portfolio manager can manage multiple grants depending on
workload.

## Workflow

1. Sample submitted → charged to a grant
2. Finance officer checks payment (external) or logs internal charge
3. If external: receipt required before sample proceeds
4. Finance approval gate: paid/approved → sample can be tested
5. Faculty track their grant expenses
6. Dean tracks all grants + budget health

## Data model

Already exists:
- `grants` table (code, name, sponsor, PI, budget, type, department)
- `grant_allocations` (grant → project mapping)
- `invoices` (per-request billing document)
- `payments` (money events against invoices)
- Sample requests have `grant_id` FK

Needs:
- `grant_expenses` table for non-sample charges (equipment, reagents, vendor payments)
- Per-grant approval config (like instrument_approval_config)
- Grant PI assignment (already `pi_user_id` on grants)
- Portfolio manager role (multiple grants per person)

## UI pages needed

- `/finance` — dashboard with KPIs (already exists)
- `/finance/grants` — grant list with budget bars (already exists)
- `/finance/grants/<id>` — grant detail with charged samples (already exists, needs editing)
- `/finance/grants/<id>/expenses` — non-sample expenses (NEW)
- `/finance/grants/<id>/form-control` — grant approval config (clone of instrument form-control)
- `/finance/receipts` — receipt management (NEW)
