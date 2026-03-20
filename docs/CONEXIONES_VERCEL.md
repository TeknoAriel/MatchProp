# Conexiones Vercel — verificación post-deploy

## URLs de producción

| Servicio   | URL                                           |
| ---------- | --------------------------------------------- |
| Web        | https://match-prop-web.vercel.app             |
| API        | https://match-prop-api-1jte.vercel.app        |
| Login      | https://match-prop-web.vercel.app/login       |
| API Health | https://match-prop-api-1jte.vercel.app/health |

## Flujo de conexión

1. **Usuario → Web**  
   El usuario abre la Web en `match-prop-web.vercel.app`. La Web se construye con `next build` (root `apps/web`).

2. **Web → API (server-side)**  
   Las peticiones desde el servidor Next (fetch a `/api/*`) se reescriben a `API_SERVER_URL` (o fallback `match-prop-api-1jte.vercel.app`).  
   Variable en **Web (Vercel):** `API_SERVER_URL=https://match-prop-api-1jte.vercel.app`

3. **Navegador → API**  
   El cliente puede llamar a `/api/*` (proxy de la Web) o, si se usa `NEXT_PUBLIC_API_URL`, a la API directa.  
   Variable en **Web:** `NEXT_PUBLIC_API_URL=https://match-prop-api-1jte.vercel.app` (opcional; el proxy usa `API_SERVER_URL`).

4. **API → DB**  
   La API usa `DATABASE_URL` (Neon) en el proyecto **API** en Vercel.

5. **API → Web (CORS / callbacks)**  
   La API debe permitir el origen de la Web y usar la URL de la Web en links/callbacks.  
   Variables en **API (Vercel):**
   - `CORS_ORIGINS=https://match-prop-web.vercel.app`
   - `APP_URL=https://match-prop-web.vercel.app`
   - `API_PUBLIC_URL=https://match-prop-api-1jte.vercel.app`

## Checklist variables (Vercel Dashboard)

### Proyecto API (Root: `apps/api`)

- [ ] `DATABASE_URL` (Neon, producción)
- [ ] `JWT_SECRET`
- [ ] `AUTH_REFRESH_SECRET`
- [ ] `APP_URL` = `https://match-prop-web.vercel.app`
- [ ] `API_PUBLIC_URL` = `https://match-prop-api-1jte.vercel.app`
- [ ] `CORS_ORIGINS` = `https://match-prop-web.vercel.app`
- [ ] `COOKIE_SECURE` = `true`
- [ ] `DEMO_MODE` = `0` (o `1` para demo)
- [ ] `INTEGRATIONS_MASTER_KEY` (si usás integraciones)

### Proyecto Web (Root: `apps/web`)

- [ ] `API_SERVER_URL` = `https://match-prop-api-1jte.vercel.app`
- [ ] `NEXT_PUBLIC_API_URL` = `https://match-prop-api-1jte.vercel.app` (opcional; hay fallback en `next.config.ts`)

## Verificación rápida post-deploy

1. **API responde**  
   `curl -s https://match-prop-api-1jte.vercel.app/health` → 200 y JSON con `status`.

2. **Web carga**  
   Abrir https://match-prop-web.vercel.app → página de inicio o login.

3. **Login**  
   Ir a /login, usar magic link o email + contraseña (admins: ariel@kiteprop.com / KiteProp123).

4. **Proxy Web → API**  
   Con la Web abierta, iniciar sesión o cargar el feed; las llamadas a `/api/*` deben ir a la API sin errores de CORS (el proxy las hace server-side).

## Si el deploy falla en Vercel

- Revisar el **build log** del proyecto que falló (API o Web).
- **API:** el build es `pnpm install` (raíz) + `build:shared` + `prisma generate` + `pnpm --filter api build`. Fallos típicos: falta `DATABASE_URL` para Prisma, o error en `tsc`.
- **Web:** el build es `pnpm install` + `build:shared` + `pnpm --filter web build`. Fallos típicos: dependencias o typecheck.
- Asegurarse de que en **Project Settings** el **Root Directory** sea `apps/api` o `apps/web` según el proyecto.
