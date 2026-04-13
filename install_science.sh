#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Catalyst Scientific ERP — Science Stack Installer
#
# Installs the full open-source scientific computing backend
# that powers the Compute module. Run AFTER install.sh.
#
# Usage:
#   bash install_science.sh              # full science stack
#   bash install_science.sh --minimal    # just Python science + Octave
#   bash install_science.sh --check      # verify what's installed
#
# This replaces ~Rs 70 lakh-1.5 crore/year of proprietary
# software licenses with free, open-source alternatives.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

LOG="/tmp/catalyst-science-$(date +%Y%m%d-%H%M%S).log"
MODE="full"
VENV="${CATALYST_VENV:-.venv}"

for arg in "$@"; do
  case $arg in
    --minimal)  MODE="minimal" ;;
    --check)    MODE="check" ;;
    --help|-h)  head -15 "$0" | grep '^#' | sed 's/^# \?//'; exit 0 ;;
  esac
done

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }
info() { echo -e "    ${CYAN}$1${NC}"; }

cmd_exists() { command -v "$1" &>/dev/null; }

OS="$(uname -s)"
ARCH="$(uname -m)"

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Catalyst Science Stack — Open-Source HPC Backend     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════
# CHECK MODE — just report what's installed
# ═══════════════════════════════════════════════════════════════
if [[ "$MODE" == "check" ]]; then
  echo -e "${CYAN}Software Status:${NC}"
  echo ""

  check_tool() {
    local name="$1" cmd="$2" replaces="$3"
    if eval "$cmd" &>/dev/null; then
      local ver
      ver=$(eval "$cmd" 2>&1 | head -1 | grep -oE '[0-9]+\.[0-9]+[.0-9]*' | head -1)
      printf "  ${GREEN}✓${NC} %-20s %-12s  (replaces %s)\n" "$name" "${ver:-ok}" "$replaces"
    else
      printf "  ${RED}✗${NC} %-20s %-12s  (replaces %s)\n" "$name" "missing" "$replaces"
    fi
  }

  echo "  MATHEMATICS & NUMERICAL"
  check_tool "GNU Octave"      "octave --version"       "MATLAB (~3L/yr)"
  check_tool "Python 3"        "python3 --version"      "—"
  check_tool "R"               "R --version"            "SPSS/Minitab (~2L/yr)"
  check_tool "Julia"           "julia --version"        "—"
  check_tool "Maxima"          "maxima --version"       "Mathematica (~3L/yr)"
  check_tool "gnuplot"         "gnuplot --version"      "Origin (~2L/yr)"
  check_tool "SageMath"        "sage --version"         "Maple (~2L/yr)"
  echo ""

  echo "  SIMULATION & FEA"
  check_tool "CalculiX"        "ccx --version"          "ANSYS/Abaqus (~15L/yr)"
  check_tool "Gmsh"            "gmsh --version"         "HyperMesh (~5L/yr)"
  check_tool "OpenFOAM"        "simpleFoam -help"       "ANSYS Fluent (~15L/yr)"
  check_tool "Elmer"           "ElmerSolver --version"  "COMSOL (~15L/yr)"
  check_tool "OpenMPI"         "mpirun --version"       "—"
  echo ""

  echo "  ELECTRONICS"
  check_tool "ngspice"         "ngspice --version"      "PSpice/LTspice (~2L/yr)"
  check_tool "KiCad"           "kicad --version"        "OrCAD (~3L/yr)"
  check_tool "Icarus Verilog"  "iverilog -V"            "Xilinx Vivado"
  check_tool "Verilator"       "verilator --version"    "Mentor Questa (~20L/yr)"
  echo ""

  echo "  CHEMISTRY & MATERIALS"
  check_tool "LAMMPS"          "lmp --version"          "Materials Studio (~10L/yr)"
  check_tool "Quantum ESPRESSO" "pw.x --version"        "VASP (~5L/yr)"
  check_tool "Avogadro"        "avogadro2 --version"    "ChemDraw (~2L/yr)"
  echo ""

  echo "  VISUALIZATION & DOCS"
  check_tool "ParaView"        "paraview --version"     "ANSYS post-processor"
  check_tool "ImageMagick"     "magick --version"       "—"
  check_tool "LaTeX"           "pdflatex --version"     "MS Word for papers"
  check_tool "Jupyter"         "$VENV/bin/jupyter --version" "—"
  check_tool "FFmpeg"          "ffmpeg -version"        "—"
  echo ""

  # Python science packages
  echo "  PYTHON SCIENCE STACK"
  for pkg in numpy scipy pandas matplotlib seaborn scikit-learn sympy networkx; do
    if "$VENV/bin/python" -c "import $pkg" 2>/dev/null; then
      local_ver=$("$VENV/bin/python" -c "import $pkg; print($pkg.__version__)" 2>/dev/null || echo "ok")
      printf "  ${GREEN}✓${NC} %-20s %s\n" "$pkg" "$local_ver"
    else
      printf "  ${RED}✗${NC} %-20s %s\n" "$pkg" "missing"
    fi
  done
  echo ""
  exit 0
fi

# ═══════════════════════════════════════════════════════════════
# INSTALL — detect package manager
# ═══════════════════════════════════════════════════════════════

install_brew() {
  local pkg="$1" label="${2:-$1}" replaces="${3:-}"
  if brew list --formula 2>/dev/null | grep -q "^${pkg}\$"; then
    log "$label already installed"
    return 0
  fi
  echo -ne "  Installing ${CYAN}$label${NC}..."
  if brew install "$pkg" >> "$LOG" 2>&1; then
    echo -e " ${GREEN}done${NC}"
    return 0
  else
    echo -e " ${RED}failed${NC}"
    warn "  See $LOG for details"
    return 1
  fi
}

install_apt() {
  local pkg="$1" label="${2:-$1}"
  if dpkg -l "$pkg" 2>/dev/null | grep -q '^ii'; then
    log "$label already installed"
    return 0
  fi
  echo -ne "  Installing ${CYAN}$label${NC}..."
  if sudo apt-get install -y -qq "$pkg" >> "$LOG" 2>&1; then
    echo -e " ${GREEN}done${NC}"
    return 0
  else
    echo -e " ${RED}failed${NC}"
    return 1
  fi
}

install_pip() {
  local pkg="$1"
  echo -ne "  pip: ${CYAN}$pkg${NC}..."
  if "$VENV/bin/pip" install "$pkg" >> "$LOG" 2>&1; then
    echo -e " ${GREEN}done${NC}"
  else
    echo -e " ${YELLOW}skipped${NC}"
  fi
}

# ═══════════════════════════════════════════════════════════════
# PYTHON SCIENCE STACK (all platforms)
# ═══════════════════════════════════════════════════════════════
echo -e "${BLUE}── Python Scientific Packages ──${NC}"

"$VENV/bin/pip" install --upgrade pip >> "$LOG" 2>&1

# Core numerical
"$VENV/bin/pip" install \
  numpy scipy pandas matplotlib seaborn \
  scikit-learn sympy networkx \
  Pillow jupyter notebook \
  >> "$LOG" 2>&1
log "Core science Python packages installed"

if [[ "$MODE" == "full" ]]; then
  # Extended science
  install_pip "hyperspy"       # electron microscopy
  install_pip "ase"            # atomic simulation environment
  install_pip "pymatgen"       # materials science
  install_pip "biopython"      # bioinformatics
  install_pip "astropy"        # astronomy
  install_pip "fenics-dolfinx" # FEA from Python
fi

# ═══════════════════════════════════════════════════════════════
# SYSTEM PACKAGES
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${BLUE}── System Scientific Software ──${NC}"

if [[ "$OS" == "Darwin" ]]; then
  # Ensure Homebrew PATH
  if [[ "$ARCH" == "arm64" ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)" 2>/dev/null || true
  fi

  # ── Tier 1: Essential (always install) ──
  echo -e "\n  ${CYAN}Tier 1: Essential${NC}"
  install_brew "python@3.12"   "Python 3.12"
  install_brew "octave"        "GNU Octave"          "MATLAB"
  install_brew "r"             "R"                   "SPSS/Minitab"
  install_brew "gnuplot"       "gnuplot"             "Origin"
  install_brew "gcc"           "GCC (gfortran)"
  install_brew "cmake"         "CMake"

  if [[ "$MODE" == "full" ]]; then
    # ── Tier 2: Simulation & FEA ──
    echo -e "\n  ${CYAN}Tier 2: Simulation & FEA${NC}"
    install_brew "julia"       "Julia"
    install_brew "gmsh"        "Gmsh"                "HyperMesh"
    install_brew "open-mpi"    "OpenMPI"
    install_brew "maxima"      "Maxima"               "Mathematica"
    # install_brew "calculix"  "CalculiX"             "ANSYS/Abaqus"  # may need tap
    # install_brew "openfoam"  "OpenFOAM"             "Fluent"        # may need tap

    # ── Tier 3: Electronics ──
    echo -e "\n  ${CYAN}Tier 3: Electronics${NC}"
    install_brew "ngspice"     "ngspice"              "PSpice/LTspice"
    # KiCad is a cask
    # install_brew "icarus-verilog" "Icarus Verilog"  "Xilinx"
    # install_brew "verilator"     "Verilator"        "Questa"

    # ── Tier 4: Visualization & Tools ──
    echo -e "\n  ${CYAN}Tier 4: Visualization & Tools${NC}"
    install_brew "graphviz"    "Graphviz"
    install_brew "imagemagick" "ImageMagick"
    install_brew "ghostscript" "Ghostscript"
    install_brew "ffmpeg"      "FFmpeg"
    install_brew "wget"        "wget"
  fi

elif [[ "$OS" == "Linux" ]]; then
  sudo apt-get update -qq >> "$LOG" 2>&1

  echo -e "\n  ${CYAN}Tier 1: Essential${NC}"
  install_apt "octave"         "GNU Octave"
  install_apt "r-base"         "R"
  install_apt "gnuplot"        "gnuplot"
  install_apt "gfortran"       "gfortran"
  install_apt "cmake"          "CMake"

  if [[ "$MODE" == "full" ]]; then
    echo -e "\n  ${CYAN}Tier 2: Simulation${NC}"
    install_apt "julia"          "Julia"
    install_apt "gmsh"           "Gmsh"
    install_apt "openmpi-bin"    "OpenMPI"
    install_apt "libopenmpi-dev" "OpenMPI-dev"
    install_apt "maxima"         "Maxima"
    install_apt "calculix-ccx"   "CalculiX"
    install_apt "elmerfe-csc"    "Elmer FEM"

    echo -e "\n  ${CYAN}Tier 3: Electronics${NC}"
    install_apt "ngspice"        "ngspice"
    install_apt "iverilog"       "Icarus Verilog"
    install_apt "verilator"      "Verilator"

    echo -e "\n  ${CYAN}Tier 4: Chemistry${NC}"
    install_apt "lammps"         "LAMMPS"
    # Quantum ESPRESSO typically from source or conda

    echo -e "\n  ${CYAN}Tier 5: Visualization${NC}"
    install_apt "paraview"       "ParaView"
    install_apt "imagemagick"    "ImageMagick"
    install_apt "ghostscript"    "Ghostscript"
    install_apt "graphviz"       "Graphviz"
    install_apt "ffmpeg"         "FFmpeg"
    install_apt "texlive-full"   "TeX Live"
  fi
fi

# ═══════════════════════════════════════════════════════════════
# COMPUTE WORKER SETUP
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${BLUE}── Compute Worker ──${NC}"

WORKER_DIR="$HOME/compute_jobs"
mkdir -p "$WORKER_DIR"/{inputs,outputs,logs}
log "Work directories created at $WORKER_DIR"

if [[ "$OS" == "Darwin" ]]; then
  PLIST_DIR="$HOME/Library/LaunchAgents"
  PLIST="$PLIST_DIR/org.catalyst.compute-worker.plist"
  mkdir -p "$PLIST_DIR"

  # Find app directory
  APP_DIR="$(cd "$(dirname "$0")" && pwd)"

  cat > "$PLIST" << PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>org.catalyst.compute-worker</string>
  <key>ProgramArguments</key>
  <array>
    <string>${APP_DIR}/${VENV}/bin/python</string>
    <string>${APP_DIR}/compute_worker.py</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${APP_DIR}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>CATALYST_URL</key>
    <string>${CATALYST_URL:-https://catalysterp.org}</string>
    <key>COMPUTE_SECRET</key>
    <string>${COMPUTE_SECRET:-catalyst-compute-2026}</string>
    <key>MAX_CONCURRENT</key>
    <string>${MAX_CONCURRENT:-3}</string>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
  <key>RunAtLoad</key>
  <false/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>StandardOutPath</key>
  <string>${WORKER_DIR}/logs/stdout.log</string>
  <key>StandardErrorPath</key>
  <string>${WORKER_DIR}/logs/stderr.log</string>
</dict>
</plist>
PLIST_EOF
  log "Created launchd plist"
  info "Start:  launchctl load $PLIST"
  info "Stop:   launchctl unload $PLIST"
fi

# ═══════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Science stack installation complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
echo ""
echo "  Run 'bash install_science.sh --check' to verify status."
echo ""
echo "  What this replaces (annual license costs):"
echo "  ┌──────────────────────┬──────────┬─────────────────────┐"
echo "  │ Proprietary          │ Cost/yr  │ Our Alternative     │"
echo "  ├──────────────────────┼──────────┼─────────────────────┤"
echo "  │ MATLAB               │ ~3L      │ GNU Octave          │"
echo "  │ ANSYS (Mech+Fluent)  │ ~15L     │ CalculiX + OpenFOAM │"
echo "  │ COMSOL               │ ~15L     │ Elmer FEM           │"
echo "  │ Abaqus               │ ~15L     │ CalculiX            │"
echo "  │ SolidWorks           │ ~8L      │ FreeCAD             │"
echo "  │ CATIA                │ ~20L     │ FreeCAD             │"
echo "  │ Cadence              │ ~30L     │ Xschem + ngspice    │"
echo "  │ Mathematica          │ ~3L      │ SageMath + Maxima   │"
echo "  │ Origin               │ ~2L      │ gnuplot+matplotlib  │"
echo "  │ Aspen HYSYS          │ ~20L     │ DWSIM               │"
echo "  ├──────────────────────┼──────────┼─────────────────────┤"
echo "  │ TOTAL                │ ~1.3 Cr  │ Rs 0                │"
echo "  └──────────────────────┴──────────┴─────────────────────┘"
echo ""
echo "  Full log: $LOG"
echo ""
