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
