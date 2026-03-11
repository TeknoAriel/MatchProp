#!/usr/bin/env bash
# Migraciones de producción (Neon / Postgres gestionado)
# Uso:
#   DATABASE_URL="..." bash scripts/prod-migrate.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL no está seteada."
  echo "Ejemplo:"
  echo "  DATABASE_URL=\"postgresql://...\" bash scripts/prod-migrate.sh"
  exit 1
fi

echo "=== MatchProp prod-migrate ==="
pnpm --filter api exec prisma generate
pnpm --filter api exec prisma migrate deploy
echo "=== OK ==="

