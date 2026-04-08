#!/usr/bin/env bash
# Marca una migración como aplicada sin ejecutar SQL (cuando el objeto ya existe en DB).
# Uso:
#   DATABASE_URL='postgresql://...' bash scripts/prod-migrate-resolve-applied.sh 20260314000000_add_sendgrid_config
#
# Luego: DATABASE_URL='...' bash scripts/prod-migrate.sh
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -z "${DATABASE_URL:-}" ] || [ -z "${1:-}" ]; then
  echo "Uso: DATABASE_URL='postgresql://...' bash scripts/prod-migrate-resolve-applied.sh NOMBRE_CARPETA_MIGRACION"
  echo "Ejemplo:"
  echo "  DATABASE_URL='postgresql://...' bash scripts/prod-migrate-resolve-applied.sh 20260314000000_add_sendgrid_config"
  echo ""
  echo "El argumento es el nombre de la CARPETA en apps/api/prisma/migrations/ (fecha_nombre)."
  echo "No pegues el texto del error (ej. \"Error: P3009\"); eso provoca P3017."
  exit 1
fi

if ! [[ "$1" =~ ^[0-9]{14}_[a-zA-Z0-9_]+$ ]]; then
  echo "ERROR: \"$1\" no parece un nombre de migración válido."
  echo "Debe verse como: 20260314000000_add_sendgrid_config"
  exit 1
fi

case "${DATABASE_URL}" in
  http://* | https://*)
    echo "ERROR: DATABASE_URL debe ser postgresql:// (no la URL HTTPS de Vercel)."
    exit 1
    ;;
  postgresql://* | postgres://*) ;;
  *)
    echo "ERROR: DATABASE_URL debe empezar con postgresql:// o postgres://"
    exit 1
    ;;
esac

export DATABASE_URL

ENV_FILE="$ROOT/apps/api/.env"
if [[ -f "$ENV_FILE" ]]; then
  mv "$ENV_FILE" "${ENV_FILE}.bak.$$"
  restore_env() { mv "${ENV_FILE}.bak.$$" "$ENV_FILE" 2>/dev/null || true; }
  trap restore_env EXIT
  echo "→ apps/api/.env apartado temporalmente."
fi

echo "→ prisma migrate resolve --applied $1"
pnpm --filter api exec prisma migrate resolve --applied "$1"
echo "=== OK. Ahora ejecutá: DATABASE_URL='...' bash scripts/prod-migrate.sh ==="
