# CATALYST Crawler Test Plan

## Roles Under Test

| # | Role | Test Account | Password | Key Restrictions |
|---|------|-------------|----------|-----------------|
| 1 | super_admin | dean@lab.local | SimplePass123 | Full access — sees everything |
| 2 | operator | anika@lab.local | SimplePass123 | Instruments + queue for assigned instruments only |
| 3 | requester | sen@lab.local | SimplePass123 | No instruments/queue/stats/calendar access — dashboard + own requests only |
| 4 | finance_admin | finance@lab.local | SimplePass123 | Finance approval stages only — no instruments/queue/calendar |
| 5 | professor_approver | prof.approver@lab.local | SimplePass123 | All instruments visible, approval stages, stats |
| 6 | instrument_admin | fesem.admin@lab.local | SimplePass123 | Assigned instruments only (FESEM) |
| 7 | owner | admin@lab.local | SimplePass123 | Same as super_admin + user management |

## Pages Under Test

| # | Route | Expected Access |
|---|-------|----------------|
| 1 | `/` | ALL roles (scoped dashboard) |
| 2 | `/instruments` | professor_approver, instrument_admin, operator, site_admin, super_admin |
| 3 | `/instruments/<id>` | Only if assigned or can_view_all_instruments |
| 4 | `/schedule` | professor_approver, instrument_admin, operator, site_admin, super_admin |
| 5 | `/calendar` | professor_approver, instrument_admin, operator, site_admin, super_admin |
| 6 | `/stats` | professor_approver, instrument_admin, operator, site_admin, super_admin |
| 7 | `/admin/users` | super_admin, owner only |
| 8 | `/sitemap` | ALL roles |
| 9 | `/requests/<id>` | Only if can_view_request (see rules) |
| 10 | `/me` | ALL roles (own profile) |

## Wave 1 — Role Visibility Audit

For EACH role:
1. Login via `/login`
2. Take screenshot of homepage — verify correct nav items visible
3. Navigate to `/instruments` — verify access or redirect
4. Navigate to `/schedule` — verify access or redirect
5. Navigate to `/calendar` — verify access or redirect
6. Navigate to `/stats` — verify access or redirect
7. Navigate to `/admin/users` — verify access or redirect
8. Navigate to `/sitemap` — verify all role-appropriate links
9. Check `data-vis` attribute filtering — are elements correctly shown/hidden?
10. Log all findings to catalyst_log.json

### Expected Visibility Matrix

| Element | super_admin | operator | requester | finance | prof_approver | inst_admin |
|---------|------------|----------|-----------|---------|---------------|------------|
| Nav: Instruments | YES | YES | NO | NO | YES | YES |
| Nav: Queue | YES | YES | NO | NO | YES | YES |
| Nav: Calendar | YES | YES | NO | NO | YES | YES |
| Nav: Statistics | YES | YES | NO | NO | YES | YES |
| Nav: Map | YES | YES | NO | NO | YES | YES |
| Dashboard: This Week/Month stats | YES | YES | NO* | NO* | YES | YES |
| Dashboard: Instrument Queues | YES | YES | NO | NO | YES | YES |
| User Management | YES | NO | NO | NO | NO | NO |

*requester and finance_admin should see their own request-scoped dashboard, not the instrument stats

## Wave 2 — Architecture & Overflow Audit

For each page (as super_admin):

### A. Overflow / Truncation Checks
1. Resize browser to 1024×768, 1280×800, 1440×900, 1920×1080
2. Check all tables for horizontal overflow
3. Check all text for ellipsis/truncation (especially long instrument names, sample names)
4. Check stat cards at various widths
5. Check calendar view at narrow widths

### B. Empty State Checks
1. Filter queue to show 0 results — is there a "no results" message?
2. Check instrument with no queue items
3. Check stats for instrument with no data

### C. Form Validation
1. Try submitting empty instrument create form
2. Try long text inputs (100+ chars) in all form fields
3. Check date range filters with invalid ranges

### D. Interactive Element Checks
1. All paginated panes: click through pages
2. All filter pills: click each status filter
3. Sort controls: test each sort option
4. Search boxes: type and verify filtering
5. Toggle dark mode: verify all elements remain readable

## Wave 3 — CSS Architecture Fixes

### A. Duplicate Rule Resolution
- Merge `.stat` definitions (lines 1035 vs 3593)
- Merge `.instrument-photo-shell` (lines 1109 vs 3261)
- Merge `.queue-action-stack` (lines 1730 vs 3568)
- Merge `.instrument-card` (lines 2629 vs 3649)
- Merge `.instrument-photo` (lines 1131 vs 3269)

### B. CSS Variable Creation
- `--spacing-xs: 0.3rem` through `--spacing-xl: 1.25rem`
- `--radius-full: 999px`, `--radius-lg: 16px`, `--radius-md: 12px`, `--radius-sm: 8px`
- `--font-xs: 0.7rem` through `--font-xl: 1.48rem`
- `--op-accepting: #5a9b68`, `--op-hold: #d1a64b`, `--op-maintenance: #c06565`
- `--lifecycle-done: #5d9b6a`, `--lifecycle-current: #3b6fc7`

### C. Inline Style Extraction
- instrument_detail.html: 15 inline styles → named classes
- stats.html: 6 inline styles → named classes
- visualization.html: dynamic widths (OK to keep as inline)

## Execution Order

1. Commit this plan to README
2. Execute Wave 1 (role visibility) — log everything
3. Execute Wave 2 (architecture) — log everything
4. Compile error report
5. Fix all issues
6. Execute Wave 3 (CSS cleanup)
7. Re-run Wave 1 + 2 to verify fixes
8. Final commit
