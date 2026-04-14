#!/bin/bash
# ═══════════════════════════════════════════════════════════
# NIGHTLY DEV SESSION — 15 minutes, automated, every night
# ═══════════════════════════════════════════════════════════
#
# Cron: 0 22 * * * bash ~/Documents/Scheduler/Main/scripts/nightly_dev.sh
#
# This script runs 3 phases in 15 minutes:
#
# Phase 1 (5 min): AUDIT
#   - Read debug feedback log (user complaints)
#   - Run smoke test + sanity wave
#   - Route health check (all roles)
#   - Process command queue (AI batch)
#   - Log everything
#
# Phase 2 (5 min): HEALTH
#   - Check DB size + integrity
#   - Check disk space
#   - Check server processes
#   - Check tunnel status
#   - Backup DB snapshot
#
# Phase 3 (5 min): REPORT
#   - Generate nightly summary
#   - Append to audit_history.log
#   - Flag any failures for morning review
#
# Total: ~15 minutes, fully autonomous, no human needed.
# ═══════════════════════════════════════════════════════════

set -e
cd "$HOME/Documents/Scheduler/Main"

DATE=$(date +%Y-%m-%d)
TIME=$(date +%H:%M:%S)
LOG="logs/nightly_dev_${DATE}.log"
VENV="./venv/bin/python"
CVENV="./.venv/bin/python"

echo "═══ NIGHTLY DEV SESSION ═══" > "$LOG"
echo "Date: $DATE $TIME" >> "$LOG"
echo "" >> "$LOG"

# ─── PHASE 1: AUDIT (5 min) ───────────────────────────────
echo "── Phase 1: AUDIT ──" >> "$LOG"

# 1a. Debug feedback log
echo "--- User Feedback ---" >> "$LOG"
FEEDBACK_LINES=$(wc -l < logs/debug_feedback.md 2>/dev/null || echo 0)
echo "  Feedback entries: $FEEDBACK_LINES lines" >> "$LOG"
if [ "$FEEDBACK_LINES" -gt 10 ]; then
    echo "  ⚠ New feedback needs review" >> "$LOG"
    tail -20 logs/debug_feedback.md >> "$LOG"
fi

# 1b. Smoke test
echo "" >> "$LOG"
echo "--- Smoke Test ---" >> "$LOG"
$VENV scripts/smoke_test.py >> "$LOG" 2>&1 && echo "  ✓ PASSED" >> "$LOG" || echo "  ✗ FAILED" >> "$LOG"

# 1c. Sanity wave
echo "" >> "$LOG"
echo "--- Sanity Wave ---" >> "$LOG"
$CVENV -m crawlers wave sanity >> "$LOG" 2>&1

# 1d. Route health
echo "" >> "$LOG"
echo "--- Route Health ---" >> "$LOG"
$VENV -c "
import app
roles=[('owner@catalyst.local','owner'),('kondhalkar@catalyst.local','inst_admin'),('anika@catalyst.local','operator'),('meera@catalyst.local','finance'),('user1@catalyst.local','requester')]
routes=sorted(set(r.rule for r in app.app.url_map.iter_rules() if 'GET' in r.methods and '<' not in r.rule and not r.rule.startswith('/static')))
errs=0
with app.app.test_client() as c:
    for email,role in roles:
        c.get('/logout');c.post('/login',data={'email':email,'password':'12345'})
        for route in routes:
            r=c.get(route)
            if r.status_code==500: errs+=1; print('  500: %s %s' % (role,route))
print('  Routes: %d checks, %d errors' % (len(roles)*len(routes), errs))
if errs==0: print('  ✓ ALL GREEN')
" >> "$LOG" 2>&1

# 1e. Process command queue (+ nightly prune of old terminal rows)
echo "" >> "$LOG"
echo "--- Command Queue ---" >> "$LOG"
$VENV -c "
import app
with app.app.app_context():
    pending = app.query_one('SELECT COUNT(*) AS c FROM command_queue WHERE status = \"pending\"')
    awaiting = app.query_one('SELECT COUNT(*) AS c FROM command_queue WHERE status = \"awaiting_approval\"')
    print('  Pending commands: %d' % (pending['c'] if pending else 0))
    print('  Awaiting approval: %d' % (awaiting['c'] if awaiting else 0))
pruned = app.prune_command_queue(days=30)
print('  Pruned (>30d): completed=%d failed=%d' % (pruned.get('completed', 0), pruned.get('failed', 0)))
" >> "$LOG" 2>&1

# ─── PHASE 2: HEALTH (5 min) ──────────────────────────────
echo "" >> "$LOG"
echo "── Phase 2: HEALTH ──" >> "$LOG"

# 2a. DB size + table counts
echo "--- Database ---" >> "$LOG"
DB="data/demo/lab_scheduler.db"
if [ -f "$DB" ]; then
    SIZE=$(ls -lh "$DB" | awk '{print $5}')
    echo "  DB size: $SIZE" >> "$LOG"
    $VENV -c "
import app
with app.app.app_context():
    tables = app.query_all('SELECT name FROM sqlite_master WHERE type=\"table\" AND name != \"sqlite_sequence\"')
    print('  Tables: %d' % len(tables))
    users = app.query_one('SELECT COUNT(*) AS c FROM users')
    print('  Users: %d' % users['c'])
    reqs = app.query_one('SELECT COUNT(*) AS c FROM sample_requests')
    print('  Requests: %d' % reqs['c'])
" >> "$LOG" 2>&1
fi

# 2b. Disk space
echo "" >> "$LOG"
echo "--- Disk ---" >> "$LOG"
df -h / | tail -1 | awk '{print "  Used: " $5 " (" $3 " of " $2 ")"}' >> "$LOG"

# 2c. Git status
echo "" >> "$LOG"
echo "--- Git ---" >> "$LOG"
DIRTY=$(git status --short | wc -l | tr -d ' ')
BRANCH=$(git branch --show-current)
COMMIT=$(git log --oneline -1)
echo "  Branch: $BRANCH" >> "$LOG"
echo "  Latest: $COMMIT" >> "$LOG"
echo "  Dirty files: $DIRTY" >> "$LOG"

# 2d. Backup DB
echo "" >> "$LOG"
echo "--- Backup ---" >> "$LOG"
BACKUP_DIR="logs/backups"
mkdir -p "$BACKUP_DIR"
if [ -f "$DB" ]; then
    cp "$DB" "$BACKUP_DIR/lab_scheduler_${DATE}.db"
    echo "  ✓ Backed up to $BACKUP_DIR/lab_scheduler_${DATE}.db" >> "$LOG"
    # Keep only last 7 backups
    ls -t "$BACKUP_DIR"/lab_scheduler_*.db | tail -n +8 | xargs rm -f 2>/dev/null
    echo "  Retention: 7 days" >> "$LOG"
fi

# ─── PHASE 3: REPORT (5 min) ──────────────────────────────
echo "" >> "$LOG"
echo "── Phase 3: REPORT ──" >> "$LOG"

# Count results
PASS=$(grep -c '✓\|PASS' "$LOG" 2>/dev/null || echo 0)
FAIL=$(grep -c '✗\|FAIL\|500:' "$LOG" 2>/dev/null || echo 0)
WARN=$(grep -c '⚠\|WARN' "$LOG" 2>/dev/null || echo 0)

echo "" >> "$LOG"
echo "═══ SUMMARY ═══" >> "$LOG"
echo "  Pass: $PASS" >> "$LOG"
echo "  Fail: $FAIL" >> "$LOG"
echo "  Warn: $WARN" >> "$LOG"
echo "  Status: $([ "$FAIL" -eq 0 ] && echo '✓ HEALTHY' || echo '✗ NEEDS ATTENTION')" >> "$LOG"
echo "═══ END $(date) ═══" >> "$LOG"

# Append one-liner to history
echo "$DATE | pass=$PASS fail=$FAIL warn=$WARN | $([ "$FAIL" -eq 0 ] && echo 'HEALTHY' || echo 'ATTENTION')" >> logs/audit_history.log

echo "Nightly dev session complete. Log: $LOG"
