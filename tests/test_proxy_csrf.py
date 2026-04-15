from __future__ import annotations

import re
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
    app.app.config.update(TESTING=True, WTF_CSRF_ENABLED=True)
    if "_test_proxy_scheme" not in app.app.view_functions:
        app.app.add_url_rule(
            "/__test/proxy-scheme",
            "_test_proxy_scheme",
            lambda: {"scheme": app.request.scheme},
        )
    return app.app.test_client()


def _extract_csrf(html: bytes) -> str:
    body = html.decode("utf-8")
    match = re.search(r'name="csrf_token" value="([^"]+)"', body)
    assert match, "csrf token not found"
    return match.group(1)


def test_login_with_forwarded_proto_https(client):
    get_response = client.get("/login")
    assert get_response.status_code == 200
    token = _extract_csrf(get_response.data)

    post_response = client.post(
        "/login",
        data={
            "email": "owner@catalyst.local",
            "password": "12345",
            "csrf_token": token,
        },
        headers={
            "X-Forwarded-Proto": "https",
            "X-Forwarded-For": "1.2.3.4",
            "X-Forwarded-Host": "playground.catalysterp.org",
        },
        follow_redirects=False,
    )
    assert post_response.status_code in (302, 303), post_response.status


def test_proxyfix_exposes_https_scheme(client):
    response = client.get(
        "/__test/proxy-scheme",
        headers={"X-Forwarded-Proto": "https", "X-Forwarded-Host": "playground.catalysterp.org"},
    )
    assert response.status_code == 200
    assert response.get_json()["scheme"] == "https"
