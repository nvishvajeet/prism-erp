# CATALYST — Mac mini serve split

The Mac mini should run **two separate services**:

1. **Production service**
   Purpose: always-on MITWPU Lab ERP
   Process label: `local.catalyst`
   Env file: `~/Scheduler/Main/.env`
   Port: `5055`
   Exposure: HTTPS via Tailscale Serve / domain front

2. **Local demo service**
   Purpose: private demo / testing without touching live runtime state
   Process label: `local.catalyst.demo`
   Env file: `~/Scheduler/Main/.env.demo`
   Port: `5056`
   Exposure: local-only unless explicitly fronted later

## Production env

`~/Scheduler/Main/.env`

```bash
LAB_SCHEDULER_DEMO_MODE=0
LAB_SCHEDULER_HOST=127.0.0.1
LAB_SCHEDULER_PORT=5055
LAB_SCHEDULER_HTTPS=true
LAB_SCHEDULER_COOKIE_SECURE=true
LAB_SCHEDULER_CSRF=1
```

## Demo env

`~/Scheduler/Main/.env.demo`

```bash
LAB_SCHEDULER_DEMO_MODE=1
LAB_SCHEDULER_HOST=127.0.0.1
LAB_SCHEDULER_PORT=5056
LAB_SCHEDULER_HTTPS=0
LAB_SCHEDULER_COOKIE_SECURE=0
LAB_SCHEDULER_CSRF=1
```

## Install on the mini

```bash
cd ~/Scheduler/Main
chmod +x scripts/install_launchd.sh
./scripts/install_launchd.sh
./scripts/install_launchd.sh --demo
```

## Verify

```bash
launchctl print gui/$(id -u)/local.catalyst | head -20
launchctl print gui/$(id -u)/local.catalyst.demo | head -20

curl -I http://127.0.0.1:5055/api/health-check
curl -I http://127.0.0.1:5056/api/health-check
```

## HTTPS front door

Use Tailscale Serve or your domain reverse proxy only for the production
port `5055`. The demo port stays private unless explicitly exposed later.
