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

# Evita confusión común: la URL pública HTTPS de la API (Vercel) NO es la conexión a Postgres.
case "${DATABASE_URL}" in
  http://* | https://*)
    echo "ERROR: DATABASE_URL parece una URL HTTP(S) de la API (p. ej. match-prop-admin-dsvv.vercel.app)."
    echo "Prisma necesita la cadena de PostgreSQL que empieza con postgresql:// o postgres://."
    echo ""
    echo "Dónde está la URL correcta:"
    echo "  Vercel → proyecto de la API → Settings → Environment Variables → DATABASE_URL (Production)."
    echo "  Copiá el valor completo (usuario, host de Neon, sslmode, etc.)."
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

# Si migrate deploy falla con P3009 (migración fallida, típico SendGrid), usá:
#   DATABASE_URL='postgresql://...' bash scripts/prod-migrate-recover-neon.sh
#
# Si falla con P3018 y "already exists", la DB ya tenía el objeto:
#   DATABASE_URL='postgresql://...' bash scripts/prod-migrate-resolve-applied.sh NOMBRE_CARPETA_MIGRACION
# Luego: DATABASE_URL='...' bash scripts/prod-migrate.sh
