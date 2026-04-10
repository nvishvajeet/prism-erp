# Ollama Bridge — Dev Plan

How a local Ollama (MacBook) and a remote Ollama (Mac mini in
India over Tailscale) plug into PRISM development without ever
risking the working tree on `master`.

This file is the contract. Read it before running any
`run_ollama_task.sh` invocation.

## 1. Why bother

Claude is good at planning, architecture, auth, multi-file
refactors, and risky debugging. Ollama is good at mechanical,
bounded, grep-able tasks: wrapping `int(request.form[…])` calls,
adding hidden CSRF inputs to ~30 forms, drafting docstrings,
first-pass test stubs.

The goal is **never** to let Ollama replace Claude. The goal is
to drain the mechanical backlog in parallel during downtime so
that when Claude returns, it spends its tokens on judgment calls,
not boilerplate.

## 2. Physical layout

```
┌──────────────────┐                    ┌────────────────────┐
│ MacBook Pro      │                    │ Mac mini (India)   │
│ (local dev)      │ ─── Tailscale ───▶ │ 100.115.176.118    │
│                  │       SSH          │ sudo, always-on    │
│ Claude Code      │                    │ Ollama compute     │
│ Local Ollama     │                    │ Bare git mirror    │
│ (127.0.0.1:11435)│                    │ ~/git/lab-scheduler│
│                  │                    │ .git               │
│                  │ ◀── git fetch ──── │                    │
│                  │                    │ Working clone in   │
│                  │                    │ ~/Scheduler/Main   │
└──────────────────┘                    └────────────────────┘
```

- Local Ollama: `http://127.0.0.1:11435` (you must run
  `ollama serve` on a non-default port locally so it does not
  collide with the SSH-tunnelled remote).
- Remote Ollama: `http://127.0.0.1:11434` after the SSH tunnel
  is up (`ssh -L 11434:127.0.0.1:11434 vishwajeet@…`). The
  tunnel is opened automatically by `Remote Ollama Chat.command`
  and by `run_ollama_task.sh --mode=remote`.
- Git is the **only** sync layer between the two machines.
  Dropbox is local-only on the MacBook side.
- Local branch `master` pushes to remote `main`. This mismatch
  is intentional and is documented in `.git/config`.

## 3. The branch sandbox model

Ollama writes are sandboxed. Dev work on `master` is never
overwritten by an Ollama run, even a catastrophically broken one.

```
master          ●─●─●─●─●─●─●─●─●─●─●        (Claude verified, pushable)
                       │
ollama-work             ●─●─●─●─●─●─●        (Ollama frequent commits)
                                │
                                claude_last_seen tag
```

Rules:
1. `run_ollama_task.sh` ALWAYS works on the `ollama-work` branch.
   It refuses to run if `HEAD` is `master` / `main`. It checks
   out `ollama-work`, makes its edits, commits, and switches
   back.
2. Ollama commits are small and frequent — one task spec, one
   commit. Commit messages start with `ollama:` so they are
   trivially greppable.
3. The `claude_last_seen` tag marks the last `ollama-work`
   commit Claude has reviewed. On every Claude session resume,
   Claude:
   - Runs `git fetch --all --tags`
   - Lists `git log claude_last_seen..ollama-work --oneline`
   - Spawns one verification subagent per Ollama commit
   - Cherry-picks approved commits onto `master`
   - Advances `claude_last_seen` to the latest reviewed commit
   - Pushes `master` and the tag
4. Rejected commits stay on `ollama-work`. They are not deleted
   — they are evidence for tuning the next task spec.
5. If `ollama-work` diverges badly from `master`, Claude can
   reset it: `git checkout ollama-work && git reset --hard master`.
   This is the only sanctioned destructive operation in the
   bridge.

## 4. Run modes

`run_ollama_task.sh` has three modes:

| Mode     | Endpoint                       | Use when                              |
|----------|--------------------------------|---------------------------------------|
| `local`  | `http://127.0.0.1:11435`       | MacBook offline / Mac mini unreachable|
| `remote` | `http://127.0.0.1:11434` (tun) | Default; Mac mini is the heavy lifter |
| `dual`   | both, in parallel              | Cross-check; reject divergent outputs |

`dual` mode is the safest: same task, two models, only commit
if both produce the same accept-criteria signature. Slower and
more expensive, but the gold standard for unattended runs.

## 5. Task spec format

Every task Ollama runs is a Markdown file under `ollama_tasks/`
with five required sections:

```markdown
# Task: <short title>

## Goal
<one-paragraph plain-English description>

## Files in scope
- path/to/file1.py
- path/to/file2.html

## Forbidden files (must not touch)
- app.py (unless explicitly listed in scope)
- migrations/
- static/styles.css

## Acceptance criteria (grep-able)
- `grep -c "safe_int(request.form" app.py` >= 30
- `python smoke_test.py` exits 0
- `python tests/test_status_transitions.py` exits 0

## Rollback signal
Any failing acceptance check ⇒ `git reset --hard HEAD~1` on
`ollama-work` and exit non-zero. The driver script handles this.
```

The acceptance criteria are the contract. Ollama gets the spec;
the driver runs the criteria after every commit; failure rolls
back.

## 6. What Ollama IS allowed to touch

Whitelist (approve-on-sight on Claude's resume review):

- Adding `safe_int` / `safe_float` wraps around `int(request.form[…])`
- Adding `<input type="hidden" name="csrf_token" value="{{ csrf_token() }}">`
  to `<form method="post">` blocks in templates
- Adding docstrings to existing functions (no signature changes)
- Reformatting imports / running `ruff --fix` style cleanups
- Drafting test stubs in `tests/` (Claude reviews each)

## 7. What Ollama is NEVER allowed to touch

Blacklist (auto-reject on review, regardless of acceptance):

- `app.py` route definitions (the `@app.route(…)` lines)
- `request_card_policy()`, `request_scope_sql()`,
  `assert_status_transition()` and any other auth/visibility/
  state-machine logic
- `init_db()` schema definitions
- `static/styles.css` (the design rule says one CSS file, no
  drift; CSS edits are Claude's)
- Anything under `crawlers/` (crawler logic is the regression
  gate, not a target)
- `start.sh`, `requirements.txt`, env defaults

## 8. Claude's resume protocol

At the top of any Claude session that might have been preceded
by an unattended Ollama run, the very first action is:

```
./review_ollama_commits.sh
```

That script fetches, lists every commit on `ollama-work` since
the `claude_last_seen` tag, runs the regression suite against
each, and appends a structured block to `ollama_qc_log.md` with
an auto-suggestion (APPROVE / REJECT / NEEDS-REWORK) per commit.

Claude then:

1. Reads the new block in `ollama_qc_log.md`.
2. Spawns one verification subagent per non-trivial commit
   (the simple wraps may be approved at sight).
3. Writes the final decision (APPROVE / REJECT / DEFER /
   NEEDS-REWORK) into the QC log entry's "Claude decision" line.
4. Cherry-picks every APPROVE commit onto `master` in order.
5. Advances `claude_last_seen` to the latest reviewed commit,
   pushes `master:main` and the tag.
6. Commits the updated `ollama_qc_log.md` so the audit trail
   travels with the repo.

The verification subagent prompt is:

> You are reviewing commit `<sha>` on the `ollama-work` sandbox
> branch. The task spec is at `ollama_tasks/<spec>.md`. Verify:
> (1) only files listed in `Files in scope` were touched,
> (2) no files in `Forbidden files` were touched,
> (3) acceptance criteria still pass (re-run them),
> (4) the diff is mechanically what the spec asked for — no
> unrelated edits, no comments removed, no whitespace churn,
> (5) the change matches PRISM conventions (read PROJECT.md §11).
> Return APPROVE or REJECT plus a one-line reason that is safe
> to paste into ollama_qc_log.md.

## 9. The compressed v1.3.0–v1.5.0 plan

The dev plan is short because the architecture is strong. The
remaining work is mostly mechanical wraps + two real features.
Ollama-shaped items are tagged `[O]`.

| Item | Type | Notes |
|------|------|-------|
| 1.3.0-b CSRF on every form | `[O]` | ~30 templates, grep-driven, acceptance = `python smoke_test.py` + `wave sanity` pass |
| 1.3.0-c safe_int / safe_float wraps | `[O]` | ~30 sites in app.py, acceptance = 0 unwrapped int(request.form…) remain + `wave sanity` pass |
| 1.3.0-d state-transition test | done | committed 397d963 |
| 1.4.0 bulk operations | Claude | new route `schedule_bulk_actions`, real work |
| 1.5.0 FTS5 search | Claude | virtual table + triggers + new search route |

**Dropped**: 1.3.0-a `request_detail()` handler split. The
state machine already guards every status write through
`assert_status_transition()`, and `tests/test_status_transitions.py`
locks the legality matrix. The 685-line function is ugly but
not unsafe — splitting it is cosmetic, costs hours, and risks
regressions for zero user value. Revisit if the function grows
past ~900 lines.

Estimated total: ~5h Claude time + ~3h Ollama time, runnable
in parallel during downtime.

## 10. Daily rhythm

```
                Local MacBook                 Mac mini (background)
─────────────── ──────────────────            ────────────────────
session start   git fetch --all --tags
                review ollama-work commits
                cherry-pick approved → master
                advance claude_last_seen
                git push origin master:main
                git push --force-with-lease origin claude_last_seen

work            Claude does real dev
                writes ollama_tasks/*.md       
                push to ollama-work            run_ollama_task.sh
                                               picks up the spec
                                               commits result

session end     git push origin master:main    keep running
                                               (cron / launchd)
```

## 11. Files in this bridge

| File                          | Role                                    |
|-------------------------------|-----------------------------------------|
| `OLLAMA_DEV_PLAN.md`          | This file. The contract.                |
| `setup_remote.command`        | One-time interactive setup of Mac mini  |
| `run_ollama_task.sh`          | The driver. Sandboxed, commits, rolls back |
| `review_ollama_commits.sh`    | Claude's session-start QC gate          |
| `ollama_qc_log.md`            | Claude's audit trail of Ollama commits  |
| `Remote Ollama Chat.command`  | Interactive chat (already exists)       |
| `ollama_tasks/`               | Task specs, one Markdown per task       |
| `ollama_outputs/`             | Raw Ollama responses, gitignored        |
| `ollama_chats/`               | Chat logs, gitignored                   |

## 12. Honest expectations

Ollama is not a programmer. It is a fast text transformer with
weak code judgment. The Ollama bridge will pay off if and only
if every task Ollama gets has:

1. A grep-able acceptance criterion.
2. A small file scope (ideally one file).
3. A pre-existing pattern in the codebase to imitate.
4. A rollback path that costs nothing.

For PRISM specifically the realistic Ollama wins are 1.3.0-b
and 1.3.0-c. Everything else in the roadmap is Claude-shaped.
That is fine — the bridge is built to make the small wins
unattended, not to replace the hard work.

## 13. The QC log (`ollama_qc_log.md`)

`ollama_qc_log.md` is the audit trail. It is a checked-in
Markdown file with one block per Claude review session, one
sub-entry per Ollama commit. The schema:

```markdown
## Session qc-YYYYMMDD-HHMMSS (timestamp)

- Commits found: N
- Range: `<old-sha>..<new-sha>`

### <short-sha> — <commit subject>

- Author: <name>
- Files (N): `path1 path2 …`
- Diff: +X / -Y
- smoke_test.py: `PASS|FAIL|SKIP`
- test_status_transitions.py: `PASS|FAIL|SKIP`
- Auto-suggestion: **APPROVE | REJECT | NEEDS-REWORK**
- Reason: …
- Claude decision: APPROVE | REJECT | DEFER | NEEDS-REWORK
- Notes: …

### Session summary
- Auto-passed: N
- Auto-flagged: N
```

`review_ollama_commits.sh` writes everything except the
**Claude decision** and **Notes** lines. Claude fills those in,
commits the updated log, then cherry-picks the APPROVE commits.

Auto-flag rules implemented today:

| Trigger                                       | Suggestion     |
|-----------------------------------------------|----------------|
| Touched any file in §7 blacklist              | NEEDS-REWORK   |
| Touched `app.py` (soft block — needs review)  | NEEDS-REWORK   |
| `smoke_test.py` failed                        | REJECT         |
| `tests/test_status_transitions.py` failed     | REJECT         |
| Diff touched > 5 files                        | NEEDS-REWORK   |
| Diff added > 200 lines                        | NEEDS-REWORK   |
| Otherwise                                     | APPROVE        |

These are heuristics, not gates. Claude has the final word and
writes it into the **Claude decision** line. The QC log file is
the single source of truth for "what did Ollama do, what did we
keep, and why."

The log is intentionally checked into the repo (not gitignored)
so the audit trail travels with the code. If three Ollama commits
in a row get rejected for the same reason, that is a signal to
rewrite the task spec, not to keep running it.
