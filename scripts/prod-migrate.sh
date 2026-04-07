#!/usr/bin/env bash
# Migraciones de producción (Neon / Postgres gestionado)
#
# IMPORTANTE — zsh/bash:
#   Los caracteres & y ? en la URL rompen el comando si NO van entre comillas.
#   Usá comillas SIMPLES alrededor de toda la URL:
#     DATABASE_URL='postgresql://user:pass@host/db?sslmode=require&channel_binding=require' bash scripts/prod-migrate.sh
#
# Si tenés apps/api/.env con otra DATABASE_URL, este script lo aparta un momento
# para que Prisma use solo la variable que pasaste (evita P1012 / URL inválida).
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL no está seteada."
  echo "Ejemplo (comillas simples si hay &):"
  echo "  DATABASE_URL='postgresql://...?sslmode=require&channel_binding=require' bash scripts/prod-migrate.sh"
  exit 1
fi

export DATABASE_URL

ENV_FILE="$ROOT/apps/api/.env"
if [[ -f "$ENV_FILE" ]]; then
  mv "$ENV_FILE" "${ENV_FILE}.bak.$$"
  restore_env() { mv "${ENV_FILE}.bak.$$" "$ENV_FILE" 2>/dev/null || true; }
  trap restore_env EXIT
  echo "→ apps/api/.env apartado temporalmente (se restaura al terminar)."
fi

echo "=== MatchProp prod-migrate ==="
echo "→ prisma migrate status (diagnóstico)"
pnpm --filter api exec prisma migrate status || true

echo ""
echo "→ prisma generate"
pnpm --filter api exec prisma generate

echo ""
echo "→ prisma migrate deploy"
pnpm --filter api exec prisma migrate deploy

echo ""
echo "=== OK — Verificá: curl -s https://match-prop-admin-dsvv.vercel.app/health | grep migration ==="
