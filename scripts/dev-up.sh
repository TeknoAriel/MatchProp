#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."

# macOS: evitar EMFILE (too many open files) que rompe Next.js
[ "$(uname)" = "Darwin" ] && ulimit -n 10240 2>/dev/null || true

echo "=== MatchProp dev-up ==="

mkdir -p .logs

echo "1. Matando procesos en 3000/3001..."
for port in 3000 3001; do
  pid=$(lsof -ti:$port 2>/dev/null || true)
  if [ -n "$pid" ]; then
    kill -9 $pid 2>/dev/null || true
    sleep 1
  fi
done

echo "2. Docker reset limpio..."
docker compose down -v 2>/dev/null || true
docker compose up -d 2>/dev/null || true
sleep 3

echo "3. Esperando DB..."
./scripts/wait-db.sh

echo "4. Prisma generate + migrate + seed..."
pnpm --filter api exec prisma generate
pnpm --filter api exec prisma migrate deploy
SEED_PROPERTIES=0 pnpm --filter api exec prisma db seed 2>/dev/null || true

echo "5. Reset + seed dataset demo (500+ listings garantizados)..."
DEMO_MODE=1 pnpm --filter api demo:reset-and-seed || { echo "ERROR: demo:reset-and-seed falló"; exit 1; }
pnpm --filter api demo:validate || { echo "ERROR: demo:validate falló"; exit 1; }

echo "5b. INTEGRATIONS_MASTER_KEY (solo dev)..."
API_ENV="apps/api/.env"
if [ ! -f "$API_ENV" ] || ! grep -q INTEGRATIONS_MASTER_KEY "$API_ENV" 2>/dev/null; then
  KEY=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64 2>/dev/null)
  echo "INTEGRATIONS_MASTER_KEY=$KEY" >> "$API_ENV" 2>/dev/null || true
fi

echo "5c. Web .env.local (proxy /api -> 3001, sin CORS)..."
WEB_ENV="apps/web/.env.local"
mkdir -p apps/web
touch "$WEB_ENV"
grep -q "NEXT_PUBLIC_API_URL" "$WEB_ENV" 2>/dev/null || echo "NEXT_PUBLIC_API_URL=" >> "$WEB_ENV"
grep -q "API_SERVER_URL" "$WEB_ENV" 2>/dev/null || echo "API_SERVER_URL=http://127.0.0.1:3001" >> "$WEB_ENV"
grep -q "NEXT_PUBLIC_BUILD_ID" "$WEB_ENV" 2>/dev/null || echo "NEXT_PUBLIC_BUILD_ID=dev" >> "$WEB_ENV"

echo "6. Liberando puertos 3000/3001..."
for port in 3000 3001; do
  pid=$(lsof -ti:$port 2>/dev/null || true)
  if [ -n "$pid" ]; then
    kill -9 $pid 2>/dev/null || true
    sleep 1
  fi
done

echo "7. Levantando API (3001) y WEB (3000) con DEMO_MODE=1..."
pnpm build:shared 2>/dev/null || true
# macOS: pre-build Web evita EMFILE (next dev falla con "too many open files")
if [ "$(uname)" = "Darwin" ]; then
  echo "   Web: pre-build (1-2 min)..."
  pnpm --filter web build 2>/dev/null || true
fi
DEMO_MODE=1 pnpm --filter api dev > .logs/api.log 2>&1 &
API_PID=$!
if [ "$(uname)" = "Darwin" ]; then
  (cd apps/web && pnpm exec next start -p 3000 -H 0.0.0.0) > .logs/web.log 2>&1 &
else
  pnpm dev:web > .logs/web.log 2>&1 &
fi
WEB_PID=$!

echo "8. Esperando servidores..."
for i in $(seq 1 90); do
  API_OK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health 2>/dev/null || echo "000")
  WEB_OK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "000")
  if [ "$API_OK" = "200" ] && [ "$WEB_OK" != "000" ]; then
    echo ""
    echo "=== READY ==="
    echo "  http://localhost:3000/login"
    echo "  http://localhost:3000/feed"
    echo "  http://localhost:3000/assistant"
    echo ""
    [ "$(uname)" = "Darwin" ] && open "http://localhost:3000/login" 2>/dev/null || true
    echo "Usuario demo: smoke-ux@matchprop.com (click 'Abrir link de acceso dev')"
    echo ""
    exit 0
  fi
  sleep 1
done

echo "Timeout. Revisá .logs/api.log y .logs/web.log"
kill $API_PID $WEB_PID 2>/dev/null || true
exit 1
