"""Smoke crawler — fastest critical-path regression.

Aspect: regression
Improves: catches gross breakage (500s, missing pages, broken login)
          before any heavier crawler is worth running.

Hits ~15 critical routes across 3 representative roles and asserts
2xx/3xx. Runs in a few seconds. Use as a pre-push gate.
"""
from __future__ import annotations

from ..base import CrawlerStrategy, CrawlResult
from ..harness import Harness

CRITICAL_PATHS = [
    "/",
    "/schedule",
    "/calendar",
    "/instruments",
    "/stats",
    "/visualizations",
    "/requests/new",
    "/me",
    "/docs",
    "/sitemap",
    "/api/health-check",
]

SMOKE_ROLES = [
    ("owner@catalyst.local", "super_admin"),
    ("anika@catalyst.local", "operator"),
    ("user1@catalyst.local", "requester"),
]

# Paths that are expected to return 403 for specific roles (by design).
EXPECTED_403 = {
    "requester": {"/schedule", "/calendar", "/instruments", "/stats", "/visualizations"},
}


class SmokeStrategy(CrawlerStrategy):
    """Hit every critical path as three representative roles. Fast."""

    name = "smoke"
    aspect = "regression"
    description = "Fast regression — critical paths × 3 roles (~50 calls)"

    def run(self, harness: Harness) -> CrawlResult:
        result = CrawlResult(name=self.name, aspect=self.aspect)
        for email, role in SMOKE_ROLES:
            with harness.logged_in(email):
                for path in CRITICAL_PATHS:
                    resp = harness.get(path, note=f"smoke:{role}",
                                       follow_redirects=True)
                    if resp.status_code < 400:
                        result.passed += 1
                    elif resp.status_code == 403:
                        if path in EXPECTED_403.get(role, set()):
                            result.passed += 1  # expected gate
                        else:
                            result.warnings += 1
                            result.details.append(f"{role} {path} → 403")
                    else:
                        result.failed += 1
                        result.details.append(
                            f"{role} {path} → {resp.status_code}"
                        )
        result.metrics = {
            "roles_checked": len(SMOKE_ROLES),
            "paths_per_role": len(CRITICAL_PATHS),
            "total_calls": len(harness.log.calls),
        }
        return result


SmokeStrategy.register()
