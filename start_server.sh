#!/bin/bash

# Lab Scheduler Local Startup Script

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

echo "--------------------------------------"
echo "   Starting Lab Scheduler Server      "
echo "--------------------------------------"

if ! command -v python3 &> /dev/null; then
    echo "Error: python3 not found. Please install Python 3."
    read -p "Press Enter to exit..."
    exit 1
fi

# Create venv if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "[1/3] Creating virtual environment..."
    python3 -m venv .venv
fi

# Determine python/pip to use
PYTHON=".venv/bin/python"
PIP=".venv/bin/pip"

# Fallback to existing venv/ if .venv creation failed
if [ ! -f "$PYTHON" ] && [ -f "venv/bin/python" ]; then
    PYTHON="venv/bin/python"
    PIP="venv/bin/pip"
fi

# Kill any existing server on port 5055
EXISTING_PID=$(lsof -ti :5055)
if [ -n "$EXISTING_PID" ]; then
    echo "Stopping existing server (PID $EXISTING_PID)..."
    kill "$EXISTING_PID" 2>/dev/null
    sleep 1
fi

echo "[2/3] Checking dependencies..."
$PIP install -q --upgrade pip
$PIP install -q -r requirements.txt

echo "[3/3] Launching server..."
echo "Access the website at: http://127.0.0.1:5055"
echo "Press Ctrl+C to stop."
echo "--------------------------------------"

# Open browser after a short delay
(sleep 2 && open "http://127.0.0.1:5055") &

$PYTHON lab_erp_app.py
