#!/usr/bin/env bash
# Genera un ZIP listo para enviar al implementador (MatchProp v1.0)
# Excluye node_modules, .env (con secretos), builds, logs, etc.
set -e
cd "$(dirname "$0")/.."

OUTPUT="${1:-MatchProp-v1.0-deploy.zip}"
echo "=== Preparando paquete de deploy: $OUTPUT ==="

# Crear ZIP excluyendo archivos innecesarios o sensibles
zip -r "$OUTPUT" . \
  -x "node_modules/*" \
  -x "*/node_modules/*" \
  -x ".pnpm-store/*" \
  -x ".pnpm-store/**" \
  -x ".next/*" \
  -x "*/_next/*" \
  -x "*/dist/*" \
  -x "*/build/*" \
  -x ".expo/*" \
  -x "*.log" \
  -x ".logs/*" \
  -x ".git/*" \
  -x ".DS_Store" \
  -x "*.zip" \
  -x "coverage/*" \
  -x ".turbo/*" \
  -x "artifacts/*" \
  -x "test-results/*" \
  -x "playwright-report/*" \
  -x "out/*" \
  -x "apps/api/.env" \
  -x "apps/web/.env.local" \
  -x "apps/web/.env.production.local" \
  -x "apps/admin/.env.local" \
  -x ".env" \
  -x ".env.local" \
  -x ".env.*.local" \
  -x "*/__pycache__/*" \
  -x "*.pyc"

echo ""
echo "=== Listo: $OUTPUT ==="
echo "Contenido esencial:"
unzip -l "$OUTPUT" | head -80

echo ""
echo "IMPORTANTE: El ZIP NO incluye archivos .env (secretos)."
echo "El implementador debe crear apps/api/.env y apps/web/.env.local desde los .env.example"
