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

## Read agents vs write agents

Not every agent needs a claim. The distinction is mechanical
and saves a lot of ceremony:

**Read agents.** An agent doing only discovery, investigation,
reporting, grep, file reads, `git log`, crawler runs, curl
checks, or documentation drafts that won't be committed. Read
agents **never edit, never commit, never push a tracked file.**
Their output is their chat report — their effect on the tracked
repo is zero.

**Writing to private/gitignored output is fine.** `reports/`
and `logs/` are `.gitignore`d in PRISM, and crawler runs
legitimately write JSON + text logs into `reports/*_log.json`
every invocation. That's still a read agent: the writes are
private per-run scratch output, nothing another agent will
consume, nothing git tracks. The rule is "no write to a
tracked file", not "no write to disk at all."

**Test-crawl parallelism, unlocked.** This is the biggest
practical win from the read/write split: `.venv/bin/python -m
crawlers wave sanity` / `behavioral` / `all` are all safe to
run **concurrently** in multiple shells. They each write to
their own `reports/<strategy>_log.json` + `<strategy>_report.txt`
(last-run wins within a single strategy name, which is fine),
they read every tracked file they need, and they never touch
anything outside `reports/` or `logs/`. An operator investigating
"which strategy is slow?" can fire 4 read agents at the full
wave in parallel and compare timings, with zero lane collision
concerns.

**Write agents.** An agent that will edit, commit, and push
one or more files. Write agents follow the full canonical
task lifecycle (claim → work → pull --rebase → commit → push)
and the git hygiene rules below.

### Rules that differ

| aspect                         | read agent | write agent |
|--------------------------------|------------|-------------|
| claim row in `CLAIMS.md`       | **not required**, skip it | **required** (unless single-operator serial mode and board is empty) |
| concurrent count limit         | **unlimited** | max **3** concurrent |
| 60-minute cutoff               | still applies | applies |
| git hygiene rules              | don't apply (no commits) | all 10 rules apply |
| collision risk with each other | **zero** — reads commute | real — needs lane awareness |
| collision risk with writers    | **zero** read → write; possible write → read if the reader was mid-grep when the writer committed (refetch and retry) | real both ways |

### Practical leverage

A read agent fleet can run while a single write agent ships
the actual fix. Example pattern:

```
fire  read-agent-1    "audit app.py for every Flask route that still reads user['role']"
fire  read-agent-2    "grep templates/ for any <form> without a csrf_token hidden input"
fire  read-agent-3    "run `crawlers wave all` against the current trunk, report the full pass/fail/warn breakdown"

            ... all three run concurrently, report back in ~2-5 min ...

fire  write-agent     "based on reader 1's findings, fix the 3 worst offenders in app.py"
            ... single write agent, no lane collision with readers ...
```

Net: the investigation phase went parallel-3x with zero
coordination overhead, and only the focused write step paid
the claim-and-commit ceremony.

### How the operator tells an agent which type to be

The agent type is set in the prompt. A read-agent brief says
**"Read-only task. Do not edit, commit, or push any file.
Report your findings in ≤N words."** A write-agent brief says
**"Write task. Follow the full claim → work → push lifecycle
per docs/PARALLEL.md. Files you may touch: X, Y, Z."** The
operator is responsible for the classification; if an agent
that was fired as read-only starts editing files, that's a
protocol violation and the abort protocol applies.

### Read agents and the 5% rule

The 5% merge-overhead rule applies to **write-agent fleets
only**. Read agents have zero merge overhead because they
don't commit, so adding readers never moves the percentage.
The concurrency cap of 3 applies only to write agents; the
read fleet is unlimited and can saturate whatever session
budget the operator has.

## Time budget and hard cutoff

Every task has a **60-minute hard cutoff** measured from the
claim commit to the work-commit push. A task that cannot ship
inside 60 minutes is either mis-scoped or blocked, and both of
those are the operator's problem to triage — don't grind past
the cutoff. Soft checkpoint at 30 minutes: if you are not on a
clear finish line, reassess.

Average successful loop for comparison: ~5 minutes for a doc
pass, ~20 minutes for a 50-line template change, ~40 minutes
for a new crawler strategy. Each push round-trip is ≤30 s in
the normal case (pre-receive sanity wave + the bare's
post-receive mini-mirror hook).

Timer starts on the `claim: <agent-id> — <task-id>` commit. If
you hit 60 minutes, run the abort protocol — do not push
half-finished work to free the lock.

## The 5% rule — when to parallelize

Parallelism is only worth it while merge overhead stays small
relative to the work being done. Above the threshold, the
ceremony (claim commits, rebase retries, conflict resolution,
stale-claim cleanup) eats the wall-clock gain and you would
have been better off serializing in-session.

The rule is **soft-target + hard-limit**, not a bright line:

| scope            | merge % of work | OR absolute cap |
|------------------|-----------------|-----------------|
| **soft target**  | ≤5 %            | ≤1 min          |
| **hard limit**   | ≤10 %           | ≤2 min          |

Either leg of the soft target is enough — a 20-minute task with
a 45-second merge is fine (under 5%), a 5-minute task with a
55-second merge is also fine (over 5% but under the 1-minute
absolute). The soft target is a rough guide; deviations are
expected and don't require stopping.

The **hard limit** is a wall. If a single task's merge cost
climbs above 2 minutes OR above 10% of the task's work time,
**abort the parallelism attempt**, serialize the remaining work
in-session, and surface the cause to the operator so the
underlying friction (hot file, stale claim, broken reloader,
whatever) can be addressed. Never grind past the hard limit
hoping it'll settle.

### Practical decision rules

- **Always parallelize when:** the tasks touch strictly
  disjoint files, each task is ≥15 minutes, and no task holds
  a hot-shared file (`app.py`, `base.html`, `_page_macros.html`,
  `static/styles.css`, `crawlers/waves.py`, `CLAIMS.md`). A
  15-minute task has a 45-second soft budget and a 90-second
  hard budget — easily met on disjoint lanes.
- **Serialize when:** the only available tasks all touch the
  same hot-shared file, OR a task is <5 minutes (the briefing
  overhead of firing an agent alone is ≥1 minute, which
  violates the absolute cap for short tasks — serialize
  in-session instead).
- **Cap concurrent agents at 3.** Race probability compounds
  combinatorially; above 3 concurrent claims the expected
  collision rate blows past the hard limit even on disjoint
  lanes. If you need >3 workers, chain them: 3 run in parallel,
  the 4th waits for a slot.

### How to estimate merge cost before firing

Before firing a background agent for task T, estimate in this
order:

1. **Lane collision** — does T's claim surface overlap any
   active claim row? If yes → serialize, merge cost is 100%.
2. **Hot-file concentration** — does T touch a file in the
   hot-shared list above? If yes → expected merge cost ~60 s
   (conflict resolution, not just rebase retry). Only parallel
   if T is ≥20 min (so 60 s fits under the 5% soft target).
3. **New-file creation** — does T create new files? If yes,
   add ~15 s for the "stage new files immediately" hygiene
   step (see git hygiene rule 3 below). Still well under
   budget for normal-length tasks.
4. **Concurrent push rate** — are there already ≥2 active
   claims? If yes, each new push has ~20% chance of
   non-fast-forward rejection and a rebase retry. Do not add
   a third concurrent agent unless T is ≥20 min of work.

Observed from the session that birthed this rule (2026-04-11):
mixed in-session + 6-agent-parallel work over ~3 hours, merge
overhead was estimated at <5% overall, dragged up primarily by
one agent's `git stash` race (now forbidden by rule 2) and a
stale-oracle `CHANGELOG.md` drift (now fixed by reading git
tags directly in `_dev_panel_progress()`). Hardening those two
specific causes kept the session-wide budget intact.

## Git hygiene — non-negotiable rules

These rules exist because every one of them has been broken at
least once in observed production runs and the resulting
failure cost real cleanup time. They are non-negotiable for
every agent, every task, every session:

1. **Start with a clean-or-claimed tree.** First command in
   any session: `git status --short`. Inspect every dirty file
   and every untracked file:
   - If all dirty/untracked files correspond to files listed
     in an **active claim row** in `CLAIMS.md`, proceed — they
     are legitimate in-flight work from a concurrent agent and
     will be cleaned up when that agent commits. Do not touch
     them.
   - If any dirty file does **not** correspond to an active
     claim row, it is orphaned WIP (probably from a killed
     agent). STOP and surface to the operator — never silently
     `git checkout --` a file you don't own and can't explain.
   - If your own claim surface is dirty, STOP. Your target
     file may have been mid-edited by something you don't
     know about. Surface to the operator.

   This rule was tightened from "tree must be empty" after a
   real race: a legitimate concurrent claim left a file dirty
   for ~30s while it committed, and a fresh agent refused to
   start during that window even though no orphan existed.
   The claim-aware check is strictly more correct than the
   emptiness check.
2. **Never `git stash`.** `stash pop` has been observed
   silently dropping edits on this repo, probably because the
   harness interleaves edits from multiple sources between the
   stash and the pop. The safe pattern is always
   commit-then-rebase. If you need to park work, make a WIP
   commit on top of your claim commit; never stash.
3. **Stage every new file immediately.** The moment you create
   `new_file.py`, run `git add new_file.py`. Untracked files
   block `git pull --rebase` — if another agent's concurrent
   commit adds a file at the same path, rebase refuses the
   overwrite and you lose wall-clock to sorting it out.
4. **Always `git pull --rebase`, never plain `git pull`.** A
   plain pull creates merge commits that can land on trunk;
   merge commits on `v1.3.0-stable-release` are noise at best
   and a rebase headache at worst. `--rebase` is the only
   reconciliation mode.
5. **Two commits per task minimum: claim first, work second.**
   Never bundle the claim row and the work in one commit — the
   claim commit is your lock, and it must land on origin
   before you edit any real file. Bundling them means other
   agents see your intent to touch a file only at the same
   instant the file changes, defeating the whole point.
6. **Pull `--rebase` again immediately before the final push.**
   Between your work starting and your work pushing, other
   agents may have landed commits. `git pull --rebase origin
   v1.3.0-stable-release` must be the step directly before
   `git push`, always.
7. **Never force-push. Never `--no-verify`. Never amend a
   published commit.** These are Level-1 kernel rules and they
   apply unchanged in parallel mode. If sanity rejects your
   push, fix in a new commit on top — amending the rejected
   commit is pointless because the rejected commit never
   reached the bare anyway, and amending a landed commit is a
   destructive rewrite that will fight the next rebase.
8. **Never touch files outside your claim.** Even if you find
   a typo. Even if it is "one line". Even if you are "already
   there". Every file outside your claim is someone else's
   lock or a shared surface — surface the issue and let the
   operator route it. The single biggest cause of conflicts
   has always been an agent widening scope silently.
9. **If a rebase surfaces a conflict in a file you did not
   claim, STOP.** That file belongs to someone else. Abort
   the rebase (`git rebase --abort`), surface to the operator,
   and wait. Do not "resolve" the conflict by guessing intent.
10. **Refresh the index before reading status.** If `git
    status` reports files dirty that you know you never
    touched, run `git update-index --refresh` and re-check.
    Stale index state from concurrent agents is real and has
    been observed.

## The canonical task lifecycle

A fresh agent starting a new chat session on this project
follows this loop. Every step is mandatory. Skip nothing.

1. **Sync.** `cd /Users/vishvajeetn/Documents/Scheduler/Main &&
   git pull --rebase origin v1.3.0-stable-release`.
2. **Clean-tree check.** `git status --short`. Must be empty.
   If not, surface to operator before touching anything else.
3. **Read the kernel + user-space context.**
   `~/.claude/CLAUDE.md` (Level 1) auto-loads at session
   start. Read `WORKFLOW.md` at the project root for the
   PRISM-specific Level-2 rules, especially §3.7. Do **not**
   pre-read the full `docs/` folder — `WORKFLOW.md` §4
   manifest points at what to read for the task at hand.
4. **Check the lock board.** `cat CLAIMS.md`. Note every file
   claimed by an active row and every row's `started` time.
   Any row older than 60 minutes is a candidate abort — do
   not touch it without operator confirmation.
5. **Pick a task.** From `docs/NEXT_WAVES.md` §"Parallel task
   board", pick an unclaimed row whose `files touched` column
   has zero overlap with active claims. Before claiming,
   **grep-verify** the task is not already shipped —
   `git log --oneline --all -- <target-file>` and
   `grep <key-symbol> <target-file>`. Two agents have already
   wasted a cycle claiming tasks that were already done; don't
   be the third.
6. **Claim it.** Append a new row to `CLAIMS.md`. Use the same
   ISO-8601 local-time format as the other rows. Then:
   ```
   git add CLAIMS.md
   git commit -m "claim: <agent-id> — <task-id>"
   git pull --rebase origin v1.3.0-stable-release
   git push origin v1.3.0-stable-release
   ```
   Push this commit **alone**, before any real work. This is
   your lock. If the push is rejected for non-fast-forward,
   `git pull --rebase` and retry — the pre-receive hook does
   not reject claim commits on its own.
7. **Do the work.** Edit the files listed in your claim row.
   **Never touch files outside your claim.** Stage new files
   (`git add`) immediately as you create them. Never `git
   stash`. Never force-push.
8. **Pre-commit gate.**
   - `.venv/bin/python scripts/smoke_test.py` (~5 s) — must
     pass. Non-negotiable.
   - If the task touched templates, routes, or CSS, also run
     `.venv/bin/python -m crawlers wave sanity` (~17 s) for a
     stronger pre-flight — the pre-receive hook will run this
     on the server anyway, so you save yourself a round-trip.
   - `bash -n <modified.sh>` for any shell script you edited.
9. **Absorb concurrent work.** `git pull --rebase origin
   v1.3.0-stable-release`. If the rebase surfaces a conflict
   in a file you did **not** claim, STOP and surface to the
   operator — it means the claim board lied.
10. **Release the claim.** Edit `CLAIMS.md` to remove your
    row. Leave every other agent's row untouched.
11. **Commit and push.** Stage the work files **plus** the
    `CLAIMS.md` row removal, commit with a normal
    `<type>(<scope>): <subject>` message, and push. The
    pre-receive sanity wave runs on the remote. If green, the
    push lands and your claim is released atomically with
    your work.
12. **Retry on hook rejection.** If the sanity wave fails,
    read the output, fix the problem in a new commit on top,
    and push again. Never `--no-verify`, never force-push,
    never amend.

## Abort protocol (cutoff, operator kill, or scope blow-up)

When an agent cannot ship within 60 minutes, the operator kills
it via `TaskStop`, or the agent discovers mid-task that the
scope is wrong, it must cleanly abort. Dirty aborts leave
orphaned claim rows and dangling WIP in the working tree,
which costs the next agent wall-clock to untangle.

1. **Discard WIP in your claimed files only.**
   `git checkout -- <files-you-were-editing>`. If you created
   new files, delete them (`rm <new.py>` or `git rm`). Do
   **not** touch anything outside your claim.
2. **Verify clean-adjacent.** `git status --short` should now
   show only `CLAIMS.md` as modified (because you are about
   to remove your row).
3. **Edit `CLAIMS.md`** to remove your row.
4. **Rebase-safe pull.** `git pull --rebase origin
   v1.3.0-stable-release`.
5. **Abort commit.**
   ```
   git add CLAIMS.md
   git commit -m "claim: abort <task-id> — <one-line reason>"
   git push origin v1.3.0-stable-release
   ```
6. **Report to operator.** What was attempted, why it was cut
   short, whether the task should be re-scoped, re-claimed,
   or removed from the board.

Operator-initiated kills (`TaskStop`) are a special case: the
killed agent cannot run the abort protocol because it is
dead. The **operator** (or the next arriving agent with
operator confirmation) must run the cleanup:

1. Check which files the dead agent was holding, both by
   reading its claim row in `CLAIMS.md` and by running
   `git status --short` to see dangling WIP.
2. `git checkout -- <dead-agent-files>` to discard the WIP.
3. Edit `CLAIMS.md` to remove the dead agent's row.
4. `git pull --rebase && git commit -m "claim: cleanup killed <task-id>"` and push.
5. Leave every other agent's row and WIP alone — some of the
   dirty files you see may belong to a different concurrent
   agent who is still alive.

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
