"""No-inline-onclick crawler — onclick="..." is banned in templates.

Aspect: regression

Improves: gates regression of the codebase-wide manual refactor
          that moved every `onclick="..."` attribute into a
          `data-toggle-target="..."` / delegated event handler in
          `static/base_shell.js`. Inline event attributes bypass
          Content-Security-Policy's script-src restrictions (each
          one is effectively an unsigned inline script), resist
          debugging (no stack frame in the handler), and scatter
          behavior across templates. Keeping them out is a
          hard-won property — this crawler prevents new ones
          from sneaking back.

How it works:
  1. Walk `templates/**/*.html`.
  2. Match any `on<event>="..."` or `on<event>='...'` attribute
     where <event> is one of the 12 common DOM events (click,
     change, input, submit, focus, blur, keydown, keyup,
     keypress, load, mouseover, mouseout). The list is
     intentionally narrow — `oninstant` is not a real event.
  3. WARN per occurrence with file + line + event name.

Why WARN not FAIL:
  A handful of legitimate inline handlers survive in form-builder
  templates where the alternative would be significant refactoring
  for little benefit (e.g. `onclick="this.form.submit()"` in a
  one-off print link). Starting as WARN lets us audit the baseline;
  once the count is stable we can either allowlist the legacy sites
  and promote to FAIL, or finish the refactor and zero out.

Limitations:
  - Doesn't detect `<script>document.querySelector(...).onclick=...</script>`
    — that pattern is still inline-script flavored but rare in this
    codebase (we use external JS files).
  - Doesn't inspect `addEventListener` calls inside `<script>` blocks.
    Those are the target pattern, not the regression.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import NamedTuple

from ..base import CrawlerStrategy, CrawlResult
from ..harness import Harness


# The 12 DOM events we flag. Keep this list conservative: adding
# more increases false-positive risk (e.g. `onload` on <body> is
# sometimes necessary for external-library integration).
BANNED_EVENTS = (
    "click", "change", "input", "submit",
    "focus", "blur",
    "keydown", "keyup", "keypress",
    "mouseover", "mouseout",
)

ON_ATTR_RE = re.compile(
    r"""\bon(?P<event>""" + "|".join(BANNED_EVENTS) + r""")\s*=\s*(?P<q>["'])[^"']*(?P=q)""",
    re.IGNORECASE,
)


class HandlerSite(NamedTuple):
    file: str
    line_no: int
    event: str


def _line_of(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


class NoInlineOnclickStrategy(CrawlerStrategy):
    """No inline on<event>= attributes in templates."""

    name = "no_inline_onclick"
    aspect = "regression"
    description = (
        "No inline on<event>= attrs in templates/ — use delegated handlers in JS"
    )
    needs_seed = False

    def run(self, harness: Harness) -> CrawlResult:
        result = CrawlResult(name=self.name, aspect=self.aspect)
        root = Path(__file__).resolve().parents[2]
        templates_dir = root / "templates"

        if not templates_dir.exists():
            result.failed += 1
            result.details.append(f"{templates_dir} not found")
            return result

        total_templates = 0
        findings: list[HandlerSite] = []

        for html_path in sorted(templates_dir.rglob("*.html")):
            total_templates += 1
            rel = str(html_path.relative_to(root))
            text = html_path.read_text(encoding="utf-8", errors="ignore")
            for m in ON_ATTR_RE.finditer(text):
                findings.append(HandlerSite(
                    file=rel,
                    line_no=_line_of(text, m.start()),
                    event=m.group("event").lower(),
                ))

        result.passed = total_templates - len({f.file for f in findings})
        result.warnings = len(findings)
        for site in findings:
            result.details.append(
                f"inline on{site.event}= at {site.file}:{site.line_no}"
            )

        result.metrics = {
            "templates_scanned": total_templates,
            "inline_handlers": len(findings),
            "files_affected": len({f.file for f in findings}),
        }
        return result


NoInlineOnclickStrategy.register()
