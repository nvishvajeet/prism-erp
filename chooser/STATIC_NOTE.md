# chooser — static-folder note (Claude 1 → Claude 0 handoff)

The chooser now ships a stylesheet at `chooser/static/chooser.css`,
referenced from `templates/index.html` via
`{{ url_for('static', filename='chooser.css') }}`.

Flask's default is `static_folder="static"` relative to the app
root, so no constructor change is strictly needed — the current
`app = Flask(__name__, template_folder="templates")` resolves
to a sibling `chooser/static/` folder automatically.

**If at merge you observe 404s on `/static/chooser.css`**, make
the folder explicit:

```python
app = Flask(
    __name__,
    template_folder="templates",
    static_folder="static",
)
```

Same content otherwise — this is just a defensive note in case
launchd runs the app with a working-directory that shifts
`__name__`'s root. No route-logic change.
