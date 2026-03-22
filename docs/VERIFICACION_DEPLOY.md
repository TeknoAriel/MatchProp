# Verificación: atrasos de deploy y local vs producción

**Estado:** 2026-03-22

---

## Diferencia actual

| Entorno        | Rama                    | Commits                                                   |
| -------------- | ----------------------- | --------------------------------------------------------- |
| **Local**      | docs-url-canon-20260320 | f0ef737, ee2d542, 70f7d93 (+ SPEC, login, registro, etc.) |
| **Producción** | main                    | f9f29ce (sin esos 3 commits)                              |

**Producción está 3 commits atrás.** Los cambios (SPEC búsquedas/match/alertas, login restaurado, registro, etc.) solo están en la rama, no en main.

---

## Cómo sincronizar

**Mergear PR #3** para que main = docs-url-canon y producción se actualice:

1. **Opción A (manual):** [Abrir PR #3](https://github.com/TeknoAriel/MatchProp/pull/3) → **Merge pull request**

2. **Opción B (automático):** Configurar `AUTOMERGE_TOKEN` (ver `docs/CONFIG_PARA_DEPLOY_AUTOMATICO.md`) para que el PR se mergee solo cuando CI pase.

---

## Workflows

| Workflow                     | Estado      | Nota                                                       |
| ---------------------------- | ----------- | ---------------------------------------------------------- |
| Deploy auto (PR)             | OK          | Crea/actualiza PR con etiqueta automerge                   |
| CI (typecheck, tests, build) | Corre en PR | Requerido para merge                                       |
| cron-ingest                  | Corregido   | Ya no falla cuando la API retorna error (cold start, etc.) |
| Smoke prod                   | OK          | Solo tras merge a main                                     |

---

## Tras el merge

1. Vercel despliega main (web, api, admin).
2. Smoke prod verifica las URLs de producción.
3. Local y producción quedan alineados.

---

## Checklist de alineación

- [ ] PR #3 mergeado a main
- [ ] Vercel deploy completado
- [ ] Probar en https://match-prop-web.vercel.app (login, registro, Mis match, alertas)
