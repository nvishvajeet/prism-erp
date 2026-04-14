#!/usr/bin/env python3
"""Run bounded worker-node jobs on a remote MacBook or verifier node.

The worker reads a JSON job file, validates that each command is within a
small allowlist, executes the steps locally, and writes a structured result
JSON plus an optional markdown handoff.

Design goals:
- safe by default: no arbitrary shell strings
- supervisor-friendly: every job has an id, mode, and output files
- repo-native: outputs land in tmp/worker_results/ or tmp/agent_handoffs/
- central-model friendly: this worker does not require LLM API keys
"""

from __future__ import annotations

import argparse
import json
import os
import shlex
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Sequence


UTC = timezone.utc


def now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


@dataclass(frozen=True)
class PrefixRule:
    parts: Sequence[str]
    write_capable: bool = False


ALLOWED_PREFIXES: Sequence[PrefixRule] = (
    PrefixRule(("pwd",)),
    PrefixRule(("whoami",)),
    PrefixRule(("hostname",)),
    PrefixRule(("date",)),
    PrefixRule(("ls",)),
    PrefixRule(("find",)),
    PrefixRule(("rg",)),
    PrefixRule(("sed",)),
    PrefixRule(("cat",)),
    PrefixRule(("git", "status")),
    PrefixRule(("git", "branch")),
    PrefixRule(("git", "log")),
    PrefixRule(("git", "diff")),
    PrefixRule(("git", "show")),
    PrefixRule(("git", "rev-parse")),
    PrefixRule(("./venv/bin/python", "scripts/smoke_test.py")),
    PrefixRule(("./venv/bin/python", "-m", "crawlers")),
    PrefixRule((".venv/bin/python", "-m", "crawlers")),
    PrefixRule(("python3", "-m", "py_compile")),
)


class WorkerJobError(Exception):
    pass


def _resolve(path_str: str, base: Path) -> Path:
    path = Path(path_str)
    if path.is_absolute():
        return path
    return (base / path).resolve()


def _prefix_allowed(command: Sequence[str]) -> bool:
    for rule in ALLOWED_PREFIXES:
        if len(command) >= len(rule.parts) and tuple(command[: len(rule.parts)]) == tuple(rule.parts):
            return True
    return False


def _ensure_safe_command(step: Dict[str, Any]) -> List[str]:
    command = step.get("command")
    if not isinstance(command, list) or not command or not all(isinstance(part, str) and part for part in command):
        raise WorkerJobError("Each step.command must be a non-empty list of strings.")
    if not _prefix_allowed(command):
        raise WorkerJobError(f"Command prefix not allowed: {' '.join(command[:4])}")
    return command


def _job_output_paths(repo_path: Path, job: Dict[str, Any]) -> tuple[Path, Path]:
    job_id = str(job["job_id"])
    output_root = _resolve(job.get("output_dir", "tmp/worker_results"), repo_path)
    output_root.mkdir(parents=True, exist_ok=True)
    result_json = output_root / f"{job_id}.json"
    handoff_md = output_root / f"{job_id}.md"
    return result_json, handoff_md


def _step_timeout(step: Dict[str, Any]) -> int:
    raw = step.get("timeout_seconds", 300)
    if not isinstance(raw, int) or raw <= 0 or raw > 3600:
        raise WorkerJobError("step.timeout_seconds must be an integer between 1 and 3600.")
    return raw


def _step_cwd(repo_path: Path, step: Dict[str, Any]) -> Path:
    cwd = _resolve(step.get("cwd", "."), repo_path)
    if not str(cwd).startswith(str(repo_path)):
        raise WorkerJobError(f"Step cwd escapes repo: {cwd}")
    return cwd


def _job_mode(job: Dict[str, Any]) -> str:
    mode = str(job.get("mode", "read_only"))
    if mode not in {"read_only", "verify_only", "write_claimed"}:
        raise WorkerJobError("job.mode must be one of read_only, verify_only, write_claimed.")
    return mode


def _validate_job(job: Dict[str, Any], repo_path: Path) -> None:
    required = ("job_id", "task_id", "mode", "steps")
    for key in required:
        if key not in job:
            raise WorkerJobError(f"Missing required job field: {key}")
    if not isinstance(job["steps"], list) or not job["steps"]:
        raise WorkerJobError("job.steps must be a non-empty list.")
    _job_mode(job)
    for step in job["steps"]:
        if not isinstance(step, dict):
            raise WorkerJobError("Each step must be an object.")
        _ensure_safe_command(step)
        _step_timeout(step)
        _step_cwd(repo_path, step)


def _run_step(repo_path: Path, step: Dict[str, Any]) -> Dict[str, Any]:
    command = _ensure_safe_command(step)
    cwd = _step_cwd(repo_path, step)
    timeout = _step_timeout(step)
    env = os.environ.copy()
    env["PYTHONPYCACHEPREFIX"] = env.get("PYTHONPYCACHEPREFIX", "/tmp/catalyst-worker-pyc")
    started = time.time()
    proc = subprocess.run(
        command,
        cwd=str(cwd),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=timeout,
    )
    finished = time.time()
    return {
        "command": command,
        "cwd": str(cwd),
        "timeout_seconds": timeout,
        "exit_code": proc.returncode,
        "duration_seconds": round(finished - started, 2),
        "stdout": proc.stdout[-12000:],
        "stderr": proc.stderr[-12000:],
        "allow_failure": bool(step.get("allow_failure", False)),
        "summary": step.get("summary", ""),
    }


def _write_handoff(handoff_path: Path, job: Dict[str, Any], results: List[Dict[str, Any]], status: str) -> None:
    lines = [
        f"# Worker Job {job['job_id']}",
        "",
        f"- task id: `{job['task_id']}`",
        f"- mode: `{job['mode']}`",
        f"- status: `{status}`",
        f"- started: `{job.get('started_at', '')}`",
        f"- finished: `{now_iso()}`",
    ]
    if job.get("claimed_files"):
        lines.append(f"- claimed files: {', '.join(f'`{p}`' for p in job['claimed_files'])}")
    if job.get("notes"):
        lines.append(f"- notes: {job['notes']}")
    lines.extend(["", "## Steps"])
    for index, result in enumerate(results, start=1):
        cmd = " ".join(shlex.quote(part) for part in result["command"])
        lines.extend([
            f"{index}. `{cmd}`",
            f"   - exit: `{result['exit_code']}` in `{result['duration_seconds']}s`",
        ])
        if result.get("summary"):
            lines.append(f"   - intent: {result['summary']}")
    lines.extend(["", "## Suggested Next Move"])
    if status == "ok":
        lines.append("- Review the result JSON and either queue another read-only job or promote a claimed write task.")
    else:
        lines.append("- Inspect the first failing step, fix the local environment or job payload, then rerun the same job id with a new suffix.")
    handoff_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def run_job(job_file: Path) -> int:
    job = json.loads(job_file.read_text(encoding="utf-8"))
    repo_path = _resolve(job.get("repo_path", "."), job_file.parent).resolve()
    _validate_job(job, repo_path)
    job.setdefault("started_at", now_iso())

    results: List[Dict[str, Any]] = []
    overall_status = "ok"
    for step in job["steps"]:
        result = _run_step(repo_path, step)
        results.append(result)
        if result["exit_code"] != 0 and not result["allow_failure"]:
            overall_status = "failed"
            break

    result_json_path, handoff_md_path = _job_output_paths(repo_path, job)
    payload = {
        "job_id": job["job_id"],
        "task_id": job["task_id"],
        "mode": job["mode"],
        "status": overall_status,
        "repo_path": str(repo_path),
        "branch": job.get("branch", ""),
        "claimed_files": job.get("claimed_files", []),
        "started_at": job["started_at"],
        "finished_at": now_iso(),
        "results": results,
        "notes": job.get("notes", ""),
    }
    result_json_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    if job.get("write_handoff", True):
        _write_handoff(handoff_md_path, job, results, overall_status)
    print(str(result_json_path))
    return 0 if overall_status == "ok" else 2


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run a bounded Catalyst worker-node job.")
    parser.add_argument("--job-file", required=True, help="Path to a worker job JSON file.")
    args = parser.parse_args(argv)
    try:
        return run_job(Path(args.job_file).resolve())
    except subprocess.TimeoutExpired as exc:
        print(f"worker timeout: {exc}", file=sys.stderr)
        return 124
    except WorkerJobError as exc:
        print(f"worker job invalid: {exc}", file=sys.stderr)
        return 2
    except Exception as exc:
        print(f"worker crashed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
