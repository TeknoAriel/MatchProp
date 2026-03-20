# Variables de entorno — Vercel (Web + API)

## API (proyecto Vercel con Root `apps/api`)

Mínimas para producción:

- `NODE_ENV=production`
- `DATABASE_URL` (Neon)
- `JWT_SECRET` (generar)
- `AUTH_REFRESH_SECRET` (generar)
- `APP_URL` (URL web Vercel)
- `API_PUBLIC_URL` (URL API Vercel)
- `CORS_ORIGINS` (mismo dominio de `APP_URL`)
- `COOKIE_SECURE=true`
- `DEMO_MODE=0`
- `INTEGRATIONS_MASTER_KEY` (generar)

Generación recomendada (en tu Mac):

```bash
openssl rand -base64 32
```

## Web (proyecto Vercel con Root `apps/web`)

- `API_SERVER_URL` = URL pública de la API (Vercel)
- `NEXT_PUBLIC_API_URL` = URL pública de la API (Vercel)
- `NEXT_PUBLIC_PRODUCT_NAME` (opcional)
