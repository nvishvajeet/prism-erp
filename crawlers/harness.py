"""Shared test harness for PRISM crawlers.

Every crawler strategy shares the same pattern:

  1. Bootstrap Flask app pointing at a fresh temp SQLite database
  2. Seed or build a cohort of users across all 9 roles
  3. Use Flask's test client to act on the site
  4. Log every HTTP call + exception to a structured report

`Harness` centralises steps 1-4 so each strategy only has to express
"what to crawl" — not "how to boot PRISM".

A harness instance is cheap to construct but expensive to
`bootstrap()`. Call bootstrap once per run.
"""
from __future__ import annotations

import json
import os
import sqlite3
import sys
import tempfile
import time
import traceback
from collections import Counter, defaultdict
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Iterator


# ── Canonical roles + seed personas ─────────────────────────────────
# Every strategy can rely on these accounts existing after seed_users().
# Password for all seeded accounts is PASSWORD below.
PASSWORD = "SimplePass123"

ROLE_PERSONAS: list[tuple[str, str, str]] = [
    # (name, email, role)
    ("Admin Owner",      "admin@lab.local",       "super_admin"),
    ("Site Admin",       "siteadmin@lab.local",   "site_admin"),
    ("FESEM Admin",      "fesem.admin@lab.local", "instrument_admin"),
    ("Dr. Sen",          "sen@lab.local",         "faculty_in_charge"),
    ("Anika Operator",   "anika@lab.local",       "operator"),
    ("Prof. Approver",   "prof.approver@lab.local", "professor_approver"),
    ("Finance Officer",  "finance@lab.local",     "finance_admin"),
    ("Aarav Shah",       "shah@lab.local",        "requester"),
]

# Minimal instrument roster — enough variety for per-instrument crawls
SEED_INSTRUMENTS: list[dict[str, Any]] = [
    {"code": "FESEM-01", "name": "FESEM",            "category": "Electron Microscopy", "location": "Lab A-101", "capacity": 3},
    {"code": "XRD-01",   "name": "XRD",              "category": "X-Ray Diffraction",   "location": "Lab A-102", "capacity": 5},
    {"code": "NMR-01",   "name": "NMR Spectrometer", "category": "Spectroscopy",        "location": "Lab B-201", "capacity": 2},
]


# ── Result primitives ───────────────────────────────────────────────
@dataclass
class HTTPCall:
    """One HTTP call recorded by the harness."""
    method: str
    path: str
    status: int
    role: str
    note: str = ""
    elapsed_ms: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "method": self.method,
            "path": self.path,
            "status": self.status,
            "role": self.role,
            "note": self.note,
            "elapsed_ms": round(self.elapsed_ms, 2),
        }


@dataclass
class HarnessLog:
    """Rolling log of every call + exception during a run."""
    calls: list[HTTPCall] = field(default_factory=list)
    exceptions: list[dict[str, Any]] = field(default_factory=list)
    started_at: str = ""
    ended_at: str = ""

    def record_call(self, call: HTTPCall) -> None:
        self.calls.append(call)

    def record_exception(self, context: str, exc: BaseException) -> None:
        self.exceptions.append({
            "context": context,
            "type": type(exc).__name__,
            "message": str(exc),
            "traceback": traceback.format_exc(),
        })

    def summary(self) -> dict[str, Any]:
        status_counts: Counter[str] = Counter()
        for call in self.calls:
            bucket = f"{call.status // 100}xx"
            status_counts[bucket] += 1
        return {
            "total_calls": len(self.calls),
            "status_counts": dict(status_counts),
            "exception_count": len(self.exceptions),
            "started_at": self.started_at,
            "ended_at": self.ended_at,
        }


# ── The harness itself ──────────────────────────────────────────────
class Harness:
    """Boots PRISM on a temp DB and provides a logged Flask test client.

    Typical use inside a strategy::

        harness = Harness()
        harness.bootstrap()
        harness.seed_users_and_instruments()

        with harness.logged_in("admin@lab.local"):
            resp = harness.get("/")
            assert resp.status_code == 200

        harness.teardown()
    """

    def __init__(self) -> None:
        self.temp_db_path: Path | None = None
        self.app = None           # Flask app module (imported lazily)
        self.flask_app = None     # Flask app instance
        self.client = None        # Flask test client
        self.log = HarnessLog()
        self._current_role: str = "anonymous"

    # -- Bootstrap ----------------------------------------------------
    def bootstrap(self) -> None:
        """Point Flask at a fresh temp DB, init schema, wire test client.

        Safe to call repeatedly: the first call imports + configures the
        Flask app, subsequent calls just swap the DB path and re-init the
        schema. This is what lets a wave run multiple strategies through
        the same Python process without tripping Flask's "setup method
        can no longer be called" guard after the first request.
        """
        # Owner emails must be set BEFORE app is imported the first time
        os.environ.setdefault("OWNER_EMAILS", "admin@lab.local")
        # Demo mode must be on so seed_data()/login routes behave like dev
        os.environ.setdefault("LAB_SCHEDULER_DEMO_MODE", "1")
        # CSRF enforcement OFF for the test client — W6.6 gates it on
        # LAB_SCHEDULER_CSRF=1, and we want to keep crawlers form-friendly
        os.environ.setdefault("LAB_SCHEDULER_CSRF", "0")

        self.temp_db_path = Path(tempfile.mktemp(suffix=".db"))
        os.environ["LAB_SCHEDULER_DB_PATH"] = str(self.temp_db_path)

        repo_root = Path(__file__).resolve().parent.parent
        if str(repo_root) not in sys.path:
            sys.path.insert(0, str(repo_root))

        import app as prism_app  # type: ignore

        prism_app.DB_PATH = self.temp_db_path
        self.app = prism_app

        flask_app = prism_app.app
        flask_app.config["TESTING"] = True
        flask_app.config["WTF_CSRF_ENABLED"] = False

        prism_app.init_db()
        self.flask_app = flask_app
        self.client = flask_app.test_client()
        self.log.started_at = datetime.utcnow().isoformat(timespec="seconds") + "Z"

    def teardown(self) -> None:
        self.log.ended_at = datetime.utcnow().isoformat(timespec="seconds") + "Z"
        if self.temp_db_path and self.temp_db_path.exists():
            try:
                self.temp_db_path.unlink()
            except OSError:
                pass

    # -- Seed ---------------------------------------------------------
    def seed_users_and_instruments(
        self,
        personas: list[tuple[str, str, str]] | None = None,
        instruments: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """Insert default cohort directly into SQLite (fast path).

        Returns a dict of `{role: email}` for the seeded users, plus
        the list of instrument ids.
        """
        from werkzeug.security import generate_password_hash  # local import

        assert self.app is not None, "Harness.bootstrap() must be called first"
        personas = personas or ROLE_PERSONAS
        instruments = instruments or SEED_INSTRUMENTS
        pw_hash = generate_password_hash(PASSWORD, method="pbkdf2:sha256")

        conn = sqlite3.connect(str(self.temp_db_path))
        cur = conn.cursor()

        # Users --------------------------------------------------------
        user_ids: dict[str, int] = {}
        for name, email, role in personas:
            cur.execute(
                """
                INSERT OR IGNORE INTO users
                    (name, email, password_hash, role, active, invite_status)
                VALUES (?, ?, ?, ?, 1, 'active')
                """,
                (name, email, pw_hash, role),
            )
            # ROLE_PERSONAS is the source of truth for who-is-which-role
            # in crawlers. If the row already existed (e.g. seed_data ran
            # first and gave Sen role=requester), force the persona role
            # so visibility / role_landing / role_behavior stay in sync.
            cur.execute(
                "UPDATE users SET role = ?, active = 1, invite_status = 'active' WHERE email = ?",
                (role, email),
            )
            row = cur.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
            if row:
                user_ids[email] = row[0]

        # Instruments --------------------------------------------------
        instrument_ids: list[int] = []
        for inst in instruments:
            cur.execute(
                """
                INSERT OR IGNORE INTO instruments
                    (code, name, category, location, daily_capacity, status)
                VALUES (?, ?, ?, ?, ?, 'active')
                """,
                (inst["code"], inst["name"], inst["category"], inst["location"], inst.get("capacity", 3)),
            )
            row = cur.execute("SELECT id FROM instruments WHERE code = ?", (inst["code"],)).fetchone()
            if row:
                instrument_ids.append(row[0])

        # Assign the FESEM admin + operator to instrument 1 so
        # can_manage_instrument / can_operate_instrument resolve True.
        if instrument_ids and "fesem.admin@lab.local" in user_ids:
            cur.execute(
                "INSERT OR IGNORE INTO instrument_admins (instrument_id, user_id) "
                "VALUES (?, ?)",
                (instrument_ids[0], user_ids["fesem.admin@lab.local"]),
            )
        if instrument_ids and "anika@lab.local" in user_ids:
            cur.execute(
                "INSERT OR IGNORE INTO instrument_operators (instrument_id, user_id) "
                "VALUES (?, ?)",
                (instrument_ids[0], user_ids["anika@lab.local"]),
            )

        conn.commit()
        conn.close()
        return {
            "users": {email: uid for email, uid in user_ids.items()},
            "roles": {role: email for _, email, role in personas},
            "instruments": instrument_ids,
        }

    # -- HTTP ---------------------------------------------------------
    def login(self, email: str, password: str = PASSWORD) -> int:
        """Log `email` in. Returns the resulting HTTP status."""
        assert self.client is not None
        resp = self.client.post(
            "/login",
            data={"email": email, "password": password},
            follow_redirects=True,
        )
        # Remember the role for tagging subsequent calls
        self._current_role = self._role_for(email)
        return resp.status_code

    def logout(self) -> None:
        assert self.client is not None
        self.client.get("/logout", follow_redirects=True)
        self._current_role = "anonymous"

    @contextmanager
    def logged_in(self, email: str) -> Iterator[None]:
        """Scoped login — logs out at the end."""
        self.login(email)
        try:
            yield
        finally:
            self.logout()

    def get(self, path: str, *, note: str = "", follow_redirects: bool = False) -> Any:
        return self._request("GET", path, note=note, follow_redirects=follow_redirects)

    def post(self, path: str, data: dict[str, Any] | None = None, *,
             note: str = "", follow_redirects: bool = True, **kwargs: Any) -> Any:
        return self._request("POST", path, data=data, note=note,
                             follow_redirects=follow_redirects, **kwargs)

    def _request(self, method: str, path: str, *, data: dict[str, Any] | None = None,
                 note: str = "", follow_redirects: bool = False, **kwargs: Any) -> Any:
        assert self.client is not None
        start = time.perf_counter()
        try:
            if method == "GET":
                resp = self.client.get(path, follow_redirects=follow_redirects, **kwargs)
            else:
                resp = self.client.post(path, data=data or {},
                                        follow_redirects=follow_redirects, **kwargs)
        except Exception as exc:  # noqa: BLE001 — we want everything
            self.log.record_exception(f"{method} {path}", exc)
            raise
        elapsed_ms = (time.perf_counter() - start) * 1000
        self.log.record_call(HTTPCall(
            method=method, path=path, status=resp.status_code,
            role=self._current_role, note=note, elapsed_ms=elapsed_ms,
        ))
        return resp

    # -- Helpers ------------------------------------------------------
    def _role_for(self, email: str) -> str:
        for _, e, role in ROLE_PERSONAS:
            if e == email:
                return role
        return "unknown"

    def write_reports(self, name: str, payload: dict[str, Any], summary: str) -> tuple[Path, Path]:
        """Write a JSON log + a human-readable text report for a strategy."""
        reports_dir = Path(__file__).resolve().parent.parent / "reports"
        reports_dir.mkdir(exist_ok=True)
        json_path = reports_dir / f"{name}_log.json"
        txt_path = reports_dir / f"{name}_report.txt"
        json_path.write_text(json.dumps(payload, indent=2, default=str))
        txt_path.write_text(summary)
        return json_path, txt_path
