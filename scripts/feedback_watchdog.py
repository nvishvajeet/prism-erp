#!/usr/bin/env python3
"""Watchdog: react within 1 sec to new feedback from any tenant.

Watches two files:
- `tmp/debug-feedback-pool/imac/debug_feedback.md`  (iMac / Ravikiran)
- `logs/debug_feedback.md`                          (Lab ERP — MBP-local)

On any modification:

1. If size grew, tail the new bytes.
2. Extract the new entry's timestamp + user + page.
3. Append a structured row to `tmp/feedback-watchdog-events.jsonl`.
4. Log to stdout (launchd captures).

Does NOT file tickets or make decisions — emits structured signal
only. `incident_to_ticket.py` runs on cron later to ticket the high-
priority ones (Claude verifies first).

Runs as a long-lived daemon via `local.catalyst.feedback-watchdog`
launchd (KeepAlive=true).

Requires `watchdog` package (see requirements.txt).
"""
from __future__ import annotations

import datetime
import json
import pathlib
import re
import sys
import time

try:
    from watchdog.events import FileSystemEventHandler
    from watchdog.observers import Observer
except ImportError:
    print("watchdog not installed; pip install watchdog", file=sys.stderr)
    sys.exit(1)

HERE = pathlib.Path(__file__).resolve().parent.parent

# Map of watch_file → (state_file, source_label)
WATCH_TARGETS: dict[pathlib.Path, tuple[pathlib.Path, str]] = {
    HERE / "tmp" / "debug-feedback-pool" / "imac" / "debug_feedback.md": (
        HERE / "tmp" / "feedback-watchdog.state",
        "ravikiran-imac",
    ),
    HERE / "logs" / "debug_feedback.md": (
        HERE / "tmp" / "feedback-watchdog-lab.state",
        "lab-erp",
    ),
}

OUT_JSONL = HERE / "tmp" / "feedback-watchdog-events.jsonl"


def load_offset(state_file: pathlib.Path) -> int:
    if state_file.exists():
        try:
            return int(state_file.read_text().strip() or "0")
        except Exception:
            pass
    return 0


def save_offset(state_file: pathlib.Path, n: int) -> None:
    state_file.parent.mkdir(parents=True, exist_ok=True)
    state_file.write_text(str(n))


ENTRY_HEADER_RE = re.compile(r"^## (20\d{2}-\d{2}-\d{2}T[\d:.Z+-]+)$", re.MULTILINE)
USER_RE = re.compile(r"\*\*User:\*\*\s*(\S+)")
PAGE_RE = re.compile(r"\*\*Page:\*\*\s*`([^`]+)`")


def process_new_content(new_text: str, source: str) -> list[dict]:
    rows: list[dict] = []
    for m in ENTRY_HEADER_RE.finditer(new_text):
        ts = m.group(1)
        block_end = new_text.find("\n## ", m.end()) if new_text.find("\n## ", m.end()) > 0 else len(new_text)
        block = new_text[m.start():block_end]
        u = USER_RE.search(block)
        p = PAGE_RE.search(block)
        rows.append({
            "detected_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "entry_ts": ts,
            "source": source,
            "user": u.group(1) if u else "",
            "page": p.group(1) if p else "",
            "preview": re.sub(r"\s+", " ", block[:300]).strip(),
        })
    return rows


def handle_file_change(watch_file: pathlib.Path, state_file: pathlib.Path, source: str) -> None:
    try:
        current_size = watch_file.stat().st_size
    except FileNotFoundError:
        return
    last_offset = load_offset(state_file)
    if current_size <= last_offset:
        save_offset(state_file, current_size)
        return
    with open(watch_file, "rb") as f:
        f.seek(last_offset)
        new_bytes = f.read()
    try:
        new_text = new_bytes.decode("utf-8", errors="replace")
    except Exception:
        new_text = ""
    rows = process_new_content(new_text, source)
    if rows:
        OUT_JSONL.parent.mkdir(parents=True, exist_ok=True)
        with open(OUT_JSONL, "a", encoding="utf-8") as out:
            for r in rows:
                out.write(json.dumps(r, ensure_ascii=False) + "\n")
        for r in rows:
            print(f"[watchdog] new entry source={r['source']} ts={r['entry_ts']} user={r['user']} page={r['page']}")
    save_offset(state_file, current_size)


class MultiFileHandler(FileSystemEventHandler):
    def __init__(self, file_map: dict[pathlib.Path, tuple[pathlib.Path, str]]) -> None:
        self._file_map = file_map  # watch_file → (state_file, source)

    def on_modified(self, event):
        if event.is_directory:
            return
        src = pathlib.Path(event.src_path)
        if src in self._file_map:
            state_file, source = self._file_map[src]
            handle_file_change(src, state_file, source)


def main() -> int:
    handler = MultiFileHandler(WATCH_TARGETS)
    observer = Observer()
    watched_dirs: set[pathlib.Path] = set()
    for watch_file, (state_file, source) in WATCH_TARGETS.items():
        watch_file.parent.mkdir(parents=True, exist_ok=True)
        if not watch_file.exists():
            watch_file.touch()
        if watch_file.parent not in watched_dirs:
            observer.schedule(handler, str(watch_file.parent), recursive=False)
            watched_dirs.add(watch_file.parent)
        print(f"[watchdog] watching {watch_file} (source={source})")

    observer.start()
    print(f"[watchdog] logging to {OUT_JSONL}")
    try:
        while True:
            time.sleep(60)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()
    return 0


if __name__ == "__main__":
    sys.exit(main())
