#!/usr/bin/env python3
"""
Catalyst ERP — Compute Worker Daemon

Runs on the Mac mini (or any server). Polls the Catalyst API for
queued jobs, executes them, and reports results back.

Usage:
    python3 compute_worker.py

Environment variables:
    CATALYST_URL        Base URL (default: https://catalysterp.org)
    COMPUTE_WORKER_SECRET Shared secret (preferred)
    COMPUTE_SECRET      Legacy shared secret fallback
    POLL_INTERVAL       Seconds between polls (default: 10)
    MAX_CONCURRENT      Max simultaneous jobs (default: 3)
    INPUT_DIR           Where to store downloaded input files
    OUTPUT_DIR          Where to store output files
    MAX_RUNTIME         Hard kill timeout in seconds (default: 7200 = 2h)
"""
from __future__ import annotations

import json
import os
import shutil
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from threading import Thread

# ── Configuration ──────────────────────────────────────────────
CATALYST_URL = os.environ.get("CATALYST_URL", "https://catalysterp.org").rstrip("/")
COMPUTE_SECRET = os.environ.get(
    "COMPUTE_WORKER_SECRET",
    os.environ.get("COMPUTE_SECRET", "catalyst-compute-2026"),
)
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL", "10"))
MAX_CONCURRENT = int(os.environ.get("MAX_CONCURRENT", "3"))
MAX_RUNTIME = int(os.environ.get("MAX_RUNTIME", "7200"))  # 2 hours

WORK_DIR = Path(os.environ.get("WORK_DIR", Path.home() / "compute_jobs"))
INPUT_DIR = WORK_DIR / "inputs"
OUTPUT_DIR = WORK_DIR / "outputs"
LOG_DIR = WORK_DIR / "logs"

for d in (WORK_DIR, INPUT_DIR, OUTPUT_DIR, LOG_DIR):
    d.mkdir(parents=True, exist_ok=True)

active_jobs: dict[int, subprocess.Popen] = {}


# ── API helpers ────────────────────────────────────────────────
def api_get(path: str) -> dict | None:
    """GET request to Catalyst API. Returns parsed JSON or None."""
    url = f"{CATALYST_URL}{path}"
    req = urllib.request.Request(url, headers={
        "X-Worker-Secret": COMPUTE_SECRET,
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            if resp.status == 204:
                return None
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        if e.code == 204:
            return None
        log(f"API GET {path} → HTTP {e.code}")
        return None
    except Exception as e:
        log(f"API GET {path} → {e}")
        return None


def api_post(path: str, data: dict) -> dict | None:
    """POST JSON to Catalyst API."""
    url = f"{CATALYST_URL}{path}"
    payload = json.dumps(data).encode()
    req = urllib.request.Request(url, data=payload, headers={
        "X-Worker-Secret": COMPUTE_SECRET,
        "Content-Type": "application/json",
    }, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        log(f"API POST {path} → {e}")
        return None


def log(msg: str):
    """Print timestamped log message."""
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    try:
        with open(LOG_DIR / "worker.log", "a") as f:
            f.write(line + "\n")
    except Exception:
        pass


# ── Job execution ──────────────────────────────────────────────
def run_job(job: dict):
    """Execute a single compute job in a subprocess."""
    job_id = job["job_id"]
    command = job.get("command", "").strip()
    input_file = job.get("input_filename", "")
    title = job.get("title", f"Job #{job_id}")
    estimated = job.get("estimated_minutes", 60)

    log(f"Starting job #{job_id}: {title}")
    log(f"  Command: {command}")
    log(f"  Input: {input_file or '(none)'}")
    log(f"  Estimated: {estimated} min")

    # Create job working directory
    job_dir = WORK_DIR / f"job_{job_id}"
    job_dir.mkdir(parents=True, exist_ok=True)

    # If there's an input file, copy it to the job directory
    if input_file:
        src = INPUT_DIR / input_file
        if src.exists():
            shutil.copy2(src, job_dir / input_file)
        # Replace {INPUT} in command
        command = command.replace("{INPUT}", str(job_dir / input_file))

    if not command:
        # No command — report failure
        api_post("/compute/api/complete-job", {
            "job_id": job_id,
            "exit_code": 1,
            "stdout": "",
            "stderr": "No command specified for this job.",
            "output_filename": "",
        })
        log(f"Job #{job_id} failed: no command")
        return

    # Run the command
    timeout = min(MAX_RUNTIME, estimated * 60 * 2)  # 2x estimated or MAX_RUNTIME
    stdout_path = job_dir / "stdout.log"
    stderr_path = job_dir / "stderr.log"

    try:
        with open(stdout_path, "w") as out_f, open(stderr_path, "w") as err_f:
            proc = subprocess.Popen(
                command,
                shell=True,
                cwd=str(job_dir),
                stdout=out_f,
                stderr=err_f,
                preexec_fn=os.setsid if sys.platform != "win32" else None,
            )
            active_jobs[job_id] = proc

            try:
                exit_code = proc.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                log(f"Job #{job_id} timed out after {timeout}s — killing")
                if sys.platform != "win32":
                    os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
                else:
                    proc.kill()
                proc.wait()
                exit_code = -9  # killed

    except Exception as e:
        log(f"Job #{job_id} execution error: {e}")
        exit_code = -1
        stderr_path.write_text(f"Worker execution error: {e}")
    finally:
        active_jobs.pop(job_id, None)

    # Read logs (capped at 50k chars)
    stdout_text = ""
    stderr_text = ""
    try:
        stdout_text = stdout_path.read_text()[:50000]
    except Exception:
        pass
    try:
        stderr_text = stderr_path.read_text()[:50000]
    except Exception:
        pass

    # Check for output files (anything new in job_dir that isn't input or logs)
    output_filename = ""
    skip_files = {input_file, "stdout.log", "stderr.log"} if input_file else {"stdout.log", "stderr.log"}
    for f in sorted(job_dir.iterdir()):
        if f.name not in skip_files and f.is_file():
            # Copy to output dir
            output_name = f"job_{job_id}_{f.name}"
            shutil.copy2(f, OUTPUT_DIR / output_name)
            output_filename = output_name
            break  # take first output file

    # Report back
    api_post("/compute/api/complete-job", {
        "job_id": job_id,
        "exit_code": exit_code,
        "stdout": stdout_text,
        "stderr": stderr_text,
        "output_filename": output_filename,
    })

    status = "completed" if exit_code == 0 else "failed"
    log(f"Job #{job_id} {status} (exit code {exit_code})")

    # Clean up job directory (keep outputs)
    try:
        shutil.rmtree(job_dir)
    except Exception:
        pass


# ── Main loop ──────────────────────────────────────────────────
def main():
    log("=" * 50)
    log(f"Catalyst Compute Worker starting")
    log(f"  Server:     {CATALYST_URL}")
    log(f"  Max jobs:   {MAX_CONCURRENT}")
    log(f"  Poll:       {POLL_INTERVAL}s")
    log(f"  Work dir:   {WORK_DIR}")
    log(f"  Max runtime: {MAX_RUNTIME}s")
    log("=" * 50)

    while True:
        try:
            # Only fetch if we have capacity
            if len(active_jobs) < MAX_CONCURRENT:
                job = api_get("/compute/api/next-job")
                if job:
                    # Run in a thread so we can handle multiple concurrent jobs
                    t = Thread(target=run_job, args=(job,), daemon=True)
                    t.start()
                    # Small delay before polling again
                    time.sleep(2)
                    continue

            time.sleep(POLL_INTERVAL)

        except KeyboardInterrupt:
            log("Shutting down… waiting for active jobs")
            # Kill active jobs
            for jid, proc in list(active_jobs.items()):
                log(f"Killing job #{jid}")
                try:
                    if sys.platform != "win32":
                        os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
                    else:
                        proc.terminate()
                except Exception:
                    pass
            break
        except Exception as e:
            log(f"Worker loop error: {e}")
            time.sleep(POLL_INTERVAL)

    log("Worker stopped.")


if __name__ == "__main__":
    main()
