# New-machine onboarding for the CATALYST rig

> How to add a Mac to the rig so it can host a tenant, join the
> Cloudflare tunnel, participate in the crawler fleet, and be
> reachable via SSH-over-Cloudflare.
>
> Concrete examples at the end for Nikita's M1 and Satyajeet's
> M2 Pro.
>
> Companion to `NETWORK_AND_SERVER_ARCHITECTURE.md` (current
> topology) and `ERP_TOPOLOGY.md` (tenant/data model).

## What the rig does today

Three roles, three machines:

| Machine          | Tailscale IP       | Role                       | Hostname(s) served                   |
|------------------|--------------------|----------------------------|--------------------------------------|
| MBP              | `100.109.225.52`   | Development + playground   | `playground.catalysterp.org`         |
| Mini             | `100.115.176.118`  | Stable production + tunnel | `catalysterp.org`, `mitwpu-rnd.catalysterp.org` |
| iMac             | `100.112.254.45`   | Ravikiran household ERP    | `ravikiran.catalysterp.org`          |

One Cloudflare tunnel (`b1d5e505-9c85-4950-9a57-e2af733e923a`)
connects the mini to Cloudflare's edge. Ingress rules (remote-config
mode) point each hostname at the owning machine's Tailscale IP.

Adding a machine = giving it one (or more) of these roles: a new
tenant, a tunnel connector redundancy peer, an SSH-fallback
endpoint, or a crawler worker.

---

## Core onboarding (do this once per new machine)

### 0. Bring the box up

Minimum:
- macOS up to date.
- Admin account with passwordless sudo *recommended* (see "sudo"
  section below — several onboarding steps need it).
- Wired Ethernet or stable Wi-Fi; if it will host always-on
  services, prefer Ethernet.

### 1. Xcode Command Line Tools + Homebrew

```bash
xcode-select --install          # approve the dialog
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 2. Full brew stack (mirror the mini)

```bash
brew update
brew install \
  bat cloudflared cmake doxygen eza fd ffmpeg fzf git gmsh \
  graphviz gsl htop jq julia lazygit maxima mkcert neovim netcat \
  ngspice nmap node octave ollama openssh parallel pipx \
  postgresql@18 pyenv r redis ripgrep swig tailscale tmux tree \
  watch wget yq
brew install --cask basictex paraview
```

Heavy ones to expect: `paraview`, `r`, `julia`, `maxima`, `gmsh`,
`octave` (each 5–20 min depending on network). Run overnight if
you're not watching.

### 3. Tailscale join

```bash
open -a Tailscale        # or: sudo tailscale up
tailscale ip             # record the 100.x.x.x IP
```

Write the Tailscale IP into `docs/NETWORK_AND_SERVER_ARCHITECTURE.md`
in the Machines table + `~/.ssh/config` with an alias.

### 4. Firewall posture

macOS Application Firewall matters **only** when the machine roams
on untrusted networks. For a home server behind a Deco-mesh NAT
with no port-forwarding, disable it:

```bash
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate off
```

If the machine travels (e.g. a laptop going to cafés, Satyajeet's
M2 Pro), keep it **on** and grant explicit exceptions for gunicorn
and cloudflared:

```bash
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add \
  /opt/homebrew/bin/cloudflared
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp \
  /opt/homebrew/bin/cloudflared
# ditto for ~/Scheduler/<project>/.venv/bin/python after venv is created
```

See "Firewall — what, why, when to disable" below.

### 5. SSH server (Remote Login)

System Settings → General → Sharing → **Remote Login** → ON,
restrict to specific users (the admin account only). Or CLI:

```bash
sudo systemsetup -setremotelogin on
```

### 6. Clone Scheduler/Main

Each machine gets its own working copy under `~/Scheduler/Main`
(or `~/Documents/Scheduler/Main` on the dev machine — note that
`~/Documents/**` triggers macOS TCC restrictions under launchd;
production hosts should keep the working tree outside `Documents`).

```bash
# from whichever machine has the source (usually MBP), rsync over Tailscale:
rsync -a --delete \
  --exclude '.venv' --exclude '__pycache__' --exclude '*.pyc' \
  --exclude 'data' --exclude 'logs' --exclude '.git' \
  --exclude 'FOCS-submission' --exclude 'uploads*' \
  ~/Documents/Scheduler/Main/ \
  <new-host>:Scheduler/Main/
```

Or `git clone` from the central bare once SSH access exists:

```bash
ssh <mbp> 'cat .claude/git-server/lab-scheduler.git' | git clone -
# or push/pull pattern per .claude/git-server/README.md
```

### 7. Python venv + requirements

```bash
ssh <new-host> '
cd ~/Scheduler/Main
/usr/bin/python3 -m venv .venv       # Py 3.9 works, so does 3.13
.venv/bin/pip install --upgrade pip wheel
.venv/bin/pip install -r requirements.txt
'
```

### 8. Tenant env file

Every tenant instance has its own `.env.<tenant>` that gunicorn
sources. Required keys (values must be **integer literals**, not
`true`/`false` — `app.py` does `int(os.environ.get(...))`):

```ini
LAB_SCHEDULER_SECRET_KEY=<64-hex>          # openssl rand -hex 32
LAB_SCHEDULER_DEMO_MODE=0
LAB_SCHEDULER_HOST=0.0.0.0                 # bind to all interfaces so tunnel can reach
LAB_SCHEDULER_PORT=<port>
LAB_SCHEDULER_HTTPS=0                      # 1 if you use certfile/keyfile
LAB_SCHEDULER_CSRF=1
LAB_SCHEDULER_COOKIE_SECURE=1
OWNER_EMAILS=<comma,separated,emails>
DEMO_PUBLIC_EMAIL=admin@<tenant>.catalysterp.org
```

Port convention: apex 5055, mitwpu-rnd 5056, ravikiran 5057,
playground 5058. Pick the next free port for a new tenant.

### 9. LaunchAgent for the tenant gunicorn

Write `~/Library/LaunchAgents/local.catalyst.<tenant>.plist` binding
`0.0.0.0:<port>`. Template:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>local.catalyst.<tenant></string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-lc</string>
    <string>cd /Users/<user>/Scheduler/Main && set -a && . ./.env.<tenant> && set +a && exec ./.venv/bin/gunicorn app:app -w 2 -b 0.0.0.0:<port> --access-logfile - --error-logfile -</string>
  </array>
  <key>WorkingDirectory</key><string>/Users/<user>/Scheduler/Main</string>
  <key>StandardOutPath</key><string>/Users/<user>/Scheduler/Main/logs/server-<tenant>.log</string>
  <key>StandardErrorPath</key><string>/Users/<user>/Scheduler/Main/logs/server-<tenant>.log</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>ProcessType</key><string>Interactive</string>
</dict>
</plist>
```

Bootstrap:

```bash
plutil -lint ~/Library/LaunchAgents/local.catalyst.<tenant>.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/local.catalyst.<tenant>.plist
launchctl kickstart  -k gui/$(id -u)/local.catalyst.<tenant>
```

Verify:

```bash
lsof -iTCP:<port> -sTCP:LISTEN -P -n       # should show *:<port>
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:<port>/login
```

**TCC warning:** if the working tree is under `~/Documents`,
`/bin/bash` and `~/Scheduler/<project>/.venv/bin/python` both need
Full Disk Access granted in System Settings → Privacy → Full Disk
Access. Otherwise launchd spawns will get `PermissionError:
[Errno 1] Operation not permitted: .../pyvenv.cfg`. Easier:
move the working tree to `~/Scheduler/Main` and avoid Documents.

### 10. Bootstrap the DB

Fresh machines need a seed DB. Copy the appropriate tenant's demo
DB over:

```bash
rsync -a <mbp>:Documents/Scheduler/Main/data/demo/<tenant>_ops/ \
  <new-host>:Scheduler/Main/data/operational/
```

`app.py`'s `init_db()` at line ~4610 creates any missing schema on
first run, but starting with a seeded DB avoids "no such table:
users" errors on the first /login hit.

### 11. Wire the tenant into the tunnel

Add the hostname + ingress rule via the Cloudflare API (see
`NETWORK_AND_SERVER_ARCHITECTURE.md` → "Updating ingress / DNS").
Two API calls:

1. `POST /zones/$ZONE/dns_records` — CNAME the hostname to
   `$TUNNEL_ID.cfargotunnel.com`, `proxied: true`.
2. `PUT /accounts/$ACCT/cfd_tunnel/$TUN/configurations` — add an
   ingress rule for the hostname pointing to
   `http://<tailscale-ip>:<port>` (or `https://…` with
   `noTLSVerify: true` if gunicorn serves TLS).

Verify: `curl -sS -o /dev/null -w "%{http_code}\n" https://<new-host>.catalysterp.org/login` → 200.

### 12. SSH-over-Cloudflare fallback

Give the machine an `ssh-<short>.catalysterp.org` entry so it's
reachable even when Tailscale is down:

1. Create CNAME `ssh-<short>.catalysterp.org` → tunnel.
2. Add ingress rule: `{ hostname: ssh-<short>.catalysterp.org,
   service: ssh://<tailscale-ip>:22 }` (or `ssh://localhost:22` if
   on the connector host).
3. On each client that will SSH **into** this machine, add to
   `~/.ssh/config`:
   ```
   Host <short>-cf
       HostName ssh-<short>.catalysterp.org
       User <remote-user>
       ProxyCommand /opt/homebrew/bin/cloudflared access ssh --hostname %h
   ```

Test: `ssh <short>-cf hostname`.

For hardening later: set up Cloudflare Zero Trust Access policies
(email OTP or SSO). Without them, SSH key-based auth is still the
gate — attackers can try to connect but can't authenticate without
a key in `~/.ssh/authorized_keys`.

### 13. Join the crawler fleet (optional)

Any machine with a working Scheduler/Main venv can run crawls.
From the mothership, fan out:

```bash
STAMP=$(date +%Y%m%d-%H%M%S)
ssh <new-host> "cd ~/Scheduler/Main && nohup .venv/bin/python \
  -m crawlers wave <wave> --seed \$(date +%s) \
  > logs/crawl-<wave>-\$(hostname)-$STAMP.log 2>&1 & disown"
```

Pick a different wave per machine to cover more ground. Waves:
`sanity` (fast, pre-push gate), `coverage` (random walk +
performance), `accessibility`, `behavioral`, `backend`, `lifecycle`,
`rhythm`.

### 14. Optional: tunnel-connector redundancy

If the mini is flaky, install cloudflared as a secondary connector
on the new machine:

1. Copy `~/.cloudflared/b1d5e505-….json` from mini.
2. Create `~/.cloudflared/config.yml` with the tunnel ID + creds path.
3. Install `~/Library/LaunchAgents/local.catalyst.cloudflared.plist`
   (see mini's as a template).

Multi-connector is fine for HA as long as **every connector can
reach every origin** (via Tailscale). If a new box can't reach one
of the origin Tailscale IPs (firewall, network segmentation),
don't run a connector there — it will 502 half the requests.

---

## Firewall — what, why, when to disable

macOS's Application Firewall (`socketfilterfw`) blocks **inbound**
connections to apps you haven't approved. It doesn't touch outbound
traffic, and it doesn't help against processes already running as
you. Its security value is "app I didn't install just started
listening on a port → I get a prompt before internet hits it".

- **Home network, behind Deco mesh NAT, no port-forwarding
  configured:** inbound internet traffic can't reach the machine
  at all (NAT drops it). The firewall guards only the LAN. If you
  trust the LAN (your own Wi-Fi, known devices), the firewall is
  disposable. We disabled it on mini + iMac for this reason.

- **Institute LAN (MITWPU, Ravikiran ground-floor office, a
  conference Wi-Fi):** the LAN is *not* trusted. Any device on the
  same subnet can try to open port 5057 directly. Keep firewall
  on; grant exceptions per-binary. Tailscale and Cloudflare Tunnel
  both work fine with firewall on (they open outbound connections).

- **Laptop that roams:** always firewall on.

Practical takeaway: "firewall off" is a **home-office-only**
posture. Before you take mini to MITWPU or Satyajeet's M2 Pro to
a coworking space, turn it back on.

When the firewall is on, the tradeoff is: every new gunicorn /
cloudflared binary will prompt the first time, or be silently
blocked if `socketfilterfw --add` hasn't granted it. You see
symptoms like `curl http://100.x.x.x:5057 → 000` even though the
service is listening. Fix: add the binary explicitly.

---

## Sudo

Most of the onboarding steps above need sudo once (firewall,
Remote Login, sometimes launchd daemons). During the 2026-04-15
setup we hit several dead-ends because passwordless sudo wasn't
configured on the mini — `sudo -n` returned "a password is
required", and we had to ask the user to run a command interactively.

For always-on servers (mini, iMac): grant passwordless sudo to the
admin user for the specific commands you need, scoped in
`/etc/sudoers.d/`:

```
%admin ALL=(ALL) NOPASSWD: /usr/libexec/ApplicationFirewall/socketfilterfw, \
                           /bin/launchctl, \
                           /usr/sbin/systemsetup -setremotelogin *
```

**Do not** grant blanket passwordless sudo to an interactive admin
account; scope to the commands automation actually needs.

---

## Worked example: Nikita's M1

Role to assign: **always-on home node 2** — useful as a second
tunnel connector (so the mini isn't single-point-of-failure) and a
crawler worker. Not a tenant host yet.

1. Steps 0–4 (brew stack, Tailscale, firewall off — M1 is home,
   behind Deco).
2. Record Tailscale IP → say `100.xx.yy.zz` → add SSH alias
   `catalyst-nikita`.
3. Step 5 Remote Login on.
4. Skip tenant env/plist (no tenant).
5. Do step 12 (SSH-over-Cloudflare fallback) — `ssh-nikita.catalysterp.org`.
6. Do step 13 (join crawler fleet) — assign her box the `lifecycle`
   or `behavioral` wave on a schedule (hourly cron).
7. Do step 14 (secondary tunnel connector). With two connectors
   the tunnel survives a mini reboot.

Update `NETWORK_AND_SERVER_ARCHITECTURE.md` machines table.

## Worked example: Satyajeet's M2 Pro

Role to assign: **heavy-compute worker + roaming laptop**. M2 Pro's
performance cores are the fastest in the fleet — good for distcc
targets (ParaView, gmsh, julia compiles), Ollama inference, and
large crawler waves.

1. Steps 0–3.
2. Step 4: firewall **on** (laptop roams). Add exceptions for
   `cloudflared` and Scheduler/Main venv python.
3. Step 5 on, **key-only auth** (disable password SSH via
   `/etc/ssh/sshd_config`'s `PasswordAuthentication no`).
4. Step 12 SSH-over-Cloudflare — `ssh-satya.catalysterp.org`.
5. Step 13 — assign the `coverage` or `backend` wave with more
   steps (`--steps 2000`) since M2 Pro chews through them fast.
6. Skip step 14 unless he explicitly wants his laptop being a
   tunnel connector when he's in a café.
7. Optional: install `distcc` + register as a distcc volunteer
   worker for ParaView/julia recompiles triggered from any of the
   other machines (see BUILD_ACCELERATION_PLAYBOOK.md).

---

## Offboarding (removing a machine)

When a box leaves the rig (sold, repurposed, crashed):

1. `launchctl bootout` every `local.catalyst.*` job.
2. Remove tenant ingress rules + DNS records (`PUT .../configurations`
   + `DELETE /zones/$ZONE/dns_records/$ID`).
3. Tailscale → `sudo tailscale down` + remove the node from the
   Tailscale admin console.
4. Revoke the machine's SSH key from every other host's
   `~/.ssh/authorized_keys` (don't forget the Cloudflare Tunnel
   credentials file — rotate it if you think it's leaked).
5. Update the machines table in `NETWORK_AND_SERVER_ARCHITECTURE.md`.
