# Continuous Crawler Cluster

This directory documents the three-machine Catalyst verifier pool:

- `macbook` — editing + aggressive local verification, while leaving about 10% interactive headroom
- `mini` — production-serving verifier, preferred for heavy waves
- `imac` — optional dev-pool verifier, full-power when reachable

## Purpose

`WORKFLOW.md` already defines the policy. This folder adds the repo-side
entry point that makes the policy runnable instead of purely verbal.

The command is:

```bash
./venv/bin/python scripts/cluster_wave.py status
./venv/bin/python scripts/cluster_wave.py sanity
./venv/bin/python scripts/cluster_wave.py cluster
./venv/bin/python scripts/cluster_wave.py heavy
```

## Modes

- `status` — confirms the reachable machine set, branch, and Python runtime
- `sanity` — local smoke + local smoke crawler, remote sanity wave on mini/iMac
- `cluster` — `sanity` plus extra remote read-only crawlers
- `heavy` — remote `wave all` on non-local verifier machines only

## Environment Variables

These can be exported in the shell or launchd plist environment.

```bash
CATALYST_MINI_HOST=vishwajeet@100.115.176.118
CATALYST_MINI_REPO=~/Scheduler/Main
CATALYST_MINI_PYTHON=.venv/bin/python

CATALYST_IMAC_HOST=user@imac-host
CATALYST_IMAC_REPO=~/Scheduler/Main
CATALYST_IMAC_PYTHON=.venv/bin/python
```

If `CATALYST_IMAC_HOST` is unset, the iMac lane is skipped automatically.

## Safety Rules

- This runner is verification-only. It does not pull, push, rebase, or edit tracked files.
- The MacBook remains the write coordinator.
- The MacBook may also be used aggressively for verification now, as long as roughly 10% headroom remains for the human's foreground work.
- The Mac mini is used for heavy verification, not ad-hoc editing.
- The iMac is optional until it has a stable SSH endpoint.

## Recommended Usage

For normal work:

```bash
./venv/bin/python scripts/cluster_wave.py sanity
```

For a wider burn:

```bash
./venv/bin/python scripts/cluster_wave.py cluster
```

For off-hours verification:

```bash
./venv/bin/python scripts/cluster_wave.py heavy
```
