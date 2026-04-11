"""Future-fixes placeholder — count remaining `# TODO [vX.Y.Z …]` markers.

Static-file crawler. No HTTP, no DB. Scans `app.py`, repo-root Python
files, and `templates/*.html` for the marker shape that
`scripts/seed_fixes.py` plants at every call site that will break
when the multi-role junction table lands (v1.5.0). Each remaining
marker is a PASS — a signal that known work is still pending in a
known spot. `total_markers` is the "how much v1.5.0 work is left?"
progress gauge. Adding a v1.5.1 tag later is trivial — the regex
captures the release token dynamically.
"""
from __future__ import annotations

import re
from pathlib import Path

from ..base import CrawlerStrategy, CrawlResult
from ..harness import Harness

MARKER_RE = re.compile(r"#\s*TODO\s*\[(v\d+\.\d+\.\d+)\s+[^\]]+\]")
TAG_LABELS = {"v1.5.0": "v1.5.0 multi-role"}


class FutureFixesPlaceholder(CrawlerStrategy):
    """Count outstanding `# TODO [vX.Y.Z …]` markers as a progress signal."""

    name = "future_fixes_placeholder"
    aspect = "regression"
    description = "Count pending # TODO [vX.Y.Z …] markers across app.py + templates"
    needs_seed = False

    def run(self, harness: Harness) -> CrawlResult:
        result = CrawlResult(name=self.name, aspect=self.aspect)
        root = Path(__file__).resolve().parents[2]

        targets: list[Path] = []
        if (root / "app.py").exists():
            targets.append(root / "app.py")
        if (root / "templates").exists():
            targets.extend(sorted((root / "templates").glob("*.html")))
        targets.extend(p for p in sorted(root.glob("*.py")) if p.name != "app.py")

        by_release: dict[str, int] = {}
        by_file: dict[str, int] = {}
        files_per_release: dict[str, int] = {}
        total = 0
        for path in targets:
            try:
                text = path.read_text(encoding="utf-8", errors="ignore")
            except OSError:
                continue
            matches = MARKER_RE.findall(text)
            if not matches:
                continue
            by_file[path.relative_to(root).as_posix()] = len(matches)
            total += len(matches)
            for release in matches:
                by_release[release] = by_release.get(release, 0) + 1
            for release in set(matches):
                files_per_release[release] = files_per_release.get(release, 0) + 1
            result.passed += len(matches)

        result.metrics = {
            "total_markers": total,
            "by_release": by_release,
            "by_file": by_file,
            "top_files": sorted(by_file.items(), key=lambda kv: kv[1], reverse=True)[:5],
        }
        for release, count in sorted(by_release.items()):
            label = TAG_LABELS.get(release, release)
            result.details.append(
                f"{label}: {count} markers in {files_per_release.get(release, 0)} files"
            )
        return result


FutureFixesPlaceholder.register()
