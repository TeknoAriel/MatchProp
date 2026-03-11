#!/usr/bin/env bash
# Gates mínimos para auditoría (modo estricto).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== audit:verify ==="
pnpm lint
pnpm format:check
pnpm -r typecheck
pnpm --filter api test:all

echo ""
echo "=== Gates OK ==="
if command -v pnpm &>/dev/null && pnpm run | grep -q 'demo:up'; then
  echo "Para smoke/demo ejecutar: pnpm demo:up"
fi
