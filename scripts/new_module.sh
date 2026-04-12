#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────
# PRISM Module Generator
# Generates skeleton templates, schema, routes, and CSS for a
# new ERP module from the _module_skeletons templates.
# ───────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SKELETON_DIR="$PROJECT_DIR/templates/_module_skeletons"

# ── Colours ──────────────────────────────────────────────────
BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
RESET='\033[0m'

echo -e "${BOLD}PRISM Module Generator${RESET}"
echo "────────────────────────────────────────"
echo ""

# ── Prompts ──────────────────────────────────────────────────
read -rp "Module name (lowercase, e.g. vehicles): " MODULE
read -rp "Entity name (singular, e.g. vehicle): " ENTITY
read -rp "Entity plural (e.g. vehicles): " ENTITY_PLURAL

# Derived names
MODULE_UPPER="$(echo "$MODULE" | tr '[:lower:]' '[:upper:]')"
ENTITY_TITLE="$(echo "$ENTITY" | sed 's/\b\(.\)/\u\1/g')"
ENTITY_PLURAL_TITLE="$(echo "$ENTITY_PLURAL" | sed 's/\b\(.\)/\u\1/g')"
# CamelCase plural for pane IDs
ENTITY_PLURAL_CAMEL="$(echo "$ENTITY_PLURAL" | sed 's/_\(.\)/\U\1/g; s/^\(.\)/\U\1/')"

echo ""
echo -e "${CYAN}Capabilities (enter comma-separated numbers):${RESET}"
echo "  1) CRUD routes"
echo "  2) Approval workflow"
echo "  3) Custom fields"
echo "  4) Inventory tracking"
echo "  5) Expense tracking"
echo "  6) Calendar integration"
echo "  7) Stats dashboard"
echo "  8) Team assignments"
read -rp "Selection [1-8, default: 1,2,3]: " CAP_INPUT
CAP_INPUT="${CAP_INPUT:-1,2,3}"

# Parse capabilities into an associative array
declare -A CAPS
for c in $(echo "$CAP_INPUT" | tr ',' ' '); do
    CAPS[$c]=1
done

echo ""
echo -e "${BOLD}Generating module: ${GREEN}$MODULE${RESET}"
echo "────────────────────────────────────────"

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

# ── 1. Generate templates ────────────────────────────────────
TMPL_DIR="$PROJECT_DIR/templates"

echo -e "  ${GREEN}+${RESET} templates/${MODULE}_list.html"
substitute "$SKELETON_DIR/list.html.template" > "$TMPL_DIR/${MODULE}_list.html"

echo -e "  ${GREEN}+${RESET} templates/${MODULE}_detail.html"
substitute "$SKELETON_DIR/detail.html.template" > "$TMPL_DIR/${MODULE}_detail.html"

echo -e "  ${GREEN}+${RESET} templates/${MODULE}_form_control.html"
substitute "$SKELETON_DIR/form_control.html.template" > "$TMPL_DIR/${MODULE}_form_control.html"

# ── 2. Generate schema ──────────────────────────────────────
MIGRATION_DIR="$PROJECT_DIR/migrations"
mkdir -p "$MIGRATION_DIR"
MIGRATION_FILE="$MIGRATION_DIR/${MODULE}_schema.sql"
echo -e "  ${GREEN}+${RESET} migrations/${MODULE}_schema.sql"
substitute "$SKELETON_DIR/schema.sql.template" > "$MIGRATION_FILE"

# Strip optional sections based on capabilities
if [[ -z "${CAPS[2]:-}" ]]; then
    # Remove approval table if not selected
    sed -i '' '/Approval configuration/,/^$/d' "$MIGRATION_FILE" 2>/dev/null || true
fi
if [[ -z "${CAPS[3]:-}" ]]; then
    # Remove custom fields table if not selected
    sed -i '' '/Custom fields/,/^$/d' "$MIGRATION_FILE" 2>/dev/null || true
fi

# ── 3. Generate route stubs ─────────────────────────────────
ROUTES_FILE="$PROJECT_DIR/generated_${MODULE}_routes.py"
echo -e "  ${GREEN}+${RESET} generated_${MODULE}_routes.py"
substitute "$SKELETON_DIR/routes.py.template" > "$ROUTES_FILE"

# ── 4. Add to PRISM_MODULES in .env.example ─────────────────
ENV_EXAMPLE="$PROJECT_DIR/.env.example"
if [[ -f "$ENV_EXAMPLE" ]]; then
    if grep -q "PRISM_MODULES" "$ENV_EXAMPLE"; then
        # Append module to existing list
        sed -i '' "s/PRISM_MODULES=\(.*\)/PRISM_MODULES=\1,$MODULE/" "$ENV_EXAMPLE"
        echo -e "  ${GREEN}~${RESET} .env.example  (added $MODULE to PRISM_MODULES)"
    else
        echo "PRISM_MODULES=$MODULE" >> "$ENV_EXAMPLE"
        echo -e "  ${GREEN}+${RESET} .env.example  (added PRISM_MODULES=$MODULE)"
    fi
else
    echo "PRISM_MODULES=$MODULE" > "$ENV_EXAMPLE"
    echo -e "  ${GREEN}+${RESET} .env.example  (created with PRISM_MODULES=$MODULE)"
fi

# ── 5. CSS grid family rule ─────────────────────────────────
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
    echo -e "  ${GREEN}~${RESET} static/style.css  (added .${MODULE}-tiles grid)"
fi

# ── Summary ──────────────────────────────────────────────────
echo ""
echo -e "${BOLD}Done!${RESET} Next steps:"
echo ""
echo -e "  1. Review and run: ${CYAN}migrations/${MODULE}_schema.sql${RESET}"
echo -e "  2. Paste routes from: ${CYAN}generated_${MODULE}_routes.py${RESET} into app.py"
echo -e "  3. Customise the templates in templates/${MODULE}_*.html"
echo -e "  4. Add nav link to base.html sidebar"
echo ""
echo -e "  Capabilities enabled:"
[[ -n "${CAPS[1]:-}" ]] && echo "    - CRUD routes"
[[ -n "${CAPS[2]:-}" ]] && echo "    - Approval workflow"
[[ -n "${CAPS[3]:-}" ]] && echo "    - Custom fields"
[[ -n "${CAPS[4]:-}" ]] && echo "    - Inventory tracking (add tables manually)"
[[ -n "${CAPS[5]:-}" ]] && echo "    - Expense tracking (add tables manually)"
[[ -n "${CAPS[6]:-}" ]] && echo "    - Calendar integration (add tables manually)"
[[ -n "${CAPS[7]:-}" ]] && echo "    - Stats dashboard"
[[ -n "${CAPS[8]:-}" ]] && echo "    - Team assignments (add tables manually)"
echo ""
