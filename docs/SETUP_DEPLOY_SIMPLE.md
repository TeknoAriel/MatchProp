# Setup Deploy — Pasos simples (Neon + Vercel)

Guía mínima para tener Web + API funcionando en producción.

---

## 1. Neon (base de datos)

1. Entra a [neon.tech](https://neon.tech) e inicia sesión
2. **New Project** → nombre `matchprop` (o el que quieras)
3. En **Connection Details**, copia **Connection string** (URI)
4. Añade parámetros de pool: `?connection_limit=20&pool_timeout=20` al final de la URL
   - Ejemplo: `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require&connection_limit=20&pool_timeout=20`
5. **Guarda esa URL** para el paso 2

---

## 2. Migraciones (una vez)

Desde tu máquina, con la `DATABASE_URL` de Neon:

```bash
cd /Users/arielcarnevali/MatchProp
DATABASE_URL="postgresql://..." pnpm --filter api exec prisma migrate deploy
```

---

## 3. Variables en Vercel — Proyecto **API**

Proyecto con Root `apps/api`. Ir a **Settings → Environment Variables**.

| Variable | Valor | Notas |
|----------|-------|-------|
| `DATABASE_URL` | *(URL de Neon del paso 1)* | |
| `JWT_SECRET` | *(generar)* | `openssl rand -base64 32` |
| `AUTH_REFRESH_SECRET` | *(generar)* | `openssl rand -base64 32` |
| `APP_URL` | `https://match-prop-web.vercel.app` | URL del Web |
| `API_PUBLIC_URL` | `https://TU-API.vercel.app` | URL pública de este proyecto API |
| `CORS_ORIGINS` | `https://match-prop-web.vercel.app` | |
| `COOKIE_SECURE` | `true` | |
| `DEMO_MODE` | `0` | o `1` para demo/premium gratuito |
| `INTEGRATIONS_MASTER_KEY` | *(generar)* | `openssl rand -base64 32` |

**Opcional (WebAuthn):** `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`, `WEBAUTHN_ORIGIN` (ver `.env.example`).

---

## 4. Variables en Vercel — Proyecto **Web**

Proyecto con Root `apps/web`. Ir a **Settings → Environment Variables**.

| Variable | Valor |
|----------|-------|
| `API_SERVER_URL` | `https://TU-API.vercel.app` *(misma URL que API_PUBLIC_URL)* |
| `NEXT_PUBLIC_API_URL` | `https://TU-API.vercel.app` |

---

## 5. Redeploy

Después de añadir o cambiar variables:

1. **API:** Deployments → ... en el último deploy → Redeploy
2. **Web:** idem

---

## URLs de referencia

- **Web:** https://match-prop-web.vercel.app
- **API:** Obtenerla del dashboard de Vercel en el proyecto API (p. ej. `https://match-prop-api-xxx.vercel.app`)

---

## Checklist rápido

- [ ] Neon: proyecto creado, `DATABASE_URL` copiada
- [ ] Migraciones ejecutadas (`prisma migrate deploy`)
- [ ] Variables API configuradas en Vercel
- [ ] Variables Web configuradas (`API_SERVER_URL`, `NEXT_PUBLIC_API_URL`)
- [ ] Redeploy de ambos proyectos
