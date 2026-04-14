#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import smtplib
import ssl
import sys
import urllib.request
from email.message import EmailMessage
from pathlib import Path


def getenv(name: str, default: str = "") -> str:
    return (os.environ.get(name) or default).strip()


def load_env_file(env_path: Path) -> None:
    if not env_path.exists():
        return
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def send_via_smtp(to_addr: str, subject: str, body: str) -> tuple[bool, str]:
    host = getenv("SMTP_HOST", "localhost")
    port = int(getenv("SMTP_PORT", "25") or "25")
    username = getenv("SMTP_USERNAME")
    password = getenv("SMTP_PASSWORD")
    from_addr = getenv("SMTP_FROM", username or "noreply@catalyst.local")
    use_tls = getenv("SMTP_USE_TLS", "0").lower() in {"1", "true", "yes", "on"}

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_addr
    msg.set_content(body)

    try:
        if use_tls:
            with smtplib.SMTP(host, port, timeout=10) as server:
                server.starttls(context=ssl.create_default_context())
                if username and password:
                    server.login(username, password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=10) as server:
                if username and password:
                    server.login(username, password)
                server.send_message(msg)
        return True, f"smtp:{host}:{port}"
    except Exception as exc:
        return False, f"smtp_failed:{exc}"


def send_via_sendgrid(to_addr: str, subject: str, body: str) -> tuple[bool, str]:
    api_key = getenv("SENDGRID_API_KEY")
    from_addr = getenv("SENDGRID_FROM", "noreply@catalyst.local")
    if not api_key:
        return False, "sendgrid_not_configured"
    payload = json.dumps(
        {
            "personalizations": [{"to": [{"email": to_addr}]}],
            "from": {"email": from_addr},
            "subject": subject,
            "content": [{"type": "text/plain", "value": body}],
        }
    ).encode()
    try:
        req = urllib.request.Request(
            "https://api.sendgrid.com/v3/mail/send",
            data=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        urllib.request.urlopen(req, timeout=10)
        return True, "sendgrid"
    except Exception as exc:
        return False, f"sendgrid_failed:{exc}"


def main() -> int:
    root_dir = Path(__file__).resolve().parent.parent
    load_env_file(root_dir / ".env")
    target = getenv("CATALYST_ALERT_EMAIL")
    if not target:
        print("alert_skipped:no_target")
        return 1

    subject = sys.argv[1] if len(sys.argv) > 1 else "CATALYST server alert"
    body = sys.argv[2] if len(sys.argv) > 2 else "The Catalyst server verifier detected a deployment or health issue."

    ok, detail = send_via_smtp(target, subject, body)
    if ok:
        print(f"alert_sent:{detail}:{target}")
        return 0

    ok, detail2 = send_via_sendgrid(target, subject, body)
    if ok:
        print(f"alert_sent:{detail2}:{target}")
        return 0

    print(f"alert_failed:{detail}|{detail2}:{target}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
