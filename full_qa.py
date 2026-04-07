from __future__ import annotations

import math

import app
import simulate_live_run


def login(client, email: str, password: str = "SimplePass123"):
    response = client.post("/login", data={"email": email, "password": password}, follow_redirects=True)
    assert response.status_code == 200, email
    return response


def ratio(hex_a: str, hex_b: str) -> float:
    def luminance(hex_color: str) -> float:
        hex_color = hex_color.lstrip("#")
        rgb = [int(hex_color[i:i + 2], 16) / 255 for i in (0, 2, 4)]

        def channel(value: float) -> float:
            return value / 12.92 if value <= 0.03928 else ((value + 0.055) / 1.055) ** 2.4

        r, g, b = [channel(v) for v in rgb]
        return 0.2126 * r + 0.7152 * g + 0.0722 * b

    l1 = luminance(hex_a)
    l2 = luminance(hex_b)
    lighter = max(l1, l2)
    darker = min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)


def theme_audit():
    checks = [
        ("light body text", "#18212b", "#f5f6f8", 10.0),
        ("light panel text", "#18212b", "#ffffff", 10.0),
        ("light muted text", "#5d6a76", "#ffffff", 4.5),
        ("dark body text", "#edf2f7", "#0f1419", 12.0),
        ("dark panel text", "#edf2f7", "#161d25", 12.0),
        ("dark muted text", "#b9c6d2", "#161d25", 6.0),
        ("dark input text", "#edf2f7", "#111923", 12.0),
        ("dark stats text", "#eef7f8", "#12202a", 12.0),
        ("dark pending badge", "#c9ddff", "#19283d", 8.0),
        ("dark completed badge", "#d6f5dd", "#183123", 9.0),
        ("dark rejected badge", "#ffd8dd", "#351d22", 9.0),
    ]
    for name, fg, bg, minimum in checks:
        score = ratio(fg, bg)
        assert score >= minimum, f"{name} contrast too low: {score:.2f}"
        print(f"ok: {name} contrast {score:.2f}")


def role_navigation_audit(client):
    with app.app.app_context():
        db = app.get_db()
        finance_user = db.execute("SELECT * FROM users WHERE email = 'finance@lab.local'").fetchone()
        professor_user = db.execute("SELECT * FROM users WHERE email = 'prof.approver@lab.local'").fetchone()
        finance_request = None
        professor_request = None
        request_ids = [row["id"] for row in db.execute("SELECT id FROM sample_requests ORDER BY id").fetchall()]
        for request_id in request_ids:
            request_row = db.execute("SELECT * FROM sample_requests WHERE id = ?", (request_id,)).fetchone()
            if request_row is None:
                continue
            if finance_request is None and app.can_view_request(finance_user, request_row):
                finance_request = request_id
            if professor_request is None and app.can_view_request(professor_user, request_row):
                professor_request = request_id
            if finance_request is not None and professor_request is not None:
                break
        assert finance_request is not None
        assert professor_request is not None
    role_pages = {
        "admin@lab.local": ["/", "/schedule", "/calendar", "/instruments", "/stats", "/admin/users"],
        "dean@lab.local": ["/", "/schedule", "/calendar", "/instruments", "/stats"],
        "fesem.admin@lab.local": ["/", "/schedule", "/calendar", "/instruments", "/instruments/1", "/instruments/1/history"],
        "anika@lab.local": ["/", "/schedule", "/calendar", "/instruments", "/instruments/1"],
        "finance@lab.local": ["/", f"/requests/{finance_request}", "/my/history"],
        "prof.approver@lab.local": ["/", f"/requests/{professor_request}", "/my/history", "/schedule", "/calendar", "/instruments", "/stats"],
        "meera.member@lab.local": ["/", "/my/history", "/me"],
    }
    blocked_pages = {
        "fesem.admin@lab.local": ["/instruments/2", "/instruments/2/history"],
        "finance@lab.local": ["/schedule", "/calendar", "/instruments", "/stats", "/admin/users"],
        "prof.approver@lab.local": ["/admin/users"],
        "meera.member@lab.local": ["/schedule", "/calendar", "/instruments", "/stats", "/users/1"],
    }
    for email, pages in role_pages.items():
        login(client, email)
        for path in pages:
            response = client.get(path, follow_redirects=True)
            assert response.status_code == 200, f"{email} should access {path}"
        for path in blocked_pages.get(email, []):
            response = client.get(path)
            assert response.status_code == 403, f"{email} should not access {path}"
        client.get("/logout")
    print("ok: role navigation audit")


def action_audit(client):
    login(client, "admin@lab.local")
    with app.app.app_context():
        db = app.get_db()
        scheduled = db.execute("SELECT id FROM sample_requests WHERE status = 'scheduled' ORDER BY id LIMIT 1").fetchone()
        in_progress = db.execute("SELECT id FROM sample_requests WHERE status = 'in_progress' ORDER BY id LIMIT 1").fetchone()
        attachment = db.execute("SELECT id FROM request_attachments WHERE is_active = 1 ORDER BY id LIMIT 1").fetchone()
    assert scheduled is not None
    assert in_progress is not None
    assert attachment is not None
    assert client.get(f"/requests/{scheduled['id']}").status_code == 200
    response = client.post("/schedule/actions", data={"action": "start_now", "request_id": str(scheduled["id"])}, follow_redirects=True)
    assert b"now in progress" in response.data
    response = client.get(f"/attachments/{attachment['id']}/download")
    assert response.status_code == 200
    client.get("/logout")
    print("ok: action audit")


def theme_toggle_presence(client):
    with app.app.app_context():
        sample_request_id = app.get_db().execute("SELECT id FROM sample_requests ORDER BY id LIMIT 1").fetchone()["id"]
    login(client, "admin@lab.local")
    for path in ["/", "/schedule", "/calendar", f"/requests/{sample_request_id}", "/stats"]:
        response = client.get(path)
        assert b'id="themeToggle"' in response.data, path
        assert b"data-theme" in response.data or b"labTheme" in response.data, path
    client.get("/logout")
    print("ok: theme toggle presence")


def main():
    simulate_live_run.main()
    client = app.app.test_client()
    role_navigation_audit(client)
    action_audit(client)
    theme_toggle_presence(client)
    theme_audit()
    print("full qa passed")


if __name__ == "__main__":
    main()
