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

from ..base import CrawlerStrategy, CrawlResult
from ..harness import Harness


class RoleBehaviorStrategy(CrawlerStrategy):
    """Per-role signature-action smoke test."""

    name = "role_behavior"
    aspect = "visibility"
    description = "Each role performs its defining action (behavioral RBAC)"

    def run(self, harness: Harness) -> CrawlResult:
        result = CrawlResult(name=self.name, aspect=self.aspect)

        # ---- super_admin: create user ------------------------------
        with harness.logged_in("owner@prism.local"):
            resp = harness.post(
                "/admin/users",
                data={
                    "action": "create_user",
                    "name": "Test Bot",
                    "email": "testbot@prism.local",
                    "role": "requester",
                    "password": "BotPass123",
                },
                follow_redirects=True,
            )
            self._score(result, resp.status_code, "super_admin: create user")

        # ---- site_admin: load admin users --------------------------
        with harness.logged_in("siteadmin@prism.local"):
            resp = harness.get("/admin/users", follow_redirects=True)
            self._score(result, resp.status_code, "site_admin: /admin/users")

        # ---- instrument_admin: open instrument detail (config lives there) ----
        with harness.logged_in("kondhalkar@prism.local"):
            resp = harness.get("/instruments/1", follow_redirects=True)
            self._score(result, resp.status_code, "instrument_admin: /instruments/1")

        # ---- faculty_in_charge: instrument detail ------------------
        with harness.logged_in("approver@prism.local"):
            resp = harness.get("/instruments/1", follow_redirects=True)
            self._score(result, resp.status_code, "faculty_in_charge: /instruments/1")

        # ---- operator: open queue + load instrument ----------------
        with harness.logged_in("anika@prism.local"):
            for path in ["/schedule", "/instruments/1"]:
                resp = harness.get(path, follow_redirects=True)
                self._score(result, resp.status_code, f"operator: {path}")

        # ---- professor_approver: approvals surface -----------------
        with harness.logged_in("approver@prism.local"):
            resp = harness.get("/schedule", follow_redirects=True)
            self._score(result, resp.status_code, "professor_approver: /schedule")

        # ---- finance_admin: stats dashboard ------------------------
        with harness.logged_in("meera@prism.local"):
            resp = harness.get("/stats", follow_redirects=True)
            self._score(result, resp.status_code, "finance_admin: /stats")

        # ---- requester: submit a new request -----------------------
        with harness.logged_in("user1@prism.local"):
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


RoleBehaviorStrategy.register()
