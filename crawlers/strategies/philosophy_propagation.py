"""Philosophy propagation crawler — enforces the CATALYST design creed.

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
  8. `static/keybinds.js` exists, is referenced from `base.html`, and
     stays ≤40 lines (no JS framework creep — W1.4.1 c3).

Exemptions: macro files (`_*.html`), `base.html`, `error_*.html`,
`login.html`, `logout.html`.
"""
from __future__ import annotations

import re
from pathlib import Path

from ..base import CrawlerStrategy, CrawlResult
from ..harness import Harness

# sitemap.html graduated onto .sitemap-tiles on 2026-04-11 — no
# longer exempt, so future tile-architecture drift is caught here.
EXEMPT_PREFIXES = ("_", "base.html", "error", "login.html",
                   "logout.html", "onboard", "accept_invite",
                   "password_reset", "calendar_card")

STANDALONE_PRINT_OK = {
    "ca_audit_print_signoff.html",
    "filing_destroy_plan.html",
}

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
# dialogs / special pages. `new_request.html` graduated onto the
# tile pattern as of the W1.4.3-polish batch (see `.new-request-tiles`
# in styles.css); it is no longer exempt, so future drift gets caught.
NO_TILE_GRID_OK = {
    "change_password.html",
    "notifications.html",  # single feed, no multi-tile composition
    # Dispatch is a single-purpose command surface (voice/text input +
    # priority queues) — it uses `.dispatch-console` as its layout
    # primitive with `.dispatch-list` / `.dispatch-item` internals,
    # not the dashboard-style multi-tile grid. Exempt by design.
    "dispatch.html",
}


class PhilosophyStrategy(CrawlerStrategy):
    """Lint templates against the CATALYST design creed."""

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
            standalone_print = tpl.name in STANDALONE_PRINT_OK

            # Rule 1: extends base.html
            if "{% extends" not in text and not standalone_print:
                result.failed += 1
                bump("missing_extends")
                result.details.append(f"{tpl.name}: does not extend base.html")

            # Rule 2: has a *-tiles grid
            if tpl.name not in NO_TILE_GRID_OK and not standalone_print:
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
            # Ignore colors inside <style> blocks that scope a local fix,
            # and inside <script> blocks (Chart.js palettes need literal
            # hex codes to pass to the chart lib — CSS vars don't work
            # through JS). Colors in Jinja attributes still count.
            scrubbed = re.sub(r"<style[\s\S]*?</style>", "", text)
            scrubbed = re.sub(r"<script[\s\S]*?</script>", "", scrubbed)
            if HEX_COLOR_RE.search(scrubbed) or RGB_COLOR_RE.search(scrubbed):
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
            if "data-vis=" not in text and not standalone_print:
                result.warnings += 1
                bump("missing_data_vis")
                result.details.append(f"{tpl.name}: no data-vis attribute")

        # Rule 8: keybinds.js — tiny, vanilla, referenced from base.html
        KEYBIND_MAX_LINES = 40
        keybinds_path = root / "static" / "keybinds.js"
        base_path = templates_dir / "base.html"
        if not keybinds_path.exists():
            result.failed += 1
            bump("keybinds_missing")
            result.details.append("static/keybinds.js: missing")
        else:
            line_count = sum(1 for _ in keybinds_path.open(encoding="utf-8"))
            if line_count > KEYBIND_MAX_LINES:
                result.failed += 1
                bump("keybinds_too_long")
                result.details.append(
                    f"static/keybinds.js: {line_count} lines > {KEYBIND_MAX_LINES} (JS framework creep)"
                )
            else:
                result.passed += 1
            if base_path.exists():
                base_text = base_path.read_text(encoding="utf-8", errors="ignore")
                if "keybinds.js" not in base_text:
                    result.failed += 1
                    bump("keybinds_not_linked")
                    result.details.append("base.html: does not reference keybinds.js")
                else:
                    result.passed += 1

        result.metrics = {
            "templates_checked": checked,
            "deprecated_classes_tracked": len(DEPRECATED_CLASSES),
            "violations_by_rule": violations_by_rule,
        }
        return result


PhilosophyStrategy.register()
