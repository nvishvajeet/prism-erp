"""Crawler taxonomy — one category per strategy.

Six orthogonal buckets. Every registered strategy belongs to exactly
one category. The runnable view of this mapping lives in `waves.py`
as the `skeleton`/`testing`/`roleplay`/`feature`/`backend`/`data`
waves, plus the `rhythm` meta-wave that picks one representative
from each category for the 5-minute loop.

Adding a new strategy:
  1. Implement and register it per `strategies/__init__.py`.
  2. Add its name to exactly one category below.
  3. If it's the new "fastest representative" of its category,
     swap it into the `rhythm` wave in `waves.py`.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Category:
    key: str
    label: str
    purpose: str
    strategies: tuple[str, ...]


CATEGORIES: dict[str, Category] = {
    "skeleton": Category(
        key="skeleton",
        label="Skeleton",
        purpose=(
            "Layout + template creed + CSS hygiene + accessibility. "
            "Everything the user sees as 'the shape of the app'."
        ),
        strategies=(
            "architecture",
            "philosophy",
            "css_orphan",
            "cleanup",
            "contrast_audit",
            "color_improvement",
        ),
    ),
    "testing": Category(
        key="testing",
        label="Testing",
        purpose=(
            "Regression safety net. Smoke + dead-link sweep. "
            "Fast, boring, runs on every commit."
        ),
        strategies=("smoke", "dead_link", "deploy_smoke"),
    ),
    "roleplay": Category(
        key="roleplay",
        label="Role-playing",
        purpose=(
            "Nine canonical personas exercising the app. RBAC "
            "visibility, signature actions, MCMC coverage walk."
        ),
        strategies=(
            "visibility",
            "role_landing",
            "role_behavior",
            "random_walk",
        ),
    ),
    "feature": Category(
        key="feature",
        label="Feature verification",
        purpose=(
            "End-to-end UI journeys. Proves a multi-step feature "
            "still works as a single happy path."
        ),
        strategies=("lifecycle",),
    ),
    "backend": Category(
        key="backend",
        label="Backend",
        purpose=(
            "Performance + SQL health. Route timings, per-query "
            "budgets, N+1 detection."
        ),
        strategies=("performance", "slow_queries"),
    ),
    "data": Category(
        key="data",
        label="Data structure",
        purpose=(
            "Integrity + invariants across rows. Approver pool "
            "round-robin, FK sanity, migration shape checks."
        ),
        strategies=("approver_pools",),
    ),
}


def category_for(strategy: str) -> str | None:
    """Return the category key a strategy belongs to, or None."""
    for cat in CATEGORIES.values():
        if strategy in cat.strategies:
            return cat.key
    return None


def all_strategies_by_category() -> dict[str, tuple[str, ...]]:
    return {k: c.strategies for k, c in CATEGORIES.items()}
