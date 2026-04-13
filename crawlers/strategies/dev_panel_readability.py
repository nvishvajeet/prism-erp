"""Dev-panel readability crawler — verifies the rebuilt v1.1 panel.

Aspect: visibility
Improves: guarantees the owner-only /admin/dev_panel page renders
          with all 5 core tiles (banner, infrastructure, health,
          commits, docs). A regression that drops a tile or breaks
          the git integration fails the sanity wave.
"""
from __future__ import annotations

import re

from ..base import CrawlerStrategy, CrawlResult
from ..harness import Harness


OWNER_EMAIL = "owner@catalyst.local"
DEV_PANEL_PATH = "/admin/dev_panel"

# Sentinels that must appear in the rendered HTML.
REQUIRED_MARKUP: list[tuple[str, str]] = [
    ('mc-banner',               "Mission Control banner"),
    ('mc-banner-version',       "Version tag in banner"),
    ('INFRASTRUCTURE',          "Infrastructure tile heading"),
    ('dp-metadata-row',         "Engine rows in infrastructure"),
    ('HEALTH',                  "Health tile heading"),
    ('RECENT COMMITS',          "Recent Commits tile heading"),
    ('DOCS',                    "Document viewer tile heading"),
]

# At least one commit SHA rendered (proves git log works).
SHA_RE = re.compile(r'<code class="inline-code"[^>]*>([0-9a-f]{6,12})</code>')


class DevPanelReadabilityStrategy(CrawlerStrategy):
    """Owner dev console must answer 'where are we?' in one glance."""

    name = "dev_panel_readability"
    aspect = "visibility"
    description = "Dev console hero tile + hot-wave callout + reports-freshness present"

    def run(self, harness: Harness) -> CrawlResult:
        result = CrawlResult(name=self.name, aspect=self.aspect)

        with harness.logged_in(OWNER_EMAIL):
            resp = harness.get(DEV_PANEL_PATH, note="dev_panel_readability:get",
                               follow_redirects=True)

        if resp.status_code != 200:
            result.failed += 1
            result.details.append(
                f"GET {DEV_PANEL_PATH} as owner → HTTP {resp.status_code}"
            )
            return result

        body = resp.get_data(as_text=True)

        for needle, label in REQUIRED_MARKUP:
            if needle in body:
                result.passed += 1
            else:
                result.failed += 1
                result.details.append(f"missing: {label} ({needle!r})")

        shas = SHA_RE.findall(body)
        if shas:
            result.passed += 1
        else:
            result.failed += 1
            result.details.append("no commit SHA found — git log may be broken")

        # Page should not be excessively small (regression indicator)
        if len(body) > 2000:
            result.passed += 1
        else:
            result.failed += 1
            result.details.append(f"page body too small ({len(body)} bytes)")

        result.metrics = {
            "http_status": resp.status_code,
            "body_bytes": len(body),
            "sha_count": len(shas),
        }
        return result


DevPanelReadabilityStrategy.register()
