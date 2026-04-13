# Catalyst ERP — Compute Software Inventory

**For:** IT Department, Research Dean, Faculty In-Charge
**Updated:** 2026-04-13
**Platform:** catalysterp.org → Catalyst ERP Compute Module

## Available Software (12 packages)

| Software | Version | Category | License | Replaces | AI Conversion |
|---|---|---|---|---|---|
| GNU Octave | 9.2 | Numerical Computing | Open Source | MATLAB | ✅ Auto-converts .m files |
| Python 3 + SciPy | 3.12 | General Scientific | Open Source | — | — |
| R | 4.4 | Statistics | Open Source | — | — |
| OpenFOAM | 12 | CFD Simulation | Open Source | — | — |
| CalculiX | 2.21 | FEA/Structural | Open Source | ANSYS / Abaqus | Reads Abaqus .inp |
| ORCA | 6.0 | Quantum Chemistry | Academic Free | Gaussian | ✅ Auto-converts .gjf/.com |
| NWChem | 7.2 | Computational Chemistry | Open Source | Gaussian | ✅ Auto-converts .gjf |
| Psi4 | 1.9 | Quantum Chemistry | Open Source | — | — |
| Elmer FEM | 9.0 | Multiphysics | Open Source | COMSOL | Manual only |
| SageMath | 10.4 | Symbolic Math | Open Source | Mathematica | ✅ Auto-converts .wl |
| LAMMPS | 2024.8 | Molecular Dynamics | Open Source | — | — |
| GROMACS | 2024.4 | Molecular Dynamics | Open Source | — | — |

## Commercial → Open Source Mapping

| Commercial | Annual License Cost | Open Source Replacement | Conversion |
|---|---|---|---|
| MATLAB | ~₹1.5L/seat | GNU Octave | AI auto-converts ~95% of .m files |
| Gaussian | ~₹3L/group | ORCA + NWChem | AI converts input files |
| Mathematica | ~₹80K/seat | SageMath | AI converts basic Wolfram Language |
| ANSYS | ~₹5L+/seat | CalculiX (FEA) + OpenFOAM (CFD) | Reads Abaqus format; no direct ANSYS conversion |
| COMSOL | ~₹4L+/seat | Elmer FEM | No auto-conversion |

## Gap Analysis — Software Not Yet Available

| Software | Status | Workaround |
|---|---|---|
| ANSYS Fluent/Mechanical | Not installed | OpenFOAM (CFD) + CalculiX (FEA) cover most use cases |
| COMSOL Multiphysics | Not installed | Elmer FEM for multiphysics |
| LabVIEW | No equivalent | Python + NI-DAQmx for new projects |
| Origin Pro | Not installed | Python + Matplotlib (AI can convert Origin scripts) |
| Schrodinger Suite | Not installed | ORCA + GROMACS for drug discovery |

## Department Usage Matrix

| Department | Primary Software | Key Use Cases |
|---|---|---|
| Chemistry | ORCA, NWChem, Psi4, GROMACS, LAMMPS | Quantum chemistry, molecular dynamics |
| Physics | Psi4, Elmer FEM, SageMath | Quantum mechanics, electromagnetics |
| Mechanical Eng. | OpenFOAM, CalculiX, GNU Octave | CFD, structural FEA |
| Civil Eng. | CalculiX, GNU Octave | Structural analysis |
| Electrical Eng. | Elmer FEM, GNU Octave | Electromagnetics, signal processing |
| Biotechnology | GROMACS, R, Python | Protein simulations, biostatistics |
| Pharma | R, Python, GROMACS | Drug discovery statistics |
| Chemical Eng. | OpenFOAM, Python | Process simulation |
| Mathematics | SageMath, Python | Symbolic math, optimization |
| Materials Science | LAMMPS, GROMACS | Molecular dynamics, materials modeling |
| Computer Science | Python, R | ML training, algorithm benchmarking |

## Infrastructure

- **Server:** Mac Mini M4, 24 GB RAM
- **Location:** MIT-WPU Campus
- **Max Concurrent Jobs:** 2
- **Max Job Duration:** 120 minutes
- **Output Storage:** 100 GB cap, auto-deleted after 7 days
- **Access:** Via Catalyst ERP at catalysterp.org/compute

## How It Works

1. User selects software from the catalog
2. Uploads input files (scripts, data, archives)
3. AI analyzes the code and estimates resources (memory, cores, time)
4. If the input is from commercial software (e.g., MATLAB .m file), AI auto-converts it
5. Job runs on the compute server with enforced time and memory limits
6. Output files available for download for 7 days
7. Traditional manual job submission always available alongside AI

## Contact

- **System:** catalysterp.org/compute/inventory
- **Admin:** Central Research Facility, MIT-WPU
