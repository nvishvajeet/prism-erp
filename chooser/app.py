"""CATALYST chooser app — minimal Flask landing for catalysterp.org root.

Serves a single page with two tiles: MITWPU R&D and Personal ERP.
Zero mention of Ravikiran on the chooser (per owner directive
2026-04-15 — Ravikiran is addressed as "Personal ERP" on the
public chooser; the subdomain itself is the only place the name
"Ravikiran" appears).

Port 5060. Cloudflared ingress routes catalysterp.org → 127.0.0.1:5060.

Run:
    python chooser/app.py
    # or via launchd plist: chooser/launchd/local.catalyst.chooser.plist
"""

from pathlib import Path

from flask import Flask, render_template

HERE = Path(__file__).resolve().parent

# Resolve template + static dirs to absolute paths so the app works
# regardless of the launching shell's CWD (launchd plists, cron jobs,
# ad-hoc shells all land here cleanly).
app = Flask(
    __name__,
    template_folder=str(HERE / "templates"),
    static_folder=str(HERE / "static"),
)

# The two subdomains this chooser points at. Keep in sync with
# ~/.cloudflared/config.yml on mini.
MITWPU_URL = "https://mitwpu-rnd.catalysterp.org"
PERSONAL_URL = "https://ravikiran.catalysterp.org"


@app.route("/")
def index():
    return render_template(
        "index.html",
        mitwpu_url=MITWPU_URL,
        personal_url=PERSONAL_URL,
    )


@app.route("/health")
def health():
    return {"status": "ok", "service": "catalyst-chooser"}, 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5060)
