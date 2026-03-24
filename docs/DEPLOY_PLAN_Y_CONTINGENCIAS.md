# Plan de deploy y contingencias

## ¿Podemos seguir trabajando?

**Sí.** El problema no fue “no poder desarrollar”, sino **cómo se mergea a `main`**: el *ruleset* de GitHub exige checks concretos y, con **strict**, la rama del PR debe estar **al día con `main`**. Mientras tanto, podés:

- Trabajar en **ramas de feature** (`fix/…`, `feat/…`) y abrir PRs a `main`.
- Usar una rama tipo **`deploy-…`** solo si querís el flujo automático (PR + `automerge`); antes de pedir merge final, **mergeá `main` en esa rama** (o rebase) para no quedar `behind`.

---

## Reglas de deploy (recomendadas)

| Regla | Motivo |
|--------|--------|
| **Todo a `main` vía PR** | Historial, revisión y CI único. |
| **Antes de mergear un PR largo:** `git merge origin/main` en tu rama y push | Evita `mergeable: unstable` y cumple *strict* del ruleset. |
| **Secret `AUTOMERGE_TOKEN`** en el repo | Sin PAT, el bot no puede mergear en `main` protegido. Ver `docs/CONFIGURAR_DEPLOY_AUTOMATICO.md`. |
| **Un PR de deploy activo** o cerrar los viejos | Varias ramas “deploy” abiertas generan confusión y colas. |
| **Tras merge a `main`:** esperar 2–5 min y revisar `/health` | Confirma commit en prod (`version` = SHA). |

### Reglas del repo en GitHub (no duplicar aquí)

- **Ruleset “Main”**: checks obligatorios (Typecheck, Lint, Unit tests, Integration tests, Full build) y política **strict** (rama actualizada con `main`).
- Si **strict** genera demasiada fricción, el dueño del repo puede **relajar** “require up to date” en el ruleset (trade-off: más riesgo de conflictos en `main`).

---

## Plan de contingencias

### A. El PR no mergea (botón gris / “Checks pending” / `unstable`)

1. **Pestaña Checks** del PR: ver qué job falla o no corre.
2. **Sincronizar con `main`** en la rama del PR:
   ```bash
   git fetch origin && git checkout TU-RAMA && git merge origin/main && git push
   ```
3. **Secret `AUTOMERGE_TOKEN`** correcto → Actions → `Manual merge PR` con el número de PR.
4. Si tenés permisos de admin y es urgente: `gh pr merge N --squash --admin` (solo si la política lo permite).

### B. CI no se dispara en el último commit

- Push vacío: `git commit --allow-empty -m "ci: re-disparar" && git push`.
- O **Re-run jobs** en el último workflow de CI que exista para esa rama.

### C. Producción mal pero `main` estable

- **Vercel** → proyecto → **Deployments** → **Promote** a un deploy anterior conocido bueno.
- Revisar logs de función y `/health`.

### D. GitHub Actions caído o colgado

- Merge **manual** en la UI del PR (si checks ya están verdes localmente no aplica; hay que esperar checks en GitHub si el ruleset los exige).
- Último recurso: **merge local** a `main` y `git push origin main` solo si la protección de rama lo permite (muchas veces **no**).

### E. Auto-merge / etiqueta `automerge` no hace nada

- La etiqueta **no sustituye** los checks obligatorios ni el *strict*.
- Hay que cumplir ruleset + opcionalmente **`AUTOMERGE_TOKEN`**.

---

## Verificación rápida

```bash
bash scripts/verify-deploy-status.sh
curl -s https://match-prop-admin-dsvv.vercel.app/health
```

`version` en `/health` debe coincidir con `git rev-parse origin/main` tras un deploy correcto.

---

## Resumen en una línea

**Seguir trabajando en ramas → PR a `main` → antes de merge final, traer `main` a la rama; si se traba, usar contingencia A o B; si prod falla, C.**
