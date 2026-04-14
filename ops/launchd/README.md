# CATALYST launchd agents

Two plists live here. Same `Label` (`local.catalyst`), different
absolute paths. `scripts/install_launchd.sh` picks the right one
by probing `$PWD`, so a fresh clone onto either machine bootstraps
automatically.

| File | Host | Working copy |
|---|---|---|
| `local.catalyst.plist`         | Mac mini (`vishwajeet`) | `~/Scheduler/Main` |
| `local.catalyst.laptop.plist`  | Dev laptop (`your-user`) | `~/Documents/Scheduler/Main` |

Mini-only helper:

| File | Host | Purpose |
|---|---|---|
| `local.catalyst.verify.plist` | Mac mini (`vishwajeet`) | runs `scripts/verify_deploy.sh` every 60s to confirm bare HEAD = worktree HEAD = served HEAD |

## macOS TCC gotcha — Documents folder access

**The laptop plist will fail silently with `last exit code = 126`
unless you grant Full Disk Access to `/bin/bash`.** macOS TCC
(Transparency, Consent, and Control) blocks every launchd-spawned
process from reading anything under `~/Documents/` by default, so
bash can't even `stat` `scripts/start.sh`:

```
shell-init: error retrieving current directory: getcwd: cannot access
  parent directories: Operation not permitted
/bin/bash: …/scripts/start.sh: Operation not permitted
```

Three fixes, pick one:

1. **Grant Full Disk Access to `/bin/bash`** (recommended for
   single-dev laptops). System Settings → Privacy & Security →
   Full Disk Access → "+" → ⌘⇧G → `/bin/bash` → Add. Then rerun
   `./scripts/install_launchd.sh`. Grants every shell script
   launched from launchd access to protected directories for
   this user — worth understanding before clicking through.

2. **Move the working copy out of `~/Documents/`** — e.g., to
   `~/Scheduler/Main` or `~/Claude/lab-scheduler/Main`. TCC does
   not gate home-root subdirectories, so launchd can read them
   without any grant. If you do this, also update the plist's
   path block and `CATALYST_WORKTREE` in the pre-receive hook.

3. **Skip launchd, use `nohup`.** `nohup bash scripts/start.sh
   --service > logs/server.log 2>&1 &` gives you a persistent-
   until-reboot local deploy without any TCC dance. Not
   resilient across logout/reboot, but zero ceremony.

The Mac mini plist (`local.catalyst.plist`) does not hit this
issue — `~/Scheduler/Main` is outside the TCC-protected set, so
a clean bootstrap works with no grant.

## Install

```bash
./scripts/install_launchd.sh
```

Idempotent. Re-run after editing the plist. The installer bootsout
any existing `local.catalyst` service first, copies the chosen plist
to `~/Library/LaunchAgents/`, bootstraps into `gui/$(id -u)`, and
kickstarts immediately.

## Uninstall

```bash
launchctl bootout gui/$(id -u)/local.catalyst
rm ~/Library/LaunchAgents/local.catalyst.plist
```

## Verify

```bash
# should show 'state = running' + a live pid
launchctl print gui/$(id -u)/local.catalyst | head -20

# smoke the URL
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:5055/login
# expect: 200

# tail the log (one file for both stdout and stderr)
tail -f logs/server.log
```

## Mini deploy verifier

Install on the mini only:

```bash
./scripts/install_launchd.sh --verify
launchctl print gui/$(id -u)/local.catalyst.verify | head -20
tail -f logs/deploy-verify.log
```

This verifier does not replace the normal `post-receive` deploy hook.
It is a recovery lane that checks for deploy drift every minute and
kickstarts `local.catalyst` if the bare repo, worktree, and served
health endpoint disagree.

## Why no reloader

`scripts/start.sh --service` exports `LAB_SCHEDULER_DEBUG=0`,
which `app.py` reads to pass `debug=False, use_reloader=False`
to `app.run()`. Without this, Flask's reloader forks a grandchild
and the parent `python` process exits — launchd sees the parent
vanish, marks the service as `EX_CONFIG`-crashed, and enters a
respawn loop. The single-process model is what launchd expects.
