#!/usr/bin/env python3
"""Run the 6-hour Catalyst queue review loop and print a compact summary."""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import app


def main() -> None:
    result = app.review_operational_queues("scheduled-6h")
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
