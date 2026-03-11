# MatchProp v1.0 — Paquete de deploy

Este paquete contiene el código y la documentación para implementar MatchProp en producción.

## Primeros pasos

1. **Leer** `docs/GUIA_IMPLEMENTACION_V1.md` — guía paso a paso.
2. **Configurar** variables de entorno (ver `.env.example` en cada app).
3. **Ejecutar** migraciones y build.

## Archivos clave

- `docs/GUIA_IMPLEMENTACION_V1.md` — Guía completa para el implementador
- `docs/PROD.md` — Checklist producción y variables
- `docs/REVISION_FINAL_PRE_DEPLOY.md` — Checklist pre-deploy
- `README.md` — Visión general y scripts
- `INSTRUCCIONES.md` — Cómo probar en local

## Requisitos

- Node.js >= 18
- pnpm >= 9
- PostgreSQL 14+

## Comandos rápidos

```bash
pnpm install
pnpm run deploy:pre   # Migraciones
pnpm build
pnpm --filter api start
pnpm --filter web start
```
