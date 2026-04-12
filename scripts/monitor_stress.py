#!/usr/bin/env python3
"""System monitor + stress test runner. Samples CPU, memory, temperature, battery every 2s.
Saves CSV for plotting. Runs parallel crawlers to generate load."""

import csv
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "reports"
DATA_DIR.mkdir(exist_ok=True)
CSV_PATH = DATA_DIR / "stress_monitor.csv"
DURATION = int(sys.argv[1]) if len(sys.argv) > 1 else 120  # seconds

def get_cpu():
    """Get CPU usage percentage."""
    out = subprocess.check_output(["top", "-l", "1", "-n", "0"], text=True, timeout=10)
    for line in out.splitlines():
        if "CPU usage" in line:
            # "CPU usage: 12.5% user, 8.3% sys, 79.1% idle"
            parts = line.split(",")
            idle = float(parts[-1].split("%")[0].strip())
            return round(100 - idle, 1)
    return 0.0

def get_memory():
    """Get memory pressure percentage."""
    out = subprocess.check_output(["vm_stat"], text=True, timeout=5)
    pages = {}
    for line in out.splitlines():
        if ":" in line:
            key, val = line.split(":", 1)
            val = val.strip().rstrip(".")
            try:
                pages[key.strip()] = int(val)
            except ValueError:
                pass
    active = pages.get("Pages active", 0) * 16384
    wired = pages.get("Pages wired down", 0) * 16384
    total_gb = 32  # M1 Pro 32GB
    used_gb = (active + wired) / (1024**3)
    return round(used_gb / total_gb * 100, 1)

def get_temperature():
    """Get CPU die temperature from ioreg (approximate)."""
    try:
        out = subprocess.check_output(
            ["ioreg", "-r", "-n", "AppleARMIODevice", "-d", "1"],
            text=True, timeout=5, stderr=subprocess.DEVNULL
        )
        # Try to find thermal data
        for line in out.splitlines():
            if "temperature" in line.lower() and "=" in line:
                val = line.split("=")[-1].strip().rstrip(">").strip()
                try:
                    t = float(val)
                    if 20 < t < 120:
                        return t
                except ValueError:
                    pass
    except Exception:
        pass
    return -1.0

def get_battery():
    """Get battery percentage and charging state."""
    try:
        out = subprocess.check_output(["pmset", "-g", "batt"], text=True, timeout=5)
        for line in out.splitlines():
            if "%" in line:
                pct = int(line.split("%")[0].split()[-1])
                charging = "charging" in line.lower() and "not charging" not in line.lower()
                return pct, charging
    except Exception:
        pass
    return -1, False

def get_python_processes():
    """Count Python processes and their total CPU."""
    try:
        out = subprocess.check_output(["ps", "aux"], text=True, timeout=5)
        count = 0
        cpu_total = 0.0
        for line in out.splitlines():
            if "python" in line.lower() and "grep" not in line and "monitor_stress" not in line:
                parts = line.split()
                cpu_total += float(parts[2])
                count += 1
        return count, round(cpu_total, 1)
    except Exception:
        return 0, 0.0

print(f"Monitoring for {DURATION}s → {CSV_PATH}")
with open(CSV_PATH, "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["timestamp", "elapsed_s", "cpu_pct", "mem_pct", "temp_c", "battery_pct", "charging", "python_procs", "python_cpu_pct"])
    start = time.time()
    while time.time() - start < DURATION:
        elapsed = round(time.time() - start, 1)
        cpu = get_cpu()
        mem = get_memory()
        temp = get_temperature()
        batt_pct, charging = get_battery()
        py_count, py_cpu = get_python_processes()
        row = [datetime.now().isoformat(), elapsed, cpu, mem, temp, batt_pct, int(charging), py_count, py_cpu]
        writer.writerow(row)
        f.flush()
        print(f"  t={elapsed:6.1f}s  CPU={cpu:5.1f}%  MEM={mem:4.1f}%  TEMP={temp:5.1f}°C  BATT={batt_pct}%{'⚡' if charging else ''}  PY={py_count}@{py_cpu}%")
        time.sleep(2)

print(f"\nData saved to {CSV_PATH}")
