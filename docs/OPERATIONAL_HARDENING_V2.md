# Operational Hardening — v2.0 Post-Audit Fixes

> Actions to apply on the mini during the next deploy window. These are
> post-audit hardening tasks, not live changes for the current sprint.

## 1. launchd ThrottleInterval

Current state: the local crawler services can restart too aggressively after a
crash. That creates tight crash loops and noisy logs during configuration or DB
corruption failures.

Recommended fix:
- Raise `ThrottleInterval` from `10` to `60` in:
  - `~/Library/LaunchAgents/local.catalyst.plist`
  - `~/Library/LaunchAgents/local.catalyst.demo.plist`
- After editing, reload with `launchctl bootout` then `launchctl bootstrap`.

## 2. SQLite synchronous mode

Current state: operational writes were using `PRAGMA synchronous=NORMAL`, which
trades durability for speed. For financial and personnel data, the safer
default is `FULL`.

Sprint action shipped now:
- Operational runs now use `PRAGMA synchronous=FULL`.
- Demo and explicitly fast local runs keep `NORMAL` when
  `LAB_SCHEDULER_DEMO_MODE=1` or `LAB_SCHEDULER_SQLITE_FAST=1`.

## 3. Daily database backup

Current state: there is no scheduled snapshot of the operational database.

Recommended fix:
- Copy `~/Scheduler/Main/data/operational/lab_scheduler.db` daily into
  `~/backups/lab_scheduler-YYYYMMDD.db`.
- Keep seven rolling snapshots.
- Run from launchd on the mini, not from the app process.

## 4. Log rotation

Current state: application logs can grow without a retention boundary.

Recommended fix:
- Add size-based or daily rotation for `server.log`.
- Prefer a rotating handler in the Flask entrypoint or an external logrotate
  job if the mini uses a stable file layout.

## 5. HSTS preload readiness

Current state: the app now emits HSTS only for HTTPS requests, but the header
does not yet include the `preload` token and should not be submitted to the
browser preload lists until the full domain fleet is consistently HTTPS.

Recommended fix:
- Serve `Strict-Transport-Security` with:
  `max-age=31536000; includeSubDomains; preload`
- Confirm every production hostname and subdomain redirects to HTTPS without
  mixed-content exceptions or certificate gaps.
- Keep `includeSubDomains` enabled permanently once adopted; preload is a
  one-way operational commitment, not a casual toggle.
- Verify readiness at [hstspreload.org](https://hstspreload.org) before
  submission.

Why this is deferred:
- The sprint patch intentionally avoided forcing preload semantics before the
  branded hosts, playground hosts, and any future tenant subdomains are all
  known-good under TLS.
- A bad preload submission can brick HTTP recovery paths for every subdomain.

## Appendix A — backup plist stub

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>local.catalyst.backup</string>
    <key>ProgramArguments</key>
    <array>
      <string>/bin/sh</string>
      <string>-lc</string>
      <string>mkdir -p ~/backups && cp ~/Scheduler/Main/data/operational/lab_scheduler.db ~/backups/lab_scheduler-$(date +%Y%m%d).db && ls -1t ~/backups/lab_scheduler-*.db | tail -n +8 | xargs -r rm -f</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
      <key>Hour</key>
      <integer>2</integer>
      <key>Minute</key>
      <integer>15</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>/tmp/local.catalyst.backup.out</string>
    <key>StandardErrorPath</key>
    <string>/tmp/local.catalyst.backup.err</string>
  </dict>
</plist>
```
