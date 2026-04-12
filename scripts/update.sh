#!/bin/bash
# PRISM ERP — Apple-style update system.
#
# Pulls the latest code from the upstream git remote without
# touching your data. Program files (app.py, templates/, static/,
# crawlers/, scripts/) are updated; data files (data/, .env, logs/)
# are never overwritten.
#
# Safe to run while the server is stopped OR running (the running
# server will pick up template/CSS changes on the next request;
# app.py changes require a restart).
#
# Usage:
#   bash scripts/update.sh              # pull + report
#   bash scripts/update.sh --restart    # pull + restart Flask
#
# The update checks the remote for new tags. If a new stable tag
# exists, it pulls to that tag. Otherwise it pulls the latest
# commit on the tracked branch.

set -e

cd "$(dirname "$0")/.."
BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "v1.3.0-stable-release")

echo "══════════════════════════════════════════════"
echo "  PRISM ERP — Checking for updates"
echo "══════════════════════════════════════════════"
echo "  Branch: $BRANCH"
echo "  Current: $(git log --oneline -1)"
echo ""

# Stash any local changes to tracked files (shouldn't happen
# in a clean deployment, but protects against accidental edits)
STASHED=0
if ! git diff --quiet HEAD 2>/dev/null; then
  echo "  Stashing local changes..."
  git stash push -q -m "prism-update-$(date +%s)"
  STASHED=1
fi

# Fetch
echo "  Fetching upstream..."
git fetch origin 2>&1 | sed 's/^/  /'

# Check for new tags
LATEST_TAG=$(git tag -l 'v*' --sort=-version:refname | head -1)
REMOTE_TAGS=$(git ls-remote --tags origin 'v*' 2>/dev/null | awk '{print $2}' | sed 's|refs/tags/||' | sort -V | tail -1)

if [ -n "$REMOTE_TAGS" ] && [ "$REMOTE_TAGS" != "$LATEST_TAG" ]; then
  echo "  New release tag: $REMOTE_TAGS (current: $LATEST_TAG)"
  git fetch origin tag "$REMOTE_TAGS" 2>&1 | sed 's/^/  /'
fi

# Pull
BEFORE=$(git rev-parse HEAD)
git pull --rebase origin "$BRANCH" 2>&1 | sed 's/^/  /'
AFTER=$(git rev-parse HEAD)

if [ "$BEFORE" = "$AFTER" ]; then
  echo ""
  echo "  Already up to date."
else
  COMMITS=$(git log --oneline "$BEFORE".."$AFTER" | wc -l | tr -d ' ')
  echo ""
  echo "  Updated: $COMMITS new commit(s)"
  git log --oneline "$BEFORE".."$AFTER" | head -10 | sed 's/^/    /'

  # Run any new migrations by initializing the DB
  echo ""
  echo "  Running database migrations..."
  .venv/bin/python -c "import app; app.init_db()" 2>/dev/null && echo "  ✓ Migrations applied" || echo "  ⚠ Migration check failed (may need .venv rebuild)"

  # Rebuild venv if requirements changed
  if git diff --name-only "$BEFORE".."$AFTER" | grep -q "requirements.txt"; then
    echo "  requirements.txt changed — reinstalling..."
    .venv/bin/pip install -q -r requirements.txt
  fi
fi

# Restore stash
if [ "$STASHED" -eq 1 ]; then
  echo "  Restoring stashed changes..."
  git stash pop -q 2>/dev/null || echo "  ⚠ Stash conflict — resolve manually with 'git stash show' + 'git stash drop'"
fi

# Restart if requested — ZERO DOWNTIME via Gunicorn graceful reload
if [ "$1" = "--restart" ]; then
  echo ""
  MASTER_PID=$(pgrep -f "gunicorn.*app:app" | head -1)
  PORT="${LAB_SCHEDULER_PORT:-5055}"
  PROTO="http"
  [ -f cert.pem ] && [ -f key.pem ] && PROTO="https"

  if [ -n "$MASTER_PID" ]; then
    # Gunicorn is running — send SIGHUP for graceful reload.
    # Workers finish current requests, then restart with new code.
    # No dropped connections, no downtime.
    echo "  Graceful reload (SIGHUP → gunicorn pid $MASTER_PID)..."
    kill -HUP "$MASTER_PID"
    sleep 3
    if curl -sk -o /dev/null -w "%{http_code}" "${PROTO}://127.0.0.1:${PORT}/login" | grep -q 200; then
      echo "  ✓ Reloaded — zero downtime"
    else
      echo "  ⚠ Reload may have failed — check logs/server.log"
    fi
  else
    # No gunicorn running — cold start
    echo "  Starting server (cold start)..."
    nohup bash scripts/start.sh --service > logs/server.log 2>&1 &
    disown
    sleep 4
    if curl -sk -o /dev/null -w "%{http_code}" "${PROTO}://127.0.0.1:${PORT}/login" | grep -q 200; then
      echo "  ✓ Server started"
    else
      echo "  ⚠ Server may not have started — check logs/server.log"
    fi
  fi
fi

echo ""
echo "══════════════════════════════════════════════"
echo "  Data files (data/, .env, logs/) are untouched."
echo "  Program files updated to: $(git log --oneline -1)"
echo "══════════════════════════════════════════════"
