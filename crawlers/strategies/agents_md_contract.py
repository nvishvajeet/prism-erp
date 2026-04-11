"""Lock AGENTS.md as a load-bearing file.

AGENTS.md is the vendor-neutral onboarding contract for any AI
coding agent working on PRISM. A silent drift (file deleted,
section renamed, structure inverted) would quietly break the
onboarding story for every non-Claude agent. This crawler
asserts the file exists and carries the minimum-set of headings
every agent reads on first session.
"""
from __future__ import annotations

from pathlib import Path

from ..base import CrawlerStrategy, CrawlResult


# Lowercase phrases that must appear in AGENTS.md. Matched as
# substrings against the lowercased file body, so minor rewording
# (e.g. "commit / push rhythm" vs "commit rhythm") still passes,
# but removing a whole section fails. Phrases are drawn from the
# top-level `## N.` headings currently in AGENTS.md.
REQUIRED_HEADINGS = [
    "what prism is",
    "topology",
    "commit",            # matches 'the commit / push rhythm'
    "pre-commit gate",
    "hard vs soft",
    "demo vs operational",
    "security invariants",
    "docs manifest",
]


class AgentsMdContractStrategy(CrawlerStrategy):
    """Assert AGENTS.md exists and carries its required section headings."""

    name = "agents_md_contract"
    aspect = "regression"
    description = "AGENTS.md vendor-neutral onboarding file exists + required headings present"
    needs_seed = False

    def run(self, harness) -> CrawlResult:
        result = CrawlResult(name=self.name, aspect=self.aspect)
        root = Path(__file__).resolve().parents[2]
        path = root / "AGENTS.md"

        if not path.exists():
            result.failed += 1
            result.details.append("AGENTS.md not found at project root")
            return result

        text = path.read_text(encoding="utf-8", errors="ignore").lower()
        for needle in REQUIRED_HEADINGS:
            if needle in text:
                result.passed += 1
            else:
                result.failed += 1
                result.details.append(
                    f"AGENTS.md: required heading phrase missing: {needle!r}"
                )

        # Minimum file size — protects against an accidental truncation.
        if len(text) < 2000:
            result.warnings += 1
            result.details.append(
                f"AGENTS.md only {len(text)} chars — expected >=2000 for full onboarding contract"
            )

        result.metrics = {
            "required_headings_checked": len(REQUIRED_HEADINGS),
            "file_bytes": len(text),
        }
        return result


AgentsMdContractStrategy.register()
