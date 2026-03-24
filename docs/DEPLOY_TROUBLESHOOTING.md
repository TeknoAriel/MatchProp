# Deploy: bloqueos y demoras

Cuando los cambios no llegan a producción o hay demoras, usar este checklist.

## Verificación rápida

```bash
bash scripts/verify-deploy-status.sh
```

Muestra si la rama está en main, si prod responde, y si el commit en prod coincide con main.

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
