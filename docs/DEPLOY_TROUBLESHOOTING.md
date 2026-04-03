# Deploy: bloqueos y demoras

Cuando los cambios no llegan a producción o hay demoras, usar este checklist.

## Verificación rápida

```bash
bash scripts/verify-deploy-status.sh
```

Muestra si la rama está en main, si prod responde, y si el commit en prod coincide con main.

Si prod lleva días con un SHA viejo: reconectar Vercel al repo **`kiteprop/ia-matchprop`** y rama **`main`** — ver **[CONECTAR_VERCEL_GITHUB.md](./CONECTAR_VERCEL_GITHUB.md)**. Opcional: Deploy Hooks + workflow `vercel-deploy-hooks.yml`.

### Ignored Build Step (exit codes)

En Vercel, **exit 0 = no construir** y **exit ≠ 0 = construir**. Si los scripts `scripts/vercel-should-build-*.sh` usan la lógica al revés, los deploys de web/API/admin se **saltan** cuando tocás esas carpetas y producción queda años luz de `main`. Ver **[VERCEL_CONFIG.md](./VERCEL_CONFIG.md)**.

### 7. Vercel rechaza el deploy: «Git author must have access to the team» (Hobby)

En planes **Hobby**, Vercel puede **rechazar** deployments (estado `ERROR`, `alwaysRefuseToBuild`, `TEAM_ACCESS_REQUIRED`) si el **autor del commit** (email en Git) **no coincide** con un miembro del team o no está verificado como colaborador del proyecto.

**Síntoma:** `main` avanza pero `/health.version` en prod **no cambia**; en el dashboard el deployment falla con mensaje sobre _Git author_ / _team access_. La CLI puede mostrar `Unexpected error`; con `vercel deploy --debug` la respuesta incluye `readyStateReason`.

**Qué hacer (elegir una):**

1. **Email de Git alineado con Vercel y GitHub** — mismo email en GitHub y en Vercel (Settings → Git):

   ```bash
   git config --global user.email "tu-email-verificado@ejemplo.com"
   ```

   Próximo commit y push usarán ese autor.

2. **Deploy Hooks** — Vercel → Settings → Git → Deploy Hooks (Production). Secretos en GitHub: `VERCEL_DEPLOY_HOOK_API`, `VERCEL_DEPLOY_HOOK_WEB`. El workflow **Vercel deploy hooks** hace `POST` **tras CI verde en `main`** (o manual).

3. **Team / colaboradores** — Invitar al autor del commit al team de Vercel. Ver [troubleshoot collaboration](https://vercel.com/docs/deployments/troubleshoot-project-collaboration#team-configuration).

**Comprobación:** `bash scripts/check-git-author-vercel.sh`

### 8. Propieya vs MatchProp: por qué uno “no falla” y el otro se queda atrás

En **Propieya** (`ia-propieya`), el deploy a producción del portal usa **GitHub Actions + Vercel CLI** (`vercel deploy --prod`) con **`VERCEL_TOKEN`** y **`VERCEL_PROJECT_ID`**, en la rama `deploy/infra` (workflow `promote-deploy-infra.yml`). Ese camino **no depende** del autor del commit en la integración Git→Vercel, así que no aparece el bloqueo Hobby de _Git author / team access_.

En **MatchProp** (`ia-matchprop`), el flujo histórico es **integración Git** (push a `main` → Vercel construye) más **Deploy Hooks** opcionales. Si la integración rechaza el deploy, `main` avanza pero **`/health.version` en prod** queda en un SHA viejo.

**Paridad con Propieya en este repo:** workflow **[vercel-prod-cli.yml](../.github/workflows/vercel-prod-cli.yml)** — se ejecuta **manualmente** (`workflow_dispatch`) o **después de un CI verde en `main`** (`workflow_run`), y despliega con token los proyectos para los que existan secretos `VERCEL_PROJECT_ID_*`. Secretos y nombres canónicos: **[SECRETOS_Y_AUTOMERGE_GITHUB.md](./SECRETOS_Y_AUTOMERGE_GITHUB.md)** §5 y **`scripts/matchprop-production-canonical.env.sh`**.

**Reglas / checks:** Propieya exige en CI jobs separados (`Lint`, `Typecheck`, `Build`). MatchProp condensa un check requerido **`CI / Verify`**; no hace falta igualar los nombres de jobs, sí tener **un** status check estable en la rama protegida.

**Si usás CLI y Git a la vez:** podés tener **dos builds** por push; para ahorrar minutos en Hobby, desactivá el deploy automático por Git en Vercel o usá solo hooks/CLI.

## Ruleset en `main`: checks requeridos

El workflow **CI** expone un solo job obligatorio para reglas de rama: **`CI / Verify`** (typecheck, lint, tests, integración y `pre-deploy:verify` en un solo run).

Si en GitHub seguís exigiendo jobs viejos (`Typecheck`, `Lint`, `Unit tests`, `Integration tests`, `Full build (gate)` por separado), los checks pueden quedar en **“Expected — Waiting for status”** para siempre.

**Qué hacer:** en **Settings → Rules → Rulesets** (rama `main`), reemplazá la lista de status checks requeridos por **`CI / Verify`** (y los de Vercel si los usás). Eliminá los cinco nombres antiguos del mismo workflow.

## Causas habituales

### 1. PR no se mergea (queda abierto con CI verde)

**Causa:** El workflow `pr-automerge-label` usa `GITHUB_TOKEN` que no puede mergear en branches protegidos.

**Solución:** Crear secret `AUTOMERGE_TOKEN` (PAT con scope `repo`) en Settings → Secrets → Actions. Ver `docs/CONFIGURAR_DEPLOY_AUTOMATICO.md`.

El workflow ya está configurado para usar `AUTOMERGE_TOKEN` si existe.

### 2. Branch protection bloquea el merge

**Revisar:** Settings → Branches → main → Edit rule

| Regla                           | Debe estar                         |
| ------------------------------- | ---------------------------------- |
| Require approvals               | **0** (cero)                       |
| Require conversation resolution | Desactivado                        |
| Require status checks           | Los del CI (typecheck, lint, etc.) |

### 3. CI falla

**Revisar:** GitHub Actions → workflow que falló → logs

Errores frecuentes:

- **Lint:** `pnpm lint` y `pnpm format:check` deben pasar. Corregir localmente, commit, push.
- **Typecheck:** Corregir errores de tipos.
- **Tests:** Revisar qué test falla y corregir.
- **Smoke UX (E2E):** Si falla en `/alerts`, puede ser por cambio de texto en la UI. Ej.: la página usa "Mis alertas" pero el test esperaba "Alertas". Ajustar en `apps/web/e2e/smoke-ux.spec.ts` usando regex flexibles (`/Alertas|Mis alertas/`).

**Commits que fallaron en PR #10 (deploy-20260324):**

| Commit    | Descripción                           | Causa del fallo                              | Resolución                                         |
| --------- | ------------------------------------- | -------------------------------------------- | -------------------------------------------------- |
| `4608bf7` | fix(web): alertas con botón Ver…      | Smoke UX: heading "Alertas" vs "Mis alertas" | Test actualizado con regex que acepta ambos textos |
| `0876c1e` | fix(deploy): verificación obligatoria | Smoke UX fallando en commit anterior         | Resuelto con fix de smoke-ux.spec.ts               |

### 4. Múltiples PRs abiertos

Solo un PR puede mergearse a la vez. Si hay varios (ej. fix/error-handling-prod, home-sync, dashboard-deploy), mergear en orden o cerrar los que no correspondan. El agente debe trabajar sobre **una rama a la vez** y esperar a que se mergee antes de crear otro PR con cambios nuevos.

### 5. Vercel tarda en deployar

Tras el merge, Vercel tarda 2-5 minutos. Ejecutar `verify-deploy-status.sh` de nuevo. Si main tiene el commit pero prod no, esperar.

### 6. Prod muestra versión vieja

- Hard refresh en el navegador (Ctrl+Shift+R).
- Verificar que Vercel no haya fallado el build: dashboard de Vercel → Deployments.
- La API expone `version` en `/health` (commit SHA). Comparar con `git rev-parse origin/main`.

## Flujo correcto

1. Commit + push a rama
2. deploy-auto-pr crea/actualiza PR con label automerge
3. CI corre (typecheck, lint, tests, build)
4. Cuando CI pasa, pr-automerge-label hace merge automático
5. Vercel deploya (2-5 min)
6. `verify-deploy-status.sh` debe pasar

## Comandos útiles

```bash
# Ver estado de deploy
bash scripts/verify-deploy-status.sh

# Smoke prod (health + web)
bash scripts/smoke-prod.sh

# Ver último commit en main remoto
git fetch origin main && git log origin/main -1 --oneline

# Ver version en prod
curl -s https://match-prop-admin-dsvv.vercel.app/health | jq .version
```
