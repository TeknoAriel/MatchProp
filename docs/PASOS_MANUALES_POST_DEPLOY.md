# Pasos manuales (lo que debés hacer vos)

Cosas que requieren acceso a GitHub o Vercel. Las URLs son directas para copiar/pegar.

---

## 1. CRON_SECRET (para el ingest automático cada 6 h)

Valor: ver conversación anterior o generar con `openssl rand -hex 32`. Mismo valor en **dos lugares**:

### 1a. GitHub (para que el workflow pueda llamar a la API)

1. Ir a: **https://github.com/TeknoAriel/MatchProp/settings/secrets/actions**
2. Clic en **"New repository secret"**
3. Nombre: `CRON_SECRET`
4. Valor: pegar el string que generaste
5. Clic en **"Add secret"**

### 1b. Vercel – API (para que la API valide el token)

1. Ir a: **https://vercel.com/teknoariels-projects/match-prop-api-1jte/settings/environment-variables**
   - (Si el proyecto tiene otro nombre, buscá el que deploya `apps/api`)
2. Agregar variable:
   - **Name:** `CRON_SECRET`
   - **Value:** el mismo string que pusiste en GitHub
   - **Environment:** Production (y Preview si querés)
3. Guardar. Si hacés deploy, esperá a que termine.

---

## 2. Ignored Build Step en Vercel (opcional)

Evita deploys innecesarios cuando no cambian archivos del proyecto.

### 2a. Web

1. Ir a: **https://vercel.com/teknoariels-projects/match-prop-web/settings/general**
2. Buscar **"Ignored Build Step"** (o "Build Command" / configuración de build)
3. En el campo de "Ignored Build Step Command", poner:

   ```bash
   bash scripts/vercel-should-build-web.sh
   ```

   (O el path relativo correcto si tu repo tiene otra estructura.)

### 2b. Admin

1. Ir a: **https://vercel.com/teknoariels-projects/match-prop-admin/settings/general**
2. En "Ignored Build Step Command":

   ```bash
   bash scripts/vercel-should-build-admin.sh
   ```

### 2c. API

1. Ir a: **https://vercel.com/teknoariels-projects/match-prop-api-1jte/settings/general**
2. En "Ignored Build Step Command":

   ```bash
   bash scripts/vercel-should-build-api.sh
   ```

---

## 3. PR #1 (ruleset verify)

Si el PR era solo para validar el ruleset:

1. Ir a: **https://github.com/TeknoAriel/MatchProp/pull/1**
2. Si los checks pasaron, hacer **"Merge pull request"**
3. Si era solo de prueba y no querés mergear, **"Close pull request"**

---

## 4. Redeploy de la API (si `/cron/ingest` devuelve 404)

La ruta `/cron/ingest` existe en el código pero puede que el deploy actual de la API sea anterior. Si al probar el cron ves 404:

1. Ir a: **https://vercel.com/teknoariels-projects/match-prop-api-1jte/deployments**
2. Clic en los tres puntos del último deployment → **"Redeploy"**
3. O hacer push a `main` tocando `apps/api` para forzar un nuevo deploy

Verificar después:
```bash
curl -s -X POST "https://match-prop-admin-dsvv.vercel.app/cron/ingest" -H "Authorization: Bearer TU_CRON_SECRET" -H "Content-Type: application/json"
```

Debe devolver 200 y JSON con `ok`, no 404.

---

## 5. Verificar que todo funciona

| Qué | URL | Qué revisar |
|-----|-----|-------------|
| Web | https://match-prop-web.vercel.app | Carga la home |
| API health | https://match-prop-admin-dsvv.vercel.app/health | 200 y `{"status":"ok",...}` |
| Login | https://match-prop-web.vercel.app/login | "Entrar con link demo" funciona |

Smoke desde tu máquina:

```bash
pnpm smoke:prod
```

---

## Resumen de URLs clave

| Recurso | URL |
|---------|-----|
| GitHub secrets | https://github.com/TeknoAriel/MatchProp/settings/secrets/actions |
| Vercel API env | https://vercel.com/teknoariels-projects/match-prop-api-1jte/settings/environment-variables |
| Vercel Web | https://vercel.com/teknoariels-projects/match-prop-web |
| Vercel Admin | https://vercel.com/teknoariels-projects/match-prop-admin |
| PR #1 | https://github.com/TeknoAriel/MatchProp/pull/1 |
| Vercel API deployments | https://vercel.com/teknoariels-projects/match-prop-api-1jte/deployments |
