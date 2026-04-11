#!/bin/bash
# Lab Scheduler — startup script
#
# Usage:
#   ./scripts/start.sh             Development (HTTP, localhost only, Chrome auto-open)
#   ./scripts/start.sh --service   Launchd/systemd foreground service (no Chrome, venv python, .env sourced)
#   ./scripts/start.sh --https     Legacy: stunnel-wrapped HTTPS (superseded by tailscale serve)
#   ./scripts/start.sh --trust     Trust the self-signed cert (one-time, needs password)

# Always run from repo root so relative paths (ops/certs, app.py) resolve
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
    echo "=== SERVICE MODE ==="
    echo "    python:  ${PY_BIN}"
    echo "    host:    ${LAB_SCHEDULER_HOST:-127.0.0.1}"
    echo "    https:   ${LAB_SCHEDULER_HTTPS:-false}"
    echo "    demo:    ${LAB_SCHEDULER_DEMO_MODE:-0}"
    export LAB_SCHEDULER_DEBUG=0
    exec "${PY_BIN}" app.py
    ;;
  --https)
    echo "=== HTTPS MODE ==="
    echo "    LAN IP: $(ipconfig getifaddr en0 2>/dev/null || echo 'unknown')"
    export LAB_SCHEDULER_COOKIE_SECURE=true
    export LAB_SCHEDULER_HTTPS=true
    export LAB_SCHEDULER_DEBUG=0
    exec "${PY_BIN}" app.py
    ;;
  --trust)
    echo "=== TRUSTING CERTIFICATE ==="
    if [ ! -f ops/certs/cert.pem ]; then
      echo "No certificate found. Run './start.sh --https' first to generate one."
      exit 1
    fi
    echo "Adding cert to system keychain (needs admin password)..."
    sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ops/certs/cert.pem
    echo "Done. All browsers on this machine will now trust the Lab Scheduler certificate."
    echo ""
    echo "For other machines on the LAN, copy ops/certs/cert.pem to them and run:"
    echo "  macOS:   sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain cert.pem"
    echo "  Windows: certutil -addstore -f Root cert.pem"
    echo "  Linux:   sudo cp cert.pem /usr/local/share/ca-certificates/lab-scheduler.crt && sudo update-ca-certificates"
    ;;
  *)
    echo "=== DEVELOPMENT MODE ==="
    export LAB_SCHEDULER_DEBUG=1
    # Open in Chrome (not Safari) after a short delay for the server to start
    ( sleep 2 && open -a "Google Chrome" http://127.0.0.1:5055 2>/dev/null || open http://127.0.0.1:5055 ) &
    exec "${PY_BIN}" app.py
    ;;
esac
