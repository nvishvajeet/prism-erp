"""External-link noopener crawler — every <a target="_blank"> has rel="noopener".

Aspect: regression

Improves: plugs the "target=_blank without rel=noopener" security
          hole. A link that opens a new tab via `target="_blank"`
          makes the new page's `window.opener` point back at the
          original window. The new page can then do
          `window.opener.location = evil.com` — a silent phishing
          vector. Adding `rel="noopener"` (or `rel="noreferrer"`,
          which implies noopener) severs that reference.

How it works:
  1. Walk `templates/**/*.html`.
  2. For every `<a ...>` whose attributes contain `target="_blank"`,
     check that the same tag also has `rel=` containing `noopener`
     or `noreferrer`.
  3. WARN per missing-noopener link with file + line.

Why WARN not FAIL:
  Some internal-only flows with `target="_blank"` are low-risk
  (user never leaves our origin). Starting as WARN allows auditing
  before a hard promotion to FAIL.

Limitations:
  - Doesn't check `<form target="_blank">` — much rarer, not the
    usual attack surface.
  - Doesn't follow Jinja macros that expand to anchors; macro-
    generated links are covered implicitly (if the macro is wrong,
    every callsite is wrong).
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import NamedTuple

from ..base import CrawlerStrategy, CrawlResult
from ..harness import Harness


# <a ...> opening tag — capture attribute block (non-greedy up to
# the first `>` so sibling tags don't collapse).
ANCHOR_OPEN_RE = re.compile(r"<a\b([^>]*)>", re.IGNORECASE)

# target="_blank" / target='_blank'. Tolerant of whitespace and
# Jinja inside the value, but the literal `_blank` must appear.
TARGET_BLANK_RE = re.compile(
    r"""\btarget\s*=\s*["']\s*_blank\s*["']""",
    re.IGNORECASE,
)

# rel="..." capturing value. We then look for noopener/noreferrer
# inside the value string (space-separated token list).
REL_ATTR_RE = re.compile(
    r"""\brel\s*=\s*(?P<q>["'])(?P<val>[^"']+)(?P=q)""",
    re.IGNORECASE,
)


class LinkSite(NamedTuple):
    file: str
    line_no: int


def _line_of(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def _has_safe_rel(attrs: str) -> bool:
    m = REL_ATTR_RE.search(attrs)
    if not m:
        return False
    tokens = {t.strip().lower() for t in m.group("val").split()}
    return "noopener" in tokens or "noreferrer" in tokens


class ExternalLinkNoopenerStrategy(CrawlerStrategy):
    """Every <a target=_blank> carries rel=noopener (or noreferrer)."""

    name = "external_link_noopener"
    aspect = "regression"
    description = (
        "Every <a target=_blank> in templates/ carries rel=noopener (or noreferrer)"
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

        total_blank = 0
        missing: list[LinkSite] = []

        for html_path in sorted(templates_dir.rglob("*.html")):
            rel = str(html_path.relative_to(root))
            text = html_path.read_text(encoding="utf-8", errors="ignore")
            for m in ANCHOR_OPEN_RE.finditer(text):
                attrs = m.group(1)
                if not TARGET_BLANK_RE.search(attrs):
                    continue
                total_blank += 1
                if _has_safe_rel(attrs):
                    continue
                missing.append(LinkSite(
                    file=rel,
                    line_no=_line_of(text, m.start()),
                ))

        result.passed = total_blank - len(missing)
        result.warnings = len(missing)
        for site in missing:
            result.details.append(
                f"<a target=_blank> missing rel=noopener at {site.file}:{site.line_no}"
            )

        result.metrics = {
            "templates_scanned": sum(1 for _ in templates_dir.rglob("*.html")),
            "target_blank_anchors": total_blank,
            "missing_noopener": len(missing),
        }
        return result


ExternalLinkNoopenerStrategy.register()
