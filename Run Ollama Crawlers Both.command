#!/bin/bash
#
# Run Ollama Crawlers Both.command
# --------------------------------
# Double-click to launch BOTH the local (MacBook) and remote (Mac
# mini) observer loops simultaneously, each in its own Terminal
# window via `osascript`. Two crawlers → twice the throughput,
# two independent Ollama processes, both writing into the same
# git-tracked ollama_observations.md.
#
# The two loops never race on the file because git commits happen
# per run — merges are append-only markdown, which git handles
# automatically.
#
# Stop both: close both Terminal windows or Ctrl-C each.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

osascript <<EOF
tell application "Terminal"
    activate
    do script "cd '$SCRIPT_DIR' && './Run Ollama Crawlers.command'"
    delay 1
    do script "cd '$SCRIPT_DIR' && './Run Ollama Crawlers Remote.command'"
end tell
EOF
