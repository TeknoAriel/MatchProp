#!/usr/bin/env bash
# Push a remoto y dispara deploy (Vercel/Railway hacen deploy automático al push)
# Requiere: git remote origin configurado
set -e
cd "$(dirname "$0")/.."

if ! git remote get-url origin &>/dev/null; then
  echo "ERROR: No hay remote 'origin'. Configurá:"
  echo "  bash scripts/git-remotes-tekno.sh"
  exit 1
fi

echo "=== Push a origin/main ==="
git push -u origin main

echo ""
echo "=== Deploy disparado ==="
echo "Si tenés Vercel conectado al repo, el deploy es automático."
echo "Web: https://vercel.com/dashboard"
