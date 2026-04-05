#!/usr/bin/env bash
# origin = Tekno (trabajo + CI + Vercel). kiteprop = copia para auditoría (push manual cuando lo pidan).
# Uso: bash scripts/git-remotes-tekno.sh
# Override: TEKNO_REPO_URL=... KITEPROP_REPO_URL=... bash scripts/git-remotes-tekno.sh
set -euo pipefail
cd "$(dirname "$0")/.."

TEKNO_REPO_URL="${TEKNO_REPO_URL:-git@github.com:TeknoAriel/MatchProp.git}"
KITEPROP_REPO_URL="${KITEPROP_REPO_URL:-git@github.com:kiteprop/ia-matchprop.git}"

if ! git remote | grep -q '^kiteprop$'; then
  git remote add kiteprop "$KITEPROP_REPO_URL"
  echo "Añadido remoto kiteprop → $KITEPROP_REPO_URL"
else
  git remote set-url kiteprop "$KITEPROP_REPO_URL"
  echo "Remoto kiteprop → $KITEPROP_REPO_URL"
fi

git remote set-url origin "$TEKNO_REPO_URL"
echo "origin → $TEKNO_REPO_URL"

echo ""
echo "Repo canónico Tekno: https://github.com/TeknoAriel/MatchProp"
echo "Si hace falta publicar main:"
echo "  git fetch kiteprop main 2>/dev/null || true"
echo "  git push -u origin main"
echo ""
echo "Copia a Kiteprop solo cuando pidas auditoría:"
echo "  git push kiteprop main"
