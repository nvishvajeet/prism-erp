# Compute Server — Software Guide

## Open-Source Alternatives to Proprietary Software

Every proprietary tool used in university research has a capable open-source alternative. In most cases, input files can be converted between formats — and AI agents can rewrite scripts from one system to another.

### Structural / Mechanical FEA

| Proprietary | Open-Source Alternative | Compatibility |
|---|---|---|
| **ANSYS Mechanical** | **CalculiX** + **PrePoMax** (GUI) | Reads ANSYS .inp files directly. Nearly 1:1 keyword compatibility. |
| **Abaqus** | **CalculiX** | Reads Abaqus .inp natively — designed as a drop-in replacement. |
| **COMSOL** | **Elmer FEM** | Different input format, but same physics. AI can convert COMSOL .mph → Elmer .sif. |
| **SolidWorks Simulation** | **FreeCAD + CalculiX** | FreeCAD reads STEP/IGES, meshes with Gmsh, solves with CalculiX. |

### CFD (Computational Fluid Dynamics)

| Proprietary | Open-Source Alternative | Compatibility |
|---|---|---|
| **ANSYS Fluent** | **OpenFOAM** | Industry standard open-source CFD. Different input format but same physics. AI can translate Fluent journal → OpenFOAM case setup. |
| **ANSYS CFX** | **OpenFOAM** | Same as above. |
| **STAR-CCM+** | **OpenFOAM** + **ParaView** (visualization) | ParaView replaces STAR's post-processing. |

### Electronics / Circuit Simulation

| Proprietary | Open-Source Alternative | Compatibility |
|---|---|---|
| **MATLAB/Simulink** | **GNU Octave** + **Scilab** | Octave runs .m files directly. Simulink → Scilab/Xcos with model conversion. |
| **LabVIEW** | **Python + PyDAQmx** | Different paradigm (text vs graphical), but AI can translate .vi logic → Python. |
| **PSpice / OrCAD** | **KiCad** + **ngspice** | ngspice reads SPICE netlists. KiCad for PCB design. |
| **Cadence Virtuoso** | **Xschem** + **ngspice** | For IC design — Xschem as schematic editor, ngspice as simulator. |
| **LTspice** | **ngspice** + **Qucs-S** | Qucs-S provides GUI, ngspice does simulation. LTspice netlists work in ngspice. |

### Chemistry / Materials Science

| Proprietary | Open-Source Alternative | Compatibility |
|---|---|---|
| **Gaussian** | **ORCA** (free for academics) or **NWChem** | Different input format, but same quantum chemistry. AI converts .gjf → ORCA .inp. |
| **VASP** | **Quantum ESPRESSO** | Both do DFT. Different input files but same physics. QE is fully open-source. |
| **Materials Studio** | **LAMMPS** + **VESTA** + **Avogadro** | LAMMPS for MD, VESTA for crystal visualization, Avogadro for molecular modeling. |
| **ChemDraw** | **Open Babel** + **RDKit** + **Avogadro** | Open Babel converts between 100+ chemical formats. RDKit for cheminformatics. |

### Mathematics / Data Analysis

| Proprietary | Open-Source Alternative | Compatibility |
|---|---|---|
| **MATLAB** | **GNU Octave** | Runs .m scripts directly. 95%+ syntax compatible. |
| **Mathematica** | **SageMath** or **SymPy** | Different syntax, but AI can translate .nb → .sage or Python+SymPy. |
| **Minitab / SPSS** | **R** + **jamovi** | R covers all statistical methods. jamovi provides a point-and-click GUI. |
| **Origin** (plotting) | **gnuplot** + **matplotlib** | Publication-quality plots. AI can convert Origin projects → Python scripts. |
| **Maple** | **Maxima** or **SageMath** | Computer algebra systems. |

### Imaging / Microscopy

| Proprietary | Open-Source Alternative | Compatibility |
|---|---|---|
| **ZEN (Zeiss)** | **ImageJ/Fiji** | Reads .czi files. Macro language for batch processing. |
| **NIS-Elements (Nikon)** | **ImageJ/Fiji** | Reads .nd2 files via Bio-Formats plugin. |
| **Imaris** | **napari** (Python) | 3D visualization of microscopy data. |
| **Digital Micrograph** | **HyperSpy** (Python) | Electron microscopy data analysis. |

### Document Preparation

| Proprietary | Open-Source Alternative | Compatibility |
|---|---|---|
| **MS Word** | **LaTeX** or **LibreOffice** | LaTeX for papers/theses, LibreOffice for general docs. |
| **Overleaf** | **LaTeX** (local) | Same .tex files, just runs locally instead of cloud. |
| **Grammarly** | **LanguageTool** | Open-source grammar checker. |

---

## Can AI Convert Between Systems?

**Yes.** For most use cases, an AI agent (Claude, GPT, etc.) can:

1. **Read a proprietary input file** (ANSYS .inp, MATLAB .m, Gaussian .gjf)
2. **Understand the physics/math** described in it
3. **Rewrite it** for the open-source equivalent (CalculiX .inp, Octave .m, ORCA .inp)

### What converts well:
- MATLAB → Octave (almost identical syntax)
- ANSYS/Abaqus → CalculiX (same .inp format)
- Gaussian → ORCA/NWChem (AI rewrites basis sets + keywords)
- SPICE netlists → ngspice (mostly identical)
- Origin plots → matplotlib Python scripts

### What needs more care:
- Simulink models → Scilab/Xcos (graphical → graphical, needs manual review)
- COMSOL multi-physics → Elmer (different solver setup)
- Complex Fluent UDFs → OpenFOAM (C++ but different API)

### The workflow:
```
User uploads proprietary input file
  → AI agent reads it
  → AI rewrites for open-source solver
  → Job runs on open-source backend
  → Results in same format
```

This is a future feature for the Compute module — automatic format conversion.

---

## Installing Proprietary Software (via AnyDesk)

For software that requires a university license, connect to the Mac mini via AnyDesk and install manually:

### MATLAB
1. Go to https://www.mathworks.com/academia/tah-portal/mit-world-peace-university-31585498.html
2. Sign in with your MIT-WPU email
3. Download MATLAB for macOS (Apple Silicon)
4. Install the .dmg
5. Activate with university license
6. Verify: `matlab -batch "disp('hello')"`

### ANSYS
1. Go to your university ANSYS portal or download from https://www.ansys.com/academic
2. Download ANSYS Student/Academic for macOS
3. Install and enter license server: `your-university-license-server:1055`
4. Verify: `ansys241 -b -i test.inp`

### COMSOL
1. Download from https://www.comsol.com/product-download
2. Use university floating license server
3. Install the .dmg
4. Verify: `comsol batch -inputfile test.mph`

### Note
After installing any proprietary software, the Compute module automatically picks it up — just make sure the binary is in PATH or update the command template in the Software Catalog (`/compute/software`).
