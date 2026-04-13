#!/bin/bash
# CATALYST — Tailscale Serve helper.
#
# Run this ON THE MINI. Wraps `tailscale serve` so the team doesn't
# have to remember the exact flags. See docs/HTTPS.md for the full
# Plan-A recipe.
#
# Usage:
#   ./scripts/tailscale_serve.sh up      Front Flask on HTTPS :443 via tailnet cert
#   ./scripts/tailscale_serve.sh down    Remove the serve config
#   ./scripts/tailscale_serve.sh status  Show current serve config
#
# Prerequisite: Tailscale Serve must be enabled for the tailnet in
# the admin console (one-click activation). If it is not, the `up`
# command fails with "Serve is not enabled on your tailnet" and
# prints the activation URL.

set -e

TAILSCALE="/opt/homebrew/bin/tailscale"
if [ ! -x "${TAILSCALE}" ]; then
  TAILSCALE="$(command -v tailscale || true)"
fi
if [ -z "${TAILSCALE}" ] || [ ! -x "${TAILSCALE}" ]; then
  echo "ERROR: tailscale CLI not found (tried /opt/homebrew/bin and PATH)"
  exit 1
fi

FLASK_PORT="${FLASK_PORT:-5055}"

case "${1:-}" in
  up)
    echo "=== Bringing up tailscale serve for Flask on :${FLASK_PORT} ==="
    "${TAILSCALE}" serve --bg --https=443 "${FLASK_PORT}"
    echo ""
    echo "=== Current serve config ==="
    "${TAILSCALE}" serve status
    echo ""
    echo "Bookmark the MagicDNS URL shown above. Non-tailnet devices"
    echo "will not be able to reach it."
    ;;
  down)
    echo "=== Removing serve config ==="
    "${TAILSCALE}" serve reset
    "${TAILSCALE}" serve status
    ;;
  status|"")
    "${TAILSCALE}" serve status
    ;;
  *)
    echo "Usage: $0 {up|down|status}"
    exit 2
    ;;
esac
