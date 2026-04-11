#!/bin/bash
# Lab Scheduler — install the PRISM launchd service on a Mac.
#
# Run this ON THE MINI, not on the laptop. Idempotent — safe to rerun
# after editing the plist.
#
# Usage:
#   ./scripts/install_launchd.sh
#
# What it does:
#   1. Validates that ~/Scheduler/Main exists (the plist paths are
#      hard-coded relative to the vishwajeet user home).
#   2. Copies ops/launchd/local.prism.plist → ~/Library/LaunchAgents/
#   3. Bootstraps the service via `launchctl bootstrap`
#   4. Kickstarts it immediately so you don't have to reboot
#   5. Prints the first 10 lines of logs/server.log as a smoke check

set -e

cd "$(dirname "$0")/.."

PLIST_SRC="ops/launchd/local.prism.plist"
PLIST_DST="${HOME}/Library/LaunchAgents/local.prism.plist"
LABEL="local.prism"
DOMAIN="gui/$(id -u)"

if [ ! -f "${PLIST_SRC}" ]; then
  echo "ERROR: ${PLIST_SRC} not found — are you in the repo root?"
  exit 1
fi

if [ ! -d "logs" ]; then
  mkdir -p logs
  echo "Created logs/ directory."
fi

mkdir -p "${HOME}/Library/LaunchAgents"
cp "${PLIST_SRC}" "${PLIST_DST}"
echo "Copied plist to ${PLIST_DST}"

# Bootout first if already loaded — launchctl bootstrap fails loudly
# on re-bootstrap. Swallow errors from a missing service.
launchctl bootout "${DOMAIN}/${LABEL}" 2>/dev/null || true

launchctl bootstrap "${DOMAIN}" "${PLIST_DST}"
echo "Bootstrapped ${DOMAIN}/${LABEL}"

launchctl kickstart -k "${DOMAIN}/${LABEL}"
echo "Kickstarted ${DOMAIN}/${LABEL}"

sleep 2

echo ""
echo "=== Service status ==="
launchctl print "${DOMAIN}/${LABEL}" 2>&1 | head -25 || true

echo ""
echo "=== First lines of logs/server.log ==="
head -15 logs/server.log 2>/dev/null || echo "(logs/server.log not created yet — wait a few seconds and tail it)"

echo ""
echo "Done. Verify externally with:"
echo "  PRISM_DEPLOY_URL=http://127.0.0.1:5055 \\"
echo "    .venv/bin/python -m crawlers run deploy_smoke"
