# Mapa de documentación — producto, proyecto y archivo

Este documento sirve para **re-enfocar** el repo: qué leer primero, qué mantener vivo y qué puede archivarse sin perder contexto.

---

## Capa 1 — Canon de producto (pocas fuentes)

| Documento                                  | Rol                                                                                                               |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **[masterplan.md](./masterplan.md)**       | **Fuente de verdad** del producto: visión, Epics E1–E8, UX contract, non-negotiables, DoD. Versión “frozen” v3.0. |
| **[FOCO_2026.md](./FOCO_2026.md)**         | **Prioridades del trimestre:** north star, en foco / fuera de foco (no reemplaza al masterplan).                  |
| **[PRODUCT_BRIEF.md](./PRODUCT_BRIEF.md)** | Resumen ejecutivo (1–2 pantallas): qué es, flujos clave, demo/gates. Debe **no contradecir** al masterplan.       |
| **[UX_PRINCIPLES.md](./UX_PRINCIPLES.md)** | Principios de experiencia (complemento al UX contract del masterplan).                                            |

**Regla:** Cualquier feature nueva o cambio de alcance debería actualizar primero **masterplan** (o un ADR si se desvía a propósito) y luego el brief.

---

## Capa 2 — Canon de implementación y operación

| Documento                                                            | Rol                                               |
| -------------------------------------------------------------------- | ------------------------------------------------- |
| **[repo-map.md](./repo-map.md)**                                     | Mapa técnico del monorepo: apps, scripts, tests.  |
| **[DEV.md](./DEV.md)**                                               | Desarrollo local.                                 |
| **[PROD.md](./PROD.md)**                                             | Producción: env, seguridad, demo sources OFF.     |
| **[ESTABILIDAD_Y_RELEASE.md](./ESTABILIDAD_Y_RELEASE.md)**           | Gates CI, smoke prod, release.                    |
| **[URL_PRUEBAS_Y_PROYECTOS.md](./URL_PRUEBAS_Y_PROYECTOS.md)**       | URL única de prueba usuario (web).                |
| **[INFRAESTRUCTURA_VERCEL.md](./INFRAESTRUCTURA_VERCEL.md)**         | Proyectos Vercel ↔ apps (evitar “cruce” de URLs). |
| **[PASOS_MANUALES_POST_DEPLOY.md](./PASOS_MANUALES_POST_DEPLOY.md)** | Secretos y pasos solo en GitHub/Vercel.           |
| **[ARCHITECTURE.md](./ARCHITECTURE.md)**                             | Arquitectura **principal** (diagramas, módulos).  |
| **[ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md)**           | Resumen corto; enlaza al doc principal.           |

---

## Capa 3 — Estado vivo (revisar cada sprint o tras cada release)

| Documento                                                  | Rol                                                                                                          |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **[ALINEACION_MASTERPLAN.md](./ALINEACION_MASTERPLAN.md)** | Tabla Epics vs código/UX **hoy**. Puede quedar desactualizado; conviene fechar la última revisión al inicio. |
| **[TAREAS_Y_MEJORAS.md](./TAREAS_Y_MEJORAS.md)**           | Cola operativa (semanas); evitar duplicar detalle frente a `backlog.md`.                                     |
| **[backlog.md](./backlog.md)**                             | Vista por Epic + Next/Later + deuda técnica (DT-xxx).                                                        |
| **[gap-check.md](./gap-check.md)**                         | Brechas conocidas.                                                                                           |
| **[alignment-checklist.md](./alignment-checklist.md)**     | Checklist masterplan ↔ repo.                                                                                 |

---

## Capa 4 — Archivo / referencia histórica (no bloquean decisiones)

Ubicación: **[archive/](./archive/README.md)** — sprints cerrados, planes de cierre, auditorías largas, guías sustituidas.

Para validación técnica **actual** usar CI, [PROD.md](./PROD.md) y [AUDIT_README.md](./AUDIT_README.md) (script `pnpm audit:verify`), no solo PDFs o informes viejos en archivo.

---

## Gates de calidad (alinear docs con la realidad)

- **CI en GitHub:** ver [.github/workflows/ci.yml](../.github/workflows/ci.yml): typecheck (incl. `prisma generate`), lint + `format:check`, tests unitarios API (sin `*.int.test.ts`), integration + `test:all` con Postgres, build gate (`pre-deploy:verify`).
- **Local estricto:** `pnpm audit:verify` (lint, format, typecheck, `test:all` — **requiere Postgres** y `pnpm --filter api exec prisma generate` si el cliente no está generado).
- **Pre-deploy local/CI gate:** `pnpm run pre-deploy:verify`.

Los documentos que citen solo `audit:verify` o números fijos de tests deberían actualizarse a esta formulación para evitar confusión.

---

## Próximo paso sugerido (re-enfoque producto)

1. **Leer:** `masterplan.md` (Epics + non-negotiables) + `FOCO_2026.md` + `PRODUCT_BRIEF.md`.
2. **Decidir:** ajustar north star / foco en `FOCO_2026.md` si cambia la prioridad del trimestre.
3. **Actualizar:** `ALINEACION_MASTERPLAN.md` con fecha y tabla Epics vs código.
4. **Archivo:** nuevos informes históricos → [archive/](./archive/README.md).
