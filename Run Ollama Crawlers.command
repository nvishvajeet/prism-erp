#!/bin/bash
#
# Run Ollama Crawlers.command
# ---------------------------
# Double-click this file in Finder to launch unattended Ollama-based
# QA crawls against PRISM. It:
#
#   1. Ensures a local `ollama serve` is running on 127.0.0.1:11435
#      (a non-default port so it does not collide with the Mac mini
#      SSH tunnel on 11434).
#   2. Verifies llama3:latest is pulled locally.
#   3. Runs the `ollama_observer` crawler on a loop, sleeping
#      between runs, until you close the Terminal window or press
#      Ctrl-C.
#   4. Every run appends structured findings to:
#        - ollama_observations.md       (human-readable, checked in)
#        - ollama_outputs/*.jsonl       (machine-readable, gitignored)
#
# HOW LONG TO RUN
# ---------------
#   Fast profile  (OLLAMA_OBSERVER_FAST=1) →  8 pages  / ~30 s per run
#   Full profile  (default)                → 40 pages  / ~3 min per run
#
#   Recommended deployments:
#     • 10 min smoke            → 3 full runs or 20 fast runs
#     • 1 hour light coverage   → 20 full runs (the default loop)
#     • Overnight (~8 hours)    → ~160 full runs = ~6,400 observations
#
# The loop is intentionally simple: fire, sleep, fire again. A
# single Ctrl-C or window-close stops it cleanly.
#
# SAFETY
# ------
# The crawler only READS from PRISM via the in-process Flask test
# client. It does not talk to the Mac mini, does not modify any
# code or database, and does not push anything to git. Everything
# it writes goes to ollama_observations.md and ollama_outputs/.
#
# You can keep working on master while this runs — it does not
# touch files other than the log outputs.

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

OLLAMA_PORT="${OLLAMA_PORT:-11435}"
OLLAMA_HOST_URL="http://127.0.0.1:${OLLAMA_PORT}"
MODEL="${OLLAMA_MODEL:-llama3:latest}"

# Profile: "fast" (8 pages, ~30 s) or "full" (40 pages, ~3 min).
# Override on the command line: OLLAMA_OBSERVER_PROFILE=fast ./Run\ Ollama\ Crawlers.command
PROFILE="${OLLAMA_OBSERVER_PROFILE:-full}"

# Seconds to sleep between runs so we do not peg the MacBook CPU.
SLEEP_BETWEEN="${OLLAMA_OBSERVER_SLEEP:-30}"

echo "======================================================"
echo "  PRISM — Ollama Observer Crawler"
echo "======================================================"
echo "  Profile:      $PROFILE"
echo "  Model:        $MODEL"
echo "  Ollama:       $OLLAMA_HOST_URL"
echo "  Sleep/run:    ${SLEEP_BETWEEN}s"
echo "  Findings →   ollama_observations.md (appended each run)"
echo "  Raw JSONL →  ollama_outputs/observer_<ts>.jsonl"
echo "  Stop with:   Ctrl-C or close this window"
echo "======================================================"
echo

# ── 1. Make sure local ollama serve is running on $OLLAMA_PORT ──
if ! curl -sSf "${OLLAMA_HOST_URL}/api/tags" >/dev/null 2>&1; then
  echo "[setup] Local Ollama not reachable on port $OLLAMA_PORT."
  if ! command -v ollama >/dev/null 2>&1; then
    echo "[setup] FATAL: 'ollama' binary not found on PATH."
    echo "[setup] Install from https://ollama.com or 'brew install ollama'."
    read -r -p "Press Return to close this window…"
    exit 1
  fi
  mkdir -p logs
  echo "[setup] Starting 'OLLAMA_HOST=127.0.0.1:${OLLAMA_PORT} ollama serve' in the background…"
  OLLAMA_HOST="127.0.0.1:${OLLAMA_PORT}" nohup ollama serve \
    >> "logs/ollama_local.log" 2>&1 &
  OLLAMA_PID=$!
  echo "[setup]   PID: $OLLAMA_PID"
  # Give it a moment to come up
  for i in 1 2 3 4 5 6 7 8 9 10; do
    sleep 1
    if curl -sSf "${OLLAMA_HOST_URL}/api/tags" >/dev/null 2>&1; then
      echo "[setup] Local Ollama up after ${i}s."
      break
    fi
  done
  if ! curl -sSf "${OLLAMA_HOST_URL}/api/tags" >/dev/null 2>&1; then
    echo "[setup] FATAL: Local Ollama never came up. Check logs/ollama_local.log."
    read -r -p "Press Return to close this window…"
    exit 1
  fi
else
  echo "[setup] Local Ollama already up."
fi

# ── 2. Make sure llama3 is actually pulled ──
if ! curl -sS "${OLLAMA_HOST_URL}/api/tags" | grep -q "${MODEL%:*}"; then
  echo "[setup] Model '$MODEL' not found locally. Pulling (this takes a while the first time)…"
  OLLAMA_HOST="127.0.0.1:${OLLAMA_PORT}" ollama pull "$MODEL" || {
    echo "[setup] FATAL: pull failed."
    read -r -p "Press Return to close this window…"
    exit 1
  }
fi

# ── 3. Make sure the venv exists ──
if [ ! -x venv/bin/python3 ]; then
  echo "[setup] venv/bin/python3 not found. Creating venv…"
  /usr/bin/python3 -m venv venv
  venv/bin/pip install -q flask flask-wtf openpyxl || {
    echo "[setup] FATAL: pip install failed."
    read -r -p "Press Return to close this window…"
    exit 1
  }
fi

# ── 4. Loop the crawler ──
echo
echo "[loop] Starting observer crawls. Ctrl-C to stop."
echo

RUN=0
while true; do
  RUN=$((RUN + 1))
  STAMP="$(date +%H:%M:%S)"
  echo "────────── Run #${RUN}  ${STAMP} ──────────"
  if [ "$PROFILE" = "fast" ]; then
    OLLAMA_OBSERVER_FAST=1 venv/bin/python3 -m crawlers run ollama_observer \
      || echo "[loop] Run #${RUN} exited non-zero (warnings are normal)"
  else
    venv/bin/python3 -m crawlers run ollama_observer \
      || echo "[loop] Run #${RUN} exited non-zero (warnings are normal)"
  fi
  echo
  echo "[loop] Sleeping ${SLEEP_BETWEEN}s before next run…"
  sleep "$SLEEP_BETWEEN"
done
