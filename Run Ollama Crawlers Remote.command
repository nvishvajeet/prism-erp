#!/bin/bash
#
# Run Ollama Crawlers Remote.command
# ----------------------------------
# Double-click to launch the same Ollama observer loop on the Mac
# mini over Tailscale SSH. The mini already has the repo cloned
# at ~/Scheduler/Main and its own local Ollama. This script:
#
#   1. Opens an interactive SSH session to vishwajeet@100.115.176.118.
#      You will be prompted once for the password (or sudo if the
#      SSH key is not yet authorized).
#   2. Once on the mini, it cd's into the repo, pulls latest master,
#      starts local ollama serve on 127.0.0.1:11435 if not already
#      up, and runs the observer crawl on a loop.
#   3. Every run appends findings to ollama_observations.md on the
#      mini's clone, commits with the message prefix
#      `ollama-remote:`, and pushes back to the same bare git remote
#      that the MacBook uses. You will see the commits appear on
#      master next time the MacBook pulls.
#
# Designed to run simultaneously with Run Ollama Crawlers.command
# on the laptop — both machines write to the same ollama_observations.md
# and the git merges are trivial (append-only markdown).
#
# HOW TO STOP: close the Terminal window or Ctrl-C the SSH session.
# The remote loop exits cleanly on SIGHUP.

set -u

REMOTE_USER="${REMOTE_USER:-vishwajeet}"
REMOTE_HOST="${REMOTE_HOST:-100.115.176.118}"
REMOTE_PATH="${REMOTE_PATH:-~/Scheduler/Main}"
PROFILE="${OLLAMA_OBSERVER_PROFILE:-full}"
SLEEP_BETWEEN="${OLLAMA_OBSERVER_SLEEP:-30}"

echo "======================================================"
echo "  PRISM — Ollama Observer (REMOTE Mac mini)"
echo "======================================================"
echo "  Host:       $REMOTE_USER@$REMOTE_HOST"
echo "  Path:       $REMOTE_PATH"
echo "  Profile:    $PROFILE"
echo "  Sleep/run:  ${SLEEP_BETWEEN}s"
echo "  Stop with:  Ctrl-C"
echo "======================================================"
echo

# The remote command runs the loop, commits after each run, pushes.
# Use Apple's /usr/bin/ssh because Homebrew ssh dropped UseKeychain.
SSH_BIN="${SSH_BIN:-/usr/bin/ssh}"

REMOTE_CMD="set -u
cd ${REMOTE_PATH}
git pull --rebase --quiet || echo '[warn] git pull failed, continuing'

# Make sure local ollama serve is up on 11435 on the mini
if ! curl -sSf http://127.0.0.1:11435/api/tags >/dev/null 2>&1; then
  mkdir -p logs
  OLLAMA_HOST=127.0.0.1:11435 nohup ollama serve >> logs/ollama_mini.log 2>&1 &
  sleep 3
fi

# Make sure the venv exists
if [ ! -x venv/bin/python3 ]; then
  /usr/bin/python3 -m venv venv
  venv/bin/pip install -q flask flask-wtf openpyxl
fi

# Identify commits as coming from the mini so the merged log is clear
git config user.name  'PRISM Mac mini'  || true
git config user.email 'mini@lab.local'  || true

RUN=0
while true; do
  RUN=\$((RUN + 1))
  echo \"────────── remote run #\${RUN}  \$(date +%H:%M:%S) ──────────\"
  if [ '${PROFILE}' = 'fast' ]; then
    OLLAMA_OBSERVER_FAST=1 venv/bin/python3 -m crawlers run ollama_observer \
      || echo '[loop] run exited non-zero (warnings are normal)'
  else
    venv/bin/python3 -m crawlers run ollama_observer \
      || echo '[loop] run exited non-zero (warnings are normal)'
  fi
  git add ollama_observations.md ollama_outputs/ 2>/dev/null || true
  if ! git diff --cached --quiet; then
    git commit -q -m \"ollama-remote: observer run #\${RUN}\" || true
    git push --quiet origin master:main || echo '[warn] push failed'
  fi
  echo \"[loop] Sleeping ${SLEEP_BETWEEN}s…\"
  sleep ${SLEEP_BETWEEN}
done
"

echo "[ssh] Connecting to ${REMOTE_USER}@${REMOTE_HOST}…"
echo "[ssh] Enter the password if prompted."
echo
exec "$SSH_BIN" -t "${REMOTE_USER}@${REMOTE_HOST}" "bash -lc \"${REMOTE_CMD}\""
