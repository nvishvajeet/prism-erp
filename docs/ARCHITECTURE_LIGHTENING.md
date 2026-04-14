# Architecture Lightening Map

This file is the current map for reducing CATALYST's future build cost
without changing product behavior.

## Current Reality

- `app.py` is still the dominant integration surface at roughly 24k
  lines.
- The biggest remaining route/controller hotspots are:
  - `request_detail()`
  - `index()`
  - `instrument_detail()`
  - `ai_pane_submit()`
- Recent lightening work already split several large controllers into
  helper-based read models and action handlers:
  - `finance_portal()`
  - `new_request()`
  - `schedule_actions()`
  - `user_profile()`
  - `admin_users()`

## Lightening Principles

- Keep behavior stable; prefer extraction over redesign.
- Split controllers into three layers whenever possible:
  - permission/context guard
  - POST/action mutation handler
  - GET/read-model payload builder
- Cache repeated expensive lists inside a request where possible.
- Prefer small helper seams that preserve existing template context.
- Avoid overlapping with concurrent lanes in `CLAIMS.md`.

## Next High-Value Lanes

1. `index()`
   - Split dashboard counts, recent request list, ops cards, and
     cross-module KPI tiles into dedicated helpers.
   - Outcome: dashboard changes stop requiring edits across one
     500-line route body.
2. `instrument_detail()`
   - Separate instrument metadata, scheduling state, downtime, and
     assignment/admin payloads.
   - Outcome: easier future module-specific changes per instrument.
3. `request_detail()`
   - Break into mutation dispatch + read model builders.
   - Outcome: safer changes to attachments, notes, status transitions,
     and result delivery flows.
4. `ai_pane_submit()`
   - Separate provider dispatch, parsing, routing, logging, and response
     formatting.
   - Outcome: easier multi-provider support and supervised crawler work.

## Future Extraction Targets

- Move dashboard helpers into a dedicated dashboard/read-model module.
- Move request mutation handlers into a request workflow module.
- Move user/admin helpers into an admin membership module.
- Move finance export helpers into a finance exports module.

## Definition Of Done For A Lightening Lane

- Route reads primarily as orchestration.
- Template payload keys remain stable.
- Compile passes.
- `./venv/bin/python scripts/smoke_test.py` passes.
- Claim row is removed in the shipping commit.
