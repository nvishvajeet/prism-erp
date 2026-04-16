"""Inline style crawler — no literal `style="..."` attributes in templates.

Aspect: css_hygiene

Improves: enforces the "zero inline tile styles" design invariant
          that was re-established in `cf1167c deploy-ready: CSRF on
          intake forms, zero inline tile styles`. Inline styles
          bypass the token ladder in static/styles.css — `color`,
          spacing, and layout values live in one place there, and
          inline `style=` attributes fork that ladder silently.
          When the ladder moves (dark mode pass, token rename),
          inline-styled elements drift and produce the "why is
          THIS widget still using the old grey" bug.

How it works:
  1. Walk `templates/**/*.html`.
  2. Find every literal `style="..."` / `style='...'` attribute.
  3. Skip `style` values that contain a Jinja expression
     (`style="width: {{ pct }}%"`) — those express values that
     can only be computed at render time and are the legitimate
     minority.
  4. WARN for every remaining literal inline style, with file +
     line + value.

Why WARN not FAIL:
  Baseline scan finds ~100+ literal inline styles across ~20
  files. Shipping this as FAIL would block every push. WARN
  reports the current count so it can be driven to zero
  file-by-file; promote to FAIL once the count is 0 and it's
  safe to use as a regression gate.

Limitations:
  - Only <tag style="..."> attributes. Inline `<style>...</style>`
    blocks in templates are a separate (rarer) anti-pattern and
    not covered.
  - Not run at render time — values computed by Python and
    injected into the DOM via JS are out of scope.
  - `style=""` (empty) is treated as literal and reported;
    there's no legitimate reason for an empty style attribute.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import NamedTuple

from ..base import CrawlerStrategy, CrawlResult
from ..harness import Harness


# style="..." / style='...' — captures the value. Non-greedy so
# nested quoting (e.g. style='content: "x"') doesn't over-match.
STYLE_ATTR_RE = re.compile(
    r"""\bstyle\s*=\s*(?P<q>["'])(?P<val>.*?)(?P=q)""",
    re.DOTALL,
)


class InlineStyleSite(NamedTuple):
    file: str
    line_no: int
    value: str


def _line_of(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def _is_literal_style(value: str) -> bool:
    """Return True if the style value is literal (no Jinja) and thus flaggable."""
    if "{{" in value or "{%" in value:
        return False
    return True


class InlineStyleAttributeStrategy(CrawlerStrategy):
    """No literal `style="..."` in templates — put it in styles.css."""

    name = "inline_style_attribute"
    aspect = "css_hygiene"
    description = (
        "No literal style= attributes in templates — define classes in styles.css"
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

        total_attrs = 0
        findings: list[InlineStyleSite] = []
        files_with_findings: set[str] = set()

        for html_path in sorted(templates_dir.rglob("*.html")):
            rel = str(html_path.relative_to(root))
            text = html_path.read_text(encoding="utf-8", errors="ignore")
            for m in STYLE_ATTR_RE.finditer(text):
                total_attrs += 1
                value = m.group("val")
                if not _is_literal_style(value):
                    continue
                findings.append(InlineStyleSite(
                    file=rel,
                    line_no=_line_of(text, m.start()),
                    value=value.strip(),
                ))
                files_with_findings.add(rel)

        result.passed = total_attrs - len(findings)
        result.warnings = len(findings)

        # Cap individual-site detail to keep reports readable; the
        # metrics carry the real tally and per-file breakdown.
        for site in findings[:120]:
            snippet = site.value if len(site.value) <= 60 else site.value[:57] + "..."
            result.details.append(
                f"inline style {snippet!r} at {site.file}:{site.line_no}"
            )
        if len(findings) > 120:
            result.details.append(
                f"... and {len(findings) - 120} more (see metrics.by_file for per-file count)"
            )

        by_file: dict[str, int] = {}
        for site in findings:
            by_file[site.file] = by_file.get(site.file, 0) + 1
        top = sorted(by_file.items(), key=lambda kv: -kv[1])[:10]

        result.metrics = {
            "templates_scanned": sum(1 for _ in templates_dir.rglob("*.html")),
            "style_attrs_scanned": total_attrs,
            "literal_inline_styles": len(findings),
            "files_with_findings": len(files_with_findings),
            "top_offenders": top,
        }
        return result


InlineStyleAttributeStrategy.register()
