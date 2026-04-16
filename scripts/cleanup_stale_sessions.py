#!/usr/bin/env python3
"""Prune stale Flask session files from /tmp/flask_session.

Safe defaults:
- only touches regular files
- ignores missing directories
- prunes files older than N days (default 7)
"""

from __future__ import annotations

import argparse
import time
from pathlib import Path


DEFAULT_SESSION_DIR = Path("/tmp/flask_session")
DEFAULT_MAX_AGE_DAYS = 7


def prune_sessions(session_dir: Path, max_age_days: int) -> tuple[int, int]:
    cutoff = time.time() - (max_age_days * 24 * 60 * 60)
    deleted = 0
    skipped = 0

    if not session_dir.exists():
        return deleted, skipped

    for path in session_dir.iterdir():
        if not path.is_file():
            skipped += 1
            continue
        try:
            if path.stat().st_mtime < cutoff:
                path.unlink()
                deleted += 1
        except OSError:
            skipped += 1

    return deleted, skipped


def main() -> int:
    parser = argparse.ArgumentParser(description="Delete stale Flask session files.")
    parser.add_argument(
        "--session-dir",
        default=str(DEFAULT_SESSION_DIR),
        help=f"Directory holding Flask session files (default: {DEFAULT_SESSION_DIR})",
    )
    parser.add_argument(
        "--max-age-days",
        type=int,
        default=DEFAULT_MAX_AGE_DAYS,
        help=f"Delete files older than this many days (default: {DEFAULT_MAX_AGE_DAYS})",
    )
    args = parser.parse_args()

    session_dir = Path(args.session_dir).expanduser()
    deleted, skipped = prune_sessions(session_dir, args.max_age_days)
    print(
        f"session cleanup complete: dir={session_dir} max_age_days={args.max_age_days} "
        f"deleted={deleted} skipped={skipped}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
