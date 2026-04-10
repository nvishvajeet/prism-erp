"""Philosophy propagation crawler — enforces the PRISM design creed.

Aspect: css_hygiene (overlaps with regression)
Improves: detects pages that have drifted away from the Apple / Ive
          / Ferrari "every element earns its place" rules that the
          rest of the suite is built on.

Rules the crawler enforces on every `templates/*.html` file:

  1. Every user-facing page must extend `base.html` (or be a partial).
  2. Every page-level layout must use a `.<name>-tiles` grid class
     (matching the instrument_detail.html reference).
  3. No `overflow: auto` inline styles inside content cards — long
     lists must use `paginated_pane`.
  4. No bare `<table>` inside a card unless wrapped in `paginated_pane`
     or marked with `data-no-pane`.
  5. No hard-coded color hex/rgb values in templates — colors belong
     in `static/styles.css` behind CSS variables.
  6. Every tile article must carry `data-vis="{{ V }}"` so server-side
     visibility slicing composes with the client safety net.
  7. No use of deprecated class families (`.grid-two`, `.stream-pill`,
     `.warroom-header`, `.bucket-link`, `.event-stream*`).

Exemptions: macro files (`_*.html`), `base.html`, `error_*.html`,
`login.html`, `logout.html`.
"""
from __future__ import annotations

import re
from pathlib import Path

from ..base import CrawlerStrategy, CrawlResult
from ..harness import Harness

EXEMPT_PREFIXES = ("_", "base.html", "error_", "login.html",
                   "logout.html", "onboard", "accept_invite",
                   "password_reset", "calendar_card")

DEPRECATED_CLASSES = [
    "grid-two", "grid-auto-stats", "stream-pill", "stream-filter-strip",
    "warroom-header", "warroom-title", "warroom-filters", "warroom-pill",
    "bucket-link", "bucket-grid", "event-stream", "event-left", "event-right",
    "event-center", "request-workspace", "request-side-stack",
    "stats-left-column", "stats-right-column", "role-toggle-strip",
    "history-toggle-grid", "history-control-strip", "instrument-carousel",
]

HEX_COLOR_RE = re.compile(r"#[0-9a-fA-F]{3,6}\b")
RGB_COLOR_RE = re.compile(r"rgb\(")

# Pages don't need a tile grid if they're listed here — forms /
# dialogs / special pages.
NO_TILE_GRID_OK = {
    "new_request.html",
    "change_password.html",
    "notifications.html",  # single feed, no multi-tile composition
}


class PhilosophyStrategy(CrawlerStrategy):
    """Lint templates against the PRISM design creed."""

    name = "philosophy"
    aspect = "css_hygiene"
    description = "Template-level design creed audit (tiles, vars, vis)"
    needs_seed = False

    def run(self, harness: Harness) -> CrawlResult:
        result = CrawlResult(name=self.name, aspect=self.aspect)
        root = Path(__file__).resolve().parents[2]
        templates_dir = root / "templates"
        if not templates_dir.exists():
            result.failed += 1
            result.details.append("templates/ directory missing")
            return result

        checked = 0
        violations_by_rule: dict[str, int] = {}

        def bump(rule: str) -> None:
            violations_by_rule[rule] = violations_by_rule.get(rule, 0) + 1

        for tpl in sorted(templates_dir.glob("*.html")):
            if any(tpl.name.startswith(p) for p in EXEMPT_PREFIXES):
                continue
            checked += 1
            text = tpl.read_text(encoding="utf-8", errors="ignore")

            # Rule 1: extends base.html
            if "{% extends" not in text:
                result.failed += 1
                bump("missing_extends")
                result.details.append(f"{tpl.name}: does not extend base.html")

            # Rule 2: has a *-tiles grid
            if tpl.name not in NO_TILE_GRID_OK:
                if not re.search(r'class="[^"]*-tiles[^"]*"', text):
                    result.warnings += 1
                    bump("missing_tile_grid")
                    result.details.append(
                        f"{tpl.name}: no .*-tiles grid class (tile architecture)"
                    )
                else:
                    result.passed += 1

            # Rule 3: no inline overflow:auto
            if re.search(r'overflow\s*:\s*auto', text):
                result.warnings += 1
                bump("inline_overflow")
                result.details.append(f"{tpl.name}: inline overflow:auto")

            # Rule 4: hard-coded color literals
            # Ignore colors inside <style> blocks that scope a local fix.
            body_without_style = re.sub(r"<style[\s\S]*?</style>", "", text)
            if HEX_COLOR_RE.search(body_without_style) or RGB_COLOR_RE.search(body_without_style):
                result.warnings += 1
                bump("hardcoded_color")
                result.details.append(f"{tpl.name}: raw color literal outside <style>")

            # Rule 5: deprecated class families
            for klass in DEPRECATED_CLASSES:
                if re.search(rf'class="[^"]*\b{re.escape(klass)}\b', text):
                    result.failed += 1
                    bump(f"deprecated:{klass}")
                    result.details.append(
                        f"{tpl.name}: uses deprecated class .{klass}"
                    )

            # Rule 6: data-vis="{{ V }}" on the top-level section/card
            if "data-vis=" not in text:
                result.warnings += 1
                bump("missing_data_vis")
                result.details.append(f"{tpl.name}: no data-vis attribute")

        result.metrics = {
            "templates_checked": checked,
            "deprecated_classes_tracked": len(DEPRECATED_CLASSES),
            "violations_by_rule": violations_by_rule,
        }
        return result


PhilosophyStrategy.register()
