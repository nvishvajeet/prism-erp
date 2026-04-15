from __future__ import annotations

import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from crawlers import common  # noqa: E402


@pytest.fixture()
def fake_home(monkeypatch, tmp_path):
    monkeypatch.setattr(common.Path, "home", lambda: tmp_path)
    return tmp_path


def test_lab_db_inside_lab_root_passes(fake_home):
    db_path = fake_home / "Documents" / "Scheduler" / "Main" / "data" / "demo" / "lab_scheduler.db"
    db_path.parent.mkdir(parents=True, exist_ok=True)
    assert common.validate_erp_db_match("lab", db_path) == db_path.resolve()


def test_lab_db_pointing_at_ravikiran_root_exits(fake_home, capsys):
    db_path = fake_home / "Claude" / "ravikiran-erp" / "data" / "operational" / "ravikiran.db"
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with pytest.raises(SystemExit) as exc:
        common.validate_erp_db_match("lab", db_path)
    assert exc.value.code == 2
    assert "Wrong-ERP reads are a silent data leak" in capsys.readouterr().err


def test_ravikiran_db_pointing_at_lab_root_exits(fake_home, capsys):
    db_path = fake_home / "Documents" / "Scheduler" / "Main" / "data" / "operational" / "lab_scheduler.db"
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with pytest.raises(SystemExit) as exc:
        common.validate_erp_db_match("ravikiran", db_path)
    assert exc.value.code == 2
    assert "Wrong-ERP reads are a silent data leak" in capsys.readouterr().err


def test_ravikiran_db_inside_ravikiran_root_passes(fake_home):
    db_path = fake_home / "Claude" / "ravikiran-erp" / "data" / "operational" / "ravikiran.db"
    db_path.parent.mkdir(parents=True, exist_ok=True)
    assert common.validate_erp_db_match("ravikiran", db_path) == db_path.resolve()
