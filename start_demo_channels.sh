#!/bin/bash
# ------------------------------------------------------------------
# start_demo_channels.sh — local three-channel demo launcher
#
# Boots stable/beta/alpha demo instances side-by-side so the topbar
# flip switch can hop between them:
#   stable → https://localhost:5055  (worktree: Main/,      branch: v1.3.0-stable-release)
#   beta   → https://localhost:5057  (worktree: Demo-Beta/,  branch: v2.0.0-beta)
#   alpha  → https://localhost:5058  (worktree: Demo-Alpha/, branch: v2.0.0-alpha)
#
# Does NOT touch :5056 (live — catalysterp.org via Cloudflare tunnel).
# Each instance has its own data/ dir inside its own worktree, so the
# three DBs never collide.
# ------------------------------------------------------------------
set -u

SCHED_ROOT="/Users/vishvajeetn/Documents/Scheduler"
VENV_GUNICORN="$SCHED_ROOT/Main/.venv/bin/gunicorn"

VARIANT_URLS="stable=https://localhost:5055,beta=https://localhost:5057,alpha=https://localhost:5058"

declare -a CHANNELS=(
  "stable:5055:$SCHED_ROOT/Main"
  "beta:5057:$SCHED_ROOT/Demo-Beta"
  "alpha:5058:$SCHED_ROOT/Demo-Alpha"
)

echo "=============================================="
echo "  CATALYST demo channels launcher"
echo "=============================================="

for entry in "${CHANNELS[@]}"; do
  IFS=':' read -r variant port workdir <<< "$entry"
  echo
  echo "--- $variant :: port $port :: $workdir ---"

  if [ ! -f "$workdir/lab_erp_app.py" ]; then
    echo "  [skip] lab_erp_app.py not found in $workdir"
    continue
  fi

  existing=$(lsof -ti ":$port" 2>/dev/null || true)
  if [ -n "$existing" ]; then
    echo "  stopping existing PID(s) on :$port → $existing"
    kill $existing 2>/dev/null || true
    sleep 1
    stuck=$(lsof -ti ":$port" 2>/dev/null || true)
    if [ -n "$stuck" ]; then
      echo "  force-killing $stuck"
      kill -9 $stuck 2>/dev/null || true
      sleep 1
    fi
  fi

  mkdir -p "$workdir/logs"
  log="$workdir/logs/server.log"

  pushd "$workdir" > /dev/null

  if [ ! -f cert.pem ] || [ ! -f key.pem ]; then
    echo "  [skip] cert.pem / key.pem missing in $workdir"
    popd > /dev/null
    continue
  fi

  LAB_SCHEDULER_DEMO_MODE=1 \
  CATALYST_DEMO_VARIANT="$variant" \
  CATALYST_DEMO_VARIANT_URLS="$VARIANT_URLS" \
  "$VENV_GUNICORN" lab_erp_app:app \
    -w 4 \
    -b "127.0.0.1:$port" \
    --certfile cert.pem \
    --keyfile key.pem \
    --access-logfile "$log" \
    --error-logfile "$log" \
    --daemon

  rc=$?
  popd > /dev/null
  if [ $rc -eq 0 ]; then
    echo "  started → https://localhost:$port   (log: $log)"
  else
    echo "  FAILED to start (exit $rc) — check $log"
  fi
done

echo
echo "Live site (:5056) left untouched."
echo "=============================================="
echo "  All three channels launched. URLs:"
echo "    stable → https://localhost:5055"
echo "    beta   → https://localhost:5057"
echo "    alpha  → https://localhost:5058"
echo "=============================================="
