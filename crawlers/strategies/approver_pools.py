"""Approver-pool round-robin crawler.

Aspect: data_integrity
Improves: protects the fairness invariant in
          `app.py:_default_user_for_approval_role`. Before the
          round-robin refactor that picker returned
          `ORDER BY u.id LIMIT 1`, so every new request on an
          instrument with two operators / two finance officers /
          etc. piled up on the lowest-id user and the rest of the
          pool never saw work. This strategy submits 4 sequential
          requests on instrument 1 (which now has two operators
          wired in the harness — anika + bala) and asserts that
          the operator approver alternates. Any drift back to
          "always picks id-1" fails loudly here.

Explicit per-person routing (via
`instrument_approval_config.approver_user_id`) is NOT exercised
here — that path bypasses the default picker entirely and is
unchanged by the refactor. See `create_approval_chain()` for how
the explicit override wins.
"""
from __future__ import annotations

import sqlite3

from ..base import CrawlerStrategy, CrawlResult
from ..harness import Harness


class ApproverPoolsStrategy(CrawlerStrategy):
    """Verify round-robin approver selection on multi-operator instruments."""

    name = "approver_pools"
    aspect = "data_integrity"
    description = "Round-robin approver assignment across operator pool"

    REQUEST_COUNT = 4

    def run(self, harness: Harness) -> CrawlResult:
        result = CrawlResult(name=self.name, aspect=self.aspect)

        if not harness.temp_db_path:
            result.warnings += 1
            result.details.append("harness has no temp db; cannot assert")
            return result

        # Submit REQUEST_COUNT fresh requests as the requester. Each
        # submission kicks off a fresh approval chain via
        # `create_approval_chain()`, which calls
        # `_default_user_for_approval_role()` → `_load_balance_pick()`
        # for every role that doesn't have an explicit approver
        # pinned in `instrument_approval_config`. The demo seed
        # leaves no explicit operator override on instrument 1, so
        # operator assignment for these 4 requests is governed
        # entirely by the load-balance pick.
        submitted_ids: list[int] = []
        with harness.logged_in("shah@lab.local"):
            for i in range(self.REQUEST_COUNT):
                form = {
                    "instrument_id": "1",
                    "title": f"Approver-pool crawl #{i + 1}",
                    "sample_name": f"Pool sample {i + 1}",
                    "sample_count": "1",
                    "description": "Round-robin approver assignment probe.",
                    "sample_origin": "internal",
                    "priority": "normal",
                }
                resp = harness.post("/requests/new", data=form, follow_redirects=True)
                if resp.status_code >= 400:
                    result.failed += 1
                    result.details.append(
                        f"submit #{i + 1} → {resp.status_code}"
                    )
                    return result
                new_id = self._latest_request_id(harness)
                if new_id is None or new_id in submitted_ids:
                    result.failed += 1
                    result.details.append(
                        f"submit #{i + 1}: no new request row appeared"
                    )
                    return result
                submitted_ids.append(new_id)
                result.passed += 1

        # Now read the operator approver for each of the 4 new rows.
        operators = [
            self._operator_approver_for(harness, rid) for rid in submitted_ids
        ]
        result.metrics = {
            "request_ids": submitted_ids,
            "operator_approvers": operators,
        }

        # Every new request must have had SOMEONE assigned.
        if any(op is None for op in operators):
            result.failed += 1
            result.details.append(
                f"missing operator approver on one of the new requests: {operators}"
            )
            return result

        # With a 2-operator pool and 4 sequential submissions, the
        # ideal distribution is 2-2 (any order). The minimum bar we
        # enforce is "not all four on the same person" — that's the
        # literal old bug. We additionally enforce that both members
        # of the pool appear at least once in the sequence; otherwise
        # the picker is silently favouring one id.
        distinct = set(operators)
        pool = self._operator_pool_for_instrument(harness, 1)
        result.metrics["operator_pool"] = sorted(pool)

        if len(pool) < 2:
            result.warnings += 1
            result.details.append(
                f"operator pool on instrument 1 has <2 members: {pool} "
                "(harness seed drift?)"
            )
            return result

        if len(distinct) == 1:
            result.failed += 1
            result.details.append(
                f"all {self.REQUEST_COUNT} requests piled on user {operators[0]} "
                f"— round-robin pick is broken (pool: {sorted(pool)})"
            )
            return result

        # Both pool members used at least once?
        missing = set(pool) - distinct
        if missing:
            result.failed += 1
            result.details.append(
                f"operators never picked across {self.REQUEST_COUNT} requests: "
                f"{sorted(missing)} (got: {operators})"
            )
            return result

        # Fairness: with 4 requests and 2 operators, the split should
        # be 2-2. Anything more skewed than 3-1 fails; 3-1 is a warn.
        from collections import Counter
        counts = Counter(operators)
        sorted_counts = sorted(counts.values(), reverse=True)
        if sorted_counts[0] - sorted_counts[-1] >= 3:
            result.failed += 1
            result.details.append(
                f"operator load skew too high across pool: {dict(counts)}"
            )
            return result
        elif sorted_counts[0] - sorted_counts[-1] == 2:
            result.warnings += 1
            result.details.append(
                f"operator load slightly uneven: {dict(counts)} "
                "(acceptable, but watch for drift)"
            )
        else:
            result.passed += 1  # perfectly balanced 2-2

        return result

    # -----------------------------------------------------------------
    def _latest_request_id(self, harness: Harness) -> int | None:
        conn = sqlite3.connect(str(harness.temp_db_path))
        try:
            row = conn.execute(
                "SELECT id FROM sample_requests ORDER BY id DESC LIMIT 1"
            ).fetchone()
            return row[0] if row else None
        finally:
            conn.close()

    def _operator_approver_for(
        self, harness: Harness, request_id: int
    ) -> int | None:
        conn = sqlite3.connect(str(harness.temp_db_path))
        try:
            row = conn.execute(
                """
                SELECT approver_user_id
                FROM approval_steps
                WHERE sample_request_id = ? AND approver_role = 'operator'
                ORDER BY step_order
                LIMIT 1
                """,
                (request_id,),
            ).fetchone()
            return row[0] if row else None
        finally:
            conn.close()

    def _operator_pool_for_instrument(
        self, harness: Harness, instrument_id: int
    ) -> list[int]:
        conn = sqlite3.connect(str(harness.temp_db_path))
        try:
            rows = conn.execute(
                """
                SELECT u.id
                FROM users u
                JOIN instrument_operators io ON io.user_id = u.id
                WHERE io.instrument_id = ? AND u.active = 1
                ORDER BY u.id
                """,
                (instrument_id,),
            ).fetchall()
            return [r[0] for r in rows]
        finally:
            conn.close()


ApproverPoolsStrategy.register()
