#!/usr/bin/env bash
# Compara GitHub main (API pública) con API /health.version; si difieren, POST a deploy hooks de Vercel.
# Uso en CI (sin checkout): bash scripts/post-hooks-if-prod-behind-main.sh
# Requiere secretos VERCEL_DEPLOY_HOOK_* en GitHub Actions (si faltan, solo avisa).
set -euo pipefail

API_URL="${API_URL:-https://match-prop-admin-dsvv.vercel.app}"
REPO="${GITHUB_REPOSITORY:-TeknoAriel/MatchProp}"

post_hook() {
  local label="$1" url="$2"
  if [ -z "${url:-}" ]; then
    echo "::notice::Hook ${label} sin secreto — omitido"
    return 0
  fi
  local code
  code=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "$url" || echo "000")
  echo "POST hook ${label} → HTTP ${code}"
  case "$code" in 200|201|204) ;; *) echo "::warning::Hook ${label} no OK (${code})" ;; esac
}

MAIN_SHA=$(curl -sS --connect-timeout 15 "https://api.github.com/repos/${REPO}/commits/main" | python3 -c "import sys,json; print(json.load(sys.stdin)['sha'])")

HEALTH=$(curl -sS --connect-timeout 15 "${API_URL}/health")
PROD=$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('version',''))" 2>/dev/null || echo "")

if [ -z "$PROD" ]; then
  echo "::error::No se obtuvo version de ${API_URL}/health"
  exit 1
fi

if [ "$MAIN_SHA" = "$PROD" ]; then
  echo "✓ Producción alineada con GitHub main ($(echo "$MAIN_SHA" | cut -c1-12))"
  exit 0
fi

echo "::warning::Desalineado: GitHub main=$(echo "$MAIN_SHA" | cut -c1-12) prod=$(echo "$PROD" | cut -c1-12) → disparando deploy hooks"
post_hook "API" "${VERCEL_DEPLOY_HOOK_API:-}"
post_hook "WEB" "${VERCEL_DEPLOY_HOOK_WEB:-}"
post_hook "ADMIN" "${VERCEL_DEPLOY_HOOK_ADMIN:-}"
echo "Listo (hooks enviados si había secretos)."
exit 0
