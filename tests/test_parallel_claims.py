"""Regression test for the `parallel_claims` crawler strategy.

Shipped in `1f771e2` as a sanity-wave strategy that surfaces live
parallel-agent activity by reading `CLAIMS.md` — the advisory-lock
board for concurrent agent work (see `WORKFLOW.md` §3.7 and
`docs/PARALLEL.md`). The crawler asserts the file is present and
parseable, counts live claim rows, and emits `active_claims_count`
plus `claims_file_bytes` metrics the dev_panel CRAWLERS tile can
read.

This test locks the crawler against the live `CLAIMS.md` state so
a refactor of the advisory-lock protocol cannot silently break the
sanity wave's live-activity signal.

Run directly:

    .venv/bin/python tests/test_parallel_claims.py

Exits 0 on success, 1 on any failure with a one-line summary per
failure. Pure file read, no DB, no Flask context — safe to run
standalone and as part of any future `tests` wave in the crawler
harness.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

os.environ.setdefault("LAB_SCHEDULER_DEMO_MODE", "1")
os.environ.setdefault("LAB_SCHEDULER_CSRF", "0")
os.environ.setdefault("OWNER_EMAILS", "admin@lab.local")

from crawlers.base import CrawlResult  # noqa: E402
from crawlers.strategies.parallel_claims import ParallelClaimsStrategy  # noqa: E402


def main() -> int:
    failures: list[str] = []

    strategy = ParallelClaimsStrategy()
    result = strategy.run(None)

    # 1. Returns a CrawlResult.
    if not isinstance(result, CrawlResult):
        failures.append(
            f"run(None) returned {type(result).__name__}, expected CrawlResult"
        )
        # Can't meaningfully continue without a CrawlResult.
        print(f"test_parallel_claims: 1 failure(s):")
        for f in failures:
            print(f"  - {f}")
        return 1

    # 2. Current state is healthy: no failed checks.
    if result.failed != 0:
        failures.append(
            f"failed count: expected 0, got {result.failed} "
            f"(details: {result.details})"
        )

    # 3. At least one pass — the file-present check must fire.
    if result.passed < 1:
        failures.append(
            f"passed count: expected >= 1, got {result.passed}"
        )

    # 4. active_claims_count metric present, int, >= 0.
    acc = result.metrics.get("active_claims_count")
    if not isinstance(acc, int):
        failures.append(
            f"metrics.active_claims_count: expected int, got "
            f"{type(acc).__name__} ({acc!r})"
        )
    elif acc < 0:
        failures.append(
            f"metrics.active_claims_count: expected >= 0, got {acc}"
        )

    # 5. claims_file_bytes metric present, int, > 500 (protocol preamble).
    cfb = result.metrics.get("claims_file_bytes")
    if not isinstance(cfb, int):
        failures.append(
            f"metrics.claims_file_bytes: expected int, got "
            f"{type(cfb).__name__} ({cfb!r})"
        )
    elif cfb <= 500:
        failures.append(
            f"metrics.claims_file_bytes: expected > 500, got {cfb}"
        )

    # 6. Identity — name + aspect locked for dev_panel tile lookup.
    if result.name != "parallel_claims":
        failures.append(
            f"result.name: expected 'parallel_claims', got {result.name!r}"
        )
    if result.aspect != "regression":
        failures.append(
            f"result.aspect: expected 'regression', got {result.aspect!r}"
        )

    if failures:
        print(f"test_parallel_claims: {len(failures)} failure(s):")
        for f in failures:
            print(f"  - {f}")
        return 1

    total = 6
    print(f"test_parallel_claims: {total}/{total} invariants locked")
    return 0


if __name__ == "__main__":
    sys.exit(main())
