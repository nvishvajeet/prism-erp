#!/bin/bash

set -e

REMOTE_HOST="vishwajeet@100.115.176.118"

REMOTE_LOCAL_PORT="11434"
LOCAL_ONLY_PORT="11434"
LOCAL_BOTH_PORT="11435"

MODE="${1:-remote}"
MINUTES="${2:-5}"

SOCKET="/tmp/macmini-ollama-ssh.sock"

case "$MODE" in
  remote|local|both)
    ;;
  *)
    echo "Error: mode must be remote, local, or both"
    echo "Usage: $0 [remote|local|both] [minutes]"
    exit 1
    ;;
esac

case "$MINUTES" in
  ''|*[!0-9]*)
    echo "Error: minutes must be a non-negative integer"
    echo "Usage: $0 [remote|local|both] [minutes]"
    exit 1
    ;;
esac

echo "Starting mode=$MODE time=$MINUTES"

TUNNEL_PID=""
CAFF_PID=""

start_master_ssh() {
  rm -f "$SOCKET"

  echo "[remote] Opening authenticated master SSH connection"
  ssh -M -S "$SOCKET" -fnNT "$REMOTE_HOST"

  if [ ! -S "$SOCKET" ]; then
    echo "[remote] Failed to create SSH control socket"
    exit 1
  fi
}

stop_master_ssh() {
  if [ -S "$SOCKET" ]; then
    ssh -S "$SOCKET" -O exit "$REMOTE_HOST" >/dev/null 2>&1 || true
    rm -f "$SOCKET"
  fi
}

remote_ssh() {
  ssh -S "$SOCKET" "$REMOTE_HOST" "$@"
}

install_brew_remote() {
  remote_ssh '
    export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/local/sbin:$PATH"

    if ! command -v brew >/dev/null 2>&1; then
      echo "[remote] Installing Homebrew"
      NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
      if [ -x /opt/homebrew/bin/brew ]; then
        echo '\''eval "$(/opt/homebrew/bin/brew shellenv)"'\'' >> ~/.zprofile
        echo '\''eval "$(/opt/homebrew/bin/brew shellenv)"'\'' >> ~/.zshrc
        export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"
      elif [ -x /usr/local/bin/brew ]; then
        echo '\''eval "$(/usr/local/bin/brew shellenv)"'\'' >> ~/.zprofile
        echo '\''eval "$(/usr/local/bin/brew shellenv)"'\'' >> ~/.zshrc
        export PATH="/usr/local/bin:/usr/local/sbin:$PATH"
      fi
    fi
  '
}

install_brew_local() {
  export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/local/sbin:$PATH"

  if ! command -v brew >/dev/null 2>&1; then
    echo "[local] Installing Homebrew"
    NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    if [ -x /opt/homebrew/bin/brew ]; then
      echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
      echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zshrc
      export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"
    elif [ -x /usr/local/bin/brew ]; then
      echo 'eval "$(/usr/local/bin/brew shellenv)"' >> ~/.zprofile
      echo 'eval "$(/usr/local/bin/brew shellenv)"' >> ~/.zshrc
      export PATH="/usr/local/bin:/usr/local/sbin:$PATH"
    fi
  fi
}

ensure_remote_packages() {
  install_brew_remote

  remote_ssh '
    export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/local/sbin:$PATH"

    if ! command -v brew >/dev/null 2>&1; then
      echo "[remote] Homebrew still not found"
      exit 1
    fi

    if ! command -v tmux >/dev/null 2>&1; then
      echo "[remote] Installing tmux"
      brew install tmux
    fi

    if ! command -v ollama >/dev/null 2>&1; then
      echo "[remote] Installing ollama"
      brew install ollama
    fi

    if ! command -v curl >/dev/null 2>&1; then
      echo "[remote] curl missing"
      exit 1
    fi
  '
}

ensure_local_packages() {
  install_brew_local

  if ! command -v brew >/dev/null 2>&1; then
    echo "[local] Homebrew still not found"
    exit 1
  fi

  if ! command -v tmux >/dev/null 2>&1; then
    echo "[local] Installing tmux"
    brew install tmux
  fi

  if ! command -v ollama >/dev/null 2>&1; then
    echo "[local] Installing ollama"
    brew install ollama
  fi

  if ! command -v curl >/dev/null 2>&1; then
    echo "[local] curl missing"
    exit 1
  fi
}

start_remote_ollama() {
  ensure_remote_packages

  remote_ssh '
    export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/local/sbin:$PATH"

    if ! tmux has-session -t ollama 2>/dev/null; then
      echo "[remote] Starting ollama in tmux"
      tmux new -d -s ollama "export PATH=/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/local/sbin:\$PATH; ollama serve"
      sleep 4
    fi

    if curl -sSf http://127.0.0.1:11434/api/tags >/dev/null; then
      echo "[remote] Ollama is live on remote"
    else
      echo "[remote] Ollama failed to start on remote"
      exit 1
    fi
  '
}

start_remote_tunnel() {
  echo "[remote] Opening tunnel localhost:${REMOTE_LOCAL_PORT} -> remote:11434"
  ssh -S "$SOCKET" -N \
    -L ${REMOTE_LOCAL_PORT}:127.0.0.1:11434 \
    "$REMOTE_HOST" &
  TUNNEL_PID=$!
  sleep 3

  if curl -sSf http://127.0.0.1:${REMOTE_LOCAL_PORT}/api/tags >/dev/null; then
    echo "[remote] Tunnel check passed"
  else
    echo "[remote] Tunnel check failed"
    exit 1
  fi
}

start_local_ollama() {
  LOCAL_PORT="$1"

  ensure_local_packages

  if ! tmux has-session -t ollama-local-${LOCAL_PORT} 2>/dev/null; then
    echo "[local] Starting local ollama on port ${LOCAL_PORT}"
    tmux new -d -s ollama-local-${LOCAL_PORT} "export PATH=/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/local/sbin:\$PATH; export OLLAMA_HOST=127.0.0.1:${LOCAL_PORT}; ollama serve"
    sleep 4
  fi

  if curl -sSf http://127.0.0.1:${LOCAL_PORT}/api/tags >/dev/null; then
    echo "[local] Local Ollama check passed on port ${LOCAL_PORT}"
  else
    echo "[local] Local Ollama check failed on port ${LOCAL_PORT}"
    exit 1
  fi
}

cleanup() {
  if [ -n "$TUNNEL_PID" ]; then
    kill "$TUNNEL_PID" 2>/dev/null || true
  fi
  if [ -n "$CAFF_PID" ]; then
    kill "$CAFF_PID" 2>/dev/null || true
  fi
  stop_master_ssh
}

trap cleanup EXIT INT TERM

caffeinate -dimsu &
CAFF_PID=$!

if [ "$MODE" = "remote" ] || [ "$MODE" = "both" ]; then
  start_master_ssh
fi

if [ "$MODE" = "remote" ]; then
  start_remote_ollama
  start_remote_tunnel
  echo "Remote Ollama available at http://127.0.0.1:${REMOTE_LOCAL_PORT}"
fi

if [ "$MODE" = "local" ]; then
  start_local_ollama "${LOCAL_ONLY_PORT}"
  echo "Local Ollama available at http://127.0.0.1:${LOCAL_ONLY_PORT}"
fi

if [ "$MODE" = "both" ]; then
  start_remote_ollama
  start_remote_tunnel
  start_local_ollama "${LOCAL_BOTH_PORT}"
  echo "Remote Ollama available at http://127.0.0.1:${REMOTE_LOCAL_PORT}"
  echo "Local Ollama available at http://127.0.0.1:${LOCAL_BOTH_PORT}"
fi

echo ""
echo "Git workflow reminder:"
echo "1. git pull --rebase"
echo "2. use Claude for planning and hard tasks"
echo "3. use Ollama only for small bounded tasks"
echo "4. smoke test"
echo "5. commit every few minutes or each landed file"
echo "6. git push after every commit"
echo ""

echo "Claude should do:"
echo "- planning"
echo "- architecture"
echo "- multi-file refactors"
echo "- auth / permissions"
echo "- state machine reasoning"
echo "- risky debugging"
echo ""

echo "Ollama should do:"
echo "- small bounded edits"
echo "- single-file changes"
echo "- boilerplate"
echo "- repetitive cleanup"
echo "- summaries"
echo "- first-pass drafts"
echo ""

echo "If the MacBook sleeps:"
echo "- local jobs stop"
echo "- SSH tunnel stops"
echo "- Mac mini tmux process keeps running"
echo ""

END=$(( $(date +%s) + MINUTES * 60 ))

while true; do
  NOW=$(date +%s)
  REM=$(( END - NOW ))
  if [ "$REM" -le 0 ]; then
    break
  fi
  printf "\rRemaining %d sec" "$REM"
  sleep 1
done

echo ""
echo "Done"
echo "Remote Ollama on the Mac mini stays running inside tmux."