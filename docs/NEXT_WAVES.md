# PRISM dev plan — optimized build plan from 18cef1f

_Anchored 2026-04-11. Replaces the backlog section of `ROADMAP.md`._
_Each wave is a bounded commit bundle on `v1.3.0-stable-release`,_
_with a crawler proof and a time budget. Sanity wave stays green_
_end-to-end between every wave._

## State @ 18cef1f

* **Branch:** `v1.3.0-stable-release` @ `18cef1f`
* **This session landed:** `797dc96` (lifecycle 13/0/0),
  `70f3cbc` (round-robin approver pools + strategy),
  `c4082fa` (`LAB_SCHEDULER_HOST` env + Flask-WTF),
  `11e2a90`/`18cef1f` (README dedup → CLAUDE.md pointer).
* **Static wave right now:** architecture 64/0/8,
  philosophy 14/0/0, css_orphan 512/0/229. Zero FAIL across
  all three — the 229 CSS warns are the known fossil backlog.
* **Laptop:** Flask up at http://127.0.0.1:5055/ (demo mode).
* **Mini:** pulled to 18cef1f, venv built, Flask bound to `*:5055`
  but port blocked by Mac mini Application Firewall. Diagnosed in
  `logs/mini_network_diag_20260411.md` — operator action pending
  (one `sudo socketfilterfw` call). Not blocking code work.

## Design principles for this plan

1. **Shortest credible path to demo.** The #1 unlock is "the mini
   is a URL on my portfolio". Everything on that critical path
   ships first; polish ships second; schema changes ship last.
2. **Verification before infrastructure.** Write the crawler that
   proves a deploy works (`deploy_smoke`) *before* writing the
   launchd service it verifies. That way the very first green run
   is the acceptance gate.
3. **Incremental network surface.** We can ship "tailnet-only HTTP"
   in one command today. Real Let's Encrypt HTTPS is a separate,
   smaller step. Don't couple them.
4. **Parallel tracks, single trunk.** Infra (Track A) and UX
   polish (Track B) never share files. They can be worked in
   parallel sessions and interleaved on trunk without rebases.
5. **Schema waves are v1.5.0.** Multi-role and instrument-groups
   each rewrite a foundational column. They do not belong on the
   v1.4.x polish/stabilization line.

## Critical path (the only path that matters for the demo)

```
W1.3.7  deploy_smoke crawler            ┐
W1.3.8  launchd service on the mini     │ Track A — infra
W1.3.9  tailnet HTTP access (serve)     │ (serial, 1 day total)
W1.4.0  tailnet HTTPS (cert + serve)    ┘
W1.4.3  portfolio button + v1.4.3 tag   ← demo is live
```

Everything below the critical path is **parallel or deferrable**:

```
W1.4.1  Jony-Ive polish batch   ← Track B, parallel to A
W1.4.2  schema warmup (none)    ← intentionally empty
W1.5.0  multi-role users        ← schema, post-v1.4.3
W1.5.1  instrument groups       ← schema, depends on W1.5.0
```

## Track A — infrastructure (sequential, 1 day)

### W1.3.7 — `deploy_smoke` crawler (½ hour)

*The verification tool that every later infra wave lands against.*

* New `crawlers/strategies/deploy_smoke.py`. Reads `PRISM_DEPLOY_URL`
  env var; if unset, strategy reports *skipped* (exit 0). If set,
  hits `/login`, `/`, `/sitemap`, asserts HTTP 200 and that each
  response body contains a sentinel string (`<title>PRISM`).
* Uses `urllib.request` with an `SSLContext` that verifies the
  cert chain when the URL is `https://`. A warning — not a fail —
  when the cert is self-signed, so both Plan A (Tailscale LE) and
  Plan B (mkcert) can pass.
* Registered in the `sanity` wave as an opt-in final step. Laptop
  runs without the env var → noop → sanity stays fast.
* Commit proof: run `PRISM_DEPLOY_URL=http://127.0.0.1:5055
  .venv/bin/python -m crawlers run deploy_smoke` against the
  laptop server → expect 3/0/0 green.

Exit tag: no tag, one commit.

### W1.3.8 — launchd service for Flask on the mini (1-2 hours)

*Turns the `nohup` dance into a real service that survives reboots.*

* `ops/launchd/local.prism.plist` — `KeepAlive` true,
  `RunAtLoad` true, stdout/stderr to `logs/server.log`,
  `EnvironmentVariables` sourced from a one-line wrapper.
* `scripts/start_server.sh` — exports `.env`, execs
  `.venv/bin/python app.py`. Launchd invokes this, not python
  directly, so env loading is unambiguous.
* `scripts/install_launchd.sh` — copies the plist to
  `~/Library/LaunchAgents/`, runs `launchctl bootstrap`.
* Delete the mini's stray `nohup` processes.
* `docs/DEPLOY.md` §2 rewrite — the launchd recipe is now the
  canonical recipe. Plan-B (manual `python app.py`) stays as a
  debugging fallback only.
* Acceptance: reboot the mini, wait 30s, run `deploy_smoke` from
  the laptop with `PRISM_DEPLOY_URL=http://100.115.176.118:5055`.
  Must be green without any manual start command.

Blocking item: the Application Firewall still drops inbound
packets to :5055 per the diag log. W1.3.8 acceptance requires the
one-command operator unblock first. If Track A is running before
that unblock, **skip the reboot-acceptance step** and instead
verify via `ssh mini curl http://127.0.0.1:5055/login` → 200.

Commits: 2 (plist+scripts, DEPLOY.md rewrite). Tag **v1.3.8**.

### W1.3.9 — tailnet HTTP (20 minutes)

*One command: the mini's Tailscale MagicDNS name serves Flask,_
_no firewall games, tailnet-only by construction.*

* `tailscale serve --bg --set-path=/ http://127.0.0.1:5055` on
  the mini. No HTTPS yet — plain HTTP *over* the tailnet. Only
  devices on the tailnet can resolve the name or reach the port.
* Flask reverts to `127.0.0.1:5055` (loopback only). Remove
  `LAB_SCHEDULER_HOST=0.0.0.0` from the mini `.env`.
* Revert the Application Firewall exception if it was added —
  tailscaled owns the edge now.
* Bookmark `http://prism-mini.tail-xxxx.ts.net/` on every device
  on the tailnet.
* `docs/HTTPS.md` (new) — one section: "current state, tailnet
  HTTP only". Second section stub for W1.4.0.
* Acceptance: `PRISM_DEPLOY_URL=http://prism-mini.tail-xxxx.ts.net
  .venv/bin/python -m crawlers run deploy_smoke` → green.

Commits: 1. No tag (roll up into v1.4.0).

### W1.4.0 — tailnet HTTPS (30 minutes)

*Upgrade W1.3.9 to real Let's Encrypt so browsers stop
warning and cookies can flip to `Secure`.*

* Enable MagicDNS + HTTPS in the Tailscale admin console
  (operator toggle; one-time). If the admin console blocks this
  for the tailnet, stop here and note Plan B in `docs/HTTPS.md`
  (mkcert-generated local cert wired via Flask `ssl_context`).
* `tailscale cert prism-mini.tail-xxxx.ts.net` — provisions the
  real cert.
* `tailscale serve --bg --https=443 --set-path=/ http://127.0.0.1:5055`
  — upgrade from HTTP to HTTPS in one command.
* `LAB_SCHEDULER_HTTPS=true` + `LAB_SCHEDULER_COOKIE_SECURE=true`
  in mini `.env`. Flask-side cookie hardening flips on.
* `docs/HTTPS.md` second section filled in with the four-command
  recipe + tailnet-device-add pointer.
* Acceptance: `PRISM_DEPLOY_URL=https://prism-mini.tail-xxxx.ts.net
  .venv/bin/python -m crawlers run deploy_smoke` → green. The
  crawler's `ssl.get_server_certificate` call returns a valid
  chain, not a warning.

Commits: 1. Tag **v1.4.0**.

## Track B — Jony-Ive UX polish (parallel to Track A, 2 days)

### W1.4.1 — polish batch (3 commits, not 5)

Collapsed from the earlier 5-item list. Role-greeting dropped —
redundant with the shipped `tile-dash-role-hint` badge.

**Commit 1 — server-side badges + time hints.**
  - `.topbar-count-badge` on topbar `Approvals` / `Requests` /
    `Users` when the current role has non-zero pending.
  - `.row-time-hint` muted span on request rows ("submitted 2h ago"),
    computed server-side. No JS.
  - Crawler proof: extend `visibility` to assert the badge
    class only renders when the role has non-empty pending lists.

**Commit 2 — empty-state warmth.**
  - Shared `.empty-state` card (one-line welcome + primary CTA)
    on every "empty table" page. Existing "No records" stubs
    deleted.
  - Crawler proof: extend `visibility` to assert `.empty-state`
    appears on a fresh DB's `/requests` for a requester.

**Commit 3 — keyboard shortcut `n` + `?` help.**
  - `static/keybinds.js` added to `base.html` via `<script
    defer>`. Only `n` → `/requests/new`, `?` → overlay. Listener
    is a no-op when an input is focused.
  - Crawler proof: extend `philosophy` to assert `keybinds.js`
    is referenced from `base.html` and that it is ≤40 lines
    (no JS framework creep).

Budget: each commit is <50 lines of app + template + css diff.
Tag **v1.4.1**.

## Track C — the release gate (merge of A+B)

### W1.4.2 — no work (buffer)

*Intentionally empty.* v1.4.2 is a version number reserved as a
hotfix slot in case Track A or Track B lands a regression that
needs a patch release before v1.4.3. Leaving it empty keeps the
CHANGELOG honest and lets us ship urgent fixes without renumbering.

### W1.4.3 — stable release (½ day)

*Only starts after W1.4.0 + W1.4.1 are both tagged.*

1. **`CHANGELOG.md`** entries for every tag since v1.3.5,
   including crawler pass/fail deltas for each wave.
2. **`README.md` quickstart** — five copy-pasteable lines from
   clone → first login. Pointer into `docs/DEPLOY.md` and
   `docs/HTTPS.md` for mini deploy.
3. **Pre-push hook on the laptop bare** —
   `~/.claude/git-server/lab-scheduler.git/hooks/pre-receive` (it's
   a central receive, not a client-side push). Runs
   `.venv/bin/python -m crawlers wave sanity` in the working copy
   and refuses the push on failure. Two-tier safety: the working
   copy gate catches it locally, the bare gate is the
   belt-and-suspenders for the mirror.
4. **Portfolio button on nvishvajeet.github.io** — single `<a>`
   pointing at the HTTPS tailnet URL with "demo creds inside,
   requires tailnet access" microcopy. One-commit change on that
   repo.
5. **`v1.4.3` tag** on `v1.3.0-stable-release`. This is the first
   tag of the v1.4.x line.

No new crawlers. Sanity must stay < 30s.

## Deferred to v1.5.x (schema waves)

Both waves below touch foundational tables and are out of scope
for v1.4.x. They ship after v1.4.3 is in the wild for a week.

* **W1.5.0 — multi-role users.** `user_roles(user_id, role)`
  junction, `primary_role()` helper, `has_role()` replaces every
  `user["role"] ==` comparison. New `multi_role` crawler.
* **W1.5.1 — instrument groups.** `instrument_group` +
  `instrument_group_member`. "By Group" assignment matrix in user
  detail. Migration seeds Electron-Microscopy / Spectroscopy
  groups from existing `instruments.category`. New
  `group_visibility` crawler. Depends on W1.5.0.

## New crawlers added by this plan

| new strategy       | wave(s)               | budget | gates on                        |
|--------------------|-----------------------|--------|---------------------------------|
| `deploy_smoke`     | `sanity` (opt-in)     | 3s     | `PRISM_DEPLOY_URL` → 200 + cert |
| `multi_role`       | `behavioral`, `all`   | 5s     | both role paths work per user   |
| `group_visibility` | `behavioral`, `all`   | 5s     | grant/revoke propagate cleanly  |

`approver_pools` (shipped 70f3cbc) stays in `lifecycle` + `all`.

## Time budget summary

| wave   | track | est.   | blocks      | tag       |
|--------|-------|--------|-------------|-----------|
| W1.3.7 | A     | 30 min | —           | —         |
| W1.3.8 | A     | 1-2 h  | W1.3.7      | v1.3.8    |
| W1.3.9 | A     | 20 min | W1.3.8      | —         |
| W1.4.0 | A     | 30 min | W1.3.9      | v1.4.0    |
| W1.4.1 | B     | 2 days | —           | v1.4.1    |
| W1.4.2 | —     | —      | (empty)     | —         |
| W1.4.3 | C     | ½ day  | W1.4.0+W1.4.1 | v1.4.3  |
| W1.5.0 | v1.5  | 1-2 d  | v1.4.3      | v1.5.0    |
| W1.5.1 | v1.5  | 1-2 d  | v1.5.0      | v1.5.1    |

**Track A critical path to a demoable URL: ~3 hours of focused
work** (W1.3.7 → W1.3.8 → W1.3.9 → W1.4.0 → portfolio button).
Do this in one sitting and the demo is live before polish is done.

## Ship-today candidates

Things that can land in the next 2 hours with zero external
dependencies (no admin console, no sudo on the mini):

1. **W1.3.7** (`deploy_smoke` crawler) — pure code, laptop-local
   verification. One commit.
2. **W1.3.8 plist + scripts** (code only, acceptance step deferred
   until firewall is unblocked). One commit.
3. **W1.4.1 commit 1** (topbar badges + time hints) — pure template
   + css + `visibility` crawler extension. One commit.

Three commits in two hours, all independently valuable, none
blocked on the mini.

## Guardrails (unchanged from `ROADMAP.md`)

* Every wave stays under 30 seconds end-to-end on the MacBook.
* Every patch lands a crawler proof in the commit message body.
* Every new tile carries `data-vis="{{ V }}"` + a `.tile-*` class.
* Push to `origin` (the laptop bare) after each commit. The bare
  mirrors to the mini. No pushes to GLOBAL remotes without
  explicit operator approval per `~/.claude/CLAUDE.md`.
