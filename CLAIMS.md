# Active agent claims — CATALYST live task board

> **This file is the lock board for parallel agent work on CATALYST.**
> If you are about to start anything non-trivial, append your row
> here first, commit+push this file alone as your claim, then do
> the work. Remove your row in the same commit that ships the
> work. See [`docs/PARALLEL.md`](docs/PARALLEL.md) for the full
> protocol. `WORKFLOW.md` §3.7 is the one-paragraph summary.

## Protocol in 30 seconds

1. `git pull origin v1.3.0-stable-release`
2. Read this file. If another agent claims a file you need →
   pick a different task or wait.
3. Pick a task from `docs/NEXT_WAVES.md` §"Parallel task board".
4. Append a row below. Commit **`CLAIMS.md` alone** with subject
   `claim: <agent-id> — <task-id>` and push. This is your lock.
5. Do the work. Run `scripts/smoke_test.py` before committing.
   **Hard cutoff: 60 minutes from claim to final push.** Blow
   past 30 minutes without a clear finish line → reassess. Blow
   past 60 → run the abort protocol below.
6. **Stage every new file immediately** with `git add` as soon
   as it is created — never leave a new file untracked while
   you rebase. `git pull --rebase` will refuse if an untracked
   file would be overwritten by a concurrent agent's new file.
7. **Never `git stash` mid-task.** `stash pop` has been observed
   silently dropping edits on this repo. Commit-then-rebase is
   the only safe pattern.
8. `git pull --rebase origin v1.3.0-stable-release` to absorb
   any concurrent commits that landed while you were working.
9. Edit this file to **remove your row**.
10. Commit the work + `CLAIMS.md` removal together with
    `<type>(<scope>): <subject>` per the repo style. Push.
11. If the pre-receive sanity wave rejects the push, fix and
    retry; never `--no-verify`, never force-push.

## Abort protocol (cutoff, operator kill, or scope blow-up)

When an agent cannot ship within the 60-minute cutoff, or the
operator kills the task via `TaskStop`, or the agent discovers
the scope is wrong mid-task, it must cleanly abort:

1. `git checkout -- <files-you-were-editing>` to discard WIP in
   your claimed files. Never touch files outside your claim.
2. Edit `CLAIMS.md` to remove your row.
3. `git pull --rebase origin v1.3.0-stable-release`.
4. `git add CLAIMS.md && git commit -m "claim: abort <task-id> — <one-line reason>"`
   and push. This releases the lock for other agents.
5. Report the abort reason to the operator: what was attempted,
   why it was cut short, and whether the task should be
   re-scoped, re-claimed, or removed from the board.

A kill without a clean abort leaves **orphaned claim rows** and
**dangling WIP** in the working tree. If you are the next agent
arriving and you find claim rows older than the 60-minute cutoff
with no matching `git log` activity, surface them to the
operator and ask whether to run the abort protocol on their
behalf — never silently clear.

## Active claims

_One row per in-flight task. Newest at the top. Remove your own
row when you ship; never remove someone else's unless stale
(>60 minutes without a commit) AND the operator has confirmed
it is safe to clear._

| agent | task-id | started | files touched | target commit |
|---|---|---|---|---|
| codex | design-dashboard-philosophy | 2026-04-13 17:42 CEST | `templates/dashboard.html`, `static/styles.css`, `CLAIMS.md` | `feat: apply catalyst dashboard design philosophy` |

## Stale-claim recovery

If you find a row older than 60 minutes with no visible progress
in `git log --since=1.hour.ago`, **do not silently clear it**.
The other agent may be paused mid-thinking, killed mid-flight,
or in a rebase retry loop. Surface the stale claim to the
operator and wait for explicit confirmation before running the
abort protocol on the other agent's behalf.

## Why this file exists

Multiple Claude agents can now run concurrently against the same
working tree (different chat sessions, possibly different
machines via the mini mirror). Without an advisory lock, two
agents will pick the same task, edit the same file, and one of
them will lose work to a rebase conflict. This file is the
advisory lock. Git is the authoritative safety net — the
pre-receive sanity wave catches anything that slips past.
