#!/bin/bash
# ------------------------------------------------------------------
# start_erp_triad.sh — boot all three CATALYST ERP variants side-by-side
#
# Variants (from docs/ERP_DEMO_VARIANTS.md):
#   lab            → :5101   CATALYST Lab ERP demo
#   ravikiran_ops  → :5102   Ravikiran Operations ERP demo
#   compute        → :5103   CATALYST Compute ERP demo
#
# All three run from the SAME codebase (this Main/ working copy).
# They differ only in CATALYST_MODULES, CATALYST_DATA_DIR, and branding
# env vars. This is the module-propagation pattern in action — one
# commit, three ERPs updated on redeploy.
#
# See docs/ERP_DEMO_VARIANTS.md for the module bundles.
# See Sahajpur University repo's docs/MODULE_PROPAGATION.md for the
# cross-variant propagation model.
#
# Usage:
#   scripts/start_erp_triad.sh          # start all three
#   scripts/start_erp_triad.sh --stop   # stop all three
#   scripts/start_erp_triad.sh --status # show which are running
#
# Ports :5101-:5103 are reserved for this triad. Do not collide.
# :5055-:5058 are used by the version-channel launcher
# (start_demo_channels.sh) — orthogonal purpose.
# ------------------------------------------------------------------
set -u

SCHED_ROOT="/Users/vishvajeetn/Documents/Scheduler/Main"
VENV_PY="$SCHED_ROOT/.venv/bin/python"
DATA_ROOT="$SCHED_ROOT/data/demo_triad"

# Cross-variant URL map so the topbar pill can hop between them.
VARIANT_URLS="lab=http://127.0.0.1:5101,ravikiran_ops=http://127.0.0.1:5102,compute=http://127.0.0.1:5103"

# Module bundles lifted verbatim from docs/ERP_DEMO_VARIANTS.md.
declare -a VARIANTS=(
  "lab:5101:instruments,finance,inbox,notifications,attendance,queue,calendar,stats,admin:CATALYST Lab ERP"
  "ravikiran_ops:5102:finance,personnel,vehicles,attendance,receipts,todos,inbox,notifications,admin:Ravikiran Operations ERP"
  "compute:5103:compute,notifications,inbox,admin:CATALYST Compute ERP"
)

# ------- subcommand parsing -------
action="start"
case "${1:-}" in
    --stop|stop)     action="stop" ;;
    --status|status) action="status" ;;
    --help|-h|help)
        sed -n '3,30p' "$0"
        exit 0
        ;;
esac

# ------- port helpers -------
running_pids_for_port() {
    lsof -ti ":$1" 2>/dev/null || true
}

stop_port() {
    local port="$1"
    local pids
    pids="$(running_pids_for_port "$port")"
    if [ -n "$pids" ]; then
        echo "  stopping PID(s) on :$port → $pids"
        kill $pids 2>/dev/null || true
        sleep 1
        pids="$(running_pids_for_port "$port")"
        if [ -n "$pids" ]; then
            echo "  force-killing $pids"
            kill -9 $pids 2>/dev/null || true
        fi
    fi
}

# ------- action: status -------
if [ "$action" = "status" ]; then
    echo "CATALYST ERP triad status"
    printf "  %-16s %-8s %-10s %s\n" variant port state pids
    for entry in "${VARIANTS[@]}"; do
        IFS=':' read -r variant port _modules _label <<< "$entry"
        pids="$(running_pids_for_port "$port")"
        if [ -n "$pids" ]; then
            printf "  %-16s %-8s %-10s %s\n" "$variant" "$port" "running" "$pids"
        else
            printf "  %-16s %-8s %-10s %s\n" "$variant" "$port" "stopped"  "-"
        fi
    done
    exit 0
fi

# ------- action: stop -------
if [ "$action" = "stop" ]; then
    echo "Stopping CATALYST ERP triad..."
    for entry in "${VARIANTS[@]}"; do
        IFS=':' read -r variant port _modules _label <<< "$entry"
        echo "--- $variant :: :$port ---"
        stop_port "$port"
    done
    exit 0
fi

# ------- action: start (default) -------
echo "=============================================="
echo "  CATALYST ERP triad launcher"
echo "  codebase: $SCHED_ROOT"
echo "=============================================="

if [ ! -x "$VENV_PY" ]; then
    echo "error: Python venv not found at $VENV_PY" >&2
    echo "       run scripts/install.sh first" >&2
    exit 1
fi

mkdir -p "$DATA_ROOT"

for entry in "${VARIANTS[@]}"; do
    IFS=':' read -r variant port modules label <<< "$entry"
    data_dir="$DATA_ROOT/$variant"
    mkdir -p "$data_dir"

    echo
    echo "--- $variant :: :$port :: $label ---"

    stop_port "$port"

    log_file="$SCHED_ROOT/logs/erp_triad_${variant}.log"
    mkdir -p "$(dirname "$log_file")"

    # Launch in background. Each instance gets its own env block.
    (
        export CATALYST_DATA_DIR="$data_dir"
        export CATALYST_MODULES="$modules"
        export CATALYST_ORG_NAME="$label"
        export CATALYST_ORG_TAGLINE="Demo variant — one codebase, three ERPs"
        export CATALYST_DEMO_VARIANT="$variant"
        export CATALYST_DEMO_VARIANT_URLS="$VARIANT_URLS"
        export LAB_SCHEDULER_DEMO_MODE="1"
        export LAB_SCHEDULER_HOST="127.0.0.1"
        export LAB_SCHEDULER_PORT="$port"
        # Demo triad: CSRF + secure-cookie disabled so visitors can log in
        # on plain HTTP at 127.0.0.1 without running into stale-tab /
        # SameSite / cross-variant cookie gotchas. Real deployments MUST
        # re-enable both (defaults in app.py are ON).
        export LAB_SCHEDULER_CSRF="0"
        export LAB_SCHEDULER_COOKIE_SECURE="0"
        cd "$SCHED_ROOT"
        nohup "$VENV_PY" app.py >> "$log_file" 2>&1 &
        echo "  started PID $! (log: $log_file)"
    )
done

echo
echo "=============================================="
echo "  All three variants starting. Give them ~5s to bind ports."
echo
echo "  Lab ERP           → http://127.0.0.1:5101"
echo "  Ravikiran Ops ERP → http://127.0.0.1:5102"
echo "  Compute ERP       → http://127.0.0.1:5103"
echo
echo "  Status : $0 --status"
echo "  Stop   : $0 --stop"
echo "=============================================="
