# Ravikiran Contamination Appendix — Warmup T+15

> Grep-only inventory of MITWPU / lab / instrument contamination
> in `ravikiran-erp/`. Generated during Claude 0 Warmup.
> **No code changes** — this is the fix list for Phase 1.

## Summary

- Scope: `ravikiran-erp/app.py` and `ravikiran-erp/templates/*.html`
- Patterns: `MITWPU`, `Central Instrumentation`, `FESEM`, `ICP-MS`, `XRD`, `Raman`, `UV-Vis`, `AFM`, `BET`, `DSC`, `TGA`, `Battery Fab`, `Lab ERP`, `Lab R&D`, `Kondhalkar`, `Dean Rao`, `prism.local`, `mitwpu.edu.in`
- Matches:       80 lines

## By file

- `app.py`: 112 hits
- `templates/base.html`: 1 hits
- `templates/new_request.html`: 4 hits

## Fix plan (Phase 1 Lane 1)

1. **Persona emails** (`app.py` lines 80, 5274, 5299, 5301): `prism.local` → `ravikiran.local`; `Dean Rao` + `Kondhalkar` personas removed from seed.
2. **Instrument inventory** (`app.py` lines ~5329–5400): delete the FESEM / ICP-MS / XRD / Raman / UV-Vis / Battery Fab block entirely. Replace with an empty instruments list (Ravikiran has no instruments) or a household-appropriate equivalent if modules need a non-empty table.
3. **`GOOGLE_ALLOWED_DOMAIN`** (`app.py` line 304): default `mitwpu.edu.in` → env-driven with no hard default; pin via `.env` on mini only.
4. **Templates** (`base.html`, `new_request.html`): verify no "MITWPU / Lab" strings in UI copy. Warmup found filename matches but no line-level hits — double-check visible text in Phase 1.

## Raw grep output

```
app.py:70:    # Default: owner@prism.local (the demo seed super_admin).
app.py:73:        "owner@prism.local",
app.py:78:    "owner": {"label": "Owner", "email": "owner@prism.local"},
app.py:79:    "super_admin": {"label": "Super Admin", "email": "dean@prism.local"},
app.py:80:    "instrument_admin": {"label": "Instrument Admin", "email": "kondhalkar@prism.local"},
app.py:81:    "site_admin": {"label": "Site Admin", "email": "siteadmin@prism.local"},
app.py:82:    "operator": {"label": "Operator", "email": "anika@prism.local"},
app.py:83:    "member": {"label": "Member", "email": "user1@prism.local"},
app.py:84:    "finance": {"label": "Finance", "email": "meera@prism.local"},
app.py:85:    "professor": {"label": "Approver", "email": "approver@prism.local"},
app.py:304:GOOGLE_ALLOWED_DOMAIN = os.environ.get("GOOGLE_ALLOWED_DOMAIN", "mitwpu.edu.in")  # change this to your institution's domain
app.py:319:SENDGRID_FROM = os.environ.get("SENDGRID_FROM", "noreply@prism.local")
app.py:535:      - 8 characters from a friendly alphabet (no 0/O/1/l/I ambiguity)
app.py:539:    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
app.py:540:    return "".join(secrets.choice(alphabet) for _ in range(8))
app.py:1240:    two operators / two finance officers / etc. will alternate between
app.py:4075:            --   GrantAlloc→ many-to-many between grants and projects.
app.py:4083:            -- beta.1 drops them. Each step is a separate tag, each
app.py:4084:            -- reversible up to beta.1.
app.py:4604:    # v1.6.2 — seed demo messages between canonical personas so the
app.py:4641:        mid-run produces a null gap between existing and new writes.
app.py:4654:    better than no cleanup.
app.py:5082:             "Phase 1 — FESEM + XRD + AFM characterization of functional coatings."),
app.py:5085:             "Bilateral grant — XRD + Raman access for cross-institute samples."),
app.py:5150:             "Re: FESEM maintenance window",
app.py:5155:             "Hi — I've approved your latest request on the FESEM queue. It should move into the operator's schedule later today. Let me know if you need anything else on the write-up side.",
app.py:5199:                "FESEM preventive maintenance — Monday 09:00–13:00",
app.py:5206:                "DST-SERB grant applications for the next funding cycle close April 30. PIs should submit instrument usage projections to the finance office by April 25. Contact finance@prism.local for the budget template.",
app.py:5274:        "owner@prism.local", "dean@prism.local", "kondhalkar@prism.local",
app.py:5275:        "siteadmin@prism.local", "anika@prism.local", "ravi@prism.local",
app.py:5276:        "chetan@prism.local", "meera@prism.local", "suresh@prism.local",
app.py:5277:        "approver@prism.local",
app.py:5278:        "user1@prism.local", "user2@prism.local", "user3@prism.local",
app.py:5279:        "user4@prism.local", "user5@prism.local",
app.py:5297:        ("Facility Owner", "owner@prism.local",  "super_admin"),
app.py:5299:        ("Dean Rao",             "dean@prism.local",        "super_admin"),
app.py:5300:        # Kondhalkar — admin across many instruments
app.py:5301:        ("Prof. Kondhalkar",     "kondhalkar@prism.local",  "instrument_admin"),
app.py:5303:        ("Site Admin",           "siteadmin@prism.local",   "site_admin"),
app.py:5305:        ("Operator Anika",       "anika@prism.local",       "operator"),
app.py:5306:        ("Operator Ravi",        "ravi@prism.local",        "operator"),
app.py:5307:        ("Operator Chetan",      "chetan@prism.local",      "operator"),
app.py:5309:        ("Finance Meera",        "meera@prism.local",       "finance_admin"),
app.py:5310:        ("Finance Suresh",       "suresh@prism.local",      "finance_admin"),
app.py:5312:        ("Prof. Approver",       "approver@prism.local",    "professor_approver"),
app.py:5314:        ("User One",             "user1@prism.local",       "requester"),
app.py:5315:        ("User Two",             "user2@prism.local",       "requester"),
app.py:5316:        ("User Three",           "user3@prism.local",       "requester"),
app.py:5317:        ("User Four",            "user4@prism.local",       "requester"),
app.py:5318:        ("User Five",            "user5@prism.local",       "requester"),
app.py:5329:    # compat: INST-001 = FESEM (smoke_test fixture), INST-002 = ICP-MS,
app.py:5330:    # INST-003 = XRD. New instruments INST-004 onward are appended.
app.py:5333:        ("FESEM", "INST-001", "Microscopy", "Facility Bay A — Imaging Hall", 4,
app.py:5345:        ("ICP-MS", "INST-002", "Spectroscopy", "Facility Bay B — Analytical", 3,
app.py:5349:         "", "", "ICP-MS for trace and ultra-trace multi-element analysis in liquids and digests.", 1, 1),
app.py:5350:        ("XRD", "INST-003", "Diffraction", "Facility Bay B — Analytical", 5,
app.py:5351:         "Empyrean DY3280 with 1Der detector, vertical goniometer, GIXRD capable, large reference-pattern library.",
app.py:5353:         "X-Ray Diffractometer for phase ID, crystal structure, thin-film GIXRD on powders and solids.",
app.py:5355:        ("Raman Spectrometer", "INST-004", "Spectroscopy", "Facility Bay B — Analytical", 4,
app.py:5365:        ("UV-Visible / UV-DRS", "INST-011", "Spectroscopy", "Facility Bay B — Analytical", 6,
app.py:5368:         "UV-Visible spectrophotometer with Diffuse Reflectance accessory — band gap, photoinitiator quant, degradation studies.",
app.py:5369:         "", "", "UV-Vis with DRS for liquid + solid characterization.", 1, 0),
app.py:5370:        ("UV-VIS-NIR Spectrophotometer", "INST-012", "Spectroscopy", "Facility Bay B — Analytical", 5,
app.py:5373:         "Research-grade UV-VIS-NIR spectrophotometer — band gap, AR coatings, optical fibers, biological NIR analysis.",
app.py:5374:         "", "", "UV-VIS-NIR Spectrophotometer with three-detector full-range system.", 1, 0),
app.py:5393:        # ── Battery fabrication cluster ────────────────────────────
app.py:5394:        ("Battery Fabrication System", "INST-010", "Energy Storage", "Facility Bay D — Battery Lab", 3,
app.py:5397:         "Complete coin-cell battery fabrication facility for Li-ion + Na-ion half/full cells with full electrochemical testing.",
app.py:5398:         "", "", "End-to-end coin-cell battery fabrication and electrochemical testing.", 1, 0),
app.py:5459:        # ── Kondhalkar is admin on most instruments ───────────────
app.py:5460:        ("kondhalkar@prism.local", "INST-001", "admin"),
app.py:5461:        ("kondhalkar@prism.local", "INST-002", "admin"),
app.py:5462:        ("kondhalkar@prism.local", "INST-003", "admin"),
app.py:5463:        ("kondhalkar@prism.local", "INST-004", "admin"),
app.py:5464:        ("kondhalkar@prism.local", "INST-005", "admin"),
app.py:5465:        ("kondhalkar@prism.local", "INST-006", "admin"),
app.py:5466:        ("kondhalkar@prism.local", "INST-007", "admin"),
app.py:5467:        ("kondhalkar@prism.local", "INST-008", "admin"),
app.py:5468:        ("kondhalkar@prism.local", "INST-009", "admin"),
app.py:5469:        ("kondhalkar@prism.local", "INST-010", "admin"),
```
