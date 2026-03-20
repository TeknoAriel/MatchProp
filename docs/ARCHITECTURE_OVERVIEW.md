# MatchProp — Architecture Overview

> **Documento principal de arquitectura:** [ARCHITECTURE.md](./ARCHITECTURE.md) (diagramas, módulos, flujos).  
> Esta página es un **resumen de una pantalla** para onboarding rápido.

## Monorepo

- apps/api: Fastify, Prisma, PostgreSQL (puerto 3001)
- apps/web: Next.js, React (puerto 3000), proxy /api -> API
- apps/admin: Next.js (puerto 3002), CRM push UI
- packages/shared: tipos compartidos
- scripts: dev, demo, smoke, audit-verify, audit-pack, mock-crm

## Stack

Backend: Fastify, Prisma, Postgres. Frontend: Next.js, React. E2E: Playwright.

## Demo

docker compose up -d; Prisma migrate + seed; demo:reset-and-seed (500+ listings); demo:validate; DEMO_MODE=1 para API/Web.
