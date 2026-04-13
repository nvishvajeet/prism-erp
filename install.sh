#!/bin/bash
# CATALYST ERP — One-line installer
# curl -fsSL https://raw.githubusercontent.com/YOUR-ORG/catalyst-erp/main/install.sh | bash
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; BOLD='\033[1m'; NC='\033[0m'
say()  { echo -e "${GREEN}=>${NC} $1"; }
fail() { echo -e "${RED}Error:${NC} $1"; exit 1; }

echo ""
echo -e "${BOLD}CATALYST ERP Installer${NC}"
echo ""

# ── Prerequisites ────────────────────────────────────────────
command -v python3 &>/dev/null || fail "Python 3 not found. Install from https://python.org"
PY_VER=$(python3 -c "import sys; v=sys.version_info; print(f'{v.major}.{v.minor}')")
PY_MINOR=$(echo "$PY_VER" | cut -d. -f2)
[ "$PY_MINOR" -ge 9 ] || fail "Python 3.9+ required (found $PY_VER)"
say "Python $PY_VER"

command -v git &>/dev/null || fail "git not found. Install from https://git-scm.com"
say "git $(git --version | awk '{print $3}')"

# ── Clone ────────────────────────────────────────────────────
INSTALL_DIR="${CATALYST_INSTALL_DIR:-./catalyst}"

if [ -f "$INSTALL_DIR/app.py" ]; then
  say "Existing install found at $INSTALL_DIR, updating..."
  cd "$INSTALL_DIR"
  git pull --rebase 2>&1 | tail -1
else
  REPO_URL="${CATALYST_REPO_URL:-https://github.com/YOUR-ORG/catalyst-erp.git}"
  say "Cloning into $INSTALL_DIR..."
  git clone "$REPO_URL" "$INSTALL_DIR" 2>&1 | tail -1
  cd "$INSTALL_DIR"
fi

# ── Virtual environment + dependencies ───────────────────────
say "Creating virtual environment..."
[ -d ".venv" ] || python3 -m venv .venv
.venv/bin/pip install -q -r requirements.txt
say "Dependencies installed"

# ── Environment config ───────────────────────────────────────
if [ ! -f ".env" ]; then
  SECRET=$(.venv/bin/python -c "import secrets; print(secrets.token_hex(32))")
  cat > .env << EOF
LAB_SCHEDULER_SECRET_KEY=$SECRET
LAB_SCHEDULER_DEMO_MODE=1
LAB_SCHEDULER_CSRF=1
OWNER_EMAILS=admin@lab.local
EOF
  say "Generated .env"
else
  say ".env already exists, keeping it"
fi

# ── Data directories ─────────────────────────────────────────
mkdir -p data/demo data/operational logs

# ── Database init + seed ─────────────────────────────────────
say "Initializing database..."
.venv/bin/python -c "import app; app.init_db()" 2>/dev/null
say "Database ready"

# ── Smoke test ───────────────────────────────────────────────
say "Running smoke test..."
if .venv/bin/python scripts/smoke_test.py > /dev/null 2>&1; then
  say "Smoke test passed"
else
  echo "  Warning: smoke test had issues, server may still work"
fi

# ── Done ─────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}Installation complete.${NC}"
echo ""
echo "  Login:     http://127.0.0.1:5055"
echo "  Email:     admin@lab.local"
echo "  Password:  12345"
echo "  Roles:     operator@ requester@ approver@ finance@ (same password)"
echo ""
echo "  Configure: edit .env (CATALYST_MODULES=instruments,finance,inbox,...)"
echo "  Update:    bash scripts/update.sh"
echo ""

# ── Offer to start ───────────────────────────────────────────
if [ -t 0 ]; then
  echo -n "Start server now? [Y/n] "
  read -r start_choice
  case "$start_choice" in
    [Nn]*) echo "Run ./scripts/start.sh when ready." ;;
    *)
      say "Starting CATALYST..."
      exec ./scripts/start.sh
      ;;
  esac
else
  echo "Run ./scripts/start.sh to start the server."
fi
