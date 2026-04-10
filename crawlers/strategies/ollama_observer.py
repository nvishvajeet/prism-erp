"""Ollama observer crawler — narrates rendered pages.

Aspect: observation
Improves: gives a first-pass natural-language QA review of every
          critical page as two representative roles, so we find
          out whether llama3:8B is useful as an observational
          crawler (vs. a code-editing one — which we already
          know it is not, see ollama_qc_log.md).

For each (role, route) pair:
  1. Fetch the page through the in-process Flask test client.
  2. Extract a trimmed text excerpt (strip HTML tags, collapse
     whitespace, cap to 2000 chars).
  3. Send a structured prompt to the LOCAL Ollama at
     127.0.0.1:11435 asking for three bullet observations.
  4. Append the role, route, HTTP status, excerpt length, and
     Ollama's response to `ollama_observations.md` at the repo
     root.

Every response is also preserved in `ollama_outputs/` with a
timestamped filename (gitignored).

The crawler passes as long as:
  - Every route returned 2xx/3xx
  - Ollama was reachable on at least one page
  - No Python exception escaped the loop

It does NOT gate on the quality of Ollama's observations —
quality judgment lives in ollama_qc_log.md, maintained by hand.

This strategy is **opt-in**: it is not imported by
`crawlers/strategies/__init__.py`, so `python -m crawlers run all`
does not trigger it. Run it explicitly with:

    python -m crawlers run ollama_observer

If local Ollama is not reachable, every call is recorded as a
warning and the crawl still exits 0. This strategy is a probe,
not a gate.
"""
from __future__ import annotations

import json
import os
import re
import time
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path

from ..base import CrawlerStrategy, CrawlResult
from ..harness import Harness


OLLAMA_URL = "http://127.0.0.1:11435/api/generate"
OLLAMA_MODEL = "llama3:latest"
OLLAMA_TIMEOUT = 180  # seconds per call
EXCERPT_LIMIT = 1800  # characters of rendered text per prompt

# Full matrix: 4 roles × 10 routes = 40 Ollama calls ≈ 3 min per run.
# Set OLLAMA_OBSERVER_FAST=1 to drop to the 2×4 smoke profile (~30 s).
OBSERVER_ROLES_FULL = [
    ("admin@lab.local", "super_admin"),
    ("finance@lab.local", "finance_admin"),
    ("anika@lab.local", "operator"),
    ("shah@lab.local", "requester"),
]

OBSERVER_ROLES_FAST = [
    ("admin@lab.local", "super_admin"),
    ("shah@lab.local", "requester"),
]

OBSERVER_PATHS_FULL = [
    "/",
    "/schedule",
    "/instruments",
    "/instruments/1",
    "/calendar",
    "/stats",
    "/requests/new",
    "/me",
    "/sitemap",
    "/docs",
]

OBSERVER_PATHS_FAST = [
    "/",
    "/schedule",
    "/instruments",
    "/stats",
]

# Narration scanner — keywords that suggest a genuine finding rather
# than a happy-path description. Every hit becomes a WARN on the
# CrawlResult so unattended runs surface issues automatically.
FLAG_KEYWORDS = (
    "broken",
    "missing",
    "empty",
    "error",
    "not clickable",
    "incomplete",
    "unclear",
    "placeholder",
    "unreachable",
    "unavailable",
    "nothing to show",
    "does not exist",
    "fails",
    "invalid",
)

OBSERVATIONS_FILE = Path("ollama_observations.md")
OUTPUTS_DIR = Path("ollama_outputs")


def _scan_flags(narration: str) -> list[str]:
    """Return every keyword from FLAG_KEYWORDS found in `narration`."""
    text = narration.lower()
    return [kw for kw in FLAG_KEYWORDS if kw in text]

# Trim any Jinja-level tags, script/style blocks, and excessive
# whitespace so llama3 gets human-readable text, not HTML noise.
_TAG_RE = re.compile(r"<[^>]+>")
_SCRIPT_RE = re.compile(r"<script[^>]*>.*?</script>", re.DOTALL | re.IGNORECASE)
_STYLE_RE = re.compile(r"<style[^>]*>.*?</style>", re.DOTALL | re.IGNORECASE)
_WS_RE = re.compile(r"\s+")


def _extract_text(html: str) -> str:
    """Strip HTML → plain text, capped to EXCERPT_LIMIT chars."""
    cleaned = _SCRIPT_RE.sub(" ", html)
    cleaned = _STYLE_RE.sub(" ", cleaned)
    cleaned = _TAG_RE.sub(" ", cleaned)
    cleaned = _WS_RE.sub(" ", cleaned).strip()
    return cleaned[:EXCERPT_LIMIT]


def _ollama_reachable() -> bool:
    try:
        req = urllib.request.Request("http://127.0.0.1:11435/api/tags")
        with urllib.request.urlopen(req, timeout=3) as resp:
            return resp.status == 200
    except (urllib.error.URLError, OSError, TimeoutError):
        return False


def _ask_ollama(prompt: str) -> tuple[str, float]:
    """POST /api/generate. Returns (response_text, elapsed_seconds).

    On any failure returns ("ERROR: ...", elapsed) — never raises.
    """
    payload = json.dumps(
        {"model": OLLAMA_MODEL, "prompt": prompt, "stream": False}
    ).encode("utf-8")
    req = urllib.request.Request(
        OLLAMA_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    start = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=OLLAMA_TIMEOUT) as resp:
            raw = resp.read()
    except (urllib.error.URLError, OSError, TimeoutError) as exc:
        return f"ERROR: {exc}", time.perf_counter() - start
    elapsed = time.perf_counter() - start
    try:
        decoded = json.loads(raw)
    except json.JSONDecodeError as exc:
        return f"ERROR: JSON decode {exc}", elapsed
    return (decoded.get("response") or decoded.get("error") or "").strip(), elapsed


def _build_prompt(role: str, path: str, status: int, excerpt: str) -> str:
    return f"""You are a QA reviewer looking at a rendered page of a
Flask web application called PRISM (a lab sample-request scheduler).
The page below is what the user sees as role `{role}` on route `{path}`.
The server returned HTTP {status}.

Your job: produce EXACTLY three short bullet observations (one line
each, starting with "- "). Note what the page shows, what looks
useful, and anything that looks broken or empty. Do NOT invent
features that aren't in the text. Do NOT write more than 40 words
total. If the page is empty or an error, say so.

Do not preface with "Here are my observations" or any greeting.
Just the three bullets, nothing else.

=== PAGE TEXT (trimmed to {EXCERPT_LIMIT} chars) ===
{excerpt}
=== END PAGE TEXT ==="""


class OllamaObserverStrategy(CrawlerStrategy):
    """Probe: can llama3:8B narrate rendered pages usefully?"""

    name = "ollama_observer"
    aspect = "observation"
    description = (
        "Ollama narrates ~40 critical pages across 4 roles, scans the "
        "narration for findings, emits warnings for anything that "
        "smells broken. Set OLLAMA_OBSERVER_FAST=1 for the 8-page "
        "smoke profile."
    )

    def run(self, harness: Harness) -> CrawlResult:
        result = CrawlResult(name=self.name, aspect=self.aspect)

        fast = os.environ.get("OLLAMA_OBSERVER_FAST", "").lower() in {"1", "true", "yes"}
        roles = OBSERVER_ROLES_FAST if fast else OBSERVER_ROLES_FULL
        paths = OBSERVER_PATHS_FAST if fast else OBSERVER_PATHS_FULL
        profile = "fast" if fast else "full"

        # If Ollama is down we still hit every page so the harness
        # log has the HTTP traffic, but we don't try to ask.
        reachable = _ollama_reachable()
        if not reachable:
            result.details.append(
                "local Ollama not reachable at 127.0.0.1:11435 — "
                "running HTTP-only probe, no narration"
            )

        OUTPUTS_DIR.mkdir(exist_ok=True)
        ts = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
        raw_log = OUTPUTS_DIR / f"observer_{ts}.txt"
        jsonl_log = OUTPUTS_DIR / f"observer_{ts}.jsonl"

        # Open the markdown observations file in append mode, with a
        # session header so multiple runs stack cleanly.
        header = (
            f"\n\n## Observer session {ts} ({profile})\n"
            f"- Model: {OLLAMA_MODEL}\n"
            f"- Reachable: {reachable}\n"
            f"- Roles ({len(roles)}): {', '.join(r for _, r in roles)}\n"
            f"- Paths ({len(paths)}): {', '.join(paths)}\n\n"
        )
        with OBSERVATIONS_FILE.open("a", encoding="utf-8") as md:
            md.write(header)

        entries: list[dict] = []
        jsonl_fh = jsonl_log.open("w", encoding="utf-8")
        try:
            for email, role in roles:
                with harness.logged_in(email):
                    for path in paths:
                        try:
                            resp = harness.get(
                                path, note=f"observer:{role}",
                                follow_redirects=True,
                            )
                        except Exception as exc:  # noqa: BLE001
                            result.failed += 1
                            result.details.append(
                                f"{role} {path} → exception: {exc}"
                            )
                            continue

                        status = resp.status_code
                        body = resp.data.decode("utf-8", errors="replace")
                        excerpt = _extract_text(body)
                        if status >= 400:
                            result.warnings += 1
                            result.details.append(f"HTTP  {role} {path} → {status}")
                        else:
                            result.passed += 1

                        if reachable and excerpt:
                            prompt = _build_prompt(role, path, status, excerpt)
                            narration, elapsed = _ask_ollama(prompt)
                        else:
                            narration = "(Ollama skipped)"
                            elapsed = 0.0

                        # Scan narration for finding keywords. Each hit
                        # becomes a warning on the crawl result so
                        # unattended runs surface issues automatically.
                        flags = _scan_flags(narration) if not narration.startswith("ERROR") else []
                        for kw in flags:
                            result.warnings += 1
                            result.details.append(
                                f"FLAG  {role} {path} → '{kw}'"
                            )

                        entry = {
                            "ts": ts,
                            "profile": profile,
                            "role": role,
                            "path": path,
                            "status": status,
                            "excerpt_len": len(excerpt),
                            "elapsed_s": round(elapsed, 2),
                            "flags": flags,
                            "narration": narration,
                        }
                        entries.append(entry)
                        jsonl_fh.write(json.dumps(entry) + "\n")
                        jsonl_fh.flush()

                        with OBSERVATIONS_FILE.open("a", encoding="utf-8") as md:
                            flag_tag = f" — flags: {', '.join(flags)}" if flags else ""
                            md.write(f"### {role} — `{path}` (HTTP {status}){flag_tag}\n")
                            md.write(
                                f"*excerpt {len(excerpt)} chars, "
                                f"ollama {elapsed:.2f} s*\n\n"
                            )
                            md.write(narration or "(empty response)")
                            md.write("\n\n")
        finally:
            jsonl_fh.close()

        with raw_log.open("w", encoding="utf-8") as fh:
            json.dump(entries, fh, indent=2)

        result.details.append(f"observations → {OBSERVATIONS_FILE}")
        result.details.append(f"raw transcript → {raw_log}")
        return result


OllamaObserverStrategy.register()
