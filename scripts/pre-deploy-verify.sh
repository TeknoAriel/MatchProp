#!/usr/bin/env bash
# Verificación pre-deploy: build, typecheck y tests.
# No incluye secretos ni .env de prod. Ejecutar en CI o local con dependencias instaladas.
# PRE_DEPLOY_FAST=1: solo builds api/web/admin (tras typecheck+tests en el mismo job de CI).
set -e
cd "$(dirname "$0")/.."

echo "=== MatchProp pre-deploy verify ==="

if [ "${PRE_DEPLOY_FAST:-}" = "1" ]; then
  echo "Modo rápido (CI): solo builds de apps (typecheck/tests ya corridos)."
  pnpm --filter api build
  pnpm --filter web build
  pnpm --filter admin build
  echo "=== pre-deploy verify OK (fast) ==="
  exit 0
fi

echo "1. Build shared..."
pnpm build:shared

echo "2. Typecheck..."
pnpm -r run typecheck
echo "2b. Typecheck Vercel handlers (API)..."
pnpm --filter api run typecheck:vercel

echo "3. Build api + web + admin..."
pnpm --filter api build
pnpm --filter web build
pnpm --filter admin build

echo "4. Tests API..."
pnpm --filter api test:all

echo "=== pre-deploy verify OK ==="
echo "Opcional: ejecutar 'pnpm smoke:ux' con servicios levantados para E2E."
