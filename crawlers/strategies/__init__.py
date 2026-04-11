"""Importing this package triggers every strategy's self-registration.

Add a new strategy by:
  1. Dropping `my_strategy.py` next to these siblings
  2. Defining a class `MyStrategy(CrawlerStrategy)` inside it
  3. Calling `MyStrategy.register()` at module bottom
  4. Importing it here so `load_all_strategies()` picks it up
"""
from . import smoke                    # noqa: F401
from . import visibility               # noqa: F401
from . import dead_link                # noqa: F401
from . import performance              # noqa: F401
from . import contrast_audit           # noqa: F401
from . import css_orphan               # noqa: F401
from . import lifecycle                # noqa: F401
from . import approver_pools           # noqa: F401
from . import random_walk              # noqa: F401
from . import architecture             # noqa: F401
from . import philosophy_propagation   # noqa: F401
from . import role_behavior            # noqa: F401
from . import role_landing             # noqa: F401
from . import slow_queries             # noqa: F401
from . import color_improvement        # noqa: F401
from . import cleanup                  # noqa: F401
from . import deploy_smoke             # noqa: F401
from . import topbar_badges            # noqa: F401
from . import empty_states             # noqa: F401
