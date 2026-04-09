#!/usr/bin/env bash
# Recupera Neon con drift típico MatchProp (objetos creados fuera de _prisma_migrations o P3009).
# Marca como aplicadas las migraciones que suelen chocar, tolera P3008 (ya aplicada), luego migrate deploy.
#
# Uso (misma DATABASE_URL que Vercel API → Production):
#   DATABASE_URL='postgresql://...' bash scripts/prod-migrate-recover-neon.sh
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: definí DATABASE_URL (postgresql://... desde Neon, botón Copy snippet)."
  exit 1
fi

case "${DATABASE_URL}" in
  http://* | https://*)
    echo "ERROR: DATABASE_URL no debe ser la URL https de Vercel."
    exit 1
    ;;
  postgresql://* | postgres://*) ;;
  *)
    echo "ERROR: DATABASE_URL debe empezar con postgresql:// o postgres://"
    exit 1
    ;;
esac

export DATABASE_URL

# Orden histórico de choques en prod (enum/tabla/columna ya existentes).
DRIFT_MIGRATIONS=(
  20260314000000_add_sendgrid_config
  20260314214521_add_ingest_source_config
  20260314230028_add_assistant_config
  20260315002906_add_assistant_auth_fields
)

ENV_FILE="$ROOT/apps/api/.env"
if [[ -f "$ENV_FILE" ]]; then
  mv "$ENV_FILE" "${ENV_FILE}.bak.$$"
  restore_env() { mv "${ENV_FILE}.bak.$$" "$ENV_FILE" 2>/dev/null || true; }
  trap restore_env EXIT
  echo "→ apps/api/.env apartado temporalmente (como prod-migrate.sh)."
fi

echo "=== MatchProp recover Neon + migrate deploy ==="

resolve_applied_tolerate() {
  local name="$1"
  echo "→ prisma migrate resolve --applied $name"
  set +e
  local out
  out=$(pnpm --filter api exec prisma migrate resolve --applied "$name" 2>&1)
  local rc=$?
  set -e
  echo "$out"
  if [ "$rc" -ne 0 ]; then
    if echo "$out" | grep -q 'P3008'; then
      echo "→ (P3008: ya aplicada; seguimos.)"
    elif echo "$out" | grep -q 'P3017'; then
      echo "ERROR: migración no encontrada en repo."
      exit 1
    else
      exit "$rc"
    fi
  fi
}

for m in "${DRIFT_MIGRATIONS[@]}"; do
  resolve_applied_tolerate "$m"
done

echo ""
echo "→ prisma generate"
pnpm --filter api exec prisma generate

echo ""
echo "→ prisma migrate deploy"
pnpm --filter api exec prisma migrate deploy

echo ""
echo "=== OK — Verificá: curl -s https://match-prop-admin-dsvv.vercel.app/health | grep migration ==="
