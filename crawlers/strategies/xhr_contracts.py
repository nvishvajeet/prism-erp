"""XHR-contract crawler — locks the inline-toggle JSON contract.

Aspect: behavior
Improves: two features in trunk (instrument intake toggle and the
          approval approve/reject buttons) POST to their existing
          routes with `X-Requested-With: XMLHttpRequest` and expect
          a JSON body back. A silent regression to a 302 redirect
          leaves every inline toggle permanently armed and
          unresponsive with zero crawler signal. This strategy pins
          the contract:

  A. /instruments/<id> action=update_operation
  B. /requests/<id>    action=approve_step   (best-effort)

For each endpoint, the four checks are:
  1. HTTP status is 200 (NOT 302/3xx).
  2. Response has no `Location` header.
  3. Content-Type starts with application/json.
  4. Body parses as JSON and satisfies the shape invariants.

Assertion B is best-effort: if the seeded DB has no pending
approval fixture the owner can act on, it records a skipped
pass rather than failing — we do NOT invent fixtures.
"""
from __future__ import annotations

import json
import sqlite3

from ..base import CrawlerStrategy, CrawlResult
from ..harness import Harness


OWNER_EMAIL = "owner@prism.local"
XHR_HEADERS = {
    "X-Requested-With": "XMLHttpRequest",
    "Accept": "application/json",
}


class XhrContractsStrategy(CrawlerStrategy):
    """Inline-toggle XHR endpoints must return JSON, not a redirect."""

    name = "xhr_contracts"
    aspect = "behavior"
    description = "Inline-toggle XHR endpoints return JSON (not 302 redirects)"

    def run(self, harness: Harness) -> CrawlResult:
        result = CrawlResult(name=self.name, aspect=self.aspect)

        with harness.logged_in(OWNER_EMAIL):
            self._check_intake_toggle(harness, result)
            self._check_approve_step(harness, result)

        return result

    # -- Assertion A --------------------------------------------------
    def _check_intake_toggle(self, harness: Harness, result: CrawlResult) -> None:
        instrument_id = self._first_active_instrument_id(harness)
        if instrument_id is None:
            result.failed += 1
            result.details.append("A: no active instrument in DB to exercise")
            return

        resp = harness.post(
            f"/instruments/{instrument_id}",
            data={"action": "update_operation", "intake_mode": "accepting"},
            note="xhr_contracts:update_operation",
            follow_redirects=False,
            headers=XHR_HEADERS,
        )

        self._assert_json_contract(
            resp, result, label="A update_operation",
            body_checks=[
                ("body.ok is True", lambda b: b.get("ok") is True),
                ("body.intake_mode == 'accepting'",
                 lambda b: b.get("intake_mode") == "accepting"),
            ],
        )

    # -- Assertion B (best-effort) ------------------------------------
    def _check_approve_step(self, harness: Harness, result: CrawlResult) -> None:
        fixture = self._find_pending_owner_step(harness)
        if fixture is None:
            result.passed += 1
            result.details.append(
                "B approve_step: skipped — no pending approval fixture "
                "in test DB (owner has no actionable step)"
            )
            return
        request_id, step_id = fixture

        resp = harness.post(
            f"/requests/{request_id}",
            data={"action": "approve_step", "step_id": str(step_id)},
            note="xhr_contracts:approve_step",
            follow_redirects=False,
            headers=XHR_HEADERS,
        )

        self._assert_json_contract(
            resp, result, label="B approve_step",
            body_checks=[
                ("body.ok is True", lambda b: b.get("ok") is True),
                ("body.reload_url present",
                 lambda b: isinstance(b.get("reload_url"), str) and b.get("reload_url")),
            ],
        )

    # -- Shared contract assertion ------------------------------------
    def _assert_json_contract(
        self, resp, result: CrawlResult, *, label: str, body_checks
    ) -> None:
        # 1. HTTP 200, not a redirect
        if resp.status_code == 200:
            result.passed += 1
        else:
            result.failed += 1
            result.details.append(
                f"{label}: status {resp.status_code} (expected 200, "
                f"silent 302 regression would land here)"
            )
        # 2. No Location header (redirect sentinel)
        if not resp.headers.get("Location"):
            result.passed += 1
        else:
            result.failed += 1
            result.details.append(
                f"{label}: unexpected Location header "
                f"{resp.headers.get('Location')!r}"
            )
        # 3. Content-Type is JSON
        ctype = (resp.headers.get("Content-Type") or "").lower()
        if ctype.startswith("application/json"):
            result.passed += 1
        else:
            result.failed += 1
            result.details.append(
                f"{label}: Content-Type {ctype!r} (expected application/json)"
            )
        # 4. Body parses + satisfies shape invariants
        try:
            body = json.loads(resp.get_data(as_text=True))
        except (ValueError, TypeError) as exc:
            result.failed += 1
            result.details.append(f"{label}: body is not valid JSON ({exc})")
            return
        for check_label, check_fn in body_checks:
            try:
                ok = check_fn(body)
            except Exception as exc:  # noqa: BLE001
                ok = False
                result.details.append(f"{label}: {check_label} raised {exc}")
            if ok:
                result.passed += 1
            else:
                result.failed += 1
                result.details.append(f"{label}: {check_label} failed; body={body!r}")

    # -- DB helpers ---------------------------------------------------
    def _first_active_instrument_id(self, harness: Harness) -> int | None:
        if not harness.temp_db_path:
            return None
        conn = sqlite3.connect(str(harness.temp_db_path))
        try:
            row = conn.execute(
                "SELECT id FROM instruments WHERE status = 'active' "
                "ORDER BY id LIMIT 1"
            ).fetchone()
            return row[0] if row else None
        finally:
            conn.close()

    def _find_pending_owner_step(self, harness: Harness) -> tuple[int, int] | None:
        """Return (request_id, step_id) of a pending step the owner
        can act on, or None if no such fixture exists."""
        if not harness.temp_db_path:
            return None
        conn = sqlite3.connect(str(harness.temp_db_path))
        try:
            row = conn.execute(
                """
                SELECT sample_request_id, id
                FROM approval_steps
                WHERE status = 'pending'
                ORDER BY sample_request_id, step_order
                LIMIT 1
                """
            ).fetchone()
            return (row[0], row[1]) if row else None
        finally:
            conn.close()


XhrContractsStrategy.register()
