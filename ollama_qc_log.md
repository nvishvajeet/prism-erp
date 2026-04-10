# Ollama QC Log

This file is the audit trail for Claude's review of Ollama
commits on the `ollama-work` branch. Every session that finds
new commits appends a block via `./review_ollama_commits.sh`.
Read OLLAMA_DEV_PLAN.md §13 for the full schema.

Status legend: APPROVE / REJECT / DEFER / NEEDS-REWORK.

- **APPROVE** — cherry-pick onto master, advance `claude_last_seen`.
- **REJECT** — leave on `ollama-work`, do not cherry-pick. The
  commit is evidence; tune the next task spec.
- **DEFER** — review later this session or next; not blocking.
- **NEEDS-REWORK** — task spec was right, the output was not.
  File a follow-up spec or rerun in `dual` mode.

---

## Session qc-bootstrap (2026-04-10)

Bootstrap entry. No Ollama commits yet — the bridge files just
landed (commits 33a4807, 338bc45, eb9c575, 2bda971). The first
real session block will be appended by `review_ollama_commits.sh`
on the next Claude resume after Ollama runs its first task spec.

---

## Session qc-20260410-154816 (first dispatch attempt — INFRA FAILURE)

- Commits found: 0
- Task spec: `ollama_tasks/csrf_inputs_entrypoints.md`
- Mode: `remote` (Mac mini via Tailscale tunnel at 127.0.0.1:11434)
- Model requested: `llama3:latest`

### Dispatch outcome

- `/api/tags` probe: **OK** — tunnel alive, `llama3:latest` and
  `qwen3-vl:4b` both listed in the model catalog.
- `/api/generate` with `llama3`: **FAILED** — response was 48 bytes
  containing `llama runner process has terminated: %!w(<nil>)`.
- Fallback `/api/generate` with `qwen3-vl:4b`: **FAILED** —
  response was `{"error":"model failed to load, this may be due
  to resource limitations or an internal error, check ollama
  server logs for details"}`.
- Trivial single-word prompt reproduced the same failure, so it
  is not a spec-size issue. The Mac mini's Ollama model loader is
  broken end-to-end at the moment.

### Bridge state at end of session

- `ollama-work` branch: **created**, identical to master
  (no commits yet).
- `claude_last_seen` tag: **planted** at master HEAD
  (commit `3c6d216`, the "ollama bridge: add QC review system"
  commit from the previous session).
- `ollama_tasks/csrf_inputs_entrypoints.md`: **committed to
  master** as-is. The spec is well-formed and ready to re-run
  once the Mac mini's loader is back.
- `ollama_outputs/csrf_inputs_entrypoints_20260410-154816/`:
  preserved locally (gitignored). Contains the prompt sent plus
  the 48-byte runner-crash response.

### Auto-suggestion

**INFRA-BLOCKED**. No Ollama commit to review — the model never
ran. Claude decision: **no-op**, retry the dispatch after Mac
mini's Ollama is healthy again. First check: SSH to the mini,
run `ollama list` and `ollama run llama3 "hello"` interactively;
if the loader still crashes, restart the `ollama serve` tmux
session or reboot the mini.

### Lessons for the task spec format

The spec itself survived review on this side with no changes —
the failure was infrastructure, not content. When the dispatch
re-runs and produces real diffs, the QC log entry will append a
proper sub-entry per commit.

---

## Session qc-20260410-155532 (first real Ollama output — REJECT)

- Task spec: `ollama_tasks/csrf_inputs_entrypoints.md` (unchanged)
- Mode: `local` (MacBook, `ollama serve` on `127.0.0.1:11435`)
- Model: `llama3:latest` (8B Q4_0, ~4.7 GB)
- Response file: `ollama_outputs/csrf_inputs_entrypoints_20260410-155532/response.local.txt` (660 bytes)
- Ollama commits produced: 0 — driver does not auto-apply, we review by hand

### The response

Ollama produced a "unified diff" for both files. On inspection
it is **entirely hallucinated**:

| Claim                                                  | Reality                                           |
|--------------------------------------------------------|---------------------------------------------------|
| `@@ -1,6 +1,7 @@` (line 1, hunk of 6)                  | `<form method="post">` is at line **5**, not 1    |
| `{% block form %}{{ super() }}{% endblock %}` in form  | Neither file has any such block                   |
| `2023/03/10 14:30:00 +0000 1.2.0` timestamp            | Not a unified-diff format. Files last edited 2026 |
| `activate.html` diff == `login.html` diff              | The two forms differ (activate has Name)          |

The hidden-input line itself (`<input type="hidden" name="csrf_token" …>`)
is the one part Ollama copied correctly from the reference in the
spec. Everything surrounding it is wrong. `patch -p1` would either
fail to apply (line numbers wrong) or, if `--fuzz` were loose
enough, would silently introduce Jinja block markers that do not
belong in the file.

### Claude decision: REJECT

Rationale: hallucinated line numbers + invented template
structure. llama3:8B Q4_0 cannot be trusted on structural template
edits even at this scope.

Instead:

1. The bad diff is preserved in `ollama_outputs/csrf_inputs_entrypoints_20260410-155532/response.local.txt` (gitignored, local evidence only).
2. The correct edit was applied by hand on `ollama-work` as commit `caf1d4a`, clearly labelled `claude-fallback:` so future audits can distinguish it from a genuine Ollama contribution.
3. `caf1d4a` was cherry-picked onto `master` as `fbf59d3`.
4. Every acceptance criterion from the spec passes on `fbf59d3`.
5. The bridge rhythm still advances: the task spec format is validated (scoped enough, grep-able enough), but **llama3:8B is not the right model for this class of task**.

### Implications for the bridge

- **Model class is wrong for structural code edits.** Matches OLLAMA_DEV_PLAN.md §12 ("Ollama is not a programmer…") but is a stronger negative signal than expected — the hallucination showed up on a 15-line file with a fully-specified reference pattern.
- **Task-class reassessment.** The CSRF sweep (~30 forms) and `safe_int` wrap (~30 sites) both require line-exact position accuracy in files the model has never seen. Both are now **likely wrong fits** for llama3:8B Q4_0. Possible better fits:
  - Free-text generation (sample-request descriptions, fake scientific lab data, changelog bullet drafts, commit-message first drafts)
  - Summarization (collapse long prompts, compress meeting notes)
  - Classification (tag a commit subject as bug / feature / refactor)
  - First-pass test-data fixtures (JSON, CSV, Markdown table rows)
- **`dual` mode would have caught this.** Running local + remote in parallel, the outputs would not have matched and the driver would have refused to commit. Re-enable `dual` once the Mac mini loader is back.

### Next Ollama probe: test-data generation

Per the user's suggestion, the next spec should be test-data
generation (~20 realistic sample-request descriptions for the
demo seeder). Pure text generation with no line-number accuracy
requirement. Acceptance criterion is a word-count range and a
no-XSS grep, not a structural diff.

---
