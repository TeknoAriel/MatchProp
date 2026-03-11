#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."

# macOS: evitar EMFILE (too many open files)
[ "$(uname)" = "Darwin" ] && ulimit -n 10240 2>/dev/null || true

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

# Libera puerto: SIGTERM -> SIGKILL, hasta 5 intentos con más espera
# Usamos LISTEN solo para no matar clientes (ej. Cursor conectado al puerto)
kill_port() {
  local port=$1
  local attempt=1
  while [ $attempt -le 5 ]; do
    local pids
    pids=$(lsof -iTCP:$port -sTCP:LISTEN -t 2>/dev/null || true)
    if [ -z "$pids" ]; then
      return 0
    fi
    echo "Liberando puerto $port (intento $attempt, PIDs: $pids)"
    for pid in $pids; do
      kill -TERM $pid 2>/dev/null || true
      kill -9 $pid 2>/dev/null || true
    done
    sleep 3
    pids=$(lsof -iTCP:$port -sTCP:LISTEN -t 2>/dev/null || true)
    if [ -z "$pids" ]; then
      return 0
    fi
    attempt=$((attempt + 1))
  done
  echo "ERROR: No se pudo liberar puerto $port"
  echo "Ejecutá manualmente: lsof -iTCP:$port -sTCP:LISTEN -t | xargs kill -9"
  echo "Diagnóstico (LISTEN):"
  lsof -iTCP:$port -sTCP:LISTEN 2>/dev/null || true
  exit 1
}

echo "=== Smoke UX: limpiando .next y liberando puertos 3000/3001/3002 ==="
rm -rf apps/web/.next apps/admin/.next 2>/dev/null || true
for p in 3000 3001 3002; do
  pids=$(lsof -ti :$p 2>/dev/null || true)
  [ -n "$pids" ] && echo "$pids" | xargs kill -9 2>/dev/null || true
done
sleep 2
kill_port 3000
kill_port 3001
sleep 2

echo "=== Smoke UX: preparando entorno ==="
docker compose up -d 2>/dev/null || true
sleep 3

pnpm build:shared
pnpm --filter api exec prisma generate
pnpm --filter api exec prisma migrate deploy

echo "=== Web .env.local (proxy /api -> 3001) ==="
WEB_ENV="apps/web/.env.local"
mkdir -p apps/web
touch "$WEB_ENV"
grep -q "API_SERVER_URL" "$WEB_ENV" 2>/dev/null || echo "API_SERVER_URL=http://127.0.0.1:3001" >> "$WEB_ENV"
grep -q "NEXT_PUBLIC_API_URL" "$WEB_ENV" 2>/dev/null || echo "NEXT_PUBLIC_API_URL=" >> "$WEB_ENV"

echo "=== Reset + seed dataset demo ==="
DEMO_MODE=1 pnpm --filter api demo:reset-and-seed || { echo "ERROR: demo:reset-and-seed falló"; exit 1; }
pnpm --filter api demo:validate || { echo "ERROR: demo:validate falló"; exit 1; }

echo "=== Iniciando API (3001) y WEB (3000) ==="
DEMO_MODE=1 pnpm --filter api dev &
API_PID=$!
(ulimit -n 10240 2>/dev/null; exec pnpm --filter web dev) &
WEB_PID=$!

echo "=== Esperando servidores (retries) ==="
for i in $(seq 1 90); do
  API_OK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health 2>/dev/null || echo "000")
  WEB_OK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login 2>/dev/null || echo "000")
  if [ "$API_OK" = "200" ] && [ "$WEB_OK" = "200" ]; then
    echo "Servidores listos (API=$API_OK WEB=$WEB_OK)"
    sleep 3
    break
  fi
  sleep 1
  if [ $i -eq 90 ]; then
    echo "Timeout esperando servidores (API=$API_OK WEB=$WEB_OK)"
    echo "Diagnóstico puertos:"
    lsof -i :3000 2>/dev/null || true
    lsof -i :3001 2>/dev/null || true
    exit 1
  fi
done

echo "=== Instalando browser Playwright (Chromium — Firefox falla en macOS 12) ==="
PLAYWRIGHT_BROWSER=chromium
pnpm --filter web exec playwright install chromium 2>/dev/null || true

echo "=== Ejecutando Playwright smoke:ux ==="
PLAYWRIGHT_BROWSER=$PLAYWRIGHT_BROWSER pnpm --filter web smoke:ux
EXIT=$?
exit $EXIT
