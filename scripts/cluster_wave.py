#!/usr/bin/env python3
"""Run bounded Catalyst verification waves across local + remote Macs.

This is an orchestration helper, not a git/deploy tool.
It runs read-only verification commands on:
- the current MacBook (always)
- the Mac mini (default host configured)
- an optional iMac (when a host is configured)

Examples:
  ./venv/bin/python scripts/cluster_wave.py status
  ./venv/bin/python scripts/cluster_wave.py sanity
  ./venv/bin/python scripts/cluster_wave.py cluster
"""

from __future__ import annotations

import argparse
import os
import shlex
import socket
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


@dataclass(frozen=True)
class Machine:
    name: str
    host: str | None
    repo: str
    python_bin: str
    enabled: bool = True

    @property
    def is_local(self) -> bool:
        return self.host is None


@dataclass(frozen=True)
class Step:
    machine: Machine
    label: str
    command: list[str]


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def machine_pool() -> list[Machine]:
    return [
        Machine(
            name="macbook",
            host=None,
            repo=str(ROOT),
            python_bin="./venv/bin/python",
            enabled=True,
        ),
        Machine(
            name="mini",
            host=_env("CATALYST_MINI_HOST", "vishwajeet@100.115.176.118"),
            repo=_env("CATALYST_MINI_REPO", "~/Scheduler/Main"),
            python_bin=_env("CATALYST_MINI_PYTHON", ".venv/bin/python"),
            enabled=True,
        ),
        Machine(
            name="imac",
            host=_env("CATALYST_IMAC_HOST"),
            repo=_env("CATALYST_IMAC_REPO", "~/Scheduler/Main"),
            python_bin=_env("CATALYST_IMAC_PYTHON", ".venv/bin/python"),
            enabled=bool(_env("CATALYST_IMAC_HOST")),
        ),
    ]


def shell_path(path: str) -> str:
    """Quote paths for remote shells without breaking leading ~/ expansion."""
    if path.startswith("~/"):
        return "~/" + shlex.quote(path[2:])
    return shlex.quote(path)


def status_steps(machines: list[Machine]) -> list[Step]:
    cmd = ["/bin/zsh", "-lc", "hostname && pwd && git branch --show-current && python3 -V"]
    steps: list[Step] = []
    for machine in machines:
        if not machine.enabled:
            continue
        if machine.is_local:
            steps.append(Step(machine, "status", ["/bin/zsh", "-lc", f"cd {shlex.quote(machine.repo)} && hostname && pwd && git branch --show-current && python3 -V"]))
        else:
            remote = f"cd {shell_path(machine.repo)} && hostname && pwd && git branch --show-current && python3 -V"
            steps.append(Step(machine, "status", ["ssh", machine.host or "", remote]))
    return steps


def sanity_steps(machines: list[Machine]) -> list[Step]:
    steps: list[Step] = []
    for machine in machines:
        if not machine.enabled:
            continue
        if machine.name == "macbook":
            steps.append(Step(machine, "smoke", ["/bin/zsh", "-lc", f"cd {shlex.quote(machine.repo)} && ./venv/bin/python scripts/smoke_test.py"]))
            steps.append(Step(machine, "local-smoke-crawler", ["/bin/zsh", "-lc", f"cd {shlex.quote(machine.repo)} && ./venv/bin/python -m crawlers run smoke"]))
        else:
            remote = f"cd {shell_path(machine.repo)} && {shlex.quote(machine.python_bin)} -m crawlers wave sanity"
            steps.append(Step(machine, "remote-sanity", ["ssh", machine.host or "", remote]))
    return steps


def cluster_steps(machines: list[Machine]) -> list[Step]:
    steps = sanity_steps(machines)
    for machine in machines:
        if not machine.enabled:
            continue
        if machine.name == "mini":
            remote = f"cd {shell_path(machine.repo)} && {shlex.quote(machine.python_bin)} -m crawlers run random_walk --steps 5000 --seed 20260415"
            steps.append(Step(machine, "random-walk", ["ssh", machine.host or "", remote]))
        elif machine.name == "imac":
            remote = f"cd {shell_path(machine.repo)} && {shlex.quote(machine.python_bin)} -m crawlers run dead_link"
            steps.append(Step(machine, "dead-link", ["ssh", machine.host or "", remote]))
    return steps


def heavy_steps(machines: list[Machine]) -> list[Step]:
    steps: list[Step] = []
    for machine in machines:
        if not machine.enabled or machine.is_local:
            continue
        remote = f"cd {shell_path(machine.repo)} && {shlex.quote(machine.python_bin)} -m crawlers wave all"
        steps.append(Step(machine, "wave-all", ["ssh", machine.host or "", remote]))
    return steps


def _run_step(step: Step, timeout: int) -> tuple[Step, int, float, str]:
    started = time.time()
    proc = subprocess.run(
        step.command,
        cwd=str(ROOT),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        timeout=timeout,
    )
    duration = round(time.time() - started, 2)
    return step, proc.returncode, duration, proc.stdout[-12000:]


def _print_header(mode: str, machines: list[Machine]) -> None:
    local_host = socket.gethostname()
    print(f"cluster-wave mode={mode} coordinator={local_host}")
    print("machines:")
    for machine in machines:
        target = "local" if machine.is_local else machine.host
        state = "enabled" if machine.enabled else "disabled"
        print(f"  - {machine.name}: {target} [{state}]")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run a bounded Catalyst machine wave.")
    parser.add_argument("mode", choices=("status", "sanity", "cluster", "heavy"))
    parser.add_argument("--timeout", type=int, default=1800, help="Per-step timeout in seconds.")
    parser.add_argument("--max-parallel", type=int, default=3, help="Max simultaneous machine steps.")
    args = parser.parse_args(argv)

    machines = machine_pool()
    _print_header(args.mode, machines)

    builders = {
        "status": status_steps,
        "sanity": sanity_steps,
        "cluster": cluster_steps,
        "heavy": heavy_steps,
    }
    steps = builders[args.mode](machines)
    if not steps:
        print("No runnable steps for this mode.")
        return 0

    failures = 0
    with ThreadPoolExecutor(max_workers=max(1, args.max_parallel)) as pool:
        futures = {pool.submit(_run_step, step, args.timeout): step for step in steps}
        for future in as_completed(futures):
            step, code, duration, output = future.result()
            print(f"\n== {step.machine.name}:{step.label} exit={code} duration={duration}s ==")
            if output.strip():
                print(output.rstrip())
            if code != 0:
                failures += 1

    print(f"\ncluster-wave complete: {len(steps) - failures} ok, {failures} failed")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
