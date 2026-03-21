# Configuración puntual (GitHub / Vercel)

**Deploy de código:** automático al merge/push a `main` (Vercel + CI). Ver **`docs/DEPLOY_AUTOMATICO.md`**.

**QA:** probás preview o producción en el navegador; no hace falta correr deploy desde tu máquina.

Esta guía solo lista **secretos y ajustes** que un admin configura **una vez** (o al cambiar proveedores).

---

## 1. CRON_SECRET (ingest automático vía GitHub Actions)

Valor: generar con `openssl rand -hex 32` (quien tenga acceso admin). **Mismo valor** en:

### 1a. GitHub Actions

1. **https://github.com/TeknoAriel/MatchProp/settings/secrets/actions**
2. **New repository secret** → nombre `CRON_SECRET` → pegar valor.

### 1b. Vercel – API

1. Proyecto que deploya `apps/api` → **Environment Variables**
2. `CRON_SECRET` = mismo string → **Production** (y Preview si aplica).

Intervalo entre corridas: variable opcional **`CRON_INGEST_INTERVAL_HOURS`** en el workflow (ver `.github/workflows/cron-ingest.yml`).

---

## 2. Ignored Build Step en Vercel (opcional)

Reduce builds cuando no cambian archivos de esa app:

| App   | Comando sugerido                            |
| ----- | ------------------------------------------- |
| Web   | `bash scripts/vercel-should-build-web.sh`   |
| Admin | `bash scripts/vercel-should-build-admin.sh` |
| API   | `bash scripts/vercel-should-build-api.sh`   |

(En Vercel → proyecto → Settings → Ignored Build Step.)

---

## 3. Merge automático del PR (obligatorio para deploy sin intervención)

- Crear secret **`AUTOMERGE_TOKEN`** (PAT con scope `repo`) — ver **`docs/CONFIGURAR_DEPLOY_AUTOMATICO.md`**
- Branch protection en `main`: 0 aprobaciones requeridas (o el bot no puede mergear)

---

## 4. Redeploy de la API (solo si ves 404 en `/cron/ingest` con código viejo)

1. **Deployments** del proyecto API en Vercel → **Redeploy** del último, **o**
2. Push a `main` que toque `apps/api`.

Probar (reemplazar URL y secret):

```bash
curl -s -X POST "https://TU-API.vercel.app/cron/ingest" \
  -H "Authorization: Bearer TU_CRON_SECRET" \
  -H "Content-Type: application/json"
```

Esperado: **200** y JSON con `ok`, no **404**.

---

## 5. Verificación rápida

| Qué           | Qué revisar                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------ |
| Web           | Carga home y login                                                                               |
| API `/health` | **200**; `status` `ok` o `degraded` según DB                                                     |
| Login         | Email/contraseña, magic link u OAuth según lo habilitado (**no** hay flujo “demo” en producción) |

Smoke (solo si tenés el monorepo y red):

```bash
pnpm smoke:prod
```

---

## Resumen de URLs útiles

| Recurso            | URL                                                              |
| ------------------ | ---------------------------------------------------------------- |
| GitHub secrets     | https://github.com/TeknoAriel/MatchProp/settings/secrets/actions |
| Vercel (proyectos) | dashboard del team → web, admin, api                             |

---

## Manejo de errores (desarrollo / review)

Reglas estrictas para la API: **`docs/PRODUCTION_ERROR_HANDLING.md`**.
