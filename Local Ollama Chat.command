#!/bin/bash

set -e

LOCAL_PORT="11435"
MINUTES="${1:-120}"
MODEL="${2:-llama3}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CHAT_DIR="$SCRIPT_DIR/ollama_chats"
mkdir -p "$CHAT_DIR"
LOG_FILE="$CHAT_DIR/local_chat.log"

case "$MINUTES" in
  ''|*[!0-9]*)
    echo "Error: minutes must be a non-negative integer"
    echo "Usage: $0 [minutes] [model]"
    exit 1
    ;;
esac

export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/local/sbin:$PATH"

if ! command -v brew >/dev/null 2>&1; then
  NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

command -v tmux >/dev/null 2>&1 || brew install tmux
command -v ollama >/dev/null 2>&1 || brew install ollama
command -v curl >/dev/null 2>&1 || { echo "curl missing locally"; exit 1; }

git pull --rebase || true

if ! tmux has-session -t ollama-local 2>/dev/null; then
  tmux new -d -s ollama-local "export PATH=/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/local/sbin:\$PATH; export OLLAMA_HOST=127.0.0.1:${LOCAL_PORT}; ollama serve"
  sleep 4
fi

curl -sSf http://127.0.0.1:${LOCAL_PORT}/api/tags >/dev/null

caffeinate -dimsu &
CAFF_PID=$!

cleanup() {
  if [ -n "${CAFF_PID:-}" ]; then
    kill "$CAFF_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

END_TS=$(( $(date +%s) + MINUTES * 60 ))

echo ""
echo "Local repo chat ready"
echo "Repo: $SCRIPT_DIR"
echo "Endpoint: http://127.0.0.1:${LOCAL_PORT}"
echo "Model: $MODEL"
echo "Log: $LOG_FILE"
echo "Commands:"
echo "  /exit"
echo "  /show"
echo "  /time"
echo "  /pull"
echo ""

while true; do
  NOW_TS=$(date +%s)
  REMAINING=$(( END_TS - NOW_TS ))
  if [ "$REMAINING" -le 0 ]; then
    echo ""
    echo "Session expired"
    break
  fi

  printf "local> "
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
    git pull --rebase || true
    echo "Local repo updated"
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

echo "Local chat closed"