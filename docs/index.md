# MatchProp — Documentación

**Índice de documentación operativa y técnica**

---

## Empezar acá (canon)

| Documento                                            | Para qué                                                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **[MAPA_DOCUMENTACION.md](./MAPA_DOCUMENTACION.md)** | Cómo está organizada la doc (producto vs proyecto vs archivo) y cómo limpiar sin perder el hilo. |
| **[masterplan.md](./masterplan.md)**                 | Definición de producto y Epics (fuente de verdad).                                               |
| **[FOCO_2026.md](./FOCO_2026.md)**                   | Prioridades del trimestre (north star, en foco / fuera de foco).                                 |
| **[PRODUCT_BRIEF.md](./PRODUCT_BRIEF.md)**           | Resumen corto del producto para alinear al equipo.                                               |

---

## Estrategia y planificación

| Documento                                                      | Descripción                                                                |
| -------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [masterplan.md](./masterplan.md)                               | Masterplan v3.0 (frozen) — Epics E1–E8, non-negotiables, DoD               |
| [FOCO_2026.md](./FOCO_2026.md)                                 | Foco trimestral — prioridades explícitas (complementa al masterplan)       |
| [ALINEACION_MASTERPLAN.md](./ALINEACION_MASTERPLAN.md)         | Estado actual vs masterplan — Epics, UX, Settings, deploy, validación      |
| [TAREAS_Y_MEJORAS.md](./TAREAS_Y_MEJORAS.md)                   | Próximas tareas priorizadas y mejoras técnicas                             |
| [alignment-checklist.md](./alignment-checklist.md)             | Checklist alineación Masterplan ↔ repo (estado DONE/PARTIAL/NOT STARTED)   |
| [backlog.md](./backlog.md)                                     | Backlog maestro — Epics, tickets MVP/Next/Later, sprints 8–9               |
| [PLAN_DE_TRABAJO.md](./PLAN_DE_TRABAJO.md)                     | Plan Sprints 1–6 (completado) — hitos, tareas, referencias                 |
| [PLAN_DE_TRABAJO_2026_Q3.md](./PLAN_DE_TRABAJO_2026_Q3.md)     | Plan Q3 2026 (Sprints 7–12) — onboarding, notificaciones, operación        |
| [ASISTENTE_IA_ARQUITECTURA.md](./ASISTENTE_IA_ARQUITECTURA.md) | Asistente de búsqueda: pipeline texto/voz → filtros → feed + LLM opcional  |
| [SPEC_BUSQUEDAS_Y_MATCH.md](./SPEC_BUSQUEDAS_Y_MATCH.md)       | Spec: Búsquedas guardadas, Mis match, Mis alertas (prioridad pre-Sprint 7) |
| [gap-check.md](./gap-check.md)                                 | Auditoría de brechas — gaps funcionales, técnicos, riesgos                 |

---

## Cierre de versión y beta

| Documento                                                                | Descripción                                                 |
| ------------------------------------------------------------------------ | ----------------------------------------------------------- |
| [PLAN_DE_TRABAJO_CIERRE_VERSION.md](./PLAN_DE_TRABAJO_CIERRE_VERSION.md) | Etapas 1–4 cerradas + fase beta (comandos de verificación)  |
| [BETA_PROGRAMA_CIERRE_ETAPA.md](./BETA_PROGRAMA_CIERRE_ETAPA.md)         | Invitar beta: checklist, flujos a probar, canal de feedback |
| [REVISION_FINAL_PRE_DEPLOY.md](./REVISION_FINAL_PRE_DEPLOY.md)           | Checklist antes de cada deploy a producción                 |

---

## Operación y referencias técnicas

| Documento                                                      | Descripción                                                                           |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [repo-map.md](./repo-map.md)                                   | Mapa del repo — scripts, puertos, modelos, endpoints, tests                           |
| [ZONAPROP_XML_FICHA_CAMPOS.md](./ZONAPROP_XML_FICHA_CAMPOS.md) | XML Zonaprop/KiteProp (OpenNavent): tags, `caracteristicas` y mapeo a ficha/amenities |
| [AUDIT_README.md](./AUDIT_README.md)                           | Cómo correr `pnpm audit:verify` (gates locales)                                       |
| [archive/AUDIT_MATCHPROP.md](./archive/AUDIT_MATCHPROP.md)     | Auditoría técnica histórica (archivo)                                                 |
| [DEV.md](./DEV.md)                                             | Desarrollo local — requisitos, comandos, troubleshooting                              |
| [PROD.md](./PROD.md)                                           | Producción — variables de entorno, observabilidad, seguridad                          |
| [SETUP_DEPLOY_SIMPLE.md](./SETUP_DEPLOY_SIMPLE.md)             | Deploy simple — Neon + Vercel, variables, URLs                                        |
| [DEPLOY_CHECKLIST.md](./DEPLOY_CHECKLIST.md)                   | Checklist pre-deploy, deploy, post-deploy                                             |
| [demo.md](./demo.md)                                           | Prueba real solo con navegador — escenario demo 1-click                               |

---

## Sprints y planes históricos (archivo)

Índice: **[archive/README.md](./archive/README.md)**.

| Documento                                                                        | Descripción                       |
| -------------------------------------------------------------------------------- | --------------------------------- |
| [archive/matchprop-sprint1.md](./archive/matchprop-sprint1.md)                   | Sprint 1 — Ingest, feed, swipes   |
| [archive/matchprop-sprint2.md](./archive/matchprop-sprint2.md)                   | Sprint 2 — Assistant, SavedSearch |
| [archive/sprint-feed-integration-ci.md](./archive/sprint-feed-integration-ci.md) | Feed + CI                         |
| [archive/sprint-feed-security-cache.md](./archive/sprint-feed-security-cache.md) | Feed + security + cache           |

## Referencia viva

| Documento                  | Descripción                           |
| -------------------------- | ------------------------------------- |
| [auth-v2.md](./auth-v2.md) | Auth v2 (Magic link, OAuth, passkeys) |
