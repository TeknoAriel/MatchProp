#!/usr/bin/env bash
# Arranque completo desde cero: deps, Docker, DB, build, API + Web.
# Un solo comando para dejar todo funcionando.
set -e
cd "$(dirname "$0")/.."

[ "$(uname)" = "Darwin" ] && ulimit -n 10240 2>/dev/null || true

echo "=== MatchProp dev-up ==="
mkdir -p .logs

# 0. Dependencias (obligatorio para que next/build existan)
echo "0. Dependencias..."
pnpm install

# 1. Liberar puertos
echo "1. Liberando 3000/3001..."
pkill -f "next" 2>/dev/null || true
for port in 3000 3001; do
  for _ in 1 2 3; do
    pid=$(lsof -ti:$port 2>/dev/null || true)
    [ -z "$pid" ] && break
    kill -9 $pid 2>/dev/null || true
    sleep 2
  done
done
sleep 2

# 2. Docker + DB
echo "2. Docker (Postgres)..."
docker info >/dev/null 2>&1 || { echo "ERROR: Docker no está corriendo."; exit 1; }
docker compose down -v 2>/dev/null || true
docker compose up -d
sleep 5

echo "3. DB..."
./scripts/wait-db.sh
pnpm --filter api exec prisma generate
pnpm --filter api exec prisma migrate deploy
SEED_PROPERTIES=0 pnpm --filter api exec prisma db seed 2>/dev/null || true

# 4. Demo
echo "4. Demo (listings + búsquedas)..."
DEMO_MODE=1 pnpm --filter api demo:reset-and-seed || { echo "ERROR: demo:reset-and-seed"; exit 1; }
pnpm --filter api demo:validate || { echo "ERROR: demo:validate"; exit 1; }

# 5. Env
echo "5. Config..."
API_ENV="apps/api/.env"
[ -f "$API_ENV" ] || touch "$API_ENV"
grep -q INTEGRATIONS_MASTER_KEY "$API_ENV" 2>/dev/null || echo "INTEGRATIONS_MASTER_KEY=$(openssl rand -base64 32 2>/dev/null || echo 'dev-key')" >> "$API_ENV"

WEB_ENV="apps/web/.env.local"
cat > "$WEB_ENV" << 'ENVEOF'
NEXT_PUBLIC_API_URL=
API_SERVER_URL=http://127.0.0.1:3001
NEXT_PUBLIC_PREMIUM_GRACE_PERIOD=1
ENVEOF

# 6. Build (crítico: next start requiere .next/)
echo "6. Build..."
pnpm build:shared
pnpm --filter web build || { echo "ERROR: build web"; exit 1; }
[ -f apps/web/.next/BUILD_ID ] || { echo "ERROR: .next/BUILD_ID no existe"; exit 1; }

# 7. Liberar puertos de nuevo (por si algo quedó)
for port in 3000 3001; do
  lsof -ti:$port 2>/dev/null | xargs kill -9 2>/dev/null || true
done
sleep 2

# 8. Levantar
echo "7. Iniciando API (3001) y Web (3000)..."
DEMO_MODE=1 pnpm --filter api dev > .logs/api.log 2>&1 &
API_PID=$!
(cd apps/web && pnpm exec next start -p 3000 -H 0.0.0.0) > .logs/web.log 2>&1 &
WEB_PID=$!

# 9. Esperar
echo "8. Esperando..."
for i in $(seq 1 90); do
  API=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health 2>/dev/null || echo "000")
  WEB=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login 2>/dev/null || echo "000")
  if [ "$API" = "200" ] && [ "$WEB" = "200" ]; then
    echo ""
    echo "=========================================="
    echo "  OK - http://localhost:3000/login"
    echo "  Usuario: smoke-ux@matchprop.com"
    echo "=========================================="
    [ "$(uname)" = "Darwin" ] && open "http://localhost:3000/login" 2>/dev/null || true
    exit 0
  fi
  [ $((i % 15)) -eq 0 ] && echo "  ${i}s API=$API Web=$WEB"
  sleep 1
done

echo "Timeout. Logs: .logs/api.log .logs/web.log"
kill $API_PID $WEB_PID 2>/dev/null || true
exit 1
