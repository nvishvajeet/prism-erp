#!/bin/bash
# Nightly ERP Health Audit — run via cron at 10 PM daily
# Cron: 0 22 * * * bash ~/Documents/Scheduler/Main/scripts/nightly_audit.sh

LOG="$HOME/Documents/Scheduler/Main/logs/nightly_audit_$(date +%Y-%m-%d).log"
cd "$HOME/Documents/Scheduler/Main"

echo "=== NIGHTLY AUDIT $(date) ===" > "$LOG"

# 1. Smoke test
echo "--- Smoke Test ---" >> "$LOG"
./venv/bin/python scripts/smoke_test.py >> "$LOG" 2>&1
echo "" >> "$LOG"

# 2. Sanity wave
echo "--- Sanity Wave ---" >> "$LOG"
.venv/bin/python -m crawlers wave sanity >> "$LOG" 2>&1
echo "" >> "$LOG"

# 3. Route health (all roles)
echo "--- Route Health ---" >> "$LOG"
./venv/bin/python -c "
import app
roles=[('owner@catalyst.local','o'),('kondhalkar@catalyst.local','i'),('anika@catalyst.local','op'),('meera@catalyst.local','f'),('user1@catalyst.local','r')]
routes=sorted(set(r.rule for r in app.app.url_map.iter_rules() if 'GET' in r.methods and '<' not in r.rule and not r.rule.startswith('/static')))
errs=0
with app.app.test_client() as c:
    for email,role in roles:
        c.get('/logout');c.post('/login',data={'email':email,'password':'12345'})
        for route in routes:
            r=c.get(route)
            if r.status_code==500: errs+=1; print('500: %s %s' % (role,route))
print('ROUTES: %d checks, %d errors' % (len(roles)*len(routes), errs))
if errs==0: print('ALL GREEN')
else: print('FAILURES FOUND — CHECK LOG')
" >> "$LOG" 2>&1

# 4. Process command queue
echo "--- Command Queue ---" >> "$LOG"
./venv/bin/python -c "import app; print('Processed:', app.check_command_queue())" >> "$LOG" 2>&1

# 5. DB size check
echo "--- DB Health ---" >> "$LOG"
ls -lh data/demo/lab_scheduler.db >> "$LOG" 2>&1

echo "=== AUDIT COMPLETE $(date) ===" >> "$LOG"

# Summary line for quick check
PASS=$(grep -c 'PASS' "$LOG")
FAIL=$(grep -c 'FAIL\|500:' "$LOG")
echo "Nightly: $PASS pass, $FAIL fail — $(date +%Y-%m-%d)" >> logs/audit_history.log
