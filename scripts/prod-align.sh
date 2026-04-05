#!/usr/bin/env bash
# Verificación rápida y estable: origin/main (Tekno) ↔ producción Vercel (API + Web).
# Kiteprop (remoto opcional) solo informativo; nunca hace fallar el chequeo.
#
# Uso:
#   pnpm prod:align
#   bash scripts/prod-align.sh [--json] [--skip-fetch] [--with-kiteprop] [--no-retry]
#
# Variables de entorno:
#   API_URL, WEB_URL          URLs de prod (defaults abajo)
#   VERIFY_PROD_RETRIES       Reintentos si prod ≠ main (default 3)
#   VERIFY_PROD_RETRY_SEC       Segundos entre reintentos (default 20)
#   VERIFY_KITEPROP_FETCH=1     Incluir git fetch kiteprop main (lento; solo auditoría)
#
set -euo pipefail
cd "$(dirname "$0")/.."

API_URL="${API_URL:-https://match-prop-admin-dsvv.vercel.app}"
WEB_URL="${WEB_URL:-https://match-prop-web.vercel.app}"
RETRIES="${VERIFY_PROD_RETRIES:-3}"
RETRY_SEC="${VERIFY_PROD_RETRY_SEC:-20}"

JSON=false
SKIP_FETCH=false
WITH_KITEPROP=false
NO_RETRY=false

for arg in "$@"; do
  case "$arg" in
    --json) JSON=true ;;
    --skip-fetch) SKIP_FETCH=true ;;
    --with-kiteprop) WITH_KITEPROP=true ;;
    --no-retry) NO_RETRY=true ;;
    -h|--help)
      grep '^#' "$0" | head -n 18 | sed 's/^# \?//'
      exit 0
      ;;
  esac
done

if [ "${VERIFY_KITEPROP_FETCH:-0}" = "1" ]; then
  WITH_KITEPROP=true
fi

short_sha() {
  echo "${1:0:12}"
}

fetch_origin() {
  if [ "$SKIP_FETCH" = true ]; then
    return 0
  fi
  git fetch origin main 2>/dev/null || {
    echo "❌ No se pudo git fetch origin main"
    exit 1
  }
}

fetch_kiteprop_optional() {
  if [ "$WITH_KITEPROP" != true ]; then
    return 0
  fi
  if git remote get-url kiteprop &>/dev/null; then
    git fetch kiteprop main 2>/dev/null || true
  fi
}

get_main_sha() {
  git rev-parse origin/main 2>/dev/null || {
    echo "❌ Sin origin/main"
    exit 1
  }
}

curl_health_json() {
  local url="$1"
  curl -sS --connect-timeout 12 --max-time 25 "$url" 2>/dev/null || echo '{}'
}

extract_version() {
  local json="$1"
  if command -v python3 >/dev/null 2>&1; then
    echo "$json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('version') or '')" 2>/dev/null || echo ""
  else
    echo "$json" | grep -o '"version":"[^"]*"' | head -1 | cut -d'"' -f4
  fi
}

extract_status() {
  local json="$1"
  if command -v python3 >/dev/null 2>&1; then
    echo "$json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status') or '')" 2>/dev/null || echo ""
  else
    echo "$json" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4
  fi
}

kiteprop_note() {
  local main_sha="$1"
  if ! git remote get-url kiteprop &>/dev/null; then
    echo "kiteprop_remote=false"
    return 0
  fi
  if ! git rev-parse kiteprop/main &>/dev/null; then
    echo "kiteprop_main=missing_ref"
    return 0
  fi
  local kp
  kp=$(git rev-parse kiteprop/main)
  if [ "$kp" != "$main_sha" ]; then
    echo "kiteprop_drift=true kiteprop_sha=$(short_sha "$kp")"
  else
    echo "kiteprop_drift=false"
  fi
}

MAIN_SHA=""
API_VER=""
WEB_VER=""
API_STATUS=""
DB_STATUS=""
WEB_ROOT_CODE="000"

run_checks() {
  MAIN_SHA=$(get_main_sha)
  local api_json web_json
  api_json=$(curl_health_json "${API_URL}/health")
  web_json=$(curl_health_json "${WEB_URL}/api/health")
  API_VER=$(extract_version "$api_json")
  WEB_VER=$(extract_version "$web_json")
  API_STATUS=$(extract_status "$api_json")
  if command -v python3 >/dev/null 2>&1; then
    DB_STATUS=$(echo "$api_json" | python3 -c "import sys,json; print(json.load(sys.stdin).get('db',''))" 2>/dev/null || echo "")
  else
    DB_STATUS=$(echo "$api_json" | grep -o '"db":"[^"]*"' | head -1 | cut -d'"' -f4)
  fi
  WEB_ROOT_CODE=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 12 --max-time 25 "$WEB_URL" 2>/dev/null || echo "000")
}

is_prod_aligned() {
  [ -n "$API_VER" ] && [ "$API_VER" = "$MAIN_SHA" ] && [ "$WEB_VER" = "$MAIN_SHA" ] && [ "$API_STATUS" = "ok" ]
}

emit_json() {
  local ok_flag="${1:-0}"
  local kp_info
  kp_info=$(kiteprop_note "$MAIN_SHA")
  if command -v python3 >/dev/null 2>&1; then
    OK_FLAG="$ok_flag" MAIN_SHA="$MAIN_SHA" API_VER="$API_VER" WEB_VER="$WEB_VER" API_STATUS="$API_STATUS" DB_STATUS="$DB_STATUS" WEB_ROOT_CODE="$WEB_ROOT_CODE" KP_INFO="$kp_info" python3 <<'PY'
import json, os
ok = os.environ.get("OK_FLAG") == "1"
out = {
  "ok": ok,
  "canonical": "tekno_origin_main",
  "origin_main": os.environ.get("MAIN_SHA", ""),
  "api_version": os.environ.get("API_VER", ""),
  "web_version": os.environ.get("WEB_VER", ""),
  "api_status": os.environ.get("API_STATUS", ""),
  "db": os.environ.get("DB_STATUS", ""),
  "web_root_http": os.environ.get("WEB_ROOT_CODE", ""),
  "kiteprop_info": os.environ.get("KP_INFO", ""),
}
print(json.dumps(out, ensure_ascii=False))
PY
  else
    ob="false"
    [ "$ok_flag" = "1" ] && ob="true"
    echo "{\"ok\":$ob,\"origin_main\":\"$MAIN_SHA\",\"api_version\":\"$API_VER\",\"web_version\":\"$WEB_VER\"}"
  fi
}

# --- main flow ---
fetch_origin
fetch_kiteprop_optional

attempt=1
while true; do
  run_checks

  if is_prod_aligned; then
    break
  fi

  if [ "$NO_RETRY" = true ] || [ "$attempt" -ge "$RETRIES" ]; then
    break
  fi
  echo "⏳ Prod aún no coincide con origin/main (intento $attempt/$RETRIES). Reintento en ${RETRY_SEC}s…"
  sleep "$RETRY_SEC"
  attempt=$((attempt + 1))
  fetch_origin
done

if [ "$JSON" = true ]; then
  ok_flag=0
  if is_prod_aligned && [ "$DB_STATUS" = "ok" ] && [[ "$WEB_ROOT_CODE" =~ ^2 ]]; then
    ok_flag=1
  fi
  emit_json "$ok_flag"
  if [ "$ok_flag" = "1" ]; then exit 0; else exit 1; fi
fi

echo "=== prod-align (Tekno origin/main ↔ Vercel) ==="
echo "  origin/main:  $(short_sha "$MAIN_SHA")"
echo "  API /health:  version=$(short_sha "${API_VER:-}") status=${API_STATUS:-?} db=${DB_STATUS:-?}"
echo "  Web /api/health: version=$(short_sha "${WEB_VER:-}")"
echo "  Web /:        HTTP $WEB_ROOT_CODE"
if git remote get-url kiteprop &>/dev/null; then
  if git rev-parse kiteprop/main &>/dev/null; then
    kp=$(git rev-parse kiteprop/main)
    if [ "$kp" != "$MAIN_SHA" ]; then
      echo "  Kiteprop (auditoría): kiteprop/main ≠ origin/main → push manual a kiteprop cuando pidan auditoría"
      echo "                        kiteprop/main=$(short_sha "$kp")"
    else
      echo "  Kiteprop (auditoría): kiteprop/main = origin/main"
    fi
  else
    echo "  Kiteprop: sin kiteprop/main local (usá --with-kiteprop o VERIFY_KITEPROP_FETCH=1)"
  fi
else
  echo "  Kiteprop: remoto no configurado (opcional)"
fi
echo ""

if ! is_prod_aligned; then
  echo "❌ Producción NO alineada con origin/main (Tekno)."
  echo "   Main: $(short_sha "$MAIN_SHA") | API prod: $(short_sha "${API_VER:-none}") | Web prod: $(short_sha "${WEB_VER:-none}")"
  echo "   Tras merge: esperá el deploy o dispará hooks / Vercel prod (CLI). Ver docs/DEPLOY_TROUBLESHOOTING.md"
  exit 1
fi

if [ "$DB_STATUS" != "ok" ]; then
  echo "⚠ API db≠ok — revisar DATABASE_URL"
  exit 1
fi

if ! [[ "$WEB_ROOT_CODE" =~ ^2 ]]; then
  echo "❌ Web raíz no responde 2xx (HTTP $WEB_ROOT_CODE)"
  exit 1
fi

echo "✅ Producción alineada con Tekno origin/main ($(short_sha "$MAIN_SHA"))"
exit 0
