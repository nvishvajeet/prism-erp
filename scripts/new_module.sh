#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────
# CATALYST Module Scaffold — plug-and-play module generator
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

echo -e "${BOLD}CATALYST Module Scaffold${RESET}"
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

for SKEL in list detail form_control; do
    if [[ -f "$SKELETON_DIR/${SKEL}.html.template" ]]; then
        OUT="$TMPL_DIR/${MODULE}_${SKEL}.html"
        substitute "$SKELETON_DIR/${SKEL}.html.template" > "$OUT"
        echo -e "  ${GREEN}+${RESET} templates/${MODULE}_${SKEL}.html"
    fi
done

# Create a minimal new-item form template
cat > "$TMPL_DIR/${MODULE}_new.html" << NEWTPL
{% extends "base.html" %}
{% from "_page_macros.html" import card_heading with context %}
{% block hover_back %}<a href="{{ url_for('${MODULE}_list') }}" class="hover-back-btn" title="Back">&#8592;</a>{% endblock %}
{% block content %}
<header class="inst-header" data-vis="{{ V }}">
  <div class="inst-header-main" data-vis="{{ V }}">
    <a class="text-link back-link" href="{{ url_for('${MODULE}_list') }}" data-vis="{{ V }}">&#8592; ${LABEL}</a>
    <h2 class="inst-header-title" data-vis="{{ V }}">New ${ENTITY_TITLE}</h2>
  </div>
</header>
<section class="${MODULE}-tiles" data-vis="{{ V }}">
  <article class="card tile" style="grid-column: span 6;" data-vis="{{ V }}">
    {{ card_heading("", "Create ${ENTITY_TITLE}") }}
    <form method="post" class="form-grid" style="padding:0.75rem;" data-vis="{{ V }}">
      <input type="hidden" name="csrf_token" value="{{ csrf_token() }}">
      <label data-vis="{{ V }}">Name
        <input type="text" name="name" required data-vis="{{ V }}">
      </label>
      <button type="submit" class="btn btn-primary" data-vis="{{ V }}">Create</button>
    </form>
  </article>
</section>
{% endblock %}
NEWTPL
echo -e "  ${GREEN}+${RESET} templates/${MODULE}_new.html"

# ── 3. Append full routes from skeleton to app.py ────────────
ROUTE_MARKER="# ─── END OF ROUTES"
if grep -q "$ROUTE_MARKER" "$APP_PY"; then
    INSERT_BEFORE=$(grep -n "$ROUTE_MARKER" "$APP_PY" | head -1 | cut -d: -f1)
else
    INSERT_BEFORE=$(grep -n 'if __name__' "$APP_PY" | tail -1 | cut -d: -f1)
fi

# Generate routes from the full skeleton template
ROUTES_BLOCK=$(substitute "$SKELETON_DIR/routes.py.template")
# Wrap with module_enabled guard and audit logging
ROUTES_FINAL="
# ── ${MODULE_UPPER} MODULE ROUTES ────────────────────────────────────

@app.route('/${MODULE}')
@login_required
def ${MODULE}_list():
    \"\"\"List all ${ENTITY_PLURAL}.\"\"\"
    if not module_enabled('${MODULE}'):
        abort(404)
    user = current_user()
    items = query_all('SELECT * FROM ${MODULE} ORDER BY created_at DESC')
    stats = {
        'total': len(items),
        'active': sum(1 for i in items if i['status'] == 'active'),
        'completed': sum(1 for i in items if i['status'] == 'completed'),
    }
    return render_template('${MODULE}_list.html', items=items, stats=stats)


@app.route('/${MODULE}/<int:${ENTITY}_id>', methods=['GET', 'POST'])
@login_required
def ${MODULE}_detail(${ENTITY}_id):
    \"\"\"Detail page for a single ${ENTITY}.\"\"\"
    if not module_enabled('${MODULE}'):
        abort(404)
    user = current_user()
    item = query_one('SELECT * FROM ${MODULE} WHERE id = ?', (${ENTITY}_id,))
    if not item:
        abort(404)
    events = query_all(
        'SELECT e.*, u.name AS actor_name FROM ${MODULE}_events e LEFT JOIN users u ON u.id = e.user_id WHERE e.${ENTITY}_id = ? ORDER BY e.created_at DESC',
        (${ENTITY}_id,),
    )
    if request.method == 'POST':
        action = request.form.get('action', '')
        if action == 'update_status':
            new_status = request.form.get('status', '').strip()
            execute('UPDATE ${MODULE} SET status = ?, updated_at = ? WHERE id = ?', (new_status, now_iso(), ${ENTITY}_id))
            log_action(user['id'], '${MODULE}', ${ENTITY}_id, 'status_changed', {'status': new_status})
            flash('Status updated.', 'success')
        return redirect(url_for('${MODULE}_detail', ${ENTITY}_id=${ENTITY}_id))
    return render_template('${MODULE}_detail.html', item=item, events=events)


@app.route('/${MODULE}/<int:${ENTITY}_id>/form-control', methods=['GET', 'POST'])
@login_required
def ${MODULE}_form_control(${ENTITY}_id):
    \"\"\"Approval config + custom fields for a ${ENTITY}.\"\"\"
    if not module_enabled('${MODULE}'):
        abort(404)
    user = current_user()
    item = query_one('SELECT * FROM ${MODULE} WHERE id = ?', (${ENTITY}_id,))
    if not item:
        abort(404)
    approval_config = query_all(
        'SELECT ac.*, u.name AS approver_name FROM ${MODULE}_approval_config ac LEFT JOIN users u ON u.id = ac.approver_user_id WHERE ac.${ENTITY}_id = ? ORDER BY ac.step_order',
        (${ENTITY}_id,),
    )
    custom_fields = query_all(
        'SELECT * FROM ${MODULE}_custom_fields WHERE ${ENTITY}_id = ? ORDER BY sort_order',
        (${ENTITY}_id,),
    )
    return render_template(
        '${MODULE}_form_control.html',
        item=item, approval_config=approval_config, custom_fields=custom_fields,
    )


@app.route('/${MODULE}/new', methods=['GET', 'POST'])
@login_required
def ${MODULE}_new():
    \"\"\"Create a new ${ENTITY}.\"\"\"
    if not module_enabled('${MODULE}'):
        abort(404)
    user = current_user()
    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        if not name:
            flash('Name is required.', 'error')
            return redirect(url_for('${MODULE}_new'))
        new_id = execute(
            'INSERT INTO ${MODULE} (name, status, created_by_user_id, created_at, updated_at) VALUES (?, \\'draft\\', ?, ?, ?)',
            (name, user['id'], now_iso(), now_iso()),
        )
        log_action(user['id'], '${MODULE}', new_id, '${ENTITY}_created', {'name': name})
        flash('${ENTITY_TITLE} created.', 'success')
        return redirect(url_for('${MODULE}_detail', ${ENTITY}_id=new_id))
    return render_template('${MODULE}_new.html')

"

if [[ -n "${INSERT_BEFORE:-}" ]]; then
    python3 -c "
lines = open('$APP_PY').readlines()
insert_at = $INSERT_BEFORE - 1
block = '''$ROUTES_FINAL'''
lines.insert(insert_at, block)
open('$APP_PY', 'w').writelines(lines)
"
else
    echo "$ROUTES_FINAL" >> "$APP_PY"
fi

echo -e "  ${GREEN}+${RESET} Routes: /${MODULE}, /${MODULE}/<id>, /${MODULE}/<id>/form-control, /${MODULE}/new"

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
echo "  Generated files:"
echo -e "    ${CYAN}templates/${MODULE}_list.html${RESET}         — list page"
echo -e "    ${CYAN}templates/${MODULE}_detail.html${RESET}       — detail dashboard"
echo -e "    ${CYAN}templates/${MODULE}_form_control.html${RESET} — approval + custom fields"
echo -e "    ${CYAN}templates/${MODULE}_new.html${RESET}          — create form"
echo -e "    ${CYAN}migrations/${MODULE}_schema.sql${RESET}       — DB schema"
echo ""
echo "  Next steps:"
echo -e "  1. Create the DB table:  ${CYAN}sqlite3 data/operational/lab_scheduler.db < migrations/${MODULE}_schema.sql${RESET}"
echo -e "  2. Enable the module:    ${CYAN}CATALYST_MODULES=...,${MODULE}${RESET}  (or leave CATALYST_MODULES unset for all)"
echo -e "  3. Customise templates + routes to your domain"
echo -e "  4. Run smoke test:       ${CYAN}.venv/bin/python -m crawlers wave sanity${RESET}"
echo ""
