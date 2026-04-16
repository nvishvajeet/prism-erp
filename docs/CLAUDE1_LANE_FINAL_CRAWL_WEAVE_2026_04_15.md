# Claude 1 Lane — Final crawl + weaving check + Codex 0 code review

> Last lane for Claude 1, Operation TroisAgents. Claude 0 is out
> of context budget — this file is your complete assignment. Read
> top to bottom, then execute. Report all findings to the repo
> (no chat pings to Claude 0). Codex 0 is running in parallel on
> their final lane; don't overlap.

---

## Mission

1. Verify the sprint's output by crawling all four subdomains and
   the local chooser.
2. Do the 6-check weaving report.
3. Independent code review of Codex 0's commits (Lanes 1, 2, 3).
4. If everything is green, hand off to Codex 0 to tag `v2.0.0-rc1`.
   If not, write a fix list and tag nothing.

Budget: ~30 min. Stop if context runs out; commit partial work
with `STATUS: PARTIAL` suffix.

---

## Lane boundaries

Files you may create:
- `docs/OPERATION_TROIS_AGENTS_CRAWL_REPORT.md`
- `docs/OPERATION_TROIS_AGENTS_WEAVE_REPORT.md`
- `docs/OPERATION_TROIS_AGENTS_CODEX_REVIEW.md`
- `docs/OPERATION_TROIS_AGENTS_RESULT.md` — one-page executive summary

Files you may edit:
- None. This lane is read-only against code. If you find a bug,
  document it — don't fix it. Urgent bugs get a `STATUS: BLOCKER:`.

Files banned:
- Any `app.py`, any template, any CSS, any test. No code changes.

---

## Deliverable 1 — Crawl all four subdomains (~10 min)

### Targets

| URL | Expected backend | Expected behaviour |
|---|---|---|
| `https://catalysterp.org/` | chooser :5060 (OR legacy Lab-ERP :5055 — current tunnel ingress may still route this to Lab-ERP since chooser isn't deployed yet; note which) | Two-tile landing OR Lab-ERP login — check what it actually is |
| `https://mitwpurn.catalysterp.org/` | Lab-ERP operational :5056 | 302 → /login or /portals |
| `https://mitwpu-rnd.catalysterp.org/` | Lab-ERP operational | Same as mitwpurn (both aliases work) |
| `https://ravikiran.catalysterp.org/` | Ravikiran :5057 | 302 or 200 — verify 500s are fixed |
| `https://playground.catalysterp.org/` | Lab-ERP demo (MBP :5058) | 302 → /login; admin/12345 should now log in cleanly after Codex 0's ProxyFix |

### Additional targets (local)

- `http://localhost:5060/` — chooser (start it first if not running: `python /Users/vishvajeetn/Documents/Scheduler/Main/chooser/app.py`)
- `http://localhost:5060/static/chooser.css` — returns 200
- `http://localhost:5060/health` — returns `{"status":"ok"}`

### Method

`curl -sSI` for headers and status. For deeper pages, `curl -sS`
and grep the body for expected strings. For the login-works check
on playground, use a GET-then-POST with cookie jar (see the CSRF
pattern Codex 0 used in `tests/test_proxy_csrf.py`).

### Output

`docs/OPERATION_TROIS_AGENTS_CRAWL_REPORT.md` — one row per URL:
- Status code
- Response time
- Content-Security-Policy header present? (Codex 0 should have
  added this in Lane 1 Deliverable 2)
- X-Frame-Options: DENY?
- HSTS present on HTTPS?
- Visible brand contamination? (e.g. `MITWPU` on Ravikiran,
  `Ravikiran` on MITWPU)

### Status

`STATUS: T+NN Claude1 — crawl complete, <N clean / M flagged>`

---

## Deliverable 2 — Weaving check (~10 min)

Cross-check between lanes. Each check is pass/fail; write findings
to `docs/OPERATION_TROIS_AGENTS_WEAVE_REPORT.md`.

### Check W1 — Nav → Route

Every nav entry you added / Claude 0 stitched points at a real
route that returns 200/302 (not 404). Specifically:
- `Quick Mark (#)` button on `templates/attendance.html` →
  `/attendance/quick` → 200 for admin, 403 for requester.
- `url_for('attendance_quick_mark_page')` resolves (no
  `werkzeug.routing.BuildError`).

### Check W2 — Form → Save

Every form with a Save button actually POSTs somewhere the app
handles (not a 404). Sample: `/attendance/quick`'s POST target
(`/attendance/api/quick-mark`). One or two samples are enough —
full form audit is not this lane's scope.

### Check W3 — Silo

Ravikiran UI has zero "MITWPU / Lab / FESEM / XRD / ICP-MS"
visible text:
```
grep -rniE "MITWPU|Central Instrumentation|FESEM|ICP-MS|XRD" \
  ravikiran-erp/templates/ | head
```
Lab-ERP UI has zero "Ravikiran / Personal ERP" visible text
(except within the chooser's own index.html):
```
grep -rniE "Ravikiran|Personal ERP" templates/ | head
```
Chooser has zero mention of "Ravikiran":
```
grep -riE "Ravikiran" chooser/templates/
```

### Check W4 — Role weave

For each of `tester`, `operator`, `requester`, `super_admin`:
log in, visit 3 routes, confirm UI and server match (UI hides
what server rejects). Use seeded `test.<role>` accounts on
Lab-ERP demo (`playground.catalysterp.org`), password `12345`.
Log observed 403s and 200s in the report.

### Check W5 — Chooser weave

`http://localhost:5060/` renders both tiles, both links lead to
the correct subdomains (via `curl -sS | grep href`). Zero
external network calls (inspect HTML for CDN/Google Fonts
links).

### Check W6 — Doc weave

All three audit docs cross-reference each other where relevant:
- `UI_AUDIT_2026_04_15.md` mentions Codex 0 handoffs
- `GATEKEEPING_AUDIT_2026_04_15.md` mentions template gates
- `SEV2_REMEDIATION_2026-04-15.md` has every commit hash filled

### Output

`docs/OPERATION_TROIS_AGENTS_WEAVE_REPORT.md` with one section
per check, verdict = PASS / FAIL / PARTIAL. At the end: overall
verdict + a numbered fix list if any FAILs.

### Status

`STATUS: T+NN Claude1 — weaving <PASS|FAIL|PARTIAL>, N issues`

---

## Deliverable 3 — Codex 0 code review (~8 min)

Review every Codex 0 commit across Lanes 1, 2, 3. Listed so you
don't have to `git log --author`:

```
Lane 1 (SEV2 remediation on Lab-ERP):
  security: add in-memory per-IP login rate limiter
  security: global after_request security headers
  security: enforce --erp/--db match in AI crawlers
  hardening: synchronous=FULL gate in operational
  docs: SEV2 remediation audit trail
  docs/OPERATIONAL_HARDENING_V2.md

Lane 2 (proxy/CSRF):
  44acc86 proxy: harden tunnel login and add ship-readiness gate
  tests/test_proxy_csrf.py
  scripts/ship_readiness_check.py
  37d521f docs: add hsts preload readiness note
  c234035 tests: lock ship-readiness gate and lane2 hashes

Lane 3 (Ravikiran security parity):
  <whatever Codex 0 has pushed by now on ravikiran-erp>
  Tail: git log origin/operation-trois-agents --author Codex --oneline
  OR: `cd ~/Claude/ravikiran-erp && git log origin/operation-trois-agents --oneline -20`
```

### Review dimensions

For each commit, check:

1. **Correctness.** Does the code do what the commit message
   claims? Edge cases? Race conditions in the rate limiter
   (thread safety, since gunicorn runs multi-worker and each
   worker has its own in-memory dict — the class is per-worker,
   which means 2-worker gunicorn has 2× the rate-limit
   capacity per IP. Is that acceptable? Document either way).
2. **Security.** Does ProxyFix trust count match our actual
   proxy chain (Cloudflare only → trust 1)? Does security
   headers CSP break any existing inline script/style?
   (Try a dry render of a few key pages.)
3. **Tests.** Do the tests actually exercise the logic or
   stub assertions? Are the test accounts valid? Does
   `test_proxy_csrf.py` simulate the tunnel correctly?
4. **Docs.** Does `SEV2_REMEDIATION_2026-04-15.md` match
   reality — every row's commit hash exists, every status
   claim (fixed / deferred / doc-only) matches the actual
   state of the repo?
5. **Consistency.** Ravikiran Lane 3 parity: is the code in
   ravikiran-erp/app.py structurally identical to Lab-ERP's,
   or has it drifted (copy-paste bugs, wrong env var names,
   missing guards)?

### Output

`docs/OPERATION_TROIS_AGENTS_CODEX_REVIEW.md` with:
- Table: commit → {verdict: ✓ / ⚠ / ✗, one-line finding}
- Details section per ⚠/✗ with file:line + recommended fix
- Summary: N green, M yellow, P red
- **Ship gate:** if any red → hand off to Codex 0 to fix before
  tag. If only yellow → Codex 0 tags and files yellow items in
  a follow-up backlog.

### Status

`STATUS: T+NN Claude1 — Codex review done: N green / M yellow / P red`

---

## Deliverable 4 — Executive summary (~2 min)

`docs/OPERATION_TROIS_AGENTS_RESULT.md` — one page max:
- What shipped (5 bullet headline)
- What's deferred / backlog (link to Post-Sprint Feedback Plan)
- Ship gate verdict (green/yellow/red from Codex review +
  weaving)
- Next step for Codex 0: tag `v2.0.0-rc1` (if green) OR
  fix list (if red)

Final status:
```
STATUS: T+NN Claude1 — Operation TroisAgents lane closed.
Crawl + weave + Codex review + result doc shipped. Ship gate:
{GREEN|YELLOW|RED}. Handing off to Codex 0 for v2.0.0-rc1 tag.
```

---

## Hard rules

1. No code changes. Document-only.
2. Smoke gate before every push (yes, even doc commits — the
   pre-receive hook runs it regardless).
3. One commit per deliverable.
4. Commits prefix: `crawl:`, `weave:`, `review:`, `result:`.
5. If blocked or out of context, `STATUS: PARTIAL ...` and drop
   out. Codex 0 or the next human finishes.

GO.
