# Infraestructura Vercel - MatchProp

> Última actualización: 2026-03-18
> Estado: ✅ **OPERATIVO**

## Resumen de Proyectos

| Proyecto | URL Producción | Root Directory | Framework | Estado |
|----------|---------------|----------------|-----------|--------|
| **match-prop-api-1jte** | `https://match-prop-admin-dsvv.vercel.app` | `apps/api` | Other | ✅ OK |
| **match-prop-web** | `https://match-prop-web.vercel.app` | `apps/web` | Next.js | ✅ OK |
| **match-prop-admin** | `https://match-prop-admin.vercel.app` | `apps/admin` | Next.js | ✅ OK |

## Repositorio GitHub

- **URL**: `https://github.com/TeknoAriel/MatchProp`
- **Branch principal**: `main`
- **Monorepo**: pnpm workspaces

---

## Configuración API (`apps/api`)

### vercel.json

```json
{
  "version": 2,
  "outputDirectory": ".",
  "functions": {
    "api/handler.js": {
      "maxDuration": 30
    }
  },
  "routes": [
    { "src": "/(.*)", "dest": "/api/handler" }
  ]
}
```

### Build Process

1. Vercel detecta `vercel-build` script en `package.json`
2. Ejecuta: `cd ../.. && pnpm build:shared && cd apps/api && prisma generate && tsc`
3. Esto compila `@matchprop/shared`, genera el cliente Prisma, y compila TypeScript a `dist/`
4. El handler JavaScript (`api/handler.js`) importa el app compilado desde `dist/`

### Arquitectura del Handler

```
apps/api/
├── api/
│   └── handler.js      # Entry point Vercel (JavaScript, importa dist/)
├── src/
│   ├── app.ts          # Fastify app (TypeScript)
│   ├── routes/         # Todas las rutas
│   ├── services/       # Lógica de negocio
│   └── lib/            # Utilidades
├── dist/               # Código compilado (generado por tsc)
└── prisma/
    └── schema.prisma   # Schema de BD
```

El `handler.js` recibe TODAS las requests y las inyecta en Fastify:
- Extrae el path de `x-vercel-original-url` o `req.url`
- Quita el prefijo `/api` si existe
- Usa `app.inject()` para ejecutar la ruta en Fastify

### Variables de Entorno Requeridas (API)

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host/db` |
| `JWT_SECRET` | Secreto para JWT | `openssl rand -base64 32` |
| `AUTH_REFRESH_SECRET` | Secreto para refresh tokens | `openssl rand -base64 32` |
| `APP_URL` | URL del frontend | `https://match-prop-web.vercel.app` |
| `API_PUBLIC_URL` | URL pública de la API | `https://match-prop-admin-dsvv.vercel.app` |
| `CORS_ORIGINS` | Orígenes permitidos | `https://match-prop-web.vercel.app` |
| `COOKIE_SECURE` | Cookies solo HTTPS | `true` |
| `INTEGRATIONS_MASTER_KEY` | API key integraciones | `openssl rand -base64 32` |

---

## Configuración Web (`apps/web`)

### next.config.ts

El frontend usa rewrites para proxy de `/api/*` hacia la API:

```typescript
const apiServerUrl =
  process.env.API_SERVER_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.VERCEL ? 'https://match-prop-admin-dsvv.vercel.app' : 'http://127.0.0.1:3001');

// Rewrites
{ source: '/api/:path*', destination: `${apiServerUrl}/:path*` }
```

### Variables de Entorno Requeridas (Web)

| Variable | Descripción | Valor Producción |
|----------|-------------|------------------|
| `API_SERVER_URL` | URL de la API (server-side) | `https://match-prop-admin-dsvv.vercel.app` |
| `NEXT_PUBLIC_API_URL` | URL de la API (cliente) | `https://match-prop-admin-dsvv.vercel.app` |

---

## Endpoints de Verificación

### Health Check
```bash
curl https://match-prop-admin-dsvv.vercel.app/health
# {"status":"ok","timestamp":"2026-03-18","db":"ok"}
```

### Status Connect (diagnóstico)
```bash
curl https://match-prop-admin-dsvv.vercel.app/status/connect
# {"ok":true,"path":"/status/connect","method":"GET","api":"match-prop-api"}
```

### Root
```bash
curl https://match-prop-admin-dsvv.vercel.app/
# {"message":"MatchProp API","docs":"/docs"}
```

### Swagger Docs
```
https://match-prop-admin-dsvv.vercel.app/docs
```

---

## Troubleshooting

### Error: "DEPLOYMENT_NOT_FOUND"
- El proyecto de Vercel no está conectado al repo de GitHub
- Solución: Settings → Git → Connect Repository

### Error: "No Output Directory named 'public'"
- El `vercel.json` no tiene `outputDirectory` configurado
- Solución: Agregar `"outputDirectory": "api"` en vercel.json

### Error: "Cannot find module '@matchprop/shared'"
- El script `vercel-build` no está ejecutándose
- Solución: Verificar que `package.json` tenga el script `vercel-build`

### Error: "Cannot find module '@prisma/client'"
- El cliente Prisma no se generó antes del build
- Solución: `vercel-build` debe incluir `prisma generate`

### Health devuelve `"db":"error"`
- Falta la variable `DATABASE_URL` en Vercel
- Solución: Settings → Environment Variables → Agregar DATABASE_URL

---

## Deploy Manual

```bash
# Desde la raíz del monorepo
git add -A
git commit -m "feat: descripción del cambio"
git push origin main
```

Vercel detecta el push y despliega automáticamente los proyectos conectados.

---

## Estructura del Monorepo

```
MatchProp/
├── apps/
│   ├── api/          # Fastify API (Vercel Serverless)
│   ├── web/          # Next.js Frontend
│   ├── admin/        # Next.js Admin Panel
│   └── mobile/       # React Native (Expo)
├── packages/
│   └── shared/       # Código compartido
├── docs/             # Documentación
├── scripts/          # Scripts de utilidad
├── package.json      # Root package.json
└── pnpm-workspace.yaml
```

---

## Comandos Útiles

```bash
# Desarrollo local
pnpm dev:api          # API en localhost:3001
pnpm dev:web          # Web en localhost:3000
pnpm dev              # Todos en paralelo

# Build
pnpm build            # Build de todos los packages
pnpm build:shared     # Solo shared

# Prisma
pnpm --filter api prisma:generate   # Generar cliente
pnpm --filter api prisma:migrate    # Migraciones

# Tests
pnpm --filter api test              # Tests de API
```
