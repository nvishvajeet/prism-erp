# SEV2 Remediation — 2026-04-15 (Operation TroisAgents)

| Audit finding | Status | Fix location | Commit |
|---|---|---|---|
| SEV2 #1 login brute-force | fixed | `app.py` `LoginRateLimiter` + `tests/test_login_ratelimit.py` | `516a1b3` |
| SEV2 #2 DB filename collision | deferred | Claude 0 lane / Ravikiran topology work | — |
| SEV2 #3 Ravikiran no launchd | staged | `chooser/launchd/*` | TBD-Claude0 |
| SEV2 #4 `--erp` / `--db` mismatch | fixed | `crawlers/common.py` + `crawlers/ai_extract_upload.py` | `516a1b3` |
| SEV3 A launchd `ThrottleInterval` | doc-only | `docs/OPERATIONAL_HARDENING_V2.md` | `516a1b3` |
| SEV3 B DB backup cron | doc-only | `docs/OPERATIONAL_HARDENING_V2.md` | `516a1b3` |
| SEV3 C sqlite synchronous | fixed | `app.py` PRAGMA gate | `516a1b3` |
| INFO HSTS/CSP/X-Frame-Options | fixed | `app.py` after-request hook + `tests/test_security_headers.py` | `516a1b3` |

SEV2 #1 is fixed by a process-local login limiter because it adds immediate
friction to brute-force attempts without introducing late-sprint infrastructure
dependencies like Redis or Flask-Limiter state.

SEV2 #2 stays deferred in this lane because the filename collision risk is part
of the cross-ERP topology and launch layout that Claude 0 owns in this sprint.

SEV2 #3 is staged rather than applied because the mini is explicitly read-only
for Operation TroisAgents. The launchd gap is tracked in the conductor lane.

SEV2 #4 is fixed by refusing to run an ERP-aware crawler against a database
path outside the selected ERP root. Silent wrong-ERP reads are treated as a
loud abort now.
