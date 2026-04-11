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

## 2. Running as a service (W1.3.8, 2026-04-11)

The real recipe. Run on the mini after the first-boot in §1 works.
The old `backend/launchd` / `backend/start_server.sh` paths in earlier
revisions of this doc never existed in git — they were aspirational.
These are the actual files:

* `ops/launchd/local.prism.plist` — LaunchAgent definition
* `scripts/start.sh --service` — foreground runner (venv python,
  sources `.env`, `exec`s `app.py`, no reloader, no Chrome)
* `scripts/install_launchd.sh` — one-shot installer (bootstrap +
  kickstart, idempotent)

```bash
cd ~/Scheduler/Main
./scripts/install_launchd.sh
```

That script:

1. Copies `ops/launchd/local.prism.plist` to
   `~/Library/LaunchAgents/local.prism.plist`.
2. `launchctl bootout` any previously-loaded copy (silent if absent).
3. `launchctl bootstrap gui/$(id -u) …` to load the service.
4. `launchctl kickstart -k gui/$(id -u)/local.prism` to start it
   immediately so a reboot isn't required.
5. `launchctl print` + the first 15 lines of `logs/server.log` as
   a local smoke check.

Verify from the laptop that the service is actually serving:

```bash
PRISM_DEPLOY_URL=http://127.0.0.1:5055 \
  .venv/bin/python -m crawlers run deploy_smoke
# → PASS 3  FAIL 0  WARN 0 when everything is green
```

Tail logs while developing:

```bash
tail -f ~/Scheduler/Main/logs/server.log
```

Stop and uninstall:

```bash
launchctl bootout gui/$(id -u)/local.prism
rm ~/Library/LaunchAgents/local.prism.plist
```

**Known gotcha — launchd env is empty.** Launchd does NOT inherit
your shell's environment, so the service relies on `start.sh`
sourcing `.env` at boot. If `SECRET_KEY`, `LAB_SCHEDULER_HOST`, or
`LAB_SCHEDULER_DEMO_MODE` appear unset in `logs/server.log`, the
fix is always in `.env` + a kickstart, never in the plist.

**Log rotation — newsyslog (opt-in, one-time sudo).** The launchd
plists point both `StandardOutPath` and `StandardErrorPath` at a
single `logs/server.log`, which otherwise grows forever on a
long-running deploy. The rotation policy lives at
`ops/launchd/newsyslog.prism.conf` and is picked up by macOS's
built-in hourly `com.apple.newsyslog` job — no cron, no extra
daemon. Install it once:

```bash
sudo cp ops/launchd/newsyslog.prism.conf /etc/newsyslog.d/prism.conf
sudo chown root:wheel /etc/newsyslog.d/prism.conf
sudo chmod 644 /etc/newsyslog.d/prism.conf
```

`./scripts/install_launchd.sh` prints these exact commands at the
end of its run — it never executes them itself, because PRISM
installs are manual and never silently `sudo`. Policy: rotate
when `logs/server.log` crosses 10 MB, keep 7 gzipped archives
(`server.log.0.gz` … `server.log.6.gz`), drop older ones. Not
time-driven — a quiet week never churns the log.

**Gotcha after rotation — launchd keeps the old FD.** When
newsyslog moves `logs/server.log` aside, the running Flask process
still has the old inode open via launchd's stdout redirection and
will continue writing to the rotated (now archive) file. Disk
stays bounded, but the newest lines aren't visible under the
expected filename until the service is bounced. Fix on the mini
(or laptop service) with:

```bash
launchctl kickstart -k gui/$(id -u)/local.prism
```

In practice the service restarts often enough during development
that you rarely need to do this by hand; on the production mini a
quarterly kickstart (or a natural reboot) is sufficient.

**Rule (see PHILOSOPHY.md §3):** the website stays up. The mini
is not allowed to fall over between releases. Crawler proof of
that rule is the `deploy_smoke` strategy added to the `sanity`
wave — every push to `v1.3.0-stable-release` (with
`PRISM_DEPLOY_URL` set) re-verifies the mini is answering.

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
  reaches PRISM at `http://100.115.176.118:5055/` (plain HTTP
  until Serve is enabled).
- **Tailscale Serve (HTTPS):** see `docs/HTTPS.md` for the Plan-A
  recipe that puts a real Let's Encrypt cert in front of Flask on
  `https://<magicdns>.ts.net/`. This replaces the old Caddy +
  self-signed flow that lived in `ops/Caddyfile` + `ops/certs/`.
- **LAN:** when the mini is on the same LAN as the users, it also
  serves on its local IP on port 5055.

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
