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
from . import dev_panel_readability    # noqa: F401
from . import xhr_contracts            # noqa: F401
from . import agents_md_contract       # noqa: F401
from . import parallel_claims          # noqa: F401
from . import ui_uniformity            # noqa: F401
from . import future_fixes_placeholder  # noqa: F401
from . import ai_action_promotion      # noqa: F401
from . import css_variable_defined     # noqa: F401
from . import csrf_token_present       # noqa: F401
from . import aria_label_present       # noqa: F401
from . import url_for_endpoint_exists  # noqa: F401
from . import duplicate_id_in_template  # noqa: F401
from . import hardcoded_url_in_template  # noqa: F401
from . import label_for_matches_id       # noqa: F401
from . import external_link_noopener     # noqa: F401
from . import no_inline_onclick          # noqa: F401
from . import inline_style_attribute     # noqa: F401
