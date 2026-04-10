#!/bin/bash

set -e

REMOTE_HOST="vishwajeet@100.115.176.118"
REMOTE_REPO="~/Scheduler/Main"
LOCAL_PORT="11434"
SOCKET="/tmp/macmini-ollama-ssh.sock"
MINUTES="${1:-120}"
MODEL="${2:-llama3}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CHAT_DIR="$SCRIPT_DIR/ollama_chats"
mkdir -p "$CHAT_DIR"
LOG_FILE="$CHAT_DIR/remote_chat.log"

case "$MINUTES" in
  ''|*[!0-9]*)
    echo "Error: minutes must be a non-negative integer"
    echo "Usage: $0 [minutes] [model]"
    exit 1
    ;;
esac

start_master_ssh() {
  rm -f "$SOCKET"
  ssh -M -S "$SOCKET" -fnNT "$REMOTE_HOST"
  if [ ! -S "$SOCKET" ]; then
    echo "Failed to create SSH control socket"
    exit 1
  fi
}

remote_ssh() {
  ssh -S "$SOCKET" "$REMOTE_HOST" "$@"
}

stop_master_ssh() {
  if [ -S "$SOCKET" ]; then
    ssh -S "$SOCKET" -O exit "$REMOTE_HOST" >/dev/null 2>&1 || true
    rm -f "$SOCKET"
  fi
}

ensure_remote_server() {
  remote_ssh "
    export PATH=/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/local/sbin:\$PATH
    if ! command -v brew >/dev/null 2>&1; then
      NONINTERACTIVE=1 /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"
    fi
    command -v tmux >/dev/null 2>&1 || brew install tmux
    command -v ollama >/dev/null 2>&1 || brew install ollama
    mkdir -p $REMOTE_REPO
    cd $REMOTE_REPO
    git pull --rebase || true
    if ! tmux has-session -t ollama 2>/dev/null; then
      tmux new -d -s ollama \"export PATH=/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/local/sbin:\\\$PATH; ollama serve\"
      sleep 4
    fi
    curl -sSf http://127.0.0.1:11434/api/tags >/dev/null
  "
}

start_tunnel() {
  ssh -S "$SOCKET" -N -L ${LOCAL_PORT}:127.0.0.1:11434 "$REMOTE_HOST" &
  TUNNEL_PID=$!
  sleep 3
  curl -sSf http://127.0.0.1:${LOCAL_PORT}/api/tags >/dev/null
}

cleanup() {
  if [ -n "${TUNNEL_PID:-}" ]; then
    kill "$TUNNEL_PID" 2>/dev/null || true
  fi
  if [ -n "${CAFF_PID:-}" ]; then
    kill "$CAFF_PID" 2>/dev/null || true
  fi
  stop_master_ssh
}
trap cleanup EXIT INT TERM

caffeinate -dimsu &
CAFF_PID=$!

start_master_ssh
ensure_remote_server
start_tunnel

END_TS=$(( $(date +%s) + MINUTES * 60 ))

echo ""
echo "Remote repo chat ready"
echo "Repo on Mac mini: $REMOTE_REPO"
echo "Endpoint: http://127.0.0.1:${LOCAL_PORT}"
echo "Model: $MODEL"
echo "Log: $LOG_FILE"
echo "Commands:"
echo "  /exit"
echo "  /show"
echo "  /time"
echo "  /pull   sync remote repo on Mac mini"
echo ""

while true; do
  NOW_TS=$(date +%s)
  REMAINING=$(( END_TS - NOW_TS ))
  if [ "$REMAINING" -le 0 ]; then
    echo ""
    echo "Session expired"
    break
  fi

  printf "remote> "
  IFS= read -r PROMPT || break

  if [ "$PROMPT" = "/exit" ]; then
    break
  fi

  if [ "$PROMPT" = "/show" ]; then
    echo ""
    cat "$LOG_FILE" 2>/dev/null || true
    echo ""
    continue
  fi

  if [ "$PROMPT" = "/time" ]; then
    echo ""
    echo "Remaining seconds: $REMAINING"
    echo ""
    continue
  fi

  if [ "$PROMPT" = "/pull" ]; then
    remote_ssh "cd $REMOTE_REPO && git pull --rebase"
    echo "Remote repo updated"
    continue
  fi

  if [ -z "$PROMPT" ]; then
    continue
  fi

  TS="$(date '+%Y-%m-%d %H:%M:%S')"
  printf "[%s] you: %s\n" "$TS" "$PROMPT" >> "$LOG_FILE"

  RESPONSE="$(curl -sS "http://127.0.0.1:${LOCAL_PORT}/api/generate" \
    -H "Content-Type: application/json" \
    -d "{\"model\":\"$MODEL\",\"prompt\":$(printf '%s' "$PROMPT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))'),\"stream\":false}" \
    | python3 -c 'import sys,json; print(json.load(sys.stdin).get("response",""))')"

  echo ""
  echo "ollama> $RESPONSE"
  echo ""

  printf "[%s] ollama: %s\n\n" "$TS" "$RESPONSE" >> "$LOG_FILE"
done

echo "Remote chat closed"