#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."

echo "=== MatchProp dev-down ==="

echo "Matando procesos en 3000/3001..."
for port in 3000 3001; do
  pid=$(lsof -ti:$port 2>/dev/null || true)
  if [ -n "$pid" ]; then
    echo "  Puerto $port: pid=$pid"
    kill -9 $pid 2>/dev/null || true
    sleep 1
  fi
done

echo "Docker compose down..."
docker compose down 2>/dev/null || true

echo "Listo."
