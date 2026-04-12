#!/bin/bash
# PRISM ERP — First-time setup for a new deployment.
#
# Run this ONCE after cloning the repo. It creates the virtual
# environment, installs dependencies, initializes the database,
# and prints the login credentials.
#
# Usage:
#   git clone <url> prism && cd prism
#   bash scripts/setup.sh
#
# After setup, start the server with:
#   ./scripts/start.sh              # development (HTTP, Chrome)
#   ./scripts/start.sh --service    # production (no reloader)

set -e

cd "$(dirname "$0")/.."
echo "══════════════════════════════════════════════"
echo "  PRISM ERP — First-time Setup"
echo "══════════════════════════════════════════════"

# ── Python virtual environment ───────────────────────────
echo ""
echo "[1/4] Creating virtual environment..."
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
  echo "      Created .venv/"
else
  echo "      .venv/ already exists, skipping"
fi

echo "[2/4] Installing dependencies..."
.venv/bin/pip install -q -r requirements.txt

# ── Environment config ───────────────────────────────────
echo "[3/4] Environment configuration..."
if [ ! -f ".env" ]; then
  cp .env.example .env
  # Generate a unique secret key for this deployment
  SECRET=$(.venv/bin/python -c "import secrets; print(secrets.token_hex(32))")
  sed -i.bak "s/^# LAB_SCHEDULER_SECRET_KEY=.*/LAB_SCHEDULER_SECRET_KEY=$SECRET/" .env 2>/dev/null || \
    sed -i '' "s/^# LAB_SCHEDULER_SECRET_KEY=.*/LAB_SCHEDULER_SECRET_KEY=$SECRET/" .env
  rm -f .env.bak
  echo "      Created .env from .env.example (secret key generated)"
  echo "      Edit .env to configure modules: PRISM_MODULES=instruments,finance,inbox"
else
  echo "      .env already exists, skipping"
fi

# ── Data directories ─────────────────────────────────────
echo "[4/4] Initializing data directories..."
mkdir -p data/demo data/operational logs
echo "      Created data/demo/, data/operational/, logs/"

# ── Database initialization ──────────────────────────────
echo ""
echo "Initializing database (demo mode)..."
LAB_SCHEDULER_DEMO_MODE=1 .venv/bin/python -c "
import app
app.init_db()
print('Database initialized at', app.DB_PATH)
"

# ── Verify ───────────────────────────────────────────────
echo ""
echo "Running smoke test..."
if .venv/bin/python scripts/smoke_test.py > /dev/null 2>&1; then
  echo "✓ Smoke test passed"
else
  echo "✗ Smoke test failed — check logs/server.log"
  exit 1
fi

echo ""
echo "══════════════════════════════════════════════"
echo "  Setup complete!"
echo ""
echo "  Start the server:"
echo "    ./scripts/start.sh"
echo ""
echo "  Login:"
echo "    URL:      http://127.0.0.1:5055"
echo "    Email:    admin@lab.local"
echo "    Password: 12345"
echo ""
echo "  Configure modules in .env:"
echo "    PRISM_MODULES=instruments,finance,inbox"
echo ""
echo "  Check for updates:"
echo "    bash scripts/update.sh"
echo "══════════════════════════════════════════════"
