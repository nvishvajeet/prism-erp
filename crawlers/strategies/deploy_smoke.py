"""Deploy smoke — verifies a running CATALYST server responds over the network.

Aspect: regression
Category: testing
Improves: catches "the launchd plist started the wrong python" / "the
          firewall dropped the port" / "the cert chain is busted" class
          of deploy bugs before they hit a human.

Unlike every other strategy in this suite, `deploy_smoke` does NOT go
through the Flask test client. It hits a real URL over the network
using `urllib.request` and asserts HTTP 200 + a sentinel string in the
body. The URL comes from the `CATALYST_DEPLOY_URL` environment variable;
if unset, the strategy reports "skipped" (exit 0) so laptop sanity
runs stay offline and fast.

Intended usage in a Track A deploy verification:

    CATALYST_DEPLOY_URL=https://catalyst-mini.tail-xxxx.ts.net \\
      .venv/bin/python -m crawlers run deploy_smoke

Cert handling: `https://` URLs verify the full chain via the system
trust store. A self-signed cert (e.g. mkcert fallback for Plan-B HTTPS)
generates a WARN, not a FAIL, so either Plan A (Tailscale Let's
Encrypt) or Plan B keeps the wave green.
"""
from __future__ import annotations

import os
import socket
import ssl
import urllib.error
import urllib.request

from ..base import CrawlerStrategy, CrawlResult
from ..harness import Harness


DEPLOY_PROBES: list[tuple[str, str]] = [
    ("/login", "<title>"),
    ("/sitemap", "<title>"),
    ("/api/health-check", ""),  # no sentinel — just 2xx
]

TIMEOUT_SECONDS = 6.0


def _fetch(url: str, *, verify: bool = True) -> tuple[int, str, str | None]:
    """Return (status, body_preview, warning_or_none).

    Uses urllib so we don't pull a new dependency. A self-signed cert
    triggers one retry with verification disabled — we still succeed,
    but bubble a warning up to the strategy so the run is WARN, not
    FAIL.
    """
    ctx: ssl.SSLContext | None = None
    if url.startswith("https://"):
        ctx = ssl.create_default_context()
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "catalyst-deploy-smoke/1.0"})
        with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS, context=ctx) as resp:
            body = resp.read(2048).decode("utf-8", errors="replace")
            return (resp.status, body, None)
    except urllib.error.HTTPError as exc:
        return (exc.code, "", None)
    except ssl.SSLCertVerificationError as exc:
        # Plan-B mkcert / untrusted dev cert. Retry without verification
        # and warn.
        unsafe_ctx = ssl._create_unverified_context()  # noqa: SLF001
        try:
            with urllib.request.urlopen(url, timeout=TIMEOUT_SECONDS, context=unsafe_ctx) as resp:
                body = resp.read(2048).decode("utf-8", errors="replace")
                return (resp.status, body, f"self-signed cert ({exc.verify_message})")
        except Exception as inner:  # noqa: BLE001
            return (0, "", f"cert retry failed: {inner}")
    except (urllib.error.URLError, socket.timeout, OSError) as exc:
        return (0, "", f"network error: {exc}")


class DeploySmokeStrategy(CrawlerStrategy):
    """Verify a remote CATALYST deployment is alive and serving the right app."""

    name = "deploy_smoke"
    aspect = "regression"
    description = "Deploy smoke — probe CATALYST_DEPLOY_URL for /login + /sitemap"

    # We don't need a seeded DB — we're hitting a remote server.
    needs_seed = False

    def run(self, harness: Harness) -> CrawlResult:
        result = CrawlResult(name=self.name, aspect=self.aspect)
        base = os.environ.get("CATALYST_DEPLOY_URL", "").rstrip("/")
        if not base:
            # Truly neutral skip — no WARN so `wave sanity` with
            # `stop_on_fail=True` does not halt on laptops that don't
            # have a remote deployment to probe. The details line is
            # still written so operators know the strategy was a noop.
            result.metrics["skipped"] = True
            result.details.append(
                "CATALYST_DEPLOY_URL not set — skipped (set it to the "
                "Tailscale HTTPS URL on the mini to enable)"
            )
            return result

        result.metrics["base_url"] = base
        result.metrics["scheme"] = "https" if base.startswith("https://") else "http"

        for path, sentinel in DEPLOY_PROBES:
            url = f"{base}{path}"
            status, body, warning = _fetch(url)

            if warning and status and 200 <= status < 400:
                # Success but with a cert warning (Plan-B fallback).
                result.passed += 1
                result.warnings += 1
                result.details.append(f"{path} → {status} ({warning})")
                continue

            if not (200 <= status < 400):
                result.failed += 1
                msg = warning or f"status {status}"
                result.details.append(f"{path} → FAIL ({msg})")
                continue

            if sentinel and sentinel not in body:
                result.failed += 1
                result.details.append(
                    f"{path} → {status} but sentinel {sentinel!r} missing"
                )
                continue

            result.passed += 1

        return result


DeploySmokeStrategy.register()
