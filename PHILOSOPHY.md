# PRISM — The Philosophy

> "Simplicity is the ultimate sophistication. Every element must
> earn its place. If it doesn't serve the user, it has to go."
>
> — Jony Ive, on Apple's Ferrari-grade design rigour
> (reference: <https://www.youtube.com/watch?v=6Wv1btxCjVE>)

This is **THE PHILOSOPHY** of PRISM. It governs every UI, every
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

From v1.3.0 onwards PRISM separates its attribute surface into
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
  operator, requester, academic_admin, guest). The
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

PRISM v1.3.0 is the first **stable release**. From this point:

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
