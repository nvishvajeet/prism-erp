#!/usr/bin/env bash
# ship.sh — one-command commit + push for PRISM single-operator work.
#
# Usage: scripts/ship.sh "subject line" [file ...]
#   - subject line goes in as -m (short, ≤70 chars)
#   - files default to `git add -A` (tracked + new untracked) if none given
#
# Flow: stage → smoke test → commit → pull --rebase → push.
# Exits non-zero on any failure. Designed for the 5-min-block cadence.

set -e

if [ $# -lt 1 ]; then
  echo "usage: $0 \"<subject>\" [file ...]" >&2
  exit 2
fi

SUBJECT="$1"; shift
BRANCH="v1.3.0-stable-release"
cd "$(dirname "$0")/.."

if [ $# -gt 0 ]; then
  git add -- "$@"
else
  # Stage tracked changes AND new untracked files. The earlier
  # `git add -u` silently skipped untracked files — ship.sh itself
  # never made it into its own first commit because of that.
  git add -A
fi

if git diff --cached --quiet; then
  echo "ship.sh: nothing staged — bail" >&2
  exit 1
fi

.venv/bin/python scripts/smoke_test.py > /tmp/prism-smoke.log 2>&1 || {
  echo "ship.sh: smoke test FAILED — see /tmp/prism-smoke.log" >&2
  tail -15 /tmp/prism-smoke.log >&2
  exit 1
}

git commit -m "$SUBJECT"
git pull --rebase origin "$BRANCH"
git push origin "$BRANCH"
echo "ship.sh: ✅ $SUBJECT"
