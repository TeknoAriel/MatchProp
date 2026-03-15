#!/usr/bin/env bash
# Todo en uno: si falta DB/env, levanta Docker + migraciones + demo; luego API + Web.
# Para probar: abrí http://localhost:3000/login → "Entrar con link demo".
set -e
cd "$(dirname "$0")/.."

echo "=== MatchProp — listo para que entres y pruebes ==="
mkdir -p .logs

# Aumentar límite de fds para evitar EMFILE (página en blanco en macOS)
[ "$(uname)" = "Darwin" ] && ulimit -n 65536 2>/dev/null || ulimit -n 65536 2>/dev/null || true

# --- Si no hay .env.local en la API, preparar DB con Docker ---
if [ ! -f apps/api/.env.local ]; then
  echo "No hay apps/api/.env.local. Preparando DB local con Docker..."
  if ! docker info >/dev/null 2>&1; then
    echo "ERROR: Docker no está corriendo. Inicialo y volvé a ejecutar este script."
    exit 1
  fi
  docker compose up -d
  echo "Esperando Postgres..."
  for i in $(seq 1 30); do
    if nc -z localhost 5432 2>/dev/null; then
      sleep 2
      break
    fi
    sleep 1
  done
  if ! nc -z localhost 5432 2>/dev/null; then
    echo "ERROR: Postgres no respondió en el puerto 5432."
    exit 1
  fi

  echo "postgresql://matchprop:matchprop@localhost:5432/matchprop" > apps/api/.env.local
  export DATABASE_URL="postgresql://matchprop:matchprop@localhost:5432/matchprop"

  echo "Migraciones..."
  pnpm --filter api exec prisma generate
  pnpm --filter api exec prisma migrate deploy

  echo "Datos de demo (listings y búsquedas)..."
  DEMO_MODE=1 pnpm --filter api run demo:reset-and-seed || true
  pnpm --filter api run demo:validate 2>/dev/null || true

  echo "Listo: DB local creada y apps/api/.env.local generado."
fi

# --- Si ya existe .env.local y DB responde, aplicar migraciones y seed ---
if [ -f apps/api/.env.local ] && nc -z localhost 5432 2>/dev/null; then
  echo "Aplicando migraciones..."
  pnpm --filter api exec prisma generate
  pnpm --filter api exec prisma migrate deploy
  echo "Seed (admin users)..."
  pnpm --filter api run prisma:seed 2>/dev/null || true
fi

# --- Asegurar env mínimo en API ---
API_ENV="apps/api/.env"
[ -f "$API_ENV" ] || touch "$API_ENV"
grep -q INTEGRATIONS_MASTER_KEY "$API_ENV" 2>/dev/null || echo "INTEGRATIONS_MASTER_KEY=dev-key-local" >> "$API_ENV"
grep -q PREMIUM_FREE "$API_ENV" 2>/dev/null || echo "PREMIUM_FREE=1" >> "$API_ENV"

# --- Asegurar que la Web apunte a la API local ---
WEB_ENV="apps/web/.env.local"
if [ ! -f "$WEB_ENV" ] || ! grep -q API_SERVER_URL "$WEB_ENV" 2>/dev/null; then
  touch "$WEB_ENV"
  (grep -v '^API_SERVER_URL=' "$WEB_ENV" 2>/dev/null || true; echo "API_SERVER_URL=http://127.0.0.1:3001") > "${WEB_ENV}.tmp"
  mv "${WEB_ENV}.tmp" "$WEB_ENV"
fi

export DEMO_MODE=1

# --- Liberar puertos ---
for port in 3000 3001; do
  for _ in 1 2 3; do
    pid=$(lsof -ti:$port 2>/dev/null || true)
    [ -z "$pid" ] && break
    kill -9 $pid 2>/dev/null || true
    sleep 2
  done
done
sleep 2

echo "Build shared..."
pnpm build:shared

echo "Iniciando API (3001)..."
pnpm --filter api dev > .logs/api.log 2>&1 &
API_PID=$!

echo "Esperando API..."
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then break; fi
  [ $((i % 5)) -eq 0 ] && echo "  API ${i}s..."
  sleep 1
done
code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health 2>/dev/null || echo "000")
if [ "$code" != "200" ]; then
  kill $API_PID 2>/dev/null || true
  echo "ERROR: API no arrancó. Revisá .logs/api.log"
  exit 1
fi

echo "Iniciando Web (3000)..."
API_SERVER_URL=http://127.0.0.1:3001 pnpm --filter web dev > .logs/web.log 2>&1 &
WEB_PID=$!

echo "Esperando Web..."
for i in $(seq 1 45); do
  login=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login 2>/dev/null || echo "000")
  feed=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/feed 2>/dev/null || echo "000")
  if [ "$login" = "200" ] && [ "$feed" = "200" ]; then
    echo ""
    echo "  Listo. Entrá y probá:"
    echo "  → http://localhost:3000/login"
    echo "  → Clic en «Entrar con link demo» (entrás al feed)."
    echo ""
    echo "  Logs: .logs/api.log .logs/web.log"
    echo "  API y Web siguen corriendo. Ctrl+C para detener."
    echo ""
    wait
    exit 0
  fi
  [ $((i % 5)) -eq 0 ] && echo "  Web ${i}s..."
  sleep 1
done
kill $API_PID $WEB_PID 2>/dev/null || true
echo "Timeout. Revisá .logs/web.log y .logs/api.log"
exit 1
