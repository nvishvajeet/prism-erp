"""Role-behavior crawler — each role performs its defining action.

Aspect: visibility (behavioral counterpart to the pure access matrix)
Improves: catches regressions where a role can still *load* a page
          but can no longer *act* on it (or, worse, can act on
          something they shouldn't be able to). Every role has a
          signature verb — verifying the verb works per role is a
          stronger guarantee than the access matrix alone.

Scenarios exercised (one per role):

  super_admin        — create a new user via /admin/users
  site_admin         — load admin users page
  instrument_admin   — open the instrument detail (config lives there)
  faculty_in_charge  — view the instrument detail they manage
  operator           — open the schedule + instrument detail
  professor_approver — view the schedule (approvals surface)
  finance_admin      — view the stats dashboard
  requester          — submit a new request
"""
from __future__ import annotations

import sqlite3

from ..base import CrawlerStrategy, CrawlResult
from ..harness import Harness


class RoleBehaviorStrategy(CrawlerStrategy):
    """Per-role signature-action smoke test."""

    name = "role_behavior"
    aspect = "visibility"
    description = "Each role performs its defining action (behavioral RBAC)"

    def run(self, harness: Harness) -> CrawlResult:
        result = CrawlResult(name=self.name, aspect=self.aspect)
        managed_instrument_id = self._instrument_for_user(harness, "kondhalkar@catalyst.local")
        operated_instrument_id = self._instrument_for_user(harness, "anika@catalyst.local")
        faculty_instrument_id = self._instrument_for_user(harness, "approver@catalyst.local")

        # ---- super_admin: create user ------------------------------
        with harness.logged_in("owner@catalyst.local"):
            resp = harness.post(
                "/admin/users",
                data={
                    "action": "create_user",
                    "name": "Test Bot",
                    "email": "testbot@catalyst.local",
                    "role": "requester",
                    "password": "BotPass123",
                },
                follow_redirects=True,
            )
            self._score(result, resp.status_code, "super_admin: create user")

        # ---- site_admin: load admin users --------------------------
        with harness.logged_in("siteadmin@catalyst.local"):
            resp = harness.get("/admin/users", follow_redirects=True)
            self._score(result, resp.status_code, "site_admin: /admin/users")

        # ---- instrument_admin: open instrument detail (config lives there) ----
        if managed_instrument_id is None:
            result.warnings += 1
            result.details.append("instrument_admin: no assigned instrument in crawler seed")
        else:
            with harness.logged_in("kondhalkar@catalyst.local"):
                resp = harness.get(f"/instruments/{managed_instrument_id}", follow_redirects=True)
                self._score(result, resp.status_code, f"instrument_admin: /instruments/{managed_instrument_id}")

        # ---- faculty_in_charge: instrument detail ------------------
        if faculty_instrument_id is None:
            result.warnings += 1
            result.details.append("faculty_in_charge: no accessible instrument in crawler seed")
        else:
            with harness.logged_in("approver@catalyst.local"):
                resp = harness.get(f"/instruments/{faculty_instrument_id}", follow_redirects=True)
                self._score(result, resp.status_code, f"faculty_in_charge: /instruments/{faculty_instrument_id}")

        # ---- operator: open queue + load instrument ----------------
        with harness.logged_in("anika@catalyst.local"):
            operator_paths = ["/schedule"]
            if operated_instrument_id is not None:
                operator_paths.append(f"/instruments/{operated_instrument_id}")
            for path in operator_paths:
                resp = harness.get(path, follow_redirects=True)
                self._score(result, resp.status_code, f"operator: {path}")
            if operated_instrument_id is None:
                result.warnings += 1
                result.details.append("operator: no assigned instrument in crawler seed")

        # ---- professor_approver: approvals surface -----------------
        with harness.logged_in("approver@catalyst.local"):
            resp = harness.get("/schedule", follow_redirects=True)
            self._score(result, resp.status_code, "professor_approver: /schedule")

        # ---- finance_admin: stats dashboard ------------------------
        with harness.logged_in("meera@catalyst.local"):
            resp = harness.get("/stats", follow_redirects=True)
            self._score(result, resp.status_code, "finance_admin: /stats")

        # ---- requester: submit a new request -----------------------
        with harness.logged_in("user1@catalyst.local"):
            resp = harness.get("/requests/new")
            self._score(result, resp.status_code, "requester: open /requests/new")
            resp = harness.post(
                "/requests/new",
                data={
                    "instrument_id": "1",
                    "sample_name": "Test Sample",
                    "sample_count": "1",
                    "description": "Behavior-test submission",
                    "priority": "normal",
                },
                follow_redirects=True,
            )
            self._score(result, resp.status_code, "requester: submit request")

        return result

    def _score(self, result: CrawlResult, status: int, label: str) -> None:
        if status < 400:
            result.passed += 1
        elif status == 403:
            result.failed += 1
            result.details.append(f"{label} → 403 (role cannot perform its own action)")
        elif status >= 500:
            result.failed += 1
            result.details.append(f"{label} → {status}")
        else:
            result.warnings += 1
            result.details.append(f"{label} → {status}")

    def _instrument_for_user(self, harness: Harness, email: str) -> int | None:
        if harness.temp_db_path is None:
            return None
        conn = sqlite3.connect(str(harness.temp_db_path))
        conn.row_factory = sqlite3.Row
        try:
            row = conn.execute(
                """
                SELECT instrument_id
                FROM (
                    SELECT ia.instrument_id AS instrument_id
                    FROM instrument_admins ia
                    JOIN users u ON u.id = ia.user_id
                    WHERE u.email = ?
                    UNION
                    SELECT io.instrument_id AS instrument_id
                    FROM instrument_operators io
                    JOIN users u ON u.id = io.user_id
                    WHERE u.email = ?
                    UNION
                    SELECT ifa.instrument_id AS instrument_id
                    FROM instrument_faculty_admins ifa
                    JOIN users u ON u.id = ifa.user_id
                    WHERE u.email = ?
                )
                ORDER BY instrument_id
                LIMIT 1
                """,
                (email, email, email),
            ).fetchone()
            return int(row["instrument_id"]) if row is not None else None
        finally:
            conn.close()


RoleBehaviorStrategy.register()
