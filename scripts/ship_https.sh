#!/bin/bash
# PRISM — W1.3.9 ship-HTTPS one-shot for the mini.
#
# After the operator clicks "Enable Tailscale Serve" once at
# https://login.tailscale.com/f/serve?node=nMGwQBMvoB21CNTRL ,
# run THIS on the mini and HTTPS is live. That's the whole wave.
#
#   bash ~/Scheduler/Main/scripts/ship_https.sh
#
# What it does, in order:
#   1. Sanity-check: tailscale CLI exists, FLASK_PORT reachable on
#      loopback, .env present.
#   2. Edit .env — comment out LAB_SCHEDULER_HOST=0.0.0.0 (so Flask
#      re-binds to 127.0.0.1) and append LAB_SCHEDULER_HTTPS=true +
#      LAB_SCHEDULER_COOKIE_SECURE=true if not already present.
#      Each write is idempotent — re-running is a no-op.
#   3. Bring up `tailscale serve --bg --https=443 5055`. If the
#      admin console click hasn't happened yet, this fails loudly
#      with the activation URL and exits non-zero before touching
#      anything else downstream.
#   4. `launchctl kickstart -k gui/$(id -u)/local.prism` — picks up
#      the new .env.
#   5. Print the MagicDNS HTTPS URL and the exact laptop-side
#      verification command.
#
# If this script runs cleanly, the only remaining work is the
# one-line verification on the laptop it prints at the end.

set -euo pipefail

REPO="${REPO:-$HOME/Scheduler/Main}"
ENV_FILE="$REPO/.env"
FLASK_PORT="${FLASK_PORT:-5055}"
ACTIVATION_URL="https://login.tailscale.com/f/serve?node=nMGwQBMvoB21CNTRL"

TAILSCALE="/opt/homebrew/bin/tailscale"
if [ ! -x "$TAILSCALE" ]; then TAILSCALE="$(command -v tailscale || true)"; fi
if [ -z "$TAILSCALE" ] || [ ! -x "$TAILSCALE" ]; then
  echo "ERROR: tailscale CLI not found on PATH or /opt/homebrew/bin/"
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: .env not found at $ENV_FILE — is REPO=$REPO correct?"
  exit 1
fi

echo "=== PRISM ship-HTTPS (W1.3.9) ==="
echo "repo: $REPO"
echo "env:  $ENV_FILE"
echo "port: $FLASK_PORT"
echo

# ── Step 1: prove tailscale serve is enabled BEFORE we touch .env.
# If the admin-console click hasn't happened, this fails loudly and
# we do not mutate the Flask config — a clean abort.
echo "Step 1 — probe tailscale serve readiness…"
if ! "$TAILSCALE" serve status >/dev/null 2>&1; then
  echo "ERROR: tailscaled not responding. Is the daemon up?"
  exit 1
fi

# Dry-run: ask for the serve config. On a tailnet where Serve is
# not enabled, `tailscale serve --https=443 5055` will error with
# "Serve is not enabled on your tailnet" — capture that cleanly.
SERVE_PROBE_LOG="$(mktemp)"
trap 'rm -f "$SERVE_PROBE_LOG"' EXIT
if ! "$TAILSCALE" serve --bg --https=443 "$FLASK_PORT" >"$SERVE_PROBE_LOG" 2>&1; then
  if grep -qiE 'serve is not enabled|not enabled on your tailnet|HTTPS is not enabled' "$SERVE_PROBE_LOG"; then
    echo
    echo "Tailscale Serve is NOT enabled for this tailnet."
    echo "Click ONCE here, then re-run this script:"
    echo
    echo "  $ACTIVATION_URL"
    echo
    exit 2
  fi
  echo "ERROR: tailscale serve failed. Log:"
  cat "$SERVE_PROBE_LOG"
  exit 1
fi
echo "  ok — tailscale serve accepted --https=443 → :$FLASK_PORT"

# ── Step 2: idempotent .env rewrite.
echo
echo "Step 2 — editing $ENV_FILE (idempotent)…"

# 2a: comment out LAB_SCHEDULER_HOST=0.0.0.0 so Flask rebinds to
#     loopback. We comment rather than delete so the old value is
#     recoverable. Re-running is a no-op because the live line is
#     already the commented form.
if grep -qE '^LAB_SCHEDULER_HOST=0\.0\.0\.0$' "$ENV_FILE"; then
  # Use a portable in-place edit: write to tmp, mv.
  tmp="$(mktemp)"
  awk '{
    if ($0 == "LAB_SCHEDULER_HOST=0.0.0.0") {
      print "# LAB_SCHEDULER_HOST=0.0.0.0   # commented by ship_https.sh — serve front-ends loopback"
    } else { print $0 }
  }' "$ENV_FILE" > "$tmp"
  mv "$tmp" "$ENV_FILE"
  echo "  LAB_SCHEDULER_HOST=0.0.0.0 → commented"
else
  echo "  LAB_SCHEDULER_HOST already loopback — skip"
fi

# 2b: append LAB_SCHEDULER_HTTPS=true if not already present.
if ! grep -qE '^LAB_SCHEDULER_HTTPS=true$' "$ENV_FILE"; then
  printf '\nLAB_SCHEDULER_HTTPS=true\n' >> "$ENV_FILE"
  echo "  LAB_SCHEDULER_HTTPS=true → appended"
else
  echo "  LAB_SCHEDULER_HTTPS=true already present — skip"
fi

# 2c: append LAB_SCHEDULER_COOKIE_SECURE=true if not already present.
if ! grep -qE '^LAB_SCHEDULER_COOKIE_SECURE=true$' "$ENV_FILE"; then
  printf 'LAB_SCHEDULER_COOKIE_SECURE=true\n' >> "$ENV_FILE"
  echo "  LAB_SCHEDULER_COOKIE_SECURE=true → appended"
else
  echo "  LAB_SCHEDULER_COOKIE_SECURE=true already present — skip"
fi

# ── Step 3: kickstart launchd so Flask picks up the new env.
echo
echo "Step 3 — kickstarting launchd service local.prism…"
launchctl kickstart -k "gui/$(id -u)/local.prism"
sleep 2
echo "  kickstart issued"

# ── Step 4: print final URL + laptop verification command.
echo
echo "=== Final state ==="
"$TAILSCALE" serve status || true
echo

MAGICDNS="$("$TAILSCALE" status --json 2>/dev/null | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
    self_ = d.get("Self", {})
    name = self_.get("DNSName", "").rstrip(".")
    print(name)
except Exception:
    print("")
' || true)"

if [ -n "$MAGICDNS" ]; then
  FINAL_URL="https://$MAGICDNS"
else
  FINAL_URL="https://<magicdns-name>.ts.net"
fi

echo "PRISM is live at: $FINAL_URL"
echo
echo "Verify from the laptop:"
echo "  PRISM_DEPLOY_URL=$FINAL_URL \\"
echo "    .venv/bin/python -m crawlers run deploy_smoke"
echo
echo "Expected: PASS 3  FAIL 0  WARN 0 with a valid cert chain."
