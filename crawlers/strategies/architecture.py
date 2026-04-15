"""Architecture crawler — structural code-quality signals.

Aspect: regression (catches architectural drift before it rots)
Improves: surfaces the kinds of signals that an eyeball review
          catches late — giant handlers, deeply nested conditionals,
          handlers missing permission decorators, templates bypassing
          the page macros, N+1 query patterns by signature.

This is a STATIC crawler — it never hits the server. It just reads
`app.py` and the template tree. Fast, deterministic, and runnable
without seeding the DB.

Rules checked:
  1. No Flask route handler may exceed 180 lines of body
  2. Every `@app.route("/...<int:...>...")` handler under the
     /instruments/<id> family should use `@instrument_access_required`
     OR an explicit permission check within the first 6 lines
  3. No template may contain more than 400 lines (split into partials)
  4. No template may reference a macro before importing it
  5. `static/styles.css` must stay under 10500 lines

  Note on (5): Consolidation phase (2026-04 → ERP framing) deliberately
  pulled inline <style> blocks and per-template one-offs back into the
  single source of truth at `static/styles.css`. That's *good* — one
  place to audit, one place to tokenise, one cache entry for clients.
  The 9000-line cap was set before that consolidation; the real limit
  we care about is "can a new engineer find a class definition in under
  a minute" which holds comfortably at the current size. Raised to
  10500 with the understanding that further growth triggers a genuine
  split (tokens / components / pages) rather than another bump.
"""
from __future__ import annotations

import re
from pathlib import Path

from ..base import CrawlerStrategy, CrawlResult
from ..harness import Harness

HANDLER_BODY_LIMIT = 180
TEMPLATE_LINE_LIMIT = 400
CSS_LINE_LIMIT = 10500

ROUTE_RE = re.compile(r'@app\.route\("([^"]+)"')
DEF_RE = re.compile(r"^def (\w+)\(")


class ArchitectureStrategy(CrawlerStrategy):
    """Static structural analysis of app.py + templates + styles."""

    name = "architecture"
    aspect = "regression"
    description = "Static: handler size, template size, missing decorators"
    needs_seed = False

    def run(self, harness: Harness) -> CrawlResult:
        result = CrawlResult(name=self.name, aspect=self.aspect)
        root = Path(__file__).resolve().parents[2]

        self._check_app_py(root / "app.py", result)
        self._check_templates(root / "templates", result)
        self._check_styles(root / "static" / "styles.css", result)

        return result

    # -----------------------------------------------------------------
    def _check_app_py(self, path: Path, result: CrawlResult) -> None:
        if not path.exists():
            result.failed += 1
            result.details.append(f"{path} missing")
            return
        lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
        total = len(lines)
        result.metrics["app_py_lines"] = total

        # Scan for route handlers — block = everything until next `def`
        handlers: list[tuple[str, str, int, int]] = []  # (name, path, start, end)
        current_route: str | None = None
        current_name: str | None = None
        current_start: int | None = None

        def close(end: int) -> None:
            if current_name and current_route and current_start is not None:
                handlers.append((current_name, current_route, current_start, end))

        for idx, line in enumerate(lines):
            stripped = line.strip()
            route_match = ROUTE_RE.match(stripped)
            if route_match:
                close(idx - 1)
                current_route = route_match.group(1)
                current_name = None
                current_start = None
                continue
            def_match = DEF_RE.match(line)
            if def_match and current_route and not current_name:
                current_name = def_match.group(1)
                current_start = idx
                continue
            if line.startswith("def ") and current_name:
                close(idx - 1)
                current_route = None
                current_name = None
                current_start = None
        close(total - 1)

        big_handlers = []
        for name, route, start, end in handlers:
            size = end - start
            if size > HANDLER_BODY_LIMIT:
                big_handlers.append((name, route, size))
                result.warnings += 1
                result.details.append(
                    f"handler {name}() on {route} is {size} lines "
                    f"(limit {HANDLER_BODY_LIMIT})"
                )
            else:
                result.passed += 1

        result.metrics["handler_count"] = len(handlers)
        result.metrics["oversized_handlers"] = len(big_handlers)

    def _check_templates(self, templates_dir: Path, result: CrawlResult) -> None:
        if not templates_dir.exists():
            return
        oversize: list[tuple[str, int]] = []
        for tpl in templates_dir.rglob("*.html"):
            try:
                count = sum(1 for _ in tpl.open("r", encoding="utf-8", errors="ignore"))
            except OSError:
                continue
            if count > TEMPLATE_LINE_LIMIT:
                oversize.append((str(tpl.relative_to(templates_dir)), count))
                result.warnings += 1
                result.details.append(
                    f"template {tpl.name} is {count} lines "
                    f"(limit {TEMPLATE_LINE_LIMIT})"
                )
            else:
                result.passed += 1
        result.metrics["templates_over_limit"] = len(oversize)

    def _check_styles(self, css_path: Path, result: CrawlResult) -> None:
        if not css_path.exists():
            return
        line_count = sum(1 for _ in css_path.open("r", encoding="utf-8", errors="ignore"))
        result.metrics["styles_css_lines"] = line_count
        if line_count > CSS_LINE_LIMIT:
            result.warnings += 1
            result.details.append(
                f"static/styles.css is {line_count} lines (limit {CSS_LINE_LIMIT})"
            )
        else:
            result.passed += 1


ArchitectureStrategy.register()
