# ERP topology — separate gits, shared core, isolated data

> Captures the multi-ERP runtime + git topology as it stands
> 2026-04-15. Read together with `docs/ROLE_SURFACES.md` (login,
> password reset, Action Queue) and `docs/AI_INGESTION_FROM_UPLOADS.md`
> (the four-stage AI pipeline).

## The model

```
catalyst-core             ← shared platform (planned).
                            single source of truth for module
                            registry, schema primitives, auth,
                            base templates. Improvements here
                            propagate to every wrapper.

    ↑ wrapped by

    ├── lab-erp           ← MITWPU R&D Lab ERP
    │   = ~/Documents/Scheduler/Main/ (dev MacBook working copy)
    │     ~/Scheduler/Main/             (mini deploy working copy)
    │     ~/.claude/git-server/lab-scheduler.git (LOCAL bare = origin)
    │   admins: Kondhalkar (site_admin), Bharat Chaudhari (super_admin)
    │   data:   data/demo/{stable/,}lab_scheduler.db (dev preview)
    │           data/operational/lab_scheduler.db    (live, mini-only)
    │   serves: catalysterp.org (cloudflared tunnel from MacBook)
    │           https://<mini>:5055 (production for MITWPU LAN)
    │
    └── ravikiran-erp     ← Household / estate ERP
        = ~/Claude/ravikiran-erp/ (dev MacBook working copy, NEW 2026-04-15)
          ~/ravikiran-services/    (mini deploy working copy)
          ~/.claude/git-server/ravikiran-erp.git (LOCAL bare, NEW)
        admins: Pournima, Abasaheb, Prashant (Chief Accountant)
        data:   data/demo/lab_scheduler.db (only — operational not provisioned)
        serves: NOT YET (no gunicorn / launchd job)
```

## Hard rules

1. **Separate gits.** Each wrapper has its own repo, its own LOCAL bare,
   its own release cadence. `lab-erp` and `ravikiran-erp` never share
   a working copy.
2. **Separate data store.** Each wrapper has its own `data/` directory,
   its own SQLite DB, its own `uploads/`, `exports/`, `logs/`, its
   own `ai_uploads/`. No symlinks, no cross-mount, no shared
   `_uploads`. **Demo and operational are also physically separate**
   directories within a single wrapper (`data/demo/` vs `data/operational/`).
3. **Branding, personas, deploy config** live in the wrapper repo,
   never in core.
4. **AI / overlay tools require an `--erp` flag** with no default —
   enforced. Wrong-target writes must be a loud error, not a silent
   default. See:
   - `crawlers/ai_extract_upload.py --erp lab|ravikiran`
   - `scripts/onboard_qubit_overlay.py --erp lab` (refuses ravikiran)
5. **Each wrapper has its own stable release branch** and its own
   release cadence. Lab-ERP stable: `v1.3.0-stable-release`.
   Ravikiran stable: TBD when it goes live.
6. **Cross-ERP reads also forbidden** for AI tooling — wrong-ERP
   writes are the loud failure, but reads are the silent leak.
   Use `--db <path>` only with paths that match the chosen `--erp`.

## Current state of the silo (2026-04-15)

| Artefact | lab-erp | ravikiran-erp |
|---|---|---|
| Codebase | shared `app.py` (≈7.5 KLOC) | own copy (≈675 KB), older AI-pipeline schema |
| LOCAL bare | `~/.claude/git-server/lab-scheduler.git` ✓ | `~/.claude/git-server/ravikiran-erp.git` ✓ (new) |
| Stable branch | `v1.3.0-stable-release` ✓ | none yet |
| Mini auto-mirror | post-receive hook → `~/Scheduler/Main` ✓ | not wired (mini → MacBook reverse SSH refused) |
| Live URL | `catalysterp.org` (MacBook + tunnel), mini :5055 (LAN) | none |
| Demo URL | catalysterp.org (DEMO_MODE=1) | none |
| AI pipeline tables | yes (full) | yes (added 2026-04-15 — additive `CREATE TABLE IF NOT EXISTS`) |
| Pending account-import in queue | 6 (Kondhalkar's R&D operators, on operational) | 1 record covering 104 staff (Prashant's roster, on demo) |

## Open work toward full silo

1. **catalyst-core extraction** — pull platform code out of
   `Scheduler/Main` into its own repo. Today, lab-erp IS catalyst-core.
   Until the carve, "core improvements" land in `lab-scheduler.git`
   and have to be manually re-applied to `ravikiran-services`.
2. **Reverse-SSH from mini** — MacBook's SSH server is off, so the
   mini cannot push the Ravikiran repo back to the LOCAL bare.
   Workflow for now: dev on MacBook (`~/Claude/ravikiran-erp/`),
   push to LOCAL bare, mini pulls from LOCAL bare.
3. **Ravikiran launchd / port assignment** — bring Ravikiran online
   on the mini behind its own URL (e.g., `ravikiran.local:5054`).
4. **Per-ERP CATALYST_MODULES env var** — currently both wrappers
   would enable everything. Lab should disable household modules
   (mess, laundry, fleet, tuck-shop) and Ravikiran should disable
   instrument modules (samples, approvals, instrument admin).
5. **Ravikiran-aware overlay** — analogue of `onboard_qubit_overlay.py`
   for the household roster. Today `--erp ravikiran` is refused by
   that script.

## Conventions for new ERPs

If a third ERP wrapper appears (say, `accounts-erp`):

1. Create LOCAL bare: `~/.claude/git-server/accounts-erp.git`.
2. Working copy on MacBook: `~/Claude/accounts-erp/`.
3. Working copy on mini: `~/accounts-services/` (or pick a path).
4. Add to this doc's table.
5. Add the wrapper-specific `--erp` choice to every overlay script.
6. Each wrapper picks its own port + launchd label
   (`local.<wrapper>` for the prod instance,
   `local.<wrapper>.demo` for the demo instance).

## Cross-references

- `~/.claude/CLAUDE.md` — Level-1 kernel: central git topology, SSH key,
  commit rhythm, project registry. Update the registry when adding a
  new wrapper.
- `WORKFLOW.md` — Level-2 Lab-ERP-specific rules. Each wrapper will
  eventually have its own.
- `docs/ROLE_SURFACES.md` — login + Action Queue + universal-queue
  principle. Same UX spec applies across wrappers.
- `docs/AI_INGESTION_FROM_UPLOADS.md` — the 4-stage AI pipeline that
  every wrapper inherits via the shared core.
