# ERP Tenant Onboarding — CATALYST playbook

> How to set up a new CATALYST ERP wrapper for an organisation.
> Written 2026-04-15 during Operation TroisAgents. The worked
> example is Ravikiran-ERP (personal/household), rolled out
> beside the existing Lab-ERP (MITWPU R&D).
>
> Read with: `docs/ERP_TOPOLOGY.md` (multi-ERP runtime shape),
> `docs/ROLE_SURFACES.md` (login + Action Queue),
> `docs/AI_INGESTION_FROM_UPLOADS.md` (the 4-stage AI pipeline).

## The four stages

1. **Discovery** — what is the org actually running? Who are
   the admins? What modules do they need? What's their DB of
   record today?
2. **Infrastructure** — give the new tenant its own repo, LOCAL
   bare, working copies, port, subdomain, and launchd job.
3. **Seeding** — bring over the `real_team` roster, create the
   admin + tester accounts, set passwords, assign portals.
4. **Handoff** — teach admins how to reset passwords, invite
   users, and find bug reports. Set up the tester loop.

---

## Stage 1 — Discovery (pre-sales / scoping)

Questions to answer before anything technical happens:

- **Who are the super admins?** (Usually 1–3 humans who run the
  organisation day-to-day.)
- **Who are the operators?** (Staff who execute work — bookings,
  fleet drivers, finance entries.)
- **Who is the tester?** (One trusted human who exercises the
  app and files bugs — our Ravikiran example: Tejveer.)
- **What modules does the org need?** Match against the
  16 primitives in `docs/ERP_PRIMITIVES.md`. Disable what they
  don't need via `CATALYST_MODULES` env var (once implemented —
  see [ERP_TOPOLOGY.md §3 item 4](ERP_TOPOLOGY.md)).
- **What is the domain / branding?** Pick a subdomain under
  `catalysterp.org` — e.g. `ravikiran.catalysterp.org`,
  `mitwpu-rnd.catalysterp.org`. No cross-branding between
  tenants.
- **Where does their operational data live today?** Spreadsheet?
  Paper? Existing ERP? Migration plan depends on this.
- **What's their compliance surface?** For regulated domains
  (finance, healthcare, education), flag any data-residency or
  retention requirements before go-live.

## Stage 2 — Infrastructure

### 2.1 Repo + git-server

```bash
# On MacBook (dev machine):
mkdir -p ~/Claude/<tenant>-erp
git clone /Users/vishvajeetn/.claude/git-server/lab-scheduler.git \
          ~/Claude/<tenant>-erp
cd ~/Claude/<tenant>-erp

# Create LOCAL bare:
git clone --bare . ~/.claude/git-server/<tenant>-erp.git
# Update working copy's origin:
git remote set-url origin ~/.claude/git-server/<tenant>-erp.git
git push --set-upstream origin master
```

Register the tenant in the kernel:
`~/.claude/CLAUDE.md` "Project registry" table.

### 2.2 Port + subdomain

Pick a free port on the mini. Today: 5055 (Lab op), 5056 (Lab
demo), 5057 (Ravikiran), 5060 (chooser). Assign your tenant the
next free port (5058, 5059, 5061, …).

Add a Cloudflare ingress rule on mini at
`~/.cloudflared/config.yml`:

```yaml
- hostname: <tenant>.catalysterp.org
  service: http://127.0.0.1:<port>
```

Create the DNS record via `cloudflared tunnel route dns <tunnel-id> <tenant>.catalysterp.org`
(needs origin `cert.pem`).

### 2.3 Launchd job on mini

Stage a plist under `~/Library/LaunchAgents/local.catalyst.<tenant>.plist`:

```xml
<key>Label</key><string>local.catalyst.<tenant></string>
<key>ProgramArguments</key>
<array>
  <string>/bin/bash</string>
  <string>-lc</string>
  <string>cd ~/<tenant>-services &amp;&amp; .venv/bin/gunicorn app:app -w 2 -b 127.0.0.1:<port></string>
</array>
<key>KeepAlive</key><true/>
<key>ThrottleInterval</key><integer>60</integer>
<key>RunAtLoad</key><true/>
```

`launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/local.catalyst.<tenant>.plist`.

## Stage 3 — Seeding

### 3.1 The `real_team` idempotent block

Copy the `real_team` pattern from
[lab-scheduler/app.py:7706–7783](../app.py:7706) into your
tenant's `app.py seed_data()`. Replace the 6 humans with your
tenant's roster. Structure per row:
`(name, email/username, role, office_location, portals)`.

Passwords: always `12345` with `must_change_password=1`. No
plain-text passwords anywhere else.

### 3.2 Tester account

One role = `tester` with full-read + scoped-write
(debugger/feedback only). This is the human who will live on
the app once it's deployed. Give them:

- Login card (username + temp password)
- URL
- The testing plan (adapt
  [docs/TESTING_PLAN_TEJVEER.md](TESTING_PLAN_TEJVEER.md))
- The bug-report template
  ([docs/TEJVEER_BUG_REPORT_TEMPLATE.md](TEJVEER_BUG_REPORT_TEMPLATE.md))

### 3.3 Branding scrub

Fork-based wrappers inherit lab-specific content. Scrub:
- Persona emails (`dean@prism.local`, `kondhalkar@prism.local`)
- Seed instruments (FESEM, ICP-MS, XRD, …) → replace with the
  tenant's actual inventory or remove
- UI strings "Lab R&D", "MITWPU", "Central Instrumentation" →
  replace with tenant's branding
- `GOOGLE_ALLOWED_DOMAIN` env default → the tenant's actual
  email domain

Use a single grep list (one per wrapper) to drive the scrub.

## Stage 4 — Handoff

- Super admins get a walkthrough of password reset, user invite,
  role changes, and Action Queue.
- Tester gets the bug-report template + the test plan.
- Operations set up daily DB backup to external storage.
- Add the new tenant to the registry in
  [CLAUDE.md](/Users/vishvajeetn/.claude/CLAUDE.md).
- Announce the first 2-week cohort window (see
  [feedback_cohort_cadence](memory)).

## Anti-patterns to avoid

- **Port collision** — never default a new tenant to 5056
  (Lab-ERP demo's port). See
  [start_ravikiran.sh](../../../Claude/ravikiran-erp/start_ravikiran.sh)
  for the 2026-04-15 postmortem.
- **Shared DB filename** — rename `lab_scheduler.db` to
  `<tenant>.db` for each new wrapper. Filename collision is a
  SEV2 footgun.
- **`SESSION_COOKIE_DOMAIN=catalysterp.org`** — DO NOT SET.
  Leaving it unset means per-host cookies; setting it to the
  root domain allows cross-tenant session reuse.
- **Cross-tenant URL leaks** — `url_for(..., _external=True)`
  must use the tenant's own host. Audit this before each
  release.
- **Forgetting launchd KeepAlive** — the tenant dies on mini
  reboot. Always stage the plist.

## The "shipping v2.0 of CATALYST" checklist

When a new tenant goes live:

- [ ] LOCAL bare exists at `~/.claude/git-server/<tenant>.git`
- [ ] Working copy on mini at `~/<tenant>-services/`
- [ ] Launchd plist loaded (`launchctl list | grep <tenant>`)
- [ ] Cloudflare ingress rule live (`curl https://<tenant>.catalysterp.org/health` = 200)
- [ ] DB file exists and seeded (`sqlite3 <db> 'SELECT COUNT(*) FROM users'`)
- [ ] Admin + tester accounts log in successfully
- [ ] Tester has the bug-report template + URL
- [ ] Tenant registered in `~/.claude/CLAUDE.md`
- [ ] Branding scrub complete (no source-fork string leaks)
- [ ] Daily backup cron enabled
- [ ] Testing cohort window announced

Last updated: 2026-04-15 (Operation TroisAgents).
