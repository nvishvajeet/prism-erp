"""Surface live parallel-agent activity as a sanity-wave signal.

CLAIMS.md is the advisory lock board for concurrent agent work
(see WORKFLOW.md §3.7 and docs/PARALLEL.md). A silent drift —
the file missing, malformed, or hoarding stale claims — would
break parallel workflows long before any test catches it. This
crawler:

  1. Asserts CLAIMS.md exists at the project root.
  2. Parses the "Active claims" table and counts live rows.
  3. Warns if any claim row lacks a recognisable ISO-8601
     timestamp in the `started` column — this is the one field
     the stale-claim-recovery protocol actually reads.
  4. Emits `active_claims_count` as a per-run metric so the
     dev_panel CRAWLERS tile has one fresh 'live agent activity'
     number to surface in place of the retired W1.3.9 noise.

Pass rules:
  - File present, parseable           → +1
  - Each non-empty claim row          → +1
  - Valid timestamp on each row       → +1
  - Empty board (_(empty)_ row)       → +1 (passing idle state)

Fail rules:
  - File missing                      → +1 fail, stop
  - Table heading missing             → +1 fail
"""
from __future__ import annotations

import re
from pathlib import Path

from ..base import CrawlerStrategy, CrawlResult


ISO_RE = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}")
EMPTY_SENTINEL = "_(empty)_"


class ParallelClaimsStrategy(CrawlerStrategy):
    name = "parallel_claims"
    aspect = "regression"
    description = "CLAIMS.md advisory-lock board is parseable + live-claim count"
    needs_seed = False

    def run(self, harness) -> CrawlResult:
        result = CrawlResult(name=self.name, aspect=self.aspect)
        root = Path(__file__).resolve().parents[2]
        path = root / "CLAIMS.md"

        if not path.exists():
            result.failed += 1
            result.details.append("CLAIMS.md missing at project root")
            return result
        result.passed += 1  # file present

        text = path.read_text(encoding="utf-8", errors="ignore")

        # Locate the Active-claims table — the first markdown table
        # following the `## Active claims` heading.
        active_pos = text.find("## Active claims")
        if active_pos < 0:
            result.failed += 1
            result.details.append("CLAIMS.md missing '## Active claims' heading")
            return result
        tail = text[active_pos:]
        lines = tail.splitlines()

        claim_rows: list[str] = []
        in_table = False
        for raw in lines:
            line = raw.strip()
            if line.startswith("| agent") and "task-id" in line:
                in_table = True
                continue
            if in_table:
                if not line.startswith("|"):
                    break
                if set(line.replace("|", "").strip()) <= {"-", ":", " "}:
                    continue
                if EMPTY_SENTINEL in line:
                    result.passed += 1  # idle board counts as pass
                    continue
                claim_rows.append(line)

        # Each claim row gets a row-present pass + a timestamp-validity
        # pass (or warning).
        for row in claim_rows:
            result.passed += 1  # row present
            cells = [c.strip() for c in row.strip("|").split("|")]
            started = cells[2] if len(cells) >= 3 else ""
            if ISO_RE.search(started):
                result.passed += 1
            else:
                result.warnings += 1
                result.details.append(
                    f"claim row missing ISO-8601 timestamp in `started`: {row[:80]}"
                )

        result.metrics = {
            "active_claims_count": len(claim_rows),
            "claims_file_bytes": len(text),
        }
        return result


ParallelClaimsStrategy.register()
