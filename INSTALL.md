# PRISM ERP — Installation & Updates

> **For humans and AI agents.** This file tells you how to deploy
> PRISM on any machine (your laptop, a remote server via SSH, a
> shared lab computer) and how to receive updates.

---

## Quick start — 4 commands

```bash
git clone https://github.com/YOUR-ORG/prism-erp.git prism
cd prism
bash scripts/setup.sh
./scripts/start.sh
```

Open `http://127.0.0.1:5055`. Login: `admin@lab.local` / `12345`.

---

## What setup.sh does

1. Creates `.venv/` (Python virtual environment)
2. Installs dependencies from `requirements.txt`
3. Copies `.env.example` → `.env` with a generated secret key
4. Creates `data/demo/`, `data/operational/`, `logs/`
5. Initializes the SQLite database
6. Runs the smoke test to verify everything works

## Configure your modules

Edit `.env` to enable only the modules you need:

```bash
# Lab facility with billing
PRISM_MODULES=instruments,finance,inbox

# HR / personnel department
PRISM_MODULES=attendance,inbox,notifications

# Everything (default)
# PRISM_MODULES=
```

Available modules: `instruments`, `finance`, `inbox`,
`notifications`, `attendance`, `queue`, `calendar`, `stats`,
`admin`.

---

## Deploying on a remote server (SSH)

```bash
# On your local machine
ssh user@server

# On the server
git clone https://github.com/YOUR-ORG/prism-erp.git prism
cd prism
bash scripts/setup.sh

# Edit modules + production config
nano .env
# Set: LAB_SCHEDULER_DEMO_MODE=0
# Set: PRISM_MODULES=instruments,finance,inbox
# Set: OWNER_EMAILS=your-email@example.com

# Start as a background service
nohup bash scripts/start.sh --service > logs/server.log 2>&1 &
disown

# Or install as a launchd service (macOS only)
./scripts/install_launchd.sh
```

---

## Receiving updates — Apple-style

PRISM separates **program files** (code, templates, CSS — updated
by us) from **data files** (your database, uploads, config —
never touched by updates).

```
Program files (updated):     Data files (yours, never touched):
  app.py                       data/demo/lab_scheduler.db
  templates/                   data/operational/
  static/                      .env
  crawlers/                    logs/
  scripts/                     uploads/
  docs/
```

### Check for updates

```bash
bash scripts/update.sh              # pull latest code
bash scripts/update.sh --restart    # pull + restart server
```

The update script:
1. Fetches from the upstream git remote
2. Pulls new commits (rebase, no merge commits)
3. Runs database migrations automatically (`init_db()`)
4. Reinstalls pip packages if `requirements.txt` changed
5. Optionally restarts the server

**Your data is never touched.** The update only modifies program
files that are tracked in git. Your `.env`, database, uploads,
and logs stay exactly as they are.

### Automatic update checks

To check for updates daily:

```bash
# Add to crontab (checks at 6 AM, logs result)
echo "0 6 * * * cd /path/to/prism && bash scripts/update.sh >> logs/update.log 2>&1" | crontab -
```

Or for a macOS launchd scheduled check, see `ops/launchd/README.md`.

---

## For AI agents

If you are an AI coding agent (Claude, Codex, Gemini, Cursor,
Continue, Aider, Copilot, Windsurf):

1. **Read `AGENTS.md` first** — it's the vendor-neutral onboarding
   contract with topology, commit rhythm, pre-commit gate, and the
   docs manifest.
2. **Read `docs/ERP_PRIMITIVES.md`** — the 16 abstract primitives
   and the "new portal in 30 minutes" recipe.
3. **Run `scripts/setup.sh`** if the venv is missing.
4. **Run `scripts/update.sh`** to sync with upstream before starting
   work.
5. **Push to `origin`** after every commit — the pre-receive hook
   runs the smoke test automatically.

### Setting up a remote agent workspace

```bash
# On the remote machine
git clone https://github.com/YOUR-ORG/prism-erp.git prism
cd prism
bash scripts/setup.sh

# The agent can now:
#   - Edit files
#   - Run .venv/bin/python scripts/smoke_test.py
#   - Commit + push to origin
#   - Run bash scripts/update.sh to sync
```

---

## Architecture at a glance

```
prism/
├── app.py              ← THE product (single file, ~12K lines)
├── .env                ← YOUR config (modules, secret key, flags)
├── data/
│   ├── demo/           ← Demo database + uploads (regenerable)
│   └── operational/    ← Production database + uploads (YOURS)
├── templates/          ← Jinja2 HTML templates (updated by us)
├── static/             ← CSS + JS (updated by us)
├── crawlers/           ← Test/audit suite (updated by us)
├── scripts/
│   ├── setup.sh        ← First-time install
│   ├── update.sh       ← Pull updates (Apple-style)
│   ├── start.sh        ← Start the server
│   └── smoke_test.py   ← Pre-commit verification
├── docs/               ← Architecture + design docs
├── AGENTS.md           ← AI agent onboarding (any vendor)
├── INSTALL.md          ← This file
└── README.md           ← Project overview
```

## Support

- Issues: https://github.com/YOUR-ORG/prism-erp/issues
- Docs: `docs/` folder in this repo
- AI agents: start with `AGENTS.md`
