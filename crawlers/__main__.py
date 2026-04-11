"""CLI entry point: `python -m crawlers ...`."""
from __future__ import annotations

import argparse
import sys
import time

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


def _run_one(name: str) -> int:
    cls = get(name)
    strategy = cls()
    harness = Harness()
    print(f"▶ {name} — {strategy.description}")
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
    return result.exit_code


def cmd_run(args: argparse.Namespace) -> int:
    load_all_strategies()
    if args.name == "all":
        names = [cls.name for cls in all_strategies()]
    else:
        names = [args.name]
    worst = 0
    for name in names:
        code = _run_one(name)
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
    print()
    worst = 0
    for strategy_name in wave.strategies:
        code = _run_one(strategy_name)
        worst = max(worst, code)
        if wave.stop_on_fail and code != 0:
            print(f"  ✗ stop_on_fail — halting wave at {strategy_name!r}")
            break
    print()
    print(f"wave {wave.name!r} overall exit code: {worst}")
    return worst


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m crawlers",
        description="PRISM crawler suite — pluggable site testing strategies.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_list = sub.add_parser("list", help="List every registered crawler strategy")
    p_list.set_defaults(func=cmd_list)

    p_describe = sub.add_parser("describe", help="Show detail for one crawler")
    p_describe.add_argument("name")
    p_describe.set_defaults(func=cmd_describe)

    p_run = sub.add_parser("run", help="Run one crawler or `all`")
    p_run.add_argument("name")
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
    p_wave.set_defaults(func=cmd_wave)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
