# PRISM UI Grid Reference

Use these numbered element IDs to suggest changes. Say something like "change #5 on Homepage" or "move #12 on Queue page".

---

## Homepage (`/`)

| # | Element | Description |
|---|---------|-------------|
| 1 | `<header> .topbar` | Top bar with logo + user info |
| 2 | `<div> .topbar-right` | User name + logout area |
| 3 | `<button> .theme-toggle` | Dark/light mode toggle |
| 4 | `<nav> .nav` | Navigation bar (Home, Instruments, Queue, Calendar, Statistics, Map) |
| 5 | `<section> .grid-two` | Two-column stats layout container |
| 6 | `<div> .card` — "This Week" | Weekly stats card (Jobs Done, Samples Done, Pending, Avg Return) |
| 9 | `<section> .stats` | Stats counters row inside This Week card |
| 10 | `<div> .chart-list` | Daily bar chart rows (dates + counts) |
| 17 | `<div> .card` — "This Month" | Monthly stats card (Jobs Done, Samples Done) |
| 20 | `<section> .stats` | Stats counters row inside This Month card |
| 21 | `<div> .chart-list` | Weekly bar chart rows (week numbers + counts) |
| 32 | `<section> .card` — "Instrument Queues" | Main instrument queues section |
| 34 | `<h2>` — "Instrument Queues" | Section heading |
| 35 | `<a> .btn` — "Open Queue" | Button to open full queue page |
| 37 | `<input>` | Search box "Type job number or sample number" |
| 40-43 | `<div> .paginated-pane` + blobs | Individual request blobs (REQ-00156, REQ-00115, J2780872, etc.) |

---

## Instruments Page (`/instruments`)

| # | Element | Description |
|---|---------|-------------|
| 1 | `<header> .topbar` | Top bar |
| 4 | `<nav> .nav` | Navigation |
| 5 | `<section>` — "Instruments" | Page section with heading |
| 6 | `<div> .section-head` | Section header row with "Instruments" title |
| 8 | `<button>` — "+" | Add new instrument button |
| 9 | `<section> .card` | Main instruments table card |
| 10 | `<div> .paginated-pane` | Paginated container |
| 12 | `<table> .instruments-table` | Instruments data table |
| Columns: | NAME | AVG RETURN | OPERATOR | FACULTY IN-CHARGE | LOCATION | OFFICE | LINKS |
| 13+ | `<a> .text-link` | "Open Queue" / "Calendar" / "History" links per instrument |
| 25-30 | Archived instruments section | Below main table |

---

## Queue Page (`/schedule`)

| # | Element | Description |
|---|---------|-------------|
| 5 | `<section>` | Page header section |
| 6 | `<h2>` — "Jobs" | Page title |
| 7 | `<section> .card` — filter tabs | Status filter tabs bar |
| 9 | `<button>` — "All 286" | "All" tab (shows total count) |
| 10 | `<button>` — "Pending 131" | Pending filter tab |
| 11 | `<button>` — "Approvals 33" | Approvals filter tab |
| 12 | `<button>` — "Pending Receipt 19" | Pending Receipt filter tab |
| 13 | `<button>` — "Ready 27" | Ready filter tab |
| 14 | `<button>` — "Active 52" | Active filter tab |
| 15 | `<button>` — "Completed 98" | Completed filter tab |
| 16 | `<button>` — "Rejected 16" | Rejected filter tab |
| 17 | `<button>` — "Unsubmitted 41" | Unsubmitted filter tab |
| 18 | `<input>` — Search | Search box for requests |
| 19 | `<select>` — Instrument | Instrument dropdown filter |
| 20 | `<input>` — From date | Date range start |
| 21 | `<input>` — To date | Date range end |
| 22 | `<select>` — Sort | Sort order dropdown |
| 23 | `<section> .card` | Queue table card |
| 26 | `<table>` | Main queue data table |
| Columns: | REQUEST | STAGE | INSTRUMENT | REQUESTER | TIME | OPERATOR | FILES | ACTION |

---

## Statistics Page (`/stats`)

| # | Element | Description |
|---|---------|-------------|
| 5 | `<section> .card` — "Operations Control" | Top operations control section |
| 6 | `<div> .filter-bar` | Instrument filter buttons (All, INST-008, INST-004, etc.) + time range (W/M/Y/All) |
| 7 | `<section> .card` — live stats | Live operational stats counters |
| 8-15 | `<div> .stat` | Individual stat cards: Active Now (52), In Queue (46), Pending (74), Total Open (172), This Week Done (12), Samples Done (74), MTD Jobs (20), Avg/Week (4.6) |
| 16 | `<section> .card` — "Instrument Status Board" | Per-instrument status cards grid |
| 20 | `<div> .card` — "Throughput Trend" | Line chart card (Jobs vs Samples trend) |
| 25 | `<canvas>` | Chart.js throughput chart |
| 36 | `<div> .card` — "Status Breakdown" | Doughnut chart card |
| 40 | `<canvas>` | Chart.js doughnut chart |

---

## Calendar Page (`/calendar`)

| # | Element | Description |
|---|---------|-------------|
| 5 | `<section>` | Instrument filter pills (All Instruments, AFM, DSC, FESEM, etc.) |
| 6 | `<div>` | Status filter pills (Scheduled, In Progress, Completed, Maintenance) |
| 7 | `<select>` — Operator | Operator dropdown filter |
| 8 | `<button>` — "Apply" | Apply filters button |
| 9 | `<section>` | Calendar widget section |
| 11-12 | `<button>` | Previous/Next week navigation arrows |
| 13 | `<button>` — "Today" | Jump to today button |
| 14 | `<h2>` — "Apr 6 – 12, 2026" | Current week date range |
| 15-17 | `<button>` | Month/Week/Day view toggles |
| 18 | `<table>` | Weekly calendar grid with time slots and events |

---

## Instrument Detail Page (`/instruments/10` — HPLC)

| # | Element | Description |
|---|---------|-------------|
| 5 | `<section>` — breadcrumb | "Instruments > HPLC" with operation status badge |
| 8 | `<a> .btn` — "Open Queue" | Link to full queue filtered to this instrument |
| 9 | `<section> .card` — stats | Instrument stats (Pending: 13, Active: 6, Done This Week: 1, Total Done: 10, Avg Return: 12d) |
| 14 | `<section> .card` — Queue | Inline queue for this instrument |
| 16-22 | `<button>` | Queue filter tabs (All, Pending, Approvals, Receipt, Ready, Active, Done) |
| 25 | `<table>` | Queue table (REQUEST, STAGE, TIME, ACTION columns) |
| 35 | `<section> .card` — "Machine" | Machine info card (photo, code, location, make, model, operators, faculty, notes) |
| 38 | `<a>` — "Edit" | Edit instrument button |
| 25+ | Events section | Recent events/audit log at bottom |
| 41+ | Control Panel section | Admin controls at bottom right |
