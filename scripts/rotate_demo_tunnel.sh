#!/usr/bin/env bash
# rotate_demo_tunnel.sh — one-command refresh of the Cloudflare quick
# tunnel that exposes the laptop Flask (:5055) to public HTTPS for the
# PRISM demo on nvishvajeet.github.io.
#
# Why this exists: cloudflared quick tunnels rotate their
# `*.trycloudflare.com` subdomain on every restart. When the operator
# reboots, kills the tunnel, or the process dies, the URL baked into
# the github.io demo page stops working. This script kills the old
# tunnel, starts a new one, extracts the new URL, updates BOTH
# _config.yml entries (`prism_demo.url` and `prism_demo.base`),
# commits, and pushes to both origin and github — all in one call.
#
# Usage:   scripts/rotate_demo_tunnel.sh
# Exits:   0 on success, non-zero on any failure (stale state may need
#          manual cleanup — see the step output).

set -e

PRISM_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SITE_DIR="${HOME}/Claude/nvishvajeet.github.io"
LOG="${PRISM_DIR}/logs/cloudflared.log"
CONFIG="${SITE_DIR}/_config.yml"

if [ ! -d "$SITE_DIR" ]; then
  echo "rotate_demo_tunnel: $SITE_DIR missing — github.io working copy not found" >&2
  exit 1
fi
if ! command -v cloudflared >/dev/null 2>&1; then
  echo "rotate_demo_tunnel: cloudflared not installed — run 'brew install cloudflared'" >&2
  exit 1
fi

# Sanity: Flask must be running and responsive before we rotate.
if ! curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5055/login | grep -q "^200$"; then
  echo "rotate_demo_tunnel: Flask on :5055 is not responding — start it first" >&2
  exit 1
fi

echo "step 1/6: killing any existing cloudflared quick tunnels"
pkill -f "cloudflared tunnel --url" 2>/dev/null || true
sleep 1

echo "step 2/6: starting fresh cloudflared tunnel → http://127.0.0.1:5055"
mkdir -p "${PRISM_DIR}/logs"
: > "$LOG"  # truncate so the URL-grep below only sees the new output
nohup cloudflared tunnel --url http://127.0.0.1:5055 > "$LOG" 2>&1 &
TUNNEL_PID=$!
echo "  cloudflared PID=${TUNNEL_PID}"

echo "step 3/6: waiting for tunnel URL to appear (up to 15 s)"
URL=""
for _ in $(seq 1 15); do
  sleep 1
  URL=$(grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" "$LOG" 2>/dev/null | head -1 || true)
  if [ -n "$URL" ]; then
    break
  fi
done
if [ -z "$URL" ]; then
  echo "rotate_demo_tunnel: cloudflared did not print a URL within 15 s — see $LOG" >&2
  exit 1
fi
echo "  new URL: ${URL}"

echo "step 4/6: verifying the tunnel reaches /login?demo=1 with prefilled creds"
if ! curl -s "${URL}/login?demo=1" | grep -q 'value="admin@lab.local"'; then
  echo "rotate_demo_tunnel: tunnel reachable but /login?demo=1 did not prefill — check Flask" >&2
  exit 1
fi

echo "step 5/6: rewriting ${CONFIG} prism_demo.url + prism_demo.base"
# macOS sed needs `-i ''` for in-place edits. The two lines look like:
#   url: https://<old>.trycloudflare.com/login?demo=1
#   base: https://<old>.trycloudflare.com
if ! grep -q "trycloudflare.com" "$CONFIG"; then
  echo "rotate_demo_tunnel: $CONFIG has no trycloudflare.com entry to update" >&2
  exit 1
fi
/usr/bin/sed -i '' -E \
  -e "s|url: https://[a-z0-9-]+\.trycloudflare\.com/login\?demo=1|url: ${URL}/login?demo=1|" \
  -e "s|base: https://[a-z0-9-]+\.trycloudflare\.com|base: ${URL}|" \
  "$CONFIG"
if ! grep -q "${URL}" "$CONFIG"; then
  echo "rotate_demo_tunnel: sed did not rewrite $CONFIG — bailing" >&2
  exit 1
fi
echo "  $(grep -E 'url:|base:' "$CONFIG" | sed 's/^/    /')"

echo "step 6/6: committing + pushing github.io to origin and github"
cd "$SITE_DIR"
if git diff --quiet _config.yml; then
  echo "  (no change to commit — config already pointed at ${URL})"
else
  git add _config.yml
  git commit -m "chore(demo): rotate cloudflared tunnel URL" \
             -m "Public demo URL refreshed to ${URL}. Flask on :5055 verified reachable before commit. rotate_demo_tunnel.sh automated run."
  git push origin main
  git push github main
fi

echo ""
echo "✅ rotate_demo_tunnel: done"
echo "   public demo: ${URL}/login?demo=1"
echo "   cloudflared PID: ${TUNNEL_PID}  (logs: ${LOG})"
