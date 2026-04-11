# Active agent claims — PRISM live task board

> **This file is the lock board for parallel agent work on PRISM.**
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
6. `git pull --rebase origin v1.3.0-stable-release` to absorb any
   concurrent commits that landed while you were working.
7. Edit this file to **remove your row**.
8. Commit the work + `CLAIMS.md` removal together with
   `<type>(<scope>): <subject>` per the repo style. Push.
9. If the pre-receive sanity wave rejects the push, fix and retry;
   never `--no-verify`, never force-push.

## Active claims

_One row per in-flight task. Newest at the top. Remove your own
row when you ship; never remove someone else's unless stale
(>2 hours without a commit) AND the user has confirmed it is safe
to clear._

| agent | task-id | started | files touched | target commit |
|---|---|---|---|---|
| claude-ui-sitemap-hover | template-polish/sitemap-hover-polish | 2026-04-11T12:19+02:00 | `templates/sitemap.html`, `static/styles.css` | ui(sitemap): hover polish on role-scoped links |
| claude-docs-philosophy-parallel | docs-freshness/philosophy-md-parallel-rules | 2026-04-11T12:18+02:00 | `docs/PHILOSOPHY.md` | docs(philosophy): document parallel agent protocol composition |
| claude-docs-tile-pattern | docs-freshness/project-md-tile-pattern | 2026-04-11T12:14+02:00 | `docs/PROJECT.md` | docs(project): document .tile family as reusable abstraction |
| claude-crawler-metadata-trim | crawlers/optimize-metadata | 2026-04-11T11:55+02:00 | `crawlers/base.py`, `crawlers/harness.py`, `crawlers/strategies/*.py` (metrics producers only — read-only for the rest) | perf(crawlers): drop unused metadata tracking |

## Stale-claim recovery

If you find a row older than 2 hours with no visible progress in
`git log`, **do not silently clear it**. The other agent may be
paused mid-thinking. Surface the stale claim to the user and
wait for explicit confirmation before removing it.

## Why this file exists

Multiple Claude agents can now run concurrently against the same
working tree (different chat sessions, possibly different
machines via the mini mirror). Without an advisory lock, two
agents will pick the same task, edit the same file, and one of
them will lose work to a rebase conflict. This file is the
advisory lock. Git is the authoritative safety net — the
pre-receive sanity wave catches anything that slips past.
