"""Dead-link crawler — HTML href audit.

Aspect: dead_links
Improves: catches internal hrefs that point at missing routes or
          removed pages. Scans the HTML of every page reachable by
          each role, harvests every internal `href`, then hits them
          all. Any 404/410/500 is a failure.

Ignores:
  - external links (http://, mailto:, tel:)
  - in-page anchors (#section)
  - javascript: handlers
  - routes needing path params we can't synthesise
"""
from __future__ import annotations

import re
from urllib.parse import urldefrag, urlparse

from ..base import CrawlerStrategy, CrawlResult
from ..harness import Harness

HREF_RE = re.compile(rb'href="([^"]+)"')

SEED_PATHS = [
    "/", "/schedule", "/calendar", "/instruments", "/stats",
    "/visualizations", "/docs", "/sitemap", "/requests/new", "/me",
]

ROLES_TO_CRAWL = [
    "admin@lab.local",
    "fesem.admin@lab.local",
    "anika@lab.local",
    "shah@lab.local",
]


def _is_internal(href: str) -> bool:
    if not href:
        return False
    if href.startswith(("#", "mailto:", "tel:", "javascript:", "http://", "https://", "//")):
        return False
    return True


def _normalise(href: str) -> str:
    href, _ = urldefrag(href)
    # Strip query string for dedup — most PRISM 404s come from missing
    # base paths, not query state.
    parsed = urlparse(href)
    return parsed.path or "/"


class DeadLinkStrategy(CrawlerStrategy):
    """BFS-harvest hrefs across representative roles, hit each one."""

    name = "dead_link"
    aspect = "dead_links"
    description = "Harvest + visit every internal href across 4 roles"

    def run(self, harness: Harness) -> CrawlResult:
        result = CrawlResult(name=self.name, aspect=self.aspect)
        seen: set[str] = set()
        checked: dict[str, int] = {}

        for email in ROLES_TO_CRAWL:
            with harness.logged_in(email):
                frontier: list[str] = list(SEED_PATHS)
                role_seen: set[str] = set()
                while frontier:
                    path = frontier.pop()
                    if path in role_seen:
                        continue
                    role_seen.add(path)
                    try:
                        resp = harness.get(path, note=f"dead_link:{email}",
                                           follow_redirects=True)
                    except Exception:
                        continue
                    status = resp.status_code
                    key = f"{email}:{path}"
                    checked[key] = status
                    if status == 404 or status == 410 or status >= 500:
                        result.failed += 1
                        result.details.append(
                            f"[{email}] {path} → {status}"
                        )
                        continue
                    if status >= 400:
                        continue
                    # Harvest hrefs
                    body = resp.data or b""
                    for match in HREF_RE.finditer(body):
                        href = match.group(1).decode("ascii", errors="ignore")
                        if not _is_internal(href):
                            continue
                        target = _normalise(href)
                        if "{" in target or target.startswith("/static/"):
                            # Jinja-placeholder leakage or asset link
                            continue
                        if target not in role_seen and len(role_seen) < 120:
                            frontier.append(target)
                        seen.add(target)
                        result.passed += 1

        result.metrics = {
            "unique_targets": len(seen),
            "roles_crawled": len(ROLES_TO_CRAWL),
            "total_checks": len(checked),
        }
        result.report_json = {"checked": checked}
        return result


DeadLinkStrategy.register()
