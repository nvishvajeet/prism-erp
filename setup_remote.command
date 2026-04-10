#!/bin/bash
#
# setup_remote.command — one-time interactive setup for the
# Ollama bridge between this MacBook and the Mac mini in India.
#
# Safe to re-run. Every destructive step asks before acting.
# Read OLLAMA_DEV_PLAN.md before running this script.
#

set -e

REMOTE_HOST="vishwajeet@100.115.176.118"
REMOTE_REPO="~/Scheduler/Main"
REMOTE_BARE="~/git/lab-scheduler.git"
LOCAL_PORT_REMOTE_TUNNEL=11434
LOCAL_PORT_LOCAL_OLLAMA=11435
SOCKET="/tmp/macmini-ollama-ssh.sock"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

bold() { printf "\033[1m%s\033[0m\n" "$*"; }
warn() { printf "\033[33m%s\033[0m\n" "$*"; }
ok()   { printf "\033[32m%s\033[0m\n" "$*"; }
err()  { printf "\033[31m%s\033[0m\n" "$*"; }

ask() {
  local prompt="$1" default="${2:-n}"
  local reply
  read -r -p "$prompt [y/N]: " reply
  reply="${reply:-$default}"
  case "$reply" in y|Y|yes|YES) return 0 ;; *) return 1 ;; esac
}

step() { echo ""; bold "==> $*"; }

#--------------------------------------------------------------
step "Step 1/8 — Check ~/.ssh/config for usekeychain typo"
#--------------------------------------------------------------

CONFIG="$HOME/.ssh/config"
if [ -f "$CONFIG" ] && grep -q "^[[:space:]]*usekeychain" "$CONFIG"; then
  warn "Found 'usekeychain' (lowercase) in $CONFIG."
  warn "macOS SSH wants 'UseKeychain' (capital U, capital K)."
  warn "This typo will break ssh / git push."
  if ask "Fix it now? (creates a backup)"; then
    cp "$CONFIG" "$CONFIG.bak.$(date +%s)"
    sed -i '' 's/^\([[:space:]]*\)usekeychain/\1UseKeychain/g' "$CONFIG"
    ok "Fixed. Backup at $CONFIG.bak.*"
  else
    warn "Leaving as-is. git push will keep failing until you fix it."
  fi
else
  ok "No typo found."
fi

#--------------------------------------------------------------
step "Step 2/8 — Test SSH to Mac mini ($REMOTE_HOST)"
#--------------------------------------------------------------

if ssh -o ConnectTimeout=5 -o BatchMode=yes "$REMOTE_HOST" "echo ok" >/dev/null 2>&1; then
  ok "SSH works."
else
  err "SSH to $REMOTE_HOST failed."
  err "Make sure Tailscale is up on both machines and your key is in"
  err "  $REMOTE_HOST:~/.ssh/authorized_keys"
  exit 1
fi

#--------------------------------------------------------------
step "Step 3/8 — Install brew, tmux, ollama, git on Mac mini"
#--------------------------------------------------------------

if ask "Run install/upgrade on Mac mini?"; then
  ssh "$REMOTE_HOST" '
    set -e
    export PATH=/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/local/sbin:$PATH
    if ! command -v brew >/dev/null 2>&1; then
      echo "installing homebrew…"
      NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
    brew install tmux ollama git || true
    brew upgrade tmux ollama git || true
  '
  ok "Mac mini packages OK."
else
  warn "Skipped."
fi

#--------------------------------------------------------------
step "Step 4/8 — Pull Ollama models on Mac mini"
#--------------------------------------------------------------

if ask "Pull llama3 + codellama on Mac mini? (~8 GB combined)"; then
  ssh "$REMOTE_HOST" '
    export PATH=/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/local/sbin:$PATH
    if ! tmux has-session -t ollama 2>/dev/null; then
      tmux new -d -s ollama "ollama serve"
      sleep 4
    fi
    ollama pull llama3
    ollama pull codellama || true
  '
  ok "Models pulled."
else
  warn "Skipped."
fi

#--------------------------------------------------------------
step "Step 5/8 — Bare git mirror at $REMOTE_BARE"
#--------------------------------------------------------------

if ask "Ensure bare mirror exists on Mac mini?"; then
  ssh "$REMOTE_HOST" "
    set -e
    mkdir -p $(dirname $REMOTE_BARE)
    if [ ! -d $REMOTE_BARE ]; then
      git init --bare $REMOTE_BARE
    fi
  "
  if git remote get-url macmini >/dev/null 2>&1; then
    ok "Local remote 'macmini' already configured."
  else
    if ask "Add 'macmini' as a local git remote pointing at the bare mirror?"; then
      git remote add macmini "$REMOTE_HOST:$REMOTE_BARE"
      ok "Added remote 'macmini'."
    fi
  fi
else
  warn "Skipped."
fi

#--------------------------------------------------------------
step "Step 6/8 — Working clone at $REMOTE_REPO + ollama-work branch"
#--------------------------------------------------------------

if ask "Ensure working clone + ollama-work branch on Mac mini?"; then
  ssh "$REMOTE_HOST" "
    set -e
    if [ ! -d $REMOTE_REPO/.git ]; then
      mkdir -p $(dirname $REMOTE_REPO)
      git clone $REMOTE_BARE $REMOTE_REPO
    fi
    cd $REMOTE_REPO
    git fetch origin
    if ! git show-ref --verify --quiet refs/heads/ollama-work; then
      git checkout -B ollama-work origin/main 2>/dev/null || git checkout -B ollama-work
    fi
  "
  ok "Remote working clone ready."
else
  warn "Skipped."
fi

#--------------------------------------------------------------
step "Step 7/8 — Local sandbox dirs + branch + tag"
#--------------------------------------------------------------

mkdir -p ollama_tasks ollama_outputs ollama_chats
ok "ollama_tasks/, ollama_outputs/, ollama_chats/ ready."

if ! git show-ref --verify --quiet refs/heads/ollama-work; then
  if ask "Create local 'ollama-work' branch from current HEAD?"; then
    git branch ollama-work
    ok "Branch created."
  fi
else
  ok "Local 'ollama-work' branch exists."
fi

if ! git rev-parse claude_last_seen >/dev/null 2>&1; then
  if ask "Create 'claude_last_seen' tag at current HEAD?"; then
    git tag claude_last_seen
    ok "Tag created."
  fi
else
  ok "Tag 'claude_last_seen' exists."
fi

#--------------------------------------------------------------
step "Step 8/8 — Local Ollama on port $LOCAL_PORT_LOCAL_OLLAMA"
#--------------------------------------------------------------

if ! command -v ollama >/dev/null 2>&1; then
  warn "Local 'ollama' not installed. brew install ollama if you want --mode=local."
else
  if curl -sSf "http://127.0.0.1:$LOCAL_PORT_LOCAL_OLLAMA/api/tags" >/dev/null 2>&1; then
    ok "Local Ollama already serving on port $LOCAL_PORT_LOCAL_OLLAMA."
  else
    warn "Local Ollama is not on port $LOCAL_PORT_LOCAL_OLLAMA."
    warn "To run: OLLAMA_HOST=127.0.0.1:$LOCAL_PORT_LOCAL_OLLAMA ollama serve"
    warn "(non-default port avoids collision with the SSH tunnel on 11434)"
  fi
fi

echo ""
bold "Setup complete."
echo ""
echo "Next steps:"
echo "  1. Start a chat:        ./Remote\\ Ollama\\ Chat.command"
echo "  2. Run a task spec:     ./run_ollama_task.sh ollama_tasks/example.md"
echo "  3. Read the contract:   open OLLAMA_DEV_PLAN.md"
echo ""
