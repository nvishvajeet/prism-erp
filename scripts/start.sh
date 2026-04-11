#!/bin/bash
# Lab Scheduler — startup script
#
# Usage:
#   ./scripts/start.sh             Development (HTTP, localhost only, Chrome auto-open)
#   ./scripts/start.sh --service   Launchd/systemd foreground service (no Chrome, venv python, .env sourced)
#
# HTTPS is NOT handled here — `tailscale serve` fronts Flask on the
# tailnet with a real Let's Encrypt cert. See docs/HTTPS.md and
# scripts/tailscale_serve.sh.

# Always run from repo root so relative paths (app.py, .env) resolve
cd "$(dirname "$0")/.."

# Source .env if present — launchd does NOT inherit your shell env, so this is
# the only place the service mode learns SECRET_KEY / HOST / DEMO_MODE etc.
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

export LAB_SCHEDULER_SECRET_KEY="${LAB_SCHEDULER_SECRET_KEY:-$(openssl rand -hex 32)}"
export OWNER_EMAILS="${OWNER_EMAILS:-admin@lab.local}"

# Pick the venv python if it exists, fall back to system python.
PY_BIN="python"
if [ -x ".venv/bin/python" ]; then
  PY_BIN=".venv/bin/python"
fi

case "$1" in
  --service)
    # Foreground service mode. Used by launchd (ops/launchd/local.prism.plist)
    # and systemd. NO Chrome auto-open, NO reloader, NO debug. stdout/stderr
    # are captured by launchd and rotated into logs/server.log.
    #
    # LAB_SCHEDULER_AUTORELOAD=0 is pinned UNCONDITIONALLY here even
    # though the plist sets it in EnvironmentVariables — belt +
    # suspenders, because the Werkzeug reloader is catastrophic under
    # launchd: the reloader forks a child process, the parent exits,
    # launchd sees the parent die and marks the service EX_CONFIG
    # (exit 78). Observed 2026-04-11 during the launchd bootstrap
    # attempt for the public demo. Setting it in start.sh guarantees
    # service mode always turns the reloader off regardless of how
    # the script was launched.
    echo "=== SERVICE MODE ==="
    echo "    python:  ${PY_BIN}"
    echo "    host:    ${LAB_SCHEDULER_HOST:-127.0.0.1}"
    echo "    https:   ${LAB_SCHEDULER_HTTPS:-false}"
    echo "    demo:    ${LAB_SCHEDULER_DEMO_MODE:-0}"
    export LAB_SCHEDULER_DEBUG=0
    export LAB_SCHEDULER_AUTORELOAD=0
    exec "${PY_BIN}" app.py
    ;;
  *)
    echo "=== DEVELOPMENT MODE ==="
    export LAB_SCHEDULER_DEBUG=1
    # Open in Chrome (not Safari) after a short delay for the server to start
    ( sleep 2 && open -a "Google Chrome" http://127.0.0.1:5055 2>/dev/null || open http://127.0.0.1:5055 ) &
    exec "${PY_BIN}" app.py
    ;;
esac
