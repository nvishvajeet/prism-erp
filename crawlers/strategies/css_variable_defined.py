"""CSS variable defined crawler — every var(--x) resolves or has a fallback.

Aspect: css_hygiene
Improves: catches the exact bug that bit dev_panel.html (--sp-3 was
          referenced with no definition and no fallback, so the browser
          silently resolved it to the initial value — zero margin — and
          no eye-ball review caught it). This crawler makes the gap
          immediately visible.

How it works:
  1. Scan `static/styles.css` for every `--NAME:` declaration (the
     defined set). Any --var defined in any selector block is counted —
     a variable defined globally cascades to all descendants.
  2. Scan `static/styles.css`, `static/*.js`, and `templates/**/*.html`
     (inside both `style=""` attributes and `<style>` blocks) for every
     `var(--NAME)` and `var(--NAME, FALLBACK)` reference.
  3. WARN for each reference that has no matching definition AND no
     fallback argument. That is the --sp-3 shape.
  4. References with a fallback are always fine — the fallback covers
     the missing definition.
  5. As a secondary signal (info only, not a WARN), report variables
     that are defined but never referenced anywhere. Kept separate
     because theme-scoped vars can appear unused to a static scanner.

Not perfect — dynamically constructed var() strings in JS are invisible
to a static scan — but good enough to catch the specific class of
silent-zero bugs this was designed for.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import NamedTuple

from ..base import CrawlerStrategy, CrawlResult
from ..harness import Harness

# Match: var(--name) or var(--name, fallback)
# Group 1 = var name (no leading --)
# Group 2 = fallback string or None
VAR_REF_RE = re.compile(
    r"var\(\s*--([a-zA-Z][\w-]{1,})"  # require ≥2 chars after -- (name ≥1 + prefix)
    r"(?:\s*,([^)]*))?"               # optional fallback
    r"\s*\)"
)

# Match CSS custom property declaration: --name: value
# We look for --NAME: inside any selector block (not just :root).
VAR_DEF_RE = re.compile(r"--([a-zA-Z][\w-]{1,})\s*:")

# Allowlist prefixes for vars that are set at runtime by JS or
# injected by a third-party library. Populated from real run on
# 2026-04-15 — dhtmlx calendar (dp-*) and FullCalendar (fc-*) inject
# hundreds of custom properties at runtime that no static scanner can
# see definitions for. These are confirmed library vars, not our code.
ALLOWLIST_PREFIXES: tuple[str, ...] = (
    # dhtmlx Scheduler / Calendar — runtime-injected theming properties
    "dp-",
    # FullCalendar — runtime-injected theming properties
    "fc-", "fc_",
)


class VarRef(NamedTuple):
    name: str
    has_fallback: bool
    source_file: str
    line_no: int


def _collect_definitions(css_text: str) -> set[str]:
    """Return set of all --NAME variable names defined in the CSS."""
    return set(VAR_DEF_RE.findall(css_text))


def _collect_refs_from_text(text: str, source_label: str) -> list[VarRef]:
    """Yield VarRef tuples for every var(--x) found in text."""
    refs: list[VarRef] = []
    for lineno, line in enumerate(text.splitlines(), start=1):
        for m in VAR_REF_RE.finditer(line):
            name = m.group(1)
            fallback = m.group(2)
            has_fallback = fallback is not None and fallback.strip() != ""
            refs.append(VarRef(name, has_fallback, source_label, lineno))
    return refs


class CSSVariableDefinedStrategy(CrawlerStrategy):
    """Ensure every var(--x) reference resolves or carries a fallback."""

    name = "css_variable_defined"
    aspect = "css_hygiene"
    description = (
        "Every var(--foo) reference resolves to a defined variable or has a fallback"
    )
    needs_seed = False

    def run(self, harness: Harness) -> CrawlResult:
        result = CrawlResult(name=self.name, aspect=self.aspect)
        root = Path(__file__).resolve().parents[2]
        css_path = root / "static" / "styles.css"
        templates_dir = root / "templates"
        static_dir = root / "static"

        if not css_path.exists():
            result.failed += 1
            result.details.append(f"{css_path} not found")
            return result

        css_text = css_path.read_text(encoding="utf-8", errors="ignore")

        # ── 1. Build the defined-set from styles.css only ────────────
        # Strip /* comments */ so comment examples don't inflate defs.
        css_no_comments = re.sub(r"/\*.*?\*/", "", css_text, flags=re.DOTALL)
        defined: set[str] = _collect_definitions(css_no_comments)

        # ── 2. Collect all references ─────────────────────────────────
        all_refs: list[VarRef] = []

        # styles.css itself
        all_refs.extend(_collect_refs_from_text(
            css_text,
            str(css_path.relative_to(root)),
        ))

        # static/*.js
        if static_dir.exists():
            for js_path in sorted(static_dir.rglob("*.js")):
                text = js_path.read_text(encoding="utf-8", errors="ignore")
                all_refs.extend(_collect_refs_from_text(
                    text,
                    str(js_path.relative_to(root)),
                ))

        # templates/**/*.html — inline style="" attrs and <style> blocks
        # Also harvest --NAME: definitions from any <style>…</style> block
        # so self-contained standalone pages (e.g. the dev hub, the mess
        # student-pass PWA) that declare their own :root palette don't
        # flag as undefined.
        style_block_re = re.compile(r"<style[^>]*>(.*?)</style>", re.DOTALL | re.IGNORECASE)
        if templates_dir.exists():
            for html_path in sorted(templates_dir.rglob("*.html")):
                text = html_path.read_text(encoding="utf-8", errors="ignore")
                all_refs.extend(_collect_refs_from_text(
                    text,
                    str(html_path.relative_to(root)),
                ))
                for m in style_block_re.finditer(text):
                    block = re.sub(r"/\*.*?\*/", "", m.group(1), flags=re.DOTALL)
                    defined.update(_collect_definitions(block))

        # ── 3. Classify each reference ────────────────────────────────
        undefined_no_fallback: list[VarRef] = []
        resolved_count = 0

        for ref in all_refs:
            # Allowlist check — dynamic vars set by JS / third-party libs
            if any(ref.name.startswith(p) for p in ALLOWLIST_PREFIXES):
                resolved_count += 1
                continue
            if ref.name in defined:
                resolved_count += 1
            elif ref.has_fallback:
                # Fallback covers it — passes silently
                resolved_count += 1
            else:
                undefined_no_fallback.append(ref)

        # ── 4. Secondary signal: defined-but-never-referenced ─────────
        referenced_names: set[str] = {r.name for r in all_refs}
        unused_defs = defined - referenced_names

        # ── 5. Populate result ────────────────────────────────────────
        result.passed = resolved_count
        result.warnings = len(undefined_no_fallback)
        for ref in undefined_no_fallback:
            result.details.append(
                f"undefined var --{ref.name} referenced at "
                f"{ref.source_file}:{ref.line_no}"
            )

        if unused_defs:
            # Info only — not a WARN. Theme-scoped vars may appear unused
            # to a static scanner. Listed at the end of details so they
            # don't crowd out the real warnings.
            result.details.append(
                f"info: {len(unused_defs)} defined var(s) never referenced "
                f"(possible theme-only or dead): "
                + ", ".join(f"--{v}" for v in sorted(unused_defs)[:20])
                + (" …" if len(unused_defs) > 20 else "")
            )

        result.metrics = {
            "total_var_refs":  len(all_refs),
            "total_var_defs":  len(defined),
            "undefined_refs":  len(undefined_no_fallback),
            "unused_defs":     len(unused_defs),
        }
        return result


CSSVariableDefinedStrategy.register()
