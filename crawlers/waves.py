"""Crawler waves — ordered pipelines that match dev-improvement phases.

Instead of running every crawler in registration order (`run all`),
a wave groups crawlers by the *development phase* they support, so
you can move through improvement work in deliberate passes.

Wave design:

  sanity        — always green before a push. Fast. <30s total.
  static        — static analysis, no DB. Architecture drift detectors.
  behavioral    — RBAC + signature actions per role. Catches "can load
                  but cannot act" regressions.
  lifecycle     — end-to-end UI journeys. Heavier.
  coverage      — exploratory walks + dead-link sweep. Longest.
  accessibility — contrast + color-improvement + a11y heuristics.
  cleanup       — find dead code/templates/selectors. Suggestive only.
  all           — every wave in order (pre-release gate).

Each entry in a wave is a strategy name. A wave also declares:
  - `stop_on_fail`: break the wave at the first failing strategy
  - `description`: one-liner for `list-waves`
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Wave:
    name: str
    description: str
    strategies: tuple[str, ...]
    stop_on_fail: bool = False


WAVES: dict[str, Wave] = {
    "sanity": Wave(
        name="sanity",
        description="Pre-push gate — must be green before every push",
        strategies=("smoke", "visibility", "role_landing", "contrast_audit"),
        stop_on_fail=True,
    ),
    "static": Wave(
        name="static",
        description="No-DB structural analysis — architecture + philosophy",
        strategies=("architecture", "philosophy", "css_orphan"),
        stop_on_fail=False,
    ),
    "behavioral": Wave(
        name="behavioral",
        description="Behavioral RBAC — each role performs its signature action",
        strategies=("role_behavior", "visibility", "role_landing"),
        stop_on_fail=False,
    ),
    "lifecycle": Wave(
        name="lifecycle",
        description="End-to-end UI journeys + dead-link sweep",
        strategies=("lifecycle", "dead_link"),
        stop_on_fail=False,
    ),
    "coverage": Wave(
        name="coverage",
        description="Random-walk coverage + performance sampling",
        strategies=("random_walk", "performance", "slow_queries"),
        stop_on_fail=False,
    ),
    "accessibility": Wave(
        name="accessibility",
        description="WCAG contrast + palette-drift detection",
        strategies=("contrast_audit", "color_improvement"),
        stop_on_fail=False,
    ),
    "cleanup": Wave(
        name="cleanup",
        description="Suggest dead code / templates / CSS for retirement",
        strategies=("cleanup", "css_orphan", "philosophy"),
        stop_on_fail=False,
    ),
    # Meta-wave: run every wave in order. Matches a full pre-release pass.
    "all": Wave(
        name="all",
        description="Every wave in order — full release gate (slow)",
        strategies=(
            # sanity
            "smoke", "visibility", "role_landing", "contrast_audit",
            # static
            "architecture", "philosophy", "css_orphan",
            # behavioral
            "role_behavior",
            # lifecycle
            "lifecycle", "dead_link",
            # coverage
            "performance", "random_walk",
            # accessibility
            "color_improvement",
            # cleanup
            "cleanup",
        ),
        stop_on_fail=False,
    ),
}


def get_wave(name: str) -> Wave:
    if name not in WAVES:
        raise KeyError(
            f"Unknown wave: {name!r}. Registered: {sorted(WAVES)}"
        )
    return WAVES[name]


def all_waves() -> list[Wave]:
    return [WAVES[k] for k in WAVES]
