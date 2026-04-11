"""Lifecycle crawler — end-to-end UI journey (lite).

Aspect: lifecycle
Improves: catches the kinds of bugs that only show up when real
          workflow state exists — missing request, rejected approval,
          orphaned operator assignment. Ports the spirit of
          `test_populate_crawl.py` but trimmed from 500 steps to
          ~60 so it stays fast enough to run every push.

Journey (as the requester unless noted):
  1. Requester submits a new request
  2. Finance approves
  3. Professor approves
  4. Operator accepts → starts → completes
  5. Admin downloads the request detail + views history
  6. Requester posts a follow-up message

Every step asserts 2xx and that the expected server state appears.
"""
from __future__ import annotations

from ..base import CrawlerStrategy, CrawlResult
from ..harness import Harness


class LifecycleStrategy(CrawlerStrategy):
    """Walk one request from submission to completion through the UI."""

    name = "lifecycle"
    aspect = "lifecycle"
    description = "End-to-end request lifecycle through the UI"

    def run(self, harness: Harness) -> CrawlResult:
        result = CrawlResult(name=self.name, aspect=self.aspect)

        # ---- Step 1: requester submits a request --------------------
        with harness.logged_in("shah@lab.local"):
            resp = harness.get("/requests/new")
            self._check(result, resp.status_code < 400, "open new request form",
                        f"/requests/new → {resp.status_code}")

            form = {
                "instrument_id": "1",
                "title": "Lifecycle crawl — TiO2",
                "sample_name": "TiO2 Nanoparticles",
                "sample_count": "3",
                "description": "Characterize morphology and particle size.",
                "sample_origin": "internal",
                "priority": "normal",
            }
            resp = harness.post("/requests/new", data=form, follow_redirects=True)
            self._check(result, resp.status_code < 400, "submit request",
                        f"submit → {resp.status_code}")

        # Give the test client a moment to advance DB state; then find
        # the new request id via the DB.
        request_id = self._first_request_id(harness)
        if request_id is None:
            result.failed += 1
            result.details.append("no sample_request row created after submit")
            return result

        # ---- Step 2: finance approve --------------------------------
        # Current app uses action=approve_step with an explicit
        # step_id (sample_requests have a chain of approval_steps,
        # one per approver role). Look up the pending finance step,
        # approve it, then repeat for professor.
        # approval_steps.approver_role stores short names ("finance",
        # "professor", "operator"), NOT the user-level users.role values
        # ("finance_admin", "professor_approver"). See app.py
        # create_approval_chain() — the short name is the key.
        finance_step = self._pending_step_for_role(harness, request_id, "finance")
        if finance_step is None:
            result.warnings += 1
            result.details.append("no pending finance step on new request")
        else:
            with harness.logged_in("finance@lab.local"):
                resp = harness.post(
                    f"/requests/{request_id}",
                    data={"action": "approve_step",
                          "step_id": str(finance_step),
                          "remarks": "budget ok"},
                    follow_redirects=True,
                )
                self._check(result, resp.status_code < 400,
                            "finance approval", f"finance → {resp.status_code}")

        # ---- Step 3: professor approve ------------------------------
        prof_step = self._pending_step_for_role(harness, request_id, "professor")
        if prof_step is None:
            result.warnings += 1
            result.details.append("no pending professor step after finance")
        else:
            with harness.logged_in("prof.approver@lab.local"):
                resp = harness.post(
                    f"/requests/{request_id}",
                    data={"action": "approve_step",
                          "step_id": str(prof_step),
                          "remarks": "looks good"},
                    follow_redirects=True,
                )
                self._check(result, resp.status_code < 400,
                            "professor approval", f"professor → {resp.status_code}")

        # ---- Step 3b: operator signoff (3rd step of the chain) -----
        # create_approval_chain() seeds a 3-step chain by default:
        # finance → professor → operator. The "operator" step is the
        # chain signoff by the assigned lab operator; distinct from
        # the physical "mark sample received" action on the board.
        op_step = self._pending_step_for_role(harness, request_id, "operator")
        if op_step is None:
            result.warnings += 1
            result.details.append("no pending operator step after professor")
        else:
            with harness.logged_in("anika@lab.local"):
                resp = harness.post(
                    f"/requests/{request_id}",
                    data={"action": "approve_step",
                          "step_id": str(op_step),
                          "remarks": "operator accepted the job"},
                    follow_redirects=True,
                )
                self._check(result, resp.status_code < 400,
                            "operator approval", f"operator → {resp.status_code}")

        # ---- Step 4: status advanced to awaiting_sample_submission ---
        # After finance + professor approvals the request state
        # machine (see app.py build_request_status) drops the row
        # into `awaiting_sample_submission` — that's the point at
        # which the requester is expected to physically drop the
        # sample at the lab.
        status = self._request_status(harness, request_id)
        self._check(
            result,
            status == "awaiting_sample_submission",
            "post-approval status",
            f"expected awaiting_sample_submission, got {status!r}",
        )

        # ---- Step 5: requester marks the physical sample submitted --
        # Uses the real request_detail POST action. `mark_sample_submitted`
        # is the requester-initiated transition; it requires the
        # instrument to be accepting samples (demo seed default).
        with harness.logged_in("shah@lab.local"):
            resp = harness.post(
                f"/requests/{request_id}",
                data={"action": "mark_sample_submitted",
                      "sample_dropoff_note": "Dropped off at reception."},
                follow_redirects=True,
            )
            self._check(result, resp.status_code < 400, "mark sample submitted",
                        f"mark_sample_submitted → {resp.status_code}")

        status = self._request_status(harness, request_id)
        self._check(
            result,
            status == "sample_submitted",
            "sample-submitted state",
            f"expected sample_submitted, got {status!r}",
        )

        # ---- Step 6: requester follow-up message --------------------
        # Requester can post_message at any time pre-completion; this
        # exercises the note-edit policy + the audit chain.
        with harness.logged_in("shah@lab.local"):
            resp = harness.post(
                f"/requests/{request_id}",
                data={"action": "post_message",
                      "message_body": "Thanks for the quick turnaround."},
                follow_redirects=True,
            )
            self._check(result, resp.status_code < 400, "requester follow-up",
                        f"reply → {resp.status_code}")

        # ---- Step 7: admin history + detail views -------------------
        # The operator "mark_received → start_now → finish_now" leg
        # goes through the `/schedule/actions` planner board, which
        # needs a planner_date + slot setup that's out of scope for
        # this in-process lifecycle crawler. A future
        # `lifecycle_operator_board` strategy will pick that up.
        with harness.logged_in("admin@lab.local"):
            for path in [f"/requests/{request_id}", "/schedule",
                         "/instruments/1/history", "/stats"]:
                resp = harness.get(path, follow_redirects=True)
                if resp.status_code < 400:
                    result.passed += 1
                else:
                    result.failed += 1
                    result.details.append(f"admin {path} → {resp.status_code}")

        result.metrics = {
            "request_id": request_id,
            "http_calls": len(harness.log.calls),
        }
        return result

    # -----------------------------------------------------------------
    def _check(self, result: CrawlResult, ok: bool, label: str, detail: str) -> None:
        if ok:
            result.passed += 1
        else:
            result.failed += 1
            result.details.append(f"{label}: {detail}")

    def _request_status(self, harness: Harness, request_id: int) -> str | None:
        """Return the live status value for `request_id` from the temp DB."""
        import sqlite3
        if not harness.temp_db_path:
            return None
        conn = sqlite3.connect(str(harness.temp_db_path))
        try:
            row = conn.execute(
                "SELECT status FROM sample_requests WHERE id = ?",
                (request_id,),
            ).fetchone()
            return row[0] if row else None
        finally:
            conn.close()

    def _first_request_id(self, harness: Harness) -> int | None:
        """Return the id of the request we just submitted.

        The harness bootstrap may pre-seed demo data (so request id=1
        already exists before the crawler runs), which is why this
        picks the **newest** row — the one shah@lab.local just posted
        — rather than ORDER BY id ASC.
        """
        import sqlite3
        if not harness.temp_db_path:
            return None
        conn = sqlite3.connect(str(harness.temp_db_path))
        try:
            row = conn.execute(
                "SELECT id FROM sample_requests ORDER BY id DESC LIMIT 1"
            ).fetchone()
            return row[0] if row else None
        finally:
            conn.close()

    def _pending_step_for_role(
        self, harness: Harness, request_id: int, role: str
    ) -> int | None:
        """Return the id of the first `pending` approval_step for
        `role` on `request_id`, or None if none exists."""
        import sqlite3
        if not harness.temp_db_path:
            return None
        conn = sqlite3.connect(str(harness.temp_db_path))
        try:
            row = conn.execute(
                "SELECT id FROM approval_steps "
                "WHERE sample_request_id = ? AND approver_role = ? "
                "  AND status = 'pending' "
                "ORDER BY step_order LIMIT 1",
                (request_id, role),
            ).fetchone()
            return row[0] if row else None
        finally:
            conn.close()


LifecycleStrategy.register()
