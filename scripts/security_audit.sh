#!/bin/bash
cd /path/to/prism

echo "=== PRISM SECURITY CRAWL ==="
echo ""

echo "--- 1. Role × Page access matrix (visibility crawler) ---"
PRISM_DEPLOY_URL=https://127.0.0.1:5055 .venv/bin/python -m crawlers run visibility 2>&1 | tail -3
echo ""

echo "--- 2. Unauthenticated access (all should redirect/403) ---"
for path in / /schedule /instruments /instruments/1 /inbox /finance /admin/notices /admin/users; do
  CODE=$(curl -sk -o /dev/null -w "%{http_code}" "https://127.0.0.1:5055${path}")
  if [ "$CODE" = "200" ]; then
    echo "  FAIL $path → $CODE (leaked to unauthenticated)"
  else
    echo "  PASS $path → $CODE"
  fi
done
echo ""

echo "--- 3. CSRF enforcement ---"
CODE=$(curl -sk -o /dev/null -w "%{http_code}" -X POST "https://127.0.0.1:5055/login" -d "email=admin@lab.local&password=12345")
echo "  POST /login without CSRF token → $CODE (expect 400)"
echo ""

echo "--- 4. Finance portal role gating ---"
for account in "sen@prism.local:requester" "anika@prism.local:operator" "finance@prism.local:finance_admin" "admin@lab.local:super_admin"; do
  email="${account%%:*}"
  role="${account##*:}"
  THTML=$(curl -sk -c /tmp/sec_$$.jar "https://127.0.0.1:5055/login")
  TK=$(echo "$THTML" | grep -o 'name="csrf_token" value="[^"]*"' | head -1 | sed 's/.*value="//;s/"$//')
  curl -sk -b /tmp/sec_$$.jar -c /tmp/sec_$$.jar -X POST "https://127.0.0.1:5055/login" -d "csrf_token=$TK&email=$email&password=12345" -o /dev/null
  FC=$(curl -sk -b /tmp/sec_$$.jar -o /dev/null -w "%{http_code}" "https://127.0.0.1:5055/finance")
  if [ "$role" = "requester" ] && [ "$FC" = "200" ]; then
    echo "  FAIL $role ($email) → /finance: $FC (should be 403)"
  else
    echo "  PASS $role ($email) → /finance: $FC"
  fi
  rm -f /tmp/sec_$$.jar
done
echo ""

echo "--- 5. HTTPS status ---"
L=$(curl -sk -o /dev/null -w "%{http_code}" "https://127.0.0.1:5055/login")
M=$(curl -sk -o /dev/null -w "%{http_code}" "https://100.115.176.118:5055/login")
echo "  Laptop HTTPS: $L"
echo "  Mini HTTPS:   $M"
echo ""
echo "=== CRAWL COMPLETE ==="
