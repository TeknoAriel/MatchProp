#!/usr/bin/env bash
# Mantiene visible la alineación: Git (local / origin / kiteprop) ↔ deploy en producción (API /health.version).
#
# Uso:
#   bash scripts/align-repos-deploy.sh
#   pnpm align:check
#
# Opciones:
#   --sync-local     Tras el reporte, ejecuta sync-local-from-main.sh (stash + pull main)
#   --git-only       Solo Git; no llama a la API (útil sin red o en CI que no debe tocar prod)
#   --no-fetch       No hace git fetch (más rápido; puede mostrar datos viejos)
#
# Códigos de salida:
#   0  Todo alineado (main local = origin/main y prod = origin/main; o rama feature con prod ok)
#   1  Desalineación o error
#
set -e
cd "$(dirname "$0")/.."

DO_FETCH=true
GIT_ONLY=false
SYNC_LOCAL=false

for arg in "$@"; do
  case "$arg" in
    --sync-local) SYNC_LOCAL=true ;;
    --git-only) GIT_ONLY=true ;;
    --no-fetch) DO_FETCH=false ;;
    -h|--help)
      grep '^#' "$0" | head -n 20 | sed 's/^# \?//'
      exit 0
      ;;
  esac
done

short_sha() {
  git rev-parse "$1" 2>/dev/null | cut -c1-12 || echo "?"
}

echo "=== Alineación repo ↔ deploy (MatchProp) ==="
echo ""

if [ "$DO_FETCH" = true ]; then
  echo "→ git fetch origin..."
  git fetch origin main 2>/dev/null || {
    echo "❌ No se pudo hacer fetch de origin. Revisá red y remote."
    exit 1
  }
  if git remote get-url kiteprop &>/dev/null; then
    echo "→ git fetch kiteprop main (opcional)..."
    git fetch kiteprop main 2>/dev/null || echo "  (kiteprop: omitido o sin acceso)"
  fi
fi

MAIN_SHA=$(git rev-parse origin/main 2>/dev/null || echo "")
if [ -z "$MAIN_SHA" ]; then
  echo "❌ No hay origin/main. ¿Configuraste origin?"
  exit 1
fi

HEAD_SHA=$(git rev-parse HEAD)
BRANCH=$(git branch --show-current)

echo "--- Git ---"
echo "  Rama actual:     $BRANCH"
echo "  HEAD local:      $(short_sha HEAD) ($HEAD_SHA)"
echo "  origin/main:     $(short_sha origin/main) ($MAIN_SHA)"

if git remote get-url kiteprop &>/dev/null; then
  if git rev-parse kiteprop/main &>/dev/null; then
    KP=$(git rev-parse kiteprop/main)
    echo "  kiteprop/main:   $(short_sha kiteprop/main) ($KP)"
    if [ "$KP" != "$MAIN_SHA" ]; then
      echo "  ⚠ kiteprop/main ≠ origin/main (auditoría / fork; sincronizar solo cuando corresponda)"
    else
      echo "  ✓ kiteprop/main coincide con origin/main"
    fi
  else
    echo "  kiteprop/main:   (sin ref local; hacé git fetch kiteprop main)"
  fi
else
  echo "  Remoto kiteprop: no configurado (opcional: bash scripts/git-remotes-tekno.sh)"
fi

echo ""

GIT_OK=true
if [ "$BRANCH" = "main" ]; then
  if [ "$HEAD_SHA" = "$MAIN_SHA" ]; then
    echo "✓ main local = origin/main"
  else
    GIT_OK=false
    AHEAD=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo "?")
    BEHIND=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo "?")
    echo "❌ main local ≠ origin/main (ahead=$AHEAD, behind=$BEHIND)"
    echo "   → Para alinear: bash scripts/sync-local-from-main.sh"
    echo "   → Si tu commit falta en GitHub: push a una rama y abrí PR (main suele estar protegida)"
  fi
else
  echo "ℹ No estás en main; se verifica que producción = origin/main (tu rama puede divergir)."
fi

echo ""

if [ "$SYNC_LOCAL" = true ]; then
  if [ "$BRANCH" != "main" ]; then
    echo "❌ --sync-local solo tiene sentido en main. Hacé: git checkout main"
    exit 1
  fi
  echo "=== Ejecutando sync-local-from-main.sh ==="
  bash scripts/sync-local-from-main.sh
  HEAD_SHA=$(git rev-parse HEAD)
  MAIN_SHA=$(git rev-parse origin/main)
  if [ "$HEAD_SHA" = "$MAIN_SHA" ]; then
    echo "✓ Tras sync: main local = origin/main"
    GIT_OK=true
  else
    echo "❌ Tras sync, main local sigue sin coincidir con origin/main"
    exit 1
  fi
fi

if [ "$GIT_ONLY" = true ]; then
  if [ "$BRANCH" = "main" ] && [ "$GIT_OK" != "true" ]; then
    exit 1
  fi
  echo "=== --git-only: omitiendo verificación de producción ==="
  exit 0
fi

echo "--- Producción (API) ---"
if ! bash scripts/verify-deploy-status.sh main; then
  echo ""
  echo "❌ Deploy / producción no alineados con origin/main. Ver mensajes arriba."
  exit 1
fi

if [ "$BRANCH" = "main" ] && [ "$GIT_OK" != "true" ] && [ "$SYNC_LOCAL" != "true" ]; then
  echo ""
  echo "❌ Producción coincide con main remoto, pero tu main local no está alineado con origin/main."
  exit 1
fi

echo ""
echo "✅ Repos y deploy coherentes (según comprobaciones anteriores)."
exit 0
