#!/bin/bash
# ╔══════════════════════════════════════════════════════════════╗
# ║  PRISM ERP — Mac Mini Setup / Reconnect Script              ║
# ║                                                              ║
# ║  Run this from your LAPTOP whenever:                         ║
# ║    - Setting up a fresh mini                                 ║
# ║    - Reconnecting after the mini's IP/settings changed       ║
# ║    - Migrating to a replacement mini                         ║
# ║                                                              ║
# ║  Usage: bash scripts/setup_mini.sh                           ║
# ╚══════════════════════════════════════════════════════════════╝
#
# What this does:
#   1. Asks for the mini's IP, username, and SSH port
#   2. Tests SSH connectivity
#   3. Copies your SSH key if needed
#   4. Updates ~/.ssh/config with the new connection
#   5. Installs PRISM on the mini (clones repo, venv, deps)
#   6. Restores backup data from your laptop if available
#   7. Generates HTTPS certs + starts the server
#   8. Verifies everything works
#
# Prerequisites on your laptop:
#   - SSH key at ~/.ssh/id_ed25519 (or it will generate one)
#   - Latest backup in ~/Documents/Scheduler/backups/ (optional)

set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
say()  { echo -e "${GREEN}▶${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }
ask()  { echo -en "${CYAN}?${NC} $1"; }

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║    PRISM — Mac Mini Setup / Reconnect        ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ── 1. Connection details ────────────────────────────────────
echo -e "${BOLD}Step 1: Connection details${NC}"
echo ""

# Load previous config if exists
PREV_HOST=""
PREV_USER=""
if grep -q "Host prism-mini" ~/.ssh/config 2>/dev/null; then
  PREV_HOST=$(grep -A3 "Host prism-mini" ~/.ssh/config | grep HostName | awk '{print $2}')
  PREV_USER=$(grep -A3 "Host prism-mini" ~/.ssh/config | grep "User " | awk '{print $2}')
  say "Previous config found: ${PREV_USER}@${PREV_HOST}"
fi

ask "Mini IP address [${PREV_HOST:-192.168.1.x}]: "
read -r MINI_IP
MINI_IP="${MINI_IP:-$PREV_HOST}"
[ -z "$MINI_IP" ] && fail "IP address is required"

ask "Username on mini [${PREV_USER:-vishwajeet}]: "
read -r MINI_USER
MINI_USER="${MINI_USER:-${PREV_USER:-vishwajeet}}"

ask "SSH port [22]: "
read -r MINI_PORT
MINI_PORT="${MINI_PORT:-22}"

ask "PRISM install path on mini [~/Scheduler/Main]: "
read -r MINI_PATH
MINI_PATH="${MINI_PATH:-~/Scheduler/Main}"

echo ""
say "Target: ${MINI_USER}@${MINI_IP}:${MINI_PORT} → ${MINI_PATH}"

# ── 2. SSH key ───────────────────────────────────────────────
echo ""
echo -e "${BOLD}Step 2: SSH key${NC}"

KEY_FILE="$HOME/.ssh/id_ed25519"
if [ ! -f "$KEY_FILE" ]; then
  say "Generating SSH key..."
  ssh-keygen -t ed25519 -f "$KEY_FILE" -N "" -C "prism-owner@$(hostname)"
fi
say "Key: $KEY_FILE ✓"

# ── 3. Test connectivity ────────────────────────────────────
echo ""
echo -e "${BOLD}Step 3: Testing SSH connection${NC}"
echo ""
say "Trying ssh ${MINI_USER}@${MINI_IP} -p ${MINI_PORT}..."
echo ""

if ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new \
   -p "$MINI_PORT" "${MINI_USER}@${MINI_IP}" "echo 'SSH OK'" 2>/dev/null; then
  say "SSH connected ✓"
else
  warn "SSH failed. Trying to copy your key first..."
  echo ""
  echo "  You'll be asked for the mini's PASSWORD (not your laptop password)."
  echo "  This is a one-time setup — after this, SSH uses key auth."
  echo ""
  ssh-copy-id -i "$KEY_FILE" -p "$MINI_PORT" "${MINI_USER}@${MINI_IP}" 2>&1

  # Retry
  if ssh -o ConnectTimeout=10 -p "$MINI_PORT" "${MINI_USER}@${MINI_IP}" "echo 'SSH OK'" 2>/dev/null; then
    say "SSH connected (key installed) ✓"
  else
    fail "Cannot connect to ${MINI_USER}@${MINI_IP}:${MINI_PORT}. Check the IP and that SSH is enabled on the mini."
  fi
fi

# ── 4. Update SSH config ────────────────────────────────────
echo ""
echo -e "${BOLD}Step 4: Updating SSH config${NC}"

# Remove old prism-mini entry if exists
if grep -q "Host prism-mini" ~/.ssh/config 2>/dev/null; then
  # Remove the old block (Host prism-mini + next 4 lines)
  sed -i.bak '/^Host prism-mini$/,/^$/d' ~/.ssh/config
  rm -f ~/.ssh/config.bak
  say "Removed old prism-mini config"
fi

cat >> ~/.ssh/config << SSHEOF

# PRISM Mac mini — auto-configured by setup_mini.sh on $(date +%Y-%m-%d)
Host prism-mini
    HostName ${MINI_IP}
    User ${MINI_USER}
    Port ${MINI_PORT}
    IdentityFile ${KEY_FILE}
    IdentitiesOnly yes
    ServerAliveInterval 60
    ServerAliveCountMax 3
SSHEOF

say "~/.ssh/config updated ✓"
say "You can now use: ssh prism-mini"

# ── 5. Install PRISM on mini ────────────────────────────────
echo ""
echo -e "${BOLD}Step 5: Installing PRISM on mini${NC}"

REPO_URL="${PRISM_REPO_URL:-https://github.com/YOUR-ORG/prism-erp.git}"

ssh -p "$MINI_PORT" "${MINI_USER}@${MINI_IP}" bash -s -- "$MINI_PATH" "$REPO_URL" << 'REMOTE_INSTALL'
  MINI_PATH="$1"
  REPO_URL="$2"

  echo "  Checking for existing installation..."
  if [ -f "$MINI_PATH/app.py" ]; then
    echo "  Found existing PRISM at $MINI_PATH"
    cd "$MINI_PATH"
    echo "  Pulling latest..."
    git pull origin v1.3.0-stable-release 2>&1 | tail -3
  else
    echo "  Fresh install — cloning..."
    mkdir -p "$(dirname $MINI_PATH)"
    git clone "$REPO_URL" "$MINI_PATH" 2>&1 | tail -3
    cd "$MINI_PATH"
  fi

  echo "  Setting up venv..."
  if [ ! -d ".venv" ]; then
    python3 -m venv .venv
  fi
  .venv/bin/pip install -q -r requirements.txt 2>&1 | tail -2
  .venv/bin/pip install -q gunicorn 2>&1 | tail -1

  echo "  Creating directories..."
  mkdir -p data/demo data/operational logs

  echo "  ✓ PRISM installed at $MINI_PATH"
REMOTE_INSTALL

say "PRISM installed on mini ✓"

# ── 6. Restore backup data ──────────────────────────────────
echo ""
echo -e "${BOLD}Step 6: Data restore${NC}"

BACKUP_ROOT="$HOME/Documents/Scheduler/backups"
LATEST_BACKUP=""
if [ -d "$BACKUP_ROOT" ]; then
  LATEST_BACKUP=$(ls -d "$BACKUP_ROOT"/20* 2>/dev/null | sort | tail -1)
fi

if [ -n "$LATEST_BACKUP" ] && [ -d "$LATEST_BACKUP/data" ]; then
  BACKUP_DATE=$(basename "$LATEST_BACKUP")
  BACKUP_SIZE=$(du -sh "$LATEST_BACKUP" 2>/dev/null | awk '{print $1}')
  ask "Restore backup from $BACKUP_DATE ($BACKUP_SIZE)? (Y/n): "
  read -r restore_choice
  restore_choice="${restore_choice:-Y}"

  if [[ "$restore_choice" =~ ^[Yy] ]]; then
    say "Restoring data to mini..."
    rsync -az --progress \
      "$LATEST_BACKUP/data/" \
      "${MINI_USER}@${MINI_IP}:${MINI_PATH}/data/" 2>&1 | tail -3

    if [ -f "$LATEST_BACKUP/.env" ]; then
      say "Restoring .env..."
      scp -P "$MINI_PORT" "$LATEST_BACKUP/.env" "${MINI_USER}@${MINI_IP}:${MINI_PATH}/.env"
    fi
    say "Data restored ✓"
  else
    say "Skipping restore"
  fi
else
  say "No backup found at $BACKUP_ROOT — starting fresh"

  # Generate .env on mini if missing
  ssh -p "$MINI_PORT" "${MINI_USER}@${MINI_IP}" bash -s -- "$MINI_PATH" << 'REMOTE_ENV'
    cd "$1"
    if [ ! -f .env ]; then
      SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
      cat > .env << ENVFILE
LAB_SCHEDULER_SECRET_KEY=$SECRET
LAB_SCHEDULER_DEMO_MODE=0
LAB_SCHEDULER_CSRF=1
LAB_SCHEDULER_HOST=0.0.0.0
LAB_SCHEDULER_PORT=5055
OWNER_EMAILS=admin@lab.local
ENVFILE
      echo "  Generated .env"
    else
      echo "  .env exists"
    fi
REMOTE_ENV
fi

# ── 7. Generate certs + start server ────────────────────────
echo ""
echo -e "${BOLD}Step 7: HTTPS + server startup${NC}"

ssh -p "$MINI_PORT" "${MINI_USER}@${MINI_IP}" bash -s -- "$MINI_PATH" << 'REMOTE_START'
  cd "$1"

  # Generate self-signed cert if missing
  if [ ! -f cert.pem ]; then
    echo "  Generating HTTPS cert..."
    openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem \
      -days 365 -nodes -subj "/CN=prism-mini" 2>/dev/null
    echo "  Self-signed cert generated ✓"
  else
    echo "  Cert exists ✓"
  fi

  # Initialize DB
  echo "  Initializing database..."
  set -a; source .env 2>/dev/null; set +a
  export LAB_SCHEDULER_SECRET_KEY="${LAB_SCHEDULER_SECRET_KEY:-$(openssl rand -hex 32)}"
  .venv/bin/python -c "import app; app.init_db()" 2>/dev/null
  echo "  Database ready ✓"

  # Kill existing server
  kill -9 $(lsof -ti :${LAB_SCHEDULER_PORT:-5055}) 2>/dev/null
  sleep 2

  # Start gunicorn
  PORT="${LAB_SCHEDULER_PORT:-5055}"
  nohup .venv/bin/gunicorn app:app -w 4 -b 0.0.0.0:$PORT \
    --certfile cert.pem --keyfile key.pem \
    --access-logfile logs/access.log \
    --error-logfile logs/error.log > logs/server.log 2>&1 &

  sleep 3

  CODE=$(curl -sk -o /dev/null -w "%{http_code}" https://127.0.0.1:$PORT/login)
  if [ "$CODE" = "200" ]; then
    echo "  Server running on port $PORT ✓"
  else
    echo "  WARNING: Server returned $CODE"
  fi
REMOTE_START

# ── 8. Verify from laptop ───────────────────────────────────
echo ""
echo -e "${BOLD}Step 8: Verification${NC}"

PORT=$(ssh -p "$MINI_PORT" "${MINI_USER}@${MINI_IP}" "grep LAB_SCHEDULER_PORT $MINI_PATH/.env 2>/dev/null | cut -d= -f2 || echo 5055" | tr -d '[:space:]')
PORT="${PORT:-5055}"

HTTPS_CODE=$(curl -sk -o /dev/null -w "%{http_code}" "https://${MINI_IP}:${PORT}/login" 2>/dev/null || echo "000")
SSH_CODE="OK"

echo ""
echo -e "${BOLD}${GREEN}══════════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}  PRISM Mini Setup Complete${NC}"
echo -e "${BOLD}${GREEN}══════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}SSH:${NC}     ssh prism-mini"
echo -e "  ${BOLD}HTTPS:${NC}   https://${MINI_IP}:${PORT} (status: ${HTTPS_CODE})"
echo -e "  ${BOLD}LAN:${NC}     https://${MINI_IP}:${PORT} (same — accessible from any device on the network)"
echo ""
echo -e "  ${BOLD}Backup:${NC}  bash scripts/backup_from_mini.sh"
echo -e "  ${BOLD}Update:${NC}  ssh prism-mini 'cd ${MINI_PATH} && bash scripts/update.sh --restart'"
echo -e "  ${BOLD}Logs:${NC}    ssh prism-mini 'tail -f ${MINI_PATH}/logs/server.log'"
echo ""

if [ "$HTTPS_CODE" != "200" ]; then
  warn "HTTPS returned $HTTPS_CODE — the mini may need a firewall exception."
  echo "  On the mini, run:"
  echo "    sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/bin/python3"
  echo "    sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp /usr/bin/python3"
fi

# Save connection details for other scripts
cat > "$(dirname "$0")/../.mini_connection" << CONN
MINI_HOST=${MINI_USER}@${MINI_IP}
MINI_PORT=${MINI_PORT}
MINI_PATH=${MINI_PATH}
MINI_URL=https://${MINI_IP}:${PORT}
CONFIGURED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
CONN

say "Connection details saved to .mini_connection"
echo ""
