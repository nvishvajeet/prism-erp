# Catalyst ERP

> Open-source modular ERP. One file. Any organization. 14 modules. 15,000 lines. Zero dependencies beyond Flask + SQLite.

**Live domain:** [catalysterp.org](https://catalysterp.org) · **GitHub:** [nvishvajeet/catalyst-erp](https://github.com/nvishvajeet/catalyst-erp)

## Install

```bash
# One-liner
curl -fsSL https://raw.githubusercontent.com/nvishvajeet/catalyst-erp/main/install.sh | bash

# Or manual
git clone https://github.com/nvishvajeet/catalyst-erp.git catalyst
cd catalyst && ./catalyst init && ./catalyst start
```

## What is Catalyst ERP?

A single-file Flask ERP that runs research facilities, food service companies, and any operation that needs approvals, finance tracking, attendance, and team management. Built in one week with AI-assisted development across two machines (MacBook Pro + Mac Mini).

**Two live deployments:**
- **MIT-WPU CRF** — 21 instruments, 8 roles, sample request workflow
- **Ravikiran Services** — food/hospitality at MIT ADT University, 16 staff, 3 business units

## 14 Modules

| Module | Routes | What it does |
|--------|--------|-------------|
| **Instruments** | 8 | Equipment/unit management, sample requests, approval chains |
| **Finance** | 11 | Grants, invoices, payments, budget enforcement, unified spend |
| **Personnel** | 5 | Staff directory, salary config, payroll (attendance-based) |
| **Vehicles** | 4 | Fleet registry, fuel/maintenance logs, driver assignment |
| **Receipts** | 4 | Expense submission with photo/PDF, admin review |
| **Attendance** | 11 | Self + team marking, leave requests, calendar view |
| **Inbox** | 7 | Internal messaging, threads, attachments, folders |
| **Notifications** | 5 | System alerts, admin notices, category filters |
| **Tasks** | 4 | Todos (self) + Tasks (assigned), inbox-style UI |
| **Letters** | 6 | Create letters on institute letterhead, print as PDF |
| **Calendar** | 4 | Schedule views, bookings, downtime windows |
| **Stats** | 5 | Usage analytics, charts, instrument utilization |
| **Queue** | 8 | Sample request workflow, approval pipeline |
| **Admin** | 14 | User management, dev panel, infrastructure monitoring |

Enable selectively: `CATALYST_MODULES=instruments,finance,personnel,vehicles`

## Cross-Module Integration

Modules talk to each other automatically:

```
Finance ← Vehicle fleet costs + Salary outflow + Approved receipts
Dashboard ← Fleet status + Payroll due + Instrument queues
Personnel ↔ Vehicles (driver ↔ vehicle cross-links)
Personnel → Attendance (payroll auto-calculates from attendance)
Letters ← Personnel (pre-filled recipient from staff directory)
Instruments → Finance (auto-charge samples to default grant)
Notifications ← All modules (status change alerts)
```

Full matrix: [docs/MODULE_INTEGRATION.md](docs/MODULE_INTEGRATION.md)

## Architecture

```
┌──────────────────────────────────────────┐
│  app.py (15,694 lines)                    │
│  ├─ 129 routes                            │
│  ├─ 14 modules (MODULE_REGISTRY)          │
│  ├─ 8 roles (ROLE_ACCESS_PRESETS)         │
│  ├─ 45+ database tables                   │
│  └─ SHA-256 immutable audit chain         │
├──────────────────────────────────────────┤
│  64 Jinja2 templates                      │
│  ├─ 6 UI primitives (tile/widget/badge)   │
│  ├─ 10 reusable macros                    │
│  └─ data-vis role-gating on every element │
├──────────────────────────────────────────┤
│  9,823 lines CSS                          │
│  ├─ Light + dark mode                     │
│  ├─ WCAG AA contrast                      │
│  ├─ 480px → 760px → 1200px responsive     │
│  └─ iOS tile grid system                  │
├──────────────────────────────────────────┤
│  26 automated crawlers                    │
│  ├─ Smoke, visibility, role behavior      │
│  ├─ Dead links, random walk, performance  │
│  ├─ WCAG contrast, CSS hygiene            │
│  └─ 132,700+ checks verified             │
└──────────────────────────────────────────┘
```

## Security

- CSRF protection (Flask-WTF)
- PBKDF2-SHA256 password hashing
- Google OAuth ready (just add credentials)
- Role-based access (8 roles, per-module gating)
- XSS-safe markdown renderer
- File upload validation (type + size)
- Immutable audit trail (SHA-256 chain)
- Cloudflare tunnel for HTTPS (zero-config)

## Roles

| Role | Sees | Can do |
|------|------|--------|
| Owner | Everything | God-mode, dev panel |
| Super Admin | Everything | Manage users, full access |
| Site Admin | Everything except dev | Manage site settings |
| Instrument Admin | Assigned units | Configure instruments |
| Operator | Assigned units | Process samples, mark attendance |
| Finance Admin | Finance portal | Grants, invoices, payroll |
| Approver | Approval queue | Approve/reject requests |
| Requester | Own requests | Submit samples, inbox |

## CLI

```bash
./catalyst start     # Start server
./catalyst init      # Initialize database
./catalyst test      # Run smoke test
./catalyst crawl     # Run sanity wave (26 crawlers)
./catalyst module    # Create new module
./catalyst update    # Zero-downtime update
./catalyst search    # Search from terminal
./catalyst status    # Show system stats
```

## For AI Agents

Any AI agent (Claude, GPT, Gemini, Codex) can build new modules:

- [AGENTS.md](AGENTS.md) — vendor-neutral onboarding
- [docs/ERP_MODULE_BUILDER.md](docs/ERP_MODULE_BUILDER.md) — 15-minute module recipe
- [docs/ARCHITECTURE_SUMMARY.md](docs/ARCHITECTURE_SUMMARY.md) — full UI/CSS/pattern reference
- [docs/MODULE_INTEGRATION.md](docs/MODULE_INTEGRATION.md) — cross-module wiring guide

## Docs

| File | Purpose |
|------|---------|
| [ARCHITECTURE_SUMMARY.md](docs/ARCHITECTURE_SUMMARY.md) | Complete UI/CSS/pattern reference |
| [ERP_MODULE_BUILDER.md](docs/ERP_MODULE_BUILDER.md) | Build a module in 15 minutes |
| [MODULE_INTEGRATION.md](docs/MODULE_INTEGRATION.md) | Cross-module connection matrix |
| [SESSION_LOG.md](docs/SESSION_LOG.md) | Three-engine development stats |
| [PHILOSOPHY.md](docs/PHILOSOPHY.md) | Hard/soft attribute contract |
| [WORKFLOW.md](WORKFLOW.md) | Development workflow + machines-first rule |

## Development Model

Three engines work in parallel:
- **LLM** — designs, writes code, orchestrates
- **MacBook Pro** (M1 Pro 32GB) — local crawlers, smoke tests
- **Mac Mini** (M4 24GB) — remote crawlers via SSH, production deploy

132,700+ automated checks. Zero server errors. 1-year simulation passed.

## License

MIT. Python 3 + Flask 3. No telemetry. No external services.
