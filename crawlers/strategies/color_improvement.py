"""Color-improvement crawler — scan rendered HTML for palette drift.

Aspect: accessibility
Improves: surfaces pages where hand-authored hex literals have
          crept in (instead of CSS variables), or where the
          foreground/background pairs fall below WCAG minimums.

Unlike `contrast_audit` (which checks a fixed palette list), this
crawler *renders every page* via the test client, greps the HTML
for color literals, and reports opportunities. Never hard-fails —
emits warnings only — so it's a running backlog rather than a gate.
"""
from __future__ import annotations

import re
from collections import Counter

from ..base import CrawlerStrategy, CrawlResult
from ..harness import Harness
from .contrast_audit import contrast_ratio

HEX_RE = re.compile(r"#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b")
RGB_RE = re.compile(r"rgba?\(([^)]+)\)")

SCAN_PATHS = [
    "/", "/schedule", "/calendar", "/instruments", "/stats",
    "/visualizations", "/docs", "/sitemap",
]


class ColorImprovementStrategy(CrawlerStrategy):
    """Grep rendered HTML for inline color literals + low-contrast pairs."""

    name = "color_improvement"
    aspect = "accessibility"
    description = "Suggest palette/contrast improvements on rendered pages"

    def run(self, harness: Harness) -> CrawlResult:
        result = CrawlResult(name=self.name, aspect=self.aspect)
        colors: Counter[str] = Counter()

        with harness.logged_in("admin@lab.local"):
            for path in SCAN_PATHS:
                resp = harness.get(path, follow_redirects=True)
                if resp.status_code >= 400:
                    result.warnings += 1
                    result.details.append(f"{path}: {resp.status_code}")
                    continue
                body = (resp.data or b"").decode("utf-8", errors="ignore")
                # Skip <style> blocks — CSS variables live there
                body_no_style = re.sub(r"<style[\s\S]*?</style>", "", body)
                for match in HEX_RE.finditer(body_no_style):
                    token = f"#{match.group(1).lower()}"
                    colors[token] += 1
                for match in RGB_RE.finditer(body_no_style):
                    colors[f"rgb({match.group(1).strip()})"] += 1
                result.passed += 1

        # Classify every hex we saw by whether it passes WCAG AA on
        # the default light background #ffffff.
        suggestions: list[str] = []
        for token, count in colors.most_common():
            if not token.startswith("#"):
                continue
            try:
                ratio = contrast_ratio(token, "#ffffff")
            except Exception:  # noqa: BLE001 — malformed hex
                continue
            if ratio < 4.5:
                suggestions.append(
                    f"{token} (seen {count}×): ratio {ratio:.2f} on #ffffff — "
                    f"below WCAG AA 4.5"
                )
                result.warnings += 1

        for line in suggestions[:60]:
            result.details.append(line)

        result.metrics = {
            "pages_scanned": len(SCAN_PATHS),
            "unique_colors_found": len(colors),
            "suggestions": len(suggestions),
        }
        result.report_json = {"colors": dict(colors)}
        return result


ColorImprovementStrategy.register()
