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
        strategies=("smoke", "visibility", "role_landing", "topbar_badges", "empty_states", "dev_panel_readability", "xhr_contracts", "contrast_audit", "agents_md_contract", "parallel_claims", "deploy_smoke"),
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
        strategies=("role_behavior", "visibility", "role_landing", "ui_uniformity", "future_fixes_placeholder"),
        stop_on_fail=False,
    ),
    "lifecycle": Wave(
        name="lifecycle",
        description="End-to-end UI journeys + dead-link sweep",
        strategies=("lifecycle", "approver_pools", "dead_link"),
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
    # ── Category waves (taxonomy, 2026-04-11) ───────────────────────
    # Six orthogonal buckets. Every registered strategy belongs to
    # exactly one category. See `crawlers/taxonomy.py` for the source
    # of truth — these wave entries are the runnable view of it.
    # Running the rhythm:
    #   * every ~20 min of dev work → `wave skeleton` or `wave testing`
    #     (whichever bucket the last change touched)
    #   * every ~1 hour → `wave rhythm` (the 5-min union of all six)
    #   * pre-push → `wave sanity` (unchanged, hard gate)
    "skeleton": Wave(
        name="skeleton",
        description="Skeleton — layout, template creed, CSS hygiene, a11y",
        strategies=(
            "architecture", "philosophy", "css_orphan", "css_variable_defined", "cleanup",
            "contrast_audit", "color_improvement",
        ),
        stop_on_fail=False,
    ),
    "testing": Wave(
        name="testing",
        description="Testing — regression smoke + dead-link sweep",
        strategies=("smoke", "dead_link", "deploy_smoke"),
        stop_on_fail=True,
    ),
    "roleplay": Wave(
        name="roleplay",
        description="Role-playing — 9 personas × signature actions + MCMC walk",
        strategies=("visibility", "role_landing", "topbar_badges", "role_behavior", "random_walk"),
        stop_on_fail=False,
    ),
    "feature": Wave(
        name="feature",
        description="Feature verification — end-to-end UI journeys",
        strategies=("lifecycle",),
        stop_on_fail=False,
    ),
    "backend": Wave(
        name="backend",
        description="Backend — SQL budgets, route timing, slow queries",
        strategies=("performance", "slow_queries"),
        stop_on_fail=False,
    ),
    "data": Wave(
        name="data",
        description="Data structure — integrity, pools, round-robin invariants",
        strategies=("approver_pools",),
        stop_on_fail=False,
    ),
    # "rhythm" is the 5-minute union every ~1 hour of dev work runs:
    # one representative from each category, sequenced shortest-first
    # so a failing smoke stops the wave in <5s.
    "rhythm": Wave(
        name="rhythm",
        description="20-min-dev / 5-min-crawl rhythm — one per category",
        strategies=(
            "smoke",            # testing
            "philosophy",       # skeleton
            "visibility",       # roleplay
            "approver_pools",   # data
            "slow_queries",     # backend
            "lifecycle",        # feature
        ),
        stop_on_fail=False,
    ),
    "negative": Wave(
        name="negative",
        description="Negative-path sweep — blocked actions, dead links, hidden-save failures",
        strategies=(
            "smoke",
            "visibility",
            "xhr_contracts",
            "role_behavior",
            "dead_link",
            "lifecycle",
        ),
        stop_on_fail=False,
    ),
    "deepdev": Wave(
        name="deepdev",
        description="Deep development sweep — broad confidence pass for long burns",
        strategies=(
            "smoke",
            "visibility",
            "role_landing",
            "topbar_badges",
            "empty_states",
            "xhr_contracts",
            "architecture",
            "philosophy",
            "css_orphan",
            "role_behavior",
            "ui_uniformity",
            "lifecycle",
            "approver_pools",
            "dead_link",
            "performance",
            "slow_queries",
            "random_walk",
            "contrast_audit",
            "color_improvement",
            "cleanup",
        ),
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
            "architecture", "philosophy", "css_orphan", "css_variable_defined",
            # behavioral
            "role_behavior",
            # lifecycle
            "lifecycle", "approver_pools", "dead_link",
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
