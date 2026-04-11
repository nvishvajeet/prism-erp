# PRISM — Deployment

PRISM ships on two machines.

- **Development:** the MacBook Pro (working tree). Claude works
  here. `master` is the source of truth.
- **Production host:** the Mac mini in India, reachable via
  Tailscale at `vishwajeet@100.115.176.118`. It serves the PRISM
  website to anyone on the network.

Git is the only sync layer between them. There is no live shared
folder.

---

## 1. First-time Mac mini setup

Run once on the mini (SSH in from the MacBook):

```bash
ssh vishwajeet@100.115.176.118

# install runtime
brew install python@3.12 git caddy

# clone and boot
git clone vishwajeet@100.115.176.118:~/git/lab-scheduler.git ~/Scheduler/Main
cd ~/Scheduler/Main
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# production env
cat > .env <<'EOF'
LAB_SCHEDULER_SECRET_KEY=<generate with: openssl rand -hex 32>
LAB_SCHEDULER_DEMO_MODE=0
LAB_SCHEDULER_HTTPS=true
LAB_SCHEDULER_COOKIE_SECURE=true
LAB_SCHEDULER_CSRF=1
OWNER_EMAILS=admin@lab.local
EOF

# initial boot (foreground — just to confirm it serves)
set -a && source .env && set +a
.venv/bin/python app.py
```

Open `http://100.115.176.118:5055/` from any machine on the
Tailscale network.

---

## 2. Running as a service

On the Mac mini, once the first boot works, install the launchd
plist so PRISM starts on reboot and restarts on crash:

```bash
cp backend/launchd/local.prism.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/local.prism.plist
launchctl start local.prism
```

The plist points at `~/Scheduler/Main/backend/start_server.sh`
which sources `.env`, kills any stale process on 5055, and boots
`app.py` via the `.venv` python. stdout and stderr go to
`~/Scheduler/Main/logs/server.log`.

**Rule (see PHILOSOPHY.md §3):** the website stays up. The mini
is not allowed to fall over between releases.

---

## 3. Deploying a new release

From the MacBook:

```bash
# 1. Ensure the mini's working tree is clean.
ssh mini 'cd ~/Scheduler/Main && git status --porcelain'

# 2. Push the release from the MacBook.
git push origin master

# 3. Fetch + restart on the mini.
ssh mini 'cd ~/Scheduler/Main && \
  git pull --rebase && \
  .venv/bin/pip install -r requirements.txt && \
  .venv/bin/python scripts/smoke_test.py && \
  launchctl kickstart -k gui/$(id -u)/local.prism'
```

The deploy is gated by `scripts/smoke_test.py`. If smoke fails the
`launchctl kickstart` does not run and the old process keeps
serving.

---

## 4. SSH access — the keychain typo

The MacBook `~/.ssh/config` had a lowercase `usekeychain` entry
on line 10 which newer OpenSSH builds (homebrew) reject as a bad
configuration option. Apple's `/usr/bin/ssh` accepts it. Fix:

```bash
sed -i '' 's/[[:<:]]usekeychain[[:>:]]/UseKeychain/' ~/.ssh/config
```

or use `/usr/bin/ssh` explicitly:

```bash
GIT_SSH_COMMAND=/usr/bin/ssh git push origin master
```

`backend/setup_remote.command` handles this interactively.

---

## 5. The access surface

- **Tailscale network:** every user on the lab's Tailscale tailnet
  reaches PRISM at `http://100.115.176.118:5055/`.
- **LAN:** when the mini is on the same LAN as the users, it also
  serves on its local IP on port 5055.
- **Reverse proxy (optional):** `backend/Caddyfile` terminates
  HTTPS on :443 and forwards to 127.0.0.1:5055. Enable by starting
  `caddy run --config backend/Caddyfile`.

---

## 6. What does NOT run on the mini

The Mac mini hosts the **website and the database only.** It
does not run any background model, scheduler, cron, or crawler.
All of that work stays on the MacBook development machine. The
mini's job is: serve PRISM, 24×7, to whoever is on the network.

---

## 7. Disaster checklist

If the mini is unreachable:

1. `ssh vishwajeet@100.115.176.118 'launchctl list | grep prism'`
2. If the service is dead: `launchctl kickstart -k gui/$(id -u)/local.prism`
3. If SSH is dead: power-cycle the mini (physical access).
4. If the database is corrupted: restore from the latest nightly
   backup under `backups/lab_YYYYMMDD.db` (the cron on the mini
   writes one per day — a hard attribute, don't remove).
