#!/bin/bash
cd "$(dirname "$0")"
echo "=== Iniciando MatchProp ==="
echo "Esperá 2-3 minutos. Se abrirá el navegador cuando esté listo."
echo ""
pnpm iniciar
echo ""
echo "Para cerrar: presioná Ctrl+C o cerá esta ventana."
read -p "Presioná Enter para salir..." || true
