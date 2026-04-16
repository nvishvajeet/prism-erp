# Runtime Root Policy

Lab ERP now supports explicit runtime roots.

Preferred env vars:

- `LAB_ERP_RUNTIME_ROOT=/path/to/lab-erp/live`
- `LAB_ERP_DATA_DIR=/path/to/lab-erp/live/data`

Fallback retained:

- `CATALYST_DATA_DIR=...`

Recommended layout:

```text
lab-erp/
  live/
    app/   # git working copy that serves production
    data/  # sqlite, uploads, exports, logs
  dev/
    app/   # git working copy for active development
    data/  # dev-only state
```

The launcher sources env, exports the data-root override, and runs
`lab_erp_app.py` / `lab_erp_app:app` so the runtime no longer depends on
a generic `app.py` contract.
