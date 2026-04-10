#!/bin/bash
#
# review_ollama_commits.sh — Claude's session-start gate.
#
# Lists every commit on the `ollama-work` branch since the
# `claude_last_seen` tag, runs the regression suite against
# each, and writes a structured QC entry into
# ollama_qc_log.md. Claude reads the log on resume, decides
# APPROVE / REJECT per commit, cherry-picks approved commits
# onto master, and advances the tag.
#
# This script does NOT cherry-pick automatically. It collects
# evidence; the decision stays with Claude.
#
# Usage:
#   ./review_ollama_commits.sh             # review all new commits
#   ./review_ollama_commits.sh --since=SHA # review since explicit SHA
#   ./review_ollama_commits.sh --apply     # approved → cherry-pick (manual)
#
# Read OLLAMA_DEV_PLAN.md §3 (sandbox), §8 (resume protocol),
# and §13 (this script + QC log) before running.
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

SANDBOX_BRANCH="ollama-work"
TAG="claude_last_seen"
QC_LOG="ollama_qc_log.md"
SINCE=""
APPLY=0

while [ $# -gt 0 ]; do
  case "$1" in
    --since=*) SINCE="${1#--since=}" ;;
    --apply)   APPLY=1 ;;
    -h|--help) sed -n '2,22p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
  shift
done

bold() { printf "\033[1m%s\033[0m\n" "$*"; }
ok()   { printf "\033[32m%s\033[0m\n" "$*"; }
warn() { printf "\033[33m%s\033[0m\n" "$*"; }
err()  { printf "\033[31m%s\033[0m\n" "$*"; }

# ---- preflight -----------------------------------------------
git fetch --all --tags --quiet

if ! git show-ref --verify --quiet "refs/heads/$SANDBOX_BRANCH"; then
  warn "No '$SANDBOX_BRANCH' branch yet — nothing to review."
  exit 0
fi

if [ -z "$SINCE" ]; then
  if git rev-parse "$TAG" >/dev/null 2>&1; then
    SINCE=$(git rev-parse "$TAG")
  else
    # Tag missing — fall back to merge-base with master so we
    # don't try to review the entire history.
    SINCE=$(git merge-base master "$SANDBOX_BRANCH" 2>/dev/null || echo "")
    warn "No '$TAG' tag found — using merge-base ($SINCE)."
  fi
fi

COMMITS=$(git log --reverse --format='%H' "$SINCE..$SANDBOX_BRANCH" 2>/dev/null || echo "")

if [ -z "$COMMITS" ]; then
  ok "No new commits on '$SANDBOX_BRANCH' since $(git rev-parse --short "$SINCE" 2>/dev/null || echo HEAD)."
  exit 0
fi

NUM_COMMITS=$(printf '%s\n' "$COMMITS" | wc -l | tr -d ' ')

bold "==> $NUM_COMMITS new commit(s) on '$SANDBOX_BRANCH' to review"
echo ""

# ---- QC log header -------------------------------------------
TS=$(date '+%Y-%m-%d %H:%M:%S %z')
SESSION="qc-$(date +%Y%m%d-%H%M%S)"

if [ ! -f "$QC_LOG" ]; then
  cat > "$QC_LOG" <<'HEAD'
# Ollama QC Log

This file is the audit trail for Claude's review of Ollama
commits on the `ollama-work` branch. Every session that finds
new commits appends a block. Read OLLAMA_DEV_PLAN.md §13 for
the full schema.

Status legend: APPROVE / REJECT / DEFER / NEEDS-REWORK.

---

HEAD
fi

{
  echo ""
  echo "## Session $SESSION ($TS)"
  echo ""
  echo "- Commits found: $NUM_COMMITS"
  echo "- Range: \`$(git rev-parse --short "$SINCE")..$(git rev-parse --short "$SANDBOX_BRANCH")\`"
  echo ""
} >> "$QC_LOG"

# ---- per-commit checks ---------------------------------------
PASSED_SHAS=""
FAILED_SHAS=""

for sha in $COMMITS; do
  short=$(git rev-parse --short "$sha")
  subject=$(git log -1 --format='%s' "$sha")
  author=$(git log -1 --format='%an' "$sha")
  files_touched=$(git diff-tree --no-commit-id --name-only -r "$sha" | tr '\n' ' ')
  num_files=$(git diff-tree --no-commit-id --name-only -r "$sha" | wc -l | tr -d ' ')
  num_added=$(git diff --shortstat "$sha~1" "$sha" 2>/dev/null | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' || echo 0)
  num_removed=$(git diff --shortstat "$sha~1" "$sha" 2>/dev/null | grep -oE '[0-9]+ deletion' | grep -oE '[0-9]+' || echo 0)

  bold "  [$short] $subject"
  echo "    files: $num_files   +$num_added / -$num_removed"

  # ---- automated checks --------------------------------------
  CHECK_LOG=$(mktemp)

  # Check 1: forbidden-file scan
  forbidden_hit=""
  for f in $files_touched; do
    case "$f" in
      app.py)
        # app.py is a soft-blocked file: Ollama may touch it
        # under specific specs (safe_int wrap), so flag for
        # human review rather than auto-reject.
        forbidden_hit="${forbidden_hit}app.py "
        ;;
      crawlers/*|init_db*|start.sh|requirements.txt|static/styles.css)
        forbidden_hit="${forbidden_hit}$f "
        ;;
    esac
  done

  # Check 2: smoke test against the commit's tree
  smoke_status="SKIP"
  if [ -f smoke_test.py ]; then
    if git -c advice.detachedHead=false stash --include-untracked --quiet 2>/dev/null; then
      STASHED=1
    else
      STASHED=0
    fi
    git checkout "$sha" --quiet 2>/dev/null
    if python smoke_test.py >/dev/null 2>"$CHECK_LOG"; then
      smoke_status="PASS"
    else
      smoke_status="FAIL"
    fi
    git checkout - --quiet 2>/dev/null
    [ "$STASHED" = "1" ] && git stash pop --quiet 2>/dev/null || true
  fi

  # Check 3: state-transition test
  trans_status="SKIP"
  if [ -f tests/test_status_transitions.py ]; then
    git checkout "$sha" --quiet 2>/dev/null
    if python tests/test_status_transitions.py >/dev/null 2>>"$CHECK_LOG"; then
      trans_status="PASS"
    else
      trans_status="FAIL"
    fi
    git checkout - --quiet 2>/dev/null
  fi

  # ---- decision suggestion -----------------------------------
  suggestion="APPROVE"
  reasons=()
  if [ -n "$forbidden_hit" ]; then
    suggestion="NEEDS-REWORK"
    reasons+=("touched flagged files: $forbidden_hit")
  fi
  if [ "$smoke_status" = "FAIL" ]; then
    suggestion="REJECT"
    reasons+=("smoke_test.py failed")
  fi
  if [ "$trans_status" = "FAIL" ]; then
    suggestion="REJECT"
    reasons+=("test_status_transitions.py failed")
  fi
  if [ "$num_files" -gt 5 ]; then
    suggestion="NEEDS-REWORK"
    reasons+=("touched >5 files (mechanical tasks should be focused)")
  fi
  if [ "$num_added" -gt 200 ]; then
    suggestion="NEEDS-REWORK"
    reasons+=("added >200 lines (mechanical tasks should be small)")
  fi

  reason_text="(no flags)"
  if [ "${#reasons[@]}" -gt 0 ]; then
    reason_text=$(IFS='; '; echo "${reasons[*]}")
  fi

  case "$suggestion" in
    APPROVE)      PASSED_SHAS="$PASSED_SHAS $sha" ;;
    REJECT|NEEDS-REWORK) FAILED_SHAS="$FAILED_SHAS $sha" ;;
  esac

  # ---- write QC entry ----------------------------------------
  {
    echo "### $short — $subject"
    echo ""
    echo "- Author: $author"
    echo "- Files ($num_files): \`${files_touched:-(none)}\`"
    echo "- Diff: +$num_added / -$num_removed"
    echo "- smoke_test.py: \`$smoke_status\`"
    echo "- test_status_transitions.py: \`$trans_status\`"
    echo "- Auto-suggestion: **$suggestion**"
    echo "- Reason: $reason_text"
    echo "- Claude decision: _(fill in: APPROVE / REJECT / DEFER / NEEDS-REWORK)_"
    echo "- Notes: _(fill in)_"
    echo ""
  } >> "$QC_LOG"

  rm -f "$CHECK_LOG"
done

# ---- summary footer ------------------------------------------
{
  echo "### Session summary"
  echo ""
  echo "- Auto-passed: $(echo "$PASSED_SHAS" | wc -w | tr -d ' ')"
  echo "- Auto-flagged: $(echo "$FAILED_SHAS" | wc -w | tr -d ' ')"
  echo ""
  echo "After Claude reviews this block and writes APPROVE per"
  echo "approved commit, run:"
  echo ""
  echo '```'
  echo "git checkout master"
  echo "git cherry-pick <approved-sha-1> <approved-sha-2> ..."
  echo "git tag -f $TAG $SANDBOX_BRANCH"
  echo "git push origin master:main"
  echo "git push --force-with-lease origin refs/tags/$TAG"
  echo '```'
  echo ""
  echo "---"
} >> "$QC_LOG"

echo ""
ok "Wrote QC entries to $QC_LOG"
echo ""
echo "Auto-passed:  $(echo "$PASSED_SHAS" | wc -w | tr -d ' ')"
echo "Auto-flagged: $(echo "$FAILED_SHAS" | wc -w | tr -d ' ')"
echo ""
echo "Open $QC_LOG, write Claude's decision per commit, then"
echo "cherry-pick the approved SHAs onto master and advance the"
echo "$TAG tag."

if [ "$APPLY" = "1" ]; then
  echo ""
  warn "--apply was passed but auto-cherry-pick is intentionally"
  warn "not implemented. Cherry-picks need a human (or Claude) to"
  warn "have signed off on the QC log entries first."
fi
