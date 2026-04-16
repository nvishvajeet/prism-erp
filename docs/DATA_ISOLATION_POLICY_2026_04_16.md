# Data Isolation Policy

CATALYST now treats every ERP runtime as a local tenant boundary.

The enforced rules are:

1. Each repo/runtime writes to a namespaced database file.
   Lab ERP uses `lab_erp_*` database filenames instead of a shared generic `lab_scheduler.db`.

2. Each repo/runtime uses its own session cookie namespace.
   Lab ERP cookies now default to `lab_erp_*_session`, so browser sessions do not bleed between sites or lanes.

3. Site-local admin identities are explicit.
   Lab-only admin identities are `owner.lab@catalyst.local` and `admin.lab@catalyst.local`.
   The legacy `owner@catalyst.local` identity is repaired onto HQ only.

4. Portal access is repaired at login.
   If seeded identities drift, login rewrites the protected portal assignments before session creation.

5. Portal defaults fail toward the assigned local portal.
   The active portal is selected from the host binding, then the requested portal, then an explicit default flag.

6. Public runtime entrypoints are namespaced.
   Lab ERP launchers now target `lab_erp_app.py`, reducing accidental cross-project startup against the wrong `app.py`.

7. Shared credentials are not a trust boundary.
   Even when the same username/password exists in multiple ERPs, database files, cookies, and portal gates stay local to that ERP/runtime.

Operational rule:
Do not add new cross-portal admin accounts unless there is a documented reason and a host-bound access check for that account.
