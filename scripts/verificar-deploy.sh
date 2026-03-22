#!/usr/bin/env bash
# Verificación completa: Git, Web (Vercel), API (Vercel), Neon (migraciones).
# Detecta desajustes si algo quedó a mitad de camino.
# Uso: ./scripts/verificar-deploy.sh [rama]
set -e
cd "$(dirname "$0")/.."

WEB_URL="${WEB_URL:-https://match-prop-web.vercel.app}"
API_URL="${API_URL:-https://match-prop-admin-dsvv.vercel.app}"
RAMA="${1:-main}"

echo "=== Verificación completa: Git · Web · API · Neon ==="
echo ""

git fetch origin 2>/dev/null || true

# --- Obtener commits de cada fuente ---
get_json() {
  curl -sS --connect-timeout 5 "$1" 2>/dev/null || true
}
get_field() {
  local json="$1" key="$2"
  if command -v jq &>/dev/null; then
    echo "$json" | jq -r ".$key // empty"
  else
    echo "$json" | grep -oE "\"$key\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -1 | cut -d'"' -f4
  fi
}

WEB_JSON=$(get_json "$WEB_URL/version")
API_JSON=$(get_json "$API_URL/version")

WEB_COMMIT=$(get_field "$WEB_JSON" "commit")
[ -z "$WEB_COMMIT" ] && WEB_COMMIT=$(get_field "$WEB_JSON" "version")

API_COMMIT=$(get_field "$API_JSON" "commit")
[ -z "$API_COMMIT" ] && API_COMMIT=$(get_field "$API_JSON" "version")

API_MIGRATION=$(get_field "$API_JSON" "migration")

# Fallback: /health de la API incluye version y migration
if [ -z "$API_COMMIT" ] || [ -z "$API_MIGRATION" ]; then
  HEALTH=$(get_json "$API_URL/health")
  [ -z "$API_COMMIT" ] && API_COMMIT=$(get_field "$HEALTH" "version")
  [ -z "$API_MIGRATION" ] && API_MIGRATION=$(get_field "$HEALTH" "migration")
fi

MAIN_COMMIT=$(git rev-parse origin/main 2>/dev/null || echo "")
BRANCH_COMMIT=$(git rev-parse "origin/$RAMA" 2>/dev/null || git rev-parse "HEAD" 2>/dev/null || echo "")

# --- Última migración en el repo ---
LAST_MIGRATION_REPO=$(
  ls -1 apps/api/prisma/migrations 2>/dev/null |
    grep -E '^[0-9]{14}_' |
    sort -r |
    head -1
)

# --- Tabla comparativa ---
echo "| Fuente      | Commit   | Migración (Neon)     | Nota"
echo "|-------------|----------|----------------------|------"
printf "| Web (Vercel)| %-8s | —                    | %s\n" \
  "${WEB_COMMIT:0:8}" "$(git log -1 --format='%s' "$WEB_COMMIT" 2>/dev/null || echo '?')"
printf "| API (Vercel)| %-8s | %-20s | %s\n" \
  "${API_COMMIT:0:8}" "${API_MIGRATION:-?}" "$(git log -1 --format='%s' "$API_COMMIT" 2>/dev/null || echo '?')"
printf "| main (git)  | %-8s | —                    | %s\n" \
  "${MAIN_COMMIT:0:8}" "$(git log -1 --format='%s' origin/main 2>/dev/null || echo '?')"
if [ "$RAMA" != "main" ]; then
  printf "| $RAMA | %-8s | —                    | %s\n" \
    "${BRANCH_COMMIT:0:8}" "$(git log -1 --format='%s' "$BRANCH_COMMIT" 2>/dev/null || echo '?')"
fi
echo ""
echo "| Repo (migraciones) | Última en código: $LAST_MIGRATION_REPO"
echo ""

# --- Detección de desajustes ---
DESAJUSTE=0

if [ -z "$WEB_COMMIT" ] || [ "$WEB_COMMIT" = "local" ]; then
  echo "⚠ Web: no se pudo obtener commit (¿/version deployado?)"
  DESAJUSTE=1
fi

if [ -z "$API_COMMIT" ] || [ "$API_COMMIT" = "local" ]; then
  echo "⚠ API: no se pudo obtener commit"
  DESAJUSTE=1
fi

if [ -n "$WEB_COMMIT" ] && [ -n "$API_COMMIT" ] && [ "$WEB_COMMIT" != "$API_COMMIT" ]; then
  echo "⚠ DESAJUSTE: Web ($WEB_COMMIT) y API ($API_COMMIT) tienen commits distintos."
  echo "  Puede ser que un deploy falló a mitad de camino."
  DESAJUSTE=1
fi

if [ -n "$API_MIGRATION" ] && [ "$API_MIGRATION" != "null" ] && [ -n "$LAST_MIGRATION_REPO" ]; then
  API_MIG_BASE=$(echo "$API_MIGRATION" | sed 's|/.*||')
  REPO_MIG_BASE=$(echo "$LAST_MIGRATION_REPO" | sed 's|/.*||')
  if [ "$API_MIG_BASE" != "$REPO_MIG_BASE" ]; then
    echo "⚠ DESAJUSTE Neon: en prod está '$API_MIGRATION', en repo la última es '$LAST_MIGRATION_REPO'."
    echo "  Ejecutar: DATABASE_URL=... bash scripts/prod-migrate.sh"
    DESAJUSTE=1
  fi
fi

# --- Commits en main no en prod ---
if [ -n "$WEB_COMMIT" ] && [ "$WEB_COMMIT" != "unknown" ] && git merge-base --is-ancestor "$WEB_COMMIT" origin/main 2>/dev/null; then
  AHEAD_MAIN=$(git rev-list --count "$WEB_COMMIT"..origin/main 2>/dev/null || echo 0)
  if [ "${AHEAD_MAIN:-0}" -gt 0 ]; then
    echo "⚠ Hay $AHEAD_MAIN commit(s) en main que aún no están en prod (Web)."
    echo "  Vercel puede tardar 2–3 min. Si pasó más, revisar Vercel Deployments."
    git log --oneline "$WEB_COMMIT"..origin/main 2>/dev/null | head -10
    DESAJUSTE=1
  fi
fi

# --- Rama vs main ---
if [ "$RAMA" != "main" ]; then
  AHEAD_BRANCH=$(git rev-list --count origin/main.."$BRANCH_COMMIT" 2>/dev/null || echo 0)
  if [ "${AHEAD_BRANCH:-0}" -gt 0 ]; then
    echo ""
    echo "📌 Tu rama tiene $AHEAD_BRANCH commit(s) sin mergear a main."
    echo "   Para deployar: push → PR → CI pasa → merge."
    git log --oneline origin/main.."$BRANCH_COMMIT" 2>/dev/null | head -10
  fi
fi

if [ $DESAJUSTE -eq 0 ] && [ -n "$WEB_COMMIT" ] && [ "$WEB_COMMIT" != "unknown" ]; then
  echo "✅ Web, API y main alineados."
fi

echo ""
echo "URLs: Web $WEB_URL/login | API $API_URL/health | Status $WEB_URL/status"
