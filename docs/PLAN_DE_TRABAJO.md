# Plan de trabajo — MatchProp 2026

Plan con **hitos**, **sprints** y **tareas** para los próximos 3 meses. Alineado a [masterplan.md](./masterplan.md), [FOCO_2026.md](./FOCO_2026.md) y [TAREAS_Y_MEJORAS.md](./TAREAS_Y_MEJORAS.md).

**Última actualización:** 2026-03-27

---

## Hitos

| Hito   | Objetivo                     | Sprints     | Fecha aprox. |
| ------ | ---------------------------- | ----------- | ------------ |
| **H1** | Estabilidad y observabilidad | Sprint 1, 2 | Abril 2026   |
| **H2** | Producto y UX                | Sprint 3, 4 | Mayo 2026    |
| **H3** | Monetización y escala        | Sprint 5, 6 | Junio 2026   |

---

## Sprint 1 — Estabilidad CI y Smoke (H1)

**Duración:** 2 semanas  
**Objetivo:** Pipeline verde, smoke en CI, deploy automático probado.

| #   | Tarea                      | DoD                                                                       | Estado                       |
| --- | -------------------------- | ------------------------------------------------------------------------- | ---------------------------- |
| 1.1 | Smoke E2E en CI            | Job `smoke-ux` en CI (opcional o gate); Playwright contra API+Web locales | ✅ Hecho                     |
| 1.2 | Deploy automático validado | PR mergeado a main vía auto-merge; smoke-prod verde                       | En curso (PR #2)             |
| 1.3 | Deprecación Vite CJS       | Resolver warning Vitest; tests sin warnings                               | ✅ Hecho (vitest.config.mts) |
| 1.4 | Punycode                   | Sustituir `punycode` por alternativa userland si Node depreca             | Diferido                     |

**Gates:** `pnpm pre-deploy:verify` verde, smoke:ux pasa, deploy a prod sin errores.

---

## Sprint 2 — Observabilidad y Analytics base (H1)

**Duración:** 2 semanas  
**Objetivo:** trackEvent sin PII, dashboard admin básico.

| #   | Tarea                       | DoD                                                                                                                       | Estado   |
| --- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------- |
| 2.1 | Analytics trackEvent        | Modelo `AnalyticsEvent`, helper `trackEvent()`, eventos: vista listing, guardar búsqueda, activar alerta; sin PII en logs | ✅ Hecho |
| 2.2 | Dashboard analytics (admin) | Vistas básicas: leads por estado, alertas activas, matches recientes; solo lectura                                        | ✅ Hecho |
| 2.3 | Documentar operativa        | PROD.md, ESTABILIDAD_Y_RELEASE actualizados con runbooks mínimos                                                          | ✅ Hecho |

**Gates:** trackEvent integrado en 3+ flujos; admin muestra datos agregados.

---

## Sprint 3 — Virtualización y performance (H2)

**Duración:** 2 semanas  
**Objetivo:** Lista larga fluida, UX pulida.

| #   | Tarea                | DoD                                                                      | Estado   |
| --- | -------------------- | ------------------------------------------------------------------------ | -------- |
| 3.1 | Virtualización lista | feed/list con virtualización (react-window); scroll fluido con 30+ ítems | ✅ Hecho |
| 3.2 | Performance feed     | Lazy load imágenes (loading="lazy"), skeleton en carga                   | ✅ Hecho |
| 3.3 | UX chat/visitas      | Estados vacíos claros (chat, agenda, mis visitas)                        | ✅ Hecho |

**Gates:** Lista con 500+ items sin lag; UX revisada.

---

## Sprint 4 — Portal SEO y descubrimiento (H2)

**Duración:** 2 semanas  
**Objetivo:** Páginas públicas indexables, landing mejorada.

| #   | Tarea                    | DoD                                                                                         | Estado                                |
| --- | ------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------- |
| 4.1 | Meta tags y sitemap      | `generateMetadata` en `/listing/[id]`; `GET /public/listings/*` sin PII; sitemap con fichas | Hecho (medición Lighthouse pendiente) |
| 4.2 | Landing pública          | Página de inicio optimizada para SEO; CTAs claros                                           | Pendiente                             |
| 4.3 | Búsquedas por zona (SEO) | Rutas `/buscar/{zona}` indexables; sin auth                                                 | Hecho                                 |
| 4.4 | Próximo corte SEO        | Ver [TAREAS_Y_MEJORAS.md](./TAREAS_Y_MEJORAS.md) § Sprint 4 siguiente                       | Cola                                  |

**Gates:** Lighthouse SEO > 90; sitemap válido.

---

## Sprint 5 — Monetización B2B (H3)

**Duración:** 2 semanas  
**Objetivo:** Wallet inmobiliarias, pagos por leads.

| #   | Tarea                      | DoD                                                          | Estado    |
| --- | -------------------------- | ------------------------------------------------------------ | --------- |
| 5.1 | Wallet B2B                 | Modelo Wallet, GET /orgs/:id/wallet, top-up; débito por lead | ✅ Existe |
| 5.2 | Kiteprop por etapas        | payloadTemplatePending/Active; leads PENDING sin PII         | ✅ Hecho  |
| 5.3 | Feature flags formalizados | DEMO_MODE=0 obligatorio; checklist PROD.md                   | ✅ Hecho  |

**Gates:** Inmobiliaria puede recargar wallet; lead PENDING no expone datos.

---

## Sprint 6 — Monetización B2C y cierre (H3)

**Duración:** 2 semanas  
**Objetivo:** Premium B2C operativo, Mercado Pago integrado.

| #   | Tarea                | DoD                                                              | Estado    |
| --- | -------------------- | ---------------------------------------------------------------- | --------- |
| 6.1 | Premium B2C (Stripe) | Checkout, webhook, premiumUntil; flujo activación lead           | ✅ Existe |
| 6.2 | Mercado Pago (LATAM) | Integración según MERCADOPAGO_SETUP.md; feature flag             | ✅ Existe |
| 6.3 | Cierre trimestre     | Docs al día; ALINEACION_MASTERPLAN actualizado; smoke prod verde | ✅ Hecho  |

**Gates:** Usuario puede activar premium; MP como opción pago; trimestre cerrado.

---

## Resumen visual

```
Sprint 1 ─── Sprint 2 ─── Sprint 3 ─── Sprint 4 ─── Sprint 5 ─── Sprint 6
   │             │             │             │             │             │
   H1: Estabilidad    H2: Producto/UX         H3: Monetización
   - Smoke CI        - Virtualización        - Wallet B2B
   - Deploy auto     - trackEvent            - Premium B2C
   - Deprecaciones   - Dashboard             - Mercado Pago
                    - SEO portal
```

---

## Reglas de ejecución

1. **Deploy cada fin de sprint:** Commit + push → PR automático → CI verde → auto-merge → Vercel deploy. Ver [.cursor/rules/deploy-automatico.mdc](../.cursor/rules/deploy-automatico.mdc).
2. **Definition of Done:** tests verdes, typecheck, documentación actualizada si aplica.
3. **Prioridad:** Si un sprint se desborda, mover tareas de media a baja prioridad al siguiente.

---

## Plan siguiente

**→ [PLAN_DE_TRABAJO_2026_Q3.md](./PLAN_DE_TRABAJO_2026_Q3.md)** — Sprints 7–12 (Jul–Sep 2026): onboarding, notificaciones, observabilidad, performance, reverse-matching UX, cierre Q3.

---

## Referencias

- [backlog.md](./backlog.md) — Epics E1–E8, deuda técnica
- [TAREAS_Y_MEJORAS.md](./TAREAS_Y_MEJORAS.md) — Cola operativa
- [FOCO_2026.md](./FOCO_2026.md) — Prioridades trimestre
