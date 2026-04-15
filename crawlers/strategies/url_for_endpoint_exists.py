"""url_for endpoint existence crawler — every `url_for('x')` in
templates resolves to a registered Flask endpoint.

Aspect: regression

Improves: prevents the "renamed/deleted a route, forgot one
          template, now it 500s on click" class of bug. Flask
          raises `werkzeug.routing.exceptions.BuildError` at
          request time when `url_for` is called with an unknown
          endpoint — there is no static check in Flask itself.
          A broken `url_for` on a rarely-visited page is easy to
          ship and hard to notice until a user clicks it.

How it works:
  1. Boot the Flask app via the harness and harvest every
     endpoint name from `app.url_map`.
  2. Walk `templates/**/*.html`. For each `url_for('name')` or
     `url_for("name")` call, check that `name` is a registered
     endpoint. Positional-arg only — `url_for(variable)` is
     skipped silently (dynamic).
  3. FAIL for each template callsite pointing at an unknown
     endpoint, with `file:line` and the offending name.

Why this is a FAIL not a WARN:
  A stale `url_for` in a template renders as a 500. That's a
  production break, not a stylistic warn — the sanity gate
  should refuse the push, same as a broken CSRF token.

Limitations:
  - Only templates/. Python callsites like
    `redirect(url_for('foo'))` are not scanned here (they tend
    to surface faster during testing). Could extend to app.py
    if we ever regress on that path.
  - Dynamic `url_for(variable)` is ignored — no way to resolve
    statically.
  - Jinja `url_for(...)` in a `{% ... %}` block is caught via
    the same regex (the opening `url_for(` is the only signal
    we need).
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import NamedTuple

from ..base import CrawlerStrategy, CrawlResult
from ..harness import Harness


# url_for('endpoint_name', ...) or url_for("endpoint_name", ...)
# Captures the first string-literal positional arg. If the first
# arg is a variable (not quoted), no match is produced — that's
# fine, we skip dynamic endpoints silently.
URL_FOR_RE = re.compile(
    r"""url_for\s*\(\s*(?P<q>["'])(?P<ep>[^"']+)(?P=q)""",
)


class CallSite(NamedTuple):
    file: str
    line_no: int
    endpoint: str


def _line_of(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


class UrlForEndpointExistsStrategy(CrawlerStrategy):
    """Every url_for('name') in templates resolves to a real route."""

    name = "url_for_endpoint_exists"
    aspect = "regression"
    description = (
        "Every url_for('endpoint') in templates/ resolves to a registered Flask route"
    )
    needs_seed = False

    def run(self, harness: Harness) -> CrawlResult:
        result = CrawlResult(name=self.name, aspect=self.aspect)
        root = Path(__file__).resolve().parents[2]
        templates_dir = root / "templates"

        if not templates_dir.exists():
            result.failed += 1
            result.details.append(f"{templates_dir} not found")
            return result

        # Harvest registered endpoints from the live app.
        with harness.flask_app.app_context():
            registered: set[str] = {
                rule.endpoint for rule in harness.flask_app.url_map.iter_rules()
            }

        total_calls = 0
        broken: list[CallSite] = []

        for html_path in sorted(templates_dir.rglob("*.html")):
            rel = str(html_path.relative_to(root))
            text = html_path.read_text(encoding="utf-8", errors="ignore")
            for m in URL_FOR_RE.finditer(text):
                total_calls += 1
                ep = m.group("ep")
                if ep not in registered:
                    broken.append(CallSite(
                        file=rel,
                        line_no=_line_of(text, m.start()),
                        endpoint=ep,
                    ))

        result.passed = total_calls - len(broken)
        result.failed = len(broken)
        for site in broken:
            result.details.append(
                f"unknown endpoint {site.endpoint!r} at {site.file}:{site.line_no}"
            )

        result.metrics = {
            "templates_scanned": sum(1 for _ in templates_dir.rglob("*.html")),
            "url_for_calls": total_calls,
            "registered_endpoints": len(registered),
            "broken_calls": len(broken),
        }
        return result


UrlForEndpointExistsStrategy.register()
