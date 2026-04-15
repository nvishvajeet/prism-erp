"""CSRF token presence crawler — every POST form carries csrf_token().

Aspect: regression

Improves: prevents the "new form added, forgot CSRF, silently 400s in
          prod" class of bug. Flask-WTF / custom CSRF middleware rejects
          any POST without a matching token, but a dev's browser tab is
          usually already authenticated so the token cookie exists and
          the error surfaces only for other users. Easy to ship a broken
          form by accident.

How it works:
  1. Walk `templates/**/*.html`.
  2. Find every `<form ...>` opening tag (regex, since Jinja blocks
     never introduce hostile quoting inside `<form>` attributes in
     this codebase).
  3. Determine method — default is GET in HTML spec, only POST forms
     require CSRF. Method can be attribute-quoted (`method="post"`),
     lowercase/uppercase/mixed, or set via Jinja expression
     (`method="{{ 'post' if ... else 'get' }}"`) — in the last case we
     conservatively require the token.
  4. Read the form's inner text up to the matching `</form>` and look
     for `{{ csrf_token() }}` (the codebase's exactly-one idiom).
  5. WARN for each POST form missing the token, with file + line.

Limitations:
  - Static scan: a form whose method is set dynamically via JS is out
    of scope (negligible in this codebase).
  - Assumes non-nested forms (HTML spec forbids nesting anyway).
  - Jinja macros that expand into a form tag are not followed; if the
    macro itself renders the token, the callsite passes. If the macro
    expects the caller to supply it, the callsite fails here — which
    is actually the correct outcome because the macro shouldn't expect
    that from callers.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import NamedTuple

from ..base import CrawlerStrategy, CrawlResult
from ..harness import Harness


# Match a <form ...> opening tag. Captures the attribute block so we
# can test for method. Non-greedy up to the first `>` so we don't span
# across a sibling element by accident.
FORM_OPEN_RE = re.compile(r"<form\b([^>]*)>", re.IGNORECASE)

# Method attribute: method="post" / method='post' / method=post — and
# tolerant of Jinja inside the value, e.g. method="{{ m }}".
METHOD_ATTR_RE = re.compile(
    r"""method\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))""",
    re.IGNORECASE,
)

# The idiomatic CSRF injection. We also accept the literal hidden
# input form in case a macro expands to it.
CSRF_PATTERNS = (
    re.compile(r"{{\s*csrf_token\s*\(\s*\)\s*}}"),
    re.compile(r"name\s*=\s*['\"]csrf_token['\"]", re.IGNORECASE),
)

# Templates that are known-OK to lack CSRF — e.g. pure macro files
# that don't themselves render forms but are `from`-imported by pages.
ALLOWLIST_FILES: tuple[str, ...] = (
    # None today; add if a false-positive macro pattern appears.
)


class FormSite(NamedTuple):
    file: str
    line_no: int
    method: str


def _line_of(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def _find_form_close(text: str, start: int) -> int:
    """Return offset of `</form>` after `start`, or -1 if not found.

    Case-insensitive; tolerates whitespace inside the closing tag.
    """
    m = re.search(r"</form\s*>", text[start:], re.IGNORECASE)
    return start + m.start() if m else -1


def _looks_like_post(attrs: str) -> bool:
    """Return True if the <form> attributes imply a POST (or unknown)."""
    m = METHOD_ATTR_RE.search(attrs)
    if not m:
        # HTML default is GET; no method means GET.
        return False
    value = (m.group(1) or m.group(2) or m.group(3) or "").strip()
    # Dynamic Jinja value — conservative: require token.
    if "{{" in value or "{%" in value:
        return True
    return value.lower() == "post"


def _form_has_csrf(inner: str) -> bool:
    return any(p.search(inner) for p in CSRF_PATTERNS)


class CSRFTokenPresentStrategy(CrawlerStrategy):
    """Ensure every POST <form> carries a csrf_token() call."""

    name = "csrf_token_present"
    aspect = "regression"
    description = (
        "Every <form method=post> in templates/ includes {{ csrf_token() }}"
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

        total_forms = 0
        post_forms = 0
        missing: list[FormSite] = []

        for html_path in sorted(templates_dir.rglob("*.html")):
            rel = str(html_path.relative_to(root))
            if rel in ALLOWLIST_FILES:
                continue
            text = html_path.read_text(encoding="utf-8", errors="ignore")
            for m in FORM_OPEN_RE.finditer(text):
                total_forms += 1
                attrs = m.group(1)
                if not _looks_like_post(attrs):
                    continue
                post_forms += 1
                close = _find_form_close(text, m.end())
                if close == -1:
                    # Malformed template or the </form> is in an
                    # `{% include %}`d partial. Flag it — we can't see
                    # the token from here.
                    missing.append(FormSite(
                        file=rel,
                        line_no=_line_of(text, m.start()),
                        method="post",
                    ))
                    continue
                inner = text[m.end():close]
                if not _form_has_csrf(inner):
                    missing.append(FormSite(
                        file=rel,
                        line_no=_line_of(text, m.start()),
                        method="post",
                    ))

        result.passed = post_forms - len(missing)
        result.warnings = len(missing)
        for site in missing:
            result.details.append(
                f"POST form missing csrf_token at {site.file}:{site.line_no}"
            )

        result.metrics = {
            "total_forms": total_forms,
            "post_forms": post_forms,
            "missing_csrf": len(missing),
        }
        return result


CSRFTokenPresentStrategy.register()
