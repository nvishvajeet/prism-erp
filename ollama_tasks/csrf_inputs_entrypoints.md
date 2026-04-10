# Task: Add csrf_token hidden input to login.html and activate.html

## Goal

Two public entry-point forms in the PRISM templates directory
(`templates/login.html` and `templates/activate.html`) are missing
the hidden CSRF token input that every authenticated form already
carries. This task adds exactly one hidden input to each form,
matching the established pattern from `templates/change_password.html`.

This is the **first** Ollama bridge task. It is deliberately
scoped to two files and one pattern so the output is trivially
verifiable. A larger CSRF sweep (~30 forms) will follow only if
this task lands clean.

## Files in scope

- `templates/login.html`
- `templates/activate.html`

## Forbidden files (must not touch)

- `app.py`
- `templates/change_password.html` (reference only — do not edit)
- Any file under `static/`
- Any file under `crawlers/`
- Any file not explicitly listed under "Files in scope"

## The change

Each file has exactly one `<form method="post">`. Immediately
after that opening tag, add this line (indented to match the
surrounding block):

    <input type="hidden" name="csrf_token" value="{{ csrf_token() }}" data-vis="requester">

Match the indentation of the following element inside the form.
Do not reformat anything else. Do not add a comment. Do not
change any other line.

The canonical reference is line 6 of `templates/change_password.html`:

    <input type="hidden" name="csrf_token" value="{{ csrf_token() }}" data-vis="requester">

## Acceptance criteria (grep-able)

All of these must hold after the edit:

- `grep -c 'name="csrf_token"' templates/login.html` is exactly `1`
- `grep -c 'name="csrf_token"' templates/activate.html` is exactly `1`
- `grep -c '<form method="post"' templates/login.html` is still exactly `1`
- `grep -c '<form method="post"' templates/activate.html` is still exactly `1`
- `git diff --stat HEAD` shows only `templates/login.html` and `templates/activate.html` changed
- `git diff HEAD templates/login.html | grep '^+' | grep -v '^+++' | wc -l` is exactly `1`
- `git diff HEAD templates/activate.html | grep '^+' | grep -v '^+++' | wc -l` is exactly `1`
- `python smoke_test.py` exits 0 (no regression)

## Rollback signal

Any failing acceptance check ⇒ `git reset --hard HEAD~1` on
`ollama-work` and exit non-zero. No partial credit. If you
cannot satisfy every criterion, output the single line:

    ABORT: <one-line reason>

…instead of a diff, and do not commit anything.

## Commit message

If every acceptance check passes, commit with exactly this
message (no extras):

    ollama: csrf hidden input on login + activate forms

    First bridge task. Adds csrf_token hidden input to the two
    public entry-point forms, matching the change_password.html
    reference pattern. Scope locked to templates/login.html and
    templates/activate.html.
