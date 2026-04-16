# Network Architecture — 2026-04-16

> Tunnel and host mapping for the current `operation-trois-agents`
> sprint state. This note captures what is live on the Mac mini right
> now, not the aspirational phase-2 layout in the broader topology
> docs.

## Current live state

- The Mac mini host is reachable over Tailscale as `catalyst-mini`.
- The old `prism-mini` alias is gone from local SSH config.
- The mini runs the Cloudflare tunnel connector from
  `~/.cloudflared/config.yml`.
- The tunnel ID is `b1d5e505-9c85-4950-9a57-e2af733e923a`.
- `catalysterp.org` still points at the mini apex service on port
  `5055`, so the chooser cutover has not happened yet.

## Mini tunnel config

The mini’s connector currently exposes these ingress rules:

| Hostname | Service | Notes |
|---|---|---|
| `catalysterp.org` | `https://100.115.176.118:5055` | Apex product surface, still on the mini |
| `mitwpu-rnd.catalysterp.org` | `http://100.115.176.118:5056` | Lab demo surface on the mini |
| `ravikiran.catalysterp.org` | `http://127.0.0.1:5057` | Ravikiran still terminates locally on the mini |
| `playground.catalysterp.org` | `http://100.109.225.52:5060` | External host target already wired in tunnel config |
| `labdemo.catalysterp.org` | `https://100.109.225.52:5058` | External host target with `noTLSVerify` |
| `sahajpur.catalysterp.org` | `http://100.109.225.52:5059` | External host target |
| `ssh-mini.catalysterp.org` | `ssh://localhost:22` | SSH fallback for the mini |
| `ssh-imac.catalysterp.org` | `ssh://100.112.254.45:22` | SSH fallback for the iMac |
| `ssh-mbp.catalysterp.org` | `ssh://100.109.225.52:22` | SSH fallback for the MBP |

The final catch-all is `http_status:404`.

## What the live probe showed

Two browser-facing checks still return `200` from the apex login path:

```bash
curl -I -L --max-redirs 3 'https://catalysterp.org/login?portal=hq'
curl -I -L --max-redirs 3 'https://catalysterp.org/login?portal=lab'
```

At the time of this run, both responses were `200` with fresh
`catalyst_session` cookies, which confirms the login redirect path is
working and the app is still serving on the expected apex domain.

## Implications

The live tunnel config and the active sprint docs are in agreement on
the key point that matters for the relay slot: the mini is still the
connector host, and the apex is still anchored to the mini apex
service. The chooser cutover described in the broader phase-2 docs is
not live yet.

This also means the earlier relay work that changed login redirect
targets is not being blocked by a missing tunnel host; the remaining
gap is the tunnel target and service topology itself.

## Verification commands

Run these from the workstation with access to the mini:

```bash
ssh catalyst-mini 'sed -n "1,220p" ~/.cloudflared/config.yml'
curl -I -L --max-redirs 3 'https://catalysterp.org/login?portal=hq'
curl -I -L --max-redirs 3 'https://catalysterp.org/login?portal=lab'
```

The first command should show the ingress table above. The HTTP checks
should continue to resolve without redirect loops.

## Next checks

- Confirm whether the chooser service is meant to replace the mini
  apex surface next, or whether the current phase still expects the
  mini apex to remain authoritative.
- If the cutover is next, update the tunnel ingress and the related
  deploy checklist together so the docs do not drift.
- Keep the `catalyst-mini` SSH alias as the canonical one; do not
  revive `prism-mini`.
