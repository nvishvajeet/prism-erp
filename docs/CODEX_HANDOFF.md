# Codex handoff — 2026-04-14 burn session

Auto-pickup brief for ChatGPT Codex (or any agent that opens this
repo after Claude Code hits its credit limit). Self-contained so you
don't have to page through the full transcript.

## 1. What's live right now

- `https://catalysterp.org` serves the two-portal landing page (Lab
  R&D + Ravikiran Group HQ) with a demo-account tile.
- Public DNS → Cloudflare → **laptop** cloudflared tunnel →
  `127.0.0.1:5056` (live gunicorn on Vishvajeet's MacBook).
- The mini's own cloudflared is returning `Unauthorized: Tunnel not
  found` — the tunnel was deleted from the Cloudflare dashboard at
  13:11 UTC on 2026-04-14 and has not been re-authorised. Laptop is
  currently the de-facto production origin until the dashboard is
  fixed. **Do not stop the laptop gunicorn on port 5056.**
- Owner identity is masked system-wide as "Admin" (role label +
  topbar name + request rows). Commit `68cad40`.
- Feedback widget is compact by default, voice is continuous +
  interim, press C to capture the element under the cursor. Commit
  `e35e78b`.

## 2. Urgent backlog — pick up here

Ordered by likely rollout impact.

1. **Persist the feedback widget's `context_json` server-side.** The
   client already posts a `context_json` field holding cursor xy,
   viewport, hovered selector and any manual C-capture snapshots.
   The route `site_feedback_submit()` (app.py — `grep -n
   "def site_feedback_submit" app.py`) ignores it. Wire it through
   `_append_feedback_entry(..., context_json=...)` (the helper
   already has a parameter waiting — BUT check the current on-disk
   function; a linter kept clobbering my edits mid-session). The
   fenced `context` block goes into `logs/site_feedback.md` for
   later triage.

2. **Fix the mini Cloudflare tunnel.** The token-based tunnel
   (`cloudflared --token`) fails with `Unauthorized: Tunnel not
   found` since 13:11 UTC 2026-04-14. The launchd label is
   `com.cloudflare.cloudflared`. Config cannot be fixed from the CLI
   — it lives in the Cloudflare Zero Trust dashboard. **Ask the
   user to create a new tunnel + rotate the token** into
   `/Library/LaunchDaemons/com.cloudflare.cloudflared.plist` (or
   wherever the label resolves). Until that's done, `catalysterp.org
   → mini` is a non-starter and the laptop has to stay up.

3. **Owner masking leaks that remain.** Search for:
   - Audit log entries signed by the owner id (actor_name field).
   - The admin directory page (`templates/users.html`) — check it
     routes through `person_name_link` or `display_name_for_user`.
   - `templates/user_detail.html` when the owner is viewing *their
     own* profile — the page title and breadcrumb may still show the
     real name.
   - The inbox / messages UI — `from_name`, `to_name` columns.

4. **ERP_PORTALS slug mismatches.** `app.py:144` names `schedule`,
   `requests`, `payroll`, `filing` in the portal module lists, but
   those keys don't exist in `MODULE_REGISTRY` (app.py ~225). Pick:
   either rename the portal entries to match the registry, or add
   registry stubs. Don't invent new modules silently — run it past
   the user first.

5. **Permissions-Policy microphone header.** A parallel-agent diff
   (still in Vishvajeet's working tree, currently stashed on mini
   under `pre-deploy-widget` and `pre-deploy-2026-04-14-owner-hide`)
   adds a global `Permissions-Policy: microphone=()` header. That
   header kills the feedback widget's voice input. If you pull that
   work in, **change it to `microphone=(self)`** so the same-origin
   Chrome SpeechRecognition call is allowed.

## 3. How to deploy (pipeline)

Working copy: `~/Documents/Scheduler/Main/` on the laptop.

```
# 1. Pre-flight
cd ~/Documents/Scheduler/Main && source .venv/bin/activate
python3 scripts/smoke_test.py            # must print "smoke test passed"

# 2. Commit + push
git add <specific files>                 # don't blanket-stage
git commit -m "..."
git push origin                          # pre-receive hook re-runs smoke

# 3. Reload laptop gunicorn (the public origin)
ps -eo pid,ppid,command | grep 'gunicorn app:app.*5056' | grep -v grep \\
  | awk '$2==1 {print $1}' | xargs -I{} kill -USR2 {}
sleep 3
# Then QUIT the old master (PPID=1 entry in ps output):
kill -QUIT <old-master-pid>

# 4. (Best-effort) deploy to mini as well
ssh catalyst-mini "cd ~/Scheduler/Main \\
  && git stash push -m pre-deploy-\$(date +%s) 2>/dev/null \\
  && git pull --ff-only origin v1.3.0-stable-release \\
  && launchctl kickstart -k gui/\$(id -u)/local.catalyst \\
  && launchctl kickstart -k gui/\$(id -u)/local.catalyst.demo"
```

The mini deploy will never actually serve public traffic until the
Cloudflare tunnel is fixed. It's still worth doing — keeps the mini
and laptop in sync for when the tunnel flip happens.

## 4. Parallel-agent drift

At session start, the working tree carried ~800 lines of diff from
an earlier parallel agent: crawler improvements, security headers,
stronger temp-password + validator, login support cards, password
change screen UX, secret-key bootstrap. I did **not** commit any of
it — I cherry-picked only the owner-hide and feedback widget edits.

What I vouched for:
- `app.py` owner-hide changes committed in `68cad40` are a surgical
  patch against HEAD, not against the parallel agent's version.
- `static/styles.css` feedback widget rules in `e35e78b` ride on top
  of the parallel agent's login-support-card CSS. That CSS compiled
  fine and the smoke passed, but I didn't read every line.

Mini has stashes `pre-deploy-widget` and
`pre-deploy-2026-04-14-owner-hide` that contain its local uncommitted
work. The mini is AHEAD of me on some parallel-agent edits; don't
blow them away.

## 5. Big feature ideas the user raised (not implemented)

These are design notes, not todos. The user explicitly wanted them
captured for later — see `docs/VISION_SOFTWARE_AS_INSTRUMENT.md`.

- Treat the *software job scheduler* itself as an instrument in
  CATALYST's data model.
- An HPC (when it arrives, connected to the mini by Thunderbolt)
  follows the same pattern — it's just another instrument.
- Each compute instrument has an operator who installs software,
  wires licenses (AI-assisted), schedules jobs, and triages logs.
- Voice notes, bug reports, and feature requests all land on a
  **central queue**. An AI crawler picks work off the queue, fills
  in metadata, routes to the right operator, and in some cases can
  act autonomously (with human approval per PROJECT policy).

## 6. What NOT to do without asking the user

- Don't force-push or rewrite history on `v1.3.0-stable-release`.
- Don't blanket `git checkout --` (it nuked legitimate work in an
  earlier session).
- Don't commit the parallel-agent app.py diff without going through
  it change-by-change.
- Don't stop the laptop gunicorn (it's production until the mini
  tunnel comes back).
- Don't touch Cloudflare credentials or re-create tunnels — the user
  owns that dashboard.
- Don't delete any users or receipts without a direct ask.

## 7. Live credentials sheet

Generated at `~/Desktop/catalysterp-credentials.pdf`. Covers:
- Site URL, entry flow
- Lab R&D owner login (vishvajeet@mitwpu.edu.in) — password not
  printed, set by owner
- Ravikiran Group HQ owner login (same identity)
- Public demo account (anika.op@mitwpu.edu.in / 12345)

## 8. When in doubt

Ask. The user is actively rolling this out to a small group; they'd
rather you pause and confirm than make a structural edit on
assumption.
