"""Empty-state warmth — every empty table renders the shared card.

Aspect: visibility
Improves: enforces the W1.4.1 c2 contract that the `.empty-state`
          macro (not a bare "No records" <td>) shows up on every
          big table when there's nothing to list — AND that the
          card carries a primary call-to-action (`.empty-state-action`)
          so the empty page is welcoming rather than dead.

Runs against a fresh seeded DB with all sample requests wiped.
For each (persona, path) in CASES, GETs the page and asserts:

  1. `empty-state` class is present (the card rendered)
  2. `empty-state-action` class is present (a primary CTA link
     was passed to the macro — not the bare two-argument form)

Any regression that either drops the macro call back to a plain
"No data" stub or forgets to pass action_label/action_href fails.

This is a behavior test that needs real DB mutations, so it runs
after a local wipe rather than against the default seed. The wipe
is done against the harness's temp DB and has no effect outside
the strategy.
"""
from __future__ import annotations

from ..base import CrawlerStrategy, CrawlResult
from ..harness import Harness


# (persona_email, path, label)
CASES: list[tuple[str, str, str]] = [
    ("anika@prism.local", "/schedule",  "operator — queue empty"),
    ("owner@prism.local", "/",          "owner dashboard — per-instrument queues empty"),
]


class EmptyStatesStrategy(CrawlerStrategy):
    """Empty-state card + primary CTA on the big tables."""

    name = "empty_states"
    aspect = "visibility"
    description = "Empty tables render the shared empty-state card with a primary CTA"

    def run(self, harness: Harness) -> CrawlResult:
        result = CrawlResult(name=self.name, aspect=self.aspect)

        # Wipe the tables so every page under test is empty. The harness
        # already booted on a temp DB, so this is scoped to this run.
        with harness.flask_app.app_context():
            from app import get_db
            db = get_db()
            db.execute("DELETE FROM approval_steps")
            db.execute("DELETE FROM request_messages")
            db.execute("DELETE FROM sample_requests")
            db.commit()

        for email, path, label in CASES:
            with harness.logged_in(email):
                resp = harness.get(path, note=f"empty_states:{label}",
                                   follow_redirects=True)
                if resp.status_code >= 400:
                    result.failed += 1
                    result.details.append(
                        f"{label}: GET {path} → HTTP {resp.status_code}"
                    )
                    continue
                body = resp.get_data(as_text=True)
                missing = []
                if "empty-state" not in body:
                    missing.append(".empty-state class")
                if "empty-state-action" not in body:
                    missing.append(".empty-state-action (primary CTA)")
                if missing:
                    result.failed += 1
                    result.details.append(
                        f"{label}: {path} missing " + ", ".join(missing)
                    )
                else:
                    result.passed += 1

        result.metrics = {"cases": len(CASES)}
        return result


EmptyStatesStrategy.register()
