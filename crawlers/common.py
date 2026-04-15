from __future__ import annotations

import sys
from pathlib import Path


def validate_erp_db_match(erp: str, db_path: str | Path) -> Path:
    """Assert the DB path lives under the selected ERP's data roots."""

    resolved = Path(db_path).expanduser().resolve()
    lab_roots = [
        Path.home() / "Documents/Scheduler/Main/data",
        Path.home() / "Scheduler/Main/data",
    ]
    ravikiran_roots = [
        Path.home() / "Claude/ravikiran-erp/data",
        Path.home() / "ravikiran-services/data",
    ]
    expected_roots = lab_roots if erp == "lab" else ravikiran_roots
    if not any(resolved.is_relative_to(root.expanduser().resolve()) for root in expected_roots):
        sys.stderr.write(
            f"REFUSING: --erp {erp!r} but --db {resolved} is not inside any expected "
            f"{erp} data root. Wrong-ERP reads are a silent data leak — aborting.\n"
        )
        raise SystemExit(2)
    return resolved
