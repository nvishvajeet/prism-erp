"""Role-landing audit — every role lands on a dashboard with a role hint.

Aspect: visibility
Improves: enforces that the dashboard and sitemap render the
          `role-hint-badge` orientation marker for every logged-in
          role. This is the skeleton's "you are here" contract —
          removing the hint from any role's dashboard silently
          breaks onboarding, so the crawler fails hard.

The strategy logs in as each persona in ROLE_PERSONAS, hits `/` and
`/sitemap`, and asserts that the rendered HTML contains:

  1. `role-hint-badge` — the CSS class of the badge chip
  2. The role's human-readable display name from ROLE_DISPLAY_NAMES

Any missing marker is a FAIL. Any unexpected 4xx/5xx is a FAIL.
"""
from __future__ import annotations

from ..base import CrawlerStrategy, CrawlResult
from ..harness import Harness, ROLE_PERSONAS


# Mirror of app.ROLE_DISPLAY_NAMES — kept in sync by hand so the
# crawler has zero runtime coupling to app.py.
ROLE_DISPLAY_NAMES: dict[str, str] = {
    "super_admin": "Facility Owner",
    "site_admin": "Site Admin",
    "instrument_admin": "Instrument Admin",
    "faculty_in_charge": "Faculty in Charge",
    "operator": "Operator",
    "professor_approver": "Professor Approver",
    "finance_admin": "Finance Admin",
    "requester": "Lab Member",
}

LANDING_PATHS = ("/", "/sitemap")


class RoleLandingStrategy(CrawlerStrategy):
    """Every role sees its own role-hint badge on /  and /sitemap.

    The badge is the skeleton's orientation anchor — losing it
    silently leaves new users with no "you are here" signal.
    """

    name = "role_landing"
    aspect = "visibility"
    description = "Role-hint badge present on dashboard + sitemap for every role"

    def run(self, harness: Harness) -> CrawlResult:
        result = CrawlResult(name=self.name, aspect=self.aspect)

        for _, email, role in ROLE_PERSONAS:
            display = ROLE_DISPLAY_NAMES.get(role)
            if not display:
                result.warnings += 1
                result.details.append(f"no display-name mapping for role {role!r}")
                continue

            with harness.logged_in(email):
                for path in LANDING_PATHS:
                    resp = harness.get(path, note=f"role_landing:{role}",
                                       follow_redirects=True)
                    if resp.status_code >= 400:
                        result.failed += 1
                        result.details.append(
                            f"{path} as {role}: HTTP {resp.status_code}"
                        )
                        continue
                    body = resp.get_data(as_text=True)
                    missing = []
                    if "role-hint-badge" not in body:
                        missing.append("role-hint-badge class")
                    if display not in body:
                        missing.append(f"display name {display!r}")
                    if missing:
                        result.failed += 1
                        result.details.append(
                            f"{path} as {role}: missing " + ", ".join(missing)
                        )
                    else:
                        result.passed += 1

        result.metrics = {
            "roles": len(ROLE_PERSONAS),
            "paths": len(LANDING_PATHS),
            "expected_checks": len(ROLE_PERSONAS) * len(LANDING_PATHS),
        }
        return result


RoleLandingStrategy.register()
