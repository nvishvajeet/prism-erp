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
STATE_FILE="${CATALYST_VERIFY_STATE_FILE:-$ROOT_DIR/logs/deploy-verify.state}"

BARE_GIT_DIR="${CATALYST_VERIFY_BARE_GIT_DIR:-$HOME/git/lab-scheduler.git}"
BRANCH="${CATALYST_VERIFY_BRANCH:-v1.3.0-stable-release}"
SERVICE_LABEL="${CATALYST_VERIFY_SERVICE_LABEL:-local.catalyst}"
VERIFY_URL="${CATALYST_VERIFY_URL:-https://127.0.0.1:5055/api/health-check}"
FORCE_SYNC_INTERVAL="${CATALYST_VERIFY_FORCE_SYNC_INTERVAL:-86400}"
ALERT_COOLDOWN="${CATALYST_VERIFY_ALERT_COOLDOWN:-3600}"

ts() { date '+%Y-%m-%d %H:%M:%S'; }

short_sha() {
  printf '%s' "${1:-}" | cut -c1-8
}

read_served_head() {
  local body=""
  if ! body="$(curl -kfsS --max-time 5 "$VERIFY_URL" 2>/dev/null)"; then
    return 1
  fi
  python3 -c 'import json,sys; data=json.loads(sys.stdin.read()); print((data.get("git_head") or "").strip())' <<<"$body"
}

read_last_force_sync() {
  [ -f "$STATE_FILE" ] || { echo 0; return; }
  awk -F= '$1=="last_force_sync"{print $2}' "$STATE_FILE" 2>/dev/null | tail -n 1
}

write_last_force_sync() {
  printf 'last_force_sync=%s\n' "$(date +%s)" >"$STATE_FILE"
}

read_last_alert() {
  [ -f "$STATE_FILE" ] || { echo 0; return; }
  awk -F= '$1=="last_alert"{print $2}' "$STATE_FILE" 2>/dev/null | tail -n 1
}

write_last_alert() {
  local last_force_sync="0"
  if [ -f "$STATE_FILE" ]; then
    last_force_sync="$(awk -F= '$1=="last_force_sync"{print $2}' "$STATE_FILE" 2>/dev/null | tail -n 1)"
  fi
  printf 'last_force_sync=%s\nlast_alert=%s\n' "${last_force_sync:-0}" "$(date +%s)" >"$STATE_FILE"
}

send_alert() {
  local subject="$1"
  local body="$2"
  if [ ! -x "$ROOT_DIR/.venv/bin/python" ]; then
    return 1
  fi
  "$ROOT_DIR/.venv/bin/python" "$ROOT_DIR/scripts/send_server_alert.py" "$subject" "$body" >>"$LOG_FILE" 2>&1 || return 1
  write_last_alert
}

attempt_force_sync() {
  {
    echo "[$(ts)] force-sync starting"
  } >>"$LOG_FILE"
  git fetch origin "$BRANCH" >>"$LOG_FILE" 2>&1 || return 1
  git reset --hard "origin/$BRANCH" >>"$LOG_FILE" 2>&1 || return 1
  write_last_force_sync
  {
    echo "[$(ts)] force-sync completed"
  } >>"$LOG_FILE"
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

if [ "$recovered" -eq 0 ]; then
  now_epoch="$(date +%s)"
  last_force_sync="$(read_last_force_sync)"
  case "$last_force_sync" in
    ''|*[!0-9]*) last_force_sync=0 ;;
  esac
  if [ $((now_epoch - last_force_sync)) -ge "$FORCE_SYNC_INTERVAL" ]; then
    {
      echo "[$(ts)] drift persisted — attempting daily force-sync fallback"
    } >>"$LOG_FILE"
    if attempt_force_sync; then
      launchctl kickstart -k "gui/$(id -u)/$SERVICE_LABEL" >>"$LOG_FILE" 2>&1 || true
      sleep 3
      worktree_head="$(git rev-parse HEAD 2>/dev/null || true)"
      served_head="$(read_served_head || true)"
      if [ -n "$bare_head" ] && [ "$bare_head" = "$worktree_head" ] && [ "$worktree_head" = "$served_head" ]; then
        {
          echo "[$(ts)] force-sync RECOVERED"
        } >>"$LOG_FILE"
      else
        {
          echo "[$(ts)] force-sync FAILED bare=$(short_sha "$bare_head") worktree=$(short_sha "$worktree_head") served=$(short_sha "$served_head")"
        } >>"$LOG_FILE"
      fi
    else
      {
        echo "[$(ts)] force-sync FAILED to execute"
      } >>"$LOG_FILE"
    fi
  fi
fi

final_ok=0
[ -n "$bare_head" ] && [ "$bare_head" = "$worktree_head" ] && [ "$worktree_head" = "$served_head" ] && final_ok=1
if [ "$final_ok" -eq 0 ]; then
  now_epoch="$(date +%s)"
  last_alert="$(read_last_alert)"
  case "$last_alert" in
    ''|*[!0-9]*) last_alert=0 ;;
  esac
  if [ $((now_epoch - last_alert)) -ge "$ALERT_COOLDOWN" ]; then
    alert_subject="CATALYST mini alert: deploy drift or server down"
    alert_body="Catalyst verifier detected drift or an unavailable live server on the Mac mini.\n\nbare: $bare_head\nworktree: $worktree_head\nserved: $served_head\nservice: $SERVICE_LABEL\nurl: $VERIFY_URL\nhost: $(hostname)\ntime: $(ts)\n"
    if send_alert "$alert_subject" "$alert_body"; then
      {
        echo "[$(ts)] alert email sent"
      } >>"$LOG_FILE"
    else
      {
        echo "[$(ts)] alert email failed or is not configured"
      } >>"$LOG_FILE"
    fi
  fi
fi

exit 0
