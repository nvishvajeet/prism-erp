#!/bin/bash
#
# run_ollama_task.sh — sandboxed Ollama task driver.
#
# Reads a Markdown task spec, sends it to local / remote / dual
# Ollama, captures the output, and (optionally) commits the
# result to the `ollama-work` branch. NEVER touches master.
#
# Usage:
#   ./run_ollama_task.sh [--mode=local|remote|dual] [--commit] \
#                        [--model=llama3] <task_spec.md>
#
# Defaults: --mode=remote, no auto-commit.
#
# Read OLLAMA_DEV_PLAN.md before running. Especially §3 (the
# branch sandbox model) and §5 (task spec format).
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# ---- defaults ------------------------------------------------
MODE="remote"
MODEL="llama3"
COMMIT=0
TASK_SPEC=""
LOCAL_URL="http://127.0.0.1:11435"
REMOTE_URL="http://127.0.0.1:11434"
SANDBOX_BRANCH="ollama-work"

# ---- arg parsing ---------------------------------------------
while [ $# -gt 0 ]; do
  case "$1" in
    --mode=*)   MODE="${1#--mode=}" ;;
    --model=*)  MODEL="${1#--model=}" ;;
    --commit)   COMMIT=1 ;;
    --branch=*) SANDBOX_BRANCH="${1#--branch=}" ;;
    -h|--help)
      sed -n '2,18p' "$0"
      exit 0
      ;;
    -*)
      echo "Unknown flag: $1" >&2
      exit 2
      ;;
    *)
      TASK_SPEC="$1"
      ;;
  esac
  shift
done

if [ -z "$TASK_SPEC" ]; then
  echo "Usage: $0 [--mode=local|remote|dual] [--commit] [--model=llama3] <task_spec.md>" >&2
  exit 2
fi

if [ ! -f "$TASK_SPEC" ]; then
  echo "Task spec not found: $TASK_SPEC" >&2
  exit 2
fi

case "$MODE" in
  local|remote|dual) ;;
  *) echo "--mode must be local, remote, or dual" >&2; exit 2 ;;
esac

# ---- safety: refuse to run on master / main ------------------
CURRENT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "DETACHED")
if [ "$CURRENT_BRANCH" = "master" ] || [ "$CURRENT_BRANCH" = "main" ]; then
  if [ "$COMMIT" = "1" ]; then
    echo ""
    echo "Refusing to run with --commit on '$CURRENT_BRANCH'."
    echo "Switching to '$SANDBOX_BRANCH' is required."
    if ! git show-ref --verify --quiet "refs/heads/$SANDBOX_BRANCH"; then
      echo "Branch '$SANDBOX_BRANCH' does not exist. Create it with:"
      echo "  git branch $SANDBOX_BRANCH"
      exit 3
    fi
    git stash --include-untracked --quiet || true
    git checkout "$SANDBOX_BRANCH"
    trap 'git checkout "'"$CURRENT_BRANCH"'" 2>/dev/null; git stash pop --quiet 2>/dev/null || true' EXIT
  fi
fi

# ---- working dirs --------------------------------------------
mkdir -p ollama_outputs ollama_tasks

TASK_NAME=$(basename "$TASK_SPEC" .md)
TS=$(date +%Y%m%d-%H%M%S)
OUT_DIR="ollama_outputs/${TASK_NAME}_${TS}"
mkdir -p "$OUT_DIR"

# ---- prompt assembly -----------------------------------------
PROMPT_FILE="$OUT_DIR/prompt.txt"
{
  echo "You are a code assistant working inside the PRISM Flask"
  echo "lab scheduler repo. You will receive a task spec in"
  echo "Markdown. Follow it exactly."
  echo ""
  echo "Hard rules:"
  echo "  1. Touch ONLY the files listed under 'Files in scope'."
  echo "  2. Touch NONE of the files listed under 'Forbidden files'."
  echo "  3. Match existing code style. No reformatting."
  echo "  4. No commentary in your output. Code only, in unified"
  echo "     diff format (\`--- a/path\` / \`+++ b/path\` / @@ hunks)."
  echo "  5. If you cannot satisfy the acceptance criteria, output"
  echo "     the single line: ABORT: <reason>"
  echo ""
  echo "===== TASK SPEC ====="
  cat "$TASK_SPEC"
  echo ""
  echo "===== REPO CONTEXT (truncated) ====="
  echo ""
  echo "--- README.md (first 80 lines) ---"
  head -n 80 README.md 2>/dev/null || true
  echo ""
  echo "--- PROJECT.md §11 / §12 markers ---"
  grep -n -A 2 "^## 11\|^## 12" PROJECT.md 2>/dev/null || true
} > "$PROMPT_FILE"

# ---- one-shot send -------------------------------------------
send_to() {
  local url="$1" tag="$2"
  local out="$OUT_DIR/response.$tag.txt"
  echo "  -> $tag ($url)"
  if ! curl -sSf "$url/api/tags" >/dev/null 2>&1; then
    echo "     endpoint unreachable; skipping" >&2
    echo "ENDPOINT_UNREACHABLE" > "$out"
    return 1
  fi
  curl -sS "$url/api/generate" \
    -H "Content-Type: application/json" \
    -d "$(python3 -c '
import json, sys
prompt = open(sys.argv[1]).read()
print(json.dumps({"model": sys.argv[2], "prompt": prompt, "stream": False}))
' "$PROMPT_FILE" "$MODEL")" \
  | python3 -c '
import sys, json
try:
  d = json.load(sys.stdin)
except Exception as e:
  print("PARSE_ERROR:", e); sys.exit(1)
print(d.get("response") or d.get("error") or json.dumps(d))
' > "$out"
  echo "     wrote $out ($(wc -c < "$out") bytes)"
}

echo "==> task: $TASK_NAME"
echo "==> mode: $MODE  model: $MODEL  commit: $COMMIT"

case "$MODE" in
  local)  send_to "$LOCAL_URL"  local  || true ;;
  remote) send_to "$REMOTE_URL" remote || true ;;
  dual)
    send_to "$LOCAL_URL"  local  || true
    send_to "$REMOTE_URL" remote || true
    ;;
esac

# ---- acceptance check stub -----------------------------------
# Real acceptance criteria live in the task spec. The driver
# extracts the lines under "## Acceptance criteria (grep-able)"
# that look like shell commands and runs them. Failure means
# rollback.
#
# For now we surface the response files; the human (or Claude
# on resume) reviews them. Auto-apply lands when at least one
# task spec has been validated end-to-end.

echo ""
echo "==> output dir: $OUT_DIR"
ls -la "$OUT_DIR"

if [ "$COMMIT" = "1" ]; then
  echo ""
  echo "==> COMMIT mode requested but auto-apply is not yet wired."
  echo "==> Review $OUT_DIR/response.*.txt manually, apply by hand,"
  echo "==> then 'git add -p && git commit -m \"ollama: $TASK_NAME\"'."
fi

echo ""
echo "Done."
