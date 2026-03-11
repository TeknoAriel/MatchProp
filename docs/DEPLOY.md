# Deploy a producción — MatchProp

Guía para publicar MatchProp con acceso público y testers beta.

---

## Requisitos previos

- Cuenta en **Vercel** (Web)
- Cuenta en **Railway** o **Fly.io** (API + DB)
- Repo en GitHub/GitLab

---

## 1. Base de datos (PostgreSQL)

### Railway

1. Railway Dashboard → New Project → Add PostgreSQL
2. Copiar `DATABASE_URL` del servicio
3. Variables: conexión lista

### Fly.io / Supabase / Neon

Cualquier PostgreSQL gestionado. Obtener `DATABASE_URL` y usarla en la API.

**Producción:** añadir a la URL:
```
?connection_limit=50&pool_timeout=20
```

---

## 2. API (Fastify)

### Railway

1. New Service → Deploy from GitHub
2. Root Directory: `/` (monorepo)
3. Build Command: `pnpm build:shared && pnpm --filter api exec prisma generate && pnpm --filter api build`
4. Start Command: `node apps/api/dist/index.js`
5. **Variables de entorno:**

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

6. **Migraciones:** ejecutar antes del primer deploy:
   ```bash
   DATABASE_URL="..." pnpm --filter api exec prisma migrate deploy
   ```
   O añadir en Railway: Deploy → Settings → One-Off Command

### Fly.io

1. `fly launch` en la raíz
2. Crear `fly.toml` apuntando al Dockerfile de API
3. `fly secrets set DATABASE_URL=...` (y resto)
4. Migraciones: `fly ssh console` y ejecutar prisma migrate

### Docker

```bash
docker build -f apps/api/Dockerfile -t matchprop-api .
docker run -p 3001:3001 --env-file apps/api/.env matchprop-api
```

---

## 3. Web (Next.js)

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

**Nota:** `vercel.json` en `apps/web` ya incluye los comandos de build para monorepo.

---

## 4. Dominios

- **Web:** `matchprop.com` o `app.matchprop.com` (CNAME a Vercel)
- **API:** `api.matchprop.com` (CNAME a Railway/Fly)

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
- **Railway:** Deployments → Rollback
- **DB:** Restaurar backup pre-migración si aplica
