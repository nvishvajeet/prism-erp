# Observability — v2.0 Follow-On

> Post-release instrumentation plan for CATALYST ERP. This is intentionally
> doc-only for the sprint branch: no new runtime dependencies, no mini-side
> deploy changes.

## 1. Metrics

Add a small `/metrics` endpoint on the app host with Prometheus-compatible
counters and histograms for:
- request count by route + status class
- request latency by route family
- login failures and rate-limit blocks
- crawler runs by strategy + outcome
- queue review backlog size

Prefer route-family labels over raw URL labels to keep cardinality bounded.

## 2. Structured logging

Move high-value application events to JSON lines with a stable schema:
- `ts`
- `level`
- `event`
- `user_id`
- `role`
- `request_id`
- `path`
- `remote_ip`
- `details`

Keep plain-text local-dev logs if needed, but production-facing logs should be
machine-parseable so grep, dashboards, and retention rules all stay coherent.

## 3. Error reporting

Add an error sink such as Sentry or an equivalent self-hosted collector for:
- uncaught Flask exceptions
- background crawler failures
- launchd task boot failures
- repetitive 403/429 spikes that indicate policy regressions or abuse

Sampling is acceptable for noisy client-side events, but server exceptions
should be captured in full with release + environment tags.

## 4. Audit dashboards

Expose simple operator-facing dashboards for:
- auth failures by IP and login identifier
- new debug feedback volume by severity
- queue-review lag over time
- hours/heartbeat session freshness

This closes the loop between the debug system, the new login limiter, and the
time-logging lane work shipped in Operation TroisAgents.

## 5. Rollout order

Recommended order:
1. Structured JSON logs
2. Metrics endpoint + scrape
3. Error reporting sink
4. Lightweight dashboards / alerts

That sequence delivers immediate triage value before any heavier dashboard work.
