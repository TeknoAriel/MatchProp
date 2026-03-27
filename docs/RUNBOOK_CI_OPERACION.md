# Runbook: CI, PR y producción

## Cierre de cambio (agente)

1. `pnpm build:shared` y `pnpm -r run typecheck` (o el job **CI / Verify** en verde).
2. Push a rama con PR a `main` y etiqueta `automerge`.
3. Tras merge: `bash scripts/verify-deploy-status.sh main` hasta ver producción en el commit de `main`.

## Si el PR no mergea

- Revisar que el check requerido sea **CI / Verify** (no jobs viejos renombrados).
- Si CI corrió solo como **workflow_dispatch**, el workflow **Merge after CI** también intenta mergear en el job `merge-if-ready-dispatch`.
- Si queda **unstable** por Smoke UX (no bloqueante), sigue siendo mergeable salvo conflictos reales.

## Si producción no actualiza

- Esperar 2–3 min (Vercel) y reintentar `verify-deploy-status.sh`.
- Ver `docs/DEPLOY_TROUBLESHOOTING.md` (token `AUTOMERGE_TOKEN`, rulesets).
