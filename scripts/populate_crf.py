#!/usr/bin/env python3
"""Populate CATALYST with MIT-WPU Central Research Facility data.

Wipes ALL existing data and seeds:
  - 21 instruments from the CRF brochure (12 major + 9 NABL)
  - Users: Dean R&D, owner/admin, secretary, operators, faculty, requesters
  - Grants with realistic Indian research funding
  - A handful of sample requests in various pipeline stages
  - Approval configs per instrument

Run on the mini:
  cd ~/Scheduler/Main && .venv/bin/python scripts/populate_crf.py
"""

import os, sys, json, hashlib
from datetime import datetime, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.chdir(os.path.join(os.path.dirname(__file__), ".."))

import app
from werkzeug.security import generate_password_hash

DEFAULT_PW = "catalyst2026"
PW_HASH = generate_password_hash(DEFAULT_PW, method="pbkdf2:sha256")

# ── Users ────────────────────────────────────────────────
USERS = [
    # (name, email, role)
    # Admins
    ("Dr. Bharat Chaudhari",   "dean.rnd@mitwpu.edu.in",       "super_admin"),
    ("Vishvajeet Nagargoje",   "vishvajeet@mitwpu.edu.in",      "owner"),
    ("Prof. Kondhalkar",       "kondhalkar@mitwpu.edu.in",      "site_admin"),
    # Finance
    ("Meera Deshmukh",         "meera.finance@mitwpu.edu.in",   "finance_admin"),
    # Faculty / Professor approvers
    ("Dr. Rajesh Patil",       "rajesh.patil@mitwpu.edu.in",    "professor_approver"),
    ("Dr. Sneha Kulkarni",     "sneha.kulkarni@mitwpu.edu.in",  "professor_approver"),
    ("Dr. Amit Joshi",         "amit.joshi@mitwpu.edu.in",      "professor_approver"),
    # Operators (some handle multiple instruments)
    ("Anika Sharma",           "anika.op@mitwpu.edu.in",        "operator"),   # FESEM + ICP-MS
    ("Ravi Kale",              "ravi.op@mitwpu.edu.in",         "operator"),   # XRD + Raman
    ("Priya Deshpande",        "priya.op@mitwpu.edu.in",        "operator"),   # Particle/Zeta + Nanoindenter
    ("Suresh Mane",            "suresh.op@mitwpu.edu.in",       "operator"),   # Surface Profiler + Tribometer
    ("Deepa Jadhav",           "deepa.op@mitwpu.edu.in",        "operator"),   # UV-Vis + UV-VIS-NIR
    ("Vikram Pawar",           "vikram.op@mitwpu.edu.in",       "operator"),   # Battery Fab + POM
    ("Manoj Gaikwad",          "manoj.op@mitwpu.edu.in",        "operator"),   # UTMs + Hardness + Fatigue
    # Requesters (researchers / PhD students)
    ("Ananya Bhosale",         "ananya.phd@mitwpu.edu.in",      "member"),
    ("Rohan Shinde",           "rohan.phd@mitwpu.edu.in",       "member"),
    ("Kavita Wagh",            "kavita.mtech@mitwpu.edu.in",    "member"),
    ("Siddharth Nair",         "siddharth.phd@mitwpu.edu.in",   "member"),
    ("Pooja Tambade",          "pooja.phd@mitwpu.edu.in",       "member"),
    ("Dr. Arun Mehta",         "arun.faculty@mitwpu.edu.in",    "member"),  # Faculty requester
]

# ── Instruments from CRF Brochure ────────────────────────
# (code, name, category, location, manufacturer, model, capacity, description)
INSTRUMENTS = [
    # 12 Major CRF instruments
    ("ICP-MS-01",  "Inductively Coupled Plasma Mass Spectrometer",
     "Spectroscopy", "CRF Building, Room 101",
     "SHIMADZU", "ICPMS-2040 LF", 4,
     "Trace and ultra-trace elemental analysis. Argon plasma ionisation with quadrupole mass filter. "
     "Dynamic range of 8+ orders of magnitude. Liquid and solid samples with correct preparation."),

    ("FESEM-01",   "Field Emission Scanning Electron Microscope",
     "Microscopy", "CRF Building, Room 102",
     "TESCAN", "S8152", 6,
     "High-resolution nanoscale imaging with FEG source. 50 eV–30 kV accelerating voltage. "
     "10X to 1,000,000X magnification. SED, In-Beam, Axial MD, and BSED detectors. "
     "High-vacuum and low-vacuum modes. In-chamber plasma cleaner and IR camera."),

    ("XRD-01",     "X-Ray Diffractometer",
     "Crystallography", "CRF Building, Room 103",
     "MALVERN PANALYTICAL", "Empyrean-DY3280", 8,
     "Phase composition, crystal structure, and orientation analysis. "
     "1Der detector, vertical goniometer, GIXRD capability. Powder and thin film characterisation."),

    ("RAMAN-01",   "Raman Spectrometer",
     "Spectroscopy", "CRF Building, Room 104",
     "JASCO", "NRS-4500", 6,
     "Confocal micro-Raman imaging and spectroscopy. 532 nm and 785 nm excitation lasers. "
     "50–8000 cm⁻¹ wavenumber range. ~1 cm⁻¹ resolution. Peltier-cooled CCD detector. "
     "2D/3D chemical mapping, depth profiling, stress/strain analysis."),

    ("PSA-01",     "Particle / Zeta Size Analyser",
     "Characterisation", "CRF Building, Room 105",
     "MALVERN PANALYTICAL", "Zetasizer Advance", 10,
     "DLS, ELS, and multi-angle light scattering. 0.3 nm–10 µm particle size range. "
     "Zeta potential 3.8 nm–100 µm. Minimum 3 µL sample volume. ISO 13321 & 22412 compliant."),

    ("NANO-01",    "Nanoindenter",
     "Mechanical Testing", "CRF Building, Room 106",
     "INDUSTRON", "NG-80", 6,
     "Nanomechanical property measurement: elastic modulus, hardness, fracture toughness. "
     "10 mN max load, 5 nN load resolution, 1 nm displacement resolution. "
     "Load-controlled and displacement-controlled modes."),

    ("PROF-01",    "Surface Profiler",
     "Characterisation", "CRF Building, Room 106",
     "BRUKER", "Dektak Pro", 8,
     "Surface roughness, thin film thickness, and residual stress measurement. "
     "6 mg max load, 3000 µm max scan length. Metals, polymers, ceramics, coatings."),

    ("TRIBO-01",   "Tribometer",
     "Mechanical Testing", "CRF Building, Room 107",
     "DUCOM", "POD-4.0", 4,
     "Pin-on-disc tribological and wear characterisation. Room temperature to 900°C. "
     "60 mm max sample diameter. Reciprocatory and rotary wear modes. "
     "Coefficient of friction and frictional force measurement."),

    ("POM-01",     "Polarizing Optical Microscope",
     "Microscopy", "CRF Building, Room 108",
     "OPTIKA", "B-510POL", 10,
     "Polarized light microscopy for anisotropic and transparent materials. "
     "4x–40x objectives, 360° rotatable stage with 0.1 mm vernier. "
     "Brightfield and transmitted polarisation modes. Integrated LCD with SD card."),

    ("BATT-01",    "Battery Fabrication System",
     "Fabrication", "CRF Building, Room 109",
     "MIT-WPU CRF", "Coin Cell Line", 3,
     "Complete coin-cell fabrication: slurry machine, doctor blade coater, vacuum oven, "
     "calendering machine, electrode punching, Ar glove box (<0.01 ppm H₂O/O₂), "
     "multi-channel battery tester. CR2032 Li-ion and Na-ion cells."),

    ("UV-VIS-01",  "UV-Visible and UV-Visible DRS Spectrophotometer",
     "Spectroscopy", "CRF Building, Room 110",
     "LABINDIA", "UV 3200 / UV 3092", 8,
     "Double-beam UV-Vis with DRS accessory. D2 lamp (190–350 nm) + W-halogen (350–800 nm). "
     "Transmission/absorbance for liquids, DRS for solids/powders. "
     "Band gap calculation, degradation studies, colorimetric analysis."),

    ("UV-NIR-01",  "UV-VIS-NIR Spectrophotometer",
     "Spectroscopy", "CRF Building, Room 110",
     "SHIMADZU", "UV-3600i Plus", 6,
     "185–3300 nm wavelength range. Three-detector system: PMT, InGaAs, cooled PbS. "
     "Ultra-low stray light <0.00005%. ±0.08 nm wavelength accuracy. "
     "Optical band gap, AR coatings, telecom components, biological NIR analysis."),

    # 9 NABL Accredited instruments
    ("UTM-100",    "Universal Testing Machine (100 kN)",
     "Mechanical Testing", "NABL Lab, Room 201",
     "—", "100 kN UTM", 6,
     "Tensile testing per IS 1608, ASTM E8/E8M, ASTM D3039/D3039M. 0–100 kN range."),

    ("HRD-ROCK",   "Hardness Testing Machine — Rockwell",
     "Mechanical Testing", "NABL Lab, Room 201",
     "—", "Rockwell Tester", 12,
     "Rockwell hardness testing per IS 1586 (Part 1)."),

    ("HRD-VB",     "Hardness Testing Machine — Vickers/Brinell",
     "Mechanical Testing", "NABL Lab, Room 201",
     "—", "Vickers/Brinell Tester", 12,
     "Macro-hardness testing per IS 1500 (Part 1)."),

    ("HRD-MV",     "Hardness Testing Machine — Micro-Vickers",
     "Mechanical Testing", "NABL Lab, Room 202",
     "—", "Micro-Vickers Tester", 12,
     "Micro-hardness testing per IS 1501 (Part 1) & ISO 6507-1."),

    ("UTM-5",      "Universal Testing Machine (5 kN)",
     "Mechanical Testing", "NABL Lab, Room 202",
     "—", "5 kN UTM", 8,
     "Low-force tensile/compression per ASTM E345. 0–5 kN range."),

    ("MICRO-RV3",  "Metallurgical Microscope RV 3",
     "Microscopy", "NABL Lab, Room 203",
     "—", "RV 3", 10,
     "Grain size analysis per ASTM E112. Metallographic examination."),

    ("FATIGUE-01", "Axial Computerized Fatigue Test Machine",
     "Mechanical Testing", "NABL Lab, Room 204",
     "—", "Axial Fatigue Tester", 3,
     "Fatigue testing per ASTM D3479 & D3479M. Computerized load cycling."),

    ("COMP-01",    "Compression Testing Machine",
     "Mechanical Testing", "NABL Lab, Room 204",
     "—", "Compression Tester", 8,
     "Compressive strength testing per IS 516 (Part 1/Sec 1). Concrete, mortar, building materials."),

    ("UTM-1000",   "Universal Testing Machine (1000 kN)",
     "Mechanical Testing", "NABL Lab, Room 205",
     "—", "1000 kN UTM", 4,
     "High-capacity tensile testing per IS 1608 (Part 1). 0–1000 kN range."),
]

# Operator → instrument assignments
# (operator_email, [instrument_codes])
OPERATOR_MAP = [
    ("anika.op@mitwpu.edu.in",  ["ICP-MS-01", "FESEM-01"]),
    ("ravi.op@mitwpu.edu.in",   ["XRD-01", "RAMAN-01"]),
    ("priya.op@mitwpu.edu.in",  ["PSA-01", "NANO-01"]),
    ("suresh.op@mitwpu.edu.in", ["PROF-01", "TRIBO-01"]),
    ("deepa.op@mitwpu.edu.in",  ["UV-VIS-01", "UV-NIR-01"]),
    ("vikram.op@mitwpu.edu.in", ["BATT-01", "POM-01"]),
    ("manoj.op@mitwpu.edu.in",  ["UTM-100", "HRD-ROCK", "HRD-VB", "HRD-MV",
                                  "UTM-5", "MICRO-RV3", "FATIGUE-01", "COMP-01", "UTM-1000"]),
]

# Faculty admin → instrument clusters
FACULTY_MAP = [
    ("rajesh.patil@mitwpu.edu.in",  ["ICP-MS-01", "FESEM-01", "XRD-01", "RAMAN-01"]),
    ("sneha.kulkarni@mitwpu.edu.in", ["PSA-01", "NANO-01", "PROF-01", "TRIBO-01", "POM-01", "BATT-01"]),
    ("amit.joshi@mitwpu.edu.in",    ["UV-VIS-01", "UV-NIR-01", "UTM-100", "HRD-ROCK", "HRD-VB",
                                     "HRD-MV", "UTM-5", "MICRO-RV3", "FATIGUE-01", "COMP-01", "UTM-1000"]),
]

# Grants
GRANTS = [
    ("DST-SERB-2024", "Nanostructured Thin Films for Energy Applications",
     "DST-SERB", "rajesh.patil@mitwpu.edu.in", 3500000,
     "2024-04-01", "2027-03-31", "active",
     "Core Research Grant for development of novel thin film coatings via sputtering."),
    ("CSIR-2025", "Advanced Battery Materials for Sodium-Ion Cells",
     "CSIR", "sneha.kulkarni@mitwpu.edu.in", 2800000,
     "2025-01-01", "2027-12-31", "active",
     "EMR grant for Na-ion cathode material synthesis and coin-cell characterisation."),
    ("UGC-SAP-2023", "Materials Characterisation Infrastructure",
     "UGC", "amit.joshi@mitwpu.edu.in", 5000000,
     "2023-07-01", "2028-06-30", "active",
     "SAP-DRS-II grant for CRF instrument maintenance and consumables."),
    ("BRNS-2025", "Tribological Coatings for Aerospace Components",
     "DAE-BRNS", "rajesh.patil@mitwpu.edu.in", 1800000,
     "2025-06-01", "2028-05-31", "active",
     "BRNS project grant for wear-resistant PVD coatings characterisation."),
]

# Sample requests to seed (varied statuses)
SAMPLE_REQUESTS = [
    # (requester_email, instrument_code, title, sample_name, count, status, description)
    ("ananya.phd@mitwpu.edu.in", "FESEM-01",
     "ZnO nanorod morphology", "ZnO-NR-A1", 3, "submitted",
     "SEM imaging of hydrothermally synthesised ZnO nanorods on Si substrate. Cross-section and top view needed."),
    ("rohan.phd@mitwpu.edu.in", "XRD-01",
     "Phase analysis of BaTiO₃ thin film", "BTO-TF-001", 2, "under_review",
     "XRD scan 20°–80° 2θ for phase purity check of PLD-deposited BaTiO₃ on SrTiO₃ substrate."),
    ("kavita.mtech@mitwpu.edu.in", "RAMAN-01",
     "Graphene quality check", "Gr-CVD-05", 1, "sample_submitted",
     "Raman spectroscopy at 532 nm to confirm monolayer graphene. D, G, 2D peak ratio analysis."),
    ("siddharth.phd@mitwpu.edu.in", "ICP-MS-01",
     "Heavy metal content in soil extract", "SOIL-MH-12", 5, "scheduled",
     "ICP-MS analysis for Pb, Cd, As, Cr, Hg in acid-digested soil samples from industrial site."),
    ("pooja.phd@mitwpu.edu.in", "PSA-01",
     "Silver nanoparticle size distribution", "AgNP-B3", 2, "in_progress",
     "DLS measurement of citrate-capped Ag nanoparticles. Size distribution + zeta potential."),
    ("ananya.phd@mitwpu.edu.in", "NANO-01",
     "Hardness of DLC coating", "DLC-SS-02", 4, "completed",
     "Nanoindentation on 500nm DLC film on SS316L substrate. Load-displacement curves needed."),
    ("arun.faculty@mitwpu.edu.in", "UV-NIR-01",
     "Band gap of TiO₂ photocatalyst", "TiO2-P25-mod", 2, "completed",
     "UV-VIS-NIR reflectance measurement for Tauc plot band gap determination of modified P25."),
    ("rohan.phd@mitwpu.edu.in", "TRIBO-01",
     "Wear rate of CrN coating", "CrN-Ti-07", 3, "submitted",
     "Pin-on-disc at 5N load, 200 rpm, room temperature. COF and wear track analysis."),
    ("kavita.mtech@mitwpu.edu.in", "BATT-01",
     "Na-ion half cell fabrication", "NVP-CC-01", 6, "under_review",
     "Fabricate CR2032 half cells: Na₃V₂(PO₄)₃ cathode vs Na metal. 3 cells at C/10, 3 at 1C rate."),
    ("siddharth.phd@mitwpu.edu.in", "UTM-100",
     "Tensile test of Al-SiC composite", "AlSiC-T5", 5, "sample_received",
     "Tensile testing per ASTM E8M. Dog-bone specimens, 1 mm/min crosshead speed."),
]


def run():
    app.init_db()
    import sqlite3
    db_path = "data/operational/lab_scheduler.db"
    db = sqlite3.connect(db_path)
    db.row_factory = sqlite3.Row
    c = db.cursor()

    print("=== CATALYST CRF Population Script ===")
    print(f"Database: {db_path}")
    print()

    # ── Wipe all data ──
    print("Wiping existing data...")
    tables_to_wipe = [
        "approval_steps", "request_attachments", "request_issues",
        "request_messages", "sample_requests", "grants",
        "instrument_operators", "instrument_admins", "instrument_faculty_admins",
        "instrument_approval_config", "instrument_downtime",
        "instrument_group_member", "instrument_group",
        "instruments", "user_roles", "messages", "announcements",
        "notices", "audit_logs", "generated_exports", "users",
    ]
    for t in tables_to_wipe:
        try:
            c.execute(f"DELETE FROM {t}")
        except Exception:
            pass
    # Reset autoincrement
    c.execute("DELETE FROM sqlite_sequence")
    db.commit()
    print("  Done — all tables cleared.\n")

    # ── Users ──
    print("Creating users...")
    user_ids = {}
    for name, email, role in USERS:
        c.execute(
            "INSERT INTO users (name, email, password_hash, role, invite_status, active, must_change_password) "
            "VALUES (?, ?, ?, ?, 'active', 1, 0)",
            (name, email, PW_HASH, role),
        )
        user_ids[email] = c.lastrowid
        print(f"  {role:20s} {name:30s} {email}")
    db.commit()
    print(f"  → {len(user_ids)} users created (password: {DEFAULT_PW})\n")

    # ── Instruments ──
    print("Creating instruments...")
    inst_ids = {}
    for code, name, category, location, mfr, model, cap, desc in INSTRUMENTS:
        c.execute(
            "INSERT INTO instruments "
            "(name, code, category, location, manufacturer, model_number, daily_capacity, "
            " status, accepting_requests, soft_accept_enabled, instrument_description, capabilities_summary) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 1, 0, ?, ?)",
            (name, code, category, location, mfr, model, cap, desc, desc[:200]),
        )
        inst_ids[code] = c.lastrowid
        print(f"  {code:12s} {name[:50]:50s} ({mfr} {model})")
    db.commit()
    print(f"  → {len(inst_ids)} instruments created\n")

    # ── Operator assignments ──
    print("Assigning operators...")
    for op_email, codes in OPERATOR_MAP:
        uid = user_ids[op_email]
        for code in codes:
            iid = inst_ids[code]
            c.execute("INSERT INTO instrument_operators (user_id, instrument_id) VALUES (?, ?)", (uid, iid))
        print(f"  {op_email:35s} → {', '.join(codes)}")
    db.commit()

    # ── Faculty admin assignments ──
    print("Assigning faculty admins...")
    for fac_email, codes in FACULTY_MAP:
        uid = user_ids[fac_email]
        for code in codes:
            iid = inst_ids[code]
            c.execute("INSERT INTO instrument_faculty_admins (user_id, instrument_id) VALUES (?, ?)", (uid, iid))
        print(f"  {fac_email:35s} → {len(codes)} instruments")
    db.commit()

    # ── Instrument admins (Kondhalkar = site admin for all) ──
    print("Assigning instrument admins (Kondhalkar)...")
    kondhalkar_id = user_ids["kondhalkar@mitwpu.edu.in"]
    for code, iid in inst_ids.items():
        c.execute("INSERT INTO instrument_admins (user_id, instrument_id) VALUES (?, ?)", (kondhalkar_id, iid))
    db.commit()
    print(f"  kondhalkar@mitwpu.edu.in → all {len(inst_ids)} instruments\n")

    # ── Approval configs (2-step: professor → finance for major instruments) ──
    print("Setting up approval workflows...")
    # Major CRF instruments get 2-step approval; NABL instruments get 1-step
    major_codes = [c for c, *_ in INSTRUMENTS[:12]]
    nabl_codes = [c for c, *_ in INSTRUMENTS[12:]]

    patil_id = user_ids["rajesh.patil@mitwpu.edu.in"]
    kulkarni_id = user_ids["sneha.kulkarni@mitwpu.edu.in"]
    joshi_id = user_ids["amit.joshi@mitwpu.edu.in"]
    meera_id = user_ids["meera.finance@mitwpu.edu.in"]

    for code in major_codes:
        iid = inst_ids[code]
        # Pick the faculty approver based on cluster
        if code in ["ICP-MS-01", "FESEM-01", "XRD-01", "RAMAN-01"]:
            prof_id = patil_id
        elif code in ["PSA-01", "NANO-01", "PROF-01", "TRIBO-01", "POM-01", "BATT-01"]:
            prof_id = kulkarni_id
        else:
            prof_id = joshi_id
        c.execute(
            "INSERT INTO instrument_approval_config (instrument_id, step_order, approver_role, approver_user_id) "
            "VALUES (?, 1, 'professor', ?)", (iid, prof_id))
        c.execute(
            "INSERT INTO instrument_approval_config (instrument_id, step_order, approver_role, approver_user_id) "
            "VALUES (?, 2, 'finance', ?)", (iid, meera_id))

    for code in nabl_codes:
        iid = inst_ids[code]
        c.execute(
            "INSERT INTO instrument_approval_config (instrument_id, step_order, approver_role, approver_user_id) "
            "VALUES (?, 1, 'professor', ?)", (iid, joshi_id))

    db.commit()
    print(f"  Major instruments: 2-step (professor → finance)")
    print(f"  NABL instruments: 1-step (professor)\n")

    # ── Grants ──
    print("Creating grants...")
    grant_ids = {}
    for code, name, sponsor, pi_email, budget, start, end, status, notes in GRANTS:
        pi_id = user_ids[pi_email]
        now_iso = datetime.utcnow().isoformat(timespec="seconds")
        c.execute(
            "INSERT INTO grants (code, name, sponsor, pi_user_id, total_budget, start_date, end_date, status, notes, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (code, name, sponsor, pi_id, budget, start, end, status, notes, now_iso),
        )
        grant_ids[code] = c.lastrowid
        print(f"  {code:15s} ₹{budget:>10,}  PI: {pi_email}")
    db.commit()
    print(f"  → {len(grant_ids)} grants created\n")

    # ── Sample Requests ──
    print("Creating sample requests...")
    now = datetime.utcnow()
    req_count = 0
    for i, (req_email, inst_code, title, sample, count, status, desc) in enumerate(SAMPLE_REQUESTS):
        req_id_user = user_ids[req_email]
        iid = inst_ids[inst_code]
        created = (now - timedelta(days=len(SAMPLE_REQUESTS) - i, hours=i * 3)).isoformat(timespec="seconds")
        request_no = f"CRF-2026-{i+1:04d}"

        completed_at = None
        if status == "completed":
            completed_at = (now - timedelta(days=1, hours=i)).isoformat(timespec="seconds")

        c.execute(
            "INSERT INTO sample_requests "
            "(request_no, requester_id, created_by_user_id, instrument_id, title, sample_name, "
            " sample_count, description, status, priority, created_at, updated_at, completed_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'normal', ?, ?, ?)",
            (request_no, req_id_user, req_id_user, iid, title, sample, count, desc,
             status, created, created, completed_at),
        )
        req_count += 1
        print(f"  {request_no} [{status:16s}] {title[:50]}")
    db.commit()
    print(f"  → {req_count} sample requests created\n")

    # ── Summary ──
    print("=" * 55)
    print("  CATALYST CRF populated successfully!")
    print(f"  Users:       {len(user_ids)}")
    print(f"  Instruments: {len(inst_ids)}")
    print(f"  Grants:      {len(grant_ids)}")
    print(f"  Requests:    {req_count}")
    print(f"  Password:    {DEFAULT_PW} (all users)")
    print("=" * 55)
    print()
    print("Login as:")
    print(f"  Owner:     vishvajeet@mitwpu.edu.in / {DEFAULT_PW}")
    print(f"  Dean R&D:  dean.rnd@mitwpu.edu.in / {DEFAULT_PW}")
    print(f"  Secretary: kondhalkar@mitwpu.edu.in / {DEFAULT_PW}")

    db.close()


if __name__ == "__main__":
    run()
