# Catalyst ERP

> Open-source ERP for Research & Operations. One file. Any institution.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/YOUR-ORG/prism-erp/main/install.sh | bash
```

## What is PRISM?

PRISM is a modular ERP system for shared laboratory facilities. It manages
instrument booking, sample requests with sequential approvals (finance,
professor, operator), grant tracking, attendance, and internal messaging --
all from a single Flask application backed by SQLite.

## Modules

| Module | What it does |
|--------|-------------|
| Instruments | Book shared lab instruments, manage samples, track usage |
| Finance | Grants, budgets, invoices, payment approvals |
| Receipts | Attachment-backed receipt chain with SHA-256 audit trail |
| Notifications | Broadcast notices, system alerts, noticeboard |
| Inbox | Internal messaging with reply threads, attachments, folders |
| Attendance | Time tracking, leave requests, operator schedules |
| Todos | Per-user task lists tied to requests and instruments |
| Calendar | Calendar views for bookings, deadlines, maintenance windows |
| Stats | Usage analytics, instrument utilisation, approval throughput |

Enable selectively via `PRISM_MODULES` in `.env`.

## Quick Start

```bash
git clone https://github.com/YOUR-ORG/prism-erp.git prism
cd prism
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python app.py
# Open http://127.0.0.1:5055 -- login: admin@lab.local / 12345
```

## For AI Agents

See [AGENTS.md](AGENTS.md) for vendor-neutral onboarding.
See [docs/ERP_MODULE_BUILDER.md](docs/ERP_MODULE_BUILDER.md) to build new modules.

## Architecture

- Single-file Flask app (`app.py`)
- SQLite database
- Jinja2 templates with canonical widget macros
- Role-based access (8 roles)
- Module toggle via `PRISM_MODULES` env var
- Google OAuth ready
- 26 automated crawlers across 11 waves
- Immutable SHA-256 audit chain
- CSRF protection on by default

## Docs

| File | Purpose |
|------|---------|
| [PHILOSOPHY.md](docs/PHILOSOPHY.md) | Hard/soft attribute contract, design creed |
| [PROJECT.md](docs/PROJECT.md) | Architecture, schema, page map, security model |
| [MODULES.md](docs/MODULES.md) | Engine map with file:line handles |
| [DEPLOY.md](docs/DEPLOY.md) | Production deployment on Mac mini |
| [CHANGELOG.md](CHANGELOG.md) | Release history |

## License

Python 3 + Flask 3. No telemetry. No external services on the happy path.
