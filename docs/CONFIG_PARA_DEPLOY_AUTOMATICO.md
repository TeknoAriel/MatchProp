# Configuración para deploy 100% automático

**Hacé esto UNA SOLA VEZ.** Después el agente ejecuta todo sin tu participación.

---

## Checklist (orden recomendado)

| #   | Qué hacer                                                                       | Dónde                                                                                            | Estado |
| --- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------ |
| 1   | Activar **Allow auto-merge** en Pull Requests                                   | [Settings → General → Pull Requests](https://github.com/kiteprop/ia-matchprop/settings)           | [ ]    |
| 2   | Workflow permissions: **Read and write**                                        | [Settings → Actions](https://github.com/kiteprop/ia-matchprop/settings/actions)                   | [ ]    |
| 3   | Crear secret **AUTOMERGE_TOKEN** (PAT con scope `repo`)                         | [Settings → Secrets → Actions](https://github.com/kiteprop/ia-matchprop/settings/secrets/actions) | [ ]    |
| 4   | Branch protection `main`: **0 aprobaciones**, **sin** "conversation resolution" | [Branch protection](https://github.com/kiteprop/ia-matchprop/settings/branches)                   | [ ]    |

---

## Detalle de cada paso

Ver **`docs/SETUP_UNA_VEZ_SIN_INTERVENCION.md`** para instrucciones paso a paso con URLs exactas.

---

## Después de configurar

1. El agente hace **commit + push** a tu branch.
2. El workflow **Deploy auto** crea/actualiza el PR y agrega etiqueta `automerge`.
3. CI corre (typecheck, lint, tests, build, smoke-ux).
4. Cuando CI pasa, el PR se **mergea automáticamente**.
5. Vercel despliega. Smoke-prod verifica.

**No tenés que hacer merge manual** ni ejecutar comandos.

---

## Si algo falla

| Problema             | Solución                                                                    |
| -------------------- | --------------------------------------------------------------------------- |
| PR no se mergea solo | Verificar AUTOMERGE_TOKEN y branch protection (0 aprobaciones)              |
| CI falla             | El agente corrige y vuelve a pushear                                        |
| PR no se crea        | Ejecutar manualmente: Actions → Deploy auto (PR + automerge) → Run workflow |
