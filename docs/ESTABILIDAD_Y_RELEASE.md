# Estabilidad y release

## Gates obligatorios (CI)

En cada push y en cada PR a `main` se ejecuta:

1. **Typecheck** — shared + todos los workspaces + typecheck:vercel (API).
2. **Lint** — ESLint + format:check.
3. **Unit tests** — tests de todos los paquetes.
4. **Integration tests** — API con Postgres en CI.
5. **Build** — solo si 1–4 pasan; ejecuta `pnpm run pre-deploy:verify` (build shared, api, web, admin + test:all API).

Ningún cambio llega a Vercel si alguno de estos falla. El merge a `main` debe hacerse con el PR en verde.

## Smoke post-merge

- Tras un push a `main`, después del job **build** se ejecuta **smoke-prod**: espera 3 minutos (deploy en Vercel) y luego comprueba:
  - `https://match-prop-web.vercel.app` → 200
  - `https://match-prop-admin-dsvv.vercel.app/health` → 200
- Si falla, el run de CI queda en error (revisar Actions y/o prod).

## Smoke programado

- Workflow **Smoke prod (schedule)** corre cada **15 minutos** y hace el mismo chequeo de URLs de prod.
- Si prod está caída, el run queda en error en la pestaña Actions.

## Versión desplegada

- En la app web, en **/status** se muestra **Versión** = commit SHA del deploy (Vercel inyecta `VERCEL_GIT_COMMIT_SHA` en el build).
- Sirve para confirmar que estás viendo el deploy correcto en https://match-prop-web.vercel.app .
- **Admin** (`/stats`): sección **Operación** con métricas de ingest, cron y CRM push (`GET /admin/stats/ops`), enlaces a [OPERABILIDAD_HEALTH.md](./OPERABILIDAD_HEALTH.md) y runbooks.

## Branch protection (recomendado)

En GitHub → Repo → **Settings** → **Rules** → Ruleset **"main"** (o Branch protection para `main`):

1. **Target:** incluir la rama **`main`** (para que el ruleset se aplique).
2. **Enforcement:** **Active** (no Disabled).
3. **Require status checks before merging:** agregar estos checks (pueden aparecer como `CI / <nombre>` o solo `<nombre>`):
   - **Typecheck**
   - **Lint**
   - **Unit tests**
   - **Integration tests**
   - **Full build (gate)**

4. Opcional: **Require branches to be up to date before merging**.

Así no se puede mergear sin que CI pase.

## URL única de pruebas

Siempre probar la app en: **https://match-prop-web.vercel.app/**  
Detalle: [URL_PRUEBAS_Y_PROYECTOS.md](./URL_PRUEBAS_Y_PROYECTOS.md).

## Runbook: Smoke prod falla

Si **smoke-prod** o **Smoke prod (schedule)** falla en GitHub Actions:

1. **Verificar URLs de prod:** `https://match-prop-web.vercel.app` y `https://match-prop-admin-dsvv.vercel.app/health` deben devolver 200.
2. **Verificar Vercel:** Revisar en Vercel Dashboard que los últimos deploys de `main` terminaron correctamente.
3. **Verificar base de datos:** Si la API devuelve 503, revisar `DATABASE_URL` y conexión a PostgreSQL (Neon, etc.).
4. **Re-ejecutar workflow:** En GitHub Actions → re-run failed jobs; a veces es timeout transitorio.

## Runbook: Rollback rápido

Si un deploy introduce errores críticos:

1. **Revert en GitHub:** Crear PR revertiendo el commit problemático y mergear.
2. **Vercel:** Vercel redeploya automáticamente con el nuevo commit en `main`.
3. **Migraciones:** Si el problema es una migración, ejecutar manualmente una migración de rollback (crear nueva migración que revierta cambios) y aplicarla contra prod con `pnpm --filter api exec prisma migrate deploy`.

## Corrección crítica aplicada

- En `apps/web/next.config.ts` la API de producción estaba apuntando a **match-prop-admin**; se corrigió a **match-prop-admin-dsvv.vercel.app** para que el proxy `/api/*` hable con la API real.
