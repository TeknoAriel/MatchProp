#!/usr/bin/env bash
# Demo up + smoke en 1 comando: reset+seed+validate → levantar API+WEB → esperar health → smoke:ux → salir 0 o 1.
set -e
cd "$(dirname "$0")/.."

# macOS: evitar EMFILE (too many open files) que rompe Next.js
[ "$(uname)" = "Darwin" ] && ulimit -n 10240 2>/dev/null || true

export DEMO_MODE=1
API_PID=""
WEB_PID=""

cleanup() {
  echo "=== Cleanup: apagando servidores ==="
  [ -n "$API_PID" ] && kill -9 $API_PID 2>/dev/null || true
  [ -n "$WEB_PID" ] && kill -9 $WEB_PID 2>/dev/null || true
  for p in 3000 3001; do
    pids=$(lsof -iTCP:$p -sTCP:LISTEN -t 2>/dev/null || true)
    [ -n "$pids" ] && for pid in $pids; do kill -9 $pid 2>/dev/null || true; done
  done
  sleep 1
}
trap cleanup EXIT

kill_port() {
  local port=$1
  local attempt=1
  while [ $attempt -le 5 ]; do
    pids=$(lsof -iTCP:$port -sTCP:LISTEN -t 2>/dev/null || true)
    if [ -z "$pids" ]; then return 0; fi
    echo "Liberando puerto $port (intento $attempt, PIDs: $pids)"
    for pid in $pids; do kill -TERM $pid 2>/dev/null || true; kill -9 $pid 2>/dev/null || true; done
    sleep 3
    attempt=$((attempt + 1))
  done
  echo "ERROR: No se pudo liberar puerto $port"
  exit 1
}

echo "=== demo:up — limpiando .next y liberando puertos 3000/3001/3002 ==="
rm -rf apps/web/.next apps/admin/.next 2>/dev/null || true
for p in 3000 3001 3002; do
  pids=$(lsof -ti :$p 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "Liberando puerto $p (PIDs: $pids)"
    echo "$pids" | xargs kill -9 2>/dev/null || true
  fi
done
sleep 2
kill_port 3000
kill_port 3001
sleep 2

echo "=== Docker + Prisma ==="
docker compose up -d 2>/dev/null || true
sleep 3
pnpm build:shared
pnpm --filter api exec prisma generate
pnpm --filter api exec prisma migrate deploy
SEED_PROPERTIES=0 pnpm --filter api exec prisma db seed 2>/dev/null || true

echo "=== Web .env.local ==="
WEB_ENV="apps/web/.env.local"
mkdir -p apps/web
touch "$WEB_ENV"
grep -q "API_SERVER_URL" "$WEB_ENV" 2>/dev/null || echo "API_SERVER_URL=http://127.0.0.1:3001" >> "$WEB_ENV"
grep -q "NEXT_PUBLIC_API_URL" "$WEB_ENV" 2>/dev/null || echo "NEXT_PUBLIC_API_URL=" >> "$WEB_ENV"

echo "1. Reset + seed dataset demo..."
DEMO_MODE=1 pnpm --filter api demo:reset-and-seed || { echo "ERROR: demo:reset-and-seed falló"; exit 1; }
echo "2. Validación demo..."
pnpm --filter api demo:validate || { echo "ERROR: demo:validate falló"; exit 1; }

echo "3. Levantando API (3001) y WEB (3000) con DEMO_MODE=1..."
DEMO_MODE=1 pnpm --filter api dev &
API_PID=$!
# macOS: ulimit en subshell para que Next.js watcher no falle por EMFILE
(ulimit -n 10240 2>/dev/null; exec pnpm --filter web dev) &
WEB_PID=$!

echo "4. Esperando health (polling cada 2s, máx 180s)..."
for i in $(seq 1 90); do
  API_OK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health 2>/dev/null || echo "000")
  WEB_OK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "000")
  if [ "$API_OK" = "200" ] && [ "$WEB_OK" != "000" ]; then
    echo "   API y WEB listos (intento $i)."
    break
  fi
  if [ $i -eq 90 ]; then
    echo "ERROR: Timeout 180s. API=$API_OK WEB=$WEB_OK"
    echo "Revisá procesos en 3000/3001 y logs."
    exit 1
  fi
  sleep 2
done

echo "5. Instalando browser Playwright (Chromium — Firefox falla en macOS 12)..."
PLAYWRIGHT_BROWSER=chromium
pnpm --filter web exec playwright install chromium 2>/dev/null || true

echo "6. Corriendo smoke:ux (Playwright)..."
if ! PLAYWRIGHT_BROWSER=$PLAYWRIGHT_BROWSER pnpm --filter web smoke:ux; then
  echo "ERROR: smoke:ux falló. URLs útiles: http://localhost:3000/status http://localhost:3000/feed/list"
  exit 1
fi

LISTINGS=$(curl -s http://localhost:3001/status/listings-count 2>/dev/null | grep -o '"total":[0-9]*' | cut -d: -f2 || echo "?")
echo ""
echo "READY + SMOKE OK: listings=${LISTINGS} web=http://localhost:3000 api=http://localhost:3001"
exit 0
