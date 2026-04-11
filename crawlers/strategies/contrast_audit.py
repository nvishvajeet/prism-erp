"""Contrast audit — WCAG ratio check for the theme palette.

Aspect: accessibility
Improves: catches palette drift that would regress text readability
          in light *or* dark mode. Ported from `full_qa.py`'s
          theme_audit() so the rule stays runnable from a single
          command.

Each check declares (label, fg, bg, minimum WCAG ratio). The ratios
are WCAG 2.1 relative luminance contrast. AA body text needs ≥ 4.5,
large text ≥ 3.0, AAA body ≥ 7.0.
"""
from __future__ import annotations

from ..base import CrawlerStrategy, CrawlResult
from ..harness import Harness

# (label, foreground hex, background hex, minimum ratio)
PALETTE_CHECKS: list[tuple[str, str, str, float]] = [
    ("light body text",         "#18212b", "#f5f6f8", 10.0),
    ("light panel text",        "#18212b", "#ffffff", 10.0),
    ("light muted text",        "#5d6a76", "#ffffff", 4.5),
    ("dark body text",          "#edf2f7", "#0f1419", 12.0),
    ("dark panel text",         "#edf2f7", "#161d25", 12.0),
    ("dark muted text",         "#b9c6d2", "#161d25", 6.0),
    ("dark input text",         "#edf2f7", "#111923", 12.0),
    ("dark stats text",         "#eef7f8", "#12202a", 12.0),
    ("dark pending badge",      "#c9ddff", "#19283d", 8.0),
    ("dark completed badge",    "#d6f5dd", "#183123", 9.0),
    ("dark rejected badge",     "#ffd8dd", "#351d22", 9.0),
    # Known link tones
    ("light accent link",       "#0b5cff", "#ffffff", 4.5),
    ("dark accent link",        "#7ab2ff", "#0f1419", 4.5),
]


def _luminance(hex_color: str) -> float:
    hex_color = hex_color.lstrip("#")
    rgb = [int(hex_color[i:i + 2], 16) / 255 for i in (0, 2, 4)]

    def channel(v: float) -> float:
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4

    r, g, b = (channel(v) for v in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast_ratio(fg: str, bg: str) -> float:
    l1 = _luminance(fg)
    l2 = _luminance(bg)
    lighter = max(l1, l2)
    darker = min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)


class ContrastAuditStrategy(CrawlerStrategy):
    """Compute WCAG ratios for every palette pair and enforce minimums."""

    name = "contrast_audit"
    aspect = "accessibility"
    description = "WCAG contrast ratios for light + dark theme palette"
    needs_seed = False  # no DB interaction required

    def run(self, harness: Harness) -> CrawlResult:
        result = CrawlResult(name=self.name, aspect=self.aspect)
        ratios: dict[str, float] = {}
        for label, fg, bg, minimum in PALETTE_CHECKS:
            score = contrast_ratio(fg, bg)
            ratios[label] = round(score, 2)
            if score + 1e-3 >= minimum:
                result.passed += 1
            else:
                result.failed += 1
                result.details.append(
                    f"{label}: {score:.2f} < {minimum:.2f} ({fg} on {bg})"
                )
        result.metrics = {"pairs_checked": len(PALETTE_CHECKS)}
        return result


ContrastAuditStrategy.register()
