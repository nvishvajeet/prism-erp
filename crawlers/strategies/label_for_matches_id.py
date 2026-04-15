"""Label-for crawler — every <label for="x"> points to a real id="x".

Aspect: accessibility

Improves: catches the silent "label refactored away from input" bug.
          `<label for="foo">` is how screen readers attach a visible
          caption to an input; if the input was renamed/moved/deleted,
          the label becomes a disconnected string and keyboard/screen-
          reader users lose the association without any visible error.

How it works:
  1. Walk `templates/**/*.html`.
  2. Collect every literal `id="..."` in the file (matching the
     same attribute grammar as `duplicate_id_in_template`).
  3. For every `<label for="...">`, verify the `for` target exists
     in the id set.
  4. Skip `for="..."` values that contain Jinja expressions
     (dynamic label targets, legitimately common in form loops).
  5. WARN per orphan label with file + line.

Why WARN not FAIL:
  Some labels target ids rendered by included partials the crawler
  cannot see (same-page scope limitation). Starting as WARN avoids
  blocking the gate; once we are confident the false-positive rate
  is near zero, we promote to FAIL.

Limitations:
  - Single-file scope. A label in page.html targeting an id
    rendered by `{% include "_form.html" %}` shows as orphan here.
    In practice these are rare in this codebase — when they exist,
    the partial is inlined or the label moves with the input.
  - Jinja-dynamic `for` values (`for="field_{{ loop.index }}"`)
    are correctly skipped.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import NamedTuple

from ..base import CrawlerStrategy, CrawlResult
from ..harness import Harness


ID_ATTR_RE = re.compile(
    r"""\bid\s*=\s*(?P<q>["'])(?P<val>[^"'{}]+?)(?P=q)""",
)

LABEL_FOR_RE = re.compile(
    r"""<label\b[^>]*?\bfor\s*=\s*(?P<q>["'])(?P<val>[^"']+?)(?P=q)""",
    re.IGNORECASE,
)


class OrphanSite(NamedTuple):
    file: str
    line_no: int
    target: str


def _line_of(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def _is_dynamic_target(value: str) -> bool:
    return "{{" in value or "{%" in value


class LabelForMatchesIdStrategy(CrawlerStrategy):
    """Every <label for='x'> resolves to an id='x' in the same template."""

    name = "label_for_matches_id"
    aspect = "accessibility"
    description = (
        "Every <label for='x'> points to an existing id='x' in the same template"
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

        total_labels = 0
        orphans: list[OrphanSite] = []

        for html_path in sorted(templates_dir.rglob("*.html")):
            rel = str(html_path.relative_to(root))
            text = html_path.read_text(encoding="utf-8", errors="ignore")

            ids_in_file: set[str] = {
                m.group("val") for m in ID_ATTR_RE.finditer(text)
            }

            for m in LABEL_FOR_RE.finditer(text):
                total_labels += 1
                target = m.group("val")
                if _is_dynamic_target(target):
                    continue
                if target in ids_in_file:
                    continue
                orphans.append(OrphanSite(
                    file=rel,
                    line_no=_line_of(text, m.start()),
                    target=target,
                ))

        result.passed = total_labels - len(orphans)
        result.warnings = len(orphans)
        for site in orphans:
            result.details.append(
                f"label for={site.target!r} has no matching id at {site.file}:{site.line_no}"
            )

        result.metrics = {
            "templates_scanned": sum(1 for _ in templates_dir.rglob("*.html")),
            "total_labels_for": total_labels,
            "orphan_labels": len(orphans),
        }
        return result


LabelForMatchesIdStrategy.register()
