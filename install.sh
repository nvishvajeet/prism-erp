#!/bin/bash
# ╔══════════════════════════════════════════════════════════════╗
# ║  PRISM ERP — One-line installer (like Homebrew)             ║
# ║                                                              ║
# ║  curl -fsSL https://raw.githubusercontent.com/nvishvajeet/  ║
# ║    prism-erp/main/install.sh | bash                         ║
# ║                                                              ║
# ║  Or download and run:                                        ║
# ║    bash install.sh                                           ║
# ╚══════════════════════════════════════════════════════════════╝
#
# What this does:
#   1. Checks prerequisites (Python 3.10+, git, pip)
#   2. Asks which ERP modules you want
#   3. Asks roughly how many users (optimizes DB settings)
#   4. Clones the repo, creates venv, installs deps
#   5. Generates .env with your choices
#   6. Initializes the database
#   7. Starts the server
#
# Safe to re-run — skips steps that are already done.

set -e

# ── Colors ───────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

say()  { echo -e "${GREEN}▶${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }
ask()  { echo -en "${CYAN}?${NC} $1"; }

# ── Banner ───────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║       PRISM ERP — Interactive Installer      ║${NC}"
echo -e "${BOLD}║   Lab Scheduler · Finance · Inbox · More     ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ── Prerequisites ────────────────────────────────────────────
say "Checking prerequisites..."

# Python 3.10+
if command -v python3 &>/dev/null; then
  PY_VER=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
  PY_MAJOR=$(echo "$PY_VER" | cut -d. -f1)
  PY_MINOR=$(echo "$PY_VER" | cut -d. -f2)
  if [ "$PY_MAJOR" -ge 3 ] && [ "$PY_MINOR" -ge 10 ]; then
    say "  Python $PY_VER ✓"
  else
    fail "Python 3.10+ required (found $PY_VER). Install from https://python.org"
  fi
else
  fail "Python 3 not found. Install from https://python.org"
fi

# Git
if command -v git &>/dev/null; then
  say "  git $(git --version | awk '{print $3}') ✓"
else
  fail "git not found. Install from https://git-scm.com"
fi

# ── Install location ────────────────────────────────────────
echo ""
INSTALL_DIR="${PRISM_INSTALL_DIR:-$HOME/prism}"

ask "Install location [$INSTALL_DIR]: "
read -r user_dir
[ -n "$user_dir" ] && INSTALL_DIR="$user_dir"

if [ -d "$INSTALL_DIR/app.py" ] || [ -f "$INSTALL_DIR/app.py" ]; then
  say "Existing installation found at $INSTALL_DIR"
  EXISTING=1
else
  EXISTING=0
fi

# ── Module selection ─────────────────────────────────────────
echo ""
echo -e "${BOLD}Which ERP modules do you need?${NC}"
echo ""
echo "  Available modules:"
echo -e "    ${CYAN}1${NC}  instruments   — Lab instrument management, sample requests"
echo -e "    ${CYAN}2${NC}  finance       — Grants, budgets, invoices, payments"
echo -e "    ${CYAN}3${NC}  inbox         — Internal messaging (reply, attach, folders)"
echo -e "    ${CYAN}4${NC}  notifications — Broadcast notices, noticeboard"
echo -e "    ${CYAN}5${NC}  attendance    — Attendance tracking, leave requests"
echo -e "    ${CYAN}6${NC}  queue         — Request queue, bulk actions, workflow"
echo -e "    ${CYAN}7${NC}  calendar      — Calendar views"
echo -e "    ${CYAN}8${NC}  stats         — Statistics, analytics, visualizations"
echo -e "    ${CYAN}9${NC}  admin         — Admin panels, dev tools (owner only)"
echo ""
echo "  Presets:"
echo -e "    ${CYAN}A${NC}  All modules (recommended for evaluation)"
echo -e "    ${CYAN}L${NC}  Lab facility  (instruments, finance, queue, inbox)"
echo -e "    ${CYAN}H${NC}  HR / Personnel (attendance, inbox, notifications)"
echo -e "    ${CYAN}M${NC}  Minimal       (instruments, queue, inbox)"
echo ""
ask "Enter numbers (e.g. 1,2,3,6) or a preset letter [A]: "
read -r module_choice
module_choice="${module_choice:-A}"

case "$module_choice" in
  [Aa]|"") MODULES="" ;;  # blank = all
  [Ll])    MODULES="instruments,finance,queue,inbox,calendar,stats,admin" ;;
  [Hh])    MODULES="attendance,inbox,notifications,admin" ;;
  [Mm])    MODULES="instruments,queue,inbox" ;;
  *)
    # Parse comma-separated numbers
    MODULES=""
    IFS=',' read -ra NUMS <<< "$module_choice"
    for num in "${NUMS[@]}"; do
      num=$(echo "$num" | tr -d ' ')
      case "$num" in
        1) MODULES="${MODULES:+$MODULES,}instruments" ;;
        2) MODULES="${MODULES:+$MODULES,}finance" ;;
        3) MODULES="${MODULES:+$MODULES,}inbox" ;;
        4) MODULES="${MODULES:+$MODULES,}notifications" ;;
        5) MODULES="${MODULES:+$MODULES,}attendance" ;;
        6) MODULES="${MODULES:+$MODULES,}queue" ;;
        7) MODULES="${MODULES:+$MODULES,}calendar" ;;
        8) MODULES="${MODULES:+$MODULES,}stats" ;;
        9) MODULES="${MODULES:+$MODULES,}admin" ;;
        *) warn "Unknown module number: $num (skipped)" ;;
      esac
    done
    ;;
esac

if [ -z "$MODULES" ]; then
  say "Modules: ALL (every module enabled)"
else
  say "Modules: $MODULES"
fi

# ── User count ───────────────────────────────────────────────
echo ""
echo -e "${BOLD}Roughly how many users will use this system?${NC}"
echo ""
echo -e "    ${CYAN}S${NC}  Small   (1-10 users)   — SQLite, minimal caching"
echo -e "    ${CYAN}M${NC}  Medium  (10-50 users)  — SQLite WAL, connection pooling"
echo -e "    ${CYAN}L${NC}  Large   (50-200 users) — SQLite WAL, aggressive caching"
echo -e "    ${CYAN}X${NC}  XLarge  (200+ users)   — SQLite WAL, max performance"
echo ""
ask "Size [S]: "
read -r size_choice
size_choice="${size_choice:-S}"

case "$size_choice" in
  [Ss]) USER_TIER="small";  WAL=0; CACHE_SIZE=2000;  PANE_SIZE=25  ;;
  [Mm]) USER_TIER="medium"; WAL=1; CACHE_SIZE=8000;  PANE_SIZE=25  ;;
  [Ll]) USER_TIER="large";  WAL=1; CACHE_SIZE=16000; PANE_SIZE=50  ;;
  [Xx]) USER_TIER="xlarge"; WAL=1; CACHE_SIZE=32000; PANE_SIZE=100 ;;
  *)    USER_TIER="small";  WAL=0; CACHE_SIZE=2000;  PANE_SIZE=25  ;;
esac

say "Optimizing for: $USER_TIER tier"

# ── Demo or production? ─────────────────────────────────────
echo ""
ask "Start in demo mode with sample data? (Y/n): "
read -r demo_choice
demo_choice="${demo_choice:-Y}"
case "$demo_choice" in
  [Nn]) DEMO_MODE=0; say "Production mode — no demo data" ;;
  *)    DEMO_MODE=1; say "Demo mode — sample accounts + instruments seeded" ;;
esac

# ── Clone or update ──────────────────────────────────────────
echo ""
if [ "$EXISTING" -eq 0 ]; then
  say "Cloning PRISM ERP..."
  REPO_URL="${PRISM_REPO_URL:-https://github.com/nvishvajeet/prism-erp.git}"
  git clone "$REPO_URL" "$INSTALL_DIR" 2>&1 | tail -3
else
  say "Updating existing installation..."
  cd "$INSTALL_DIR"
  git pull --rebase origin 2>&1 | tail -3
fi

cd "$INSTALL_DIR"

# ── Virtual environment ─────────────────────────────────────
say "Setting up Python environment..."
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi
.venv/bin/pip install -q -r requirements.txt
say "  Dependencies installed ✓"

# ── Generate .env ────────────────────────────────────────────
say "Generating configuration..."
SECRET=$(.venv/bin/python -c "import secrets; print(secrets.token_hex(32))")

cat > .env << ENVEOF
# PRISM ERP — Generated by install.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ)
# Tier: $USER_TIER | Modules: ${MODULES:-all}

LAB_SCHEDULER_SECRET_KEY=$SECRET
LAB_SCHEDULER_DEMO_MODE=$DEMO_MODE
LAB_SCHEDULER_CSRF=1
LAB_SCHEDULER_HTTPS=false
LAB_SCHEDULER_COOKIE_SECURE=false
OWNER_EMAILS=admin@lab.local

# ERP modules — comma-separated, blank = all
$([ -n "$MODULES" ] && echo "PRISM_MODULES=$MODULES" || echo "# PRISM_MODULES=")

# Performance tuning for $USER_TIER tier (~$size_choice)
PRISM_SQLITE_CACHE_SIZE=$CACHE_SIZE
PRISM_DEFAULT_PAGE_SIZE=$PANE_SIZE
$([ "$WAL" -eq 1 ] && echo "PRISM_SQLITE_WAL=1" || echo "# PRISM_SQLITE_WAL=0  # Small deployments use default journal")
ENVEOF

say "  .env written ✓"

# ── Data directories ─────────────────────────────────────────
mkdir -p data/demo data/operational logs
say "  Data directories ready ✓"

# ── Initialize database ──────────────────────────────────────
say "Initializing database..."
LAB_SCHEDULER_DEMO_MODE=$DEMO_MODE \
LAB_SCHEDULER_SECRET_KEY=$SECRET \
LAB_SCHEDULER_CSRF=0 \
.venv/bin/python -c "import app; app.init_db()" 2>/dev/null
say "  Database initialized ✓"

# ── Smoke test ───────────────────────────────────────────────
say "Running verification..."
if .venv/bin/python scripts/smoke_test.py > /dev/null 2>&1; then
  say "  Smoke test passed ✓"
else
  warn "Smoke test had issues — the server may still work"
fi

# ── Start server ─────────────────────────────────────────────
echo ""
ask "Start the server now? (Y/n): "
read -r start_choice
start_choice="${start_choice:-Y}"

if [[ "$start_choice" =~ ^[Yy] ]]; then
  say "Starting PRISM ERP..."
  nohup bash scripts/start.sh --service > logs/server.log 2>&1 &
  disown
  sleep 3

  if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5055/login 2>/dev/null | grep -q 200; then
    echo ""
    echo -e "${BOLD}${GREEN}══════════════════════════════════════════════${NC}"
    echo -e "${BOLD}${GREEN}  PRISM ERP is running!${NC}"
    echo -e "${BOLD}${GREEN}══════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${BOLD}URL:${NC}       http://127.0.0.1:5055"
    if [ "$DEMO_MODE" -eq 1 ]; then
      echo -e "  ${BOLD}Login:${NC}     admin@lab.local / 12345"
    fi
    echo -e "  ${BOLD}Modules:${NC}   ${MODULES:-all}"
    echo -e "  ${BOLD}Tier:${NC}      $USER_TIER"
    echo -e "  ${BOLD}Data:${NC}      $INSTALL_DIR/data/"
    echo ""
    echo -e "  ${BOLD}Update:${NC}    bash scripts/update.sh"
    echo -e "  ${BOLD}Stop:${NC}      kill \$(lsof -ti :5055)"
    echo -e "  ${BOLD}Logs:${NC}      tail -f logs/server.log"
    echo ""
  else
    warn "Server started but not responding yet — check logs/server.log"
  fi
else
  echo ""
  say "To start later: cd $INSTALL_DIR && ./scripts/start.sh"
fi

echo -e "${BOLD}Installation complete.${NC}"
echo ""
