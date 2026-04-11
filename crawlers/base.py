"""Base class for every crawler strategy in the suite.

A `CrawlerStrategy` declares:
  - a short `name` (CLI handle)
  - a one-line `description`
  - the `aspect` it targets (visibility / lifecycle / performance / ...)
  - a `run(harness)` method that does the crawling and returns a
    `CrawlResult`

The suite orchestrator (crawlers/cli.py) handles:
  - constructing the harness
  - bootstrapping + seeding
  - calling run()
  - persisting reports
  - exit codes (0 = clean, 1 = failures, 2 = warnings only)
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .harness import Harness


# Aspects a crawler can improve — the CLI lets users filter by these.
ASPECTS = {
    "visibility",      # role × page access matrix
    "lifecycle",       # end-to-end UI journeys (submit → approve → complete)
    "coverage",        # random-walk / MCMC state coverage
    "performance",     # per-route response time
    "accessibility",   # WCAG contrast, ARIA, alt text
    "dead_links",      # broken hrefs / anchors / 404s
    "css_hygiene",     # orphan selectors, unused classes
    "regression",      # fast critical-path smoke
    "data_integrity",  # DB invariants after operations
}


@dataclass
class CrawlResult:
    """Structured return value from every strategy.run().

    Historical note: this class used to carry a `report_json` field
    that strategies filled with deep per-run data (orphan lists,
    per-route timings, palette ratios). No consumer ever read it —
    the dev_panel CRAWLERS tile only reads passed/failed/warnings
    out of the summary, and the `reports/<name>_log.json` blob was
    otherwise untouched. Dropped in the crawlers/optimize-metadata
    claim along with the `harness_summary` persist channel. If a
    future tile wants deep data, reintroduce the field then, not
    speculatively now.
    """
    name: str
    aspect: str
    passed: int = 0
    failed: int = 0
    warnings: int = 0
    details: list[str] = field(default_factory=list)
    metrics: dict[str, Any] = field(default_factory=dict)

    @property
    def exit_code(self) -> int:
        if self.failed > 0:
            return 1
        if self.warnings > 0:
            return 2
        return 0

    def human_summary(self) -> str:
        lines = [
            f"crawler:  {self.name}",
            f"aspect:   {self.aspect}",
            f"passed:   {self.passed}",
            f"failed:   {self.failed}",
            f"warnings: {self.warnings}",
            "",
        ]
        if self.metrics:
            lines.append("metrics:")
            for key, value in self.metrics.items():
                lines.append(f"  {key}: {value}")
            lines.append("")
        if self.details:
            lines.append("details:")
            lines.extend(f"  - {line}" for line in self.details[:200])
        return "\n".join(lines)


class CrawlerStrategy:
    """Subclass this to add a new crawler.

    Required class attributes::

        name        = "visibility"            # CLI handle, snake_case
        aspect      = "visibility"            # one of ASPECTS
        description = "Role × page access audit"

    Override::

        def run(self, harness: Harness) -> CrawlResult: ...

    The harness is already bootstrapped + seeded when `run` is called.
    """

    name: str = "unnamed"
    aspect: str = "visibility"
    description: str = ""

    # Override in subclass if the strategy needs no seeded users/instruments.
    needs_seed: bool = True

    def run(self, harness: Harness) -> CrawlResult:  # pragma: no cover
        raise NotImplementedError

    # -- Classmethod sugar so subclasses can self-register -----------
    @classmethod
    def register(cls) -> type["CrawlerStrategy"]:
        from .registry import register as _register
        _register(cls)
        return cls
