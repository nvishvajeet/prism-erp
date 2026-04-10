# Ollama Observations

This file is the hand-reviewable log of what Ollama sees when it
is used as a **QA observer crawler** against PRISM's rendered pages.
It is checked into the repo (not gitignored) so the probe's data
travels with the code and we can grade llama3's usefulness over
time without losing the history.

The strategy lives at
`crawlers/strategies/ollama_observer.py`. Run it explicitly:

    venv/bin/python -m crawlers run ollama_observer

Requirements:
  - Local Ollama serving at `127.0.0.1:11435`
    (`OLLAMA_HOST=127.0.0.1:11435 ollama serve &`)
  - Model `llama3:latest` pulled locally

Each run appends a new `## Observer session …` block below.
Within a session, one sub-entry per (role × route) pair. The raw
JSON transcript for the session lands in
`ollama_outputs/observer_<ts>.txt` (gitignored).

## What we are testing

Llama3:8B failed at structural code edits (see
`ollama_qc_log.md` session `qc-20260410-155532`). This probe
asks a different question: **is the same model useful for
observational, free-text narration of rendered UI?** The answer
will be "yes", "no", or "useful in a specific subset" — and this
file is where we keep the evidence either way.

Quality signals to watch for when grading a session:
  - Does the narration describe features that actually appear in
    the page text, or does it invent buttons/tables/stats that
    aren't there?
  - Does it notice empty states, broken rendering, missing data?
  - Does it stay factual, or does it editorialize?
  - Does it obey the "three bullets, under 40 words" constraint?
  - Does it vary between pages, or collapse into boilerplate?


## Observer session 20260410-140445
- Model: llama3:latest
- Reachable: True
- Roles: super_admin, requester
- Paths: /, /schedule, /instruments, /stats

### super_admin — `/` (HTTP 200)
*excerpt 405 chars, ollama 5.75 s*

- The page displays a simple navigation menu for the user, with links to various sections including "Home", "Instruments", "Queue", and "Statistics".
- The main content area shows a dashboard-like view of lab schedule statistics, including number of jobs done, samples done, pending, and average return time.
- The calendar view is incomplete, showing only a single entry for October 4th, 2026; the rest of the calendar appears to be empty.

### super_admin — `/schedule` (HTTP 200)
*excerpt 1148 chars, ollama 3.75 s*

- The page displays a list of sample requests with various instruments, statuses, and requester information.
- The queue display appears useful, allowing the super admin to view and manage multiple requests at once.
- The "Assign" and "Choose operator..." links seem functional, but it's unclear if they actually perform an action or are just placeholders.

### super_admin — `/instruments` (HTTP 200)
*excerpt 898 chars, ollama 4.08 s*

- The page displays a list of instruments with various information, including name, code, category, location, and daily capacity.
- The instrument "FESEM" appears to be accepting requests, with a status update indicating it is currently occupied for 2 days by Anika, Prof. Sen, and Central Instrument Facility.
- There are no apparent errors or empty sections on the page; the content appears complete and functional.

### super_admin — `/stats` (HTTP 200)
*excerpt 1350 chars, ollama 4.31 s*

- The page shows various statistics about lab instruments, including instrument status, throughput trends, turnaround times, and top requesters.
- The "Statistics" section appears to be useful for super admin users, providing an overview of instrument performance and user activity.
- Some sections, such as the "Recent Activity" and "Under Review" lists, appear empty.

### requester — `/` (HTTP 200)
*excerpt 353 chars, ollama 2.95 s*

- The page displays the main navigation menu with "Home", "Instruments", "Queue", and "Calendar" options.
- The instruments listed seem useful, providing a clear view of available equipment for scheduling requests.
- The "New Request" button is present, indicating that users can initiate new request creation from this page.

### requester — `/schedule` (HTTP 200)
*excerpt 591 chars, ollama 3.45 s*

- The page appears to be a lab sample-request scheduler, with various instruments and their corresponding equipment listed.
- A "New Request" button is present, which could be useful for requesting a new sample analysis.
- There are no request entries displayed on the page, despite there being a "Queue" section; it's unclear if this is an empty queue or if there was an error in retrieving requests.

### requester — `/instruments` (HTTP 200)
*excerpt 440 chars, ollama 3.46 s*

- The page displays a list of available instruments for the requester role, with columns for name, status, average return time, operator, faculty in-charge, and location.
- The "Queue" and "Calendar" sections are empty, suggesting that no requests are currently scheduled or active.
- The "Links" section contains an arrow pointing to a view of instrument INST-003 XRD, but the link is not clickable.

### requester — `/stats` (HTTP 200)
*excerpt 1253 chars, ollama 4.41 s*

- The page displays statistics and instrument status for the requester role, including completed samples, active instruments, and pending requests.
- The "Queue Calendar" section shows a breakdown of samples in different stages (Live, In Queue, Pending, Total Open), which appears useful for tracking sample progress.
- The "Instrument Status Board" is currently empty, showing no data available for each instrument.



## Observer session 20260410-144249 (fast)
- Model: llama3:latest
- Reachable: True
- Roles (2): super_admin, requester
- Paths (4): /, /schedule, /instruments, /stats

### super_admin — `/` (HTTP 200) — flags: empty
*excerpt 405 chars, ollama 6.97 s*

- The page displays a simple navigation menu with various options, including "Home", "Instruments", and "Queue Calendar".
- The main content area shows an overview of the lab's current requests and status, including pending jobs and samples.
- The "This Week" and "This Month" sections appear to be empty, indicating no data is available for these timeframes.

### super_admin — `/schedule` (HTTP 200) — flags: empty
*excerpt 1148 chars, ollama 3.70 s*

- The page displays a schedule calendar with multiple requests, including instruments like FESEM and XRD.
- The filter search option allows users to narrow down requests by instrument, status, or time period.
- The queue is currently empty of unselected requests, but the bulk actions menu suggests that requests can be assigned to operators.

### super_admin — `/instruments` (HTTP 200) — flags: empty, error
*excerpt 898 chars, ollama 3.47 s*

- The page displays a list of available instruments, categorized by type (e.g., Electron Microscopy, Spectroscopy).
- The "Active Instruments" section shows the current status and assigned operators for each instrument.
- There are no errors or empty sections; all instruments have a non-empty "Name", "Status", and "Avg Return" fields.

### super_admin — `/stats` (HTTP 200)
*excerpt 1350 chars, ollama 3.80 s*

- The page appears to show a dashboard for super admins, providing statistics and instrument status.
- The "Statistics" section displays various metrics, including completed requests, pending requests, and instrument throughput.
- The "Instrument Status Board" section shows the current status of each instrument, with no instruments currently active or pending.

### requester — `/` (HTTP 200) — flags: incomplete
*excerpt 353 chars, ollama 2.79 s*

- The page displays a simple, clean layout with clear navigation options at the top (Logout, Home, Instruments, and more).
- The "New Request" button appears useful for creating new sample requests.
- The queue statistics display (Jobs Done, Samples Done, Pending) seems incomplete, with no data populated.

### requester — `/schedule` (HTTP 200) — flags: empty
*excerpt 591 chars, ollama 2.70 s*

- The page displays the lab scheduler's main content, with navigation options and filtering controls.
- The "Queue" section appears empty, displaying a message indicating no jobs were found when filtered.
- The "New Request" button is present, allowing users to initiate a new request.

### requester — `/instruments` (HTTP 200) — flags: empty
*excerpt 440 chars, ollama 2.70 s*

- The page displays a list of instruments with names, statuses, and links to view each instrument.
- The "Queue" column is empty for all instruments, which may be intended as there are no active requests displayed.
- The calendar link at the bottom of the page looks useful for scheduling requests.

### requester — `/stats` (HTTP 200)
*excerpt 1253 chars, ollama 4.63 s*

- The page displays a dashboard for the requester role, providing an overview of laboratory instrument status and request statistics.
- The "Statistics" section shows various counters, including active, pending, and completed requests, as well as throughput trends and turnaround times.
- The "Instrument Status Board" lists the instruments and their current statuses (active, queued, or pending), but the "Throughput Trend" and "Weekly Overview" sections contain no data.



## Observer session 20260410-144431 (full)
- Model: llama3:latest
- Reachable: True
- Roles (4): super_admin, finance_admin, operator, requester
- Paths (10): /, /schedule, /instruments, /instruments/1, /calendar, /stats, /requests/new, /me, /sitemap, /docs

### super_admin — `/` (HTTP 200) — flags: empty
*excerpt 405 chars, ollama 2.72 s*

- The page appears to be a dashboard for the Lab Scheduler MVP, with options for facility administrators and super admins.
- The queue and calendar sections display some data, including jobs done, samples done, and pending requests.
- The "This Week" and "This Month" sections are empty.

### super_admin — `/schedule` (HTTP 200) — flags: empty, incomplete
*excerpt 1148 chars, ollama 4.01 s*

- The page displays a list of scheduled requests for various instruments, including FESEM, ICP-MS, and XRD.
- A useful feature is the ability to filter search by instrument, status, or time range using the provided dropdown menus and date picker.
- The queue appears incomplete, as there are only three request entries displayed, and the "Bulk Actions" section at the top is empty.

### super_admin — `/instruments` (HTTP 200) — flags: empty
*excerpt 898 chars, ollama 3.28 s*

- The page displays a list of instruments with their names, codes, categories, locations, and statuses.
- The "Add Instrument" and "Cancel" buttons suggest the ability to manage instruments, which appears useful for the Super Admin role.
- The "Queue" calendar is empty, indicating no pending requests.

### super_admin — `/instruments/1` (HTTP 200) — flags: empty
*excerpt 1800 chars, ollama 4.12 s*

- The page displays the details of an instrument (FESEM INST-001) with its status as "Active" and category as "Microscopy".
- The queue calendar shows a pending request (REQ-1001) under review, along with other request stages.
- The metadata tile appears to be empty, except for some basic instrument details and team assignments.

### super_admin — `/calendar` (HTTP 200) — flags: empty
*excerpt 629 chars, ollama 3.14 s*

- The page shows a calendar layout with various instruments and their schedules, allowing the super admin to view and manage lab requests.
- The "All Instruments" tab is useful for quickly accessing information about all available instruments.
- The "Maintenance Operator" section appears empty, potentially indicating that there are no assigned maintenance operators or no scheduled maintenance tasks.

### super_admin — `/stats` (HTTP 200) — flags: missing
*excerpt 1350 chars, ollama 4.12 s*

- The page displays various statistics, including instrument statuses, queue counts, and throughput trends.
- The "Top Requesters" section shows recent requests with corresponding request IDs, submitter names, dates, and statuses.
- The page appears to be missing any filtering or sorting options for the statistics tables, making it difficult to drill down into specific data.

### super_admin — `/requests/new` (HTTP 200) — flags: empty, error
*excerpt 1009 chars, ollama 3.47 s*

- The page displays a list of instruments and their corresponding codes, locations, capacities, and operations.
- The instrument selection dropdown contains various options for facilities admin, with no apparent issues or errors.
- The page appears to be partially empty, lacking any actual request form data; the "Create Request Card" section remains blank.

### super_admin — `/me` (HTTP 200) — flags: empty
*excerpt 745 chars, ollama 3.66 s*

- The page shows the user's metadata, including name, email, and role, under "My History Home User Metadata Identity".
- The "New Request" button and instrument list are available, indicating that request creation is possible from this page.
- The "Submitted Work Jobs", "Completed Jobs", and other sections appear empty, suggesting that there are no submitted or completed requests for the super admin to view.

### super_admin — `/sitemap` (HTTP 200) — flags: empty
*excerpt 943 chars, ollama 3.32 s*

- The page displays a navigation menu with multiple options for the Super Admin role, including "New Request", "My Profile", and "Job Queue".
- The "Queue" section appears to provide an overview of open and completed jobs, as well as historical data.
- The "Calendar" view seems empty, indicating no scheduled events or downtime.

### super_admin — `/docs` (HTTP 200)
*excerpt 1800 chars, ollama 4.10 s*

- The page shows the project documentation for PRISM, including an introduction, system specification, and architecture details.
- The "Live view of PROJECT.md" section displays the complete system specification, with links to related files (README, TODO_AI, CHANGELOG).
- The philosophy section outlines the request-tracking approach using "Request Cards", with sliced visibility and tiles representing different concerns.

### finance_admin — `/` (HTTP 200) — flags: incomplete
*excerpt 363 chars, ollama 3.13 s*

- The page appears to be a dashboard for the finance admin role, displaying available instruments and their corresponding IDs.
- The "Queue", "Calendar", "Statistics", and "Settings" sections appear useful for managing lab requests.
- The "New Request" button is present, but there are no job or sample details displayed, suggesting that these features may be incomplete.

### finance_admin — `/schedule` (HTTP 200) — flags: empty
*excerpt 603 chars, ollama 2.98 s*

- The page displays a list of sample requests, with columns for instrument status, requester, time filed, and file name.
- The filter search bar allows users to narrow down the request list by date range or status.
- There is no data displayed in the "Calendar" section, which appears empty.

### finance_admin — `/instruments` (HTTP 200) — flags: empty
*excerpt 829 chars, ollama 3.10 s*

- The page displays a list of instruments, their names, and their current status (accepting or not).
- The links to "View →" for each instrument provide additional information.
- Some fields are empty (e.g., Avg Return Operator), and there is no apparent filtering or sorting options available.

### finance_admin — `/instruments/1` (HTTP 200) — flags: empty
*excerpt 1002 chars, ollama 3.23 s*

- The page shows a list of instruments with their details, including status, category, location, and notes.
- The instrument INST-001 FESEM is selected, showing its active status and high-resolution imaging capabilities.
- The queue calendar section appears empty, showing no scheduled downtime or recent activity.

### finance_admin — `/calendar` (HTTP 200) — flags: empty
*excerpt 420 chars, ollama 2.55 s*

- The page displays a calendar view with scheduled, in progress, and completed requests.
- Useful features include the ability to filter by instrument type (e.g., FESEM) and operator (e.g., Anika).
- The "Maintenance" section is empty.

### finance_admin — `/stats` (HTTP 200)
*excerpt 1266 chars, ollama 4.12 s*

- The page appears to display various statistics and instrument status for the lab, including throughput trend charts and requesters' information.
- The "New Request" section is not populated, but there are some sample requests shown (REQ-1001-1003) with their statuses (Awaiting Sample Submission or Completed).
- The "Weekly Throughput" chart shows no data.

### finance_admin — `/requests/new` (HTTP 200) — flags: empty, unclear
*excerpt 1007 chars, ollama 3.49 s*

- The page displays a list of instruments and users with various roles, including the finance admin role.
- The "New Request" section is visible, but it's unclear what fields are required or what options are available for creating a new request.
- The instrument dropdown menu appears to be empty, as there are no listed instruments to select from.

### finance_admin — `/me` (HTTP 200)
*excerpt 747 chars, ollama 3.32 s*

- The page shows the finance admin's dashboard with various sections for instruments, queue, calendar, statistics, and settings.
- The "My History" section appears useful for tracking previous requests and their status.
- The "No submitted jobs yet." message at the bottom of the "Submitted Jobs" section suggests that no requests have been submitted by this finance admin.

### finance_admin — `/sitemap` (HTTP 200) — flags: empty
*excerpt 806 chars, ollama 3.78 s*

- The page displays a sitemap for the PRISM lab sample-request scheduler, showing various navigation options for a finance admin user.
- The navigation menu is organized into categories (General, Operations, Reporting), and includes links to key features like the job queue, completed jobs, and statistics.
- The page appears to be populated with data, but some sections (e.g., Instruments, Job Queue) have limited information or are empty.

### finance_admin — `/docs` (HTTP 200) — flags: empty
*excerpt 1800 chars, ollama 3.83 s*

- The page displays the PRISM project documentation, including system architecture specification and version history.
- Useful features include live view of PROJECT.md, links to related files (README.md, TODO_AI.txt, CHANGELOG.md), and reference implementation for instrument detail template.
- The Calendar and Statistics pages appear empty or not rendered.

### operator — `/` (HTTP 200) — flags: empty
*excerpt 389 chars, ollama 2.85 s*

- The page displays a navigation menu with links to various sections, including "Home", "Instruments", and "Queue".
- The "This Week" and "This Month" tabs provide summary statistics for the current week and month.
- The main content area appears empty, with only a few instrument names listed.

### operator — `/schedule` (HTTP 200) — flags: unavailable
*excerpt 929 chars, ollama 3.19 s*

- The page appears to display a list of scheduled requests for the operator, with filters and sorting options available.
- The queue is populated with existing requests, showing status updates, instrument assignments, and request details.
- The "Assign" button seems unavailable until an operator is chosen from the dropdown menu.

### operator — `/instruments` (HTTP 200) — flags: empty, error
*excerpt 523 chars, ollama 3.30 s*

- The page displays a list of instruments with their names, statuses, and links to view details.
- The "Active Instruments" section shows two instruments, FESEM and Microscopy FESEM, both accepting requests and linked to their respective details pages.
- The page appears to be empty in terms of content below the main list, with no error messages or additional information.

### operator — `/instruments/1` (HTTP 200) — flags: empty
*excerpt 1367 chars, ollama 3.64 s*

- The page shows a list of instruments, with INST-001 FESEM being the selected instrument.
- The "At A Glance" section provides a quick overview of the instrument's status (Active) and queue information (Pending, Active, Completed).
- The "Request Stage" table appears to be empty, with no requests listed.

### operator — `/calendar` (HTTP 200) — flags: empty
*excerpt 541 chars, ollama 2.78 s*

- The page displays a calendar view with scheduled, in-progress, and completed requests for the FESEM instrument.
- The "All Instruments" dropdown allows operators to switch between different instruments' schedules.
- The "Add Maintenance" button appears empty, without any clear instructions or fields for input.

### operator — `/stats` (HTTP 200) — flags: missing, error
*excerpt 1280 chars, ollama 4.05 s*

- The page displays various statistics and instrument status, with a focus on Anika's role as an operator.
- Useful features include the calendar view of upcoming requests, live counters for active/in queue/pending samples, and throughput trends by day/week/month.
- The page appears to be missing any error handling or message indicating that there are no requests in progress.

### operator — `/requests/new` (HTTP 200) — flags: empty
*excerpt 993 chars, ollama 3.02 s*

- The page displays a basic layout with navigation links to main features and user information.
- The "New Request" section appears useful, allowing users to create new sample requests.
- The instrument selection dropdown is empty, indicating that no instruments have been configured or added yet.

### operator — `/me` (HTTP 200) — flags: empty
*excerpt 920 chars, ollama 3.40 s*

- The page shows a dashboard for operator Anika, displaying her role, access state, and identity information.
- The queue calendar section appears empty, with no jobs or requests listed.
- The "Handled Jobs" section displays one completed job (REQ-1003) with details on the instrument used, status, and completion date.

### operator — `/sitemap` (HTTP 200) — flags: empty, unclear
*excerpt 776 chars, ollama 3.48 s*

- The page shows a top-level navigation menu with links to various sections, including Instruments, Job Queue, Completed Jobs, and more.
- The "Calendar" link in the "Reporting Views" section appears useful for scheduling and tracking sample requests.
- The page is mostly empty, with only a handful of instruments listed; it's unclear what other features or data are intended to be displayed.

### operator — `/docs` (HTTP 200)
*excerpt 1800 chars, ollama 4.98 s*

- The page appears to be a documentation page for the PRISM lab sample-request scheduler, with links to various files (e.g., PROJECT.md, README.md) and sections explaining the system's architecture.
- A "Live view of PROJECT.md" section displays the project specification, including its goals, architecture, and design principles.
- The page seems to be a static HTML page with no interactive elements or data displayed; it appears to be intended for documentation purposes rather than serving as an operational interface.

### requester — `/` (HTTP 200) — flags: empty
*excerpt 353 chars, ollama 3.13 s*

- The page displays a simple navigation menu with links to various sections, including "Home", "Instruments", and "Calendar".
- The main content area shows a queue calendar with job statistics (This Week/Hide, This Month/Hide), but it appears empty.
- The "New Request" button is visible, indicating that users can create new requests from this page.

### requester — `/schedule` (HTTP 200) — flags: error
*excerpt 591 chars, ollama 3.58 s*

- The page displays a lab scheduler interface for the requester role, featuring a navigation menu and several sections.
- The available instruments section lists multiple instruments with unique identifiers (e.g., INST-004, FESEM-01), and allows filtering by instrument or status.
- The "No jobs found" message suggests that there are no scheduled requests currently displayed; however, the page does not appear to provide any error handling for this scenario.

### requester — `/instruments` (HTTP 200) — flags: unclear
*excerpt 440 chars, ollama 3.07 s*

- The page displays a list of instruments, with their names (e.g., "INST-004 DSC"), along with a brief description and status.
- The queue appears to be sorted in some order, but it's unclear what criteria are used for sorting.
- The "View →" button next to each instrument name seems useful for accessing more detailed information.

### requester — `/instruments/1` (HTTP 403) — flags: empty, error
*excerpt 331 chars, ollama 2.49 s*

- The page appears to display a list of available instruments, including INST-004 DSC and others.
- The "Queue" and "Calendar" sections seem useful for scheduling requests.
- The page is entirely empty except for the error message indicating access restriction with HTTP 403.

### requester — `/calendar` (HTTP 200) — flags: incomplete
*excerpt 513 chars, ollama 3.74 s*

- The page shows a calendar-based schedule view for the requester role, with various instruments and their respective queues (e.g., "INST-004 DSC" and "XRD Queue").
- The useful features appear to be the ability to filter by instrument ("Instrument Select instrument…") and view scheduled, in-progress, and completed requests.
- The page seems incomplete, as there are no actual calendar events or schedule data displayed, only a loading indicator and add maintenance window functionality.

### requester — `/stats` (HTTP 200) — flags: empty
*excerpt 1253 chars, ollama 4.20 s*

- The page shows various statistics and metrics for the requester role, including instrument status, queue counts, and throughput trends.
- The "Instrument Status Board" section displays the current state of each instrument, with counts of active, queued, and pending requests.
- The "Recent Activity" section lists recent request submissions and their statuses, but the "Under Review" and "Weekly Overview" sections appear empty.

### requester — `/requests/new` (HTTP 200) — flags: empty
*excerpt 997 chars, ollama 3.55 s*

- The page appears to be a dashboard for the requester role, displaying various instrument options and user contacts.
- The page seems useful, as it allows users to select instruments, view available users, and potentially create new requests.
- The "New Request" section at the top of the page is empty, suggesting that the feature is not fully implemented or populated with data.

### requester — `/me` (HTTP 200) — flags: empty
*excerpt 718 chars, ollama 3.71 s*

- The page displays the user's metadata, including name and email address, along with a navigation menu featuring various instruments and tools available in the lab.
- The "My History" section appears to provide an overview of the user's past requests and activities, but currently shows no submitted jobs or samples.
- The "Queue Calendar" and "Statistics" sections are empty, indicating that there is no current work assigned to the requester.

### requester — `/sitemap` (HTTP 200) — flags: empty
*excerpt 783 chars, ollama 3.21 s*

- The page shows a sitemap with various sections for the requester role, including Instruments, Job Queue, Completed Jobs, Reporting, and Statistics.
- The "Instruments" section lists seven active instruments with instrument IDs (e.g., INST-004 DSC).
- The "Job Queue" section appears empty, indicating no open or submitted requests.

### requester — `/docs` (HTTP 200)
*excerpt 1800 chars, ollama 4.72 s*

- The page appears to be documentation for the PRISM project, with links to various files and a brief overview of the system's architecture.
- The documentation seems comprehensive, covering philosophy, request cards, and queue management, but it may not be immediately useful for a requester looking for sample scheduling functionality.
- There is no apparent scheduling or request submission functionality on this page; the user would need to navigate elsewhere (e.g., `/schedule` or `/docs/new-request`) to perform actual requests.

