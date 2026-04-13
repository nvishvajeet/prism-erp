"""UI uniformity — runtime check of the .tile architecture contract.

Where `philosophy_propagation` statically greps templates for a
`.*-tiles` grid class, this logs in as super_admin and asserts
on the rendered HTML of the canonical pages: (1) `<main class=
"page"` wrapper, (2) a `*-tiles` grid class, (3) a `.tile`
descendant — the last check catches drift philosophy rule 2
can't see (a grid wrapper whose `{% for %}` loop produced zero
children). `/sitemap` graduated onto `.sitemap-tiles` on
2026-04-11 and is no longer exempt from (2).
"""
from __future__ import annotations

import re

from ..base import CrawlerStrategy, CrawlResult
from ..harness import Harness


CANONICAL_PAGES: tuple[str, ...] = (
    "/",
    "/instruments",
    "/schedule",
    "/requests/new",
    "/sitemap",
)

NO_TILES_GRID_PATHS: frozenset[str] = frozenset()

PAGE_WRAPPER_MARKER = '<main class="page"'
TILES_GRID_RE = re.compile(r'class="[^"]*-tiles[^"]*"')
TILE_CHILD_RE = re.compile(r'class="[^"]*\btile\b[^"]*"')


class UIUniformityStrategy(CrawlerStrategy):
    """Per-role runtime check of the `.tile` architecture contract."""

    name = "ui_uniformity"
    aspect = "css_hygiene"
    description = "Runtime tile-architecture check on canonical pages"

    def run(self, harness: Harness) -> CrawlResult:
        result = CrawlResult(name=self.name, aspect=self.aspect)

        with harness.logged_in("owner@catalyst.local"):
            for path in CANONICAL_PAGES:
                resp = harness.get(path, note=f"ui_uniformity:{path}",
                                   follow_redirects=True)
                if resp.status_code >= 400:
                    result.failed += 1
                    result.details.append(f"{path}: HTTP {resp.status_code}")
                    continue
                body = resp.get_data(as_text=True)

                if PAGE_WRAPPER_MARKER in body:
                    result.passed += 1
                else:
                    result.failed += 1
                    result.details.append(
                        f"{path}: missing `<main class=\"page\">` wrapper"
                    )

                if path not in NO_TILES_GRID_PATHS:
                    if TILES_GRID_RE.search(body):
                        result.passed += 1
                    else:
                        result.failed += 1
                        result.details.append(
                            f"{path}: no `*-tiles` grid class in rendered HTML"
                        )

                if TILE_CHILD_RE.search(body):
                    result.passed += 1
                else:
                    result.failed += 1
                    result.details.append(
                        f"{path}: tile grid has no `.tile` descendant"
                    )

        result.metrics = {
            "pages": len(CANONICAL_PAGES),
            "expected_checks": len(CANONICAL_PAGES) * 3 - len(NO_TILES_GRID_PATHS),
        }
        return result


UIUniformityStrategy.register()
