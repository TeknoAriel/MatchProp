# MatchProp — README para auditoría

Guía mínima para levantar, validar y probar el proyecto.

## Prerrequisitos

Node.js LTS (>= 18), pnpm >= 9, Docker.

## Setup

```bash
pnpm i
```

DB: `docker compose up -d`. Conexión: `postgresql://matchprop:matchprop@localhost:5432/matchprop`.

## Gates

```bash
pnpm audit:verify
```

Ejecuta lint, format:check, typecheck, test:all (API). **Requisito:** Docker con Postgres levantado (`docker compose up -d`) para que los tests de API pasen.

## Demo / Smoke

```bash
pnpm demo:up
```

Levanta DB, API, Web, corre reset+seed+validate y smoke E2E. Para solo levantar sin smoke: `pnpm dev:up`.

## Puertos

- WEB: http://localhost:3000
- API: http://localhost:3001
- Admin: http://localhost:3002 (`pnpm dev:admin`)

## Endpoints clave

- `GET /health`
- `GET /status/listings-count` (DEMO_MODE=1) → { total, bySource }
- `GET /admin/debug/crm-push` → counts, topFailed, nextAttemptAtNearest
- `POST /admin/debug/crm-push/:id/resend`
- `GET /listings/:id/match-summary` (auth)
- `GET /admin/debug/listings/:id/matches` (demo/dev)

## Probar CRM push local (sin internet)

1. `pnpm mock:crm` — mock webhook en http://localhost:9999/webhook
2. `CRM_WEBHOOK_URL=http://localhost:9999/webhook pnpm --filter api crm:push:run`

## ZIP de auditoría

`pnpm audit:pack` → `artifacts/matchprop-audit-YYYYMMDD-<shortsha>.zip`. No incluye node_modules, .next, dist, .env, logs.
