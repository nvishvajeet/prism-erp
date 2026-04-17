#!/bin/bash
# Auto-cherry-pick watcher — runs on Mini every 2 min via launchd.
#
# Station Scotland sometimes forgets to cherry-pick Station Paris's
# commits from `operation-trois-agents` to `v1.3.0-stable-release`.
# Result: fix is in source but NOT deployed (Mini only deploys
# v1.3.0). Operator has to ask why the fix isn't live.
#
# This watcher closes the gap: every 2 min, fetches both branches,
# finds commits on operation-trois-agents that aren't on v1.3.0
# (excluding "claim:" + "conductor" commits), cherry-picks them
# one by one, pushes v1.3.0, and lets the post-receive hook redeploy.
#
# Safe because pre-receive smoke-gate already blocked anything that
# breaks tests — every commit that landed on operation-trois-agents
# was smoke-green at commit time.

set -u
cd "$(dirname "$0")/.." || exit 1

LOG_FILE="logs/auto-cherry-pick.log"
mkdir -p "$(dirname "$LOG_FILE")"
ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Lock to prevent concurrent runs
LOCK="/tmp/catalyst-auto-cherry-pick.lock"
if ! ln -s "$$" "$LOCK" 2>/dev/null; then
  # Stale lock check — if lock older than 10 min, steal
  if [ -L "$LOCK" ] && [ "$(find "$LOCK" -mmin +10 2>/dev/null | wc -l)" -gt 0 ]; then
    rm -f "$LOCK"
    ln -s "$$" "$LOCK"
  else
    echo "[$ts] another run in progress — skipping" >> "$LOG_FILE"
    exit 0
  fi
fi
trap 'rm -f "$LOCK"' EXIT

# Use a dedicated worktree at ~/Scheduler/Main (the deploy root) for v1.3.0
# Use a separate worktree for operation-trois-agents reading
cd "$HOME/Scheduler/Main" || { echo "[$ts] no Scheduler/Main — abort" >> "$LOG_FILE"; exit 1; }

# Ensure git remote is current
git fetch --quiet origin v1.3.0-stable-release operation-trois-agents 2>&1 | tee -a "$LOG_FILE"

# Shas that are on operation-trois-agents but NOT on v1.3.0-stable-release
PENDING=$(git log --format='%H %s' origin/v1.3.0-stable-release..origin/operation-trois-agents 2>/dev/null | \
  grep -viE '^[0-9a-f]+ (claim:|conductor\(|docs\(rig\).*last burn log|WIP|wip)' | \
  awk '{print $1}' | tac)  # reverse so oldest first

if [ -z "$PENDING" ]; then
  echo "[$ts] nothing pending — v1.3.0 is up to date with operation-trois-agents" >> "$LOG_FILE"
  exit 0
fi

echo "[$ts] pending shas to cherry-pick:" >> "$LOG_FILE"
echo "$PENDING" | head -20 >> "$LOG_FILE"

# Checkout v1.3.0 in a temp worktree (don't disturb the main working tree which is what gunicorn serves)
WT="$HOME/tmp-v1.3.0-cherry-pick"
rm -rf "$WT"
git worktree add --quiet "$WT" origin/v1.3.0-stable-release 2>&1 | tee -a "$LOG_FILE"
cd "$WT" || { echo "[$ts] failed to create worktree — abort" >> "$LOG_FILE"; exit 1; }

# Create a local branch from origin
git checkout -q -B v1.3.0-stable-release origin/v1.3.0-stable-release

APPLIED=0
FAILED=0
for sha in $PENDING; do
  if git cherry-pick --allow-empty "$sha" > /tmp/cherry-pick-output.log 2>&1; then
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] cherry-picked $sha OK" >> "$HOME/Scheduler/Main/$LOG_FILE"
    APPLIED=$((APPLIED+1))
  else
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] cherry-pick $sha FAILED — aborting chain" >> "$HOME/Scheduler/Main/$LOG_FILE"
    cat /tmp/cherry-pick-output.log >> "$HOME/Scheduler/Main/$LOG_FILE"
    git cherry-pick --abort 2>/dev/null || true
    FAILED=$((FAILED+1))
    break
  fi
done

if [ "$APPLIED" -gt 0 ]; then
  if git push --quiet origin v1.3.0-stable-release 2>&1 | tee -a "$HOME/Scheduler/Main/$LOG_FILE"; then
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] pushed $APPLIED commits to v1.3.0 — deploy hook should fire" >> "$HOME/Scheduler/Main/$LOG_FILE"
  else
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] push to v1.3.0 FAILED" >> "$HOME/Scheduler/Main/$LOG_FILE"
  fi
fi

# Cleanup worktree
cd "$HOME"
git -C "$HOME/Scheduler/Main" worktree remove --force "$WT" 2>/dev/null || true
rm -rf "$WT"

# If any commits landed on v1.3.0, also sync ERP-Instances copy (mitwpu serves from there)
if [ "$APPLIED" -gt 0 ] && [ -d "$HOME/ERP-Instances/lab-erp/live/app" ]; then
  # Copy the whole app.py + changed templates from Scheduler/Main
  # Simplest: rsync specific file types
  rsync -a --quiet \
    "$HOME/Scheduler/Main/app.py" \
    "$HOME/ERP-Instances/lab-erp/live/app/app.py"
  rsync -a --quiet \
    "$HOME/Scheduler/Main/templates/" \
    "$HOME/ERP-Instances/lab-erp/live/app/templates/"
  rsync -a --quiet \
    "$HOME/Scheduler/Main/static/" \
    "$HOME/ERP-Instances/lab-erp/live/app/static/"
  rsync -a --quiet \
    "$HOME/Scheduler/Main/docs/" \
    "$HOME/ERP-Instances/lab-erp/live/app/docs/"
  launchctl kickstart -k "gui/$(id -u)/local.catalyst.mitwpu" 2>&1 | tee -a "$HOME/Scheduler/Main/$LOG_FILE"
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] synced ERP-Instances + kickstarted local.catalyst.mitwpu" >> "$HOME/Scheduler/Main/$LOG_FILE"
fi

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] done — applied=$APPLIED failed=$FAILED" >> "$HOME/Scheduler/Main/$LOG_FILE"
exit 0
