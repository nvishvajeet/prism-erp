"""Visibility audit — role × page access matrix.

Aspect: visibility
Improves: catches routes that either leak to unauthorised roles
          (200 where 403 expected) or over-restrict authorised
          roles (403 where 200 expected). This is the MOST
          important crawler — treat failures as block-merge.

Ported from the legacy `test_visibility_audit.py` but trimmed to
the stable matrix every role relies on. To extend: add a row to
ACCESS_MATRIX and rerun.
"""
from __future__ import annotations

from ..base import CrawlerStrategy, CrawlResult
from ..harness import Harness, ROLE_PERSONAS

# True  = role should see 200 (or a 302 that lands on a 200)
# False = role should see 403
ACCESS_MATRIX: dict[str, dict[str, bool]] = {
    "/": {r: True for _, _, r in ROLE_PERSONAS},
    "/schedule": {r: True for _, _, r in ROLE_PERSONAS},
    "/calendar": {r: True for _, _, r in ROLE_PERSONAS},
    "/instruments": {r: True for _, _, r in ROLE_PERSONAS},
    "/stats": {r: True for _, _, r in ROLE_PERSONAS},
    "/visualizations": {r: True for _, _, r in ROLE_PERSONAS},
    "/requests/new": {r: True for _, _, r in ROLE_PERSONAS},
    "/me": {r: True for _, _, r in ROLE_PERSONAS},
    "/docs": {r: True for _, _, r in ROLE_PERSONAS},
    "/sitemap": {r: True for _, _, r in ROLE_PERSONAS},
    "/profile/change-password": {r: True for _, _, r in ROLE_PERSONAS},
    "/admin/users": {
        "super_admin": True,
        "site_admin": True,
        "instrument_admin": False,
        "faculty_in_charge": False,
        "operator": False,
        "professor_approver": False,
        "finance_admin": False,
        "requester": False,
    },
}


class VisibilityStrategy(CrawlerStrategy):
    """Verify every route × every role matches the ACCESS_MATRIX.

    A route-role cell passes iff the HTTP status aligns with the
    matrix entry:
      - expected True  → 2xx / 3xx → PASS
      - expected False → 403       → PASS
      - mismatch                   → FAIL
    """

    name = "visibility"
    aspect = "visibility"
    description = "Role × page access matrix (8 roles × ~12 pages)"

    def run(self, harness: Harness) -> CrawlResult:
        result = CrawlResult(name=self.name, aspect=self.aspect)
        role_to_email = {r: e for _, e, r in ROLE_PERSONAS}

        for path, role_map in ACCESS_MATRIX.items():
            for role, expected in role_map.items():
                email = role_to_email.get(role)
                if not email:
                    result.warnings += 1
                    result.details.append(f"no seed user for role {role!r}")
                    continue
                with harness.logged_in(email):
                    resp = harness.get(path, note=f"visibility:{role}",
                                       follow_redirects=True)
                status = resp.status_code
                ok_codes = {200, 201, 204, 301, 302, 303, 307, 308}
                got_access = status in ok_codes
                if got_access == expected:
                    result.passed += 1
                else:
                    result.failed += 1
                    verb = "leaked to" if status in ok_codes else "blocked for"
                    result.details.append(
                        f"{path} {verb} {role}: got {status}, "
                        f"expected {'200' if expected else '403'}"
                    )

        result.metrics = {
            "roles": len(role_to_email),
            "paths": len(ACCESS_MATRIX),
            "expected_checks": sum(len(m) for m in ACCESS_MATRIX.values()),
        }
        return result


VisibilityStrategy.register()
