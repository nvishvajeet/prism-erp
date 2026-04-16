# Deploy Checklist — 2026-04-16

> Run this on the Mac mini (prism-mini) to deploy the sprint's work.
> Both Lab-ERP and Ravikiran need updating. The mini is currently on
> `v1.3.0-stable-release`; the sprint work is on `operation-trois-agents`.
> v2.0.0-rc1 is already tagged.

---

## Pre-flight (verify from any machine)

```bash
# From MBP or iMac — confirm the tag exists
ssh prism-mini "cd ~/Scheduler/Main && git fetch origin --tags && git tag -l 'v2.0*'"
# Expected: v2.0.0-rc1
```

---

## Step 1 — Lab-ERP (port 5055, operational)

```bash
ssh prism-mini << 'EOF'
cd ~/Scheduler/Main

# Pull the tagged release
git fetch origin --tags
git checkout v2.0.0-rc1
# OR if you want the sprint branch directly:
# git fetch origin operation-trois-agents
# git checkout operation-trois-agents

# Verify
.venv/bin/python scripts/smoke_test.py
.venv/bin/python scripts/ship_readiness_check.py

# Restart the service
launchctl kickstart -k gui/$(id -u)/local.catalyst
sleep 3
curl -sI http://localhost:5055/login | head -5
# Should show 200 + security headers (X-Frame-Options: DENY, etc.)
EOF
```

---

## Step 2 — Lab-ERP demo (port 5056)

```bash
ssh prism-mini << 'EOF'
# The demo service uses the same codebase, different data dir
launchctl kickstart -k gui/$(id -u)/local.catalyst.mitwpu
sleep 3
curl -sI http://localhost:5056/login | head -5
EOF
```

---

## Step 3 — Ravikiran ERP (port 5057, NEW)

This is the first deploy of Ravikiran on the mini.

```bash
ssh prism-mini << 'EOF'
# Clone if not already present
if [ ! -d ~/Scheduler/Ravikiran ]; then
    git clone ~/git/ravikiran-erp.git ~/Scheduler/Ravikiran
fi
cd ~/Scheduler/Ravikiran

# Pull the sprint branch
git fetch origin operation-trois-agents
git checkout operation-trois-agents

# Create venv
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# Init DB
.venv/bin/python -c "import app; app.init_db()"
.venv/bin/python scripts/populate_live_demo.py

# Install launchd service
cat > ~/Library/LaunchAgents/local.catalyst.ravikiran.plist << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>local.catalyst.ravikiran</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-lc</string>
    <string>cd ~/Scheduler/Ravikiran && set -a && . ./.env 2>/dev/null; set +a && exec .venv/bin/gunicorn app:app -w 2 -b 127.0.0.1:5057 --access-logfile - --error-logfile -</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/Users/vishwajeet/Scheduler/Ravikiran</string>
  <key>StandardOutPath</key>
  <string>/Users/vishwajeet/Scheduler/Ravikiran/logs/server.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/vishwajeet/Scheduler/Ravikiran/logs/server.log</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>EnvironmentVariables</key>
  <dict>
    <key>LAB_SCHEDULER_DEMO_MODE</key>
    <string>1</string>
    <key>LAB_SCHEDULER_AUTORELOAD</key>
    <string>0</string>
    <key>PRISM_ORG_NAME</key>
    <string>Ravikiran</string>
    <key>PRISM_ORG_TAGLINE</key>
    <string>Household and Estate Operations</string>
  </dict>
</dict>
</plist>
PLIST

# Create logs dir
mkdir -p ~/Scheduler/Ravikiran/logs

# Bootstrap the service
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/local.catalyst.ravikiran.plist
launchctl kickstart -k gui/$(id -u)/local.catalyst.ravikiran
sleep 3

# Verify
curl -sI http://localhost:5057/login | head -5
# Should show 200 with Ravikiran branding
curl -sS http://localhost:5057/login | grep -i "brand-name"
# Should show "Ravikiran"
EOF
```

---

## Step 4 — Cloudflare tunnel ingress

The tunnel is remote-managed (dashboard/API). Update ingress at
https://one.dash.cloudflare.com/ → tunnels → `b1d5e505-...`:

| Hostname | Service | Notes |
|---|---|---|
| `catalysterp.org` | `http://localhost:5060` | chooser (once deployed) |
| `mitwpu-rnd.catalysterp.org` | `http://localhost:5055` | Lab-ERP operational |
| `ravikiran.catalysterp.org` | `http://localhost:5057` | **NEW — Ravikiran** |
| `playground.catalysterp.org` | `http://localhost:5056` | Lab-ERP demo |

Currently `ravikiran.catalysterp.org` routes to Lab-ERP (5055).
Change it to 5057.

---

## Step 5 — Verify live

```bash
# From any machine with internet access:
curl -sSI https://ravikiran.catalysterp.org/login | head -10
# Should show: Ravikiran session cookie, security headers

curl -sS https://ravikiran.catalysterp.org/login | grep "brand-name"
# Should show: Ravikiran (not CATALYST or PRISM)

curl -sSI https://mitwpu-rnd.catalysterp.org/login | grep "X-Frame"
# Should show: X-Frame-Options: DENY

# Try logging in as nikita / 12345 on ravikiran
# Try logging in as owner@catalyst.local / 12345 on mitwpu-rnd
```

---

## Rollback

If anything goes wrong:
```bash
ssh prism-mini "cd ~/Scheduler/Main && git checkout v1.3.0-stable-release && launchctl kickstart -k gui/\$(id -u)/local.catalyst"
```

Ravikiran has no rollback state (first deploy) — just
`launchctl bootout gui/$(id -u)/local.catalyst.ravikiran` to stop it.
