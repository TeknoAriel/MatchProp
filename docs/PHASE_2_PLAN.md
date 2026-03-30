# Plan Fase 2 — Post-beta (MatchProp)

Documento **puente** entre la semana de pruebas con betas y el roadmap detallado. La fuente de verdad de visión y UX sigue siendo [matchprop-masterplan-v3.2.md](./matchprop-masterplan-v3.2.md) y el desglose por sprint en [PLAN_DE_TRABAJO_2026_Q3.md](./PLAN_DE_TRABAJO_2026_Q3.md) (Fase 2 = Q3 2026).

**Última actualización:** 2026-03-29

---

## Objetivo del producto (recordatorio)

MatchProp conecta **oferta y demanda** inmobiliaria: búsqueda activa + descubrimiento (feed/lista) + alertas + funnel de leads **PENDING → ACTIVE** e integración **Kiteprop / CRM**. La Fase 2 refuerza **conversión, retención y operación** sin romper la simplicidad del flujo principal del masterplan.

---

## Criterios “verde” para cerrar beta (Fase 1 operativa)

| Área | Criterio |
|------|----------|
| Calidad | `pnpm build:shared`, `pnpm -r run typecheck`, `pnpm --filter api test:all` verdes |
| Búsqueda | Parser + intérprete alineados a `SearchFilters`; tope **20 átomos** por búsqueda texto/voz (`search-filter-cap`) |
| Admin | Rol `ADMIN` ve **Configuración** (sidebar / header móvil / Más) y `/me/settings` responde |
| Producción | Tras cada entrega: `bash scripts/verify-deploy-status.sh` confirma commit en main y prod |

---

## Pendientes consolidados (entrada a Fase 2)

Tomado de [TAREAS_Y_MEJORAS.md](./TAREAS_Y_MEJORAS.md), [backlog.md](./backlog.md) y [FOCO_2026.md](./FOCO_2026.md):

1. **Especificación búsquedas/match** — Ejecutar [SPEC_BUSQUEDAS_Y_MATCH.md](./SPEC_BUSQUEDAS_Y_MATCH.md) antes del Sprint 7 (Q3).
2. **SEO / descubrimiento** — Landing pública (4.2), Lighthouse, JSON-LD opcional; cola en TAREAS § Sprint 4.
3. **Smoke E2E en CI** — Playwright `smoke:ux` como gate o job obligatorio post-deploy (hoy parcial).
4. **Notificaciones y retención** — Badge unread, email alertas SendGrid, CTAs en `/alerts` (Sprint 8 Q3).
5. **Onboarding** — Primera acción clara (guardar búsqueda / like) en &lt; 2 min (Sprint 7 Q3).
6. **Observabilidad** — Health extendido, panel operativo outbox/cron (Sprint 9 Q3).
7. **Deuda** — Punycode userland, índices DB en queries calientes, rate limit público si crawlers agresivos.
8. **Monetización / B2B** — Wallet y premium ya en roadmap E7; validar en prod con flags y runbooks [PROD.md](./PROD.md).

---

## Plan de trabajo Fase 2 (alineado al masterplan)

| Orden | Bloque | Contenido | Referencia |
|------|--------|-----------|------------|
| 0 | Spec | Alinear UX de búsquedas guardadas, mis match y alertas | SPEC_BUSQUEDAS_Y_MATCH |
| 1 | H4 Crecimiento | Onboarding, funnel `trackEvent`, notificaciones | Q3 Sprints 7–8 |
| 2 | H5 Operación | Health, admin operativo, performance, Lighthouse | Q3 Sprints 9–10 |
| 3 | H6 Avanzado | Reverse-matching UX, pulido monetización B2B/B2C | Q3 Sprints 11–12 |

**Reglas de ejecución:** un cambio por sprint cerrado con deploy automático; DoD = tests + typecheck + documentación tocada actualizada; priorizar [FOCO_2026.md](./FOCO_2026.md) si hay conflicto de scope.

---

## Referencias cruzadas

- [PLAN_DE_TRABAJO.md](./PLAN_DE_TRABAJO.md) — Sprints 1–6 (hitos H1–H3)
- [PLAN_DE_TRABAJO_2026_Q3.md](./PLAN_DE_TRABAJO_2026_Q3.md) — Sprints 7–12 (Fase 2 detallada)
- [ALINEACION_MASTERPLAN.md](./ALINEACION_MASTERPLAN.md) — Estado real vs epics
