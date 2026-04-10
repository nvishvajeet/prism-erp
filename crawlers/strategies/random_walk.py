"""Random-walk crawler — MCMC-style state-space coverage.

Aspect: coverage
Improves: exercises combinations of (role, route, prior-state) that
          no hand-written test would think to try. By the coupon
          collector's argument, visiting k states with probability
          ≥ 1−δ needs O(k · ln(k/δ)) steps. For PRISM's ~55 routes
          × 8 roles ≈ 440 cells, 2000 steps gives ~95% coverage.

Ported from `test_mcmc_crawl.py`, slimmed for routine use. Every
step picks a random (role, action) pair. GET actions are always
safe; POST actions only fire on targets present in a small
allowlist of self-healing endpoints.
"""
from __future__ import annotations

import os
import random
from collections import Counter

from ..base import CrawlerStrategy, CrawlResult
from ..harness import Harness, ROLE_PERSONAS

# (verb, path, note). GETs only for safety.
ROUTE_POOL = [
    ("GET", "/", "home"),
    ("GET", "/schedule", "queue"),
    ("GET", "/calendar", "calendar"),
    ("GET", "/instruments", "instruments"),
    ("GET", "/stats", "stats"),
    ("GET", "/visualizations", "viz"),
    ("GET", "/requests/new", "new"),
    ("GET", "/admin/users", "admin-users"),
    ("GET", "/docs", "docs"),
    ("GET", "/sitemap", "sitemap"),
    ("GET", "/me", "profile"),
    ("GET", "/api/health-check", "health"),
    ("GET", "/instruments/1", "inst-1"),
    ("GET", "/instruments/2", "inst-2"),
    ("GET", "/instruments/1/history", "inst-1-history"),
    ("GET", "/visualizations/instrument/1", "viz-inst-1"),
]

DEFAULT_STEPS = int(os.environ.get("CRAWLER_RANDOM_WALK_STEPS", "800"))


class RandomWalkStrategy(CrawlerStrategy):
    """Uniform random walk over (role, route) pairs.

    Records every status for every (role, route, ordinal) triple so
    the report can surface coverage gaps + 5xx clusters.
    """

    name = "random_walk"
    aspect = "coverage"
    description = "MCMC walk over (role × route) cells, ~800 steps"

    steps: int = DEFAULT_STEPS
    seed: int = 20260410

    def run(self, harness: Harness) -> CrawlResult:
        result = CrawlResult(name=self.name, aspect=self.aspect)
        rng = random.Random(self.seed)
        role_emails = [e for _, e, _ in ROLE_PERSONAS]
        coverage: Counter[tuple[str, str]] = Counter()
        status_mix: Counter[int] = Counter()
        five_xx: list[tuple[str, str, int]] = []

        # Login once per walker chunk to minimise session thrash
        chunk = 40
        for chunk_start in range(0, self.steps, chunk):
            email = rng.choice(role_emails)
            role = harness._role_for(email)  # noqa: SLF001 — intentional
            with harness.logged_in(email):
                for _ in range(min(chunk, self.steps - chunk_start)):
                    verb, path, note = rng.choice(ROUTE_POOL)
                    try:
                        resp = harness.get(path, note=f"walk:{role}:{note}",
                                           follow_redirects=False)
                    except Exception as exc:  # noqa: BLE001
                        result.failed += 1
                        result.details.append(f"{role} {path} raised {exc!r}")
                        continue
                    status = resp.status_code
                    status_mix[status] += 1
                    coverage[(role, path)] += 1
                    if status >= 500:
                        result.failed += 1
                        five_xx.append((role, path, status))
                        if len(result.details) < 50:
                            result.details.append(f"5xx {role} {path} → {status}")
                    else:
                        result.passed += 1

        total_cells = len(role_emails) * len(ROUTE_POOL)
        covered = len(coverage)
        result.metrics = {
            "steps": self.steps,
            "unique_cells_visited": covered,
            "total_cells": total_cells,
            "coverage_pct": round(100.0 * covered / max(1, total_cells), 1),
            "status_mix": dict(status_mix),
            "five_xx_count": len(five_xx),
        }
        result.report_json = {
            "coverage": {f"{r}|{p}": n for (r, p), n in coverage.items()},
            "five_xx": five_xx[:200],
        }
        return result


RandomWalkStrategy.register()
