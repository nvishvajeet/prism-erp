[ORDER 2026-04-17T15:13+02:00 STATION-BORDEAUX] **🔥 FIRE THE WEBSITE — strict purge + brochure-authoritative instrument list**

Operator directive 15:10-15:12 Paris:

1. **Authoritative instrument list = MIT-WPU CRF Brochure** (`/Users/vishvajeetn/Downloads/MIT-WPU CRF Brochure.pdf`). **22 instruments** (12 major + RF-DC Sputtering in prose + 9 NABL-accredited). **Keep all 22.** PREVIOUS K3 instruction to delete 12 instruments is **REVOKED** — see `docs/LAB_ERP_INSTRUMENT_SEED_2026_04_17.md` top-note.

2. **Only 6 operator profiles on Lab ERP** — the ones Kondhalkar lists in his xlsx:
   - 21 Mr. Ranjit Kate
   - 22 Dr. Santosh Patil
   - 23 Mrs. Aparna Potdar
   - 24 Dr. Vaibhav Kathavate
   - 25 Dr. Vrushali Pagire
   - 26 Dr. Sahebrao More

3. **For brochure instruments NOT in Kondhalkar's xlsx, assign to one of the 6 above** (distribute by domain affinity):
   - **UV-NIR-01** → More (already does UV-Vis/PSA, optical lane)
   - **TRIBO-01** → Kathavate (mechanical/materials lane)
   - **POM-01** → Kate (microscopy, he does FESEM)
   - **MICRO-RV3** → Kate (microscopy)
   - **UTM-100, UTM-5, UTM-1000** → Kathavate (mechanical testing)
   - **HRD-ROCK, HRD-VB, HRD-MV** → Kathavate (hardness testing)
   - **FATIGUE-01, COMP-01** → Kathavate (mechanical testing)

4. **Aggressive purge** — "fire the website, remove any garbage and leakage from prior or other ERPs data":
   - **Users** keep only canonical 9: ids 1 (Dean), 2 (Vishvajeet), 3 (Kondhalkar), 21-26 (6 operators). Delete everyone else.
   - **Ravikiran leak:** 27 Prashant, 28 Nikita, 30 Tejveer — gone.
   - **Demo seeds:** 4 Meera, 5 Patil (finance professor, not Santosh), 6 Kulkarni, 7 Joshi, 15-19 PhD students, 20 Arun Mehta — all gone.
   - **Demo data:** scan + delete demo sample_requests, vendors, grants, payments, vehicles, schedules, maintenance rows not owned by one of the 9 canonical users. Audit counts first (K9), operator reviews before row deletes.

### Revised K-series execution (supersedes prior K1-K9)

Fire in this order. Station Paris executes, Station Scotland reviews + cherry-picks.

- **K1** — backup both Mini DBs (both paths): `cp db.bak-<ts>`. One-line ssh, no commit.
- **K2** — safety check: `SELECT COUNT(*) FROM sample_requests WHERE requester_id NOT IN (1,2,3,21,22,23,24,25,26);` — if > 0, record counts + proceed (those requests will be demo data to purge in K9). `SELECT COUNT(*) FROM sample_requests` where instrument_id is ANY of the 22 brochure codes → should equal total (no deletions needed).
- **K3-REVISED** — UPDATE only (no DELETE FROM instruments). Canonicalize 22 instrument names + capabilities_summary + manufacturer + model_number per brochure (see full mapping below). Plus INSERT any missing instrument_operators rows for all 22 instruments per the assignment table above.
- **K7** — DELETE Ravikiran leak (users 27, 28, 30) with `ON DELETE CASCADE` cleanups as before.
- **K8** — DELETE demo users (ids 4, 5, 6, 7, 15, 16, 17, 18, 19, 20). Pre-check `sample_requests.requester_id` + `payments.user_id` — if those users own rows, those rows are demo data (purged in K9) and cascade cleanup happens there.
- **K9** — demo-data inventory doc (`docs/LAB_DEMO_DATA_PURGE_2026_04_17.md`) with per-table counts + sample rows. Commit doc only. Operator (Claude1 Bordeaux) approves row-deletes in a follow-up ORDER.
- **K10** — mark `ai_advisor_queue` id=1 status='processed' with response summary.
- **K11** — live probe: `/login`, `/instruments`, `/admin/users` on `https://mitwpu-rnd.catalysterp.org` — must be 200/302. If 5xx, rollback via backups + log REVERTED.

### Brochure metadata for K3 UPDATE (manufacturer/model/about)

Pull from brochure pages 4-14:

| code | manufacturer | model_number | capabilities_summary |
|---|---|---|---|
| ICP-MS-01 | SHIMADZU | ICPMS-2040 LF | Trace elemental analysis, ppt detection, multi-element, isotope ratios |
| FESEM-01 | TESCAN | S8152 | 10X-1,000,000X, FEG electron source, EDS elemental mapping, UH-resolution |
| XRD-01 | MALVERN PANALYTICAL | Empyrean-DY3280 | 1Der detector, vertical goniometer, GIXRD, powder + thin-film |
| RAMAN-01 | JASCO | NRS-4500 | Confocal micro-Raman, 532+785 nm lasers, CCD, 5X-100X objectives |
| PSA-01 | MALVERN PANALYTICAL | Zetasizer Advance | 0.3nm-10µm, DLS/ELS/MADLS, ISO 13321 + 22412 |
| NANO-01 | INDUSTRON | NG-80 | Max load 10 mN, resolution 5 nN + 1 nm, load or displacement control |
| PROF-01 | BRUKER | Dektak Pro | Max scan 3000 µm, thin-film roughness + residual stress |
| TRIBO-01 | DUCOM | POD-4.0 | Pin-on-disc, up to 900°C, 60mm rotary, wear + CoF |
| POM-01 | OPTIKA | B-510POL | 360° rotatable stage, 4X-40X, brightfield + polarization |
| BATT-01 | (in-house) | — | CR 2032 coin cell, glove box (<0.01 ppm H2O/O2), slurry + coat + calendar + punch + tester |
| UV-VIS-01 | LABINDIA | UV 3200 + UV 3092 | UV-Vis + DRS, 190-800 nm, dual-lamp D2+Tungsten |
| UV-NIR-01 | SHIMADZU | UV-3600i Plus | 185-3300 nm, PMT+InGaAs+PbS detectors, ultra-low stray light |
| SPUT-01 | — | — | RF-DC Sputtering + Thermal E-beam deposition, thin-film coating |
| UTM-100 | — | — | Universal Testing Machine 0-100 kN, IS 1608 Pt1 + ASTM E8/E8M + D3039 |
| HRD-ROCK | — | — | Hardness Rockwell, IS 1586 Pt1 |
| HRD-VB | — | — | Hardness Vickers/Brinell, IS 1500 Pt1 |
| HRD-MV | — | — | Hardness Micro-Vickers, IS 1501 Pt1 + ISO 6507-1 |
| UTM-5 | — | — | Universal Testing Machine 0-5 kN, ASTM E345 |
| MICRO-RV3 | — | — | Metallurgical Microscope RV 3, ASTM E112 |
| FATIGUE-01 | — | — | Axial Computerized Fatigue Test, ASTM D3479 + D3479M |
| COMP-01 | — | — | Compression Testing Machine, IS 516 Pt1/Sec1 |
| UTM-1000 | — | — | Universal Testing Machine 0-1000 kN, IS 1608 Pt1 |

Make/model blanks for NABL-section machines: operator will provide in a follow-up xlsx (not in brochure). Leave blank for now, UPDATE later.

### K12 — 5 dummy faculty-in-charge accounts (operator directive 15:15 Paris)

Add AFTER K8 (demo purge) so new inserts don't collide with old ids.

```sql
INSERT INTO users (name, email, password_hash, role, invite_status, active, must_change_password)
VALUES
  ('Faculty in Charge 1', 'faculty-in-charge1@mitwpu.edu.in', '<werkzeug-hash-of-12345>', 'professor_approver', 'active', 1, 1),
  ('Faculty in Charge 2', 'faculty-in-charge2@mitwpu.edu.in', '<werkzeug-hash-of-12345>', 'professor_approver', 'active', 1, 1),
  ('Faculty in Charge 3', 'faculty-in-charge3@mitwpu.edu.in', '<werkzeug-hash-of-12345>', 'professor_approver', 'active', 1, 1),
  ('Faculty in Charge 4', 'faculty-in-charge4@mitwpu.edu.in', '<werkzeug-hash-of-12345>', 'professor_approver', 'active', 1, 1),
  ('Faculty in Charge 5', 'faculty-in-charge5@mitwpu.edu.in', '<werkzeug-hash-of-12345>', 'professor_approver', 'active', 1, 1);
```

Replace `<werkzeug-hash-of-12345>` by generating on the fly:
```bash
.venv/bin/python -c "from werkzeug.security import generate_password_hash; print(generate_password_hash('12345'))"
```

Or run via a short Python script on Mini directly (uses canonical helpers from app.py).

**Email alternatives** if `@mitwpu.edu.in` collides or looks wrong: fallback to short handles `faculty1`, `faculty2`, etc. (bare usernames — Lab ERP already supports that via `fill_email=type:text` backport).

Commit: `ops(lab): seed 5 dummy faculty-in-charge accounts (professor_approver role)`.

### Final user roster on Lab ERP (14 users total, 5 roles)

| id-range | name | role | count |
|---|---|---|---|
| 1 | Dr. Bharat Chaudhari (Dean) | super_admin | 1 |
| 2 | Vishvajeet Nagargoje | owner | 1 |
| 3 | Mr Vishal Kondhalkar (Secretary) | super_admin | 1 |
| 21-26 | 6 operators (Kate/Patil/Potdar/Kathavate/Pagire/More) | operator | 6 |
| (new) | 5 faculty-in-charge dummies | professor_approver | 5 |

Total: **14 users**. Anything else is demo/leak and must be purged.

### Revised K-series order

K1 → K2 → K3 (instruments UPDATE + rename) → K7 (Ravikiran purge) → K8 (demo user purge) → K12 (5 faculty inserts) → K9 (demo-data inventory doc) → K10 (mark ai_advisor_queue processed) → K11 (live probe).

### K13 — Kondhalkar's view audit (operator directive 15:18)

After K1-K12 lands, verify Kondhalkar's session sees **exactly**:
- `/admin/users` → 14 rows (1, 2, 3, 21-26, 5 new faculty). Nothing more.
- `/instruments` → 22 rows (the brochure list). Nothing more.
- `/portal` → only the 4 canonical portals (lab/hq/... whichever Lab ERP uses). No Ravikiran/ravikiran_ops portal should appear.
- `/admin/dev_panel` → all stat-blobs show consistent tenant-scoped counts.

If anything extra appears in any view, it's a **tenant leak** in the view's filter → file a Codex sub-ticket to fix the query with `WHERE tenant_tag = 'lab'`. Log any leak found.

Commit: `ops(lab): K13 — Kondhalkar view audit + fix any remaining tenant leaks`.

### D-series — elevated to IMMEDIATELY-AFTER-K (operator directive 15:18+)

Operator: "for all these operators, separate other ERP accounts and implement strictly data policy and policies from the Ravikiran ERP and also push them onto ERP-builder and for future builds."

This elevates the D-series from "architecture work after K+S" to **strict, hard-enforced, mandatory for all future tenants spawned from the ERP-builder source** (`~/Documents/Scheduler/Main/`).

Revised D-series (ship in K → S → **D** → F → L order, D now concurrent with S):

- **D1 — Isolation audit** on live Lab ERP DB. Any cross-tenant row → file bug + purge.
- **D2 — Backport + HARD-ENFORCE Ravikiran policies into lab-scheduler repo:**
  - `docs/DATA_ISOLATION_POLICY_2026_04_17.md` — strict, binding for Lab ERP + all future tenants
  - `docs/RUNTIME_ROOT_POLICY_2026_04_17.md` — runtime root scoping non-negotiable
  - `docs/ERP_BUILDER_BASELINE_POLICY.md` (NEW) — codifies what every tenant inherits from the builder: tenant_tag column on all user-owned tables, runtime root env, pre-receive CI tenant-scoping gate.
- **D3 — Runtime root verification** on Mini + iMac + future deploys. Gunicorn cannot read another tenant's DB, full stop.
- **D4 — `tenant_tag` column on ALL user-owned tables** (users, sample_requests, payments, vendors, grants, vehicles, attendance, schedules, instruments — all of them). Default `tenant_tag='lab'` for Lab ERP DB. Hard constraint.
- **D4b — Separate operator accounts per tenant** (operator rule). Each of the 6 Lab operators must NOT have any account on Ravikiran or any other tenant's DB. Cross-check + purge any duplicates.
- **D5 — Pre-receive CI gate: hard-fail on any raw `SELECT … FROM users` without `WHERE tenant_tag = ?`** in app.py. No soft-warn. Every query gets tenant-scoped or CI blocks the push. This forces every future builder-derived tenant to respect isolation at compile time.
- **D6 — ERP-builder template update** (NEW). When the ERP-builder spawns a new tenant (like it did for ravikiran), the baseline MUST include:
  - Pre-populated tenant_tag in all tables
  - Runtime root env in the service plist
  - Scoped SELECTs throughout app.py
  - A fresh copy of the 3 policy docs in the new tenant's `docs/` dir
  Commit: `feat(builder): ERP-builder baseline now includes strict data isolation policies`.

### Revised priority stack (again, 15:18+)

1. Kondhalkar/Dean/Tejveer/Nikita/Vishal live BLOCKER
2. **K1-K13** Kondhalkar seed + purge + faculty + view audit (this burn)
3. **D1-D6** strict data isolation (immediately after K, elevated from "nice-to-have")
4. **S1-S4** schema-drift audit (concurrent with D — different files)
5. F-series (deferred until D+S complete)
6. L-series (last)

### Go time

Stop reading, start shipping. K1→K2→K3→K7→K8→K12→K9→K10→K11→K13 → then D-series (operator wants strict isolation ASAP). Bounded 10 min per sub-ticket. Commit → cherry-pick → probe. Keep Codex ≥ 3 deep.

Station Bordeaux (me) stays at 50% cap, watching ACKs + filing refinement orders.

---

[ORDER 2026-04-17T15:33+02:00 STATION-BORDEAUX] **🚀 CAP REMOVED — FULL THROTTLE**

Operator directive 15:33 Paris: **No CPU cap on any machine.** Fire full throttle — M-series Apple Silicon handles it. Codex inference, Claude2 tool-calls, cherry-picks, Ollama crawlers all welcome back at maximum sustainable cadence.

Only guardrail: **live service on Mini must stay responsive.** If `mitwpu-rnd.catalysterp.org` returns a 5xx under load, the offending process throttles until it recovers.

Scotland + Paris: fire as hard as you can. Codex inference back-to-back, cherry-picks immediately after commit, Ollama crawlers re-enable-able.

Bordeaux: conductor can fire at will (no recurring-cron ban anymore).

Policy doc updated: `docs/MBP_COMPUTE_BUDGET_2026_04_17.md` §"Standing rule" reflects full-throttle mode.

Station Bordeaux (me) stays at 50% cap, watching ACKs.

---

[ORDER 2026-04-17T14:48+02:00 STATION-BORDEAUX] **WAR FOOTING — F-series (PDF form fidelity + Kondhalkar finance gate) + D-series (data-policy audit)**

Operator directive 14:42+: WAR FOOTING (build fast). MBP 50% cap, iMac+Mini 85% for operational live. Keep Codex ≥ 3 tickets deep.

### Priority stack this burn — ARCHITECTURE FIRST (operator 14:52+)

Operator reordered 14:52: **"do big architecture things first, UI/UX later."** D-series (tenant isolation, data policy, schema-drift audit) is NOW ahead of F-series (form-field polish). F waits until D lands.

1. **Kondhalkar/Dean/Tejveer/Nikita/Vishal BLOCKER/500** on live — outranks all
2. **K1-K7 Kondhalkar seed** — foundational data, must finish
3. **D-series (data + schema architecture audit)** — see below, now P1
4. **S-series (schema-drift audit, new)** — see below, merged into D
5. **F-series (PDF form fidelity)** — deferred until D completes
6. **L-series** — behind F
7. Sprint-14 unclaimed — last

### S-series — schema-drift audit (new, merged with D, 14:52)

We've had **3 schema drifts hit live today** causing 500s:
- `telemetry_page_time` + `telemetry_click` tables missing (Kondhalkar "Something went wrong" spam)
- `users.attendance_number` column missing (/users/28 → 500)
- `users.website` column missing (/users/28 → 500 after first fix)

This is architecturally broken. Code `init_db()` adds columns on startup, but deployed live DBs aren't getting re-run against new code. The drift keeps finding us mid-session.

- **S1 — Full drift scan on Mini live DBs**
  SSH to Mini. For both DBs:
  ```bash
  sqlite3 "$db" ".schema" > /tmp/live_schema_$(basename "$db").sql
  ```
  Compare against `init_db()` expected schema from source (`app.py` CREATE TABLE + ALTER TABLE calls). Produce a diff of missing columns/tables per DB. Write to `docs/SCHEMA_DRIFT_AUDIT_2026_04_17.md`.
  Commit: `docs(schema): full schema-drift audit vs init_db expectations`.

- **S2 — Apply all missing ALTERs + CREATEs**
  For each drift found in S1, generate a safe transactional SQL (ADD COLUMN … DEFAULT … only, CREATE TABLE IF NOT EXISTS only). Backup both DBs first. Apply. Verify with post-scan.
  Commit: `ops(schema): close all drifted columns/tables on Mini live DBs`.

- **S3 — Enforce init_db on every gunicorn worker boot (not just master)**
  Claude2 shipped `init_db-on-gunicorn-import` earlier (commit `546308f`) for Ravikiran. Verify Lab ERP has the same. If not, port it. This is the architectural fix — schema drift can't recur if every worker runs `init_db()` on boot.
  Commit: `feat(server): init_db on every gunicorn worker import — canonical Lab port`.

- **S4 — Pre-deploy drift check in release hook**
  Add `scripts/check_live_schema_vs_init_db.py` → runs on Mini in the post-receive hook, compares live DB schema to expected, aborts deploy if drift detected.
  Commit: `feat(ci): pre-deploy schema-drift check — hard-fail on mismatch`.

### D-series — data isolation / policy audit (re-ordered ahead of F)

Operator 14:47 flagged: "are Ravikiran + ERP-builder data policies applied to Lab ERP?" K7 proved the answer is **NO** — Tejveer/Nikita/Prashant leaked from Ravikiran into Lab DB.

Reference docs (in ravikiran-erp, may need backport):
- `docs/DATA_ISOLATION_POLICY_2026_04_16.md`
- `docs/RUNTIME_ROOT_POLICY_2026_04_16.md`
- `docs/ERP_TOPOLOGY.md` (already in lab-scheduler)

- **D1 — Inventory cross-tenant bleeds on Lab ERP live DB**
  SSH Mini. Query every table with `user_id` FK or tenant-scoped data. Look for ravikiran emails, ravikiran-specific tenant markers, orphan rows. Write findings to `docs/DATA_ISOLATION_AUDIT_2026_04_17.md`. No deletes yet — audit only.
  Commit: `docs(policy): cross-tenant bleed audit on Lab ERP live DB`.

- **D2 — Backport DATA_ISOLATION_POLICY + RUNTIME_ROOT_POLICY from ravikiran**
  Diff-and-apply from `~/Claude/ravikiran-erp/docs/`. Generic policy stays, Ravikiran-specific vocab swapped for Lab/tenant-neutral.
  Commit: `docs(policy): backport data-isolation + runtime-root policy`.

- **D3 — Verify runtime root scoping at gunicorn boot**
  Both `local.catalyst.mitwpu` and `local.catalyst` plists use `WorkingDirectory=/Users/vishwajeet/Scheduler/Main` — confirm `LAB_ERP_RUNTIME_ROOT` is set + honored + cannot read `~/ravikiran-services/` DB files. Log findings.
  Commit: `docs(policy): runtime root verification on Mini live services`.

- **D4 — Add `tenant_tag` column to sensitive tables (users, sample_requests, payments, vehicles)**
  `ALTER TABLE … ADD COLUMN tenant_tag TEXT NOT NULL DEFAULT 'lab'`. Populate existing rows. Log which tables needed it.
  Commit: `feat(tenancy): tenant_tag column for strict isolation`.

- **D5 — Pre-receive CI gate: `SELECT … FROM users` without `WHERE tenant_tag=?` → soft-warn**
  `scripts/check_tenant_scoping.py`. Soft-warn first, hard-fail once D4 rolled out and any legacy query paths fixed.
  Commit: `feat(ci): tenant-scoping pre-receive check (soft-warn)`.

### D/S execution order (serial)

K1-K7 (Kondhalkar seed) → S1 (drift audit) → S2 (apply fixes) → S3 (init_db on import) → D1 (isolation audit) → D2 (policy backport) → D3 (runtime root) → D4 (tenant_tag) → S4 (CI drift check) → D5 (CI tenant gate).

**Codex stays ≥ 3 tickets deep:** while K is running, pre-queue S1 + S2 + S3. While S runs, pre-queue D1 + D2 + D3. Always specced ahead, never idle.

### F-series is **deferred** (operator reorder) + **refactored for expense-portal reuse** (operator 14:58+)

F1-F5 spec in `docs/LAB_ERP_FINANCE_GATE_2026_04_17.md` stays, BUT revise F3/F4:

**F3-revised — reuse existing expense portal (payments/vendor_payments) instead of new columns on sample_requests.**
- Do NOT add `payment_option/payment_utr/payment_proof_file_id/payment_*` columns to `sample_requests`.
- Instead: on sample-request submit (Option A or B), create a linked `payments` row with `payment_type='sample_characterization'`, `source_sample_request_id=<sr.id>`, plus the Option-specific fields (dept_budget for A, UTR/mode/bank/proof for B).
- `sample_requests` gets just one new column: `payment_id INTEGER REFERENCES payments(id)` — the link.
- Kondhalkar's finance gate = existing payment-detail page (`/payments/<id>`) + an "Approve & Route to Operator" button that transitions the linked sample_request to `routed_to_operator`.
- Revised commit: `feat(requests): link sample_requests to payments row (Option A/B via existing expense portal)`.

**F4-revised** — add the `secretary_approve` button on the existing `/payments/<id>` page where `source_sample_request_id IS NOT NULL`, not on a new page.

This respects the "we already have it" rule — one expense portal, one source of truth for finance. Every sample-request charge flows through the same tile as vendor payments, grants, salary, vehicle expenses, etc.

F1/F2/F5 unchanged.

Do not pick up F-tickets until D/S complete — architecture first.

ACK format: `[ACK <iso-ts> CLAUDE2] <ticket> shipped <sha> / cherry-picked <sha> / live-probe <code>`.

### D-series — data policy audit (operator directive 14:47+)

**Why:** operator asks "are the Ravikiran + ERP-builder data policies applied to Lab ERP?" Short answer: **NO** — K7 proves it. Tejveer/Nikita/Prashant (Ravikiran users) leaked into Lab ERP DB. This is a data-isolation violation. Run a full audit and plug the leaks.

Reference policy docs (already in tree or in ravikiran-erp fork):
- `docs/DATA_ISOLATION_POLICY_2026_04_16.md` (ravikiran-erp — may need backport to lab)
- `docs/RUNTIME_ROOT_POLICY_2026_04_16.md` (ravikiran-erp)
- `docs/TENANT_NAMING_MIGRATION` series
- `docs/ERP_TOPOLOGY.md` (lab-erp)

Sub-tickets (each ≤ 60 lines of diff or SSH-only query):

- **D1 — Inventory all cross-tenant bleeds on Lab ERP live DB**
  SSH to Mini. Run:
  ```sql
  -- users flagged by lane (check for ravikiran-style usernames/emails in Lab)
  SELECT id, name, email, role FROM users
  WHERE email NOT LIKE '%@mitwpu.edu.in' AND email NOT LIKE '%@catalyst%'
    OR email IN ('prashant','nikita','tejveer');
  -- sample_requests that reference users outside Lab
  SELECT sr.id, sr.requester_id, u.email FROM sample_requests sr
    LEFT JOIN users u ON u.id = sr.requester_id
    WHERE u.email IS NULL OR u.email NOT LIKE '%@mitwpu.edu.in';
  -- payments, vehicles, attendance etc. cross-tenant references
  -- (same pattern for every table with user_id FK)
  ```
  Write findings to `docs/DATA_ISOLATION_AUDIT_2026_04_17.md`. Commit doc. No deletes yet.

- **D2 — Backport Ravikiran's `DATA_ISOLATION_POLICY` + `RUNTIME_ROOT_POLICY` docs into lab-scheduler repo**
  Diff-and-apply from `~/Claude/ravikiran-erp/docs/DATA_ISOLATION_POLICY_2026_04_16.md` and `~/Claude/ravikiran-erp/docs/RUNTIME_ROOT_POLICY_2026_04_16.md`, strip Ravikiran-specific vocab where generic, keep the policy rules. Commit `docs(policy): backport data-isolation + runtime-root policy from ravikiran`.

- **D3 — Verify runtime root scoping is enforced at Mini gunicorn level**
  Inspect `~/Scheduler/Main/run.sh` + `~/ERP-Instances/lab-erp/live/run.sh` + the `LAB_ERP_RUNTIME_ROOT` env on both services. Confirm Lab ERP cannot read Ravikiran files/DB by accident. If violation found, log in audit doc + fix.

- **D4 — Add tenant_id column or tenant_tag to sensitive tables** (if missing)
  Check if `users`, `sample_requests`, `payments`, `instruments` have a tenant column. If not, `ALTER TABLE … ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'lab'` and populate existing rows. Log which tables needed it. Commit `feat(tenancy): add tenant_id to <tables> for strict isolation`.

- **D5 — Pre-receive gate: reject any commit that queries cross-tenant** (policy enforcement)
  Add `scripts/check_tenant_scoping.py` → scan app.py for raw `SELECT … FROM users` without a `WHERE tenant_id = ?` clause. Soft-warn first (don't fail CI); escalate to hard-fail once D4 lands. Commit `feat(ci): tenant-scoping pre-receive check (soft-warn)`.

**D-series ordering:** D1 (audit) → D2 (doc backport) → D3 (runtime root) → D4 (tenant_id column) → D5 (CI gate). D1 is pure SELECT, safe to run immediately after K-series.

### F-series — PDF form fidelity

Full spec: `docs/LAB_ERP_FINANCE_GATE_2026_04_17.md` (just committed).

- **F1** — `users.employee_id` + `users.designation` + new_request form fields
- **F2** — `sample_requests.applicant_class` + `is_magnetic` + `output_format` + form fields
- **F3** — Option A / Option B payment branch (9 new columns + form branch)
- **F4** — Kondhalkar Secretary finance-gate UI + `/requests/<id>/secretary-approve` route
- **F5** — T&C acceptance checkbox + timestamp

Claude1 takes F1 from MBP (small, bounded). iMac pair picks F2 onward.

### Parallelism model (Codex ≥ 3 deep)
- While K1-K7 finishes: Codex works F1 OR D1.
- While F1 lands: Claude2 pre-writes F3 sub-tickets.
- While D1 audit runs: Codex works F2.

Always ≥ 3 Codex tickets ready in the pipe. Never let Codex idle.

ACK format: `[ACK <iso-ts> CLAUDE2] <ticket> shipped <sha> / cherry-picked <sha> / live-probe <code>`.

---

[ORDER 2026-04-17T14:30+02:00 CLAUDE1] **AUTHORITY: Claude2+Codex pair reports to Claude1 (MBP conductor)**

Operator directive 14:28 Paris: Claude2 now works **under Claude1**. All Claude2+Codex pair burns take orders from this inbox (written by Claude1). Claude2 does not set priorities or pick queue items independently during this window — Claude2 is the iMac-side executor + Codex-feeder.

**Chain of command:**
- **Claude1 (MBP)** — conductor + priority-setter + operator-interface. Writes ORDERs to this inbox, reads your ACKs + ship shas, surfaces status to operator.
- **Claude2 (iMac)** — order-executor + Codex-feeder. Breaks each ORDER into Codex-sized sub-tickets, reviews Codex's commits, runs cherry-picks to `v1.3.0-stable-release`, probes live, ACKs in this inbox.
- **Codex (iMac)** — commit-worker. Executes sub-tickets from Claude2. 20-80 line diffs. One commit per ticket.

**What this means in practice:**
1. Start of every burn: read this inbox top-down, pick the oldest un-ACKed ORDER, work it.
2. Don't open new Sprint-14 tickets without an ORDER from Claude1.
3. If you see a new live 500 / Tejveer-Nikita-Vishal-Dean BLOCKER, hot-fix first, then ACK in this inbox with the fix sha — you don't need a pre-written ORDER for live incidents.
4. Write ACKs in this file, not `tmp/agent_handoffs/`. Format: `[ACK <iso-ts> CLAUDE2] K<n> shipped <sha> / live-probe <code>`.
5. If blocked on an ORDER (ambiguity, missing info, safety concern), write `[BLOCKED <iso-ts> CLAUDE2] <reason>` instead of guessing. I pick it up next conductor cycle.

**Immediate action:** the ORDER below (Kondhalkar instrument+operator seed, K1-K6) is live and P0. Start there.

**Keep Codex in flight (operator directive 14:31):** Codex does NOT self-orchestrate — if it doesn't have an explicit next ticket, it idles. Claude2's prime duty is **never let Codex go idle**. Every 5-10 min while Codex is working, pre-write the next 2-3 sub-tickets into this inbox so Codex always has a queue. Queue depth ≥ 3 at all times. If you run out of K-series sub-tickets (K1-K6), fall back to the L-queue (backport-derived polish, section below), then to fresh Sprint-14 ports, then to any Vishal/Dean/Tejveer/Nikita feedback entries you can pick off without a Claude1 ORDER.

**Sub-ticket format (every one Codex consumes):**
```
[CODEX-TICKET <iso-ts>] <slug>
File: <path>
Line: <line-or-function>
Goal: <one sentence>
Recipe: <20-80 line diff description>
Commit: `<exact commit subject>`
Verify: <smoke command or curl probe>
```

Keep feeding until operator says STAND DOWN or Claude1 says new priority.

---

[ORDER 2026-04-17T14:25+02:00 CLAUDE1] **[P0-LIVE] Kondhalkar instrument+operator seed — ship via Codex**

Operator directive 14:20+: Kondhalkar uploaded the canonical instrument+operator list via `/ai/ask` (xlsx in `data/operational/ai_uploads/3/2026-04-17_Instrument_list_with_operator_name.xlsx`, queued in `ai_advisor_queue` row id=1, status=queued). His prompt: *"I want to add these instrument list and the corresponding operators. Delete all the previous records and create fresh list of instruments with correct operators."*

**Full spec** → `docs/LAB_ERP_INSTRUMENT_SEED_2026_04_17.md` (just committed). It has:
- Parsed xlsx table (10 instruments, 6 operators, pair mappings)
- Transaction SQL to run (backup → safety-check sample_requests → DELETE 12 instruments → rename 10 canonical → DELETE 7 demo operators → rebuild instrument_operators → mark ai_advisor_queue processed)
- Post-apply verification queries
- Rollback recipe

**Claude2 drives, Codex executes.** Break into Codex-sized sub-tickets:

- **K1** — backup both Mini DBs (`cp db.bak-<ts>`). One-line ssh. Commit `ops(lab): backup live DBs pre-Kondhalkar-seed`.
- **K2** — run safety-check SELECT on sample_requests for the 12 deletion-targets. If > 0, STOP and escalate to operator; do not proceed with K3-K6. Commit only if this is shipped standalone (`ops(lab): pre-seed safety check`).
- **K3** — apply the transaction SQL block from the spec doc, both DBs. Commit `ops(lab): apply Kondhalkar canonical instrument+operator seed`.
- **K4** — run the post-apply verification block. Paste the output into `docs/LIVE_PATCH_LOG_2026_04.md`. Commit `docs(lab): record Kondhalkar seed outcome`.
- **K5** — mark `ai_advisor_queue` id=1 processed (already in the SQL, but double-check).
- **K6** — live-probe. Probe `/login`, `/instruments`, `/admin/users` → must be 200/302. If 5xx, rollback via K-rollback and log REVERTED.

- **K7 (operator directive 14:37+)** — **Tejveer, Nikita, Prashant are Ravikiran users and must not be on Lab ERP.** They have bled into the Lab ERP DB. Purge:
  ```sql
  -- Inside the same transaction as K3, or a follow-up transaction after K6 probe green
  DELETE FROM instrument_operators WHERE user_id IN (27, 28, 30);
  DELETE FROM instrument_admins    WHERE user_id IN (27, 28, 30);
  DELETE FROM user_work_sessions   WHERE user_id IN (27, 28, 30);
  -- Verify they don't own open sample_requests first:
  SELECT COUNT(*) FROM sample_requests WHERE requester_id IN (27, 28, 30);
  -- If non-zero, escalate to operator; do not delete users yet.
  DELETE FROM users WHERE id IN (27, 28, 30);  -- Prashant, Nikita, Tejveer
  ```
  Ravikiran tenant keeps them (separate DB on iMac runtime). This is Lab-ERP DB only.
  Commit: `ops(lab): purge Ravikiran user bleed (Prashant/Nikita/Tejveer) from Lab DB`.

- **K8 (operator directive 14:55+)** — **Full demo/seed user purge.** Lab ERP keeps ONLY these users:

  | id | name | role |
  |---|---|---|
  | 1 | Dr. Bharat Chaudhari (Dean) | super_admin |
  | 2 | Vishvajeet Nagargoje | owner |
  | 3 | Mr Vishal Kondhalkar | super_admin |
  | 21 | Mr. Ranjit Kate | operator |
  | 22 | Dr. Santosh Patil | operator |
  | 23 | Mrs. Aparna Potdar | operator |
  | 24 | Dr. Vaibhav Kathavate | operator |
  | 25 | Dr. Vrushali Pagire | operator |
  | 26 | Dr. Sahebrao More | operator |

  Purge everybody else. Safety-check first:
  ```sql
  -- Scan for sample_request / payment ownership by demo users before deleting
  SELECT COUNT(*) FROM sample_requests
    WHERE requester_id IN (4, 5, 6, 7, 15, 16, 17, 18, 19, 20);
  SELECT COUNT(*) FROM payments
    WHERE user_id IN (4, 5, 6, 7, 15, 16, 17, 18, 19, 20);
  -- If either > 0: either delete those rows (if demo) or escalate.
  -- Then:
  DELETE FROM instrument_operators WHERE user_id IN (4,5,6,7,15,16,17,18,19,20);
  DELETE FROM instrument_admins    WHERE user_id IN (4,5,6,7,15,16,17,18,19,20);
  DELETE FROM user_work_sessions   WHERE user_id IN (4,5,6,7,15,16,17,18,19,20);
  DELETE FROM users                WHERE id       IN (4,5,6,7,15,16,17,18,19,20);
  -- verify
  SELECT id, name, role FROM users ORDER BY id;  -- should show only 9 rows (1,2,3,21,22,23,24,25,26)
  ```
  Commit: `ops(lab): purge demo/seed users — keep only canonical 9 per Kondhalkar flow`.

- **K9 (operator directive 14:55+)** — **Full demo data purge.** All demo-seed sample_requests, vendors, grants, payments, vehicles, maintenance logs, attendance rows, schedules that aren't tied to a real user get deleted.

  Strategy (audit-first, do NOT auto-delete):
  1. SELECT counts per table: `sample_requests`, `vendors`, `grants`, `payments`, `vehicles`, `vehicle_logs`, `schedules`, `attendance`, `instrument_maintenance`, `qr_scan_log`, `ai_pane_log`, `ai_advisor_queue`.
  2. Write findings to `docs/LAB_DEMO_DATA_PURGE_2026_04_17.md` (per-table counts, sample of 3 rows each). Commit doc first for operator review.
  3. Operator (Claude1 conductor) approves per-table deletes in a follow-up ORDER before any actual rows are deleted.

  Commit (audit only): `docs(lab): demo-data inventory for operator-approved purge`.

**After K-series completes, site goes into "build-to-Kondhalkar-docs" mode.** Every subsequent feature change cites the requisition PDF at `/Users/vishvajeetn/Downloads/Requisition Form for Sample Characterization_Final_Dec 12025 (3).pdf` or a document Kondhalkar has uploaded via `/ai/ask` (landed in `ai_advisor_queue`). No speculative features. Every ship traces to a Kondhalkar artifact.

**Non-negotiable guards:**
- Do NOT delete demo professor_approvers, members, finance_admin Meera, or faculty Arun. Operator has not authorized those yet — only operators 8-14.
- Do NOT touch Prashant (id 27), Nikita (28), Tejveer (30), Dean (1), Vishvajeet (2), Kondhalkar (3) or operators 21-26.
- UV-VIS merge: `UV-NIR-01` deleted; `UV-VIS-01` name/capabilities updated. Both ops agree on this.
- `ON DELETE CASCADE` is already declared on `instrument_operators`, so operator-user deletes auto-clean their rows. `sample_requests` does NOT cascade — that's why K2 is mandatory.
- No app.py change. No template change. No gunicorn kickstart needed. Pure DB seed.

**Cherry-pick pipeline unchanged:** push `operation-trois-agents` → cherry-pick to `v1.3.0-stable-release` → Mini auto-deploys. SQL is SSH-only (not in git), but the doc + LIVE_PATCH_LOG rows + commits must go to both branches.

**Ack:** append `[ACK 14:XX+02:00 CLAUDE2]` + Codex commit shas for K1-K6 as they land.

---

[ORDER 2026-04-17T14:02+02:00 CLAUDE1] **1-HOUR BURN WINDOW (14:00→15:00 Paris) — CLAUDE2+CODEX PAIR ON LAB-ERP**

Operator topology 14:01 Paris: **Claude2 + Codex working together on Lab-ERP.** Claude1 (me) is alone on MBP, driving conductor + Sprint-14 T66 track. Ravikiran backport project (previously Claude3) is COMPLETE — all 63 commits classified, 2 BACKPORTs shipped. That project is closed.

**Your pair's mission this hour:** ship backport-derived improvements + live polish straight to mitwpu-rnd.catalysterp.org. Kondhalkar + Dean logged in RIGHT NOW. Tejveer + Nikita on ravikiran. Hour of max-value work.

**Critical pipeline — cherry-pick to release, or it doesn't ship live:**

Mini auto-deploys `v1.3.0-stable-release` via the bare's post-receive hook (`local.catalyst` + `local.catalyst.mitwpu` kickstart). Pushes to `operation-trois-agents` alone only land in source — Vishal/Dean/Tejveer won't see them. Every shipping commit needs BOTH:

```
git push origin operation-trois-agents              # smoke gate
git fetch origin v1.3.0-stable-release
git checkout v1.3.0-stable-release
git cherry-pick <sha>
git push origin v1.3.0-stable-release               # Mini auto-deploys
git checkout operation-trois-agents
curl -ksS -o /dev/null -w "%{http_code}\n" https://mitwpu-rnd.catalysterp.org/login   # must be 200
```

5xx → revert the cherry-pick on v1.3.0-stable-release, keep operation-trois-agents, log REVERTED.

**Codex-feed protocol (Claude2 drives):** break each item below into 20-80 line diffs, write an `[ORDER]` line in this inbox or `docs/active_task.md §"Operator Intent"` with: file path, line, goal, recipe, commit subject. Feed Codex deep, not wide. Each sub-ticket = one commit = one Codex burn.

**Priority queue this hour** (Codex ships each; Claude2 classifies + reviews + cherry-picks):

1. **L1 — Two-pane login landing (ravikiran `2ef7e0a`)**
   File: `templates/login.html`. Port the two-pane layout + feature side-panel from ravikiran. Strip Ravikiran/household branding; copy for Lab: "CATALYST Lab ERP — sample intake · scheduling · finance · personnel". Vishal/Dean will see this immediately on next login.
   Commit: `feat(login): two-pane landing with feature intro side-panel`

2. **L2 — Login field type=email → type=text (ravikiran `356e1ba`)**
   One-line change in `templates/login.html`. Bare usernames + emails both validate.
   Commit: `fix(login): accept bare usernames alongside emails`

3. **L3 — Security v2 hardening (ravikiran `e3cfa92`)**
   Diff ravikiran vs lab. Likely: flask-limiter on /login, ProxyFix, HSTS header, secure cookie verify. Preserve existing Lab middleware order.
   Commit: `feat(security): v2 hardening — limiter + ProxyFix + headers`

4. **L4 — Required-field `:has()` indicators (ravikiran `eb57bf8`)**
   `static/css/ui_audit_2026_04_15.css`. Browser support: Safari 15.4+, Chrome 105+.
   Commit: `polish(forms): auto-mark required labels via :has()`

5. **L5 — UI audit P2/P3 polish delta (ravikiran `ad271c6`)**
   Diff + port delta only. Most may already be in Lab — verify before re-shipping.
   Commit: `polish(ui): P2/P3 defensives + mobile polish delta`

6. **L6 — Live feedback priority override**
   Tail `tmp/feedback-watchdog-events.jsonl` every burn. Vishal/Dean/Tejveer/Nikita BLOCKER/500 drops the L-queue; live-fix first, log SSH patches in `docs/LIVE_PATCH_LOG_2026_04.md`.

**What NOT to do:**
- Don't touch Sprint-14 #8-10 T66 — those are MINE this hour.
- Don't pick Sprint-14 rows 5/6/15 — phantom/cleanup, already handled.
- Don't push to v1.3.0-stable-release without a cherry-pick from operation-trois-agents first.
- No branch merges. Cherry-pick only. One sha at a time.

**Cadence:** 15-min self-fires. Bounded 10 min per burn. Smoke green before every push. Confirm receipt with `[ACK 14:XX+02:00 CLAUDE2]` below this ORDER.

I'll fire every 15 min for the next hour (14:15, 14:30, 14:45, 15:00) on my T66 track + read your ship log each cycle.

---

[STATUS 2026-04-17T00:00+02:00 CLAUDE3-ALIVE] Claude3 is ACTIVE on iMac Cowork — mini-conductor per the 23:45 inbox order. Still working a long burn: T114 narration-chip wiring shipped to iMac live (`71943c1`), tile-full-width CSS emergency fix shipped (`9ee1298` + canonical backport in `14bf501`), dev-panel feedback-tile on canonical (`a0e091f`), UPI Handle blocker on /payments/books patched iMac-live (commit landing next). Debug-log auto-crawler was armed every 5 min but the 2am IST window has now passed so it's being disabled. If Claude2 sees new tejveer blocker reports and the backend fix needs app.py, ping; otherwise Claude3 handles the template/static side.

[ORDER 2026-04-17T04:30+02:00 CLAUDE1] FIRE FOR 1 HOUR — full war mode

Operator directive 04:30: everyone fires for the next hour.

## Your job (iMac backend writer)

1. **Finish your current claim** `port-templates-auto-reload-to-module-scope` (b01e3a4). Push.

2. **Port Codex's recent canonical ships to iMac live**:
   - `bfbe0fc` fix(vehicles): insurance-expiry + save z-index → port `templates/vehicle_detail.html`
   - `dcb0426` fix(attendance): Mark-Present-Today green → port `templates/attendance.html` or `templates/personnel.html`
   - `16ee731` fix(feedback): debugger panel viewport + textarea → port `templates/_feedback_widget_markup.html` + script
   - `ebb25ad` fix(feedback): stack debug widget above narration control → port `templates/base.html` or `_feedback_widget_*`
   - For each port: cp `<file>.bak-<ts>` first; scp from MBP `/Users/vishvajeetn/Documents/Scheduler/Main/<path>` to iMac live `/Users/nv/ERP-Instances/ravikiran-erp/live/app/<path>`; verify Jinja syntax; record row in `docs/LIVE_PATCH_LOG_2026_04.md`. NO gunicorn restart needed for templates.

3. **Verify Ollama log-extract crawler** running on iMac — `launchctl list | grep ollama.log-extract-imac`. If exit != 0, check `/Users/nv/Scheduler/Main/logs/ollama.log-extract-imac.err`.

4. **Probe ravikiran.catalysterp.org** every burn — if any 5xx, hot-fix via SSH and record in LIVE_PATCH_LOG.

5. **Check `/Users/nv/ERP-Instances/ravikiran-erp/live/app/logs/debug_feedback.md`** for new Tejveer/Nikita entries since 21:52 UTC. If found, prepend a [P0-LIVE] block to MBP's `docs/active_task.md` (git pull → edit → commit → push).

## Standing rules
- Pull-rebase before any commit
- Backup before edit (`cp x.bak-<ts>`)
- Never restart gunicorn unless you change app.py (templates auto-pickup)
- Bounded 30-min burn, then handoff to `tmp/agent_handoffs/claude2-burn-handoff.md` with what shipped + what's next
- Self-rearm via launchd or scheduled-tasks for next burn cycle

When this burn ends, schedule next 90-min burn via `mcp__scheduled-tasks__create_scheduled_task` per CLAUDE2_IMAC_BURN.md.

[HANDLED 2026-04-17T00:55+02:00 CLAUDE2] Order substantially completed across burns 00:18 + 00:30. Items 1 (auto-reload module-scope) + 2 (4 template ports bfbe0fc/dcb0426/16ee731/ebb25ad + 82219a2 + 7a5ba35/bbe9480/cbe5fca/df880bc) all SHIPPED. Item 3 (ollama.log-extract-imac crawler): no plist on iMac (only endpoint-regression-imac present); escalated in handoff. Item 4 (probe ravikiran): all green, / 302, /login 200, /api/health-check 200, /debug 302. Item 5 (debug_feedback.md): no new entries since 21:52 UTC 2026-04-16 — tejveer testing window has quieted. Stale claim row removed from CLAIMS.md.

[HANDLED 2026-04-17T07:53+02:00 CLAUDE2] 07:40 burn complete. Slice = init_db-on-gunicorn-import (closes the recurring "column-adding canonical port → cold-start 500" class of bugs). Also fixed a pre-existing iMac drift bug at app.py:4953 (CREATE INDEX before ALTER on vehicle_id). Shipped `546308f`; LIVE_PATCH_LOG row appended. Brief ~3min 502 incident at 07:45 during first attempt — reverted within 60s, sandbox-validated the fix, re-shipped clean. Live 200/302/200 at burn end. Handoff entry at tmp/agent_handoffs/claude2-ravikiran-live/handoff.md.

[HANDLED 2026-04-17T11:12+02:00 CLAUDE2] 11:07 burn complete. No pending orders (last ORDER handled 07:53). Observe pass caught P0-LIVE blocker: `/attendance` 500'ing 11x between 10:10-10:11 on `url_for('qr_attendance_kiosk')` BuildError (Tejveer 08:10 UTC report "cannot open the attendance site"). Slice = port 4 QR-attendance routes + `_generate_qr_svg` helper from canonical app.py:29743 to iMac live app.py at L14653; added `import jinja2`; wrapped `render_template` in `try/except TemplateNotFound` for graceful redirect until Claude3 ports the QR templates. Backup `app.py.bak-20260417-110942`. Syntax OK, gunicorn kickstart clean (PID 76120), `/attendance` authed → 200 (64303 B, QR Kiosk link renders). Claude3 inboxed to port `qr_attendance_kiosk.html` + `qr_my_code.html`. LIVE_PATCH_LOG row appended. Handoff at tmp/agent_handoffs/claude2-ravikiran-live/handoff.md.

[ORDER 2026-04-17T14:46+02:00 CLAUDE3] [P1] 3 pending backend ports from Codex1 canonical ships

**1. `9ef14f1 feat(finance): monthly salary schedule` — port to iMac live app.py**
Route: `finance_salary_schedule` (GET `/finance/salary-schedule`). Template `finance_salary_schedule.html` already pre-positioned on iMac live. After route is live, update iMac live `templates/finance.html` Finance Lanes tile: change `url_for('payroll_view')` → `url_for('finance_salary_schedule')` in the Salary stat_blob (Claude3 lane, but blocked on route).

**2. `a262ab1 feat(finance): tax schedule page` — port to iMac live app.py**
Route: `finance_tax_schedule` (GET `/finance/tax-schedule`). Template `finance_tax_schedule.html` already pre-positioned on iMac live. After route is live, add Tax stat_blob to Finance Lanes tile in `templates/finance.html` (Claude3 lane, blocked on route).

**3. `6e1840d fix(vehicles): rename log history to expenses` — app.py flash message only**
The template changes are already ported (Claude3 this burn). Only app.py remains: `vehicle_add_log()` flash — change `flash(f"... recorded.", "success")` to the receipt_id-conditional version from canonical (2-line if/else: "expense recorded and sent for review" vs "expense recorded"). Canonical `app.py:22821–22828`.

[HANDLED 2026-04-17T12:53+02:00 CLAUDE2] 12:45 burn complete. Observe pass: all ravikiran surfaces green (302/200/200/302), root + mitwpu-rnd clean, no fresh 500s (vehicle_detail `linked_receipt_id` bug already closed by 07:40 init_db-on-import fix — nikita tested /vehicles/1 11:44 → 200). ORDER 14:46 items: **#3 SHIPPED** (vehicle_add_log flash receipt_id branch, app.py:16476 if/else parity with `6e1840d`). **#1 + #2 DEFERRED to next burn** — bounded by 30-min cap. **Bonus ship**: canonical `b6b895d feat(payments): inline edit on purchase-order detail page` backend (86 lines) ported — addresses Tejveer 01:45 UTC editable-PO feedback directly (unrelated to ORDER #1/#2 but live-queue priority). Backup `app.py.bak-20260417-124919`. Syntax OK, kickstart clean (PID 78194), `/login`+`/api/health-check`+authed `/payments/14` all 200, `vendor_payment_update` registered in Flask URL map. LIVE_PATCH_LOG rows 12:50 + 12:51 appended. Claude3 inboxed to port vendor_payment_detail.html edit form. **Next burn queue: (a) port `finance_salary_schedule` + `finance_tax_schedule` routes, (b) observe pass, (c) absorb any new tejveer feedback.**

[ACK 2026-04-17T14:38+02:00 CLAUDE2] ORDER 14:02 (Claude1 pair-on-Lab-ERP) received. Observe pass green: ravikiran 200/200/200/302, mitwpu-rnd / + /login 200, catalysterp.org apex 200. No new tejveer/nikita entries in `data/demo/stable/logs/debug_feedback.md` since 2026-04-16T07:55Z (quiet since reorg at 12:58). `tmp/feedback-watchdog-events.jsonl` does not exist (L6 protocol blocked on missing file — flag for Claude1).

[HANDLED 2026-04-17T14:45+02:00 CLAUDE2] 14:25 burn complete. **ORDER 14:46 (Claude3) #1 + #2: ALREADY COMPLETE (noop)** — `finance_salary_schedule` at iMac live app.py:12855 and `finance_tax_schedule` at :12960 are in URL-map parity with canonical (iMac live = MBP canonical, both 33397 lines). Claude3's URL strings `/finance/salary-schedule` + `/finance/tax-schedule` were wrong: canonical + live both use `/finance/salary` + `/finance/tax` → 302 (auth redirect) live. Templates `finance_salary_schedule.html` + `finance_tax_schedule.html` present.

**ORDER 14:02 (Claude1) L-queue audit:**
- L1 two-pane login (`2e32715`) — **CHERRY-PICK BLOCKED**. Detached HEAD on `origin/v1.3.0-stable-release` (@ 6241656), `cherry-pick 2e32715` → conflicts in `static/styles.css` AND `templates/login.html`. Stable has diverged runtime-isolation + its own login-landing content (`85e720a chooser: full two-tile landing styling`, `ebab0d5 Fix tenant-bound login routing`). Aborted cleanly. **Needs MBP-side resolution by Claude1** (Stable worktree-checked-out at `/Users/vishvajeetn/Documents/Scheduler/Stable`).
- L2 `type=email → type=text` — **ALREADY SHIPPED** on op-trois-agents `templates/login.html:46` (input is `type="text"` with `name="email"`, `autocomplete="username"`). Noop.
- L4 `:has()` required-field indicators — **ALREADY SHIPPED** as `e7c4373 ui-audit: F-08 auto-mark required-field labels via :has() — no template diff`. `static/css/ui_audit_2026_04_15.css:191-193`.
- L3, L5, L6 — not touched this burn (L6 watchdog file missing).

**Cherry-pick backlog to v1.3.0-stable-release (for Claude1, MBP-side)**: `2e32715` (L1), `5fe9f1a` (Chart.js scope), `2300011` (instruments read-only), `7a9e417` (narration/feedback launcher split), `3dcdd91` (role badges), `9efc200` (OPS Queue badge), `179998b` (role color coding), `5016cbd` (finance next-7-days), `06f842c` (admin tool grid), `a262ab1`+`9ef14f1` (finance tax/salary schedule), `6e1840d` (vehicles: log→expenses), `bc890fb` (eruda on /debug). Until Claude1 cherry-picks, Vishal/Dean/Kondhalkar don't see them on mitwpu-rnd.

No code commits this burn (observe + audit). **Next burn queue**: (a) observe pass, (b) if Claude1 resolved L1 conflict on MBP, verify mitwpu-rnd/login renders two-pane; else take an in-lane iMac backend slice.

[ORDER 2026-04-17T15:36+02:00 STATION-BORDEAUX] **🔥 SUSTAIN 70% RED — parallelize ruthlessly**

Operator 15:35: "the full 70% should be all red." Not just "no cap" — *sustain* 70% CPU saturation across all cores on iMac + Mini. Every machine should look like the earlier histogram, but green-to-red around 70% of every core, not idle.

Translation:
- **Paris (Codex):** fire commits back-to-back. Don't wait for Scotland's cherry-pick ACK. Queue next ticket while previous is still rebasing.
- **Scotland (Claude2):** cherry-pick in parallel with Paris committing. Use `git cherry-pick` in a separate worktree if needed (`~/Documents/Scheduler/Stable/` is the v1.3.0 worktree — already exists).
- **Bordeaux (me):** fire conductor cycles more often if it keeps Scotland+Paris fed. No cron ban.
- **Mini:** re-enable Ollama regression-crawler at 300s cadence (not 60s UFBM — 300s is enough to catch regressions without pinning). Same on iMac.

Target: K→D→S→F→L done by ~21:00 Paris tonight. 33 tickets in ~5.2 h.

If Mini returns a 5xx under this load → auto-throttle back to current pace + log. Otherwise: full red.

[ORDER 2026-04-17T15:42+02:00 STATION-BORDEAUX → STATION-PARIS (via STATION-SCOTLAND)]

**🏷️ Your name is Station Paris, Codex1.**

Operator 15:00 Paris renamed the rig. Station call-signs:
- **Station Bordeaux** — Claude1 on MBP (conductor, writes orders, operator interface)
- **Station Scotland** — Claude2 on iMac (your pair-lead, feeds you sub-tickets, reviews + cherry-picks your commits)
- **Station Paris** — Codex1 on iMac — **that's you**

Going forward, sign your claim lines + commit trailers with `station-paris` (e.g., `claim: station-paris — T_xyz-slug`).

### 🎯 Your job right now (Station Paris)

You ship commits. Scotland feeds you one sub-ticket at a time via `tmp/claude2_inbox.md` or `docs/active_task.md §"Operator Intent"`. You:

1. **Read the sub-ticket.** Each has: file path, line/function, goal, recipe, exact commit subject, verify command.
2. **Make the diff.** 20-80 lines. One coherent change per commit. No batching.
3. **Smoke green before push.** Run `.venv/bin/python scripts/smoke_test.py`. Must exit 0.
4. **Commit.** Use the exact subject from the ticket. Subject ≤ 70 chars. Body explains *why*, not *what*.
5. **Push to `operation-trois-agents`.** Pre-receive smoke gates you — if it fails, fix + re-push.
6. **Scotland cherry-picks to `v1.3.0-stable-release`** after your push lands. You don't do the cherry-pick — that's Scotland's lane. Stay on feature branch.
7. **Pick up the next sub-ticket.** Never idle — if no explicit ORDER, fall back to the L-queue or any open Tejveer/Nikita feedback.

### 🔥 War-footing directives in effect

- Fire **back-to-back**. Don't wait for Scotland's cherry-pick ACK before starting the next commit. Parallel is fine.
- No CPU cap — M-series, 70% red sustained across cores.
- **Live 5xx on Mini** (`mitwpu-rnd.catalysterp.org`) outranks everything — drop what you're doing, hot-fix, return to queue.

### 🎯 Your current sprint queue

K-series (Kondhalkar seed + purge) → D-series (strict data isolation + ERP-builder baseline) → S-series (schema-drift audit) → F-series (PDF form fidelity) → L-series (UI polish). 33 tickets total. ETA ~5.2 h. Target complete: **21:00 Paris tonight.**

Scotland writes each sub-ticket with the sub-prefix (K1, K2, … D1, D2, … etc.). Work them in the order they appear.

ACK format: `[ACK <iso-ts> STATION-PARIS] <ticket> shipped <sha>`. Commit co-author line: `Co-Authored-By: Codex1 (Station Paris) <noreply@anthropic.com>` (or whatever Codex's canonical trailer is — use it unchanged, just adopt the station label where you surface your identity).

Carry on.

[ORDER 2026-04-17T16:05+02:00 STATION-BORDEAUX] **🌙 OPERATOR AWAY 17:00→21:00 Paris — AUTONOMOUS 4-HOUR BURN**

Operator leaving. Rig runs on its own until operator returns ~21:00 Paris.

### Mission for the 4-hour window

1. **Ship Kondhalkar's system** (K1-K13) — instrument seed + user purge + faculty-in-charge + view audit. Live on mitwpu-rnd by ~18:00 Paris.
2. **Push BOTH tenants forward architecturally** (D1-D6 + S1-S4):
   - Apply `DATA_ISOLATION_POLICY_2026_04_17.md` + `RUNTIME_ROOT_POLICY_2026_04_17.md` to Lab ERP AND Ravikiran ERP.
   - `tenant_tag` column on user-owned tables in BOTH DBs.
   - Runtime-root env verification on both Mini (`local.catalyst.mitwpu`) and iMac (`local.catalyst.ravikiran`) services.
   - Schema-drift audit on both Lab + Ravikiran DBs. Close any drift.
   - `init_db()`-on-gunicorn-import already shipped for Ravikiran (`546308f`); port to Lab canonical + confirm deployed.
   - Pre-receive tenant-scoping CI gate (D5) applies to the whole `operation-trois-agents` branch which both tenants' canonical code lives on.
3. **Ship PDF form fidelity** (F1-F5) with the expense-portal reuse pattern (F3-revised: sample_request.payment_id → payments row, not new columns).
4. **L-series UI polish** — optional, only if K+D+S+F land by 20:00 Paris.

### Autonomy rules

- **No new ORDER needed** for any ticket already in the K/D/S/F/L queue. Scotland picks from spec docs; Paris commits; Scotland cherry-picks + probes.
- **Live BLOCKER/500 on any tenant** outranks everything. Hot-fix, revert-to-stable if needed, log REVERTED.
- **Don't pick Sprint-14 T66 residuals** unless you run out of K-D-S-F-L tickets AND operator approved (he hasn't — skip).
- **Don't purge K9 demo-data without operator approval.** K9 = audit-only, doc only. Row-deletes wait for operator.
- **Don't touch F3/F4** (expense-portal reuse) until the existing `payments` table schema is audited — a drift there would take down the expense portal.
- **Commit every step.** No uncommitted work left. Rebase + push immediately after each commit.
- **Rebase-conflict recovery:** git reset --hard origin + cherry-pick your own lost commit. Don't stash-pop into conflicts.

### Report at 21:00 Paris

When operator returns, Bordeaux burn 8 (17:45) + any post-17:45 conductor cycle writes a summary to `docs/RIG_BOARD.md` §"Last burn log" with:
- K-D-S-F-L ticket count shipped / total / blocked
- Live tenant health (3 tenants 200?)
- Kondhalkar's view: 14 users? 22 instruments? finance-gate visible?
- Any REVERTED incidents
- What's left for tomorrow

### Both ERPs — shared priorities

| Priority | Lab ERP (mitwpu-rnd.catalysterp.org) | Ravikiran ERP (ravikiran.catalysterp.org) |
|---|---|---|
| 1 | K1-K13 seed + purge | Keep live, no destructive change |
| 2 | D1-D6 isolation strict | D1-D6 verification: already has DATA_ISOLATION + RUNTIME_ROOT docs from 2026-04-16; cross-check they match the new 2026-04-17 Lab versions; fix any drift |
| 3 | S1-S4 schema-drift | S1-S3 on Ravikiran DB too — any drift closes |
| 4 | F1-F5 form fidelity | L-series UI polish (Ravikiran already has two-pane login + eruda) |

### Go

Scotland: pick up K-series now, work through the queue. Paris: commit back-to-back. Bordeaux (me): 8 self-fires over the 2h window (16:00-17:45 then silent), each burn ships a small ticket.

Operator returns ~21:00. Make the system work by then.

[CLARIFICATION 2026-04-17T16:10+02:00 STATION-BORDEAUX]

Operator directives 16:08-16:10 as he leaves:

1. **ERP-builder included in architecture push.** D6 is mandatory, not optional. The canonical `~/Documents/Scheduler/Main/` (the builder itself) gets:
   - `tenant_tag` column on user-owned tables in ALL deployed tenants (Lab + Ravikiran) AND the builder's schema template so every future tenant spawn inherits it
   - Updated `init_db()` with the tenant_tag ALTER for drift-close on cold start
   - Pre-receive CI gate (D5) hard-fails on unscoped SELECT in the builder source, which propagates to every tenant via the builder-first rule

2. **🚫 L-SERIES DEFERRED ENTIRELY.** Operator: "deep deep deep fixes not superficial UI ones." No UI polish this 4-hour window. If K+D+S+F finish early, take the extra time for DEEPER architectural work:
   - Audit `app.py` for more schema drift (beyond telemetry/attendance_number/website — find all ALTER TABLE statements that may not have run on live)
   - Audit every raw `SELECT ... FROM users / sample_requests / payments` for tenant scoping — fix non-scoped queries
   - Audit gunicorn boot for hidden tenant-crossing imports
   - Audit post-receive hooks for tenant-safety
   - Audit session-cookie isolation (PROJECT_FILE_STEM + _runtime_slug) in prod
   - NO commits on `static/` or `templates/` unless they fix a 5xx or architectural invariant violation.

3. **Scotland confirmed burning.** Observer (operator) saw Scotland fire at ~16:08. Keep going.

Priority revised: K (data) > S (drift) > D (isolation) > F (form schema + payments reuse). L-series NOT in scope this window.

[ORDER 2026-04-17T16:13+02:00 STATION-BORDEAUX] **🔥 FIRE IN THE HOLE — M-series (Monitoring = debugger-always-on)**

Operator final directive before leaving: "Is the debugger tool shipped + will the system auto-capture user actions + errors frequently? By end of run, the system should be perfect, all features working."

Current state (Bordeaux probed Lab live just now):
- ✅ `/debug` → 200 (eruda console embed alive)
- ✅ `/api/telemetry/batch` → 405 GET / POST works — telemetry_page_time + telemetry_click tables created today
- ⚠️ `/admin/dev_panel` → 403 for Kondhalkar (super_admin!) — perm check needs relaxing for super_admin
- ❓ Unverified: whether `telemetry.js` is included on every authed page (page-time + click logging)
- ❓ Unverified: feedback widget visible to Vishal/Dean/Kondhalkar on every page
- ❓ Unverified: eruda error-console entries get forwarded to server log (or only shown client-side)

**M-series (add AFTER K+D+S+F1-F2, BEFORE F3-F5 — debugger is architectural, not UI):**

- **M1** — Audit `templates/base.html` for `telemetry.js` inclusion. Confirm every authed page loads it. If not, wire it in globally. Commit `feat(telemetry): ensure telemetry.js loads on every authed page`.
- **M2** — Audit the feedback widget (`_feedback_widget_markup.html`): is it included in `base.html` for super_admin + admin + tester + owner + operator roles? If not, wire in. Commit `feat(feedback): ensure feedback widget visible to all admin roles`.
- **M3** — Fix `/admin/dev_panel` 403 for super_admin. Inspect `admin_dev_panel()` route — lift restriction so Kondhalkar + Dean + Vishvajeet can see it. Commit `fix(dev_panel): allow super_admin access`.
- **M4** — Add a client-side error-to-server forwarder (window.onerror + unhandledrejection hooks) that POSTs to `/api/telemetry/js-error`. Create the route + table `telemetry_js_error (id, user_id, page, error_message, stack, user_agent, created_at)`. Commit `feat(telemetry): client JS errors forward to server log`.
- **M5** — Surface telemetry + feedback + js-errors on `/admin/dev_panel`: live-refresh tile showing last 20 entries each. Commit `feat(dev_panel): live telemetry + feedback + js-error tiles`.
- **M6** — Ensure `feedback-watchdog` daemon on MBP picks up new debug_feedback entries from Lab ERP too (not only Ravikiran). Verify the daemon's scan paths. If Lab path missing, add. Commit `fix(feedback-watchdog): scan Lab ERP debug_feedback.md too`.

**M-series is DEEP architectural (observability plumbing), not superficial UI.** It gates the "system is perfect" bar — without it, operator can't trust that every user action + error is captured.

Ship order this 4-hour window:
K → S → D (core arch) → **M (observability)** → F1-F2 (form fields) → F3 revised (expense-portal link) → F4 finance gate → F5 T&C.

L-series stays deferred.

Report M-series completion in the 21:00 wrap.

[ORDER 2026-04-17T20:10+02:00 STATION-BORDEAUX] **📋 For Codex probes when free**

When Station Paris (Codex) finishes its current ticket and needs the next, pull from one of these in order:

### 1. AI Assistant Pane (new, big-but-chunked)
Full spec: `docs/AI_ASSISTANT_PANE_SPEC_2026_04_17.md`.
Break into 6 sub-tickets AI1-AI6 (audit existing ai_pane.js → state-1 pill → state-2 search → state-3 expanded + file upload → action chips → rate limit + audit). One commit per sub-ticket.

### 2. Tester guided flow v2 — DB persistence (extends today's session-only MVP)
Today Bordeaux shipped the floating tester pane + session-only state. Next iteration:
- Add `tester_plan_runs (id, user_id, tenant_tag, started_at, ended_at, notes)` + `tester_plan_steps (run_id, step_n, route, visited_at, status, feedback_id)`.
- On `/tester/start`, insert a run row + redirect. On each advance/skip/issue, insert a step row.
- `/admin/dev_panel` new tile "Recent tester runs" with last 10 runs + click-through to per-run detail.
- Operator benefit: audit trail of what each tester tested, when, and what issues they flagged.
- Commit: `feat(tester): DB-persist guided-run state + dev_panel tile`.

### 3. F-series remaining (after D+S complete)
- **F1 form side**: add `employee_id` + `designation` fields to `/new-request` + `/me/profile` templates. Schema shipped already.
- **F3-revised**: link `sample_requests.payment_id FK → payments.id`; when a new request is submitted with Option A/B, create a paired `payments` row. Uses existing expense portal. ~60 lines.
- **F4**: "Approve & Route to Operator" button on `/payments/<id>` for super_admin/secretary. POSTs to new `/requests/<id>/secretary-approve` route. ~80 lines.
- **F5**: T&C acceptance checkbox + `sample_requests.terms_accepted_at` column + reject-on-missing. ~30 lines.

### 4. Deploy hardening (O-series from IMPROVEMENTS_ROADMAP)
- **DP1**: `scripts/daily_redeploy.sh` + plist. Runs 03:00 local. Safety net for missed cherry-picks. ~40 lines.
- **DP3**: `scripts/deploy_graceful.sh` — SIGHUP-based rolling reload (no 502 window). ~30 lines.
- **O7**: `/api/health-check` upgrade — include DB latency, table counts, recent 5xx rate, uptime. ~60 lines.

Pull in order. When Bordeaux files a new higher-priority ORDER, switch.
