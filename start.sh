#!/bin/bash
# Lab Scheduler — startup script
#
# Usage:
#   ./start.sh             Development (HTTP, localhost only)
#   ./start.sh --https     Production (HTTPS, LAN-accessible)
#   ./start.sh --trust     Trust the self-signed cert (one-time, needs password)

cd "$(dirname "$0")"

export LAB_SCHEDULER_SECRET_KEY="${LAB_SCHEDULER_SECRET_KEY:-$(openssl rand -hex 32)}"
export OWNER_EMAILS="${OWNER_EMAILS:-admin@lab.local}"

case "$1" in
  --https)
    echo "=== HTTPS MODE ==="
    echo "    LAN IP: $(ipconfig getifaddr en0 2>/dev/null || echo 'unknown')"
    export LAB_SCHEDULER_COOKIE_SECURE=true
    export LAB_SCHEDULER_HTTPS=true
    export LAB_SCHEDULER_DEBUG=0
    python app.py
    ;;
  --trust)
    echo "=== TRUSTING CERTIFICATE ==="
    if [ ! -f certs/cert.pem ]; then
      echo "No certificate found. Run './start.sh --https' first to generate one."
      exit 1
    fi
    echo "Adding cert to system keychain (needs admin password)..."
    sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain certs/cert.pem
    echo "Done. All browsers on this machine will now trust the Lab Scheduler certificate."
    echo ""
    echo "For other machines on the LAN, copy certs/cert.pem to them and run:"
    echo "  macOS:   sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain cert.pem"
    echo "  Windows: certutil -addstore -f Root cert.pem"
    echo "  Linux:   sudo cp cert.pem /usr/local/share/ca-certificates/lab-scheduler.crt && sudo update-ca-certificates"
    ;;
  *)
    echo "=== DEVELOPMENT MODE ==="
    export LAB_SCHEDULER_DEBUG=1
    python app.py
    ;;
esac
