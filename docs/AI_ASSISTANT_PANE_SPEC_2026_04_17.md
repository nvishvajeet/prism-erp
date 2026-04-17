# AI Assistant Pane — spec (Codex-ready)

**Status:** designed, NOT yet shipped. Codex can start on this after finishing its current ticket.
**Operator directive 2026-04-17 20:05 Paris:** "Design an AI assistant UI — perhaps there exists one already — so people can submit requests site-wide just by hovering. Minimizable. Quarter horizontal width. Can be minimized like a search bar. People can add files too. Routes requests."

---

## One-line summary

A site-wide hover pane, bottom-right, quarter viewport width. Minimized state = one-line search bar. Expanded state = chat textarea + file upload + action-route buttons. Every submit goes through `/api/ai/pane/submit` (already exists — see `ai_pane_submit()` in `app.py`) and is routed by server-side NLP to an action (navigate, file a ticket, answer, noop).

## Precedent — existing code to reuse

`app.py` already has:
- `/api/ai/pane/submit` POST route (line ~30017) — accepts `{message, page_context, file?}`, logs to `ai_pane_log`, classifies into `{action, action_data}`.
- `ai_pane_record_submission()` + `_ai_pane_parse_submission()` + `_ai_pane_route_label()` helpers.
- `static/ai_pane.js?v=1` loaded in `base.html` (line 411).
- `ai_pane_log` + `ai_prospective_actions` + `ai_action_routes` DB tables.

**Most of the backend is already shipped.** This spec is about the **UI pane widget**.

## UX — 3 states

### State 1: hidden (default)
Nothing visible except a small floating pill bottom-right: `🤖 Ask AI`.

### State 2: minimized search-bar (click the pill)
Quarter viewport width, horizontal single-line input. Like Spotlight or Algolia search. Placeholder: *"Ask anything — navigate, file a bug, ask a question, upload a file…"*

- Enter submits (POST `/api/ai/pane/submit`).
- Esc collapses to state 1.
- Up-arrow scrolls recent messages.
- Click the ↗ button to expand to state 3.

### State 3: expanded (click expand icon OR type a long message)
Quarter viewport width, taller. Contents top-to-bottom:
- Title bar with **Close (×)** + **Minimize (→)**
- Recent 5 messages (scrollable history)
- File drop-zone (drag a PDF/xlsx/png → attaches)
- Multi-line textarea
- Action-suggestion chips (live as user types): *Navigate to /payments* / *File a bug* / *Ask Kondhalkar* / *Download latest sample report*
- **Submit** button + keyboard shortcut Cmd/Ctrl-Enter

## Routing (server classifies)

On submit, the server returns `{action, action_data, ui_hint}`:

| action | meaning | UI does |
|---|---|---|
| `navigate` | go to a URL | `window.location = action_data.href` |
| `answer` | text response | render inline in the pane |
| `file_bug` | creates ticket | toast "Bug filed as T_XXX" + link |
| `upload_analyzed` | file parsed + summary | render summary + link to artifacts |
| `noop` | can't act | render "I don't know how to help with that yet" |
| `confirm` | needs confirmation | render [Yes] / [No] buttons |

## Data model (already exists, no new tables)

- `ai_pane_log` — per-submission audit. Columns: user_id, page_context, user_message, ai_response, action_taken, action_data, file_name, tokens_used, created_at.
- `ai_prospective_actions` — suggested actions the AI couldn't auto-route; operator approves.
- `ai_action_routes` — static routing rules (slug → endpoint).

## What Codex ships in this ticket

`static/ai_pane.js` already exists — audit it + upgrade to the 3-state UX above. Expected diff: ~150 lines.

- **State machine:** `AIPane.state = 'hidden' | 'search' | 'expanded'`.
- **DOM structure:** single `<div id="ai-pane">` appended to `<body>`, with inner states swapped by class.
- **CSS:** add to `static/styles.css` a block similar to `.tester-pane` — floating, rounded, z-index 9997 (below feedback 9999 and tester 9998).
- **Keyboard:** Cmd/Ctrl-K opens state 2, Esc collapses.
- **File upload:** existing `/api/ai/pane/submit` accepts multipart `file` — wire a `<input type="file">` that POSTs as FormData.
- **History:** load last 10 entries from `ai_pane_log` on expand (new GET endpoint `/api/ai/pane/history`).
- **Throttling:** rate-limit via existing flask-limiter (ensure `@limiter.limit("30/hour")` on the submit endpoint).
- **Persistence:** state (collapsed/expanded) in `localStorage`, messages in `sessionStorage`.

## Non-goals for this ticket

- Not a full chat app. Single-turn requests, each submitted independently. Threaded history is state-3 nice-to-have.
- No streaming (first version). Wait for full response, render. SSE comes later in Axis-1 of IMPROVEMENTS_ROADMAP.
- No user-to-user chat. The pane talks to the server AI, not to Kondhalkar.

## UI reference (existing patterns in the tree)

- **Feedback widget** — `templates/_feedback_widget_markup.html` — floating bottom-right, click-to-open, similar state-machine behavior. **Mirror its pattern closely.**
- **Tester pane** (shipped this commit) — `templates/_tester_pane.html` — floating bottom-left, collapsible, keyboard shortcuts. Parallel visual style (gradient, white buttons, rounded).
- **Eruda console** (at `/debug`) — full-screen overlay, but gives the "developer tool" feel to use as style inspiration.

## Codex sub-tickets (break this into small commits)

- **AI1** — Audit existing `static/ai_pane.js`: is there already a pane? If yes, what does it do? Write findings to `docs/AI_PANE_AUDIT_2026_04_17.md`. Commit.
- **AI2** — State 1 + pill. `templates/_ai_pane.html` fragment + CSS block in `static/styles.css`. Include fragment in `templates/base.html` right after `_tester_pane.html`. Commit.
- **AI3** — State 2 (search-bar) + Cmd/Ctrl-K shortcut. Submit POSTs to `/api/ai/pane/submit`. Commit.
- **AI4** — State 3 (expanded) + file upload drop-zone + history API + 5 recent entries. Commit.
- **AI5** — Action-suggestion chips + `ai_action_routes` lookup. Commit.
- **AI6** — Rate limit + PII scrub + `ai_pane_log` audit row on every submit. Commit.

Each sub-ticket ships independently, smoke green, cherry-pick to v1.3.0.

## Where Codex starts

Run `grep -n 'AIPane\|ai_pane\|AI_PANE' static/ai_pane.js | head -30` to see the existing surface. Then `git log --oneline static/ai_pane.js` for history. Decide: extend existing, or rewrite cleanly. My guess based on commits: existing pane is basic; rewrite cleanly per spec above.
