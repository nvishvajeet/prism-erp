"""Dev-panel readability crawler — locks in the W1.4.3 c2 contract.

Aspect: visibility
Improves: guarantees the owner-only /admin/dev_panel page always
          answers "where are we right now?" in one glance. A regression
          that drops the hero tile, stops highlighting the hot wave,
          or breaks the reports-freshness indicator fails the sanity
          wave before it can land on main.

The strategy logs in as the owner, fetches /admin/dev_panel, and
asserts the following readability surface is present in the response
body:

  1. A <section> with class `tile-dev-now-shipping` and id
     `devNowShipping` — the 'Now Shipping' hero exists and is
     addressable.
  2. Four id-tagged cells inside it:
       - #devNowHotWave          (or the "all shipped" fallback)
       - #devNowCommitsToday
       - #devNowReports
     plus the static "NOW SHIPPING" card-heading kicker so the
     human-readable title is still there.
  3. A `.dev-now-pipeline` progress bar.
  4. A hot-wave row: either `.dp-wave-hot` is present with a
     `.dp-wave-hot-pill` badge, OR every wave is shipped (then the
     hero tile explicitly says "All tracked waves shipped.").
  5. At least one commit sha rendered (proves the git-log parser
     still works — a common breakage after git-binary upgrades).
  6. The page is not a 403/404/500.

Owner-only: every other role 403s on /admin/dev_panel, so the strategy
logs in as vishvajeet@prism.local (the seeded super_admin / owner).
"""
from __future__ import annotations

import re

from ..base import CrawlerStrategy, CrawlResult
from ..harness import Harness


OWNER_EMAIL = "vishvajeet@prism.local"
DEV_PANEL_PATH = "/admin/dev_panel"

# Sentinels that must appear in the rendered HTML. Each tuple is
# (needle, human_label) — the label is what shows up in a failure
# report so a regression is diagnosable without grepping the template.
REQUIRED_MARKUP: list[tuple[str, str]] = [
    ('id="devNowShipping"',          "Now Shipping hero tile (#devNowShipping)"),
    ('tile-dev-now-shipping',        ".tile-dev-now-shipping class on the hero"),
    ('NOW SHIPPING',                  '"NOW SHIPPING" card heading'),
    ('id="devNowCommitsToday"',      "#devNowCommitsToday cell"),
    ('id="devNowReports"',           "#devNowReports cell"),
    ('dev-now-pipeline',              ".dev-now-pipeline progress bar"),
    ('dev-now-grid',                  ".dev-now-grid layout wrapper"),
]

# A short SHA like "e3157c1" or "a1b2c3d". git log --oneline prefix
# anchored inside <code class="inline-code">…</code>. We don't require
# a specific sha — just that one is there, so the git integration
# didn't silently break.
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
                f"GET {DEV_PANEL_PATH} as owner → HTTP {resp.status_code} "
                f"(expected 200)"
            )
            result.metrics = {"http_status": resp.status_code}
            return result

        body = resp.get_data(as_text=True)

        # Rule 1–3, 6: static markup sentinels.
        for needle, label in REQUIRED_MARKUP:
            if needle not in body:
                result.failed += 1
                result.details.append(f"missing: {label} ({needle!r})")
            else:
                result.passed += 1

        # Rule 4: either a hot-wave row + HOT pill, OR the explicit
        # "all shipped" fallback message. Both are acceptable resting
        # states of the pipeline.
        has_hot_row = "dp-wave-hot-pill" in body and "dp-wave-hot" in body
        has_empty_fallback = "All tracked waves shipped." in body
        if has_hot_row or has_empty_fallback:
            result.passed += 1
        else:
            result.failed += 1
            result.details.append(
                "neither .dp-wave-hot-pill nor 'All tracked waves shipped.' "
                "fallback found — hot-wave callout missing"
            )

        # Rule 5: at least one recent-commit sha rendered.
        shas = SHA_RE.findall(body)
        if shas:
            result.passed += 1
        else:
            result.failed += 1
            result.details.append(
                "no <code class='inline-code'>sha</code> found — git log parser "
                "may be broken or recent_commits is empty"
            )

        result.metrics = {
            "http_status": resp.status_code,
            "body_bytes": len(body),
            "sha_samples": len(shas),
            "hero_present": 'id="devNowShipping"' in body,
            "hot_row_present": has_hot_row,
            "empty_fallback": has_empty_fallback,
        }
        return result


DevPanelReadabilityStrategy.register()
