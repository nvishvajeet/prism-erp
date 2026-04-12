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
    echo "=== SERVICE MODE ==="
    export LAB_SCHEDULER_DEBUG=0
    export LAB_SCHEDULER_AUTORELOAD=0

    # Prefer Gunicorn if available (multi-worker, production-grade).
    # Falls back to Flask dev server if gunicorn isn't installed.
    if [ -x ".venv/bin/gunicorn" ]; then
      WORKERS="${PRISM_WORKERS:-4}"
      echo "    server:  gunicorn ($WORKERS workers)"
      echo "    bind:    $BIND_ADDR"
      if [ "$HAS_CERT" -eq 1 ]; then
        echo "    https:   ON (mkcert)"
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
        echo "    https:   OFF (no cert.pem found)"
        exec .venv/bin/gunicorn app:app \
          -w "$WORKERS" \
          -b "$BIND_ADDR" \
          --access-logfile - \
          --error-logfile -
      fi
    else
      echo "    server:  flask dev (install gunicorn for production)"
      echo "    bind:    $BIND_ADDR"
      echo "    demo:    ${LAB_SCHEDULER_DEMO_MODE:-0}"
      exec "${PY_BIN}" app.py
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
