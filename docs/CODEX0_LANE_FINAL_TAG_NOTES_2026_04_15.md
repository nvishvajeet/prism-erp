# Codex 0 Lane — Release notes + v2.0.0-rc1 tag (conditional)

> Final lane for Codex 0, Operation TroisAgents. Claude 0 is out
> of context — this file is your complete assignment. Runs AFTER
> Claude 1's crawl + weave + code-review lane (see
> `docs/CLAUDE1_LANE_FINAL_CRAWL_WEAVE_2026_04_15.md`).

Conditional execution:
- If Claude 1's `OPERATION_TROIS_AGENTS_RESULT.md` ship gate is
  **GREEN or YELLOW** → proceed.
- If **RED** → fix the items Claude 1 flagged, then proceed.

---

## Mission

1. Finish any remaining Lane 3 (Ravikiran security parity) work.
2. Write the v2.0 changelog entry.
3. Write public release notes for `v2.0.0-rc1`.
4. Cut the tag on `operation-trois-agents` head.
5. Close out with a final status commit.

---

## Deliverable 1 — Fix any RED items from Claude 1's code review (~variable)

If `docs/OPERATION_TROIS_AGENTS_CODEX_REVIEW.md` lists ⚠ or ✗
items against your commits, fix each one. Small fixes: inline.
Bigger: one commit per fix, prefix `review-fix:`.

Update `docs/SEV2_REMEDIATION_2026-04-15.md` with the follow-up
commit hashes.

Smoke gate green before each push.

Skip if the review is fully green.

## Deliverable 2 — CHANGELOG entry (~5 min)

Append to `CHANGELOG.md` (create if missing):

```markdown
## v2.0.0-rc1 — 2026-04-15

Operation TroisAgents sprint output. Three agents (Claude 0,
Claude 1, Codex 0) across ~2.5 hours.

### Security
- Login rate limiter: sliding 5-min window, 5 failures → 5-min
  block per IP (commit: ...)
- Security response headers: HSTS, CSP, X-Frame-Options,
  X-Content-Type-Options, Referrer-Policy (commit: ...)
- AI crawler --erp/--db path enforcement (commit: ...)
- SQLite `synchronous=FULL` in operational mode (commit: ...)
- Werkzeug ProxyFix for Cloudflare tunnel correctness (commit:
  ...)
- Same security stack ported to Ravikiran wrapper (commit: ...)

### Features
- `attendance_number` column + numeric quick-mark (Nikita) —
  people call out their number instead of a 3-letter code
  (commit: ...)
- Mobile-first `/attendance/quick` keypad page (commit: ...)
- `playground.catalysterp.org` backend for Lab-ERP demo access
- Chooser app at `catalysterp.org` root with MITWPU R&D +
  Personal ERP tiles (no Ravikiran brand) (commit: ...)

### Operations
- Ravikiran `launchd` plist staged at
  `chooser/launchd/local.catalyst.ravikiran.plist`
- Operational hardening doc
  (`docs/OPERATIONAL_HARDENING_V2.md`)
- HSTS preload readiness note
- Ship-readiness check script:
  `scripts/ship_readiness_check.py`
- Observability doc (`docs/OBSERVABILITY_V2.md`)
- Tenant onboarding playbook
  (`docs/ERP_TENANT_ONBOARDING.md`)

### UI / UX
- Attendance number visible on profile pages
- Mobile responsive polish across templates
  (`static/css/mobile_polish_v2.css`)
- UI audit + form save-button pass
  (`static/css/ui_audit_2026_04_15.css`)
- Ravikiran template branding scrub (FESEM/ICP-MS/XRD/Lab
  references removed)

### Deferred (backlog for next sprint)
- Mobile debug tool (eruda drop-in + full `/debug` page with
  voice dictation + screenshot upload)
- Time-logging feature (`user_work_sessions` table + heartbeat
  + `/admin/users/<id>/hours` view)
- Ravikiran DB filename rename (`lab_scheduler.db` →
  `ravikiran.db`) — SEV2 footgun reduction
- Ravikiran `tester` role wiring
- Post-sprint feedback plan items (see
  `docs/POST_SPRINT_FEEDBACK_PLAN_2026_04_15.md`)
```

Fill in actual commit hashes via
`git log operation-trois-agents --oneline -50`.

Commit: `changelog: v2.0.0-rc1 entry`

## Deliverable 3 — Release notes (~3 min)

`docs/RELEASE_NOTES_v2.0.0-rc1.md` — one-page, reader-friendly:
- What's new (headline 5)
- Breaking changes (none expected)
- Known issues (cite Post-Sprint Feedback Plan)
- How to deploy (cite `OPERATIONAL_HARDENING_V2.md` +
  `cloudflared` phase 2 targets)
- Rollback plan (one line: `git revert` the tag's merge commit)

Commit: `docs: release notes v2.0.0-rc1`

## Deliverable 4 — Cut the tag (~2 min)

```bash
cd /Users/vishvajeetn/Documents/Scheduler/Main
git fetch origin
git checkout operation-trois-agents
git pull origin operation-trois-agents

# Verify the head is what we expect
git log -1 --oneline

# Cut annotated tag
git tag -a v2.0.0-rc1 -m "Operation TroisAgents RC1

Three-agent coordinated sprint (Claude 0, Claude 1, Codex 0)
delivering v2.0 with backend security hardening, attendance-by-
number feature, mobile-first UI polish, and Ravikiran silo
completion. Full ship gate: see
docs/OPERATION_TROIS_AGENTS_RESULT.md."

git push origin v2.0.0-rc1
```

No merge to `master` / `feature/insights-module` / `v2.0.0-beta`
yet — that's a separate review + deploy step after cert.pem
work. The tag is provenance only at this stage.

## Deliverable 5 — Final status (~1 min)

```
STATUS: T+NN Codex0 — v2.0.0-rc1 tagged. Operation TroisAgents
closed. Final artefacts:
  docs/OPERATION_TROIS_AGENTS_RESULT.md
  docs/OPERATION_TROIS_AGENTS_WEAVE_REPORT.md
  docs/OPERATION_TROIS_AGENTS_CODEX_REVIEW.md
  CHANGELOG.md
  docs/RELEASE_NOTES_v2.0.0-rc1.md
  tag v2.0.0-rc1
```

---

## Hard rules

1. Never tag if Claude 1's weave verdict is RED and unfixed.
2. Smoke gate green before every push.
3. Do not merge `operation-trois-agents` into any other branch.
   Tagging is provenance; merging is a separate human-reviewed step.
4. Do not push to `github` or `mini` remotes. Only `origin`.

GO.
