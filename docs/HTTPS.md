# CATALYST — HTTPS on the tailnet (W1.3.9 / W1.4.0)

_Anchored 2026-04-11. Replaces the old stunnel self-signed recipe in
`ops/certs/` and the self-signed Caddyfile in `ops/Caddyfile`._

## Goal

CATALYST on the Mac mini should be reachable from every device on the
lab's Tailscale tailnet at a name like
`https://vishwajeets-mac-mini.tail-XXXX.ts.net/` — with a real,
browser-trusted Let's Encrypt certificate, and **only** devices on
the tailnet can connect. No Mac-mini Application Firewall gymnastics,
no self-signed warnings, no extra daemon.

Plan A is Tailscale Serve (`tailscale serve`) fronting Flask on
loopback. Plan B (mkcert + Flask `ssl_context`) is the fallback if
Tailscale Serve cannot be enabled for this tailnet.

---

## Plan A — Tailscale Serve (preferred)

### Step 1. Enable Serve for the tailnet _(admin-console one-click, operator only)_

Open the activation link the mini printed when we first tried it:

```
https://login.tailscale.com/f/serve?node=nMGwQBMvoB21CNTRL
```

Click **Enable Tailscale Serve** for this tailnet. This is a
one-time, tailnet-wide setting — once on, it stays on. MagicDNS and
HTTPS certificates must also both be enabled under
_Admin → DNS → MagicDNS_ and _Admin → DNS → HTTPS Certificates_.

You (the operator) must do this step. No automation can.

### Step 2. Revert the loopback binding on the mini

Flask should bind to `127.0.0.1:5055`, not `0.0.0.0:5055`.
`tailscale serve` is the only thing that should reach the Flask
port. Edit `~/Scheduler/Main/.env` on the mini:

```diff
- LAB_SCHEDULER_HOST=0.0.0.0
+ # LAB_SCHEDULER_HOST unset → defaults to 127.0.0.1 (loopback)
```

Then kickstart the launchd service:

```bash
launchctl kickstart -k gui/$(id -u)/local.catalyst
```

### Step 3. Bring the serve front up

From the mini (or SSH in and run):

```bash
~/Scheduler/Main/scripts/tailscale_serve.sh up
```

That helper runs:

```bash
/opt/homebrew/bin/tailscale serve --bg --https=443 5055
```

which tells tailscaled "terminate TLS on my :443 with a Let's
Encrypt cert, and forward to `http://127.0.0.1:5055`".

First run will take ~10 seconds as it provisions the cert. Verify:

```bash
/opt/homebrew/bin/tailscale serve status
```

You should see an entry mapping `https://<magicdns-name>/` to
`http://127.0.0.1:5055`.

### Step 4. Flip Flask cookie + HTTPS flags

Add two lines to the mini's `.env`:

```
LAB_SCHEDULER_HTTPS=true
LAB_SCHEDULER_COOKIE_SECURE=true
```

Kickstart again so Flask picks them up. Flask will now set
`Secure` on session cookies and trust `X-Forwarded-Proto` so
`url_for()` generates `https://` URLs.

### Step 5. Verify from the laptop

```bash
CATALYST_DEPLOY_URL=https://vishwajeets-mac-mini.tail-XXXX.ts.net \
  .venv/bin/python -m crawlers run deploy_smoke
```

Expected: `PASS 3  FAIL 0  WARN 0` — valid cert chain, HTTP 200 on
`/login`, `/sitemap`, `/api/health-check`.

### Step 6. Revert the Application Firewall exception

From `logs/mini_network_diag_20260411.md`, we proposed adding a
firewall allow for the framework Python binary so inbound packets
to :5055 could reach Flask. With `tailscale serve` in front,
tailscaled owns the network edge — nothing inbound ever reaches
:5055 directly. Revert the exception if it was applied:

```bash
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --remove \
  "/opt/homebrew/Cellar/python@3.14/3.14.4/Frameworks/Python.framework/Versions/3.14/Resources/Python.app/Contents/MacOS/Python"
```

### Step 7. Bookmark the new URL

Replace every `http://100.115.176.118:5055/` bookmark with
`https://vishwajeets-mac-mini.tail-XXXX.ts.net/` on:

- laptop
- iPhone
- iPad
- any other tailnet device

Non-tailnet devices get connection-refused at DNS resolution. The
app's login page stays exactly as-is.

---

## Plan B — mkcert fallback

Only if Tailscale Serve cannot be enabled on the tailnet. Generates
a locally-trusted cert for `catalyst-mini.local` (Bonjour name on the
LAN) and wires it via Flask's `ssl_context=` parameter.

_Not implemented yet. Stub here — expand only if Plan A is blocked
indefinitely._

```bash
brew install mkcert nss
mkcert -install                          # installs a local CA
mkdir -p ops/certs
mkcert -cert-file ops/certs/cert.pem \
       -key-file  ops/certs/key.pem  \
       catalyst-mini.local 100.115.176.118
```

Then set in `.env`:

```
LAB_SCHEDULER_HTTPS=true
LAB_SCHEDULER_CERT_FILE=ops/certs/cert.pem
LAB_SCHEDULER_KEY_FILE=ops/certs/key.pem
```

…and add a branch in `app.py` that passes `ssl_context=(cert,key)`
to `app.run()` when both env vars are set. Every client device
then needs the mkcert root CA installed (easy on laptops, painful
on phones) — which is exactly why Plan A is preferred.

---

## Current state

| component                      | status                         |
|--------------------------------|--------------------------------|
| Tailscale installed on mini    | ✅ v1.96.4 at `/opt/homebrew`  |
| MagicDNS resolving             | ✅ (mini shows in `tailscale status`) |
| Tailscale Serve enabled        | ❌ **operator click pending**   |
| `tailscale serve` config       | — (none, "No serve config")    |
| Flask loopback bind reverted   | — (still `0.0.0.0` in .env)    |
| Laptop-side helper + docs      | ✅ this file + `scripts/tailscale_serve.sh` |

When the admin-console toggle is done, steps 2-7 above are a 10-minute
run, and `deploy_smoke` against the HTTPS URL becomes the new crawler
gate.
