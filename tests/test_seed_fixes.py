"""Regression test for `scripts/seed_fixes.py` (shipped in d9297e6).
Locks in: subscript-on-"role" regex, line-above idempotency, triple-
quoted block skip, exact marker text, dry-run-vs-apply contract.
No Flask / DB / pytest — plain-script shape of `test_time_ago.py`.
Run: `.venv/bin/python tests/test_seed_fixes.py`."""
from __future__ import annotations
import contextlib, importlib.util, io, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location(
    "seed_fixes", ROOT / "scripts" / "seed_fixes.py")
sf = importlib.util.module_from_spec(_spec)
assert _spec and _spec.loader
_spec.loader.exec_module(sf)

L = lambda s: s.splitlines(keepends=True)  # noqa: E731
quiet = lambda: contextlib.redirect_stdout(io.StringIO())  # noqa: E731


def check_regex(fails: list[str]) -> None:
    pat = sf.PATTERN
    for line in ['if user["role"] == "admin":',
                 "if target_user['role'] in {'owner', 'admin'}:",
                 '    viewer["role"]', 'row["role"] != "user"']:
        if not pat.search(line):
            fails.append(f"regex should match: {line!r}")
    # Bare assignment excluded by negative lookahead.
    if pat.search('user["role"] = "admin"'):
        fails.append("regex should NOT match bare assignment")
    # The seeder also matches inside # comments (harmless + idempotent).
    if sf.find_matches(L('# note about user["role"] handling\n')) != [0]:
        fails.append("find_matches should include comment hit")


def check_idempotency(fails: list[str]) -> None:
    src = L(
        '# TODO [v1.5.0 multi-role]: replace ["role"] with has_role(...)\n'
        'if user["role"] == "admin":\n'
    )
    if sf.find_matches(src) != [1]:
        fails.append("find_matches hits mismatch")
    if not sf.already_marked(src, 1):
        fails.append("already_marked should be True when prior line has marker")
    if sf.already_marked(src, 0):
        fails.append("already_marked should be False for line 0")


def check_triple_quote_skip(fails: list[str]) -> None:
    # Multi-line triple-quoted block must be skipped end-to-end.
    src = L('def f():\n    """\n    docstring user["role"] in prose.\n'
            '    """\n    return user["role"]\n')
    if sf.find_matches(src) != [4]:
        fails.append(f"multi-line skip failed: {sf.find_matches(src)}")
    # Block-string assignment form also skipped.
    src2 = L('x = """\nuser["role"] inside block\n"""\nif user["role"]:\n')
    if sf.find_matches(src2) != [3]:
        fails.append(f"block-string skip failed: {sf.find_matches(src2)}")
    # Known limitation: one-line docstring has even tick count, so
    # the line IS matched. Lock documented behavior.
    if sf.find_matches(L('"""inline user["role"] prose."""\n')) != [0]:
        fails.append("single-line docstring: rough tracker should match")


def check_marker_format(fails: list[str]) -> None:
    if sf.MARKER_PREFIX != "# TODO [v1.5.0 multi-role]":
        fails.append(f"MARKER_PREFIX drifted: {sf.MARKER_PREFIX!r}")
    marker = sf.build_marker("    ")
    if len(marker) != 1 or not marker[0].endswith("\n"):
        fails.append(f"build_marker shape wrong: {marker!r}")
    if not marker[0].startswith("    # TODO [v1.5.0 multi-role]: "):
        fails.append(f"marker prefix/indent wrong: {marker[0]!r}")
    if "has_role" not in marker[0]:
        fails.append("marker note should reference has_role(...)")


def check_dry_run_vs_apply(fails: list[str], tmp: Path) -> None:
    target = tmp / "app.py"
    original = 'def h(u):\n    if u["role"] == "admin":\n        return 1\n'
    target.write_text(original)
    saved_target, saved_argv = sf.TARGET, sys.argv[:]
    try:
        sf.TARGET = target
        with quiet():
            sys.argv = ["seed_fixes.py"]
            if sf.main() != 0: fails.append("dry-run main() nonzero")
        if target.read_text() != original:
            fails.append("dry-run modified the file")
        with quiet():
            sys.argv = ["seed_fixes.py", "--apply"]
            if sf.main() != 0: fails.append("apply main() nonzero")
        after = target.read_text()
        if after == original or "# TODO [v1.5.0 multi-role]:" not in after:
            fails.append("apply did not insert marker")
        with quiet():
            sf.main()  # second apply must be a no-op (idempotent)
        if target.read_text() != after:
            fails.append("second apply was not idempotent")
    finally:
        sf.TARGET, sys.argv = saved_target, saved_argv


def main() -> int:
    fails: list[str] = []
    check_regex(fails); check_idempotency(fails)
    check_triple_quote_skip(fails); check_marker_format(fails)
    with tempfile.TemporaryDirectory() as td:
        check_dry_run_vs_apply(fails, Path(td))
    if fails:
        print(f"seed_fixes: {len(fails)} failure(s):")
        for f in fails: print(f"  - {f}")
        return 1
    print("seed_fixes: all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
