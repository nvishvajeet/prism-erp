"""Performance crawler — per-route p50 / p95 / max response time.

Aspect: performance
Improves: surfaces slow endpoints before users feel them. Every
          critical route is hit N times as super_admin (warmest
          possible — worst-case scenario for template rendering).

Run after `run populate` when the DB is rich — that's when
performance bottlenecks actually manifest.
"""
from __future__ import annotations

import statistics
from collections import defaultdict

from ..base import CrawlerStrategy, CrawlResult
from ..harness import Harness

HOT_ROUTES = [
    "/",
    "/schedule",
    "/calendar",
    "/instruments",
    "/stats",
    "/visualizations",
    "/requests/new",
    "/admin/users",
    "/docs",
    "/sitemap",
]

SAMPLES_PER_ROUTE = 10

# Budgets in milliseconds. Anything exceeding BUDGET_WARN raises a
# warning, exceeding BUDGET_FAIL is a hard failure.
BUDGET_WARN_MS = 300.0
BUDGET_FAIL_MS = 1500.0


class PerformanceStrategy(CrawlerStrategy):
    """Sample each hot route multiple times and flag slow outliers.

    Uses Flask's test client, so measurements reflect *app server*
    time only (no network, no browser). Still useful for relative
    comparison across builds.
    """

    name = "performance"
    aspect = "performance"
    description = "p50/p95/max response time for hot routes (warm)"

    def run(self, harness: Harness) -> CrawlResult:
        result = CrawlResult(name=self.name, aspect=self.aspect)
        timings: dict[str, list[float]] = defaultdict(list)

        with harness.logged_in("owner@catalyst.local"):
            for path in HOT_ROUTES:
                for _ in range(SAMPLES_PER_ROUTE):
                    try:
                        resp = harness.get(path, note="perf", follow_redirects=False)
                    except Exception as exc:  # noqa: BLE001
                        result.failed += 1
                        result.details.append(f"{path} raised {exc!r}")
                        continue
                    if resp.status_code >= 500:
                        result.failed += 1
                        result.details.append(f"{path} → {resp.status_code}")
                        continue
                    # Grab the call we just logged and read its elapsed_ms
                    if harness.log.calls:
                        timings[path].append(harness.log.calls[-1].elapsed_ms)

        per_route: dict[str, dict[str, float]] = {}
        for path, samples in timings.items():
            if not samples:
                continue
            samples_sorted = sorted(samples)
            p50 = statistics.median(samples_sorted)
            p95 = samples_sorted[int(len(samples_sorted) * 0.95) - 1] if len(samples_sorted) >= 2 else samples_sorted[-1]
            mx = max(samples_sorted)
            per_route[path] = {"p50": round(p50, 1), "p95": round(p95, 1), "max": round(mx, 1)}

            if mx >= BUDGET_FAIL_MS:
                result.failed += 1
                result.details.append(
                    f"{path} max={mx:.0f}ms exceeds fail budget {BUDGET_FAIL_MS:.0f}ms"
                )
            elif p95 >= BUDGET_WARN_MS:
                result.warnings += 1
                result.details.append(
                    f"{path} p95={p95:.0f}ms exceeds warn budget {BUDGET_WARN_MS:.0f}ms"
                )
            else:
                result.passed += 1

        # samples_per_route / warn_budget_ms / fail_budget_ms are
        # module-level constants — recording them per-run is noise.
        # Dropped in the crawlers/optimize-metadata claim.
        result.metrics = {"routes_sampled": len(per_route)}
        return result


PerformanceStrategy.register()
