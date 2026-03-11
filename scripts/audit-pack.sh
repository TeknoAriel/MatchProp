#!/usr/bin/env bash
# Genera ZIP auditable (sin node_modules, builds, env, artefactos).
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p artifacts

SHORT_SHA="nogit"
if command -v git &>/dev/null && git rev-parse --is-inside-work-tree &>/dev/null 2>/dev/null; then
  SHORT_SHA=$(git rev-parse --short HEAD 2>/dev/null || true)
  git rev-parse HEAD 2>/dev/null > artifacts/AUDIT_COMMIT.txt || true
fi
[ -f artifacts/AUDIT_COMMIT.txt ] || echo "nogit" > artifacts/AUDIT_COMMIT.txt

DATE=$(date +%Y%m%d)
ZIP_NAME="matchprop-audit-${DATE}-${SHORT_SHA}.zip"
ZIP_PATH="artifacts/${ZIP_NAME}"

# Excluir node_modules y artefactos (zip -x con patrones)
zip -r "$ZIP_PATH" . \
  -x "*.zip" \
  -x ".DS_Store" \
  -x ".env" \
  -x ".env.*" \
  -x "artifacts/*" \
  -x ".git/*" \
  -x "*.log" \
  -x "node_modules/*" \
  -x "*/node_modules/*" \
  -x "*/*/node_modules/*" \
  -x "*/*/*/node_modules/*" \
  -x ".next/*" \
  -x "*/.next/*" \
  -x "dist/*" \
  -x "*/dist/*" \
  -x "build/*" \
  -x "*/build/*" \
  -x "out/*" \
  -x "*/out/*" \
  -x "coverage/*" \
  -x "*/coverage/*" \
  -x "test-results/*" \
  -x "*/test-results/*" \
  -x "playwright-report/*" \
  -x "*/.turbo/*" \
  -x "*/.cache/*" \
  -q

echo "ZIP generado: $ZIP_PATH"
ls -la "$ZIP_PATH"
