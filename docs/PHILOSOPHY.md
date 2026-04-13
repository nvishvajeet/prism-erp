# CATALYST — The Philosophy

> "Simplicity is the ultimate sophistication. Every element must
> earn its place. If it doesn't serve the user, it has to go."
>
> — Jony Ive, on Apple's Ferrari-grade design rigour
> (reference: <https://www.youtube.com/watch?v=6Wv1btxCjVE>)

This is **THE PHILOSOPHY** of CATALYST. It governs every UI, every
data model, every deployment, every decision. It is load-bearing.
Read it before you touch the codebase. Reject any change that
violates it.

---

## 1. The guiding frame — Apple / Jony Ive / Ferrari

Three disciplines, one outcome: **the thing gets out of the user's
way and does exactly what the user needs, with no ceremony.**

- **Apple:** nothing is on the screen that the user did not ask
  for. No decoration. No "we built it so we'll show it." If a
  widget has no job on this page, it isn't on this page.
- **Jony Ive:** form is a by-product of intent. Layouts are not
  "arranged" — they fall into place because each element already
  knows what it is. Headings don't exist to label; they exist
  only when they help the user find the thing.
- **Ferrari:** every gram is justified. Every route, every column,
  every macro carries load. If it's cosmetic, it's dead weight.
  If it's dead weight, it's gone.

The composite rule: **give the user what they want, exactly, and
stop.**

---

## 2. Hard attributes vs. soft attributes

From v1.3.0 onwards CATALYST separates its attribute surface into
two tiers. This is not a style guideline — it is a stability
contract.

### Hard attributes (STRUCTURAL — change only through a major update)

Hard attributes are the load-bearing skeleton. Changing one is a
**major** change. Breaking one is a stability violation.

- **Data model.** Table names, column names, column types,
  relationships, indexes on hot paths. The state machine
  (`REQUEST_STATUS_TRANSITIONS`).
- **Core route map.** `/`, `/schedule`, `/instruments`,
  `/instruments/<id>`, `/requests/<id>`, `/login`, `/logout`,
  `/admin/*`. URL shapes do not drift.
- **Authentication + authorisation.** The role set
  (owner, finance_admin, professor_approver, instrument_admin,
  operator, requester, academic_admin, guest) — **9 canonical
  roles, locked**. The `user_roles(user_id, role)` junction
  table shipped in `v1.5.0` layers multiple roles onto the
  existing 9 without adding new ones; multi-role assignment is
  additive. `user_role_set(user)` / `user_has_role(user, role)`
  are the canonical membership helpers; every
  `user["role"] ==` comparison is a legacy pattern queued for
  retirement on the v1.5.x patch stream. Adding a new canonical
  role still requires a major bump. The
  `@instrument_access_required(level)` decorator. The
  `request_card_policy()` / `request_scope_sql()` visibility gate.
- **Audit chain.** SHA-256 linkage, `verify_audit_chain()`,
  immutable append-only semantics.
- **Tile architecture.** The six-column `.inst-tiles` fluid grid,
  the `card_heading` / `stat_blob` / `metadata_grid` / `chart_bar`
  / `kpi_grid` / `paginated_pane` / `activity_feed` /
  `input_dialog` macros. These are the atoms. You do not reinvent
  them inside a template.
- **Key counters.** Per-role request counts, approval-queue
  depth, backlog counters. These back too many UIs to silently
  change semantics.
- **Event stream.** Every in-place edit on a machine, a request,
  or a job appends one entry to the event stream of the thing it
  touched. This is non-negotiable.

A hard-attribute change requires:
1. A migration path documented in `PROJECT.md`.
2. A bump of the first two version digits (`1.3.x` → `1.4.0`).
3. An entry in `CHANGELOG.md` under a new `### Changed (BREAKING)`
   subsection.

### Soft attributes (TEMPORARY — may drift between stable releases)

Soft attributes are exchangeable. They are the clothes on the
skeleton. They can be refined wave-by-wave without a major bump.

- Exact copy text, labels, help strings, tooltips.
- Widget placement inside a tile (as long as the macro is
  respected).
- Colours within the fixed palette, tone classes, accent shifts.
- Test features, experimental panes gated by an admin toggle.
- Dashboards, chart aesthetics, animation timings.
- Keyboard shortcuts, focus rings, hover states.

Soft attributes ship as patch releases (`1.3.0` → `1.3.1`).
Future agents can change them freely during normal wave work.

---

## 3. Stable releases only, from v1.3.0 onwards

CATALYST v1.3.0 is the first **stable release**. From this point:

1. **Every release on `master` is stable.** No WIP on master.
   Experimental work lives on short-lived branches and only
   merges once the sanity + static + behavioural waves pass.
2. **No structural drift between releases.** Hard attributes are
   locked per §2. If a hard attribute must change, it's a major
   update — not a sneak-in.
3. **Any agent must be able to pick up the plan.** If Claude
   hands off to Codex on Monday, Codex must be able to read
   `TODO_AI.txt` + `PHILOSOPHY.md` + `PROJECT.md` and continue
   without losing the thread. No tribal knowledge.
4. **Improvements ship as updates.** Background work becomes a
   stable release the moment it clears the pre-push gate. Nothing
   sits in a half-done state on master.
5. **The website stays up.** The production server on the Mac
   mini is not allowed to fall over between releases. Deploys are
   atomic: pull, smoke, swap the symlink, restart. Never interrupt
   live users.

If the pre-push gate (`wave sanity`) fails, the release does not
ship. Period.

### 3.1  Release numbering and the iOS-style patch cadence

CATALYST tags follow a three-segment scheme: `vMAJOR.MINOR.PATCH`.
The semantics are borrowed from iOS more than strict semver — the
**patch segment is bumped often**, not hoarded.

- **MAJOR (`1.x`, `2.x`)** — paradigm shift. `v1.3.0` was the
  first stable release. `2.0` is reserved for the ERP transition
  per `docs/ERP_VISION.md`. Major bumps are the only place hard
  attributes (per §2) are allowed to move. **`v1.7.0` is the
  ERP-ready proof point without being v2.0** — it shipped the
  finance portal + grants/budgets as new capabilities on top of
  the existing `sample_requests` single source of truth, showing
  that "become an ERP" is a capability gradient, not a rebuild.
  The v2.0 line stays reserved for the moment when CATALYST stops
  being "a scheduler that also tracks money" and becomes a new
  class of system.
- **MINOR (`1.X.y`, e.g. `v1.3.*` → `v1.4.*`)** — significant new
  capability or a hard-attribute-breaking internal refactor that
  justifies a `### Changed (BREAKING)` CHANGELOG entry. `1.3` →
  `1.4` happened because the tile architecture graduated as a
  hard attribute. Minor bumps are rare and deliberate.
- **PATCH (`1.X.Y`, the third segment)** — tested polish, bug
  fixes, new crawler strategies, new soft-attribute work, doc
  passes, ops improvements. **This is the iOS-style tight loop.**
  Cut as soon as trunk reaches a green tested state. Multiple
  patches per day is normal. The goal is never to accumulate
  un-tagged work on trunk.

**Definition of "ready to tag."** A patch release is tag-able the
instant ALL of:

1. The commit is on `origin/v1.3.0-stable-release` (never a
   local-only commit — origin is the canonical source).
2. The pre-receive sanity wave ran on that commit and printed
   `sanity green — push accepted`. The wave is the correctness
   gate; the tag is just a label on an already-vetted SHA.
3. The operator approves the tag. Tagging is deliberate, not
   automated — one line like "tag v1.4.3" is enough.
4. The SHA being tagged is a **real-work commit, not a claim
   commit**. Claim commits are locks, not milestones. If the
   current HEAD is a claim commit, tag the real-work commit
   immediately below it.

**Tagging protocol:**

```bash
git fetch origin
git log v<previous>..origin/v1.3.0-stable-release --oneline
#   → identify the last real-work SHA (not a claim commit)
git tag -a v1.4.X <real-work-sha> -m "<one-line summary + body>"
git push origin v1.4.X
```

No `git checkout` is needed — tags pin a SHA and do not touch the
working tree, so dirty-tree concerns from concurrent agents do
not apply. This was a real finding from the `v1.4.2` cut: the
first iOS-cadence tag was almost blocked by a strict
checkout-based protocol draft that turned out to be unnecessary.

**Why iOS cadence, not "release-as-ceremony."** The proof point
is `v1.4.2` itself. Between `v1.4.1` and `1f771e2` (the `v1.4.2`
target) ~15 improvements shipped through the pre-receive sanity
gate — new tile pattern on `new_request`, parallel agent work
protocol, xhr_contracts / agents_md_contract / parallel_claims
crawlers, intake/approval inline toggles, launchd newsyslog
rotation, portfolio action-first dashboard, dev_panel hero, and
more. None of it was tagged, because the old model was holding
`v1.4.2` behind an ops-gated Tailscale Serve click that may never
come. **That is the failure mode.** iOS cadence decouples
tagging from any external deploy dependency: the mini can pull
any tag, the tag doesn't need a live URL to earn its number.
Ship tags as often as the sanity wave allows. The Tailscale
click is now parked in `docs/NEXT_WAVES.md` §"Future technology
bets" as a strategic tech bet, not a routine blocker.

**Tags are immutable.** Never force-push a tag, never delete a
tag. A mistake in a tag message is fixed by adding a new
annotated tag (e.g. `v1.4.X.1` if strictly necessary) and
leaving the old one in place. The immutability matches the
stable-release-branch discipline of §3 above.

**What does NOT change.** The hard attribute contract (§2),
demo/operational separation (§4), stable-release branch
discipline (§3 above — no force-push on
`v1.3.0-stable-release`, no history rewrites), the pre-commit
gate (`scripts/smoke_test.py`), and the pre-receive sanity wave
on the central bare all stay exactly as they are. The only
thing §3.1 changes is the tagging cadence — tag often, tag when
green, tag what's real-work, and decouple tags from external
gates.

---

## 4. Demo data is not operational data

Demo content and operational content are physically separate.
Demo must never corrupt real data. Demo must never appear on a
production build unless the operator has explicitly opted in.

### The separation

```
Main/
  app.py                      # operational server
  lab.db                      # operational database (LIVE)
  demo/
    lab_demo.db               # demo database (never written from prod)
    populate_demo.py          # demo seeder
    demo_accounts.md          # demo credential list
    README.md                 # demo-mode instructions
  backend/                    # server + launch + deploy scripts
    start.sh
    start_server.sh
    deploy_macmini.sh
    Caddyfile
```

(v1.3.0 introduces the `demo/` and `backend/` directories and
migrates the scattered files into them over the next patch
releases. Hard attribute: the **directory boundary**. Soft
attribute: the exact file list inside each directory.)

### The demo toggle

- `LAB_SCHEDULER_DEMO_MODE=1` is the only way to turn demo on.
- Demo mode surfaces: `/demo/switch/<role>`, seed demo accounts,
  `populate_demo.py` runs on boot.
- Demo mode **must default to 0 in production**. `deploy_macmini.sh`
  sets it explicitly to 0 and the server refuses to boot if
  `DEMO_MODE=1` is seen on the Mac mini hostname.
- The operational database is opened with `check_same_thread=False`
  only when `DEMO_MODE=0`. This is the structural gate.

### The rule

Operational data is sacred. Demo data is disposable. They never
touch.

---

## 5. How this philosophy lands in the code

Every time you add or change a template, ask the five questions:

1. **Does it belong?** If no tile on the page needs this, delete
   the addition and stop.
2. **Is there already a macro for this?** Grep `_page_macros.html`
   first. Prefer composing existing macros over writing new HTML.
3. **Is it a hard attribute or a soft attribute?** If hard, it
   needs a migration path, a test, and a CHANGELOG entry. If soft,
   ship it and move on.
4. **Does it corrupt demo vs operational?** If the change touches
   data, verify it only runs in the mode it belongs to.
5. **Can another agent pick up from where you left off?** If no,
   you are not done — finish the `TODO_AI.txt` entry and commit.

Answer "yes" to all five or the change does not ship.

---

## 6. What "give the user what they want" means

The user does not want the software. The user wants the thing the
software lets them do. Every extra click, every extra field, every
label they have to read first is a tax on that.

Therefore:

- **Actions live where the user is looking.** Accept / reject on
  the request info page, not behind a tab. Edit metadata in-place
  on the instrument page, not in a modal dialog six levels deep.
- **Context follows the user.** The back-hover button in the
  request detail margin knows which page the user came from and
  sends them there, not to some default "home".
- **Events are the receipt.** Every in-place edit on a hard
  object (machine, request, job, user) appends to that object's
  event stream. The user can always see "what happened, when,
  by whom."
- **Help is inline, not external.** Default explainer text for
  "how does sample approval work?" lives on the page that asks the
  question. Editable by admins, visible to every new user, never
  buried in a wiki.
- **The form is the route.** Admins can edit how a machine's
  request form travels through the system — which operator group
  receives it, which faculty approves it, which fields are
  required vs optional — from the machine's own page. No separate
  "form builder" area.

---

## 7. Summary — the load-bearing sentences

1. Give the user what they want, exactly, and stop.
2. Hard attributes are locked. Soft attributes are free.
3. Every release on master is stable.
4. Demo and operational data are physically separate.
5. The website stays up.
6. Tiles, macros, events — always.
7. Another agent must be able to pick up from `TODO_AI.txt`.
