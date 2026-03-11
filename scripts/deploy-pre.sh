#!/usr/bin/env bash
# Pre-deploy: migraciones y validaciones.
# Ejecutar antes de start en producción.
set -e
cd "$(dirname "$0")/.."

echo "=== MatchProp deploy-pre ==="

# 1. Prisma generate
pnpm --filter api exec prisma generate

# 2. Migraciones (producción)
echo "Aplicando migraciones..."
pnpm --filter api exec prisma migrate deploy

echo "=== deploy-pre listo ==="
