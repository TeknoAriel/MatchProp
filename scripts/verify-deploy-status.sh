#!/usr/bin/env bash
# Verifica que el deploy llegó a producción.
# Uso: bash scripts/verify-deploy-status.sh [branch]
# Sin args, usa la rama actual. Compara main remoto con el commit esperado.
set -e
cd "$(dirname "$0")/.."

BRANCH="${1:-$(git branch --show-current)}"
API_URL="${API_URL:-https://match-prop-admin-dsvv.vercel.app}"
WEB_URL="${WEB_URL:-https://match-prop-web.vercel.app}"

echo "=== Verificación de deploy: rama $BRANCH ==="

# 1. Fetch latest
git fetch origin main 2>/dev/null || true
git fetch origin "$BRANCH" 2>/dev/null || true

MAIN_SHA=$(git rev-parse origin/main 2>/dev/null || echo "")
BRANCH_SHA=$(git rev-parse "origin/$BRANCH" 2>/dev/null || echo "")

if [ -z "$MAIN_SHA" ]; then
  echo "❌ No se pudo obtener origin/main"
  exit 1
fi

# 2. ¿El branch está en main?
BRANCH_IN_MAIN=false
if [ "$BRANCH_SHA" = "$MAIN_SHA" ]; then
  echo "✓ La rama $BRANCH ya está en main (commit $MAIN_SHA)"
  BRANCH_IN_MAIN=true
else
  if git merge-base --is-ancestor "origin/$BRANCH" origin/main 2>/dev/null; then
    echo "✓ Los commits de $BRANCH están en main"
    BRANCH_IN_MAIN=true
  else
    # Squash/rebase merge: el tip de la rama no es ancestro de main, pero el PR cerrado
    # tiene merge_commit_sha == main (API pública, sin token; rate limit bajo).
    merged_via_gh_api=false
    origin_url=$(git remote get-url origin 2>/dev/null || true)
    if [[ "$origin_url" =~ github\.com[:/]([^/]+)/([^/.]+) ]]; then
      gh_owner="${BASH_REMATCH[1]}"
      gh_repo="${BASH_REMATCH[2]%.git}"
      api="https://api.github.com/repos/${gh_owner}/${gh_repo}/pulls?state=closed&head=${gh_owner}:${BRANCH}&per_page=5"
      if curl -sS --connect-timeout 10 "$api" 2>/dev/null | python3 -c "
import sys, json
main = sys.argv[1]
try:
    pulls = json.load(sys.stdin)
except json.JSONDecodeError:
    sys.exit(1)
for p in pulls:
    if p.get('merged_at') and p.get('merge_commit_sha') == main:
        sys.exit(0)
sys.exit(1)
" "$MAIN_SHA" 2>/dev/null; then
        echo "✓ Rama $BRANCH integrada en main (merge vía PR; squash/rebase)"
        merged_via_gh_api=true
        BRANCH_IN_MAIN=true
      fi
    fi
    if [ "$merged_via_gh_api" != "true" ]; then
      echo "⚠ La rama $BRANCH NO está mergeada en main"
      echo "  Main:   $MAIN_SHA"
      echo "  Branch: $BRANCH_SHA"
      echo "  Ver PR: https://github.com/kiteprop/ia-matchprop/pulls"
    fi
  fi
fi

# 3. Health check
echo ""
echo "=== Producción ==="
HEALTH=$(curl -sS --connect-timeout 10 "$API_URL/health" 2>/dev/null || echo '{}')
PROD_VERSION=$(echo "$HEALTH" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
STATUS=$(echo "$HEALTH" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

if [ "$STATUS" = "ok" ]; then
  echo "✓ API health: ok (version $PROD_VERSION)"
else
  echo "❌ API health: $STATUS"
fi

web_code=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 10 "$WEB_URL" 2>/dev/null || echo "000")
if [ "$web_code" = "200" ]; then
  echo "✓ Web: 200"
else
  echo "❌ Web: $web_code"
fi

# 4. ¿Prod tiene el commit de main?
echo ""
if [ -z "$PROD_VERSION" ]; then
  echo "⚠ No se pudo obtener version de producción (API no responde?)"
  exit 1
fi

# Si la rama no está mergeada (y no estamos comprobando main), no podemos decir "listo"
if [ "$BRANCH" != "main" ] && [ "$BRANCH_IN_MAIN" != "true" ]; then
  echo "❌ Tus cambios ($BRANCH) no están en main ni en producción."
  echo "   El PR debe mergearse. Ver docs/DEPLOY_TROUBLESHOOTING.md"
  exit 1
fi

# Comparar (ambos son commit SHA, 40 chars)
if [ "$PROD_VERSION" = "$MAIN_SHA" ]; then
  echo "✅ Producción está en el commit de main ($PROD_VERSION)"
  exit 0
else
  echo "⚠ Producción: $PROD_VERSION | Main: $MAIN_SHA"
  echo "  Si acabás de mergear, Vercel tarda 2-5 min. Ejecutá de nuevo."
  exit 1
fi
