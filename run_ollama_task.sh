#!/bin/bash

set -e

FILE_PATH="$1"
TARGET="${2:-local}"
INSTRUCTION="$3"
MODEL="${4:-llama3}"

if [ -z "$FILE_PATH" ] || [ -z "$INSTRUCTION" ]; then
  echo "Usage: $0 <file> <local|remote> <instruction>"
  exit 1
fi

case "$TARGET" in
  remote) URL="http://127.0.0.1:11434" ;;
  local)  URL="http://127.0.0.1:11435" ;;
  *) echo "target must be local or remote"; exit 1 ;;
esac

mkdir -p ollama_outputs

OUT="ollama_outputs/$(basename "$FILE_PATH").$TARGET.$(date +%s).txt"

PROMPT="$(cat <<PROMPT
You are working on a Flask lab scheduler repo.

Rules:
- DO NOT invent architecture
- ONLY use given file
- give SMALL safe tasks

Instruction:
$INSTRUCTION

File:
$(cat "$FILE_PATH")
PROMPT
)"

curl -s "$URL/api/generate" \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"$MODEL\",\"prompt\":$(printf '%s' "$PROMPT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))'),\"stream\":false}" \
| python3 -c 'import sys,json; print(json.load(sys.stdin).get("response",""))' \
> "$OUT"

echo "OUTPUT -> $OUT"
cat "$OUT"
