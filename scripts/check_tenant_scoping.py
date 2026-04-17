#!/usr/bin/env python3
"""D5 — Tenant-scoping audit for app.py.

Scans app.py for raw SELECT/UPDATE/DELETE statements against user-owned
tables without a tenant_tag filter. Prints warnings (soft-warn mode) and
exits non-zero if any unscoped queries are found.

Usage:
    python scripts/check_tenant_scoping.py [--hard-fail] [app.py]

Exit codes:
    0 — clean (or warnings suppressed by --soft-warn-only with no hits)
    1 — unscoped queries found (hard-fail mode, or critical)
    0 — warnings only (default soft-warn mode)

In soft-warn mode the script always exits 0 so it doesn't block CI until
D4 + query-fixing is fully landed. Pass --hard-fail to promote to blocking.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Tables that hold tenant-specific user data and MUST be scoped.
TENANT_TABLES = {
    "users",
    "sample_requests",
    "instruments",
    "vendors",
    "grants",
    "vehicles",
    "attendance",
    "payments",
    "sample_request_payments",
}

# Patterns that look like raw queries against tenant tables without
# a tenant_tag filter. We match lines that have a FROM/JOIN/UPDATE/DELETE
# referencing the table name WITHOUT a tenant_tag clause anywhere nearby.
# This is a heuristic — false positives are possible; false negatives are
# the real risk.
FROM_RE = re.compile(
    r'\b(FROM|JOIN|UPDATE|DELETE\s+FROM)\s+(' + '|'.join(TENANT_TABLES) + r')\b',
    re.IGNORECASE,
)
TENANT_TAG_RE = re.compile(r'tenant_tag', re.IGNORECASE)


def check_file(path: Path) -> list[tuple[int, str]]:
    """Return list of (lineno, line) for lines that look unscoped."""
    hits: list[tuple[int, str]] = []
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        if FROM_RE.search(line):
            # Check a window of ±10 lines for tenant_tag mention
            window_start = max(0, i - 5)
            window_end = min(len(lines), i + 15)
            window = "\n".join(lines[window_start:window_end])
            if not TENANT_TAG_RE.search(window):
                hits.append((i + 1, line.strip()))
        i += 1
    return hits


def main() -> int:
    parser = argparse.ArgumentParser(description="Tenant-scoping audit for app.py")
    parser.add_argument("app", nargs="?", default=str(ROOT / "app.py"), help="Path to app.py")
    parser.add_argument("--hard-fail", action="store_true", help="Exit 1 on any unscoped query")
    args = parser.parse_args()

    app_path = Path(args.app)
    if not app_path.exists():
        print(f"ERROR: {app_path} not found", file=sys.stderr)
        return 1

    hits = check_file(app_path)

    if not hits:
        print(f"[D5] tenant-scoping check: CLEAN — no unscoped queries found in {app_path.name}")
        return 0

    print(f"[D5] tenant-scoping WARN — {len(hits)} potentially unscoped queries in {app_path.name}:")
    for lineno, line in hits[:30]:
        print(f"  L{lineno}: {line[:120]}")
    if len(hits) > 30:
        print(f"  ... and {len(hits) - 30} more")

    if args.hard_fail:
        print("[D5] --hard-fail set: treating warnings as errors", file=sys.stderr)
        return 1

    print("[D5] soft-warn mode: warnings logged, exit 0 (pass --hard-fail to block CI)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
