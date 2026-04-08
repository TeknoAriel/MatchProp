#!/usr/bin/env bash
# Recupera Neon cuando quedó una migración fallida (P3009) o tabla ya existente (P3018) en SendGrid.
# Orden: marca 20260314000000_add_sendgrid_config como aplicada, luego migrate deploy.
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

STUCK_MIGRATION="20260314000000_add_sendgrid_config"

ENV_FILE="$ROOT/apps/api/.env"
if [[ -f "$ENV_FILE" ]]; then
  mv "$ENV_FILE" "${ENV_FILE}.bak.$$"
  restore_env() { mv "${ENV_FILE}.bak.$$" "$ENV_FILE" 2>/dev/null || true; }
  trap restore_env EXIT
  echo "→ apps/api/.env apartado temporalmente (como prod-migrate.sh)."
fi

echo "=== MatchProp recover Neon + migrate deploy ==="

echo "→ prisma migrate resolve --applied $STUCK_MIGRATION"
set +e
RESOLVE_OUT=$(pnpm --filter api exec prisma migrate resolve --applied "$STUCK_MIGRATION" 2>&1)
RESOLVE_RC=$?
set -e
echo "$RESOLVE_OUT"
if [ "$RESOLVE_RC" -ne 0 ]; then
  if echo "$RESOLVE_OUT" | grep -q 'P3008'; then
    echo "→ (P3008: esa migración ya estaba registrada como aplicada; seguimos.)"
  elif echo "$RESOLVE_OUT" | grep -q 'P3017'; then
    echo "ERROR: nombre de migración inválido. No debe pasar con este script."
    exit 1
  else
    exit "$RESOLVE_RC"
  fi
fi

echo ""
echo "→ prisma generate"
pnpm --filter api exec prisma generate

echo ""
echo "→ prisma migrate deploy"
pnpm --filter api exec prisma migrate deploy

echo ""
echo "=== OK — Verificá: curl -s https://match-prop-admin-dsvv.vercel.app/health | grep migration ==="
