#!/usr/bin/env bash
# Arranque completo: reset, dev-up, test:all, smoke:ux. Al final deja servidores corriendo.
set -e
cd "$(dirname "$0")/.."

echo "=== MatchProp READY ==="

echo "1. dev:up (reset + levantar)..."
pnpm dev:up

echo "2. test:all..."
pnpm --filter api test:all

echo "3. smoke:ux (reinicia servidores)..."
pnpm smoke:ux || { echo "smoke:ux falló"; exit 1; }

echo "4. Levantando servidores para el usuario..."
pnpm dev:up

echo ""
echo "READY ✅"
echo "1) http://localhost:3000/login"
echo "2) http://localhost:3000/feed/list"
echo "3) http://localhost:3000/assistant"
echo "4) http://localhost:3000/leads"
echo "5) http://localhost:3000/settings/integrations/kiteprop"
echo ""
echo "5 pasos de prueba:"
echo "  1) Login (Magic link dev)"
echo "  2) Ir a Feed List y tocar Contactar en una propiedad"
echo "  3) Ver /leads y confirmar que aparece la consulta"
echo "  4) Ir a /assistant, elegir ejemplo, generar búsqueda, ver resultados, guardar"
echo "  5) Ir a /settings/integrations/kiteprop, pegar API key y Enviar lead de prueba"
echo ""
