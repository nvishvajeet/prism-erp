# CATALYST Crawl Parallel Tasks — 2026-04-14

These are ready-to-claim follow-on tasks for other agents joining the
development-testing optimization burn.

Use `docs/PARALLEL.md`, `CLAIMS.md`, and
`docs/AGENT_LAUNCH_TEMPLATES.md`.

## Task 1 — Auth-negative deep pass

- Lane: `crawl-read`
- Surface: `/login`, `/profile/change-password`, forced temp-password flow
- Goal: find awkward or failing negative paths not caught by smoke
- Read first:
  - `templates/login.html`
  - `templates/change_password.html`
  - `app.py` login + change-password handlers
- Proof command:
  - `./venv/bin/python -m crawlers wave negative --steps 1200 --seed 20260414`
- Expected output:
  - handoff with exact negative-path failures or confirmation that auth is stable

## Task 2 — Crawler report ergonomics

- Lane: `docs-handoff` or `crawler-fix`
- Surface: wave reports in `reports/`
- Goal: improve operator readability of wave-level output and suggest a next-step summary format for dev panel consumption
- Read first:
  - `crawlers/__main__.py`
  - `reports/wave_*.json`
  - dev panel crawler-health helpers in `app.py`
- Proof command:
  - `./venv/bin/python -m crawlers wave sanity`
- Expected output:
  - proposal or patch for better wave-level triage visibility

## Task 3 — Instrument-detail negative UI crawl

- Lane: `crawl-read` or `ui-polish`
- Surface: instrument detail, maintenance, AI feedback, per-instrument actions
- Goal: find hidden buttons, clipped panes, 404s, or dead-end flows on dense instrument pages
- Read first:
  - `templates/instrument_detail.html`
  - `templates/_base_feedback_widgets.html`
  - `static/styles.css`
- Proof command:
  - `./venv/bin/python -m crawlers run dead_link`
  - `./venv/bin/python -m crawlers run role_behavior`
- Expected output:
  - exact files and smallest safe edit set

## Task 4 — Deepdev runtime audit

- Lane: `crawl-read`
- Surface: long-run crawl efficiency
- Goal: profile where the new `deepdev` wave spends time and which strategies provide the least marginal value during a 45-minute burn
- Read first:
  - `crawlers/waves.py`
  - `crawlers/__main__.py`
  - `reports/wave_deepdev_log.json`
- Proof command:
  - `./venv/bin/python -m crawlers wave deepdev --steps 1600 --seed 20260414`
- Expected output:
  - ranked "keep / optional / expensive" strategy list for future burns
