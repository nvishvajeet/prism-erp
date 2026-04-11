#!/usr/bin/env bash
# ship.sh — one-command commit + push for PRISM single-operator work.
#
# Usage: scripts/ship.sh "subject line" [file ...]
#   - subject line goes in as -m (short, ≤70 chars)
#   - files: optional explicit list. If given, only those files are
#     staged. If omitted, stages modified TRACKED files only and
#     REFUSES to continue if untracked files exist — because
#     untracked files may belong to a concurrent agent that is
#     mid-edit and we must not absorb its work into our commit.
#     (This is the fix for the `a40d845` absorption bug where a
#     concurrent agent's `ui_uniformity.py` got pulled into the
#     operator's Block 2 commit by `git add -A`.)
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
  # Explicit file list: caller knows exactly what's going in.
  # This is the only way to stage a NEW (untracked) file.
  git add -- "$@"
else
  # Default: stage tracked modifications only. Never absorbs
  # untracked files — if a new file needs to ship, pass it
  # explicitly. If untracked files exist, bail with a hint.
  untracked=$(git ls-files --others --exclude-standard)
  if [ -n "$untracked" ]; then
    echo "ship.sh: untracked files present — pass them explicitly or they will not ship:" >&2
    echo "$untracked" | sed 's/^/  /' >&2
    echo "  (concurrent agents may own some of these — do not auto-absorb)" >&2
    exit 1
  fi
  git add -u
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
