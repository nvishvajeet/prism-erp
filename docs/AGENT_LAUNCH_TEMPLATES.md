# CATALYST — Agent Launch Templates

This file is the operator quickstart for firing parallel agents during a
live sprint. Use it together with `docs/PARALLEL.md` and `CLAIMS.md`.

## How to use this file

1. Pick a lane.
2. Copy one template below.
3. Replace the placeholders.
4. Send it to the agent unchanged except for the placeholders.

Keep prompts narrow. One lane, one surface, one proof command.

## Read crawler

```text
Read-only task. Lane: crawl-read.
Do not edit, commit, or push tracked files.

Repo: ~/Documents/Scheduler/Main
Surface: <login / dashboard / instrument detail / admin users / etc.>

Run the highest-signal crawlers or direct inspection for this surface.
Look for broken flows, hidden actions, negative-path failures, awkward UI,
or stale assumptions. If you need to leave persistent output, write one
handoff file under tmp/agent_handoffs/<task-id>/.

Return:
1. exact failing or awkward paths
2. affected files
3. whether this is app bug / crawler assumption stale / works as designed
4. one proof command to rerun after the fix
```

## UI polish writer

```text
Write task. Lane: ui-polish.
Follow docs/PARALLEL.md and claim files first in CLAIMS.md.

Repo: ~/Documents/Scheduler/Main
Surface: <login / change-password / dashboard / user profile / etc.>
Files you may touch: <templates/...>, <static/styles.css>

Goal: improve this surface without changing controller logic or widening
scope into unrelated pages.

After the patch, run:
<proof command>
```

## Controller fix writer

```text
Write task. Lane: controller-fix.
Follow docs/PARALLEL.md and claim files first in CLAIMS.md.

Repo: ~/Documents/Scheduler/Main
Bug: <redirect loop / wrong role gate / hidden save path / wrong payload>
Files you may touch: <app.py>, <minimum paired template if needed>

Goal: fix the behavior bug with the smallest safe change.

After the patch, run:
<proof command>
```

## Crawler contract writer

```text
Write task. Lane: crawler-fix.
Follow docs/PARALLEL.md and claim files first in CLAIMS.md.

Repo: ~/Documents/Scheduler/Main
Strategy: <smoke / visibility / role_landing / topbar_badges / etc.>
Files you may touch: <crawlers/...> and only the directly related contract
files needed to keep the crawler truthful.

Goal: fix stale crawler assumptions or add missing coverage without doing
unrelated product redesign.

After the patch, run:
<proof command>
```

## Docs / handoff writer

```text
Write task. Lane: docs-handoff.
Follow docs/PARALLEL.md and claim files first in CLAIMS.md.

Repo: ~/Documents/Scheduler/Main
Deliverable: <manual / onboarding / release note / build rule / process doc>
Files you may touch: <docs/...>, <AGENTS.md>, <WORKFLOW.md>, <CLAIMS.md>

Goal: write operator-facing or agent-facing guidance that reduces future
coordination cost.

After the patch, run:
<proof command if any, otherwise "no runtime proof required">
```

## Release owner

```text
Integration task. Lane: release-owner.
Do not start new feature work.

Repo: ~/Documents/Scheduler/Main

Watch CLAIMS.md, collect finished lanes, rerun smoke and sanity, and tell
me which changes are safe to move toward stable. If two lanes overlap,
serialize them. If a lane is not ready, leave it in dev.
```

## Good defaults for proof commands

- UI route change:
  `./venv/bin/python -m crawlers run smoke`
- auth or role fix:
  `./venv/bin/python -m crawlers run role_behavior`
- hidden-button / 404 / route issue:
  `./venv/bin/python -m crawlers run dead_link`
- broader safe gate:
  `./venv/bin/python -m crawlers wave sanity`
