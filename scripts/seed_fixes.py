#!/usr/bin/env python3
"""Seed v1.5.0 multi-role TODO markers above every call site in app.py
that will break when users.role becomes a user_roles(user_id, role)
junction.

Targets Python subscript accesses of the form  <var>["role"]  (or
single-quoted), which today read a single string and tomorrow will
need has_role(user, "...") against a set of roles.

Idempotent: if the line immediately above a match already starts
with "# TODO [v1.5.0 multi-role]", the match is skipped. Safe to
re-run after edits.

Usage:
    scripts/seed_fixes.py            # dry-run (default), prints matches
    scripts/seed_fixes.py --apply    # writes the markers into app.py
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
TARGET = REPO_ROOT / "app.py"

# Subscript reads of ["role"] on any identifier (user, target_user,
# viewer, row, etc.). Assignments are excluded by a negative
# lookahead — there are currently none, but future-proof the guard.
PATTERN = re.compile(r"\w+\[[\"']role[\"']\](?!\s*=\s*[^=])")

MARKER_PREFIX = "# TODO [v1.5.0 multi-role]"
MARKER_NOTE = (
    "replace <var>[\"role\"] == X / in {...} with has_role(<var>, X) "
    "once user_roles junction lands (v1.5.0)."
)


def iter_python_lines(lines: list[str]):
    """Yield (lineno, line) for lines outside triple-quoted strings.

    Rough-but-safe tracker: toggles when a line contains an odd count
    of triple-quote markers (''' or \"\"\"). Comments are kept — a
    match inside a  #  comment would still get a marker, which is
    harmless and also idempotent.
    """
    in_triple = False
    triple_re = re.compile(r'"""|\'\'\'')
    for idx, line in enumerate(lines):
        ticks = len(triple_re.findall(line))
        was_in = in_triple
        if ticks % 2 == 1:
            in_triple = not in_triple
        if was_in or (in_triple and ticks):
            # line is part of a triple-quoted block — skip
            continue
        yield idx, line


def find_matches(lines: list[str]) -> list[int]:
    hits: list[int] = []
    for idx, line in iter_python_lines(lines):
        if PATTERN.search(line):
            hits.append(idx)
    return hits


def already_marked(lines: list[str], idx: int) -> bool:
    if idx == 0:
        return False
    return lines[idx - 1].lstrip().startswith(MARKER_PREFIX)


def build_marker(indent: str) -> list[str]:
    return [
        f"{indent}{MARKER_PREFIX}: {MARKER_NOTE}\n",
    ]


def leading_indent(line: str) -> str:
    return line[: len(line) - len(line.lstrip())]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--apply", action="store_true",
                    help="write markers into app.py (default is dry-run)")
    args = ap.parse_args()

    src = TARGET.read_text().splitlines(keepends=True)
    matches = find_matches(src)

    to_seed: list[int] = []
    already: list[int] = []
    for idx in matches:
        if already_marked(src, idx):
            already.append(idx)
        else:
            to_seed.append(idx)

    print(f"app.py: {len(matches)} match(es), "
          f"{len(to_seed)} to seed, {len(already)} already seeded")

    if not args.apply:
        for idx in to_seed[:20]:
            print(f"  would seed line {idx + 1}: {src[idx].rstrip()}")
        if len(to_seed) > 20:
            print(f"  ... and {len(to_seed) - 20} more")
        return 0

    # Apply from bottom to top so indices stay valid.
    out = list(src)
    for idx in sorted(to_seed, reverse=True):
        indent = leading_indent(out[idx])
        marker = build_marker(indent)
        out[idx:idx] = marker

    TARGET.write_text("".join(out))
    print(f"seeded {len(to_seed)} marker(s) in app.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
