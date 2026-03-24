#!/usr/bin/env bash
# Sincroniza el entorno local con main (producción).
# Ejecutá esto cuando tu local tenga una versión vieja o estés en una rama desactualizada.
#
# Uso: bash scripts/sync-local-from-main.sh
set -e
cd "$(dirname "$0")/.."

echo "=== Sincronizando local con main (producción) ==="

# Guardar cambios sin commitear (si hay)
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Hay cambios locales sin commitear. Guardando en stash..."
  git stash push -m "sync-local-$(date +%Y%m%d-%H%M%S)" || true
fi

echo "Fetch de origin..."
git fetch origin main

echo "Checkout a main y pull..."
git checkout main
git pull origin main

echo ""
echo "  ✅ Local sincronizado con main (producción)"
echo ""
echo "  Siguiente:"
echo "  - Para trabajar: git checkout -b mi-rama-feature"
echo "  - Para levantar: bash scripts/dev-local.sh"
echo ""
