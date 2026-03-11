#!/usr/bin/env bash
# Verificación pre-deploy: build, typecheck y tests.
# No incluye secretos ni .env de prod. Ejecutar en CI o local con dependencias instaladas.
set -e
cd "$(dirname "$0")/.."

echo "=== MatchProp pre-deploy verify ==="

echo "1. Build shared..."
pnpm build:shared

echo "2. Typecheck..."
pnpm -r run typecheck

echo "3. Build api + web + admin..."
pnpm --filter api build
pnpm --filter web build
pnpm --filter admin build

echo "4. Tests API..."
pnpm --filter api test:all

echo "=== pre-deploy verify OK ==="
echo "Opcional: ejecutar 'pnpm smoke:ux' con servicios levantados para E2E."
