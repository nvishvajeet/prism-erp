#!/bin/bash
# Install the CATALYST pre-receive gate into the laptop's central bare.
#
# Usage: ./ops/git-hooks/install.sh
#
# Idempotent: re-running just refreshes the hook file. Safe to call
# after every pull of this directory.

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BARE="${CATALYST_BARE:-$HOME/.claude/git-server/lab-scheduler.git}"
HOOK_SRC="$SCRIPT_DIR/pre-receive"
HOOK_DST="$BARE/hooks/pre-receive"

if [ ! -d "$BARE" ]; then
  echo "error: laptop bare not found at $BARE" >&2
  echo "set CATALYST_BARE=<path> or ensure the bare exists." >&2
  exit 1
fi
if [ ! -f "$HOOK_SRC" ]; then
  echo "error: hook source missing at $HOOK_SRC" >&2
  exit 1
fi

cp "$HOOK_SRC" "$HOOK_DST"
chmod +x "$HOOK_DST"
echo "installed: $HOOK_DST"
echo
echo "smoke-test it with:"
echo "  </dev/null \"$HOOK_DST\""
