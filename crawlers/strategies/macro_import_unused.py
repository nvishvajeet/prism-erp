"""Macro-import-unused crawler — every {% from import a, b, c %} name is actually used.

Aspect: css_hygiene

Improves: catches dead macro imports. When a template imports
          macros from `_page_macros.html` and later loses its last
          callsite (refactor, UI shuffle), the `{% from ... import %}`
          line lingers as a false positive "we use this macro here".
          Unused imports also confuse refactors — you grep for
          `card_heading` across templates to see where it's called
          and get hits on pages that don't actually use it.

How it works:
  1. Walk `templates/**/*.html`.
  2. For each template, parse every `{% from "..." import a, b as c, d %}`
     statement. Collect the local binding names (after `as`, or the
     original name if no alias).
  3. Search the template body (everything after the import line)
     for each local name as a whole-word Jinja token:
        - `{{ name(...) }}`
        - `{% call name(...) %}`
        - `{% set x = name(...) %}`
        - Any `name(` within a `{{ ... }}` or `{% ... %}` block
  4. If a local binding appears ZERO times in the body, flag it.

  We allow the macro to be used in an alternate form (e.g. passed
  to another macro) because the simple grep for `name(` covers
  both direct calls and forwarding.

Why WARN not FAIL:
  A macro import is a cheap mistake, not a broken page. Starting
  as WARN and treating a clean baseline as a permanent target is
  the standard rhythm.

Limitations:
  - Conservative whole-word match on `name(` — a macro used only
    via string indirection (`macros[name]()`) is flagged. None of
    our templates do that.
  - Include-scope is resolved transitively from the same template
    root. `{% include %}` inherits the parent's imported macros
    in Jinja, so we search every included partial's body (and
    their includes) before declaring an import unused.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import NamedTuple

from ..base import CrawlerStrategy, CrawlResult
from ..harness import Harness


# {% from "..._macros.html" import a, b as c, d %}
# Captures the import-list text; we split it in Python.
FROM_IMPORT_RE = re.compile(
    r"""{%\s*from\s+["'][^"']+["']\s+import\s+(?P<list>[^%]+?)\s*(?:with\s+context\s*)?%}""",
    re.IGNORECASE,
)

# One import item: "name" or "name as alias". Whitespace-tolerant.
IMPORT_ITEM_RE = re.compile(
    r"""(?P<orig>[A-Za-z_][A-Za-z0-9_]*)\s*(?:as\s+(?P<alias>[A-Za-z_][A-Za-z0-9_]*))?""",
)

# {% include "some/partial.html" %} — Jinja passes the parent scope
# (including `{% from ... import %}` macros) into the include, so
# the included partial's body counts as "usage territory" for
# the parent's imports.
INCLUDE_RE = re.compile(
    r"""{%\s*include\s+["'](?P<path>[^"']+)["'][^%]*%}""",
    re.IGNORECASE,
)


class UnusedImport(NamedTuple):
    file: str
    line_no: int
    name: str


def _line_of(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def _is_referenced(body: str, name: str) -> bool:
    """True if `name(` appears in body as a whole-word token."""
    # Word boundary + literal `(` — fastest and accurate for our
    # call conventions (direct call, call block, set assignment).
    pattern = re.compile(rf"\b{re.escape(name)}\s*\(")
    return bool(pattern.search(body))


class MacroImportUnusedStrategy(CrawlerStrategy):
    """Every {% from import name %} is actually called in the template body."""

    name = "macro_import_unused"
    aspect = "css_hygiene"
    description = (
        "Every {% from ... import name %} is actually used in the template body"
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

        total_imports = 0
        unused: list[UnusedImport] = []

        # Cache file reads so transitive-include resolution is cheap.
        file_cache: dict[Path, str] = {}

        def read_template(p: Path) -> str:
            if p not in file_cache:
                try:
                    file_cache[p] = p.read_text(encoding="utf-8", errors="ignore")
                except OSError:
                    file_cache[p] = ""
            return file_cache[p]

        def transitive_include_bodies(start: Path, body: str, seen: set[Path]) -> str:
            """Concatenate body + every file it transitively includes.

            Jinja's `{% include %}` passes the parent scope (imported
            macros included) down into the partial. So a macro imported
            at the parent counts as used if it's called anywhere in
            the transitively-included tree.
            """
            parts = [body]
            for im in INCLUDE_RE.finditer(body):
                inc_rel = im.group("path")
                inc_path = (templates_dir / inc_rel).resolve()
                if inc_path in seen or not inc_path.exists():
                    continue
                seen.add(inc_path)
                inc_body = read_template(inc_path)
                parts.append(transitive_include_bodies(inc_path, inc_body, seen))
            return "\n".join(parts)

        for html_path in sorted(templates_dir.rglob("*.html")):
            rel = str(html_path.relative_to(root))
            text = read_template(html_path)

            for m in FROM_IMPORT_RE.finditer(text):
                body_start = m.end()
                body = text[body_start:]
                # Expand the search surface to include every
                # transitively-included partial (Jinja scope rule).
                body = transitive_include_bodies(
                    html_path, body, {html_path}
                )
                line_no = _line_of(text, m.start())
                names_text = m.group("list")
                for item_m in IMPORT_ITEM_RE.finditer(names_text):
                    orig = item_m.group("orig")
                    alias = item_m.group("alias")
                    local_name = alias or orig
                    # Skip Jinja keywords the item-regex may glue onto
                    # (e.g. the `with` in `with context` — handled by
                    # the main regex, but extra defensive here).
                    if local_name.lower() in {"with", "context"}:
                        continue
                    total_imports += 1
                    if not _is_referenced(body, local_name):
                        unused.append(UnusedImport(
                            file=rel,
                            line_no=line_no,
                            name=local_name,
                        ))

        result.passed = total_imports - len(unused)
        result.warnings = len(unused)
        for site in unused:
            result.details.append(
                f"unused macro import {site.name!r} at {site.file}:{site.line_no}"
            )

        result.metrics = {
            "templates_scanned": sum(1 for _ in templates_dir.rglob("*.html")),
            "total_imports": total_imports,
            "unused_imports": len(unused),
        }
        return result


MacroImportUnusedStrategy.register()
