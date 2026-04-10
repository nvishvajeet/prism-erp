"""CSS orphan crawler — selectors defined but never used in templates.

Aspect: css_hygiene
Improves: prevents the stylesheet from accumulating dead selectors
          after refactors (Phase 5's W5.7 retired ~870 lines this
          way). Keeping the check automated means next refactor
          doesn't grow a new fossil layer.

How it works:
  1. Parse `static/styles.css` and harvest every `.class-name`
     (ignore pseudo-classes, attribute selectors, media queries).
  2. Grep every template under `templates/` + every `.py` under repo
     root for occurrences of each class name.
  3. Report selectors with zero references as warnings. The first
     N orphans become failures so CI catches gross drift.

Not perfect — dynamic class composition in JS may false-positive an
orphan — but good enough to anchor the retirement ritual.
"""
from __future__ import annotations

import re
from pathlib import Path

from ..base import CrawlerStrategy, CrawlResult
from ..harness import Harness

CLASS_RE = re.compile(r"\.([a-zA-Z_][\w-]*)")

# Selectors we tolerate even if unreferenced — utility classes, state
# hooks, JS-driven additions, vendor overrides, etc.
ALLOWLIST: set[str] = {
    "card", "tile", "primary-action", "danger", "muted-note", "hint",
    "section-head", "section-actions", "form-grid", "top-gap",
    "page-back", "text-link", "badge", "disabled", "active",
    "is-open", "is-closed", "is-active", "is-error", "is-loading",
    "selected", "sticky", "compact", "dense", "bare",
    # Pagination and pane internals used by JS macros
    "pane-controls", "pane-scroll", "pane-empty", "pane-page",
    # FullCalendar overrides
    "fc", "fc-event", "fc-day", "fc-toolbar",
}

# If more than this number of orphans appear, the run fails hard.
FAIL_THRESHOLD = 50


class CSSOrphanStrategy(CrawlerStrategy):
    """Find `.class` selectors in styles.css that no template uses."""

    name = "css_orphan"
    aspect = "css_hygiene"
    description = "Scan static/styles.css for orphaned selectors"
    needs_seed = False

    def run(self, harness: Harness) -> CrawlResult:
        result = CrawlResult(name=self.name, aspect=self.aspect)
        root = Path(__file__).resolve().parents[2]
        css_path = root / "static" / "styles.css"
        templates_dir = root / "templates"

        if not css_path.exists():
            result.failed += 1
            result.details.append(f"{css_path} not found")
            return result

        css_text = css_path.read_text(encoding="utf-8", errors="ignore")
        # Strip /* comments */ and @media(...) { headers
        stripped = re.sub(r"/\*.*?\*/", "", css_text, flags=re.DOTALL)
        candidates: set[str] = set(CLASS_RE.findall(stripped))

        # Assemble template + python haystacks
        haystack_parts: list[str] = []
        if templates_dir.exists():
            for path in templates_dir.rglob("*.html"):
                haystack_parts.append(path.read_text(encoding="utf-8", errors="ignore"))
        for py in root.glob("*.py"):
            haystack_parts.append(py.read_text(encoding="utf-8", errors="ignore"))
        haystack = "\n".join(haystack_parts)

        orphans: list[str] = []
        used = 0
        for name in sorted(candidates):
            if name in ALLOWLIST:
                used += 1
                continue
            # Word-boundary match avoids `.foo` also counting `.foobar`
            if re.search(rf"(?<![\w-]){re.escape(name)}(?![\w-])", haystack):
                used += 1
            else:
                orphans.append(name)

        for name in orphans[:200]:
            result.details.append(f"orphan: .{name}")
        if len(orphans) >= FAIL_THRESHOLD:
            result.failed += 1
            result.details.insert(
                0,
                f"Found {len(orphans)} orphan selectors (fail threshold: {FAIL_THRESHOLD})",
            )
        elif orphans:
            result.warnings += len(orphans)
        result.passed += used

        result.metrics = {
            "total_class_selectors": len(candidates),
            "used": used,
            "orphans": len(orphans),
            "allowlist_size": len(ALLOWLIST),
        }
        result.report_json = {"orphans": orphans}
        return result


CSSOrphanStrategy.register()
