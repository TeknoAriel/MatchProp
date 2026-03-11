# MatchProp v2.0 — Setup y Demo Local

## Requisitos

- Node >= 18 (recomendado 20 LTS)
- Docker (PostgreSQL en localhost:5432)
- pnpm 9

## Comando único para levantar demo

```bash
pnpm start
```

Equivale a `pnpm dev:up`. Ejecuta:

1. Docker (PostgreSQL)
2. Migraciones
3. Seed + demo data (500+ listings)
4. API (puerto 3001)
5. Web (puerto 3000)

## Pasos detallados (primera vez)

```bash
# 1. Instalar dependencias
pnpm install

# 2. Crear .env en API (copiar desde example)
cp apps/api/.env.example apps/api/.env

# 3. Levantar demo
pnpm start
```

## URLs

- Web: http://localhost:3000
- Login: http://localhost:3000/login
- Feed: http://localhost:3000/feed
- Asistente: http://localhost:3000/assistant
- Admin: http://localhost:3002 (levantar con `pnpm dev:admin`)

## Usuario demo

- Email: smoke-ux@matchprop.com
- En login: click "Abrir link de acceso (dev)" para entrar sin email real

## Variables de entorno mínimas (apps/api/.env)

| Variable                   | Requerida | Uso                            |
| -------------------------- | --------- | ------------------------------ |
| DATABASE_URL               | Sí        | PostgreSQL                     |
| JWT_SECRET                 | Sí        | Auth                           |
| APP_URL                    | Sí        | Callbacks                      |
| API_PUBLIC_URL             | Sí        | URLs públicas                  |
| DEMO_MODE                  | Demo      | 1 para demo local              |
| KITEPROP_EXTERNALSITE_MODE | Demo      | "fixture" para datos de prueba |

## Verificación técnica

```bash
pnpm lint
pnpm format:check
pnpm -r typecheck
pnpm --filter api test:all
pnpm build
```

## Apagar servicios

```bash
pnpm dev:down
```
