# Satyajeet Onboarding — How To Operate CATALYST With Claude

This guide is for a fresh operator joining the system on a second
MacBook, using Claude, and needing to understand the whole flow in
about 20 minutes.

The goal is not "read every doc." The goal is: after one focused pass,
you know how the machines work, how the agents work, how to avoid git
damage, how to run crawlers safely, and how to pick useful work.

## 1. What this system is

CATALYST is one product with four layers:

1. the public/product shell
2. the operational app
3. the ERP spine
4. the machine-verification loop

In practice, this means:

- the Flask app in `app.py` is the operational core
- the templates are the UI surface
- the docs are the operating manual for humans and agents
- the crawlers are the always-on quality layer
- git is the synchronization mechanism between operators and machines

This is not a "one AI chatting in a vacuum" setup. It is a coordinated
multi-agent, multi-machine system with explicit ownership rules.

## 2. The machine model

There are three machine roles in this system:

### 2.1 Editing machine

This is the MacBook where the agent is actively editing code.

Use it for:

- reading code
- editing tracked files
- running local smoke tests
- running up to 2 local crawler processes
- committing and pushing

Do not use it as a brute-force crawler box. Keep it responsive.

### 2.2 Verification machine(s)

These are any participating developer MacBooks, including yours.

Use them for:

- read-only crawler runs
- extra smoke/sanity checks
- exploratory audits
- temporary output files and reports

Important: a second MacBook increases local verification capacity. It is
not a second production host.

### 2.3 Production / mirror machine

This is the Mac mini.

Use it for:

- serving the live site
- remote sanity verification
- deploy confirmation

Do not treat the Mac mini like a second editing workstation. It is the
production-serving verifier.

## 3. The agent model

There are only two useful kinds of agents here.

### 3.1 Read agents

Read agents do:

- grep
- code reading
- crawler runs
- report generation
- analysis

Read agents do **not**:

- edit tracked files
- commit
- push

Read agents are cheap and parallel-safe. You can run several of them at
once if they are only reading and writing scratch output to `reports/`
or temp files.

### 3.2 Write agents

Write agents do:

- claim files
- edit tracked files
- run verification
- commit
- push

Write agents must follow the full claim protocol. Never skip this for
non-trivial work.

## 4. The single most important rule

**Every tracked-file change must have an owner.**

That owner is the supervising LLM agent.

This is why:

- crawlers are supervised
- write scopes are claimed
- git writes stay with the supervising agent
- read-only crawlers must not silently edit product files

If you remember only one thing, remember this:

**agents may explore in parallel, but writes must always be owned.**

## 5. How git works here

This project is safe because of three layers:

1. `CLAIMS.md` — advisory lock board
2. `git pull --rebase` discipline
3. pre-receive verification on push

### 5.1 The normal write flow

For non-trivial work:

1. `git pull origin v1.3.0-stable-release`
2. read `CLAIMS.md`
3. pick a task from `docs/NEXT_WAVES.md`
4. add your row to `CLAIMS.md`
5. commit **`CLAIMS.md` alone**
6. push the claim
7. do the work
8. run `./venv/bin/python scripts/smoke_test.py`
9. `git pull --rebase origin v1.3.0-stable-release`
10. remove your claim row
11. commit the work + claim removal together
12. push

### 5.2 What not to do

Never do these:

- never force-push
- never `--no-verify`
- never `git stash` mid-task
- never widen your write scope without updating the claim
- never clear another agent's claim silently
- never leave a new file untracked for long if you intend to commit it

### 5.3 Why claims matter

Without claims, two agents can both "innocently" edit the same file and
one of them will lose work on rebase. `CLAIMS.md` exists to make that
collision visible before it happens.

## 6. How crawlers work here

The crawlers are not just tests. They are the system's second brain.

They are used for:

- regression checks
- role/visibility verification
- dead-link detection
- performance checks
- random-walk exploration
- CSS hygiene
- philosophy / UI drift checks

### 6.1 The main crawler commands

```bash
./venv/bin/python -m crawlers wave sanity
./venv/bin/python -m crawlers wave all
./venv/bin/python -m crawlers run random_walk
./venv/bin/python -m crawlers list
./venv/bin/python -m crawlers list-waves
```

### 6.2 How to think about crawler ownership

Use this model:

- read crawler = scout
- write agent = surgeon

The scout can inspect anything and produce reports.
The surgeon is the only one allowed to alter tracked product files.

### 6.3 Local crawler budget

Per MacBook:

- max 2 crawler processes
- plus 1 smoke/test process

Heavy or overflow verification can go to the Mac mini, but only under
LLM supervision.

## 7. What you should read first

If you have 20 minutes, read in this order:

1. `README.md`
2. `AGENTS.md`
3. `WORKFLOW.md`
4. `CLAIMS.md`
5. `docs/NEXT_WAVES.md`
6. `docs/V2_GAP_MAP.md`
7. `docs/PHILOSOPHY.md`

That order gives you:

- what the product is
- how agents are expected to behave
- how machines are used
- how parallel work stays safe
- what the current plan is
- where `v2.0` is going
- what quality bar the product must meet

## 8. What decisions you can make safely

You can usually decide these yourself:

- which ready-now task to claim from `docs/NEXT_WAVES.md`
- whether to use a local crawler or the Mac mini verifier
- whether a task is read-only or write work
- whether to run smoke only or also run a stronger crawler wave
- whether a UI/copy/layout change is a soft-attribute refinement

Pause and ask before doing these:

- changing roles, route shapes, core schema, or audit semantics
- changing deploy topology
- changing production behavior on the mini
- editing files already claimed by another agent
- deciding to widen scope into hot shared files
- promoting a "maybe" into a major-version promise

## 9. Basic technical primer

This section is for the case where terminal commands are still new.

### 9.1 What a terminal command is

A terminal command is just a short instruction to the computer.

Examples:

- `pwd` = show "where am I?"
- `ls` = show files in this folder
- `cd <path>` = move into a folder
- `git status` = show what changed
- `python` = run Python

You do not need to memorize everything. What matters is learning what a
few important commands mean in this project.

### 9.2 The commands you will see most often

```bash
pwd
ls
cd ~/Documents/Scheduler/Main
git status
git pull origin v1.3.0-stable-release
git add <file>
git commit -m "message"
git push origin v1.3.0-stable-release
./venv/bin/python scripts/smoke_test.py
./venv/bin/python -m crawlers wave sanity
ssh vishwajeet@100.115.176.118
```

### 9.3 What `sudo` means

`sudo` means: "run this command with administrator permission."

Use `sudo` carefully. In this project, if you are not sure why a command
needs `sudo`, do not run it yourself. Ask the agent or ask the human
operator.

Examples of places where `sudo` might appear:

- installing something system-wide
- copying files into protected system folders
- changing service configuration

Examples of places where you usually do **not** need `sudo`:

- editing project files
- running smoke tests
- running crawlers
- normal `git pull`, `git commit`, `git push`

### 9.4 What Homebrew is

Homebrew is the package manager on macOS.

It is how tools get installed, for example:

- Python
- git
- caddy

Example command:

```bash
brew install python@3.12 git
```

Meaning: install those tools on the Mac.

If an agent asks to use Homebrew, it usually means it wants to install a
missing dependency.

### 9.5 What `ssh` is

`ssh` means "connect to another machine securely from the terminal."

Example:

```bash
ssh vishwajeet@100.115.176.118
```

Meaning:

- connect to the Mac mini
- log in as user `vishwajeet`
- open a remote terminal there

This is how we run remote verification or inspect the production host.

### 9.6 What HTTPS is

HTTPS is the secure form of HTTP, the protocol browsers use to load
websites.

Simple version:

- `http://` = normal web traffic
- `https://` = encrypted web traffic

Why it matters:

- login cookies are safer
- browsers trust the connection more
- public-facing deployment feels professional

### 9.7 What a domain is

A domain is the human-readable web address for a site.

Examples:

- `catalysterp.org`
- a Tailscale HTTPS hostname

The domain points users to the server. It is separate from the code.

### 9.8 What a server is

In this project, the "server" is the program that runs the app and
responds to browser requests.

Here:

- your MacBook can run a dev server locally
- the Mac mini runs the production-serving version

### 9.9 What a virtual environment is

The `venv` or `.venv` folder is a Python environment just for this
project.

When you see:

```bash
./venv/bin/python
```

it means:

- use the Python that belongs to this repo
- do not accidentally use some other system Python

That keeps dependencies stable.

## 10. What technical things you can ask agents to do

Even if you do not know the commands yourself, you can still direct
agents very effectively.

Good asks:

- "read these docs and summarize the system"
- "run smoke and tell me what failed"
- "run sanity locally and on the Mac mini"
- "crawl the app and produce an improvement plan"
- "claim this wave and implement it"
- "explain what this command does before running it"
- "show me where the route/template/module lives"
- "prepare a safe deploy"
- "check if this requires sudo or not"
- "tell me whether this should be a read agent or write agent task"

Even better asks:

- "read-only task, do not edit, only report findings"
- "write task, claim files first and follow the full git lifecycle"
- "use the Mac mini as verifier"
- "run local crawlers but keep the editing machine responsive"
- "explain the result in plain English"

### 10.1 Good examples

Examples you can literally use:

- "Read-only task. Run a deep crawl on attendance and summarize the top five issues."
- "Write task. Claim the vendor registry wave and implement it safely."
- "Before doing anything, explain the commands you plan to run."
- "Use local crawlers and the Mac mini verifier."
- "Do not use sudo unless you explain why it is necessary."

### 10.2 What not to ask vaguely

Avoid prompts like:

- "just do something"
- "fix everything"
- "use all machines however you want"

Those are too loose and make ownership worse.

Better:

- give a bounded goal
- say whether it is read-only or write work
- say whether you want explanation
- say whether the Mac mini should be used

## 11. What the philosophy means in practice

CATALYST follows an Apple / Jony Ive / Ferrari design discipline.

In plain terms:

- every element must earn its place
- every route should mean what it says
- every workflow should reduce ceremony
- every denial should be clear, not noisy
- every feature should feel integrated, not bolted on

When you watch an agent work, ask:

- did it reduce friction or add it?
- did it simplify meaning or obscure it?
- did it preserve hard attributes?
- did it keep the product feeling like one system?

That is the correct review lens.

## 12. What the current big program is

The active larger initiative is `v2.0`.

The short version:

- we already have an ERP spine
- we do **not** need a rewrite
- the next work is to finish missing ERP domains and unify the public
  product shell

The first `v2.0` waves are:

- vendor registry
- invoice PDF export
- budget alerts
- leave calendar
- fleet trip logging
- public-site / Ravikiran unification

Read `docs/V2_GAP_MAP.md` for the full shape.

## 13. If you want to understand the system by watching prompts

When you watch an experienced session for 20 minutes, look for this
loop:

1. orient to the task
2. inspect local context
3. check claims
4. run read-only verification
5. decide whether it is read work or write work
6. claim if needed
7. make a bounded change
8. run smoke or crawlers
9. commit and push
10. summarize what changed and what remains

That loop is the operating system.

If the session does not show ownership, verification, and a clean git
exit, it is not a good session no matter how clever the code sounds.

## 14. Your first safe session

If this is your first hands-on session, do this:

1. open `README.md`, `AGENTS.md`, `WORKFLOW.md`
2. inspect `CLAIMS.md`
3. read the "Available now" table in `docs/NEXT_WAVES.md`
4. pick a read-only task first
5. run one crawler locally
6. run one sanity check on the Mac mini
7. write a short findings summary
8. only then claim a write task

That sequence teaches the system without risking the branch.

## 15. The shortest verbal summary

If you had to explain this setup in 30 seconds:

> CATALYST is a multi-agent, multi-machine ERP build loop. Agents read
> docs, claim files before writing, run supervised crawlers locally,
> verify on the Mac mini, and use git plus pre-receive checks to keep
> parallel work safe. The product is already an ERP spine; `v2.0` is
> about finishing missing domains and unifying the outside and inside of
> the product.
