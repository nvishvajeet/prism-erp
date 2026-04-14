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

# Source env file if present — launchd does NOT inherit your shell env, so this is
# the only place the service mode learns SECRET_KEY / HOST / DEMO_MODE etc.
ENV_FILE="${LAB_SCHEDULER_ENV_FILE:-.env}"
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ENV_FILE"
  set +a
fi

export LAB_SCHEDULER_SECRET_KEY="${LAB_SCHEDULER_SECRET_KEY:-$(openssl rand -hex 32)}"
export OWNER_EMAILS="${OWNER_EMAILS:-admin@lab.local}"

# Pick the venv python if it exists, fall back to system python.
PY_BIN="python"
if [ -x ".venv/bin/python" ]; then
  PY_BIN=".venv/bin/python"
fi

# HTTPS: if cert.pem + key.pem exist at the repo root, serve HTTPS.
CERT_FILE="$(pwd)/cert.pem"
KEY_FILE="$(pwd)/key.pem"
HAS_CERT=0
[ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ] && HAS_CERT=1

BIND_HOST="${LAB_SCHEDULER_HOST:-127.0.0.1}"
BIND_PORT="${LAB_SCHEDULER_PORT:-5055}"
BIND_ADDR="${BIND_HOST}:${BIND_PORT}"

case "$1" in
  --service)
    echo "=== SERVICE MODE (Gunicorn) ==="
    export LAB_SCHEDULER_DEBUG=0
    export LAB_SCHEDULER_AUTORELOAD=0

    # Kill any stale process on our port so launchd restarts don't fail
    STALE_PIDS=$(lsof -ti "TCP:${BIND_PORT}" 2>/dev/null)
    if [ -n "$STALE_PIDS" ]; then
      echo "    killing stale PIDs on port ${BIND_PORT}: $STALE_PIDS"
      echo "$STALE_PIDS" | xargs kill -9 2>/dev/null
      sleep 1
    fi

    # Install gunicorn if missing
    if [ ! -x ".venv/bin/gunicorn" ]; then
      echo "    Installing gunicorn..."
      .venv/bin/pip install -q gunicorn
    fi

    WORKERS="${CATALYST_WORKERS:-4}"
    echo "    server:  gunicorn ($WORKERS workers)"
    echo "    bind:    $BIND_ADDR"

    if [ "$HAS_CERT" -eq 1 ]; then
      echo "    https:   ON"
      export LAB_SCHEDULER_HTTPS=true
      export LAB_SCHEDULER_COOKIE_SECURE=true
      exec .venv/bin/gunicorn app:app \
        -w "$WORKERS" \
        -b "$BIND_ADDR" \
        --certfile "$CERT_FILE" \
        --keyfile "$KEY_FILE" \
        --access-logfile - \
        --error-logfile -
    else
      echo "    https:   OFF (generate certs: mkcert -cert-file cert.pem -key-file key.pem localhost 127.0.0.1)"
      exec .venv/bin/gunicorn app:app \
        -w "$WORKERS" \
        -b "$BIND_ADDR" \
        --access-logfile - \
        --error-logfile -
    fi
    ;;
  *)
    echo "=== DEVELOPMENT MODE ==="
    export LAB_SCHEDULER_DEBUG=1
    PROTO="http"
    [ "$HAS_CERT" -eq 1 ] && PROTO="https"
    ( sleep 2 && open -a "Google Chrome" "${PROTO}://127.0.0.1:${BIND_PORT}" 2>/dev/null || open "${PROTO}://127.0.0.1:${BIND_PORT}" ) &
    exec "${PY_BIN}" app.py
    ;;
esac
