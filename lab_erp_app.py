"""Project-namespaced entry module for Lab ERP."""

from app import app, init_db, seed_data  # noqa: F401


__all__ = ["app", "init_db", "seed_data"]
