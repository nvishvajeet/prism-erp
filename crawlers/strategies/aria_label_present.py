"""ARIA-label presence crawler — icon-only buttons / unlabeled inputs.

Aspect: accessibility
Improves: catches screen-reader failures introduced by icon-only
          buttons (📞, ✓), empty-text links, bare <img> tags, and
          text inputs that have no associated <label>. The crawler
          only REPORTS — it never auto-fixes. The findings feed a
          follow-up labeling pass.

Rules enforced (per WCAG 1.1.1 / 4.1.2):

  1. <button> or <input type="submit|button|reset"> whose visible
     text is empty OR is a single emoji/icon MUST carry
     aria-label="..." OR title="..." OR aria-labelledby="...".
  2. <a> with the same empty/icon-only content MUST carry one of
     the same attributes.
  3. <img> MUST have an `alt` attribute (empty string is fine — the
     *presence* is what matters). `<img alt>` without value fails.
  4. <input type="text|email|tel|number|search|password|url|date|...">
     MUST be either wrapped in a <label>, or carry `aria-label`, or
     referenced by `aria-labelledby`, or have a sibling
     <label for="..."> matching its `id`. Checkboxes/radios and
     hidden inputs are exempt (they are normally label-wrapped by
     macros we cannot resolve statically).

Detection is regex-based, not a full DOM parse — good enough for
our hand-written templates. Jinja expressions (`{{ ... }}`, `{% ... %}`)
inside visible text count as "probably has text" because we cannot
statically resolve them. False positives are tuned away through
ALLOWLIST_CONTENT rather than by making the detector cleverer.
"""
from __future__ import annotations

import re
from pathlib import Path

from ..base import CrawlerStrategy, CrawlResult
from ..harness import Harness


# -- Tag scanners ---------------------------------------------------

# Match opening tags *and* their inner text up to the closing tag.
# DOTALL so newlines inside the text do not break the match. Non-greedy
# so nested buttons/links do not collapse together.
BUTTON_RE = re.compile(
    r"<button\b([^>]*)>(.*?)</button>", re.DOTALL | re.IGNORECASE
)
ANCHOR_RE = re.compile(
    r"<a\b([^>]*)>(.*?)</a>", re.DOTALL | re.IGNORECASE
)
IMG_RE = re.compile(r"<img\b([^>]*?)/?>", re.IGNORECASE)
INPUT_RE = re.compile(r"<input\b([^>]*?)/?>", re.IGNORECASE)
LABEL_FOR_RE = re.compile(r'<label\b[^>]*\bfor=["\']([^"\']+)["\']', re.IGNORECASE)
LABEL_OPEN_RE = re.compile(r"<label\b", re.IGNORECASE)
LABEL_CLOSE_RE = re.compile(r"</label>", re.IGNORECASE)

# Attribute extractors
ATTR_ARIA_LABEL = re.compile(r'\baria-label\s*=\s*["\'][^"\']*["\']', re.IGNORECASE)
ATTR_ARIA_LABELLEDBY = re.compile(r'\baria-labelledby\s*=\s*["\'][^"\']*["\']', re.IGNORECASE)
ATTR_TITLE = re.compile(r'\btitle\s*=\s*["\'][^"\']*["\']', re.IGNORECASE)
ATTR_TYPE = re.compile(r'\btype\s*=\s*["\']([^"\']+)["\']', re.IGNORECASE)
ATTR_ID = re.compile(r'\bid\s*=\s*["\']([^"\']+)["\']', re.IGNORECASE)
ATTR_ALT_PRESENT = re.compile(r'\balt\s*=\s*["\']', re.IGNORECASE)
ATTR_ALT_BARE = re.compile(r'\balt(?:\s|/|>|$)', re.IGNORECASE)
ATTR_VALUE = re.compile(r'\bvalue\s*=\s*["\'][^"\']*["\']', re.IGNORECASE)
ATTR_NAME = re.compile(r'\bname\s*=\s*["\']([^"\']+)["\']', re.IGNORECASE)

JINJA_EXPR_RE = re.compile(r"{{.*?}}|{%.*?%}", re.DOTALL)
HTML_TAG_RE = re.compile(r"<[^>]+>")


# Input types that need an explicit text label. Checkbox/radio are
# conventionally wrapped by macros; file and hidden are exempt.
LABELABLE_TYPES = {
    "text", "email", "tel", "number", "search", "password", "url",
    "date", "datetime-local", "time", "month", "week",
}


# Content we accept as "has text" even when codepoint-count is low.
# Most of these are short English labels that would otherwise trip
# the icon-only detector (3-letter buttons like "Go", "OK").
ALLOWLIST_CONTENT: set[str] = set()


# -----------------------------------------------------------------


def _strip_visible_text(inner: str) -> str:
    """Reduce an element's inner HTML to its bare visible text.

    - Jinja blocks are REPLACED by a placeholder word so they count
      as "has text" (we cannot statically resolve them).
    - HTML tags are dropped.
    - Whitespace is collapsed.
    """
    # Preserve Jinja as a non-empty marker so icon-only detection
    # doesn't misclassify buttons whose label is `{{ user.name }}`.
    text = JINJA_EXPR_RE.sub("JINJA", inner)
    text = HTML_TAG_RE.sub(" ", text)
    return " ".join(text.split()).strip()


def _is_icon_only(text: str) -> bool:
    """Return True if `text` is effectively a single emoji/icon.

    Heuristic: stripped text is non-empty, ≤ 2 unicode codepoints,
    and contains at least one non-ASCII character. This catches
    single emoji (📞, ✓, ✔, ★) plus dingbats/symbol-fonts while
    passing normal 1–2 letter English labels like "OK" or "Go".
    """
    if not text:
        return False
    if len(text) > 2:
        return False
    # Non-ASCII presence distinguishes emoji/icons from plain ASCII
    # short words.
    return any(ord(ch) > 127 for ch in text)


def _has_any(attrs: str, *patterns: re.Pattern[str]) -> bool:
    return any(p.search(attrs) for p in patterns)


def _has_label_attr(attrs: str) -> bool:
    return _has_any(attrs, ATTR_ARIA_LABEL, ATTR_ARIA_LABELLEDBY, ATTR_TITLE)


class AriaLabelPresentStrategy(CrawlerStrategy):
    """Report icon-only buttons, bare imgs, and unlabeled inputs."""

    name = "aria_label_present"
    aspect = "accessibility"
    description = "ARIA labels on icon-only buttons / imgs / inputs"
    needs_seed = False

    def run(self, harness: Harness) -> CrawlResult:
        result = CrawlResult(name=self.name, aspect=self.aspect)
        root = Path(__file__).resolve().parents[2]
        tpl_dir = root / "templates"
        if not tpl_dir.exists():
            result.failed += 1
            result.details.append(f"{tpl_dir} not found")
            return result

        findings: list[str] = []
        scanned_files = 0
        scanned_elements = 0

        for tpl in sorted(tpl_dir.rglob("*.html")):
            scanned_files += 1
            rel = tpl.relative_to(root)
            text = tpl.read_text(encoding="utf-8", errors="ignore")

            # Pre-compute every `id` that a <label for="..."> points at.
            referenced_ids = set(LABEL_FOR_RE.findall(text))

            # Buttons
            for m in BUTTON_RE.finditer(text):
                scanned_elements += 1
                attrs, inner = m.group(1), m.group(2)
                visible = _strip_visible_text(inner)
                if _has_label_attr(attrs):
                    continue
                if visible in ALLOWLIST_CONTENT:
                    continue
                if not visible:
                    findings.append(
                        f"{rel}: <button> with empty text + no aria-label"
                    )
                elif _is_icon_only(visible):
                    findings.append(
                        f"{rel}: <button> icon-only {visible!r} + no aria-label"
                    )

            # Anchors
            for m in ANCHOR_RE.finditer(text):
                scanned_elements += 1
                attrs, inner = m.group(1), m.group(2)
                visible = _strip_visible_text(inner)
                if _has_label_attr(attrs):
                    continue
                if visible in ALLOWLIST_CONTENT:
                    continue
                if not visible:
                    findings.append(
                        f"{rel}: <a> with empty text + no aria-label"
                    )
                elif _is_icon_only(visible):
                    findings.append(
                        f"{rel}: <a> icon-only {visible!r} + no aria-label"
                    )

            # Images
            for m in IMG_RE.finditer(text):
                scanned_elements += 1
                attrs = m.group(1)
                # alt="..." present (even empty) is OK. A bare `alt` is a fail.
                if ATTR_ALT_PRESENT.search(attrs):
                    continue
                if ATTR_ALT_BARE.search(attrs):
                    findings.append(f"{rel}: <img> with bare `alt` (no value)")
                    continue
                findings.append(f"{rel}: <img> missing alt attribute")

            # Inputs
            for m in INPUT_RE.finditer(text):
                scanned_elements += 1
                attrs = m.group(1)
                type_m = ATTR_TYPE.search(attrs)
                input_type = type_m.group(1).lower() if type_m else "text"

                # submit/button/reset: treat like a button — their
                # accessible name comes from `value=` or aria-label.
                if input_type in {"submit", "button", "reset"}:
                    if _has_label_attr(attrs):
                        continue
                    val_m = ATTR_VALUE.search(attrs)
                    if val_m:
                        # value="" is an icon-or-empty situation; otherwise OK.
                        val_text = _strip_visible_text(val_m.group(0))
                        if val_text and not _is_icon_only(val_text):
                            continue
                    findings.append(
                        f"{rel}: <input type={input_type!r}> with no label/value"
                    )
                    continue

                if input_type not in LABELABLE_TYPES:
                    continue

                if _has_any(attrs, ATTR_ARIA_LABEL, ATTR_ARIA_LABELLEDBY):
                    continue

                id_m = ATTR_ID.search(attrs)
                if id_m and id_m.group(1) in referenced_ids:
                    continue

                # Last-resort: is this <input> enclosed by a <label>?
                if _input_is_label_wrapped(text, m.start()):
                    continue

                name_m = ATTR_NAME.search(attrs)
                hint = name_m.group(1) if name_m else (id_m.group(1) if id_m else "?")
                findings.append(
                    f"{rel}: <input type={input_type!r} name={hint!r}> "
                    "missing <label>/aria-label"
                )

        findings.sort()
        for line in findings[:200]:
            result.warnings += 1
            result.details.append(line)

        if not findings:
            result.passed += 1

        result.metrics = {
            "templates_scanned": scanned_files,
            "elements_scanned": scanned_elements,
            "findings": len(findings),
        }
        result.report_json = {"findings": findings}
        return result


def _input_is_label_wrapped(text: str, input_pos: int) -> bool:
    """Return True if the `<input>` at `input_pos` sits inside a <label>.

    Count every <label … > vs </label> from the start of the file up
    to the input's position. An imbalance (more opens than closes)
    means we're inside a still-open <label>. Full-file scan avoids
    fixed-window edge cases where a large block of labeled fields
    pushes the nearest open label out of a small window.
    """
    before = text[:input_pos]
    opens = len(LABEL_OPEN_RE.findall(before))
    closes = len(LABEL_CLOSE_RE.findall(before))
    return opens > closes


AriaLabelPresentStrategy.register()
