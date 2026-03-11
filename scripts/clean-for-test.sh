#!/usr/bin/env bash
# Limpia caches y artefactos de build para prueba sin cache.
set -e
cd "$(dirname "$0")/.."

echo "=== MatchProp: limpieza para prueba sin cache ==="

echo "1. Deteniendo procesos en 3000/3001..."
for port in 3000 3001; do
  pid=$(lsof -ti:$port 2>/dev/null || true)
  if [ -n "$pid" ]; then
    kill -9 $pid 2>/dev/null || true
    sleep 1
  fi
done

echo "2. Eliminando caches y artefactos de build..."
rm -rf apps/web/.next
rm -rf apps/api/dist
rm -rf apps/admin/.next
rm -rf apps/admin/dist
rm -rf .turbo
rm -rf node_modules/.cache
find . -name "*.tsbuildinfo" -delete 2>/dev/null || true

echo "3. Regenerando Prisma..."
pnpm --filter api exec prisma generate 2>/dev/null || true

echo "4. Build shared..."
pnpm build:shared 2>/dev/null || true

echo ""
echo "=== Limpieza lista ==="
echo ""
echo "Para probar sin cache:"
echo "  1. Ejecutá: pnpm dev:up  (o pnpm demo:up para demo + smoke)"
echo "  2. En el navegador: modo incógnito o Cmd+Shift+R / Ctrl+Shift+R (hard reload)"
echo "  3. Si usaste 'Simular Premium', limpiá cookies del sitio para volver al estado real"
echo ""
