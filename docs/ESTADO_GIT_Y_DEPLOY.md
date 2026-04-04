# Estado Git y Deploy — Resumen

**Última actualización:** 2026-03-22

> **Para deploy automático sin tu intervención:** configurá una vez siguiendo `docs/CONFIG_PARA_DEPLOY_AUTOMATICO.md`.

---

## Estado actual

| Rama                               | Commit    | Estado                                |
| ---------------------------------- | --------- | ------------------------------------- |
| **docs-url-canon-20260320**        | `70f7d93` | ✅ Pushado a origin. Rama de trabajo. |
| **origin/docs-url-canon-20260320** | `70f7d93` | Sincronizado                          |
| **main** (local)                   | `f9f29ce` | Igual que origin/main                 |
| **origin/main**                    | `f9f29ce` | Protegido: requiere PR                |

---

## Trabajo commiteado (70f7d93)

- SPEC búsquedas/match/alertas implementada
- Login restaurado: botón Volver, Entrar como demo
- Formulario de registro `/register`
- Página Mis match `/me/match`
- Alertas: resultados unificados en `/alerts`
- Dashboard: botones Mis match y Mis alertas
- API: PUT/DELETE searches, GET alerts/deliveries, POST auth/demo
- Typecheck fixes

---

## Siguiente paso: merge a main

**main tiene branch protection** — no se puede push directo. Hay que usar PR:

1. Crear PR: `docs-url-canon-20260320` → `main`
   - https://github.com/kiteprop/ia-matchprop/compare/main...docs-url-canon-20260320

2. Esperar que pasen los checks (5 requeridos)

3. Mergear el PR (manual o auto-merge si está configurado)

---

## Sin atrasos

- Todo el trabajo local está commiteado
- docs-url-canon está pushado
- No hay cambios pendientes (excepto tsconfig.tsbuildinfo que es artefacto)

---

## Comandos útiles

```bash
# Ver estado
git status
git log --oneline -5

# Trabajar en la rama actual
git checkout docs-url-canon-20260320

# Tras merge del PR, actualizar main local
git checkout main
git pull origin main
```
