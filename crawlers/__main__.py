"""CLI entry point: `python -m crawlers ...`."""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from .harness import Harness
from .registry import all_strategies, get, load_all_strategies
from .waves import all_waves, get_wave


def _print_table(rows: list[tuple[str, ...]]) -> None:
    widths = [max(len(r[i]) for r in rows) for i in range(len(rows[0]))]
    for row in rows:
        print("  ".join(cell.ljust(widths[i]) for i, cell in enumerate(row)))


def cmd_list(_args: argparse.Namespace) -> int:
    load_all_strategies()
    strategies = all_strategies()
    if not strategies:
        print("No crawlers registered.")
        return 0
    rows: list[tuple[str, ...]] = [("NAME", "ASPECT", "DESCRIPTION")]
    for cls in strategies:
        rows.append((cls.name, cls.aspect, cls.description))
    _print_table(rows)
    return 0


def cmd_describe(args: argparse.Namespace) -> int:
    load_all_strategies()
    cls = get(args.name)
    print(f"name:        {cls.name}")
    print(f"aspect:      {cls.aspect}")
    print(f"description: {cls.description}")
    print(f"needs_seed:  {cls.needs_seed}")
    doc = (cls.__doc__ or "").strip()
    if doc:
        print()
        print(doc)
    return 0


def _reports_dir() -> Path:
    reports = Path(__file__).resolve().parent.parent / "reports"
    reports.mkdir(exist_ok=True)
    return reports


def _persist_wave_report(
    *,
    wave_name: str,
    description: str,
    stop_on_fail: bool,
    runs: list[dict[str, object]],
    overall_code: int,
) -> None:
    reports_dir = _reports_dir()
    json_path = reports_dir / f"wave_{wave_name}_log.json"
    txt_path = reports_dir / f"wave_{wave_name}_report.txt"
    payload = {
        "wave": wave_name,
        "description": description,
        "stop_on_fail": stop_on_fail,
        "overall_exit_code": overall_code,
        "runs": runs,
    }
    lines = [
        f"wave:        {wave_name}",
        f"description: {description}",
        f"stop_on_fail:{' yes' if stop_on_fail else ' no'}",
        f"overall:     {overall_code}",
        "",
        "strategies:",
    ]
    for run in runs:
        lines.append(
            "  - "
            f"{run['strategy']}: exit={run['exit_code']} "
            f"pass={run['passed']} fail={run['failed']} warn={run['warnings']} "
            f"elapsed={run['elapsed_s']:.2f}s"
        )
    txt_path.write_text("\n".join(lines) + "\n")
    json_path.write_text(json.dumps(payload, indent=2, default=str))


def _run_one(name: str, *, steps: int | None = None, seed: int | None = None) -> dict[str, object]:
    cls = get(name)
    strategy = cls()
    if steps is not None and hasattr(strategy, "steps"):
        strategy.steps = steps
    if seed is not None and hasattr(strategy, "seed"):
        strategy.seed = seed
    harness = Harness()
    print(f"▶ {name} — {strategy.description}")
    if steps is not None:
        print(f"  steps override: {steps}")
    if seed is not None:
        print(f"  seed override: {seed}")
    t0 = time.perf_counter()
    try:
        harness.bootstrap()
        if strategy.needs_seed:
            harness.seed_users_and_instruments()
        result = strategy.run(harness)
    finally:
        harness.teardown()
    elapsed = time.perf_counter() - t0

    # Persist. `harness_summary` (harness.log rollup) and `report`
    # (result.report_json) both had zero consumers — dropped in the
    # crawlers/optimize-metadata claim. `elapsed_ms` replaces them
    # as the one per-run number every downstream view actually wants
    # (dev_panel CRAWLERS tile, slow-strategy triage, wave budget
    # verification).
    harness.write_reports(
        strategy.name,
        payload={
            "strategy": strategy.name,
            "aspect": strategy.aspect,
            "elapsed_ms": round(elapsed * 1000),
            "result": {
                "passed": result.passed,
                "failed": result.failed,
                "warnings": result.warnings,
                "metrics": result.metrics,
                "details": result.details,
            },
        },
        summary=result.human_summary() + f"\nelapsed:  {elapsed:.2f}s\n",
    )
    print(
        f"  → PASS {result.passed}  FAIL {result.failed}  "
        f"WARN {result.warnings}  ({elapsed:.2f}s)"
    )
    return {
        "strategy": strategy.name,
        "aspect": strategy.aspect,
        "exit_code": result.exit_code,
        "passed": result.passed,
        "failed": result.failed,
        "warnings": result.warnings,
        "elapsed_s": round(elapsed, 2),
        "steps_override": steps,
        "seed_override": seed,
    }


def cmd_run(args: argparse.Namespace) -> int:
    load_all_strategies()
    if args.name == "all":
        names = [cls.name for cls in all_strategies()]
    else:
        names = [args.name]
    worst = 0
    for name in names:
        run = _run_one(name, steps=args.steps, seed=args.seed)
        code = int(run["exit_code"])
        worst = max(worst, code)
    print()
    print(f"overall exit code: {worst}")
    return worst


def cmd_list_waves(_args: argparse.Namespace) -> int:
    rows: list[tuple[str, ...]] = [("WAVE", "STOP_ON_FAIL", "STRATEGIES", "DESCRIPTION")]
    for wave in all_waves():
        rows.append((
            wave.name,
            "yes" if wave.stop_on_fail else "no",
            ",".join(wave.strategies),
            wave.description,
        ))
    _print_table(rows)
    return 0


def cmd_wave(args: argparse.Namespace) -> int:
    load_all_strategies()
    wave = get_wave(args.name)
    print(f"▶ wave {wave.name!r} — {wave.description}")
    print(f"  strategies: {', '.join(wave.strategies)}")
    print(f"  stop_on_fail: {wave.stop_on_fail}")
    if args.steps is not None:
        print(f"  steps override: {args.steps}")
    if args.seed is not None:
        print(f"  seed override: {args.seed}")
    print()
    worst = 0
    runs: list[dict[str, object]] = []
    for strategy_name in wave.strategies:
        run = _run_one(strategy_name, steps=args.steps, seed=args.seed)
        runs.append(run)
        code = int(run["exit_code"])
        worst = max(worst, code)
        if wave.stop_on_fail and code != 0:
            print(f"  ✗ stop_on_fail — halting wave at {strategy_name!r}")
            break
    _persist_wave_report(
        wave_name=wave.name,
        description=wave.description,
        stop_on_fail=wave.stop_on_fail,
        runs=runs,
        overall_code=worst,
    )
    print()
    print(f"wave {wave.name!r} overall exit code: {worst}")
    return worst


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m crawlers",
        description="CATALYST crawler suite — pluggable site testing strategies.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_list = sub.add_parser("list", help="List every registered crawler strategy")
    p_list.set_defaults(func=cmd_list)

    p_describe = sub.add_parser("describe", help="Show detail for one crawler")
    p_describe.add_argument("name")
    p_describe.set_defaults(func=cmd_describe)

    p_run = sub.add_parser("run", help="Run one crawler or `all`")
    p_run.add_argument("name")
    p_run.add_argument(
        "--steps",
        type=int,
        default=None,
        help="Override step count for strategies that expose a `steps` attribute (for example `random_walk`).",
    )
    p_run.add_argument(
        "--seed",
        type=int,
        default=None,
        help="Override random seed for strategies that expose a `seed` attribute.",
    )
    p_run.set_defaults(func=cmd_run)

    p_list_waves = sub.add_parser(
        "list-waves",
        help="List every registered wave pipeline",
    )
    p_list_waves.set_defaults(func=cmd_list_waves)

    p_wave = sub.add_parser(
        "wave",
        help="Run every crawler in a named wave (sanity/static/behavioral/...)",
    )
    p_wave.add_argument("name")
    p_wave.add_argument(
        "--steps",
        type=int,
        default=None,
        help="Override step count for wave strategies that expose a `steps` attribute (for example `random_walk`).",
    )
    p_wave.add_argument(
        "--seed",
        type=int,
        default=None,
        help="Override random seed for wave strategies that expose a `seed` attribute.",
    )
    p_wave.set_defaults(func=cmd_wave)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
