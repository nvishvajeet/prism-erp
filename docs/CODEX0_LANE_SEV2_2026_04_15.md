# Codex 0 Lane — SEV2 Remediation (60-min self-directed)

> Long-form task spec for Codex 0, Operation TroisAgents,
> Phase 1 extended window (T+58 → T+118). Addressed to Codex 0;
> every other agent should skip this file.

Claude 0 is the conductor. You have Phase 1 runway until T+118
(that's roughly 60 minutes from the moment you start reading).
This spec is deliberately long so you can execute autonomously
with no pings except status commits at ~15-min intervals.
Fallback work is queued at the end so you can never run out of
tasks before T+118.

---

## Mission

Ship the SEV2 + SEV3 findings from the Operation TroisAgents
background audit so v2.0 cuts with zero known critical audit
debt. Six deliverables, each ~10 minutes, ordered by risk.
Everything commits to lab-scheduler on branch
`operation-trois-agents`. Smoke gate green before every push.

Audit findings you are implementing (reference only — don't
re-read the audit output file):

- **SEV2 #1** — Login brute-force unthrottled (no rate limit on `/login`)
- **SEV2 #4** — AI crawler `--erp` flag advisory, not enforced
- **SEV3 A** — launchd `ThrottleInterval` too low (doc-only fix)
- **SEV3 B** — No operational DB backup automation (doc-only fix)
- **SEV3 C** — SQLite `synchronous=NORMAL` too lax for financial data
- **INFO** — No HSTS / CSP / X-Frame-Options response headers

---

## Lane boundaries (HARD)

Repos you touch:
- `/Users/vishvajeetn/Documents/Scheduler/Main` — **yes**
- `/Users/vishvajeetn/Claude/ravikiran-erp` — **NO** (Claude 0's)

Files you own this lane:
- `app.py` — new sections only
- `crawlers/ai_extract_upload.py` — add `--erp` + `--db` validation
- `crawlers/common.py` (create if missing) — the shared helper
- `docs/OPERATIONAL_HARDENING_V2.md` — NEW doc
- `docs/SEV2_REMEDIATION_2026-04-15.md` — NEW audit trail
- `tests/test_security_headers.py` — NEW
- `tests/test_login_ratelimit.py` — NEW
- `tests/test_erp_flag_enforcement.py` — NEW

Files you MUST NOT touch:
- `templates/base.html`, `templates/nav.html`
- `templates/**/*.html` (touch only if a test template is needed)
- `static/css/global.css`
- anything under `ravikiran-erp/`
- `~/.cloudflared/*` on mini (mini is read-only this sprint)
- any launchd plist (mini-side; your fix is doc-only)

---

## Deliverable 1 — Login rate limiting (~12 min)

**Problem:** `/login` accepts unlimited POSTs per IP/email.
Brute-force is trivial. No account lockout, no exponential backoff.

**Approach:** Homegrown in-memory per-IP sliding-window limiter.
Do NOT add `flask-limiter` as a dependency — that needs Redis or
file-based state; we don't want to expand deps this late. The
limiter is a simple dict inside `app.py`, cleared on process
restart (acceptable — a restart is harder than any exposed
attack here).

**Spec:**

```python
class LoginRateLimiter:
    """Sliding 5-minute window of failed login attempts per IP.
    After 5 failures within the window, block for 5 minutes."""

    def __init__(self, max_failures=5, window_seconds=300,
                 block_seconds=300):
        self._failures = {}  # ip → list[epoch_seconds]
        self._blocked  = {}  # ip → epoch_blocked_until
        self.max_failures = max_failures
        self.window_seconds = window_seconds
        self.block_seconds = block_seconds

    def record_failure(self, ip: str) -> None: ...
    def is_blocked(self, ip: str) -> tuple[bool, int]:
        """Returns (blocked, seconds_remaining)."""
    def clear(self, ip: str) -> None:
        """Called on successful login to clear history."""

_login_limiter = LoginRateLimiter()
```

**Wire into `/login` handler** — top of POST branch:

```python
ip = request.headers.get("CF-Connecting-IP", request.remote_addr)
blocked, seconds = _login_limiter.is_blocked(ip)
if blocked:
    flash(f"Too many failed attempts. Try again in "
          f"{seconds // 60}m {seconds % 60}s.", "error")
    return render_template("login.html"), 429

# ...existing code...

if user and check_password_hash(...):
    _login_limiter.clear(ip)
    # existing session setup
else:
    _login_limiter.record_failure(ip)
    flash("Invalid login.", "error")
```

**Find the login handler:** `grep -n "def login" app.py` — there's
only one `@app.route("/login")` with `methods=["GET", "POST"]`.

**Test:** `tests/test_login_ratelimit.py`
- Mock `request.remote_addr`, send 5 failed POSTs; assert 6th
  returns 429 (or renders the "too many" flash).
- After a successful login, history clears.
- After the window elapses (mock time), attempts reset.

**Commit:** `security: add in-memory per-IP login rate limiter`

---

## Deliverable 2 — Security response headers (~8 min)

**Problem:** No HSTS, no X-Frame-Options, no
Content-Security-Policy. Missing defense in depth.

**Spec:** single `@app.after_request` that adds:

```python
def _add_security_headers(resp):
    resp.headers.setdefault("X-Frame-Options", "DENY")
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    if (request.scheme == "https"
        or request.headers.get("X-Forwarded-Proto") == "https"):
        resp.headers.setdefault(
            "Strict-Transport-Security",
            "max-age=31536000; includeSubDomains",
        )
    resp.headers.setdefault(
        "Content-Security-Policy",
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: blob:; "
        "connect-src 'self'; "
        "frame-ancestors 'none';",
    )
    resp.headers.setdefault("Referrer-Policy", "same-origin")
    return resp

app.after_request(_add_security_headers)
```

Use `setdefault` (not `[]=`) so any explicit header per route wins.

**Test:** `tests/test_security_headers.py`
- `GET /login` → X-Frame-Options DENY, X-Content-Type-Options
  nosniff, CSP present, Referrer-Policy same-origin.
- HTTPS request → HSTS present.
- HTTP request → HSTS absent (so localhost dev isn't broken).

**Commit:** `security: global after_request security headers
(HSTS, CSP, X-Frame-Options, X-Content-Type-Options,
Referrer-Policy)`

---

## Deliverable 3 — AI crawler `--erp` flag enforcement (~10 min)

**Problem:** `crawlers/ai_extract_upload.py` (and others in
`crawlers/`) accept `--erp lab|ravikiran` and `--db <path>`
separately. Nothing enforces the DB path is within the chosen
ERP's data dir. Per `docs/ERP_TOPOLOGY.md §6` this is a silent
cross-ERP leak risk.

**Spec:**

```python
# crawlers/common.py (create if missing), or inline in
# crawlers/ai_extract_upload.py if there is no shared module:

def validate_erp_db_match(erp: str, db_path: str | Path) -> Path:
    """Assert db_path is inside the chosen ERP's data directory.
    Raises SystemExit(2) with a loud error if not."""
    import sys
    from pathlib import Path
    db_path = Path(db_path).resolve()
    lab_roots = [
        Path.home() / "Documents/Scheduler/Main/data",
        Path.home() / "Scheduler/Main/data",       # mini-side name
    ]
    ravikiran_roots = [
        Path.home() / "Claude/ravikiran-erp/data",
        Path.home() / "ravikiran-services/data",   # mini-side
    ]
    expected = lab_roots if erp == "lab" else ravikiran_roots
    if not any(
        db_path.is_relative_to(r.resolve())
        for r in expected if r.exists()
    ):
        sys.stderr.write(
            f"REFUSING: --erp {erp!r} but --db {db_path} is not "
            f"inside any expected {erp} data root. Wrong-ERP "
            f"reads are a silent data leak — aborting.\n"
        )
        sys.exit(2)
    return db_path
```

**Wire into every crawler that takes `--erp` + `--db`:**

```bash
grep -rEn "argparse|add_argument.*['\"]--erp['\"]|--db" crawlers/
```

For each match, call `validate_erp_db_match()` immediately after
`args = parser.parse_args()`.

**Test:** `tests/test_erp_flag_enforcement.py`
- `--erp lab` + `--db` inside `Scheduler/Main/data` → pass.
- `--erp lab` + `--db` inside `ravikiran-erp/data` →
  `sys.exit(2)`.
- `--erp ravikiran` + `--db` inside `Scheduler/Main/data` →
  `sys.exit(2)`.
- `--erp ravikiran` + `--db` inside `ravikiran-erp/data` →
  pass.

Use pytest's `capsys` to capture stderr.

**Commit:** `security: enforce --erp/--db match in AI crawlers`

---

## Deliverable 4 — Operational hardening doc + one server-side fix (~8 min)

Three audit findings require mini-side action that is OUT OF
SCOPE this sprint (mini is read-only). Write a doc that captures
the recommended fixes. **One of them IS server-side and goes in
app.py — the `synchronous=FULL` gate.**

**File:** `docs/OPERATIONAL_HARDENING_V2.md`

**Structure:**

```markdown
# Operational Hardening — v2.0 Post-Audit Fixes

> Actions to apply to the mini on next deploy window. Not part
> of Operation TroisAgents ship; scheduled for the post-cert.pem
> deploy sprint.

## 1. launchd ThrottleInterval
Current: 10 seconds. Problem: tight crash-loop on DB corruption
spams 10 restarts in 100s. Fix: edit both plists, set
<integer>60</integer>. Files:
  ~/Library/LaunchAgents/local.catalyst.plist
  ~/Library/LaunchAgents/local.catalyst.demo.plist
Deploy: launchctl bootout + bootstrap.

## 2. SQLite synchronous=FULL in operational (IMPLEMENTED HERE)
Current: PRAGMA synchronous=NORMAL. Problem: kernel panic can
lose recent commits. Fix: env-gated — operational gets FULL,
dev/demo stays NORMAL for speed.

## 3. Daily DB backup cron
Current: no backup. Target: daily snapshot of
~/Scheduler/Main/data/operational/lab_scheduler.db to
~/backups/lab_scheduler-YYYYMMDD.db, rotate weekly.
Plist stub in appendix.

## 4. Log rotation
Current: server.log grows unbounded. Recommend logrotate config
or size-based rotation via Flask's logging handler.

## Appendix A — local.catalyst.backup.plist (stub)
…
```

**Server-side change (implement this one in app.py):** find the
`PRAGMA synchronous=NORMAL` line (`grep -n "synchronous" app.py`).
Replace with the gate:

```python
if DEMO_MODE or os.environ.get("LAB_SCHEDULER_SQLITE_FAST"):
    cur.execute("PRAGMA synchronous=NORMAL")
else:
    cur.execute("PRAGMA synchronous=FULL")
```

**Commit:** `hardening: synchronous=FULL gate in operational +
docs/OPERATIONAL_HARDENING_V2.md`

---

## Deliverable 5 — SEV2 remediation audit trail (~5 min)

One-page audit trail so future-you (or reviewers) can find where
each finding was addressed.

**File:** `docs/SEV2_REMEDIATION_2026-04-15.md`

```markdown
# SEV2 Remediation — 2026-04-15 (Operation TroisAgents)

| Audit finding | Status | Fix location | Commit |
|---|---|---|---|
| SEV2 #1 login brute-force      | ✓ fixed     | app.py LoginRateLimiter                  | <hash> |
| SEV2 #2 DB filename collision  | deferred    | Claude 0's lane (Ravikiran DB rename)     | —      |
| SEV2 #3 Ravikiran no launchd   | staged      | chooser/launchd/*                        | <hash> |
| SEV2 #4 --erp/--db mismatch    | ✓ fixed     | crawlers/common.py + callers             | <hash> |
| SEV3 A launchd ThrottleInterval| doc-only    | docs/OPERATIONAL_HARDENING_V2.md         | <hash> |
| SEV3 B DB backup cron          | doc-only    | docs/OPERATIONAL_HARDENING_V2.md         | <hash> |
| SEV3 C sqlite synchronous      | ✓ fixed     | app.py PRAGMA gate                       | <hash> |
| INFO HSTS/CSP/X-Frame-Options  | ✓ fixed     | app.py after_request                     | <hash> |
```

Plus one paragraph per SEV2 explaining the choice. Fill in
commit hashes after you land each deliverable — easy to update
in a final housekeeping commit.

**Commit:** `docs: SEV2 remediation audit trail for v2.0`

---

## Deliverable 6 — Verification (~5 min)

Final pass before the status commit:

```bash
.venv/bin/python scripts/smoke_test.py            # mandatory
.venv/bin/python -m pytest tests/test_security_headers.py -v
.venv/bin/python -m pytest tests/test_login_ratelimit.py -v
.venv/bin/python -m pytest tests/test_erp_flag_enforcement.py -v
```

Hand-probe (local-only, use a throwaway port):

```bash
curl -sI http://localhost:<port>/login | grep -E \
  "X-Frame|X-Content-Type|Referrer-Policy|Content-Security"
```

Final status commit:

```
STATUS: T+NN Codex0 — SEV2 remediation complete (6 deliverables:
login rate-limit, security headers, --erp enforcement,
synchronous=FULL, operational hardening doc, audit trail).
N commits, smoke green.
```

---

## Fallback / stretch work (if all 6 done before T+110)

Do not stop just because the main lane is done. Pick in order:

### Stretch A — "Your code: #N" on profile pages
Claude 0 added the `attendance_number` column + quick-mark
lookup. Surface it on profile pages so Nikita's workflow is
end-to-end visible.
- File: `templates/profile.html` (yes, you may touch this ONE
  template as a stretch). Add near the top of the profile view:
  ```html
  <div class="attendance-code">
    Attendance number:
    #{{ current_user.attendance_number or "not set" }}
  </div>
  ```

### Stretch B — Tests for permission flags
`tests/test_permission_flags.py` — mock a user for each of the
9 roles, assert each of the 5 boolean flags exposed by the
context processor matches the role matrix you documented in
`GATEKEEPING_AUDIT_2026_04_15.md`.

### Stretch C — Observability doc
`docs/OBSERVABILITY_V2.md` — recommendations for adding
Prometheus `/metrics`, structured JSON logging, and error
reporting (Sentry or equivalent). Doc-only, no new deps.

### Stretch D — Login handler tightening
If you see any plain string comparison or timing-side-channel
risk (e.g., comparing username existence before password
check), fix with `secrets.compare_digest`.

### Stretch E — Docstrings + type hints
Upgrade every new function in this lane to Python 3.10+ style:
`dict[str, int]`, `Path | None`, etc. Add docstrings where missing.

---

## Cadence

Status commits every 15 minutes minimum, more often if you ship:

```
T+65  STATUS: started SEV2 remediation, deliverable 1 in progress
T+80  STATUS: rate-limit + security headers shipped (commits X, Y)
T+95  STATUS: --erp enforcement shipped (commit Z)
T+110 STATUS: synchronous=FULL + docs shipped
T+118 STATUS: all 6 deliverables shipped, N stretches (A, B, …)
T+120 STATUS: lane closed
```

## Commit hygiene

- One commit per deliverable minimum; split further if >250 lines.
- Smoke gate before EVERY push. No `--no-verify` under any
  condition.
- If smoke fails, fix or revert.
- Commit prefix: `security:`, `hardening:`, or `docs:` as
  appropriate. Body explains the why in 2–3 lines.
- Push each commit as it lands — don't batch-push 5 at the end.

## Blocker protocol

Push a `STATUS: BLOCKER:` commit and stop if any of these:
- Smoke fails and you can't isolate the cause in 5 minutes.
- The existing `/login` handler can't be cleanly wrapped (early
  returns skip the failure path).
- You find an SEV1 issue while reading code — stop immediately;
  Claude 0 needs to know.

Otherwise assume-and-document. Write the assumption as an inline
`# NOTE: assumed …` comment and keep going.

## What good looks like at T+120

- 6 deliverables shipped, ~3 commits per deliverable.
- `tests/test_*.py` all green.
- `docs/SEV2_REMEDIATION_2026-04-15.md` has every row's commit hash.
- At least 2 stretches attempted.
- Final STATUS commit.
- Smoke green.

v2.0-rc1 tag-cut at T+149 needs this lane's work to be solid.
Take the time you have — no point shipping sloppy work just
because the clock is slow.

Claude 0 will merge your work into `base.html` / `nav.html` at
T+120. Do not worry about nav stitching — that's the conductor's
job.

GO.
