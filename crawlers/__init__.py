"""CATALYST Crawler Suite.

A unified, reconstructible collection of crawlers used to test and
improve the CATALYST Lab Scheduler. Each crawler is a focused "strategy"
that targets one aspect of the site (visibility, lifecycle, performance,
accessibility, CSS hygiene, dead links, etc.) and produces a machine-
readable report plus a human summary.

The goal of this package is that **the full suite can be reconstructed
from this directory alone** — no ad-hoc scripts to re-invent next time.

Usage
-----

    # List every registered crawler strategy
    venv/bin/python -m crawlers list

    # Run one crawler
    venv/bin/python -m crawlers run visibility
    venv/bin/python -m crawlers run populate
    venv/bin/python -m crawlers run random_walk --steps 5000
    venv/bin/python -m crawlers run random_walk --steps 50000 --seed 20260410

    # Run every crawler in sequence (CI / pre-push gate)
    venv/bin/python -m crawlers run all

    # Show what each crawler targets
    venv/bin/python -m crawlers describe visibility

Each strategy writes its report to `reports/<name>_report.txt` and a
JSON log to `reports/<name>_log.json` in the repo root. CI can diff
these between runs to surface regressions.

Deep random walks now use a first-class CLI override instead of a
hidden env var. Example:

    ./venv/bin/python -m crawlers run random_walk --steps 50000

Adding a new crawler
--------------------

Drop a file in `crawlers/strategies/` that defines a subclass of
`crawlers.base.CrawlerStrategy` and call `register(MyStrategy)`. The
CLI and README will pick it up automatically.
"""
from __future__ import annotations

from .registry import register, get, all_strategies  # noqa: F401
from .base import CrawlerStrategy, CrawlResult  # noqa: F401

__all__ = ["register", "get", "all_strategies", "CrawlerStrategy", "CrawlResult"]
