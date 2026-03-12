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

**WebAuthn (producción):** `WEBAUTHN_RP_ID=match-prop-web.vercel.app`, `WEBAUTHN_RP_NAME=MatchProp`, `WEBAUTHN_ORIGIN=https://match-prop-web.vercel.app` (ya configurados vía CLI).

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
- **API:** https://match-prop-api-1jte.vercel.app

---

## Variables desde CLI (opcional)

Con Vercel CLI instalado y `vercel login`:

```bash
# Linkear (una vez por app)
cd apps/api && vercel link --yes --scope teknoariels-projects --project match-prop-api-1jte
cd apps/web && vercel link --yes --scope teknoariels-projects --project match-prop-web

# Agregar variable (ejemplo)
echo "valor" | vercel env add NOMBRE_VAR production

# Traer variables a .env.local
cd apps/api && vercel env pull .env.local
cd apps/web && vercel env pull .env.local --yes
```

---

## Checklist rápido

- [x] Neon: proyecto creado, `DATABASE_URL` configurada
- [x] Migraciones ejecutadas (`prisma migrate deploy`)
- [x] Variables API configuradas en Vercel
- [x] Variables Web configuradas (`API_SERVER_URL`, `NEXT_PUBLIC_API_URL`)
- [x] Redeploy: push a `main` dispara deploy automático de API y Web

---

## Validación rápida

- **Web:** https://match-prop-web.vercel.app (debe cargar la home)
- **API health:** https://match-prop-api-1jte.vercel.app/health (siempre 200; `status`: `ok` o `degraded`; `db: "error"` puede ser cold start de Neon)

**Deploy preview:** al hacer push a una rama distinta de `main`, Vercel crea un deploy de preview. Para que la API en preview tenga DB y auth, duplicar en Vercel las variables de Production en el entorno Preview (Settings → Environment Variables → cada variable → editar → marcar Preview).

**Verificación rápida en local:** `pnpm smoke:prod` (curl a Web + API/health en producción).

**Magic link (login):** Con `DEMO_MODE=1` la API no envía email real (solo consola). Tras "Enviar link a mi email" debe aparecer el botón **"Abrir link de acceso (dev)"**; usá ese botón para entrar. Si ves "Error. Intentá de nuevo.", el deploy puede estar en cold start — esperá unos segundos y volvé a intentar.
