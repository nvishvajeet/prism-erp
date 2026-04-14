#!/bin/bash
# Install CATALYST launchd agents for either the laptop or the Mac mini.
#
# Usage:
#   ./scripts/install_launchd.sh          # install production service
#   ./scripts/install_launchd.sh --demo   # install demo service

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HOST_USER="$(id -un)"
TARGET_DIR="$HOME/Library/LaunchAgents"
mkdir -p "$TARGET_DIR"

MODE="prod"
if [ "${1:-}" = "--demo" ]; then
  MODE="demo"
fi

pick_plist() {
  if [ "$MODE" = "demo" ]; then
    echo "$ROOT_DIR/ops/launchd/local.catalyst.demo.plist"
    return
  fi
  if [ "$HOST_USER" = "vishwajeet" ] && [ -d "$HOME/Scheduler/Main" ]; then
    echo "$ROOT_DIR/ops/launchd/local.catalyst.plist"
  else
    echo "$ROOT_DIR/ops/launchd/local.catalyst.laptop.plist"
  fi
}

SOURCE_PLIST="$(pick_plist)"
if [ ! -f "$SOURCE_PLIST" ]; then
  echo "ERROR: plist not found: $SOURCE_PLIST" >&2
  exit 1
fi

LABEL="$(/usr/libexec/PlistBuddy -c 'Print :Label' "$SOURCE_PLIST")"
TARGET_PLIST="$TARGET_DIR/${LABEL}.plist"

echo "==> Installing $LABEL"
cp "$SOURCE_PLIST" "$TARGET_PLIST"

launchctl bootout "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$TARGET_PLIST"
launchctl kickstart -k "gui/$(id -u)/$LABEL"

echo ""
echo "==> launchctl print"
launchctl print "gui/$(id -u)/$LABEL" | sed -n '1,20p'

echo ""
if [ "$MODE" = "demo" ]; then
  echo "Demo service installed."
  echo "Expected env file: $ROOT_DIR/.env.demo"
  echo "Expected log file: $ROOT_DIR/logs/server-demo.log"
else
  echo "Production service installed."
  echo "Expected env file: $ROOT_DIR/.env"
  echo "Expected log file: $ROOT_DIR/logs/server.log"
fi
