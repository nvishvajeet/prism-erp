# Vision: software + compute as "virtual instruments"

Captured 2026-04-14 from Vishvajeet during the live-rollout burn. This
is a design direction, **not** a shipping plan. No code was written
against it in this session. Everything below needs a design review
before it becomes a ticket.

## Core idea

The CATALYST ERP already models an instrument as an entity that:

- has a queue of samples / jobs,
- has an operator (role) responsible for running it,
- emits logs, results, and follow-up notes per job,
- can be booked, shared, and priced.

**Generalise that.** Anything that *processes jobs and returns
outputs* is an instrument, regardless of whether it is a mass
spectrometer, a software pipeline, or an HPC cluster.

### Three concrete instances the user named

1. **The software job scheduler** (already running on the Mac mini)
   becomes an instrument. Its "samples" are job submissions —
   structured requests that specify code, inputs, licenses, decoder
   options, etc. Output goes back to the requester via the same
   request thread pattern CATALYST already uses for physical
   samples.

2. **An HPC cluster**, when one arrives, is just another instrument.
   It is physically connected to the mini via Thunderbolt and
   appears in CATALYST under whichever ERP house owns it. Same
   booking, same queue, same operator model. Access control flows
   through the existing instrument-area access pattern: users who
   are assigned to that "instrument" can submit jobs; nobody else.

3. **AI agents themselves** can be virtual instruments. A text-to-
   metadata agent, an OCR agent, a code-fixer agent — each has a
   queue, an operator (the admin wiring it up), and jobs.

## Why this is actually useful

- **One mental model** — users already know how to queue a sample.
  They don't need a second mental model for "how to book compute".
- **One auth story** — the instrument-area access rules already
  decide who can see the queue, who can submit, who can operate.
- **One billing story** — grants and finance already attach to
  instrument usage. Compute time bills through the same pipeline.
- **One audit story** — the same `audit_logs` hash chain covers
  both physical and virtual jobs.

## The operator role

Every compute instrument needs an operator who can:

- **Install software** on the host box (mini or HPC). Human does
  the actual install; AI helper wires in licenses, env vars, paths.
- **Schedule jobs** on the instrument's queue. Same mechanics as
  scheduling a physical sample: assigned slot, operator note,
  finish timestamp.
- **Triage failed jobs.** When a job fails, the operator decodes
  the failure, writes it into the request's operator_note, and
  flags the requirement that was missing (wrong decoder, missing
  dep, license expired, bad input format). An AI helper assists
  with the decode step but doesn't close the job without a human
  signature — consistent with the existing AI-human interaction
  pledge (every AI write on PRISM needs human approval).

## Central queue + AI crawler

The user also described a **single central queue** that absorbs
everything:

- Voice notes from the feedback widget (the one on every page).
- Typed bug reports from the same widget.
- Feature requests from the same widget.
- (Future) inbound emails, Slack pings, meeting transcripts.

A crawler pulls off this queue and:

- Fills in metadata (page, user, role, timestamp, hovered element,
  mouse-position context — the feedback widget already collects
  this in its `context_json` payload).
- Classifies: bug vs. request vs. just-a-note.
- Routes to the relevant operator or module owner.
- Where the action is bounded and reversible, the crawler can act
  (e.g. create a ticket, draft a reply) — but still gated on human
  approval before any data write.

This is a natural extension of the existing `site_feedback` log
(`logs/site_feedback.md`). The queue becomes a first-class entity
with its own table, probably mirroring the `sample_requests`
schema.

## Open design questions

These are the forks that need the user to decide before anyone
builds:

1. **Does a software job get a request_no?** i.e. does it flow
   through the existing `sample_requests` table with a new
   `job_kind` discriminator, or does it live in a separate table
   that mirrors the shape?
2. **What's the priced unit for compute?** Per-job? Per-hour?
   Per-core-hour? This affects how the existing finance / grants
   wiring connects.
3. **Who can see whose job logs?** Physical samples have a
   requester-identity confidentiality policy. Do compute jobs
   inherit it, or are they public-within-portal by default?
4. **Central queue — is it cross-portal?** If HQ and Lab R&D both
   feed voice notes into it, who gets to see them, and who routes
   them?
5. **AI acting autonomously vs. suggesting.** The current pledge
   is "every AI write needs human approval". Is that still the
   right default for low-stakes metadata fills on the central
   queue, or do we relax it there?

## Next step

Discuss at the next design review. Do **not** start building
compute-instrument schema until the user has signed off on the
answers to §"Open design questions".
