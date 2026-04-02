# Configuración de Proyectos Vercel - MatchProp

Este documento describe la configuración correcta para los 3 proyectos de Vercel.

## URL única de pruebas

**Para probar la app siempre usá solo:** **https://match-prop-web.vercel.app/**

Detalle y qué hacer cuando no se ven cambios: ver **[URL_PRUEBAS_Y_PROYECTOS.md](./URL_PRUEBAS_Y_PROYECTOS.md)**.  
Gates de CI, smoke y release: **[ESTABILIDAD_Y_RELEASE.md](./ESTABILIDAD_Y_RELEASE.md)**.

---

## Estado de reconexión (checkpoint)

- **Repo:** `git@github.com:kiteprop/ia-matchprop.git` — `main` = producción Git.
- **Vercel:** Los 3 proyectos deben tener **Git** conectado a ese repo, **Production Branch** `main`, **Root** `apps/web` | `apps/admin` | `apps/api`. Guía paso a paso: **[CONECTAR_VERCEL_GITHUB.md](./CONECTAR_VERCEL_GITHUB.md)**.
- **Hooks opcionales:** workflow `vercel-deploy-hooks.yml` + secretos `VERCEL_DEPLOY_HOOK_*` (misma guía).

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

## 1. match-prop-web (Frontend) — URL de pruebas

**URL producción:** https://match-prop-web.vercel.app/

### Settings → General

| Campo                | Valor                             |
| -------------------- | --------------------------------- |
| **Root Directory**   | `apps/web`                        |
| **Framework Preset** | Next.js                           |
| **Build Command**    | _(dejar vacío - usa vercel.json)_ |
| **Install Command**  | _(dejar vacío - usa vercel.json)_ |
| **Output Directory** | _(dejar vacío - default .next)_   |

### Settings → Environment Variables

| Variable                           | Valor                                      |
| ---------------------------------- | ------------------------------------------ |
| `NEXT_PUBLIC_API_URL`              | `https://match-prop-admin-dsvv.vercel.app` |
| `NEXT_PUBLIC_PRODUCT_NAME`         | `MatchProp`                                |
| `NEXT_PUBLIC_PREMIUM_GRACE_PERIOD` | `1`                                        |

### Settings → Git → Ignored Build Step

Comando (solo build cuando cambien web o shared):

```bash
bash scripts/vercel-should-build-web.sh
```

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

| Campo                | Valor                             |
| -------------------- | --------------------------------- |
| **Root Directory**   | `apps/admin`                      |
| **Framework Preset** | Next.js                           |
| **Build Command**    | _(dejar vacío - usa vercel.json)_ |
| **Install Command**  | _(dejar vacío - usa vercel.json)_ |

### Settings → Environment Variables

| Variable              | Valor                                      |
| --------------------- | ------------------------------------------ |
| `NEXT_PUBLIC_API_URL` | `https://match-prop-admin-dsvv.vercel.app` |

### Settings → Git → Ignored Build Step

```bash
bash scripts/vercel-should-build-admin.sh
```

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

| Campo                | Valor                             |
| -------------------- | --------------------------------- |
| **Root Directory**   | `apps/api`                        |
| **Framework Preset** | Other                             |
| **Build Command**    | _(dejar vacío - usa vercel.json)_ |
| **Install Command**  | _(dejar vacío - usa vercel.json)_ |
| **Output Directory** | `.`                               |

### Settings → Environment Variables

| Variable              | Descripción              |
| --------------------- | ------------------------ |
| `DATABASE_URL`        | URL de PostgreSQL (Neon) |
| `JWT_SECRET`          | Secret para JWT          |
| `GROQ_API_KEY`        | API key de Groq          |
| `KITEPROP_LEAD_URL`   | URL de leads Kiteprop    |
| `KITEPROP_LEAD_TOKEN` | Token de autenticación   |
| `SENDGRID_API_KEY`    | (opcional) Para emails   |
| `STRIPE_*`            | (opcional) Para pagos    |
| `MERCADOPAGO_*`       | (opcional) Para pagos    |

### Settings → Git → Ignored Build Step

```bash
bash scripts/vercel-should-build-api.sh
```

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
  "routes": [{ "src": "/(.*)", "dest": "/api/handler" }],
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

### 4. Git e Ignored Build Step (recomendado)

En Settings → Git:

- **Production Branch:** `main`
- **Ignored Build Step:** para que web solo se construya cuando cambie la app de usuario, poné:
  ```bash
  bash scripts/vercel-should-build-web.sh
  ```
  Así, cuando toquemos solo `apps/api` o `apps/admin`, no se re-despliega web y en **match-prop-web.vercel.app** seguís viendo la última versión estable. Cuando toquemos `apps/web` o `packages/shared`, sí se despliega y ves los cambios en la URL única.

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

| Proyecto | URL                                      |
| -------- | ---------------------------------------- |
| Web      | https://match-prop-web.vercel.app        |
| Admin    | https://match-prop-admin.vercel.app      |
| API      | https://match-prop-admin-dsvv.vercel.app |

---

## Notas

- Los 3 proyectos comparten el mismo repositorio GitHub
- Cada push a `main` dispara deploy en los 3 proyectos
- El build de `shared` es prerequisito para `web` y `admin`
- Si un deploy falla, los otros pueden seguir funcionando (son independientes)
