"""Duplicate id= crawler — no two elements in one template share an id.

Aspect: regression

Improves: catches the silent "two elements with id='foo' in the
          same rendered page" bug. HTML5 says ids must be unique
          per document. Browsers do not warn — they just return
          the first match to `document.getElementById('foo')`, so
          the second element's click handler, `<label for>` link,
          or `aria-labelledby` pointer silently targets the wrong
          thing. Painful to debug after the fact.

How it works:
  1. Walk `templates/**/*.html`.
  2. Extract every literal `id="..."` / `id='...'` attribute.
     Skip ids that contain Jinja expressions (`id="foo_{{ loop.index }}"`)
     — those are dynamic per-iteration and do not collide at render.
  3. Skip ids that fall inside an `{% if ... %}{% else %}{% endif %}`
     block where the same id appears in both branches (only one
     renders). This is a conservative branch-mutual-exclusion
     check: we only suppress when the two occurrences are separated
     by exactly one `{% else %}` within one `{% if %}`.
  4. WARN for every remaining same-file duplicate, with file +
     both line numbers.

Why WARN not FAIL:
  Some duplicates are live bugs; others are cosmetic (two hidden
  form inputs with the same name). Starting as WARN lets us clear
  the real bugs first, then promote to FAIL once the count is 0.

Limitations:
  - Single-template scope. An id rendered by a macro included in
    two tiles of the same page is not caught (would need a whole-
    page render). In practice, duplicate-within-file is where
    this bug shows up most often.
  - Jinja-dynamic ids (`id="row_{{ r.id }}"`) are correctly
    ignored.
  - Nested `{% if %}` blocks with duplicate ids at deeper levels
    fall back to "reported" — false positives there can be
    allowlisted.
"""
from __future__ import annotations

import re
from collections import defaultdict
from pathlib import Path
from typing import NamedTuple

from ..base import CrawlerStrategy, CrawlResult
from ..harness import Harness


# id="foo" / id='foo' — captures literal-only ids. Dynamic ids
# containing Jinja ({{ ... }} or {% ... %}) are excluded by the
# character class in the value group.
ID_ATTR_RE = re.compile(
    r"""\bid\s*=\s*(?P<q>["'])(?P<val>[^"'{}]+?)(?P=q)""",
)

# {% if ... %}{% else %}{% endif %} — used for mutex-branch
# suppression. Non-greedy and DOTALL so a single-line if/else
# or a multi-line one both match.
IF_ELSE_ENDIF_RE = re.compile(
    r"{%\s*if\b.*?%}.*?{%\s*else\s*%}.*?{%\s*endif\s*%}",
    re.DOTALL,
)


class IdSite(NamedTuple):
    file: str
    line_no: int
    id_value: str


def _line_of(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def _offsets_in_mutex_branches(text: str) -> set[tuple[int, int]]:
    """Return pairs of (offset_a, offset_b) known to be in mutex if/else branches.

    Any two id= matches whose offsets map to opposite sides of the
    same `{% else %}` inside a single `{% if %}...{% endif %}` are
    considered mutually exclusive and should not count as a
    duplicate. We return the *set of pairs* so the caller can skip
    them on equality lookup.
    """
    mutex_pairs: set[tuple[int, int]] = set()
    for if_block in IF_ELSE_ENDIF_RE.finditer(text):
        block = if_block.group(0)
        # Find the `{% else %}` split inside this one block.
        else_match = re.search(r"{%\s*else\s*%}", block)
        if not else_match:
            continue
        split_offset = if_block.start() + else_match.start()

        left_ids: list[int] = []
        right_ids: list[int] = []
        for m in ID_ATTR_RE.finditer(text, if_block.start(), if_block.end()):
            if m.start() < split_offset:
                left_ids.append(m.start())
            else:
                right_ids.append(m.start())

        for l in left_ids:
            for r in right_ids:
                mutex_pairs.add((l, r))
                mutex_pairs.add((r, l))
    return mutex_pairs


class DuplicateIdInTemplateStrategy(CrawlerStrategy):
    """No two elements in one template share an id."""

    name = "duplicate_id_in_template"
    aspect = "regression"
    description = (
        "Every literal id= attribute is unique within its template file"
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

        total_ids = 0
        dup_count = 0

        for html_path in sorted(templates_dir.rglob("*.html")):
            rel = str(html_path.relative_to(root))
            text = html_path.read_text(encoding="utf-8", errors="ignore")

            # Collect (offset, id_value) for every literal id attr.
            sites: list[tuple[int, str]] = []
            for m in ID_ATTR_RE.finditer(text):
                sites.append((m.start(), m.group("val")))
            total_ids += len(sites)

            # Group by id value.
            by_value: dict[str, list[int]] = defaultdict(list)
            for offset, val in sites:
                by_value[val].append(offset)

            mutex = _offsets_in_mutex_branches(text)

            for val, offsets in by_value.items():
                if len(offsets) < 2:
                    continue
                # Report the pair only if NONE of the pairs are mutex.
                bad = False
                for i in range(len(offsets)):
                    for j in range(i + 1, len(offsets)):
                        if (offsets[i], offsets[j]) not in mutex:
                            bad = True
                            break
                    if bad:
                        break
                if not bad:
                    continue

                lines = sorted({_line_of(text, o) for o in offsets})
                dup_count += 1
                result.details.append(
                    f"duplicate id={val!r} at {rel}:{','.join(str(l) for l in lines)}"
                )

        result.passed = total_ids - dup_count
        result.warnings = dup_count

        result.metrics = {
            "templates_scanned": sum(1 for _ in templates_dir.rglob("*.html")),
            "total_ids": total_ids,
            "duplicate_id_groups": dup_count,
        }
        return result


DuplicateIdInTemplateStrategy.register()
