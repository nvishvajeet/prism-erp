# CATALYST ERP — Shipping Policy

**Rule of thumb: the live site must never be broken. Every production
change is vetted, versioned, and rollback-safe.**

This policy covers catalysterp.org (both ERP portals — Lab R&D and
Ravikiran Group HQ). It governs what code runs on the live mini, how
new work enters it, and how we cut stable releases.

---

## 1. Two git lanes — stable vs. dev

| Lane | Branch | Purpose | Who pushes | What runs there |
|------|--------|---------|------------|-----------------|
| **Stable** | `v1.3.0-stable-release` (and future `v1.X.Y-stable-release` tags) | The code the live site serves | Only after green pre-receive smoke + human vetting | gunicorn on the mini, behind cloudflared |
| **Dev** | `dev`, `codex/*`, `claude/*`, feature branches | Parallel agent work, crawls, experiments | Any agent or human, freely | Nothing production-facing |

The mini **only** runs code from the stable branch. Dev branches live
on the LOCAL bare (`~/.claude/git-server/lab-scheduler.git`) and on
worktrees; they never auto-deploy.

## 2. Versioning — semver `MAJOR.MINOR.PATCH`

We use three-part version numbers for every user-visible change:

- **MAJOR** (`1.x.x` → `2.0.0`) — new wave, large architectural shift,
  incompatible changes. Rare. Planned, announced, rehearsed.
- **MINOR** (`1.3.x` → `1.4.0`) — a new feature series shipped as a
  bundle (e.g. "Finance portal v2", "Dashboard BRIEF tile"). Lands on a
  fresh `v1.4.0-stable-release` branch after the bundle is complete and
  tested. Stacks of 3–10 commits is typical.
- **PATCH** (`1.3.0` → `1.3.1`) — bug fix, hotfix, small correction, or
  doc-only update. Lands on the current stable branch directly. Expected
  to be near-zero risk.

`APP_VERSION` in `app.py` is bumped in the same commit that changes the
behaviour. The footer on every page prints it, so operators always know
what live is running.

## 3. The path from dev → live

1. Work happens on a feature branch or worktree. Agents run tests there
   freely.
2. When the feature is complete, the author runs the full pre-commit
   gate locally (`smoke_test.py` + targeted unit tests).
3. The author bumps `APP_VERSION` if user-visible, writes a short
   changelog line in `CHANGELOG.md`, and commits.
4. The author pushes to the stable branch (`git push origin v1.3.0-stable-release`).
5. The LOCAL bare's **pre-receive smoke gate** runs — critical paths
   under three roles. A red gate rejects the push; the working tree is
   untouched on the mini.
6. If green, the post-receive hook mirrors the push to the mini's bare.
7. The mini's post-receive hook fast-forwards the working tree and HUPs
   gunicorn. Workers reload gracefully — no cold start, no dropped
   requests.
8. Smoke test runs once against `https://127.0.0.1:5055/` to confirm
   the deploy is live and healthy.

At no point is there a window where live is broken.

## 4. Hotfixes — the 60-minute path

When a user reports something broken on live:

1. Reproduce the issue, ideally with a small curl or test_client script.
2. Fix on the stable branch directly (no feature branch).
3. Bump the patch version: `v1.3.0` → `v1.3.1`.
4. Push. The pre-receive smoke gate runs before the mini sees the code.
5. Verify the fix on live with a second curl. If it works, tell the
   reporter. If it doesn't, revert (see §5) and keep debugging.

Hotfixes are single-commit by default. Stacking two fixes into one
commit is fine if they are one logical change.

## 5. Rollback — one command, always ready

Any commit on the stable branch can be reverted in under a minute:

```bash
git revert <bad-sha>
git push origin v1.3.0-stable-release
```

The revert commit goes through the same pre-receive smoke gate. If
green, the mini's working tree and gunicorn are back on the previous
known-good code within ~20 seconds of the push.

For emergencies (smoke gate broken, can't even push) the mini has a
local helper `scripts/rollback_to.sh <sha>` that fast-forwards the
working tree to a prior commit without going through git push.

## 6. What "data policy" looks like alongside shipping

The shipping policy controls **code** that runs. A parallel **data
policy** (see `DATA_POLICY.md`) controls what writes are allowed:

- The AI never deletes data on its own. Destructive writes require a
  logged-in human with the right role to click confirm.
- Some records are **holy** — closed finance rollups, paid payroll
  runs, approved sample-request trails, owner audit logs. These are
  only ever archived, never deleted.
- Every AI-originated write lands in an approval queue first. A human
  confirms before it takes effect.

## 7. Downtime budget

Zero unplanned downtime is the goal. The practical targets:

- **Patch release**: < 5 seconds of reload glitch (gunicorn HUP).
- **Minor release**: < 30 seconds, and only during announced windows
  (after a fresh stable-release branch cut).
- **Major release**: planned maintenance window, communicated to users
  24 h in advance.

If a deploy breaks and we need to roll back, the rollback itself counts
against the downtime budget. Two rollbacks in the same week is a signal
to slow down and tighten the pre-commit gate.

## 8. Who can push to the stable branch

- **Vishvajeet** (owner) — always.
- **Agents** (Claude, Codex, etc.) — via Vishvajeet's laptop only,
  running through the pre-receive smoke gate.
- **Nobody else directly.** Collaborators open a PR-style branch; an
  owner merges.

The mini itself **pulls, never pushes**. It has no credentials for the
LOCAL bare's push side. This prevents accidental drift from things
edited directly on the server.

## 9. Summary

> Dev is free. Stable is sacred. Every commit on the stable branch
> passes the smoke gate. Versions bump visibly in the footer. Rollback
> is always one push away. Live is never broken for more than a few
> seconds — and when it is, we know about it within the minute.
