"""Cleanup crawler — find likely-dead code.

Aspect: css_hygiene (overlap with regression)
Improves: surfaces the code/templates/CSS/files that Phase 5's
          W5.7 retirement ritual caught by hand. Automating it
          means the next refactor pass starts with a fresh list
          of candidates instead of a hunt-and-peck grep session.

Categories of suspected dead code:

  A. Python functions in `app.py` that are neither imported
     elsewhere, nor decorated as a route, nor referenced by name.
  B. Templates under `templates/` that are neither extended nor
     included nor rendered via `render_template(...)`.
  C. Macro files (`_*.html`) whose macros are not imported by any
     other template.
  D. Files matching stale-artifact patterns (`*_old.py`, `*.bak`,
     `TODO_OLD.txt`, drafts).
  E. Python modules in repo root that are not imported by app.py
     or by any test script.

Every finding is a warning — the user decides what to delete. The
report JSON contains the full list so an agent can read it and
surface suggestions.
"""
from __future__ import annotations

import re
from pathlib import Path

from ..base import CrawlerStrategy, CrawlResult
from ..harness import Harness

PY_DEF_RE = re.compile(r"^def (\w+)\(", re.MULTILINE)
# Any decorator that registers a function with Flask's dispatch machinery
# makes the function live-by-reference even if its name is never written
# out in Python code again. Missing any of these produces false
# "dead function" positives (the pre-tuning crawler flagged close_db,
# inject_globals, handle_forbidden, handle_not_found, handle_server_error,
# handle_large_upload, handle_invalid_status_transition).
HOOK_DECORATOR_RE = re.compile(
    r'@app\.(route|errorhandler|context_processor|'
    r'teardown_appcontext|teardown_request|before_request|'
    r'after_request|before_first_request|template_filter|'
    r'template_global|template_test|cli\.command)'
)
IMPORT_RE = re.compile(r"^(?:from [\w.]+ )?import [\w, ]+", re.MULTILINE)
RENDER_TEMPLATE_RE = re.compile(r'render_template\(\s*["\']([^"\']+)["\']')
EXTENDS_RE = re.compile(r'{%\s*extends\s*["\']([^"\']+)["\']')
INCLUDE_RE = re.compile(r'{%\s*include\s*["\']([^"\']+)["\']')
FROM_IMPORT_RE = re.compile(r'{%\s*from\s*["\']([^"\']+)["\']')

STALE_PATTERNS = ["*_old.*", "*.bak", "*~", "*.orig", "*_draft*",
                  "TODO_OLD*", "*.deprecated"]

KNOWN_DYNAMIC_FUNCTIONS = {
    "create_invoice_for_request",
    "flush_email_queue",
    "queue_external_email",
    "record_payment",
    # Crawler integration hook — called as `app.crawler_confirm_debug_issue(...)`
    # from crawler strategies that verify a fix, not referenced by name in
    # app.py / templates / scripts. Three distinct crawler names confirming
    # the same issue close it.
    "crawler_confirm_debug_issue",
    # Portal-gating helper — part of the portal membership API in app.py
    # (`user_portal_slugs`, `users_share_active_portal`, `assign_user_to_portals`).
    # Live scaffold for the portal-bound access checks being wired through
    # the codebase (Codex's bulk user intake / approval-queue task, 2026-04).
    # Keep surface area stable; will be referenced by name once the intake
    # flow lands.
    "user_in_portal",
}


class CleanupStrategy(CrawlerStrategy):
    """Surface suspected dead code: functions, templates, modules, files."""

    name = "cleanup"
    aspect = "css_hygiene"
    description = "Find suspected dead Python / templates / files"
    needs_seed = False

    def run(self, harness: Harness) -> CrawlResult:
        result = CrawlResult(name=self.name, aspect=self.aspect)
        root = Path(__file__).resolve().parents[2]

        dead_py = self._dead_python_functions(root)
        dead_tpl = self._dead_templates(root)
        stale = self._stale_files(root)

        for name, kind in dead_py:
            result.warnings += 1
            result.details.append(f"dead {kind}: {name}()")
        for tpl in dead_tpl:
            result.warnings += 1
            result.details.append(f"dead template: {tpl}")
        for path in stale:
            result.warnings += 1
            result.details.append(f"stale file: {path}")

        if not (dead_py or dead_tpl or stale):
            result.passed += 1

        result.metrics = {
            "dead_python_functions": len(dead_py),
            "dead_templates": len(dead_tpl),
            "stale_files": len(stale),
        }
        return result

    # -----------------------------------------------------------------
    def _dead_python_functions(self, root: Path) -> list[tuple[str, str]]:
        app_py = root / "app.py"
        if not app_py.exists():
            return []
        text = app_py.read_text(encoding="utf-8", errors="ignore")

        # Map function name → True if it's a Flask-hook-decorated function
        # (route, errorhandler, context_processor, teardown, etc.). These
        # are live-by-registration even if never called by name.
        routes: set[str] = set()
        lines = text.splitlines()
        i = 0
        while i < len(lines):
            stripped = lines[i].strip()
            if HOOK_DECORATOR_RE.match(stripped):
                # scan forward for def (may be multiple decorators deep)
                for j in range(i, min(i + 8, len(lines))):
                    m = PY_DEF_RE.match(lines[j])
                    if m:
                        routes.add(m.group(1))
                        break
            i += 1

        defs = set(PY_DEF_RE.findall(text))
        haystack = text

        # Include repo-root python + templates haystacks
        for sib in root.glob("*.py"):
            if sib.name == "app.py":
                continue
            haystack += "\n" + sib.read_text(encoding="utf-8", errors="ignore")
        tpl_dir = root / "templates"
        if tpl_dir.exists():
            for tpl in tpl_dir.rglob("*.html"):
                haystack += "\n" + tpl.read_text(encoding="utf-8", errors="ignore")
        # Scripts live under `scripts/` and call app functions as
        # `app.<name>(...)` via embedded `python3 -c` blocks or direct
        # imports. Without scanning here, cron-style scripts that keep
        # otherwise-dormant helpers alive (action_queue_summary,
        # debug_issue_summary, review_operational_queues, …) produced
        # false "dead function" positives in the 2026-04-15 audit.
        scripts_dir = root / "scripts"
        if scripts_dir.exists():
            for path in scripts_dir.rglob("*"):
                if path.is_file() and path.suffix in {".py", ".sh", ".bash", ".zsh"}:
                    haystack += "\n" + path.read_text(encoding="utf-8", errors="ignore")

        dead: list[tuple[str, str]] = []
        for name in sorted(defs):
            if name in routes:
                continue
            if name.startswith("_"):
                continue  # private helpers — skip
            if name in {"main", "init_db"}:
                continue
            if name in KNOWN_DYNAMIC_FUNCTIONS:
                continue
            # Word-boundary search for the name anywhere outside its def line
            pattern = re.compile(rf"(?<![\w-]){re.escape(name)}(?![\w-])")
            hits = pattern.findall(haystack)
            if len(hits) <= 1:
                dead.append((name, "function"))
        return dead

    def _dead_templates(self, root: Path) -> list[str]:
        tpl_dir = root / "templates"
        if not tpl_dir.exists():
            return []
        all_tpls = {p.name for p in tpl_dir.glob("*.html")}

        # Build the set of referenced templates
        referenced: set[str] = set()
        app_py = root / "app.py"
        if app_py.exists():
            for match in RENDER_TEMPLATE_RE.finditer(
                app_py.read_text(encoding="utf-8", errors="ignore")
            ):
                referenced.add(match.group(1))
        for tpl in tpl_dir.rglob("*.html"):
            text = tpl.read_text(encoding="utf-8", errors="ignore")
            for m in EXTENDS_RE.finditer(text):
                referenced.add(m.group(1))
            for m in INCLUDE_RE.finditer(text):
                referenced.add(m.group(1))
            for m in FROM_IMPORT_RE.finditer(text):
                referenced.add(m.group(1))

        # base.html and macro files `_*.html` are always "live" if used
        dead: list[str] = []
        for name in sorted(all_tpls):
            if name == "base.html":
                continue
            if name in referenced:
                continue
            dead.append(name)
        return dead

    def _stale_files(self, root: Path) -> list[str]:
        found: list[str] = []
        for pattern in STALE_PATTERNS:
            for path in root.glob(pattern):
                found.append(str(path.relative_to(root)))
            for path in root.rglob(pattern):
                rel = str(path.relative_to(root))
                if rel not in found and "/.git/" not in rel and "venv/" not in rel:
                    found.append(rel)
        return found


CleanupStrategy.register()
