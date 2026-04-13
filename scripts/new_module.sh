#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────
# PRISM Module Scaffold — plug-and-play module generator
#
# Usage:  scripts/new_module.sh <module_name> [label] [icon] [description]
#
# Examples:
#   scripts/new_module.sh vehicles
#   scripts/new_module.sh vehicles "Vehicles" "🚗" "Fleet management"
#
# What it does (all automated, no prompts):
#   1. Adds the module to MODULE_REGISTRY in app.py
#   2. Adds the module to ALL_MODULES (automatic via registry)
#   3. Creates list + detail templates from skeletons
#   4. Appends route stubs to app.py
#   5. Adds CSS grid rule to style.css
#   6. Prints enable instructions
# ───────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SKELETON_DIR="$PROJECT_DIR/templates/_module_skeletons"
APP_PY="$PROJECT_DIR/app.py"

# ── Colours ──────────────────────────────────────────────────
BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
RED='\033[0;31m'
RESET='\033[0m'

# ── Args ─────────────────────────────────────────────────────
if [[ $# -lt 1 ]]; then
    echo -e "${RED}Usage: $0 <module_name> [label] [icon] [description]${RESET}"
    echo "  module_name  — lowercase, no spaces (e.g. vehicles)"
    echo "  label        — nav display name (default: Titlecase of module_name)"
    echo "  icon         — emoji (default: 📦)"
    echo "  description  — one-liner (default: '<Label> module')"
    exit 1
fi

MODULE="$1"
MODULE_UPPER="$(echo "$MODULE" | tr '[:lower:]' '[:upper:]')"
LABEL="${2:-$(echo "$MODULE" | sed 's/\b\(.\)/\u\1/g')}"
ICON="${3:-📦}"
DESCRIPTION="${4:-${LABEL} module}"

# Derive entity names (strip trailing 's' for singular)
ENTITY_PLURAL="$MODULE"
if [[ "$MODULE" == *s ]]; then
    ENTITY="${MODULE%s}"
else
    ENTITY="$MODULE"
fi
ENTITY_TITLE="$(echo "$ENTITY" | sed 's/\b\(.\)/\u\1/g')"
ENTITY_PLURAL_TITLE="$(echo "$ENTITY_PLURAL" | sed 's/\b\(.\)/\u\1/g')"
ENTITY_PLURAL_CAMEL="$(echo "$ENTITY_PLURAL" | sed 's/_\(.\)/\U\1/g; s/^\(.\)/\U\1/')"

# ── Validation ───────────────────────────────────────────────
if grep -q "\"$MODULE\":" "$APP_PY"; then
    echo -e "${RED}Module '$MODULE' already exists in MODULE_REGISTRY.${RESET}"
    exit 1
fi

echo -e "${BOLD}PRISM Module Scaffold${RESET}"
echo "────────────────────────────────────────"
echo -e "  Module:      ${GREEN}$MODULE${RESET}"
echo -e "  Label:       $LABEL"
echo -e "  Icon:        $ICON"
echo -e "  Description: $DESCRIPTION"
echo ""

# ── Helper: substitute placeholders ──────────────────────────
substitute() {
    sed \
        -e "s/__MODULE__/$MODULE/g" \
        -e "s/__MODULE_UPPER__/$MODULE_UPPER/g" \
        -e "s/__ENTITY__/$ENTITY/g" \
        -e "s/__ENTITY_PLURAL__/$ENTITY_PLURAL/g" \
        -e "s/__ENTITY_TITLE__/$ENTITY_TITLE/g" \
        -e "s/__ENTITY_PLURAL_TITLE__/$ENTITY_PLURAL_TITLE/g" \
        -e "s/__ENTITY_PLURAL_CAMEL__/$ENTITY_PLURAL_CAMEL/g" \
        "$1"
}

# ── 1. Add to MODULE_REGISTRY in app.py ─────────────────────
# Find the highest nav_order and add 1
MAX_ORDER=$(grep -o '"nav_order": [0-9]*' "$APP_PY" | grep -v ': 0$' | grep -v ': 99$' | awk -F': ' '{print $2}' | sort -n | tail -1)
NEXT_ORDER=$(( ${MAX_ORDER:-10} + 1 ))

# Insert before the closing brace of MODULE_REGISTRY (the line with just "}")
# We find "^}$" after MODULE_REGISTRY definition
REGISTRY_LINE=$(grep -n '^MODULE_REGISTRY = {' "$APP_PY" | head -1 | cut -d: -f1)
# Find the closing } by looking for the first "^}" after REGISTRY_LINE
CLOSE_LINE=$(tail -n +"$REGISTRY_LINE" "$APP_PY" | grep -n '^}$' | head -1 | cut -d: -f1)
CLOSE_LINE=$(( REGISTRY_LINE + CLOSE_LINE - 1 ))

# Escape icon for sed
ICON_ESC=$(printf '%s' "$ICON" | sed 's/[&/\]/\\&/g')

sed -i '' "${CLOSE_LINE}i\\
    \"${MODULE}\": {\\
        \"label\": \"${LABEL}\",\\
        \"icon\": \"${ICON_ESC}\",\\
        \"nav_order\": ${NEXT_ORDER},\\
        \"description\": \"${DESCRIPTION}\",\\
        \"nav_endpoint\": \"${MODULE}_list\",\\
        \"nav_active_endpoints\": {\"${MODULE}_list\", \"${MODULE}_detail\", \"${MODULE}_new\"},\\
    },
" "$APP_PY"

echo -e "  ${GREEN}+${RESET} MODULE_REGISTRY entry (nav_order=${NEXT_ORDER})"

# ── 2. Create templates ──────────────────────────────────────
TMPL_DIR="$PROJECT_DIR/templates"

if [[ -f "$SKELETON_DIR/list.html.template" ]]; then
    echo -e "  ${GREEN}+${RESET} templates/${MODULE}_list.html"
    substitute "$SKELETON_DIR/list.html.template" > "$TMPL_DIR/${MODULE}_list.html"
fi

if [[ -f "$SKELETON_DIR/detail.html.template" ]]; then
    echo -e "  ${GREEN}+${RESET} templates/${MODULE}_detail.html"
    substitute "$SKELETON_DIR/detail.html.template" > "$TMPL_DIR/${MODULE}_detail.html"
fi

# ── 3. Append route stubs to app.py ─────────────────────────
ROUTE_MARKER="# ─── END OF ROUTES"
if grep -q "$ROUTE_MARKER" "$APP_PY"; then
    INSERT_BEFORE=$(grep -n "$ROUTE_MARKER" "$APP_PY" | head -1 | cut -d: -f1)
else
    # Append before the last if __name__ block, or at end
    INSERT_BEFORE=$(grep -n 'if __name__' "$APP_PY" | tail -1 | cut -d: -f1)
fi

ROUTES_BLOCK="
# ── ${MODULE_UPPER} MODULE ROUTES ────────────────────────────────────
@app.route('/${MODULE}')
@login_required
def ${MODULE}_list():
    if not module_enabled('${MODULE}'):
        abort(404)
    items = query_all('SELECT * FROM ${MODULE} ORDER BY created_at DESC')
    return render_template('${MODULE}_list.html', title='${LABEL}', items=items)


@app.route('/${MODULE}/<int:${ENTITY}_id>')
@login_required
def ${MODULE}_detail(${ENTITY}_id):
    if not module_enabled('${MODULE}'):
        abort(404)
    item = query_one('SELECT * FROM ${MODULE} WHERE id = ?', (${ENTITY}_id,))
    if not item:
        abort(404)
    return render_template('${MODULE}_detail.html', title='${LABEL} Detail', item=item)

"

if [[ -n "${INSERT_BEFORE:-}" ]]; then
    # Use python to insert since the block has special chars
    python3 -c "
import sys
lines = open('$APP_PY').readlines()
insert_at = $INSERT_BEFORE - 1
block = '''$ROUTES_BLOCK'''
lines.insert(insert_at, block)
open('$APP_PY', 'w').writelines(lines)
"
else
    echo "$ROUTES_BLOCK" >> "$APP_PY"
fi

echo -e "  ${GREEN}+${RESET} Route stubs: /${MODULE}, /${MODULE}/<id>"

# ── 4. Schema migration ─────────────────────────────────────
MIGRATION_DIR="$PROJECT_DIR/migrations"
mkdir -p "$MIGRATION_DIR"
if [[ -f "$SKELETON_DIR/schema.sql.template" ]]; then
    substitute "$SKELETON_DIR/schema.sql.template" > "$MIGRATION_DIR/${MODULE}_schema.sql"
    echo -e "  ${GREEN}+${RESET} migrations/${MODULE}_schema.sql"
fi

# ── 5. CSS grid rule ────────────────────────────────────────
CSS_FILE="$PROJECT_DIR/static/style.css"
if [[ -f "$CSS_FILE" ]]; then
    CSS_RULE="
/* === ${MODULE_UPPER} MODULE GRID === */
.${MODULE}-tiles {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: var(--tile-gap, 1rem);
  padding: 1rem 0;
}
.${MODULE}-tiles > .tile { min-width: 0; }
.${MODULE}-table th, .${MODULE}-table td { padding: 0.5rem 0.75rem; }
"
    echo "$CSS_RULE" >> "$CSS_FILE"
    echo -e "  ${GREEN}+${RESET} static/style.css grid rule"
fi

# ── Summary ──────────────────────────────────────────────────
echo ""
echo -e "${BOLD}Done!${RESET} Module ${GREEN}${MODULE}${RESET} scaffolded."
echo ""
echo "  Next steps:"
echo -e "  1. Create the DB table:  ${CYAN}sqlite3 data/demo/lab_scheduler.db < migrations/${MODULE}_schema.sql${RESET}"
echo -e "  2. Enable the module:    ${CYAN}PRISM_MODULES=...,${MODULE}${RESET}  (or leave PRISM_MODULES unset for all)"
echo -e "  3. Customise templates:  ${CYAN}templates/${MODULE}_list.html${RESET}, ${CYAN}templates/${MODULE}_detail.html${RESET}"
echo -e "  4. Run smoke test:       ${CYAN}.venv/bin/python scripts/smoke_test.py${RESET}"
echo ""
