# Arquitectura — MatchProp

## Vista general

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Web       │────▶│   API       │────▶│  PostgreSQL │
│  (Next.js)  │     │  (Fastify)  │     │             │
│  :3000      │     │  :3001      │     │  :5432      │
└─────────────┘     └─────────────┘     └─────────────┘
       │                    │
       │                    ├── Prisma ORM
       │                    ├── JWT + cookies
       │                    └── Swagger /docs
       │
       └── Proxy /api/* ──▶ API (rewrites Next.js)
```

---

## Monorepo

```
MatchProp/
├── apps/
│   ├── web/          # Next.js 15, App Router, puerto 3000
│   ├── api/          # Fastify, Prisma, puerto 3001
│   ├── admin/        # Next.js admin
│   └── mobile/       # React Native Expo
├── packages/
│   └── shared/       # @matchprop/shared — tipos, utils
├── scripts/
│   ├── dev-up.sh     # Arranque completo (Docker, DB, build, API, Web)
│   ├── deploy-pre.sh # Migraciones pre-deploy
│   └── ...
└── docs/
```

---

## API — Estructura

```
apps/api/src/
├── app.ts            # Fastify, plugins, rutas
├── config.ts         # Env, feature flags
├── index.ts          # Entry
├── routes/           # Endpoints REST
│   ├── auth.ts       # Magic link, OAuth, refresh
│   ├── feed.ts       # Feed principal + /feed/map
│   ├── listings.ts   # Detalle, match-summary
│   ├── swipes.ts     # Like/nope
│   ├── saved.ts      # Favoritos
│   └── ...
├── lib/              # Lógica compartida
│   ├── feed-engine.ts      # Motor del feed (feed + searches)
│   ├── feed-total-cache.ts # Caché in-memory total
│   ├── prisma.ts
│   └── ...
├── plugins/          # authenticate, requireRole
├── services/         # assistant, ingest, mailer, etc.
└── schemas/          # Zod, OpenAPI
```

---

## Web — Rutas principales

| Ruta | Descripción |
|------|-------------|
| `/` | Landing, redirect a /feed si auth |
| `/login` | Magic link, OAuth, Passkey |
| `/feed` | Match tipo Tinder |
| `/feed/list` | Listado clásico |
| `/assistant` | Búsqueda por asistente |
| `/dashboard` | Resumen de búsqueda activa |
| `/me/saved` | Favoritos |
| `/me/profile` | Perfil |
| `/leads` | Consultas enviadas |

---

## Proxy /api

`next.config.ts` reescribe `/api/*` → `API_SERVER_URL/*` (server-side).

- **Dev:** `http://127.0.0.1:3001`
- **Prod:** URL pública de la API (Railway, Fly.io, etc.)

---

## Auth

- **Magic link:** email → token → JWT en cookie
- **OAuth:** Google, Apple, Facebook (requieren config)
- **Passkey:** WebAuthn (crear/verificar)
- **Cookies:** `access_token` (JWT), `refresh_token` (opaque)
- **DEMO_MODE=1:** link de acceso directo sin email (solo dev)

---

## Demo vs producción

| | Demo (DEMO_MODE=1) | Producción (DEMO_MODE=0) |
|---|-------------------|--------------------------|
| Listings demo | ✓ 200 API_PARTNER_1 | ✗ |
| Kiteprop fixture | ✓ | ✗ |
| Link acceso dev | ✓ | ✗ |
| Stripe | Opcional | Requerido para Premium |

---

## Deploy

- **Web:** Vercel (Next.js)
- **API:** Railway, Fly.io o Docker
- **DB:** PostgreSQL (Railway, Supabase, Neon, etc.)

Ver `docs/DEPLOY.md`.
