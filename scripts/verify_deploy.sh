#!/bin/bash
# CATALYST mini deploy verifier
#
# Purpose:
#   Run frequently on the Mac mini to confirm the live service is
#   actually serving the same commit that landed in the bare repo.
#   If drift is detected, kickstart the launchd service and re-check.
#
# What it compares:
#   1. bare repo branch HEAD
#   2. checked-out worktree HEAD
#   3. /api/health-check reported git_head

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

LOG_FILE="${CATALYST_VERIFY_LOG:-$ROOT_DIR/logs/deploy-verify.log}"
mkdir -p "$(dirname "$LOG_FILE")"

BARE_GIT_DIR="${CATALYST_VERIFY_BARE_GIT_DIR:-$HOME/git/lab-scheduler.git}"
BRANCH="${CATALYST_VERIFY_BRANCH:-v1.3.0-stable-release}"
SERVICE_LABEL="${CATALYST_VERIFY_SERVICE_LABEL:-local.catalyst}"
VERIFY_URL="${CATALYST_VERIFY_URL:-http://127.0.0.1:5055/api/health-check}"

ts() { date '+%Y-%m-%d %H:%M:%S'; }

short_sha() {
  printf '%s' "${1:-}" | cut -c1-8
}

read_served_head() {
  local body=""
  if ! body="$(curl -fsS --max-time 5 "$VERIFY_URL" 2>/dev/null)"; then
    return 1
  fi
  python3 -c 'import json,sys; data=json.loads(sys.stdin.read()); print((data.get("git_head") or "").strip())' <<<"$body"
}

bare_head=""
worktree_head=""
served_head=""
bare_head="$(git --git-dir="$BARE_GIT_DIR" rev-parse "refs/heads/$BRANCH" 2>/dev/null || true)"
worktree_head="$(git rev-parse HEAD 2>/dev/null || true)"
served_head="$(read_served_head || true)"

mismatch=0
[ -n "$bare_head" ] || mismatch=1
[ -n "$worktree_head" ] || mismatch=1
[ -n "$served_head" ] || mismatch=1
[ "$bare_head" = "$worktree_head" ] || mismatch=1
[ "$worktree_head" = "$served_head" ] || mismatch=1

{
  echo "[$(ts)] verify bare=$(short_sha "$bare_head") worktree=$(short_sha "$worktree_head") served=$(short_sha "$served_head")"
} >>"$LOG_FILE"

if [ "$mismatch" -eq 0 ]; then
  {
    echo "[$(ts)] verify OK"
  } >>"$LOG_FILE"
  exit 0
fi

{
  echo "[$(ts)] drift detected — kickstarting $SERVICE_LABEL"
} >>"$LOG_FILE"

launchctl kickstart -k "gui/$(id -u)/$SERVICE_LABEL" >>"$LOG_FILE" 2>&1 || true
sleep 3

worktree_head="$(git rev-parse HEAD 2>/dev/null || true)"
served_head="$(read_served_head || true)"
recovered=0
[ -n "$bare_head" ] && [ "$bare_head" = "$worktree_head" ] && [ "$worktree_head" = "$served_head" ] && recovered=1

{
  echo "[$(ts)] post-kick bare=$(short_sha "$bare_head") worktree=$(short_sha "$worktree_head") served=$(short_sha "$served_head")"
  if [ "$recovered" -eq 1 ]; then
    echo "[$(ts)] verify RECOVERED"
  else
    echo "[$(ts)] verify STILL DRIFTING"
  fi
} >>"$LOG_FILE"

exit 0
