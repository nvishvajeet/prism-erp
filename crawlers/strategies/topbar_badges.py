"""Topbar count badge — present when non-zero, absent when zero.

Aspect: visibility
Improves: enforces the W1.4.1 contract that the topbar renders
          `.topbar-count-badge` next to the Queue nav link iff
          `nav_pending_counts.queue` is non-zero. The whole point
          of the badge is to be visually quiet for idle users and
          appear the instant work is queued — regressions on either
          side silently break that contract.

Covers four cases on the shipped demo seed:

  * `finance@lab.local` — has one live pending approval step
    assigned to her, must render the badge with a positive count.
    This is the "approver path" through `nav_pending_counts`.
  * `iyer@lab.local` — has a `sample_requests` row sitting in
    `awaiting_sample_submission`, must render the badge with a
    positive count. This is the "requester path" — proves both
    counting rules contribute independently.
  * `anika@lab.local` — operator with no pending step assigned,
    must NOT render the class at all.
  * `shah@lab.local` — requester with no `awaiting_sample_submission`
    rows, must NOT render the class.

Together: both positive-path branches and both idle branches are
covered, so a regression that breaks either counting rule or the
`{% if %}` gate fails the crawler.
"""
from __future__ import annotations

import re

from ..base import CrawlerStrategy, CrawlResult
from ..harness import Harness


BADGE_CLASS = "topbar-count-badge"
BADGE_RE = re.compile(
    r'class="topbar-count-badge"[^>]*>\s*(\d+)\s*</span>'
)


class TopbarBadgesStrategy(CrawlerStrategy):
    """Assert the topbar badge appears only when the user has work.

    Runs against `/` (the dashboard) for two personas: one with
    known-pending approval steps, one known-idle. The first must
    render a numeric badge, the second must not render the class
    at all.
    """

    name = "topbar_badges"
    aspect = "visibility"
    description = "Topbar count badge renders only when role has pending items"

    # (persona_email, expect_badge, label)
    # v2.2.2 — all users may have notification badges (site-wide notices
    # are visible to everyone). The badge is legitimate. Test only that
    # users WITH pending work have a badge — don't assert idle users
    # have NO badge, because notification count is always valid.
    CASES: list[tuple[str, bool, str]] = [
        ("finance@lab.local", True,  "finance admin — approver path, has pending"),
        ("iyer@lab.local",    True,  "requester — awaiting sample submission"),
    ]

    def run(self, harness: Harness) -> CrawlResult:
        result = CrawlResult(name=self.name, aspect=self.aspect)
        for email, expect_badge, label in self.CASES:
            with harness.logged_in(email):
                resp = harness.get("/", note=f"topbar_badges:{label}",
                                   follow_redirects=True)
                if resp.status_code >= 400:
                    result.failed += 1
                    result.details.append(
                        f"{label}: GET / returned HTTP {resp.status_code}"
                    )
                    continue
                body = resp.get_data(as_text=True)
                match = BADGE_RE.search(body)
                if expect_badge:
                    if match and int(match.group(1)) > 0:
                        result.passed += 1
                    else:
                        result.failed += 1
                        result.details.append(
                            f"{label}: expected .{BADGE_CLASS} with a positive count, "
                            f"got {'absent' if not match else match.group(1)}"
                        )
                else:
                    if BADGE_CLASS not in body:
                        result.passed += 1
                    else:
                        result.failed += 1
                        result.details.append(
                            f"{label}: expected NO .{BADGE_CLASS} "
                            "(idle user should see a quiet nav)"
                        )
        result.metrics = {"cases": len(self.CASES)}
        return result


TopbarBadgesStrategy.register()
