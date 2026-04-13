#!/bin/bash
# CATALYST ERP — Pull all user + system data from Mac mini to laptop.
#
# Transfers the entire data/ directory (databases, uploads, exports)
# and logs/ from the mini to a timestamped backup folder on the
# laptop. The owner gets a complete copy of everything.
#
# Usage:
#   bash scripts/backup_from_mini.sh           # manual backup
#   bash scripts/backup_from_mini.sh --cron    # quiet mode for cron
#
# Schedule weekly (Sunday 2 AM):
#   crontab -e
#   0 2 * * 0 cd ~/Documents/Scheduler/Main && bash scripts/backup_from_mini.sh --cron >> logs/backup.log 2>&1
#
# What's backed up:
#   data/operational/    — production database + uploads + exports
#   data/demo/           — demo database (if present)
#   logs/                — server logs, access logs, error logs
#   .env                 — server configuration (has secrets)
#
# What's NOT backed up (program files — already in git):
#   app.py, templates/, static/, crawlers/, scripts/, docs/

set -e

MINI_HOST="${CATALYST_MINI_HOST:-vishwajeet@100.115.176.118}"
MINI_DIR="${CATALYST_MINI_DIR:-~/Scheduler/Main}"
BACKUP_ROOT="${CATALYST_BACKUP_ROOT:-$HOME/Documents/Scheduler/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$BACKUP_ROOT/$TIMESTAMP"
QUIET=0
[ "$1" = "--cron" ] && QUIET=1

log() { [ "$QUIET" -eq 0 ] && echo "$1"; }

log "══════════════════════════════════════════════"
log "  CATALYST — Backup from Mac mini"
log "══════════════════════════════════════════════"
log "  Mini:   $MINI_HOST:$MINI_DIR"
log "  Target: $BACKUP_DIR"
log ""

# Test connectivity
if ! ssh -o ConnectTimeout=10 "$MINI_HOST" "echo ok" >/dev/null 2>&1; then
  echo "ERROR: Cannot reach $MINI_HOST — is Tailscale running?"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

# Backup data directory (databases, uploads, exports)
log "  Syncing data/..."
rsync -az --progress \
  "$MINI_HOST:$MINI_DIR/data/" \
  "$BACKUP_DIR/data/" \
  2>&1 | { [ "$QUIET" -eq 0 ] && cat || tail -1; }

# Backup logs
log "  Syncing logs/..."
rsync -az \
  "$MINI_HOST:$MINI_DIR/logs/" \
  "$BACKUP_DIR/logs/" \
  2>&1 | { [ "$QUIET" -eq 0 ] && cat || tail -1; }

# Backup .env (has secrets — owner needs this)
log "  Copying .env..."
scp -q "$MINI_HOST:$MINI_DIR/.env" "$BACKUP_DIR/.env" 2>/dev/null || true

# Summary
DATA_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | awk '{print $1}')
DB_COUNT=$(find "$BACKUP_DIR" -name "*.db" 2>/dev/null | wc -l | tr -d ' ')

log ""
log "══════════════════════════════════════════════"
log "  Backup complete"
log "  Size:      $DATA_SIZE"
log "  Databases: $DB_COUNT"
log "  Location:  $BACKUP_DIR"
log "══════════════════════════════════════════════"

# Keep last 8 backups, prune older ones
BACKUP_COUNT=$(ls -d "$BACKUP_ROOT"/20* 2>/dev/null | wc -l | tr -d ' ')
if [ "$BACKUP_COUNT" -gt 8 ]; then
  PRUNE=$((BACKUP_COUNT - 8))
  log "  Pruning $PRUNE old backup(s)..."
  ls -d "$BACKUP_ROOT"/20* | head -"$PRUNE" | while read old; do
    rm -rf "$old"
    log "    Removed: $(basename $old)"
  done
fi
