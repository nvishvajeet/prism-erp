# Network and server architecture

> Captures the physical machines, Cloudflare tunnel routing, and
> per-tenant server+data placement for CATALYST / lab-scheduler.
> Written 2026-04-15 after reshuffling from MBP-centric to
> one-machine-per-tenant topology.
>
> Read together with `ERP_TOPOLOGY.md` (git/code/data model) and
> `DEPLOY.md` (launchd + gunicorn recipes).

## One-line summary

- **MBP** runs the apex (`catalysterp.org`) and `playground.`
- **Mini** runs `mitwpurn.`
- **iMac** runs `ravikiran.`
- One Cloudflare tunnel (`b1d5e505-…`) fronts all four hostnames.
  Connector runs on the mini (always-on, no user activity).
  Ingress rules live in Cloudflare dashboard (remote-config mode),
  with fallback to `~/.cloudflared/config.yml` bootstrapping.

```
Internet  ─┐
            │ HTTPS (Cloudflare-issued cert)
            ▼
         Cloudflare edge
            │
            │  QUIC / HTTP/2   tunnel b1d5e505-…  (4 conns, BOM/CDG colos)
            ▼
       ┌──────────────────────────┐
       │ cloudflared on mini      │
       │ (launchctl bootstrap;    │
       │  KeepAlive=true)         │
       └────┬─────────────┬───────┘
            │             │
   Tailscale│             │ Tailscale
            ▼             ▼
     MBP (100.109.225.52)    iMac (100.112.254.45)
      apex + playground       ravikiran
            │                    │
            │                    │
            ▼                    ▼
       local origin          local origin
       + local DB            + local DB
```

## Machines

| Host        | Role                 | Tailscale IP       | LAN / public  | Notes                      |
|-------------|----------------------|--------------------|---------------|----------------------------|
| `mbp`       | product (apex) + dev | `100.109.225.52`   | DHCP / roams  | Author's daily driver      |
| `catalyst-mini` | mini, always-on  | `100.115.176.118`  | 10.2.6.92     | Auto-login, sleep disabled |
| `catalyst-imac` | iMac, house company | `100.112.254.45` | LAN only      | Ravikiran household server |

SSH aliases in `~/.ssh/config`:
- `catalyst-mini` → `100.115.176.118` (user `vishwajeet`)
- `catalyst-imac` → `100.112.254.45` (user `nv`)

## Cloudflare

- **Zone:** `catalysterp.org` (id `22caf06ef13454f74693148dfa8c0e70`).
  Nameservers: `desi.ns.cloudflare.com`, `harlan.ns.cloudflare.com`.
- **Account:** `05a968515fdea71767b6adf07e44b8e5`
  (General.goje@gmail.com).
- **Tunnel:** `b1d5e505-9c85-4950-9a57-e2af733e923a` named `catalysterp`.
  `config_src: cloudflare` (remote-managed); ingress + warp-routing
  defined server-side and fetched by the connector.
- **Defunct tunnel:** `fc63f24c-dd7a-43c1-8b6d-a3cb33386314` named
  `catalyst` — `status: down`. Do not resurrect; kept in the account
  only because a `--token` process on the mini (root pid 449) still
  tries to connect. Safe to ignore; will be cleaned up when
  passwordless sudo is available.

### DNS records

All proxied (orange cloud), CNAME to `<tunnel-id>.cfargotunnel.com`:

| Name                          | Type  | Content                                                | Proxied |
|-------------------------------|-------|--------------------------------------------------------|---------|
| `catalysterp.org`             | CNAME | `b1d5e505-….cfargotunnel.com`                          | ✓       |
| `mitwpurn.catalysterp.org`    | CNAME | `b1d5e505-….cfargotunnel.com`                          | ✓       |
| `ravikiran.catalysterp.org`   | CNAME | `b1d5e505-….cfargotunnel.com`                          | ✓       |
| `playground.catalysterp.org`  | CNAME | `b1d5e505-….cfargotunnel.com`                          | ✓       |

### Ingress rules (remote, current state = "phase 1", all on mini)

```yaml
ingress:
  - hostname: catalysterp.org
    service: https://127.0.0.1:5055      # mini apex gunicorn (HTTPS w/ self-signed)
    originRequest:
      noTLSVerify: true
  - hostname: mitwpurn.catalysterp.org
    service: http://127.0.0.1:5056       # mini mitwpu gunicorn
  - hostname: ravikiran.catalysterp.org
    service: http://127.0.0.1:5057       # mini ravikiran gunicorn (TEMP — will move to iMac)
  - hostname: playground.catalysterp.org
    service: http://127.0.0.1:5058       # mini playground gunicorn (TEMP — will move to MBP)
  - service: http_status:404
```

### Ingress rules (remote, target state = "phase 2")

```yaml
ingress:
  - hostname: catalysterp.org
    service: https://100.109.225.52:5055   # MBP apex
    originRequest: { noTLSVerify: true }
  - hostname: playground.catalysterp.org
    service: http://100.109.225.52:5058    # MBP playground
  - hostname: mitwpurn.catalysterp.org
    service: http://127.0.0.1:5056         # mini mitwpu (co-located with connector)
  - hostname: ravikiran.catalysterp.org
    service: http://100.112.254.45:5057    # iMac ravikiran
  - service: http_status:404
```

In phase 2, tenant gunicorns on MBP and iMac must bind to their
Tailscale interface (or `0.0.0.0`), not `127.0.0.1`, for the mini
connector to reach them.

### Updating ingress / DNS

Prefer the Cloudflare API over the dashboard for auditability:

```bash
TOK=$(cat /tmp/cftoken.env | cut -d= -f2 | xargs cat)
AUTH="Authorization: Bearer $TOK"
ACCT=05a968515fdea71767b6adf07e44b8e5
TUN=b1d5e505-9c85-4950-9a57-e2af733e923a

# view
curl -sS "https://api.cloudflare.com/client/v4/accounts/$ACCT/cfd_tunnel/$TUN/configurations" -H "$AUTH" | jq .

# update (PUT replaces; hand-edit the JSON first)
curl -sS -X PUT ".../configurations" -H "$AUTH" -H "Content-Type: application/json" -d @ingress.json
```

Tokens are ephemeral; regenerate at
<https://dash.cloudflare.com/profile/api-tokens> with scopes
`Account:Cloudflare Tunnel:Edit`, `Zone:DNS:Edit`,
`Account:Account Settings:Read`.

## Per-machine process inventory

### Mini (`catalyst-mini`, `100.115.176.118`)

| LaunchAgent                       | Port | Tenant      | Env file          | Working dir              |
|-----------------------------------|------|-------------|-------------------|--------------------------|
| `local.catalyst.cloudflared`      | —    | tunnel      | `~/.cloudflared/config.yml` | —                    |
| `local.catalyst`                  | 5055 | apex (prod) | `.env`            | `~/Scheduler/Main`       |
| `local.catalyst.mitwpu`           | 5056 | mitwpurn    | `.env.mitwpu`     | `~/Scheduler/Main`       |
| `local.catalyst.ravikiran` (temp) | 5057 | ravikiran   | `.env.ravikiran`  | `~/Scheduler/Main`       |
| `local.catalyst.playground` (temp)| 5058 | playground  | `.env.playground` | `~/Scheduler/Main`       |

All set to `RunAtLoad=true`, `KeepAlive=true`, `ThrottleInterval=10`.

In phase 2, `ravikiran` and `playground` plists move to iMac and MBP
respectively; the mini copies are torn down (`launchctl bootout`
then `rm plist + rm .env.<tenant>`).

### MBP (`mbp`, `100.109.225.52`)

Currently runs redundant gunicorns on 5055/5056/5058 (from the old
MBP-as-tunnel era). Phase 2 rationalisation:

- Keep `local.catalyst` on 5055 bound to Tailscale (apex, the "product").
- Create `local.catalyst.playground` on 5058 bound to Tailscale.
- Remove the redundant 5056 gunicorn.
- Old MBP cloudflared process (`~/.cloudflared/config.yml` +
  `cloudflared tunnel … run`) was stopped when the mini took over
  the tunnel. Keep the config file for reference; do not start it.

### iMac (`catalyst-imac`, `100.112.254.45`)

Bare as of 2026-04-15. Phase 2 onboarding:

1. Clone `lab-scheduler` from the MBP's LOCAL bare
   (`ssh mbp:.claude/git-server/lab-scheduler.git`) into
   `~/Scheduler/Main`.
2. `python -m venv .venv && .venv/bin/pip install -r requirements.txt`.
3. Create `.env.ravikiran` (copy of mini's, fresh `LAB_SCHEDULER_SECRET_KEY`).
4. Install `local.catalyst.ravikiran.plist` bound to Tailscale
   `100.112.254.45:5057`.
5. Copy the ravikiran SQLite DB across (or provision fresh) — see
   "Per-tenant data" below.

## Per-tenant data ("full data + server separation")

Each tenant's SQLite DB and uploads live only on its assigned machine:

| Tenant     | Machine | DB path                                           | Uploads path                            |
|------------|---------|---------------------------------------------------|-----------------------------------------|
| apex       | MBP     | `~/Documents/Scheduler/Main/data/operational/lab_scheduler.db` | `~/Documents/Scheduler/Main/uploads/` |
| mitwpurn   | mini    | `~/Scheduler/Main/data/operational/lab_scheduler.db` (per-tenant scope TBD) | `~/Scheduler/Main/uploads-mitwpu/` |
| ravikiran  | iMac    | `~/Scheduler/Main/data/operational/lab_scheduler.db` | `~/Scheduler/Main/uploads/`           |
| playground | MBP     | `~/Documents/Scheduler/Main/data/demo/stable/lab_scheduler.db` | `~/Documents/Scheduler/Main/uploads-playground/` |

Per-tenant DB selection is driven by the `LAB_SCHEDULER_*` vars in
each `.env.<tenant>` file. App-layer tenant isolation (Host header →
tenant) is a separate, pending change — see `ERP_TOPOLOGY.md` and
the in-flight apex-tenant-picker task.

No cross-machine DB sync. No shared NFS. Backups are a per-tenant
problem; scheduled via local `rsync` (pending).

## Startup order / failover

- **Mini** is the always-on connector host. If the mini is offline,
  the tunnel drops and all four hostnames go down. Fallback: run
  `cloudflared tunnel … run` on the MBP (the `~/.cloudflared/` on
  MBP already has the credentials file and a minimal config.yml to
  start the same tunnel as a second connector).
- Cloudflare tunnels support multi-connector natively. For redundancy
  we can run connectors on both mini and MBP at once; Cloudflare edge
  load-balances. See "Phase 3: SSH-via-Cloudflare fallbacks" for the
  plan to extend this.

## Power / sleep

- Mini: sleep disabled on AC (`pmset sleep 0 disksleep 0 displaysleep 0
  powernap 0 womp 1 autorestart 1`). Confirmed 2026-04-15.
- iMac: policy TBD. When onboarded as ravikiran server, apply the
  same pmset settings.
- MBP: user-active, normal sleep rules. Apex goes down when MBP
  sleeps — acceptable because apex is the "product" page; heavy
  users hit subdomains on mini/iMac.

## Out of scope / follow-ups

- **App-layer tenant routing** (Host header → tenant DB). Flask
  code change in `app.py` + login template tenant picker.
  Captured in `ERP_TOPOLOGY.md`.
- **SSH-via-Cloudflare** fallbacks (`ssh-mini.catalysterp.org`,
  `ssh-imac.catalysterp.org`, `ssh-mbp.catalysterp.org`) so each
  machine is reachable even if Tailscale is down. Requires
  additional ingress rules (`tcp://localhost:22` per machine) plus
  Zero Trust Access policies for auth.
- **Tejveer debugger role** — elevated logging + error visibility
  for the Ravikiran QA tester on mobile PWA and desktop.
