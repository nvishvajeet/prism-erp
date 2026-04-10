"""Central registry of crawler strategies.

Strategies register themselves at import time by calling
`crawlers.register(cls)`. The CLI imports `crawlers.strategies` once,
which triggers every strategy module to run its registration block.
"""
from __future__ import annotations

from typing import Type

from .base import CrawlerStrategy


_REGISTRY: dict[str, Type[CrawlerStrategy]] = {}


def register(cls: Type[CrawlerStrategy]) -> Type[CrawlerStrategy]:
    """Decorator / direct-call registration."""
    if not getattr(cls, "name", None):
        raise ValueError(f"Crawler class {cls!r} must define `name`")
    if cls.name in _REGISTRY:
        raise ValueError(f"Crawler name collision: {cls.name}")
    _REGISTRY[cls.name] = cls
    return cls


def get(name: str) -> Type[CrawlerStrategy]:
    if name not in _REGISTRY:
        raise KeyError(
            f"Unknown crawler: {name!r}. "
            f"Registered: {sorted(_REGISTRY)}"
        )
    return _REGISTRY[name]


def all_strategies() -> list[Type[CrawlerStrategy]]:
    return sorted(_REGISTRY.values(), key=lambda c: c.name)


def load_all_strategies() -> None:
    """Import the strategies package so every module self-registers."""
    from . import strategies  # noqa: F401 — triggers __init__.py
