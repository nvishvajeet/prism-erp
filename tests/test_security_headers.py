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
    return app.app.test_client()


def test_standard_security_headers_present(client):
    response = client.get("/login")
    assert response.status_code == 200
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["Referrer-Policy"] == "same-origin"
    assert "Content-Security-Policy" in response.headers


def test_hsts_only_added_for_https_requests(client):
    http_response = client.get("/login")
    assert "Strict-Transport-Security" not in http_response.headers

    https_response = client.get("/login", headers={"X-Forwarded-Proto": "https"})
    assert (
        https_response.headers["Strict-Transport-Security"]
        == "max-age=31536000; includeSubDomains"
    )
