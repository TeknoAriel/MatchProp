#!/usr/bin/env bash
# Smoke UX para CI: usa DATABASE_URL de env (postgres service), no Docker.
# Requiere: pnpm install, build:shared, prisma generate ya ejecutados.
set -e
cd "$(dirname "$0")/.."

echo "=== Smoke UX (CI): migraciones y seed ==="
cd apps/api
pnpm exec prisma migrate deploy
DEMO_MODE=1 pnpm run demo:reset-and-seed
pnpm run demo:validate
cd ../..

echo "=== Web .env.local (proxy /api -> 3001) ==="
mkdir -p apps/web
touch apps/web/.env.local
grep -q "API_SERVER_URL" apps/web/.env.local 2>/dev/null || echo "API_SERVER_URL=http://127.0.0.1:3001" >> apps/web/.env.local
grep -q "NEXT_PUBLIC_API_URL" apps/web/.env.local 2>/dev/null || echo "NEXT_PUBLIC_API_URL=" >> apps/web/.env.local

echo "=== Iniciando API (3001) y Web (3000) ==="
DEMO_MODE=1 pnpm --filter api dev &
API_PID=$!
pnpm --filter web dev &
WEB_PID=$!
trap "kill $API_PID $WEB_PID 2>/dev/null || true" EXIT

echo "=== Esperando servidores (90s max) ==="
for i in $(seq 1 90); do
  API_OK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health 2>/dev/null || echo "000")
  WEB_OK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login 2>/dev/null || echo "000")
  if [ "$API_OK" = "200" ] && [ "$WEB_OK" = "200" ]; then
    echo "Servidores listos (API=$API_OK WEB=$WEB_OK)"
    sleep 2
    break
  fi
  sleep 1
  if [ $i -eq 90 ]; then
    echo "Timeout: API=$API_OK WEB=$WEB_OK"
    exit 1
  fi
done

echo "=== Playwright install chromium ==="
pnpm --filter web exec playwright install chromium --with-deps 2>/dev/null || pnpm --filter web exec playwright install chromium

echo "=== Ejecutando smoke:ux ==="
pnpm --filter web smoke:ux
EXIT=$?
exit $EXIT
