# PRISM — Local deploy (laptop hosting)

The pragmatic counterpart to `docs/DEPLOY.md` (Mac mini
production) and `docs/HTTPS.md` (Tailscale Serve / Let's Encrypt).
This doc answers one question: **how do I host PRISM on my laptop
right now?**

Three options, ranked by effort and reliability. Pick the lowest
tier that meets the survival window you need.

---

## 1. Three ways to run locally

| Tier | How | Lives through | Use when |
|---|---|---|---|
| **Ephemeral** | `./scripts/start.sh` | closing the terminal kills it | active development — reloader on, Chrome auto-opens, debug tracebacks visible |
| **Session-persistent** | `nohup bash scripts/start.sh --service > logs/server.log 2>&1 & disown` | terminal close, but **not** logout or reboot | "I just need PRISM up for the afternoon demo" — this is the current operational state on the laptop |
| **Boot-persistent** | `./scripts/install_launchd.sh` | logout, reboot, lid-close | you want PRISM up the same way the Mac mini has it up — always-on, launchd `KeepAlive`, survives everything |

### Ephemeral — `./scripts/start.sh`

```bash
cd ~/Documents/Scheduler/Main
./scripts/start.sh
```

Development mode. `LAB_SCHEDULER_DEBUG=1`, Flask reloader watching
`.py` / CSS / JS, Chrome auto-opens `http://127.0.0.1:5055`. Dies
with the terminal (Ctrl-C or closing the tab both work).

### Session-persistent — `nohup … & disown`

```bash
cd ~/Documents/Scheduler/Main
mkdir -p logs
nohup bash scripts/start.sh --service > logs/server.log 2>&1 &
disown
```

Service mode (`--service` exports `LAB_SCHEDULER_DEBUG=0`, no
reloader, no Chrome). `nohup` + `disown` detach the process so it
keeps running after the terminal closes, but macOS still kills it
on logout or reboot. Zero ceremony, no TCC grants, no plists.

### Boot-persistent — launchd agent

```bash
cd ~/Documents/Scheduler/Main
./scripts/install_launchd.sh
```

Installs `ops/launchd/local.prism.laptop.plist` as a LaunchAgent
under `gui/$(id -u)` with `KeepAlive` and `RunAtLoad`. Survives
logouts, reboots, and crashes (launchd respawns within seconds).

**One-time gotcha:** the laptop working copy lives under
`~/Documents/`, which macOS TCC gates. You must grant Full Disk
Access to `/bin/bash` once, or the service fails silently with
`last exit code = 126`. See `ops/launchd/README.md` § *macOS TCC
gotcha* for the three alternative fixes. Do not skip that section
before running the installer.

Everything else about the launchd flow — install, uninstall,
verify, the no-reloader rationale — lives in
`ops/launchd/README.md`. This doc does not duplicate it.

---

## 2. First-run on a fresh clone

```bash
git clone ~/.claude/git-server/lab-scheduler.git ~/Documents/Scheduler/Main
cd ~/Documents/Scheduler/Main
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
./scripts/start.sh
# open http://127.0.0.1:5055
# login: admin@lab.local / SimplePass123  (demo mode, seeded)
```

First run seeds a demo database (`LAB_SCHEDULER_DEMO_MODE=1` is
the default). Every seeded account shares `SimplePass123` — see
`README.md` § *Demo accounts* for the full roster.

---

## 3. Environment flags that matter for local

PRISM does **not** auto-load `.env`. Either `source .env` before
running, or let `scripts/start.sh` do it (it runs `set -a; . ./.env`
on boot). These are the flags that actually affect local hosting:

| Flag | Default | What it does |
|---|---|---|
| `LAB_SCHEDULER_SECRET_KEY` | random per-launch | Flask session signing. `start.sh` generates one with `openssl rand -hex 32` if unset — set it explicitly if you want sessions to survive a restart. |
| `LAB_SCHEDULER_DEMO_MODE` | `1` | Seeds the demo DB and enables `/demo/switch`. Leave it on for local. |
| `LAB_SCHEDULER_HTTPS` | unset | `start.sh --https` flips this on. Local hosting doesn't need it — use plain HTTP on loopback. |
| `LAB_SCHEDULER_COOKIE_SECURE` | unset | Set 1 only when you're behind HTTPS; otherwise sessions break over plain HTTP loopback. |
| `LAB_SCHEDULER_CSRF` | unset | Flask-WTF CSRF enforcement. Off by default; flip on after W6.11. |
| `LAB_SCHEDULER_HOST` | `127.0.0.1` | Bind address. Leave as loopback on the laptop — do NOT set `0.0.0.0` locally, that exposes the dev server to the LAN. |
| `LAB_SCHEDULER_DEBUG` | `0` | `start.sh` flips it to `1` in dev mode and `0` in `--service` mode. Never set it to `1` under launchd (see § Troubleshooting). |
| `OWNER_EMAILS` | `admin@lab.local` | Comma-separated super-admins. Fine as-is for local. |

---

## 4. Verifying it's up

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:5055/login
# expect: 200
```

```bash
PRISM_DEPLOY_URL=http://127.0.0.1:5055 \
  .venv/bin/python -m crawlers run deploy_smoke
# expect: PASS 3  FAIL 0  WARN 0
```

```bash
tail -f logs/server.log
```

The `deploy_smoke` crawler is the same one the Mac mini runs after
every release — if it passes locally, the laptop is serving PRISM
the same way production does.

---

## 5. Troubleshooting

**Port 5055 already in use.** Something else is bound (an old
`start.sh`, a stale launchd respawn, another project):

```bash
lsof -i :5055
kill -9 <pid>
```

**`Address already in use` only under launchd.** This is the
reloader fork-and-exit bug. If `LAB_SCHEDULER_DEBUG=1` somehow
leaks into service mode, Flask's reloader forks a grandchild and
the parent exits — launchd sees the parent vanish, marks the
service `EX_CONFIG`-crashed, and starts respawning into a socket
that the grandchild still holds. The fix is the `is_debug=0` wiring
in `app.py` around the `app.run()` call; any launchd crash loop is
the first sign someone re-introduced `debug=True` under
`--service`. Check `start.sh` first, not the plist.

**`last exit code = 126` under launchd.** TCC is blocking `/bin/bash`
from reading `~/Documents/`. See `ops/launchd/README.md` § *macOS
TCC gotcha* for the Full Disk Access grant (or the two alternative
fixes — relocate the working copy, or fall back to the `nohup`
tier above).

---

See also: `docs/DEPLOY.md` (Mac mini production recipe),
`docs/HTTPS.md` (Tailscale Serve + Let's Encrypt), `ops/launchd/README.md`
(launchd install/uninstall/verify + TCC gotcha), `README.md`
(project quickstart and demo account roster).
