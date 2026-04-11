# HANDOVER — things to run in your own terminal

This file exists because I (the agent) can't push from the sandbox:
`/opt/homebrew/bin/ssh` rejects `UseKeychain yes` in your
`~/.ssh/config`, and neither key loaded in the agent
(`vnagargoje@u-bordeaux.fr`, `vishvajeetn-Bitbucket`) is authorised on
the Mac mini as `vishwajeet`. Everything you need is grouped by the
machine you run it on.

---

## 1. On this MacBook — fix SSH, push v1.3.0

### 1.1 Fix the broken ssh config (one-time)

Homebrew's OpenSSH 10.3 does not recognise the `UseKeychain` and
`AddKeysToAgent` keywords — they are Apple-only extensions. The
cleanest fix is to scope them to Apple's ssh only, or remove the lines
if you don't use them.

Open `~/.ssh/config` and either:

**Option A — delete lines 10-11** (simplest):
```
Host bitbucket.org
    HostName bitbucket.org
    User vishvajeetn
    PreferredAuthentications publickey
    IdentityFile /Users/vishvajeetn/.ssh/vishvajeetn-Bitbucket
```

**Option B — wrap them in `Match exec`** so Apple's ssh still uses
the keychain:
```
Host bitbucket.org
    HostName bitbucket.org
    User vishvajeetn
    PreferredAuthentications publickey
    IdentityFile /Users/vishvajeetn/.ssh/vishvajeetn-Bitbucket

Match exec "test $(readlink -f $(which ssh)) = /usr/bin/ssh"
    UseKeychain yes
    AddKeysToAgent yes
```

Verify:
```bash
ssh -G bitbucket.org >/dev/null && echo "ssh config parses cleanly"
```

### 1.2 Load the Mac-mini key

None of the keys currently in `ssh-add -l` are authorised on the mini.
Find (or generate) the key the mini will accept. Likely it lives at
`~/.ssh/id_rsa`, `~/.ssh/macmini_ed25519`, or in a password manager.

```bash
# list what's in the agent
ssh-add -l

# load the correct key (replace with the real path)
ssh-add ~/.ssh/<your-macmini-key>

# smoke-test the connection
ssh -o BatchMode=yes -o ConnectTimeout=5 vishwajeet@100.115.176.118 "hostname && uname -a"
```

If none of your local keys work, copy the MacBook's public key over
with `ssh-copy-id` (needs a password prompt the first time):
```bash
ssh-copy-id -i ~/.ssh/id_ed25519.pub vishwajeet@100.115.176.118
```

### 1.3 Push the v1.3.0 branch

The stable release is already committed on branch
`v1.3.0-stable-release`, two commits ahead of `master`:
```
b815758  portfolio panel: owner-only personal dashboard at /admin/portfolio
3707e7a  v1.3.0 — first stable release: Ollama purge, PHILOSOPHY, data/ split
```

Push from the repo root:
```bash
cd ~/Library/CloudStorage/Dropbox/Scheduler/Main
git push -u origin v1.3.0-stable-release
```

Then either:
- **Fast-forward `master`** (solo workflow):
  ```bash
  git checkout master
  git merge --ff-only v1.3.0-stable-release
  git push origin master
  ```
- **Open a PR** (if you want review before merge): whatever your git
  host UI is at `100.115.176.118`. The bare git remote there is
  `vishwajeet@100.115.176.118:~/git/lab-scheduler.git`, so PRs may
  not be a thing — fast-forward `master` is probably the right move.

---

## 2. On the Mac mini — deploy v1.3.0 to production

Once `master` is pushed, deploy by running this on the mini. You can
either `ssh` in manually or paste the whole block into the one-liner
form shown in §2.2.

### 2.1 Interactive deploy

```bash
ssh vishwajeet@100.115.176.118
cd ~/lab-scheduler                         # or wherever the checkout lives
git fetch --prune
git checkout master
git pull --ff-only

# data/ folder is new in v1.3.0 — make sure the operational slots exist
mkdir -p data/operational/{uploads,exports}

# production must disable demo seeding
grep -q '^LAB_SCHEDULER_DEMO_MODE=' .env || echo 'LAB_SCHEDULER_DEMO_MODE=0' >> .env

# smoke test runs in demo mode by default, so skip it here OR run it
# against a throwaway DB copy. In production we trust the pre-push
# smoke from the MacBook.
./start.sh --https    # or: launchctl kickstart -k gui/$(id -u)/local.prism
```

### 2.2 One-liner (runs from your MacBook terminal)

```bash
ssh vishwajeet@100.115.176.118 '
  set -e
  cd ~/lab-scheduler &&
  git fetch --prune &&
  git checkout master &&
  git pull --ff-only &&
  mkdir -p data/operational/uploads data/operational/exports &&
  grep -q "^LAB_SCHEDULER_DEMO_MODE=" .env || echo "LAB_SCHEDULER_DEMO_MODE=0" >> .env &&
  launchctl kickstart -k gui/$(id -u)/local.prism &&
  echo "deploy OK" &&
  sleep 2 &&
  curl -sSo /dev/null -w "health=%{http_code}\n" https://100.115.176.118:5055/login
'
```

### 2.3 First-time operational DB bootstrap

**Only if `data/operational/lab_scheduler.db` does not exist yet**
(i.e. this is a cold production start). PRISM's `init_db()` creates
the schema; the demo seeder is skipped automatically when
`LAB_SCHEDULER_DEMO_MODE=0`, so you have to create the first real
super_admin by hand:

```bash
ssh vishwajeet@100.115.176.118
cd ~/lab-scheduler
LAB_SCHEDULER_DEMO_MODE=0 .venv/bin/python -c "
import app
app.init_db()
from werkzeug.security import generate_password_hash
db = __import__('sqlite3').connect(app.DB_PATH)
db.execute(
    'INSERT INTO users (name, email, password_hash, role, invite_status) VALUES (?, ?, ?, ?, ?)',
    ('Owner', 'YOU@lab.local', generate_password_hash('CHANGE-ME'), 'super_admin', 'active'),
)
db.commit()
print('owner seeded:', app.DB_PATH)
"
```

Log in immediately at `https://100.115.176.118:5055/login` and change
the password.

---

## 3. Verification checklist

After any deploy, from the MacBook:

```bash
# 1. mini is reachable
curl -skSo /dev/null -w "mini-login %{http_code}\n" https://100.115.176.118:5055/login

# 2. your MacBook dev server is also healthy
curl -sSo /dev/null -w "local-login %{http_code}\n" http://127.0.0.1:5055/login

# 3. crawler sanity wave against the local server (catches template regressions)
cd ~/Library/CloudStorage/Dropbox/Scheduler/Main
.venv/bin/python -m crawlers wave sanity
```

Expected:
```
mini-login 200
local-login 200
wave 'sanity' overall exit code: 0
```

---

## 4. Currently running (local) — for reference

| What            | Value                                                       |
|-----------------|-------------------------------------------------------------|
| Server          | `LAB_SCHEDULER_DEMO_MODE=1 .venv/bin/python app.py`         |
| URL             | http://127.0.0.1:5055                                       |
| PID             | `30173` (parent), `30182` (reloader child)                  |
| Log             | `logs/server.log`                                           |
| Data directory  | `data/demo/` (DB + uploads + exports)                       |
| Owner login     | `admin@lab.local` / `SimplePass123`                         |

Stop with `lsof -ti :5055 | xargs kill -9`.

---

## 5. TL;DR — the two commands that actually have to run

From this MacBook's terminal (after §1.1 + §1.2):
```bash
git push -u origin v1.3.0-stable-release
```

Once merged to `master`, from the Mac mini (or via one-liner in §2.2):
```bash
cd ~/lab-scheduler && git pull --ff-only && launchctl kickstart -k gui/$(id -u)/local.prism
```

Everything else in this file is context and fallbacks.
