from __future__ import annotations

import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import app  # noqa: E402


@pytest.fixture()
def seeded_db(monkeypatch, tmp_path):
    db_path = tmp_path / "data" / "demo" / "lab_scheduler.db"
    db_path.parent.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(app, "DB_PATH", db_path)
    app.init_db()
    app.app.config.update(TESTING=True, WTF_CSRF_ENABLED=False)
    return db_path


def _flags_for_login(login_id: str) -> dict[str, bool]:
    with app.app.test_request_context("/me"):
        user = app.query_one(
            "SELECT * FROM users WHERE lower(email) = ? OR lower(name) = ? LIMIT 1",
            (login_id.lower(), login_id.lower()),
        )
        assert user is not None, f"missing seeded user for {login_id}"
        app.session["user_id"] = user["id"]
        app.session["active_portal"] = "lab"
        values = app.inject_globals()
        return {
            "can_edit_user": values["can_edit_user"],
            "can_approve_finance": values["can_approve_finance"],
            "can_manage_instruments": values["can_manage_instruments"],
            "can_view_debug": values["can_view_debug"],
            "can_invite": values["can_invite"],
        }


def test_permission_flags_match_role_matrix(seeded_db):
    expected = {
        "test.requester": {
            "can_edit_user": False,
            "can_approve_finance": False,
            "can_manage_instruments": False,
            "can_view_debug": False,
            "can_invite": False,
        },
        "test.finance": {
            "can_edit_user": False,
            "can_approve_finance": True,
            "can_manage_instruments": False,
            "can_view_debug": False,
            "can_invite": False,
        },
        "test.professor": {
            "can_edit_user": False,
            "can_approve_finance": False,
            "can_manage_instruments": False,
            "can_view_debug": False,
            "can_invite": False,
        },
        "test.faculty": {
            "can_edit_user": False,
            "can_approve_finance": False,
            "can_manage_instruments": False,
            "can_view_debug": False,
            "can_invite": False,
        },
        "test.operator": {
            "can_edit_user": False,
            "can_approve_finance": False,
            "can_manage_instruments": False,
            "can_view_debug": False,
            "can_invite": False,
        },
        "test.instrument_admin": {
            "can_edit_user": False,
            "can_approve_finance": False,
            "can_manage_instruments": True,
            "can_view_debug": False,
            "can_invite": True,
        },
        "test.site_admin": {
            "can_edit_user": False,
            "can_approve_finance": True,
            "can_manage_instruments": True,
            "can_view_debug": True,
            "can_invite": True,
        },
        "test.super_admin": {
            "can_edit_user": True,
            "can_approve_finance": True,
            "can_manage_instruments": True,
            "can_view_debug": True,
            "can_invite": True,
        },
        "tejveer": {
            "can_edit_user": False,
            "can_approve_finance": False,
            "can_manage_instruments": False,
            "can_view_debug": True,
            "can_invite": False,
        },
        "owner@catalyst.local": {
            "can_edit_user": True,
            "can_approve_finance": True,
            "can_manage_instruments": True,
            "can_view_debug": True,
            "can_invite": True,
        },
    }
    for login_id, flags in expected.items():
        assert _flags_for_login(login_id) == flags
