# PRISM — parallel agent work protocol

_Anchored 2026-04-11. This doc is the canonical description of_
_how multiple Claude agents run concurrently against this_
_codebase without stepping on each other. `CLAIMS.md` at the_
_repo root is the live lock board that implements the protocol._
_`WORKFLOW.md` §3.7 is the one-paragraph pointer a fresh agent_
_should follow on session start._

## Why parallelism at all

PRISM is a 7000-line Flask single-binary with a crawler suite,
a doc library, and active ops/UX/test work all in flight at
once. Serializing every task behind one agent wastes wall-clock
time. With three safety nets in place — the advisory lock
(`CLAIMS.md`), git's own merge discipline (`pull --rebase`),
and the pre-receive sanity wave on the central bare — multiple
agents can work the trunk in parallel and the worst failure mode
is a temporary push rejection that the agent fixes and retries.

## The three safety layers

**Layer 1 — advisory lock (`CLAIMS.md`).** Agents declare which
files they intend to edit before starting. Other agents skip
tasks that touch claimed files. This is cheap, visible, and
text-diffable, but it is **advisory only** — it does not prevent
concurrent edits, it just makes collisions obvious and
intentional.

**Layer 2 — git merge discipline.** Every agent runs `git pull
--rebase origin <branch>` immediately before their final push.
If two agents touched the same file, the rebase either
fast-forwards cleanly or surfaces a merge conflict the agent
must resolve before push. **Agents never force-push and never
skip hooks**, per Level 1 kernel rules.

**Layer 3 — pre-receive sanity wave.** The central bare at
`~/.claude/git-server/lab-scheduler.git` runs
`python -m crawlers wave sanity` on every push. A push that
would break smoke, visibility, role_landing, topbar_badges,
empty_states, dev_panel_readability, contrast_audit, or
deploy_smoke is **rejected before it lands**. This is the final
correctness gate and it is unconditional — it runs for every
agent, every push, even doc-only commits.

## The canonical task lifecycle

A fresh agent starting a new chat session on this project
follows this loop:

1. **Sync.** `cd ~/Documents/Scheduler/Main && git pull origin
   v1.3.0-stable-release`.
2. **Read the kernel + user-space context.** `~/.claude/CLAUDE.md`
   (Level 1) auto-loads at session start. Read `WORKFLOW.md` at
   the project root for the PRISM-specific Level-2 rules. Do
   **not** pre-read `docs/` — `WORKFLOW.md` §4 manifest points
   at what to read for the task at hand.
3. **Check the lock board.** `cat CLAIMS.md`. Note every file
   claimed by an active row.
4. **Pick a task.** From `docs/NEXT_WAVES.md` §"Parallel task
   board", pick an unclaimed row whose `files touched` column
   has zero overlap with active claims.
5. **Claim it.** Append a new row to `CLAIMS.md`. Use the same
   ISO-8601 timestamp format as the other rows. Then:
   ```
   git add CLAIMS.md
   git commit -m "claim: <agent-id> — <task-id>"
   git push origin v1.3.0-stable-release
   ```
   Push this commit alone, before any real work. This is your
   lock. If the push is rejected because another agent pushed
   first, `git pull --rebase` and retry the push — the
   pre-receive hook will not reject a claim commit on its own.
6. **Do the work.** Edit the files listed in your claim row.
   **Do not touch files outside your claim** — if you discover
   mid-task that you need a file another agent holds, pause and
   surface the collision to the user instead of silently
   widening the claim.
7. **Pre-commit gate.** Run `.venv/bin/python scripts/smoke_test.py`
   (≈5s). It must pass green before your commit lands. If the
   task was template- or route-touching, also run
   `.venv/bin/python -m crawlers wave sanity` (≈17s) for a
   stronger pre-flight check — the pre-receive hook will run
   this on the server anyway, so you save yourself a rejection
   round-trip.
8. **Absorb concurrent work.** `git pull --rebase origin
   v1.3.0-stable-release`. If the rebase surfaces a conflict
   that is not in a file you claimed, **stop and surface it
   to the user** — it means the claim board lied, which is a
   bug in whoever wrote the claim. Don't silently "fix" someone
   else's work.
9. **Release the claim.** Edit `CLAIMS.md` to remove your row.
10. **Commit and push.** Stage the work files **plus** the
    `CLAIMS.md` row removal, commit with a normal
    `<type>(<scope>): <subject>` message, and push. The
    pre-receive sanity wave runs on the remote. If green, the
    push lands and your claim is released in the same atomic
    step as your work.
11. **Retry on hook rejection.** If the sanity wave fails on the
    remote, read the output, fix the problem in a new commit,
    and try again. Never `--no-verify`, never force-push.

Average successful loop: ~20 minutes for a 50-line template
change, ~40 minutes for a new crawler strategy, ~5 minutes for
a doc pass. Each push round-trip is ≤30s in the normal case
(sanity wave + the bare's mini-mirror hook).

## Lane taxonomy (which files live together)

Tasks are grouped into **lanes** by file surface. A lane is a
collection of files that tend to be edited together. Two agents
in the same lane at the same time are a collision risk; two
agents in different lanes can usually run in parallel with
zero friction.

| lane                | primary surface                                                          | notes                                                                          |
|---------------------|--------------------------------------------------------------------------|--------------------------------------------------------------------------------|
| `crawler-expansion` | `crawlers/strategies/*.py`, `crawlers/waves.py`, `crawlers/__init__.py` | New strategy files are isolated; `waves.py` is a shared serialize point.       |
| `template-polish`   | `templates/*.html` (exactly one at a time per agent)                     | Per-template claims. `base.html` and `_page_macros.html` are shared hot files. |
| `app-backend`       | `app.py`                                                                 | Single-agent lane. `app.py` is ~7k lines; two agents here is always a conflict.|
| `css-hygiene`       | `static/styles.css` only                                                 | Single-agent lane. Merge conflicts in CSS are ugly to resolve.                 |
| `ops-infra`         | `ops/`, `scripts/`, `.env*`                                              | Low collision with product code. Deploy work lives here.                       |
| `docs-freshness`    | `docs/*.md`, `README.md`, `CHANGELOG.md`                                | Per-file claims. Cheap; usually runs in parallel fine.                         |
| `tests`             | `tests/*.py`                                                            | Per-file claims. New unit tests are isolated.                                  |
| `schema`            | `app.py` + `scripts/migrate_*.py` + templates + crawlers                | **Sequential only.** No parallelism inside a schema wave.                      |

A claim row **must name its lane** in its task-id prefix (e.g.
`ui-polish/request-detail-header-pass`). The lane tells other
agents whether they can safely work adjacent to you.

## Failure modes and how to recover

**Two claims on the same file.** Layer 1 (advisory) failed.
Whichever agent pushes first wins; the second gets a rebase
conflict and must either drop their work into a new task, or
manually merge. If the conflict is non-trivial, surface to the
user and let them arbitrate.

**Sanity wave rejection on push.** Layer 3 did its job. Read
the wave output, identify the failing strategy, reproduce
locally with `python -m crawlers wave sanity`, fix the problem
in a new commit on top, and push again. Do **not** amend —
amending a rejected commit is fine if you never pushed, but
once the bare has the commit it is published, and amending
creates a non-fast-forward that will be rejected anyway.

**Stale claim.** A row older than ~2 hours with no matching
commit activity in `git log --oneline --since=2.hours.ago`.
Don't silently clear — the other agent may be paused mid-think
or their session may have died. Ask the user. If they confirm
the claim is abandoned, remove it in a commit with subject
`claim: cleanup stale <task-id>`.

**Silent concurrent corruption.** An agent edited a file they
did not claim, and the edit slipped past because the lane had
no other activity. The pre-receive sanity wave is the last
defense here. If something makes it past sanity but breaks
later (e.g. a broken route that isn't in the smoke suite),
bisect with `git bisect` and fix on trunk — don't revert
blindly, per the Level 1 "never use destructive git commands
without explicit authorization" rule.

## Concrete example — two agents, one morning

```
09:00  agent-A claims  ui-polish/instruments-list-empty-state
09:00  agent-B claims  crawler-expansion/ui-uniformity-crawler
09:02  both  push claim commits, both accepted
09:15  agent-A  edits templates/instruments.html
09:20  agent-B  creates crawlers/strategies/ui_uniformity.py
09:25  agent-B  edits crawlers/waves.py to register strategy
09:30  agent-B  pre-commit: smoke green, sanity green
09:30  agent-B  pull --rebase → fast-forward, no conflict
09:31  agent-B  commit+push, sanity wave on bare → green, lands.
              CLAIMS row removed. Lane free.
09:35  agent-A  pre-commit: smoke green
09:35  agent-A  pull --rebase → absorbs agent-B's commit cleanly
                (different file), no conflict
09:36  agent-A  commit+push, sanity wave on bare → green, lands.
```

Both agents finished within 36 minutes of wall-clock, producing
two independent commits and zero conflicts. This is the target
behavior. Any deviation from it (rejection loop, stale claim,
manual conflict resolution) is a signal to pause and think about
whether the task decomposition in `NEXT_WAVES.md` is wrong.

## What this protocol does NOT provide

* **Cross-machine claim visibility before push.** A claim is only
  visible to other agents after it lands in the central bare.
  If two agents prepare claim commits locally at the exact same
  moment, both will push; one will be rejected and have to
  rebase. That is fine and expected.
* **Task scheduling.** Agents pick tasks themselves from
  `NEXT_WAVES.md`. There is no queue, no assigner, no priority.
  If two agents both want the highest-value task, the faster
  claim wins.
* **Automatic stale-claim cleanup.** Deliberately. Cleaning a
  stale claim is a judgment call that needs a human — either
  the user or another agent with user confirmation.
* **Protection against a malicious agent.** The protocol assumes
  all agents are cooperating in good faith. This is fine for
  Claude sessions under one user; it is not a security boundary.
