# Deploy a producción — MatchProp

Guía para publicar MatchProp con acceso público y testers beta.

---

## Requisitos previos

- Cuenta en **Vercel** (Web + API)
- Cuenta en **Neon** (PostgreSQL, free tier)
- Repo en GitHub

---

## 1. Base de datos (PostgreSQL)

### Neon (recomendado)

1. Neon Console → New Project
2. Copiar `DATABASE_URL`
3. Usar esa URL en la API (Vercel)

**Producción:** añadir a la URL:
```
?connection_limit=50&pool_timeout=20
```

---

## 2. API (Fastify) — en Vercel

La API se deploya como **Vercel Serverless Functions** desde `apps/api` (ver `apps/api/vercel.json`).

1. Vercel → **Add New → Project** → Importar repo `TeknoAriel/MatchProp`
2. **Root Directory**: `apps/api`
3. **Environment Variables** (mismas que en `.env.example`, versión prod):

| Variable | Valor |
|----------|-------|
| `NODE_ENV` | production |
| `PORT` | 3001 |
| `DATABASE_URL` | (desde PostgreSQL) |
| `JWT_SECRET` | (generar: `openssl rand -base64 32`) |
| `AUTH_REFRESH_SECRET` | (generar) |
| `APP_URL` | https://tu-dominio.vercel.app |
| `API_PUBLIC_URL` | https://tu-api.railway.app |
| `CORS_ORIGINS` | https://tu-dominio.vercel.app |
| `COOKIE_SECURE` | true |
| `DEMO_MODE` | 0 |
| `INTEGRATIONS_MASTER_KEY` | (generar) |

**Migraciones (Neon):** correr una vez desde tu máquina:

```bash
cd /Users/arielcarnevali/MatchProp
DATABASE_URL="TU_DATABASE_URL_DE_NEON" pnpm --filter api exec prisma migrate deploy
```

---

## 3. Web (Next.js) — en Vercel

### Vercel

1. Importar repo → New Project
2. **Root Directory:** `apps/web`
3. **Framework:** Next.js (auto-detectado)
4. **Build Command:** `cd ../.. && pnpm install && pnpm build:shared && pnpm --filter web build`
5. **Install Command:** `cd ../.. && pnpm install`
6. **Variables de entorno:**

| Variable | Valor |
|----------|-------|
| `API_SERVER_URL` | https://tu-api.railway.app |
| `NEXT_PUBLIC_API_URL` | https://tu-api.railway.app |

7. Deploy

**Nota:** si también deployaste la API en Vercel, la URL será algo como `https://matchprop-api-xxx.vercel.app` y se usa esa en `API_SERVER_URL` / `NEXT_PUBLIC_API_URL`.

**Nota:** `vercel.json` en `apps/web` ya incluye los comandos de build para monorepo.

---

## 4. Dominios

- **Web:** `matchprop.com` o `app.matchprop.com` (CNAME a Vercel)
- **API:** `api.matchprop.com` (CNAME a Vercel)

Actualizar en ambos servicios:
- `APP_URL` = URL de la web
- `API_PUBLIC_URL` = URL de la API
- `CORS_ORIGINS` = URL de la web

---

## 5. Testers beta

### Acceso público

- Sin invitación: cualquiera puede registrarse (Magic Link, OAuth, Passkey)
- Banner beta: opcional en la web ("Estamos en beta, reportá bugs en...")

### Lista de testers

1. Enviar email con link: `https://tu-app.vercel.app/login`
2. Magic Link: ingresan email, reciben link
3. Passkey: crean passkey para acceso rápido

### Datos de prueba

Con `DEMO_MODE=0` no hay listings demo. Opciones:
- Conectar fuentes reales (Kiteprop, etc.)
- O mantener `DEMO_MODE=1` solo para staging interno (no producción pública)

---

## 6. Checklist pre-deploy

- [ ] `DEMO_MODE=0` en API (producción pública)
- [ ] `COOKIE_SECURE=true`
- [ ] `CORS_ORIGINS` con dominio real
- [ ] `JWT_SECRET` y `AUTH_REFRESH_SECRET` únicos
- [ ] Migraciones aplicadas
- [ ] `pnpm pre-deploy:verify` pasa localmente
- [ ] Health check: `GET /health` → 200

---

## 7. Verificación post-deploy

```bash
# Health API
curl https://api.tu-dominio.com/health

# Login web
open https://tu-app.vercel.app/login
```

---

## 8. Rollback

- **Vercel:** Deployments → Promote to Production (anterior)
- **DB:** Restaurar backup pre-migración si aplica
