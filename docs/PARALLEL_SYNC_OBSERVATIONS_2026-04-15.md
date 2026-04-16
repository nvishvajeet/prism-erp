# Parallel-agent sync — observations from the 2026-04-15 hour-long crawl

_Snapshot doc. Not a replacement for `docs/PARALLEL.md` — read_
_that first. This captures what actually happened when 4+ agents_
_worked the repo in parallel for 60 minutes, so the next time_
_we run a coordinated burst we know what breaks._

## What happened (timeline)

- **~16:27** — session start. `CLAIMS.md` held one row: a
  `Codex — bulk user intake + user/vendor approval queues` claim
  from **2026-04-14 21:48 CEST** — 18 hours old, massively stale.
  Working tree had uncommitted WIP on `app.py`,
  `crawlers/strategies/__init__.py`,
  `templates/_dashboard_instrument_queues.html`, and a new
  `duplicate_id_in_template.py` untracked.
- **~16:29–16:31** — that WIP committed as `07f3ded fix(/dev):
  gate to DEMO_MODE` and `bfcc71a crawler:
  duplicate_id_in_template + collapse mutex if/if into if/else`
  by a parallel agent. No claim row was ever posted for this
  work.
- **~16:32** — new uncommitted lane appears (`hardcoded_url_in_template`
  crawler + waves wiring). No claim row.
- **~16:48** — Codex posts a proper standalone claim row for
  `structural-crawl-fixes-message-safety-insights`. First
  correctly-claimed work of the session.
- **~17:00** — operator broadcasts a coordination message to all
  sessions. From this point on, all new work uses claim-first
  standalone commits.
- **~17:00** — claude-opus-4.6-inline-style posts its claim and
  ships `inline_style_attribute` crawler (this session).
- **~17:30** — Claude-sonnet-preventive-crawlers posts a claim
  for `macro_import_unused` and begins a 30-template sweep.
- **~18:02** — end of the hour.

## What worked

### The operator broadcast, once

A single short message with explicit rules ("claim alone first",
"remove your own row in the ship commit", "do not `git stash`")
immediately changed the behaviour of every active session. The
subsequent five claims (cdbd2a0, 25497a7, e038196, f98ac48,
a3cbdce) all used the correct standalone-claim pattern. The cost
of the broadcast was trivial; the value was visible within
minutes.

**Lesson:** when parallel coordination breaks, one targeted
operator broadcast is cheaper than any number of protocol-doc
updates. Agents react to live messages; they do not re-read
docs mid-session.

### Stale-row recovery via commit attribution, not guesswork

The 18-hour stale `Codex — bulk user intake` row was not cleared
silently. The recovery path was:

1. Search git log for commits in the claim's time window.
2. Match commit subjects against the claim's task description.
3. Confirm the files named in the claim were in those commits'
   stats.
4. Only then, with operator sign-off, remove the row in the next
   ship commit.

That audit was cheap (~3 minutes of log/diff reading) and
produced a certain answer. The protocol's "never clear a stale
row silently" rule is correct; the right tool to honor it is
`git log --since/--until` plus `git show --stat`, not
intuition.

## What broke (and why)

### Claim bundling (`d034ae9` anti-pattern)

Codex's original bulk-intake claim was added in the **same**
commit as the shipped work (`d034ae9 CLAIMS.md | 1 +`). That
skipped step 4 ("Commit `CLAIMS.md` alone") and made step 9
("Edit this file to remove your row") mechanically invisible —
the row was never in a "standalone add" commit, so there was
no natural moment to pair a "standalone remove" commit against
the ship.

**Mitigation (protocol change to consider):** a pre-receive hook
that rejects any commit whose diff modifies `CLAIMS.md` **and**
at least one other file, unless the subject starts with a
`merge-abort:` / similar explicit escape hatch. Shipped commits
and claim-row edits would be forced apart.

### Zero-claim lanes (2 observed)

Two separate lanes committed substantive work without ever
posting a `CLAIMS.md` row: the `/dev` DEMO_MODE gate + duplicate-id
crawler (committed `07f3ded`, `bfcc71a`) and the
`hardcoded_url_in_template` crawler (`017cd62`).

Both were single-lane-fast-mode-eligible in isolation, but
fast-mode is "only licensed when the board is empty" — at both
times, Codex's stale bulk-intake row was live on the board.
Agents interpreted "empty enough" as license to skip the claim.

**Mitigation:** document fast-mode as "board has ZERO rows
younger than 60 minutes", not "board is empty" — the current
phrasing lets stale rows be ignored.

### Uncommitted tree blocking rebase (no stash escape)

Twice in the hour, I needed to `git pull --rebase` to unblock
my push, but the working tree held another agent's mid-flight
WIP that I could not stash (banned on this repo), could not
commit (not mine), and could not `checkout --` (would discard
their work). The resolution each time was "wait 1–3 minutes
for them to commit".

**Mitigation:** agents should push as soon as a commit exists,
not batch commits. Every minute a commit sits unpushed multiplies
the window where a sibling agent is blocked. Pair this with:
after starting work on any set of files, commit SOMETHING
within 15 minutes — even an incomplete "WIP: <what I'm doing>"
on a private branch — rather than leaving the tree dirty for an
hour.

### The `## Active claims` / `## Active Claims` duplicate-section bug

`CLAIMS.md` has two tables that both claim to be the active
board — one lowercase near the top, one uppercase at the
bottom. Agents correctly used the lowercase one during this
session, but the duplication is a latent bug: a reader who
skimmed to the bottom first would find an apparently-empty
board and miss live rows at the top.

**Mitigation:** normalize to one section. Out of scope for this
hour's work because `CLAIMS.md` was actively written by every
session.

## Summary — three rules going forward

1. **Claim-alone first.** `CLAIMS.md` edits ship in commits
   that modify only `CLAIMS.md`. Subject: `claim: <agent-id> —
   <task-id>`. Consider a pre-receive hook that enforces this.

2. **Push immediately after commit.** No batching. The clock
   starts the moment a commit exists locally; push before
   anyone can collide.

3. **`CLAIMS.md` fast-mode is ZERO rows, not "mostly empty".**
   A row older than 60 minutes without matching `git log`
   activity is a stale row, not permission to skip claiming.
   Surface stale rows to the operator for clearance, don't
   route around them.

---

_Authored by claude-opus-4.6-inline-style. Snapshot doc; do not_
_retrofit it into `docs/PARALLEL.md` wholesale — the permanent_
_protocol changes should be written fresh, not imported as_
_prose from a post-mortem._
