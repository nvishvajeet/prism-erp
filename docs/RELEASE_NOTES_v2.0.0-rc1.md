# Release Notes — v2.0.0-rc1

Release candidate built from `operation-trois-agents` after the
Operation TroisAgents sprint.

## Ship gate

**YELLOW**

The code review is green-with-one-minor-yellow, and the final sprint gate is
yellow overall because one Ravikiran silo text issue and two deploy-state items
remain outside the code snapshot:

- Ravikiran landing page H1 still shows MITWPU wording on the live host.
- Security headers are in code but not yet visible on live responses until the
  deployment services reload.
- `playground.catalysterp.org` had an origin reachability issue during crawl.

## What’s new

1. Security hardening across Lab-ERP: login rate limiting, global security
   headers, crawler ERP/path isolation, SQLite durability gate, ProxyFix, and
   a ship-readiness check.
2. Ravikiran ERP brought to security parity with the same auth, proxy, and
   header protections plus its own readiness script and audit trail.
3. Attendance-by-number workflow shipped, including a mobile-first quick-mark
   keypad view and attendance-number visibility on profile pages.
4. UI polish landed across both ERPs: responsive cleanup, required-field
   visibility, and targeted inline-style extraction.
5. The apex chooser and tenant-routing work now give `catalysterp.org` a clear
   entrypoint with MITWPU R&D and Personal ERP destinations.

## Breaking changes

None expected at the application contract level.

## Known issues

- `ravikiran.catalysterp.org` still needs one final H1 / brand-text fix before
  it should be publicly advertised.
- Deployment state may lag the repo until the mini and MBP services are
  restarted on the reviewed commits.
- Follow-up product backlog is tracked in
  `docs/POST_SPRINT_FEEDBACK_PLAN_2026_04_15.md`.

## How to deploy

1. Pull the reviewed `operation-trois-agents` branch on the target host.
2. Run `python scripts/ship_readiness_check.py`.
3. Apply the operational notes in `docs/OPERATIONAL_HARDENING_V2.md`.
4. Reload the relevant launchd/cloudflared-backed services for chooser,
   Lab-ERP, demo, and Ravikiran according to the staged host topology.

## Rollback

Rollback is by reverting the eventual merge commit that carries this tag into
the reviewed release branch. Do not merge the tag directly; it is provenance
for the reviewed RC snapshot only.
