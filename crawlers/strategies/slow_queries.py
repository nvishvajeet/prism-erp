"""Slow-query crawler — per-SQL timing on the canonical hot routes.

Aspect: performance
Improves: catches SQL regressions that the macro-level
          `performance` crawler can't see because it only times
          the whole request. This one monkey-patches
          `app.query_all` / `app.query_one` / `app.execute` for
          the duration of the crawl, records per-call durations,
          and flags anything over BUDGET_MS.

The patch is scoped with a try/finally so a crash restores the
real helpers — other strategies in the same wave are unaffected.

Budget: 50ms per query (ROADMAP W1.3.8). Anything over budget
raises one WARN with the SQL fingerprint + elapsed time. Raising
a FAIL is reserved for queries over 250ms — unambiguously broken.
"""
from __future__ import annotations

import re
import time
from collections import defaultdict

from ..base import CrawlerStrategy, CrawlResult
from ..harness import Harness


HOT_ROUTES = [
    "/",
    "/schedule",
    "/instruments",
    "/stats",
    "/admin/users",
]

BUDGET_WARN_MS = 50.0
BUDGET_FAIL_MS = 250.0


def _fingerprint(sql: str) -> str:
    """Collapse whitespace + strip literals so repeated queries merge."""
    s = re.sub(r"\s+", " ", sql).strip()
    s = re.sub(r"'[^']*'", "'?'", s)
    s = re.sub(r"\b\d+\b", "?", s)
    return s[:140]


class SlowQueriesStrategy(CrawlerStrategy):
    """Per-query timing on hot routes. Budget: 50ms warn, 250ms fail."""

    name = "slow_queries"
    aspect = "performance"
    description = "Per-SQL timing on hot routes (budget: 50ms warn, 250ms fail)"

    def run(self, harness: Harness) -> CrawlResult:
        result = CrawlResult(name=self.name, aspect=self.aspect)

        assert harness.app is not None, "harness.bootstrap() first"
        app_mod = harness.app

        timings: dict[str, list[float]] = defaultdict(list)
        max_elapsed: dict[str, float] = defaultdict(float)

        real_query_all = app_mod.query_all
        real_query_one = app_mod.query_one
        real_execute = app_mod.execute

        def _time(real, sql, params=()):
            t0 = time.perf_counter()
            try:
                return real(sql, params)
            finally:
                elapsed_ms = (time.perf_counter() - t0) * 1000.0
                fp = _fingerprint(sql)
                timings[fp].append(elapsed_ms)
                if elapsed_ms > max_elapsed[fp]:
                    max_elapsed[fp] = elapsed_ms

        def wrapped_query_all(sql, params=()):
            return _time(real_query_all, sql, params)

        def wrapped_query_one(sql, params=()):
            return _time(real_query_one, sql, params)

        def wrapped_execute(sql, params=()):
            return _time(real_execute, sql, params)

        app_mod.query_all = wrapped_query_all
        app_mod.query_one = wrapped_query_one
        app_mod.execute = wrapped_execute

        total_calls = 0
        try:
            with harness.logged_in("admin@lab.local"):
                for path in HOT_ROUTES:
                    harness.get(path, note="slow_queries",
                                follow_redirects=True)
        finally:
            app_mod.query_all = real_query_all
            app_mod.query_one = real_query_one
            app_mod.execute = real_execute

        # Score — one PASS per fingerprint under budget, one WARN
        # per fingerprint whose max elapsed is over BUDGET_WARN_MS,
        # one FAIL per fingerprint over BUDGET_FAIL_MS.
        for fp, samples in timings.items():
            total_calls += len(samples)
            worst = max_elapsed[fp]
            if worst >= BUDGET_FAIL_MS:
                result.failed += 1
                result.details.append(
                    f"SLOW (fail): {worst:.1f}ms  ×{len(samples)}  {fp}"
                )
            elif worst >= BUDGET_WARN_MS:
                result.warnings += 1
                result.details.append(
                    f"slow (warn): {worst:.1f}ms  ×{len(samples)}  {fp}"
                )
            else:
                result.passed += 1

        result.metrics = {
            "routes": len(HOT_ROUTES),
            "distinct_queries": len(timings),
            "total_sql_calls": total_calls,
            "budget_warn_ms": BUDGET_WARN_MS,
            "budget_fail_ms": BUDGET_FAIL_MS,
        }
        return result


SlowQueriesStrategy.register()
