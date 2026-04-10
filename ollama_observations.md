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

