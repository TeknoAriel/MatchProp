#!/usr/bin/env bash
# Verificación rápida de producción (Web + API health). Sin servidores locales.
set -e
cd "$(dirname "$0")/.."

WEB_URL="${WEB_URL:-https://match-prop-web.vercel.app}"
API_URL="${API_URL:-https://match-prop-api-1jte.vercel.app}"

echo "=== Smoke prod: $WEB_URL + $API_URL/health ==="
web_code=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 10 "$WEB_URL" || echo "000")
health_code=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 10 "$API_URL/health" || echo "000")

if [ "$web_code" = "200" ] && [ "$health_code" = "200" ]; then
  echo "OK Web=$web_code API/health=$health_code"
  exit 0
fi
echo "FAIL Web=$web_code API/health=$health_code"
exit 1
