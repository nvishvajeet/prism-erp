# PRISM — Lab Scheduler

A Flask-based sample request and instrument workflow system for MIT-WPU's shared lab facility. Provides sequential approvals (finance → professor → operator), queue management, audit logging, and per-request attachment storage.

---

## Development Schedule

### Wave A: Foundation & Polish ✅
| # | Task | Status | Progress |
|---|------|--------|----------|
| A1 | Graceful 403/404/500 error pages + SVG icons + CSS | ✅ Done | ████████████████████ 100% |
| A2 | Template cleanup — data-vis="all" → {{ V }} (176 occurrences, 4 files) | ✅ Done | ████████████████████ 100% |
| A3 | Fix bounded_pane → paginated_pane (9 calls, 6 files) | ✅ Done | ████████████████████ 100% |
| A4 | Remove redundant V declarations (new_request, budgets, email_preferences) | ✅ Done | ████████████████████ 100% |
| A5 | README benchmark update | ✅ Done | ████████████████████ 100% |

### Wave B: Settings & Navigation ✅
| # | Task | Status | Progress |
|---|------|--------|----------|
| B1 | Redesign sitemap → Apple Settings (sticky sidebar + right panel) | ✅ Done | ████████████████████ 100% |
| B2 | Settings sections: Core, Operations, Reporting, Admin | ✅ Done | ████████████████████ 100% |
| B3 | Instrument nav hover dropdown + status dots (green/yellow/red) | ✅ Done | ████████████████████ 100% |
| B4 | Mobile touch support for nav dropdown | ✅ Done | ████████████████████ 100% |

### Wave C: Panels & Dialog ✅
| # | Task | Status | Progress |
|---|------|--------|----------|
| C1 | Universal input_dialog macro (text + file + routing + note types) | ✅ Done | ████████████████████ 100% |
| C2 | Instrument detail → 5-panel CSS grid (Info, Stats, Queue, Admin, Activity) | ✅ Done | ████████████████████ 100% |
| C3 | Responsive layout: 2-col desktop, 1-col mobile | ✅ Done | ████████████████████ 100% |

### Wave D: Calendar Integration ✅
| # | Task | Status | Progress |
|---|------|--------|----------|
| D1 | instrument_downtime DB table + model | ✅ Done | ████████████████████ 100% |
| D2 | POST /calendar downtime creation + validation | ✅ Done | ████████████████████ 100% |
| D3 | GET /calendar/events JSON API (downtime + requests) | ✅ Done | ████████████████████ 100% |
| D4 | Calendar UI: downtime modal, time-range select, orange blocks | ✅ Done | ████████████████████ 100% |
| D5 | Cross-page calendar: dashboard + instrument detail downtime | ✅ Done | ████████████████████ 100% |

### Wave E: Demo Data & Documentation 🔄
| # | Task | Status | Progress |
|---|------|--------|----------|
| E1 | Full demo populator (25 instruments, 15 faculty, 10 operators, 500 reqs) | 🔲 Pending | ░░░░░░░░░░░░░░░░░░░░ 0% |
| E2 | Rewrite PROJECT.md (current schema, routes, macros, changelog) | 🔲 Pending | ░░░░░░░░░░░░░░░░░░░░ 0% |
| E3 | Document all macros (_page_macros, _request_macros, _stream_macros) | 🔲 Pending | ░░░░░░░░░░░░░░░░░░░░ 0% |
| E4 | Apply chart_bar macro to dashboard weekly/monthly charts | 🔲 Pending | ░░░░░░░░░░░░░░░░░░░░ 0% |

### Wave F: Final Verification ✅
| # | Task | Status | Progress |
|---|------|--------|----------|
| F1 | Full crawl: all 9 roles × all 41 routes (171/171 pass, 0 fail) | ✅ Done | ████████████████████ 100% |
| F2 | 500-action populate crawl (0 server errors, 0 exceptions) | ✅ Done | ████████████████████ 100% |
| F3 | Fix sitemap template bug (dict.items collision) + update test matrix | ✅ Done | ████████████████████ 100% |

### Phase 4: Architectural Improvements (from full crawl audit)

### Wave G: Breathing Room & Visual Density 🔲
| # | Task | Status | Progress |
|---|------|--------|----------|
| G1 | Increase card + table padding (Ive spacing) | 🔲 Pending | ░░░░░░░░░░░░░░░░░░░░ 0% |
| G2 | Reduce table columns to 4-5 max (queue, instruments, finance) | 🔲 Pending | ░░░░░░░░░░░░░░░░░░░░ 0% |
| G3 | Section-level spacing (2rem gaps between major sections) | 🔲 Pending | ░░░░░░░░░░░░░░░░░░░░ 0% |
| G4 | Empty state component (icon + message + action link macro) | 🔲 Pending | ░░░░░░░░░░░░░░░░░░░░ 0% |
| G5 | Rename ambiguous action buttons (Accept→Accept Sample, etc.) | 🔲 Pending | ░░░░░░░░░░░░░░░░░░░░ 0% |

### Wave H: CSS Architecture Cleanup 🔲
| # | Task | Status | Progress |
|---|------|--------|----------|
| H1 | Consolidate 3 duplicate button definitions → single .btn base | 🔲 Pending | ░░░░░░░░░░░░░░░░░░░░ 0% |
| H2 | Extract 50+ hardcoded colors to CSS variables | 🔲 Pending | ░░░░░░░░░░░░░░░░░░░░ 0% |
| H3 | Remove 14 !important instances (rebuild Prism with BEM) | 🔲 Pending | ░░░░░░░░░░░░░░░░░░░░ 0% |
| H4 | Standardize breakpoints to 3 (640/900/1280px) | 🔲 Pending | ░░░░░░░░░░░░░░░░░░░░ 0% |
| H5 | Add :focus, :disabled states + shadow/z-index scales | 🔲 Pending | ░░░░░░░░░░░░░░░░░░░░ 0% |
| H6 | Remove unused DayPilot vendor code | 🔲 Pending | ░░░░░░░░░░░░░░░░░░░░ 0% |

### Wave I: App Architecture & Code Quality 🔲
| # | Task | Status | Progress |
|---|------|--------|----------|
| I1 | Add 6 database indexes (status, instrument+status, approvals) | 🔲 Pending | ░░░░░░░░░░░░░░░░░░░░ 0% |
| I2 | Extract permission check decorator (eliminates 12 duplications) | 🔲 Pending | ░░░░░░░░░░░░░░░░░░░░ 0% |
| I3 | RequestQueryBuilder (centralizes 6 identical SELECT patterns) | 🔲 Pending | ░░░░░░░░░░░░░░░░░░░░ 0% |
| I4 | Cache assigned_instrument_ids() in Flask g context | 🔲 Pending | ░░░░░░░░░░░░░░░░░░░░ 0% |
| I5 | Break up request_detail() (682 lines) into action handlers | 🔲 Pending | ░░░░░░░░░░░░░░░░░░░░ 0% |
| I6 | Request status state machine (enforce valid transitions) | 🔲 Pending | ░░░░░░░░░░░░░░░░░░░░ 0% |

### Wave J: Accessibility & PWA 🔲
| # | Task | Status | Progress |
|---|------|--------|----------|
| J1 | ARIA attributes + focus trapping on modals | 🔲 Pending | ░░░░░░░░░░░░░░░░░░░░ 0% |
| J2 | Apple meta tags (theme-color, touch-icon, PWA manifest) | 🔲 Pending | ░░░░░░░░░░░░░░░░░░░░ 0% |
| J3 | Toast notification system (replace flash messages) | 🔲 Pending | ░░░░░░░░░░░░░░░░░░░░ 0% |
| J4 | Client-side form validation with inline error states | 🔲 Pending | ░░░░░░░░░░░░░░░░░░░░ 0% |

### Wave K: Production Features 🔲
| # | Task | Status | Progress |
|---|------|--------|----------|
| K1 | Per-instrument custom request form fields | 🔲 Pending | ░░░░░░░░░░░░░░░░░░░░ 0% |
| K2 | Bulk operations on queue (select, approve, assign, download) | 🔲 Pending | ░░░░░░░░░░░░░░░░░░░░ 0% |
| K3 | Notification system (approval emails, reminders) | 🔲 Pending | ░░░░░░░░░░░░░░░░░░░░ 0% |
| K4 | Cost/grant tracking + invoice generation | 🔲 Pending | ░░░░░░░░░░░░░░░░░░░░ 0% |
| K5 | Approval chain customization UI | 🔲 Pending | ░░░░░░░░░░░░░░░░░░░░ 0% |
| K6 | Security: CSRF protection + demo mode gating | 🔲 Pending | ░░░░░░░░░░░░░░░░░░░░ 0% |

### Wave L: Documentation & API 🔲
| # | Task | Status | Progress |
|---|------|--------|----------|
| L1 | /api/v1 JSON blueprint (requests, instruments, actions) | 🔲 Pending | ░░░░░░░░░░░░░░░░░░░░ 0% |
| L2 | OpenAPI/Swagger documentation | 🔲 Pending | ░░░░░░░░░░░░░░░░░░░░ 0% |
| L3 | .env.example + config.py (dev/prod configs) | 🔲 Pending | ░░░░░░░░░░░░░░░░░░░░ 0% |

### Overall Progress

```
Phase 3 — MVP Build
Wave A  Foundation & Polish     [████████████████████] 100%  5/5
Wave B  Settings & Navigation   [████████████████████] 100%  4/4
Wave C  Panels & Dialog         [████████████████████] 100%  3/3
Wave D  Calendar Integration    [████████████████████] 100%  5/5
Wave E  Demo Data & Docs        [░░░░░░░░░░░░░░░░░░░░]   0%  0/4
Wave F  Final Verification      [████████████████████] 100%  3/3
─────────────────────────────────────────────────────────────
Phase 3 subtotal                                       83%  20/24

Phase 4 — Architectural Improvements
Wave G  Breathing Room          [░░░░░░░░░░░░░░░░░░░░]   0%  0/5
Wave H  CSS Architecture        [░░░░░░░░░░░░░░░░░░░░]   0%  0/6
Wave I  App Architecture        [░░░░░░░░░░░░░░░░░░░░]   0%  0/6
Wave J  Accessibility & PWA     [░░░░░░░░░░░░░░░░░░░░]   0%  0/4
Wave K  Production Features     [░░░░░░░░░░░░░░░░░░░░]   0%  0/6
Wave L  Documentation & API     [░░░░░░░░░░░░░░░░░░░░]   0%  0/3
─────────────────────────────────────────────────────────────
TOTAL (all phases)              [████████░░░░░░░░░░░░]  37%  20/54
```

---

## Benchmark (2026-04-10)

| Metric | Value |
|--------|-------|
| app.py | 6,413 lines |
| Routes | 41 |
| DB tables | 15 |
| Templates | 28 HTML files |
| CSS | 5,700+ lines |
| Roles | 9 (with ROLE_ACCESS_PRESETS) |
| Orphaned data-vis="all" | 0 (was 176) |
| Stale bounded_pane calls | 0 (was 9) |
| 500-action crawl errors | 0 |
| Visibility audit (8 roles) | 171/171 pass |
| Finance admin | Full instrument area access |

---

## Commit History (Recent)

| Hash | Summary |
|------|---------|
| `c538dcd` | Instrument 5-panel grid + calendar downtime UI |
| `9bc6d03` | Redesign settings page (Apple style) + instrument nav dropdown |
| `a2f2e84` | Add graceful error pages (403/404/500) with minimal Ive-style design |
| `3833985` | Fix remaining bounded_pane calls + update README with wave progress |
| `0b953a8` | Fix 7 orphaned templates: data-vis consistency + paginated_pane |
| `fc468fa` | Grant finance_admin full instrument area access |
| `846244d` | Fix 4 issues found by visibility audit + add audit test |
| `e4d0d35` | Fix 3 bugs found by 500-action crawl + update crawler |
| `3b04696` | Add 500-action data-populating crawl test |
| `659b9c5` | Update README progress percentages |
| `7599887` | Add /requests/duplicate + /profile/change-password routes |
| `c9b2f2e` | Add announcements table + /api/health-check endpoint |

---

## Quick Start

```bash
cd Main
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python app.py
```

Open: `http://127.0.0.1:5055`

To populate richer demo data:

```bash
.venv/bin/python populate_live_demo.py
```

## Demo Accounts

Password: `SimplePass123`

| Account | Role |
|---------|------|
| `admin@lab.local` | Owner (full access) |
| `finance@lab.local` | Finance Admin |
| `prof.approver@lab.local` | Professor Approver |
| `fesem.admin@lab.local` | Instrument Admin (FESEM) |
| `anika@lab.local` | Operator |
| `sen@lab.local` | Requester |

## AI Agent Workflow Rules

1. **Always commit before starting** a new task.
2. **Write the plan in PROJECT.md** (Roadmap section) before coding.
3. **Break work into <5 min tasks**. Use parallel agents where possible.
4. **Commit after finishing** each task. Never leave uncommitted work.
5. If the last job wasn't completed, revert via git, re-read the plan, complete it, then move on.

## Full Documentation

- **PROJECT.md** — Complete specification, architecture, database schema, every route, every template macro. Read this to rebuild the system from scratch.
- **CRAWL_PLAN.md** — Role-based access testing plan and test account matrix.
- **CSS_COMPONENT_MAP.md** — All CSS classes and component patterns used across templates.
- **SECURITY_TODO.md** — Security hardening checklist and HTTPS migration tracker.
- **ROLE_VISIBILITY_MATRIX.md** — Every page and UI element mapped to the roles that can access it.
- **TODO_AI.txt** — Active task list and execution roadmap (also embedded in PROJECT.md § Roadmap).

## Development Mode

Enable template auto-reload and Flask debug mode:

```bash
LAB_SCHEDULER_DEBUG=1 python3 app.py
```

Without this flag, Flask caches compiled templates in memory and changes require server restart.

## Testing

Run a lightweight regression smoke test:

```bash
.venv/bin/python smoke_test.py
```

## File Uploads

- **Location:** `uploads/users/<user_id>/requests/req_<id>_<request_no>/attachments/`
- **Max file size:** 100 MB per file
- **Allowed types:** pdf, png, jpg, jpeg, xlsx, csv, txt
- **Export location:** `exports/` (generated Excel reports)

See PROJECT.md for full specification.
