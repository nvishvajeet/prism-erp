# Developer Onboarding — PRISM / Catalyst ERP

Welcome to the project. This guide gets you from a **brand-new Mac** (factory fresh, nothing installed) to a fully working development environment.

**Time needed:** ~20 minutes (mostly waiting for downloads).

---

## Step 1 — Open Terminal

Press `Cmd + Space`, type **Terminal**, press Enter.

## Step 2 — Paste this and press Enter

Copy this entire block. Paste it into Terminal. Press Enter. It will ask for your Mac password once at the start.

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" \
  && eval "$(/opt/homebrew/bin/brew shellenv)" \
  && echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile \
  && brew install git node python@3.12 wget curl jq \
  && brew install --cask mactex-no-gui \
  && export PATH="/Library/TeX/texbin:$PATH" \
  && echo 'export PATH="/Library/TeX/texbin:$PATH"' >> ~/.zprofile \
  && npm install -g @anthropic-ai/claude-code \
  && pip3 install flask flask-wtf gunicorn werkzeug openpyxl requests numpy pandas matplotlib scipy pillow jupyterlab \
  && git config --global user.name "Satyajeet Nagargoje" \
  && git config --global user.email "satyajeet@catalyst.local" \
  && mkdir -p ~/Documents/Scheduler \
  && git clone https://github.com/nvishvajeet/prism-erp.git ~/Documents/Scheduler/Main \
  && cd ~/Documents/Scheduler/Main \
  && git checkout v1.3.0-stable-release \
  && echo "" \
  && echo "========================================" \
  && echo "  SETUP COMPLETE" \
  && echo "  Now run:  cd ~/Documents/Scheduler/Main && claude" \
  && echo "========================================"
```

Wait until you see **SETUP COMPLETE**.

## Step 3 — Start Claude Code

```bash
cd ~/Documents/Scheduler/Main && claude
```

Claude will ask you to log in with your Anthropic account. Follow the prompts.

## Step 4 — Open the website

Open **Chrome** and go to:

    https://catalysterp.org

Vishvajeet will give you your login credentials.

## Step 5 — Run locally (for testing)

```bash
cd ~/Documents/Scheduler/Main
python3 app.py
```

Then open http://localhost:5000 in Chrome. Demo mode — login with `vishva` and any password.

---

## How development works

- Open `TASKS.md` in the project — it has your current assignments.
- Vishvajeet writes the tasks. You (and your Claude agents) execute them.
- Always work on a branch:
  ```bash
  git checkout -b sat/your-feature-name
  ```
- Never push directly to `v1.3.0-stable-release`.
- When done, push your branch:
  ```bash
  git push origin sat/your-feature-name
  ```
- Vishvajeet reviews and merges to production.

## What gets installed

| Package | What it is |
|---|---|
| Homebrew | Mac package manager |
| git | Version control |
| node | JavaScript runtime (for Claude Code) |
| python 3.12 | Python runtime |
| MacTeX | LaTeX typesetting (pdflatex, biber, etc.) |
| Claude Code | AI coding assistant (CLI) |
| Flask + deps | Web framework the project runs on |
| numpy, pandas, matplotlib, scipy | Scientific Python stack |
| pillow | Image processing |
| jupyterlab | Notebook environment |

## Questions?

Ask Vishvajeet. He controls the project and all task assignments.
