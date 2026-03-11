# Siguiente paso — Deploy en vivo

El código ya está en **https://github.com/TeknoAriel/MatchProp**. Para tener la app en producción:

---

## 1. Neon (PostgreSQL)

1. Entrá a **https://neon.tech** y creá un proyecto.
2. Copiá `DATABASE_URL`.
3. En tu máquina, aplicá migraciones una vez:

```bash
cd /Users/arielcarnevali/MatchProp
DATABASE_URL="TU_DATABASE_URL_DE_NEON" pnpm --filter api exec prisma migrate deploy
```

Alternativa (script):

```bash
cd /Users/arielcarnevali/MatchProp
DATABASE_URL="TU_DATABASE_URL_DE_NEON" bash scripts/prod-migrate.sh
```

## 2. Vercel (API)

1. Vercel → **Add New → Project** → Importar `TeknoAriel/MatchProp`
2. **Root Directory**: `apps/api`
3. Setear estas variables (Environment Variables):

| Variable | Valor |
|----------|--------|
| `NODE_ENV` | production |
| `PORT` | 3001 |
| `DATABASE_URL` | (copiada de PostgreSQL) |
| `JWT_SECRET` | `openssl rand -base64 32` en tu Mac |
| `AUTH_REFRESH_SECRET` | otro `openssl rand -base64 32` |
| `APP_URL` | (la URL de Vercel del paso 2, ej: https://matchprop.vercel.app) |
| `API_PUBLIC_URL` | (la URL pública de la API en Vercel) |
| `CORS_ORIGINS` | misma que APP_URL |
| `COOKIE_SECURE` | true |
| `DEMO_MODE` | 0 (o 1 solo para probar con datos demo) |
| `INTEGRATIONS_MASTER_KEY` | `openssl rand -base64 32` |

La API queda en una URL tipo: `https://matchprop-api-xxx.vercel.app`.

Checklist de envs: `docs/VERCEL_ENV.md`.

---

## 3. Vercel (Web)

1. Entrá a **https://vercel.com** e iniciá sesión (con GitHub).
2. **Add New** → **Project** → **Import** → **TeknoAriel/MatchProp**.
3. **Root Directory**: elegí **`apps/web`** (o configurá que el build corra desde raíz; ver `apps/web/vercel.json`).
4. **Environment Variables**:
   - `API_SERVER_URL` = URL pública de la API (Vercel API del paso 2).
5. **Deploy**.

Cuando termine, tenés la web en una URL tipo `https://matchprop-xxx.vercel.app`.

---

## 4. Conectar todo

- En **Vercel API**, actualizá `APP_URL` y `CORS_ORIGINS` con la URL final de la Web.
- En **Vercel Web**, asegurate de que `API_SERVER_URL` sea la URL pública de la API.

---

## Resumen

| Dónde | Qué |
|-------|-----|
| GitHub | https://github.com/TeknoAriel/MatchProp (código) |
| Neon | PostgreSQL |
| Vercel | Web (Next.js) + API (Serverless) |

Después de esto, la app queda en producción y podés invitar testers beta con el link de Vercel.
