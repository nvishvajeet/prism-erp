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
def client(monkeypatch, tmp_path):
    db_path = tmp_path / "data" / "demo" / "lab_scheduler.db"
    db_path.parent.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(app, "DB_PATH", db_path)
    app.init_db()
    app.app.config.update(TESTING=True, WTF_CSRF_ENABLED=False)
    limiter = app.LoginRateLimiter()
    monkeypatch.setattr(app, "_login_limiter", limiter)
    return app.app.test_client(), limiter


def test_blocks_after_five_failed_attempts(client):
    client_app, _limiter = client
    ip = "203.0.113.9"
    for _ in range(5):
        response = client_app.post(
            "/login",
            data={"email": "owner@catalyst.local", "password": "wrong"},
            environ_overrides={"REMOTE_ADDR": ip},
        )
        assert response.status_code == 200
    blocked = client_app.post(
        "/login",
        data={"email": "owner@catalyst.local", "password": "wrong"},
        environ_overrides={"REMOTE_ADDR": ip},
    )
    assert blocked.status_code == 429
    assert b"Too many failed attempts" in blocked.data


def test_successful_login_clears_failure_history(client):
    client_app, limiter = client
    ip = "203.0.113.10"
    for _ in range(4):
        client_app.post(
            "/login",
            data={"email": "owner@catalyst.local", "password": "wrong"},
            environ_overrides={"REMOTE_ADDR": ip},
        )
    success = client_app.post(
        "/login",
        data={"email": "owner@catalyst.local", "password": "12345"},
        environ_overrides={"REMOTE_ADDR": ip},
        follow_redirects=False,
    )
    assert success.status_code == 302
    assert ip not in limiter._failures
    assert ip not in limiter._blocked


def test_window_elapses_and_attempts_reset(client, monkeypatch):
    client_app, limiter = client
    now = [1_000.0]
    monkeypatch.setattr(limiter, "_now", lambda: now[0])
    ip = "203.0.113.11"
    for _ in range(5):
        response = client_app.post(
            "/login",
            data={"email": "owner@catalyst.local", "password": "wrong"},
            environ_overrides={"REMOTE_ADDR": ip},
        )
        assert response.status_code == 200
    now[0] += limiter.window_seconds + 1
    allowed = client_app.post(
        "/login",
        data={"email": "owner@catalyst.local", "password": "wrong"},
        environ_overrides={"REMOTE_ADDR": ip},
    )
    assert allowed.status_code == 200
    assert b"Too many failed attempts" not in allowed.data
