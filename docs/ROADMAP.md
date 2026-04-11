# PRISM roadmap — historical pointer

The authoritative forward plan is `docs/NEXT_WAVES.md` as of
2026-04-11 @ `18cef1f`. This file is kept for historical context
only — do not edit it, and do not read it for planning.

## What ROADMAP.md used to be

Before 2026-04-11, this file was a version-scoped wave backlog
written as long prose. It carried a `Current state` snapshot for
the then-current `v1.3.x` line, per-wave descriptions for the
upcoming `W1.3.6` through `W1.4.0` patches, a `Crawler waves at a
glance` table, and a `Guardrails` section covering wave timing,
crawler-proof commit policy, and the `.tile-*` / `data-vis`
contract for new tiles.

## Why it was superseded

A single prose file went stale quickly: waves shipped, plans
shifted, and the checkbox-in-the-middle-of-a-paragraph pattern
was invisible to any crawler. `NEXT_WAVES.md` replaces it with a
tighter structure — a progress-of-features table, a
blocked/HARD-TODO exception list, and a parallel task board —
that the dev panel's WAVES tile parses directly, so it stays
fresh by construction instead of by agent discipline.

## Where to find what

* `docs/NEXT_WAVES.md` — forward plan, progress-of-features
  table, blocked/HARD-TODO exception list, parallel task board.
* `CHANGELOG.md` — shipped work per version.
* `CLAIMS.md` — live agent activity (advisory lock board).
* `AGENTS.md` — vendor-neutral agent onboarding.
* `WORKFLOW.md` — Claude-specific Level-2 rules.
* `docs/PROJECT.md` — architecture spec (deep reference).

The pre-supersession contents of this file are preserved in
`git log docs/ROADMAP.md`; `1365db1` is the last commit before
retirement.
