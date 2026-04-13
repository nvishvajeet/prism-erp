# ERP Composition Guide — How Modules Make ERPs

> How to compose different ERP systems from the same module library.
> Like LEGO — same bricks, different buildings.

## In one minute

To build a new ERP variant:

1. Pick the smallest useful module bundle
2. Keep `finance`, `notifications`, and `admin` in mind as shared glue
3. Enable modules with `CATALYST_MODULES=...`
4. Add organization-specific seed data
5. Grow only after the core workflow feels stable

The easiest future systems are the ones that start small and reuse the
same module patterns.

## The Idea

Catalyst ERP has 14 modules. Not every organization needs all 14.
A lab needs instruments + finance + attendance. A food company needs
personnel + vehicles + finance + attendance. A school needs
attendance + letters + todos.

**You compose an ERP by selecting which modules to enable:**

```bash
# Lab ERP (MIT-WPU CRF)
CATALYST_MODULES=instruments,finance,inbox,notifications,attendance,queue,calendar,stats,admin

# Food/Hospitality ERP (Ravikiran Services)
CATALYST_MODULES=finance,personnel,vehicles,attendance,receipts,todos,inbox,notifications

# School Administration
CATALYST_MODULES=personnel,attendance,letters,finance,todos,notifications

# Construction Company
CATALYST_MODULES=vehicles,personnel,finance,receipts,attendance,todos

# Consulting Firm
CATALYST_MODULES=finance,personnel,letters,todos,inbox,receipts
```

One codebase. One `app.py`. Different `CATALYST_MODULES` = different ERP.

## Module Dependency Map

Some modules are standalone. Others need each other:

```
STANDALONE (work alone):
  inbox, notifications, todos, letters, receipts, attendance

NEED EACH OTHER:
  instruments → queue → calendar → stats (the lab workflow chain)
  personnel → attendance (payroll reads attendance data)
  vehicles → personnel (driver assignment)
  finance → everything (every module can generate costs)

ALWAYS INCLUDED:
  admin (user management — every ERP needs users)
```

## Integration Matrix — What Happens When You Enable Two Modules

| If you enable... | ...alongside... | They auto-connect via: |
|-----------------|----------------|----------------------|
| finance | vehicles | Fleet costs appear in finance KPIs |
| finance | personnel | Salary outflow in finance KPIs |
| finance | receipts | Approved receipts in spend view |
| finance | instruments | Grant-linked invoices |
| personnel | attendance | Payroll auto-calculates from attendance |
| personnel | vehicles | Driver ↔ vehicle cross-links |
| personnel | letters | "Write Letter" button on employee profile |
| vehicles | personnel | Assigned driver shown on vehicle |
| dashboard | all | Summary tiles auto-appear per enabled module |
| notifications | all | Status changes trigger system notifications |

## How Integration Works (Technical)

Each module checks `module_enabled('other_module')` before adding
cross-links:

```python
# In finance_portal() route:
if module_enabled("vehicles"):
    vehicle_spend = query_one("SELECT SUM(amount) FROM vehicle_logs")
    # Add "Fleet Costs" stat_blob to finance dashboard

if module_enabled("personnel"):
    salary_total = query_one("SELECT SUM(net_pay) FROM salary_payments WHERE status='paid'")
    # Add "Salaries Paid" stat_blob
```

**If a module is disabled, its integrations silently disappear.**
No errors, no broken links, no empty tiles. The ERP adapts.

## Recommended starter bundles

If you are unsure where to begin, use one of these:

| ERP type | Start with |
|---|---|
| Lab ERP | `instruments,finance,queue,calendar,stats,notifications,admin` |
| Service business ERP | `finance,personnel,attendance,receipts,notifications,admin` |
| Ops-heavy field team | `personnel,vehicles,attendance,finance,notifications,admin` |
| Admin office ERP | `personnel,letters,todos,finance,notifications,admin` |
| Compute ERP | `compute,notifications,inbox,admin` |

Add `inbox` when collaboration becomes heavy, not by default.

Full demo presets:
[`ERP_DEMO_VARIANTS.md`](ERP_DEMO_VARIANTS.md)

## Adding a New Module — Integration Checklist

When you build module X, check each existing module:

```
□ Does X generate COSTS?
  → Add X's costs to finance spend view (UNION query)
  → Add KPI stat_blob to finance dashboard

□ Does X involve PEOPLE?
  → Link to personnel profiles
  → Show X data on personnel detail page

□ Does X have STATUS CHANGES?
  → Add notify() calls for each transition
  → Fire notifications to relevant users

□ Does X have APPROVAL needs?
  → Wire into approval chain (approval_steps table)
  → Respect ROLE_ACCESS_PRESETS

□ Does X have DATES/DEADLINES?
  → Add to calendar view
  → Add reminder notifications

□ Should X appear on DASHBOARD?
  → Add summary tile (stat_blobs for KPIs)
  → Gate with module_enabled() + role check

□ Does X need DOCUMENTS?
  → Link to letters module ("Write letter about X")

□ Does X track ASSETS?
  → Link to vehicles/inventory if relevant
```

## Removing a Module

```bash
# Before: all modules
CATALYST_MODULES=instruments,finance,personnel,vehicles,attendance,...

# After: remove vehicles
CATALYST_MODULES=instruments,finance,personnel,attendance,...
```

What happens:
- Vehicle nav link disappears
- Finance "Fleet Costs" KPI disappears
- Dashboard "Fleet Status" tile disappears
- Personnel "Assigned Vehicles" section disappears
- All vehicle routes return 404
- **Database tables stay** (data preserved, just hidden)
- **Re-enable anytime** — data comes back

## Building a New ERP from Scratch

```bash
# 1. Clone Catalyst
git clone https://github.com/nvishvajeet/catalyst-erp.git my-erp
cd my-erp

# 2. Initialize
./catalyst init

# 3. Create .env with YOUR modules
cat > .env << 'EOF'
ORG_NAME=My Company
ORG_TAGLINE=What we do
CATALYST_MODULES=finance,personnel,attendance,receipts,todos
OWNER_EMAILS=admin
EOF

# 4. Seed your users
python3 -c "
import app
from werkzeug.security import generate_password_hash
app.init_db()
db = __import__('sqlite3').connect(app.DB_PATH)
pw = generate_password_hash('12345', method='pbkdf2:sha256')
db.execute('INSERT INTO users (name, email, password_hash, role, invite_status, active) VALUES (?, ?, ?, ?, ?, ?)',
           ('Admin', 'admin', pw, 'super_admin', 'active', 1))
db.commit()
"

# 5. Start
./catalyst start
# Open http://localhost:5055 — login: admin / 12345
```

Total time: 5 minutes. You have a working ERP.

## Real Examples

### Ravikiran Services (Food/Hospitality)
- 27 users (owner → finance → managers → cooks → waiters → drivers)
- 3 business units (mess, tuck shop, laundry)
- 6 budget grants (semester contracts, vehicle ops, salary fund)
- 2 vehicles with assigned drivers
- 20 salary configurations
- Modules: finance, personnel, vehicles, attendance, receipts, todos

### MIT-WPU CRF (Research Lab)
- 31 users (dean → admins → operators → approvers → requesters)
- 21 instruments across 5 clusters
- Sample request workflow with 3-step approval
- Grant management with budget enforcement
- Modules: instruments, finance, queue, calendar, stats, attendance

### Compute ERP
- HPC scheduler and software catalog
- queued, running, failed, and needs-attention job states
- worker-backed execution contract
- Modules: compute, notifications, inbox, admin

### Future: School Administration
- Principal, teachers, office staff, parents
- Modules: personnel, attendance, letters, finance, todos
- Teacher salary + attendance tracking
- Parent communication via letters
- Fee collection via finance
```
