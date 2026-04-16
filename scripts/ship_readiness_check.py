from __future__ import annotations

import sqlite3
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import app  # noqa: E402


def ensure_app_db() -> None:
    app.DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    needs_init = not app.DB_PATH.exists()
    if not needs_init:
        try:
            with sqlite3.connect(app.DB_PATH) as db:
                row = db.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
                ).fetchone()
            needs_init = row is None
        except sqlite3.Error:
            needs_init = True
    if needs_init:
        app.init_db()


def ensure_proxy_route() -> None:
    if "_ship_proxy_scheme" not in app.app.view_functions:
        app.app.add_url_rule(
            "/__ship/proxy-scheme",
            "_ship_proxy_scheme",
            lambda: {"scheme": app.request.scheme},
        )


def _print_result(name: str, ok: bool, detail: str = "") -> bool:
    marker = "✓" if ok else "✗"
    suffix = f" — {detail}" if detail else ""
    print(f"{marker} {name}{suffix}")
    return ok


def check_schema() -> bool:
    required = {"short_code", "attendance_number", "must_change_password", "role_manual_notice"}
    with sqlite3.connect(app.DB_PATH) as db:
        cols = {row[1] for row in db.execute("PRAGMA table_info(users)").fetchall()}
    missing = sorted(required - cols)
    return _print_result("schema", not missing, f"missing {', '.join(missing)}" if missing else "")


def check_ratelimit() -> bool:
    return _print_result("ratelimit", hasattr(app, "_login_limiter"))


def check_security_headers() -> bool:
    client = app.app.test_client()
    response = client.get("/login")
    expected = {
        "X-Frame-Options": "DENY",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "same-origin",
    }
    ok = all(response.headers.get(k) == v for k, v in expected.items()) and "Content-Security-Policy" in response.headers
    return _print_result("security_headers", ok)


def check_proxyfix() -> bool:
    client = app.app.test_client()
    response = client.get(
        "/__ship/proxy-scheme",
        headers={"X-Forwarded-Proto": "https", "X-Forwarded-Host": "playground.catalysterp.org"},
    )
    ok = response.status_code == 200 and response.get_json().get("scheme") == "https"
    return _print_result("proxyfix", ok, response.get_data(as_text=True) if not ok else "")


def check_smoke() -> bool:
    result = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "smoke_test.py")],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    ok = result.returncode == 0
    detail = ""
    if not ok:
        detail = (result.stdout + "\n" + result.stderr).strip()[-300:]
    return _print_result("smoke_test", ok, detail)


def main() -> int:
    ensure_app_db()
    ensure_proxy_route()
    results = [
        check_schema(),
        check_ratelimit(),
        check_security_headers(),
        check_proxyfix(),
        check_smoke(),
    ]
    passed = sum(1 for ok in results if ok)
    print(f"\nSummary: {passed}/{len(results)} checks passed")
    return 0 if all(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
