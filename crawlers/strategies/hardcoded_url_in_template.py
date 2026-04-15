"""Hardcoded URL crawler — no literal `href="/path"` inside templates.

Aspect: regression

Improves: the inverse of `url_for_endpoint_exists`. Catches
          templates that bypass `url_for` with a literal path.
          When a route moves (e.g. `/schedule` → `/queue`), a
          hardcoded link silently 404s while every `url_for`
          callsite transparently updates.

How it works:
  1. Walk `templates/**/*.html`.
  2. Find every `href="..."` / `src="..."` / `action="..."`
     attribute whose value starts with `/` and contains no Jinja
     expression (`{{ ... }}` / `{% ... %}`).
  3. Ignore static-asset paths (`/static/...`), fragment links
     (`#anchor`), protocol-relative (`//host/...`), and a small
     allowlist (e.g. `<link rel="manifest" href="/manifest.json">`).
  4. WARN for each remaining literal path.

Why WARN not FAIL:
  Some literal paths are intentional (favicon, manifest, a debug
  endpoint that's not exported as a named route). Starting as
  WARN avoids blocking the sanity gate until the count is audited.

Limitations:
  - Only template attributes. Python-side hardcoded redirects
    (`return redirect("/foo")`) are out of scope — they surface
    faster in manual testing.
  - Anchor-only hrefs (`href="#foo"`) are allowed (in-page
    navigation is fine).
  - `href="{{ SOMEVAR }}/suffix"` is correctly ignored (Jinja
    expression in value).
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import NamedTuple

from ..base import CrawlerStrategy, CrawlResult
from ..harness import Harness


# href / src / action attribute with a literal string value.
# Captures the value. Non-greedy value so nested quotes inside
# Jinja (rare) don't collapse.
URL_ATTR_RE = re.compile(
    r"""\b(?P<attr>href|src|action)\s*=\s*(?P<q>["'])(?P<val>[^"']+?)(?P=q)""",
    re.IGNORECASE,
)

# Paths we permit as literals — assets and well-known Flask-served
# files that never move.
ALLOWLIST_PREFIXES: tuple[str, ...] = (
    "/static/",
    "/favicon.ico",
    "/manifest.json",
    "/robots.txt",
    "/.well-known/",
)

# Specific full-path allowlist for rare literals that have a clear
# reason not to use url_for (e.g. a literal we want to outlive
# endpoint renames on purpose).
ALLOWLIST_PATHS: frozenset[str] = frozenset({
    # None today; populate as intentional exceptions arise.
})


class LiteralSite(NamedTuple):
    file: str
    line_no: int
    attr: str
    value: str


def _line_of(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def _is_literal_internal_path(value: str) -> bool:
    """Return True if value is a hardcoded internal path we want to flag."""
    # Has a Jinja expression → not a literal, skip.
    if "{{" in value or "{%" in value:
        return False
    # Must start with a single slash (internal path). `//` is
    # protocol-relative (external), not our concern.
    if not value.startswith("/") or value.startswith("//"):
        return False
    # Fragment-only already excluded by the leading-slash test.
    # Absolute external URLs like `http://...` excluded too.
    # Allowlist prefixes (static assets, well-known paths).
    for prefix in ALLOWLIST_PREFIXES:
        if value.startswith(prefix):
            return False
    if value in ALLOWLIST_PATHS:
        return False
    return True


class HardcodedUrlInTemplateStrategy(CrawlerStrategy):
    """No literal `/path` in href/src/action — use url_for()."""

    name = "hardcoded_url_in_template"
    aspect = "regression"
    description = (
        "No literal internal-path href/src/action in templates — use url_for()"
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
        findings: list[LiteralSite] = []

        for html_path in sorted(templates_dir.rglob("*.html")):
            rel = str(html_path.relative_to(root))
            text = html_path.read_text(encoding="utf-8", errors="ignore")
            for m in URL_ATTR_RE.finditer(text):
                total_attrs += 1
                value = m.group("val")
                if not _is_literal_internal_path(value):
                    continue
                findings.append(LiteralSite(
                    file=rel,
                    line_no=_line_of(text, m.start()),
                    attr=m.group("attr").lower(),
                    value=value,
                ))

        result.passed = total_attrs - len(findings)
        result.warnings = len(findings)
        for site in findings:
            result.details.append(
                f"literal {site.attr}={site.value!r} at {site.file}:{site.line_no}"
            )

        result.metrics = {
            "templates_scanned": sum(1 for _ in templates_dir.rglob("*.html")),
            "url_attrs_scanned": total_attrs,
            "literal_internal_paths": len(findings),
        }
        return result


HardcodedUrlInTemplateStrategy.register()
