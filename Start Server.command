#!/bin/bash
# Double-click this file on macOS to launch the Lab Scheduler server.
#
# To open in Chrome instead of Safari, set Chrome as your default browser:
#   System Settings → Desktop & Dock → Default web browser → Google Chrome
#
# Or open manually in Chrome after the server starts:
#   open -a "Google Chrome" http://127.0.0.1:5055
cd "$(dirname "$0")"
bash start.sh
