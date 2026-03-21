# Deploy automático (sin pasos manuales en tu máquina)

## Qué ya es automático

1. **Push o merge a `main`**  
   Si los proyectos en Vercel están conectados al repo, cada app (`web`, `admin`, `api`) hace **build y deploy** sola cuando cambian sus rutas (o siempre, según tu configuración de “Ignored Build Step”).

2. **GitHub Actions — workflow `CI`** (`.github/workflows/ci.yml`)  
   En cada PR y en cada push a `main`: typecheck, lint, tests unitarios, tests de integración con Postgres en el runner, y `pre-deploy:verify`.

3. **Después de merge a `main`**  
   El job **Smoke prod** espera un margen y ejecuta `scripts/smoke-prod.sh` contra URLs de producción.

No hace falta correr `pnpm build` ni `vercel` localmente para desplegar: **el pipeline y Vercel lo hacen en la nube**.

## Rol del QA (vos)

- Probar en **preview** (PR) o en **producción** cuando el deploy termina.
- No es necesario ejecutar scripts de deploy en la laptop.

## Merge del PR sin usar terminal

Opciones (elegir una política en el equipo):

1. **Auto-merge en GitHub** (recomendado): en el PR, botón **Enable auto-merge** cuando los checks estén verdes (requiere permisos y branch protection compatible).
2. **Etiqueta + workflow** (`.github/workflows/pr-automerge-label.yml`): al aplicar la etiqueta **`automerge`** en el PR se ejecuta `gh pr merge --squash --auto`. Si el `GITHUB_TOKEN` no puede mergear por branch protection, crear el secret opcional **`AUTOMERGE_TOKEN`** (fine-grained PAT con `contents` + `pull_requests`) y el workflow lo usará en lugar del token por defecto.
3. **Merge manual en la UI de GitHub** (un clic en el navegador, sin terminal).

> El agente en Cursor **no puede** mergear sin credenciales; la automatización del merge depende de **GitHub + permisos** configurados en el repositorio.

## Secretos y variables (una vez, típicamente admin)

- `CRON_SECRET` en GitHub Actions y en Vercel (API) — ver `docs/PASOS_MANUALES_POST_DEPLOY.md`.
- Variables de entorno de negocio (DB, JWT, Stripe, etc.) solo en Vercel / proveedor; no en el código.

## Referencias

- Reglas de errores en API: `docs/PRODUCTION_ERROR_HANDLING.md`
- Pasos puntuales (secretos, URLs): `docs/PASOS_MANUALES_POST_DEPLOY.md`
