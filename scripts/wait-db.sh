#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."

echo "Esperando Postgres en localhost:5432..."
for i in $(seq 1 30); do
  if pg_isready -h localhost -p 5432 -U matchprop 2>/dev/null; then
    echo "Postgres listo."
    exit 0
  fi
  if nc -z localhost 5432 2>/dev/null; then
    echo "Puerto 5432 abierto."
    exit 0
  fi
  sleep 1
done
echo "Timeout esperando Postgres."
exit 1
