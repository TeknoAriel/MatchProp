#!/usr/bin/env bash
# Solo diagnóstico: estado de migraciones en Neon (no modifica la base).
#
# Uso:
#   DATABASE_URL='postgresql://...?sslmode=require&channel_binding=require' bash scripts/neon-migrate-status.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL (usá comillas simples si la URL tiene &)."
  exit 1
fi

export DATABASE_URL

ENV_FILE="$ROOT/apps/api/.env"
if [[ -f "$ENV_FILE" ]]; then
  mv "$ENV_FILE" "${ENV_FILE}.bak.$$"
  restore_env() { mv "${ENV_FILE}.bak.$$" "$ENV_FILE" 2>/dev/null || true; }
  trap restore_env EXIT
  echo "→ apps/api/.env apartado temporalmente."
fi

pnpm --filter api exec prisma generate
pnpm --filter api exec prisma migrate status
