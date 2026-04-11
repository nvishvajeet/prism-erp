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
    # FullCalendar base class (prefix rule "fc-" misses the bare name)
    "fc",
}

# Any selector whose name starts with one of these prefixes is
# considered "used" — they are either JS-driven, vendor-overrides, or
# applied via dynamic class composition that grep can't see. Prefer
# deleting the CSS if a family is genuinely dead, but prefixes that
# ship from a third-party library get an automatic pass.
ALLOWLIST_PREFIXES: tuple[str, ...] = (
    # FullCalendar + dhtmlx calendar (runtime-injected by the JS lib)
    "fc-", "fc_", "calendar_white_", "month_white_",
    # Generic button families composed at runtime
    "btn-",
    # State and utility flags composed at runtime
    "is-", "has-",
    # Sample-request / workflow status classes composed in templates as
    # `status-{{ row['status'] }}` — one class per workflow state.
    "status-",
    # Dev-panel wave rows — `dp-wave-{{ w.status }}` (shipped/hot/pending)
    "dp-wave-",
    # Stat tile tone classes — `stat-tone-{{ tone }}` in _page_macros.html
    "stat-tone-",
    # All -tiles grids used by the tile architecture (page-level layout)
    # are applied once per template; crawler treats any existing
    # `<thing>-tiles` class as used-by-convention.
    # (handled separately below — we special-case the -tiles suffix)
)

# Any selector whose name ENDS with one of these suffixes is tolerated.
ALLOWLIST_SUFFIXES: tuple[str, ...] = (
    "-tiles",
)

# If more than this number of orphans appear, the run fails hard.
# Backlog was wiped to zero on 2026-04-11 (W1.3.11 cleanup — 194
# dead classes + ~1700 dead CSS lines removed, 13 dynamic-prefix
# families added to the allowlist). The threshold is intentionally
# low now so any regression fails loudly instead of being allowed
# to grow a second fossil layer.
FAIL_THRESHOLD = 20


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
            if any(name.startswith(p) for p in ALLOWLIST_PREFIXES):
                used += 1
                continue
            if any(name.endswith(s) for s in ALLOWLIST_SUFFIXES):
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
            "allowlist_prefixes": list(ALLOWLIST_PREFIXES),
            "allowlist_suffixes": list(ALLOWLIST_SUFFIXES),
        }
        result.report_json = {"orphans": orphans}
        return result


CSSOrphanStrategy.register()
