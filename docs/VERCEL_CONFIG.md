# Configuración de Proyectos Vercel - MatchProp

Este documento describe la configuración correcta para los 3 proyectos de Vercel.

## Estado de reconexión (checkpoint)

- **Repo:** `git@github.com:TeknoAriel/MatchProp.git` — `main` al día con `origin/main`.
- **Último commit:** `c84b96d` — chore: unificar imágenes con ListingImage, limpiar código.
- **Vercel:** Los 3 proyectos (web, admin, api) deben estar vinculados a este mismo repo; Root Directory por app: `apps/web`, `apps/admin`, `apps/api`.
- **Imágenes:** Todos los listados usan `ListingImage` con fallback; eliminado `demo-image.ts` y scripts de migración ya ejecutados.

## Estructura del Monorepo

```
MatchProp/
├── apps/
│   ├── web/        → match-prop-web (Next.js - Frontend público)
│   ├── admin/      → match-prop-admin (Next.js - Panel admin)
│   └── api/        → match-prop-api-1jte (Fastify - API)
├── packages/
│   └── shared/     → Tipos compartidos
└── package.json    → Root del monorepo
```

---

## 1. match-prop-web (Frontend)

### Settings → General
| Campo | Valor |
|-------|-------|
| **Root Directory** | `apps/web` |
| **Framework Preset** | Next.js |
| **Build Command** | _(dejar vacío - usa vercel.json)_ |
| **Install Command** | _(dejar vacío - usa vercel.json)_ |
| **Output Directory** | _(dejar vacío - default .next)_ |

### Settings → Environment Variables
| Variable | Valor |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://match-prop-api-1jte.vercel.app` |
| `NEXT_PUBLIC_PRODUCT_NAME` | `MatchProp` |
| `NEXT_PUBLIC_PREMIUM_GRACE_PERIOD` | `1` |

### apps/web/vercel.json
```json
{
  "framework": "nextjs",
  "buildCommand": "cd ../.. && pnpm build:shared && pnpm --filter web build",
  "installCommand": "cd ../.. && pnpm install"
}
```

---

## 2. match-prop-admin (Panel Admin)

### Settings → General
| Campo | Valor |
|-------|-------|
| **Root Directory** | `apps/admin` |
| **Framework Preset** | Next.js |
| **Build Command** | _(dejar vacío - usa vercel.json)_ |
| **Install Command** | _(dejar vacío - usa vercel.json)_ |

### Settings → Environment Variables
| Variable | Valor |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://match-prop-api-1jte.vercel.app` |

### apps/admin/vercel.json
```json
{
  "framework": "nextjs",
  "installCommand": "cd ../.. && pnpm install",
  "buildCommand": "cd ../.. && pnpm build:shared && pnpm --filter admin build"
}
```

---

## 3. match-prop-api-1jte (API)

### Settings → General
| Campo | Valor |
|-------|-------|
| **Root Directory** | `apps/api` |
| **Framework Preset** | Other |
| **Build Command** | _(dejar vacío - usa vercel.json)_ |
| **Install Command** | _(dejar vacío - usa vercel.json)_ |
| **Output Directory** | `.` |

### Settings → Environment Variables
| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | URL de PostgreSQL (Neon) |
| `JWT_SECRET` | Secret para JWT |
| `GROQ_API_KEY` | API key de Groq |
| `KITEPROP_LEAD_URL` | URL de leads Kiteprop |
| `KITEPROP_LEAD_TOKEN` | Token de autenticación |
| `SENDGRID_API_KEY` | (opcional) Para emails |
| `STRIPE_*` | (opcional) Para pagos |
| `MERCADOPAGO_*` | (opcional) Para pagos |

### apps/api/vercel.json
```json
{
  "version": 2,
  "outputDirectory": ".",
  "functions": {
    "api/handler.js": {
      "maxDuration": 60
    }
  },
  "routes": [
    { "src": "/(.*)", "dest": "/api/handler" }
  ],
  "crons": [
    {
      "path": "/cron/ingest",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

---

## Troubleshooting: Error en Deploy de Web

Si `match-prop-web` falla pero `match-prop-admin` funciona:

### 1. Verificar Root Directory
En Vercel → match-prop-web → Settings → General:
- **Root Directory** debe ser exactamente `apps/web`

### 2. Verificar que NO haya overrides
En la misma sección, verificar que:
- **Build Command** esté **vacío** (no override)
- **Install Command** esté **vacío** (no override)

### 3. Verificar Node Version
En Settings → General → Node.js Version:
- Debería ser **20.x** (no 18.x ni 22.x)

### 4. Verificar Git Integration
En Settings → Git:
- Production Branch: `main`
- Ignored Build Step: _(vacío)_

### 5. Forzar Redeploy Limpio
```bash
# Desde el directorio del proyecto
npx vercel --force --prod
```

O desde Vercel UI:
1. Ir a Deployments
2. Click en los 3 puntos del último deploy exitoso
3. Click "Redeploy"
4. Marcar "Redeploy with existing Build Cache" = OFF

---

## URLs de Producción

| Proyecto | URL |
|----------|-----|
| Web | https://match-prop-web.vercel.app |
| Admin | https://match-prop-admin.vercel.app |
| API | https://match-prop-api-1jte.vercel.app |

---

## Notas

- Los 3 proyectos comparten el mismo repositorio GitHub
- Cada push a `main` dispara deploy en los 3 proyectos
- El build de `shared` es prerequisito para `web` y `admin`
- Si un deploy falla, los otros pueden seguir funcionando (son independientes)
