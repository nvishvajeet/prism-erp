"""AI action-queue end-to-end promotion crawler.

Aspect: data_integrity
Improves: protects the "AI-aware, role-gated, human-supervised" invariant
          in the AI action queue. Verifies that:
          1. POST /ai/ask with a classifiable prompt creates a row in
             ai_prospective_actions (not just ai_advisor_queue).
          2. The row is routed to a real human — never materialised
             directly from the AI submit path.
          3. A non-assignee cannot decide the action (gated by
             assigned_approver_id match).
          4. The assignee's approve click either advances the stage
             (two-stage routes) or materialises into the target table
             (single-stage or after stage 2).
          5. Reject without a note is refused; reject with a note
             flips status to 'rejected' and never touches the target
             table.

Any regression that makes AI auto-execute, or lets a non-assignee
approve, fails loudly here.
"""
from __future__ import annotations

import sqlite3

from ..base import CrawlerStrategy, CrawlResult
from ..harness import Harness


class AiActionPromotionStrategy(CrawlerStrategy):
    """End-to-end AI action-queue promotion test."""

    name = "ai_action_promotion"
    aspect = "data_integrity"
    description = "AI action queue: classify → route → approve → materialise"

    def run(self, harness: Harness) -> CrawlResult:
        result = CrawlResult(name=self.name, aspect=self.aspect)

        if not harness.temp_db_path:
            result.warnings += 1
            result.details.append("harness has no temp db; cannot assert")
            return result

        # Bail gracefully if the v3.1 schema hasn't landed on this DB.
        if not self._table_exists(harness, "ai_prospective_actions"):
            result.warnings += 1
            result.details.append(
                "ai_prospective_actions table missing — skipping (pre-v3.1 schema)"
            )
            return result

        # 1. Submit a classifiable prompt as requester.
        prompt = "Send this receipt attach it to the Camry as fuel expenses"
        with harness.logged_in("user1@catalyst.local"):
            resp = harness.post(
                "/ai/ask",
                data={"ai_prompt": prompt, "portal": "dashboard"},
                follow_redirects=True,
            )
            if resp.status_code >= 400:
                result.failed += 1
                result.details.append(f"/ai/ask submit → {resp.status_code}")
                return result
            result.passed += 1

        # 2. There must be exactly one new prospective-action row,
        #    classified to fuel_receipt or vehicle_expense, and routed
        #    to a real user (not NULL).
        rows = self._query_all(
            harness,
            "SELECT id, action_type, assigned_approver_id, approver_stage, status, "
            "materialised_table, materialised_row_id "
            "FROM ai_prospective_actions ORDER BY id DESC LIMIT 5",
        )
        if not rows:
            result.failed += 1
            result.details.append(
                "no row landed in ai_prospective_actions after /ai/ask submit — "
                "classifier or router is broken"
            )
            return result
        action = rows[0]
        action_id, action_type, approver_id, stage, status, mat_table, mat_id = action
        if action_type not in ("fuel_receipt", "vehicle_expense"):
            result.failed += 1
            result.details.append(
                f"classifier returned {action_type!r} for 'Camry fuel' prompt — "
                "expected fuel_receipt or vehicle_expense"
            )
            return result
        result.passed += 1
        if approver_id is None:
            result.failed += 1
            result.details.append(
                f"action #{action_id} has no assigned approver — routing/fallback broken"
            )
            return result
        result.passed += 1
        if status != "awaiting_review":
            result.failed += 1
            result.details.append(
                f"new action should be status=awaiting_review, got {status!r} — "
                "AI may have auto-materialised (violates pledge)"
            )
            return result
        if mat_row_filled := (mat_table or mat_id):
            result.failed += 1
            result.details.append(
                f"new action already materialised (table={mat_table!r} id={mat_id}) — "
                "AI wrote to real table without approval"
            )
            return result
        result.passed += 1

        # 3. A non-assignee cannot decide. Pick any user who isn't the
        #    assigned approver or the owner.
        non_assignee_email = self._pick_non_assignee(harness, approver_id)
        if non_assignee_email:
            with harness.logged_in(non_assignee_email):
                resp = harness.post(
                    f"/ai/action/{action_id}/decide",
                    data={"decision": "approve", "note": ""},
                    follow_redirects=True,
                )
            still_awaiting = self._query_one(
                harness,
                "SELECT status FROM ai_prospective_actions WHERE id = ?",
                (action_id,),
            )
            if still_awaiting and still_awaiting[0] == "awaiting_review":
                result.passed += 1
            else:
                result.failed += 1
                result.details.append(
                    f"non-assignee {non_assignee_email} was able to change "
                    f"status to {still_awaiting[0] if still_awaiting else '<gone>'}"
                )
                return result

        # 4. Reject without note must be refused.
        approver_email = self._email_for_user(harness, approver_id)
        if not approver_email:
            result.warnings += 1
            result.details.append(
                f"assigned approver id={approver_id} has no email — skipping decision arm"
            )
            return result
        with harness.logged_in(approver_email):
            harness.post(
                f"/ai/action/{action_id}/decide",
                data={"decision": "reject", "note": ""},
                follow_redirects=True,
            )
        status_now = self._query_one(
            harness,
            "SELECT status FROM ai_prospective_actions WHERE id = ?",
            (action_id,),
        )
        if status_now and status_now[0] == "awaiting_review":
            result.passed += 1
        else:
            result.failed += 1
            result.details.append(
                f"reject without note should be refused; status is now {status_now}"
            )
            return result

        # 5. Approve. Depending on the route, this either advances stage
        #    or materialises.
        with harness.logged_in(approver_email):
            harness.post(
                f"/ai/action/{action_id}/decide",
                data={"decision": "approve", "note": "verified receipt"},
                follow_redirects=True,
            )
        after = self._query_one(
            harness,
            "SELECT status, approver_stage, assigned_approver_id, materialised_table, "
            "materialised_row_id FROM ai_prospective_actions WHERE id = ?",
            (action_id,),
        )
        if not after:
            result.failed += 1
            result.details.append("action row disappeared after approve")
            return result
        new_status, new_stage, new_approver, mat_table, mat_id = after
        if new_status == "awaiting_review" and new_stage == "fin_admin":
            # Stage 1 of a two-stage route — good, advance and approve again.
            result.passed += 1
            fin_email = self._email_for_user(harness, new_approver)
            if not fin_email:
                result.warnings += 1
                result.details.append(
                    f"stage-2 approver id={new_approver} has no email; cannot complete"
                )
                return result
            with harness.logged_in(fin_email):
                harness.post(
                    f"/ai/action/{action_id}/decide",
                    data={"decision": "approve", "note": "released"},
                    follow_redirects=True,
                )
            final = self._query_one(
                harness,
                "SELECT status, materialised_table, materialised_row_id "
                "FROM ai_prospective_actions WHERE id = ?",
                (action_id,),
            )
            if not final or final[0] != "approved":
                result.failed += 1
                result.details.append(
                    f"stage-2 approve did not set status=approved; got {final}"
                )
                return result
            mat_table = final[1]
            mat_id = final[2]
        elif new_status != "approved":
            result.failed += 1
            result.details.append(
                f"single-stage approve should set status=approved, got {new_status}"
            )
            return result

        # 6. Materialisation check — expense_receipts should have gained
        #    a row if the target table is wired.
        if mat_table == "expense_receipts" and mat_id:
            row = self._query_one(
                harness,
                "SELECT id, submitted_by_user_id, status FROM expense_receipts WHERE id = ?",
                (mat_id,),
            )
            if row:
                result.passed += 1
            else:
                result.failed += 1
                result.details.append(
                    f"expense_receipts row #{mat_id} missing despite being linked"
                )
                return result
        else:
            # Unwired target — approved but no materialised row is acceptable.
            result.warnings += 1
            result.details.append(
                f"approved action target={mat_table!r} has no materialiser yet "
                "(acceptable, but fewer module materialisers means more manual follow-up)"
            )

        return result

    # -----------------------------------------------------------------
    def _table_exists(self, harness: Harness, name: str) -> bool:
        conn = sqlite3.connect(str(harness.temp_db_path))
        try:
            row = conn.execute(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
                (name,),
            ).fetchone()
            return bool(row)
        finally:
            conn.close()

    def _query_all(self, harness: Harness, sql: str, params: tuple = ()) -> list[tuple]:
        conn = sqlite3.connect(str(harness.temp_db_path))
        try:
            return conn.execute(sql, params).fetchall()
        finally:
            conn.close()

    def _query_one(self, harness: Harness, sql: str, params: tuple = ()) -> tuple | None:
        conn = sqlite3.connect(str(harness.temp_db_path))
        try:
            return conn.execute(sql, params).fetchone()
        finally:
            conn.close()

    def _email_for_user(self, harness: Harness, user_id: int | None) -> str | None:
        if user_id is None:
            return None
        row = self._query_one(
            harness,
            "SELECT email FROM users WHERE id = ?",
            (user_id,),
        )
        return row[0] if row else None

    def _pick_non_assignee(self, harness: Harness, assigned_id: int | None) -> str | None:
        """Pick a persona email that is neither the assignee nor an owner."""
        from ..harness import ROLE_PERSONAS
        assigned_email = self._email_for_user(harness, assigned_id)
        for _, email, role in ROLE_PERSONAS:
            if email == assigned_email:
                continue
            if role in ("super_admin", "site_admin"):
                continue  # owner / site_admin bypass everything
            return email
        return None


AiActionPromotionStrategy.register()
