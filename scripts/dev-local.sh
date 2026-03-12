#!/usr/bin/env bash
# Levantar API + Web en local usando Neon (DATABASE_URL en apps/api/.env.local).
# No requiere Docker. Para magic link y login necesitás DB (Neon).
set -e
cd "$(dirname "$0")/.."

echo "=== MatchProp dev-local (API + Web con Neon) ==="
[ -f apps/api/.env.local ] || { echo "Falta apps/api/.env.local (ej: vercel env pull .env.local)"; exit 1; }

# Cargar env de la API (Neon, etc.)
set -a
source apps/api/.env.local 2>/dev/null || true
set +a
export DEMO_MODE=1

# Liberar puertos
for port in 3000 3001; do
  lsof -ti:$port 2>/dev/null | xargs kill -9 2>/dev/null || true
done
sleep 2

pnpm build:shared
echo "Iniciando API (3001) y Web (3000)..."
pnpm --filter api dev > .logs/api.log 2>&1 &
API_PID=$!
sleep 5
API_SERVER_URL=http://127.0.0.1:3001 pnpm --filter web dev > .logs/web.log 2>&1 &
WEB_PID=$!

for i in $(seq 1 30); do
  API=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health 2>/dev/null || echo "000")
  WEB=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login 2>/dev/null || echo "000")
  if [ "$API" = "200" ] && [ "$WEB" = "200" ]; then
    echo ""
    echo "  OK - http://localhost:3000/login"
    echo "  Magic link: poné tu email y usá el botón 'Abrir link de acceso (dev)'"
    echo "  Logs: .logs/api.log .logs/web.log"
    exit 0
  fi
  [ $((i % 5)) -eq 0 ] && echo "  ${i}s API=$API Web=$WEB"
  sleep 1
done
kill $API_PID $WEB_PID 2>/dev/null || true
echo "Timeout. Revisá .logs/api.log (¿DATABASE_URL apunta a Neon?)"
exit 1
