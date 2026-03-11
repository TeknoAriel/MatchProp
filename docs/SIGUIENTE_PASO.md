# Siguiente paso — Deploy en vivo

El código ya está en **https://github.com/TeknoAriel/MatchProp**. Para tener la app en producción:

---

## 1. Railway (API + base de datos)

1. Entrá a **https://railway.app** e iniciá sesión (con GitHub).
2. **New Project** → **Deploy from GitHub repo** → elegí **TeknoAriel/MatchProp**.
3. Agregá **PostgreSQL**: en el mismo proyecto, **New** → **Database** → **PostgreSQL**.
4. Copiá la variable **`DATABASE_URL`** del servicio PostgreSQL (Variables).
5. En el servicio que deploya el repo:
   - **Settings** → Root Directory: dejar vacío (raíz).
   - **Settings** → Build: si usa Dockerfile, apuntar a `apps/api/Dockerfile`. Si usa Nixpacks, Build Command: `pnpm install && pnpm build:shared && pnpm --filter api exec prisma generate && pnpm --filter api build`.
   - **Settings** → Start Command: `node apps/api/dist/index.js` (o desde `apps/api`: `node dist/index.js` según cómo arme el build).
   - **Variables**: agregar todas las de la tabla abajo (y `DATABASE_URL` del paso 4).
6. **Deploy**. Cuando termine, copiá la URL pública del servicio (ej: `https://matchprop-api-production-xxx.up.railway.app`).

### Variables mínimas API (Railway)

| Variable | Valor |
|----------|--------|
| `NODE_ENV` | production |
| `PORT` | 3001 |
| `DATABASE_URL` | (copiada de PostgreSQL) |
| `JWT_SECRET` | `openssl rand -base64 32` en tu Mac |
| `AUTH_REFRESH_SECRET` | otro `openssl rand -base64 32` |
| `APP_URL` | (la URL de Vercel del paso 2, ej: https://matchprop.vercel.app) |
| `API_PUBLIC_URL` | (la URL pública del servicio API en Railway) |
| `CORS_ORIGINS` | misma que APP_URL |
| `COOKIE_SECURE` | true |
| `DEMO_MODE` | 0 (o 1 solo para probar con datos demo) |
| `INTEGRATIONS_MASTER_KEY` | `openssl rand -base64 32` |

**Migraciones:** en Railway podés agregar un job o comando único:
`pnpm --filter api exec prisma migrate deploy`
con la misma `DATABASE_URL`.

---

## 2. Vercel (Web)

1. Entrá a **https://vercel.com** e iniciá sesión (con GitHub).
2. **Add New** → **Project** → **Import** → **TeknoAriel/MatchProp**.
3. **Root Directory**: elegí **`apps/web`** (o configurá que el build corra desde raíz; ver `apps/web/vercel.json`).
4. **Environment Variables**:
   - `API_SERVER_URL` = URL pública de la API (la de Railway del paso 1).
5. **Deploy**.

Cuando termine, tenés la web en una URL tipo `https://matchprop-xxx.vercel.app`.

---

## 3. Conectar todo

- En **Railway** (API), actualizá `APP_URL` y `CORS_ORIGINS` con la URL final de Vercel.
- En **Vercel** (Web), si cambiaste algo, asegurate de que `API_SERVER_URL` sea la URL pública de la API.

---

## Resumen

| Dónde | Qué |
|-------|-----|
| GitHub | https://github.com/TeknoAriel/MatchProp (código) |
| Railway | API + PostgreSQL |
| Vercel | Web (Next.js) |

Después de esto, la app queda en producción y podés invitar testers beta con el link de Vercel.
