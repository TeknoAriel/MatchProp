# Plan de trabajo — MatchProp Q3 2026 (Fase 2)

Plan posterior a Sprints 1–6. Alineado a [masterplan.md](./masterplan.md), [FOCO_2026.md](./FOCO_2026.md) y [backlog.md](./backlog.md).

**Horizonte:** Julio – Septiembre 2026  
**Última actualización:** 2026-03-21

---

## Bloque previo (prioridad)

**→ [SPEC_BUSQUEDAS_Y_MATCH.md](./SPEC_BUSQUEDAS_Y_MATCH.md)** — Especificación de Búsquedas guardadas, Mis match y Mis alertas. Ejecutar antes de Sprint 7.

---

## Contexto: lo completado (Sprints 1–6)

- **H1:** Smoke CI, Vitest ESM, deploy automático, analytics trackEvent, dashboard admin, runbooks
- **H2:** Virtualización lista, lazy images, estados vacíos chat/visitas, sitemap, meta tags, `/buscar/[zona]`
- **H3:** Wallet B2B, Kiteprop PENDING/ACTIVE, feature flags, Stripe Premium, Mercado Pago, docs cierre

---

## Hitos Q3

| Hito   | Objetivo                  | Sprints       | Fecha aprox.    |
| ------ | ------------------------- | ------------- | --------------- |
| **H4** | Crecimiento y conversión  | Sprint 7, 8   | Julio 2026      |
| **H5** | Operación y escalabilidad | Sprint 9, 10  | Agosto 2026     |
| **H6** | Producto avanzado         | Sprint 11, 12 | Septiembre 2026 |

---

## Sprint 7 — Onboarding y primera acción (H4)

**Duración:** 2 semanas  
**Objetivo:** Nuevos usuarios entienden el valor y completan primera acción (guardar búsqueda o like).

| #   | Tarea                     | DoD                                                                      | Estado    |
| --- | ------------------------- | ------------------------------------------------------------------------ | --------- |
| 7.1 | Tour inicial (opcional)   | Tooltip o modal en primera visita: “Buscá qué querés → te matcheamos”    | Hecho — banner dismissible en `/feed` (`FeedOnboardingTip`) |
| 7.2 | Empty state feed mejorado | Si no hay búsqueda activa: CTA claro a /assistant con mensaje orientador | Hecho — CTAs a Inicio, asistente y filtros; enlaces si se agota el deck |
| 7.3 | Métricas funnel           | trackEvent: `signup_completed`, `first_search_saved`, `first_like`       | Hecho — API `trackEvent` en auth, searches, swipes (ver `analytics.ts`) |

**Gates:** Usuario nuevo llega a guardar búsqueda o like en < 2 min desde signup.

---

## Sprint 8 — Notificaciones y retención (H4)

**Duración:** 2 semanas  
**Objetivo:** Usuario vuelve cuando hay novedades (alertas, matches, respuestas).

| #   | Tarea                             | DoD                                                                            | Estado                                         |
| --- | --------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------- |
| 8.1 | Badge de notificaciones no leídas | Indicador en navbar / Más; GET /me/notifications/unread-count + polling        | Hecho (AppShell)                               |
| 8.2 | Email alertas (SendGrid)          | Envío al crear `AlertDelivery` vía `sendAlertDeliveryEmail`; tests en API      | Hecho — [ALERTAS_EMAIL.md](./ALERTAS_EMAIL.md) |
| 8.3 | Landing alertas                   | CTA en /alerts si no hay suscripciones: “Activá alertas para no perderte nada” | Hecho — banner ámbar + enlaces a búsquedas y asistente |

**Gates:** Usuario con alerta activa recibe aviso de nueva propiedad (in-app o email).

---

## Sprint 9 — Observabilidad y salud operativa (H5)

**Duración:** 2 semanas  
**Objetivo:** Visibilidad de errores, latencias y estado de integraciones.

| #   | Tarea                            | DoD                                                                                | Estado                                                           |
| --- | -------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 9.1 | Health extendido                 | GET /health incluye `ops`: outbox ingest PENDING, último cron ingest, CRM push P/F | Parcial (ver [OPERABILIDAD_HEALTH.md](./OPERABILIDAD_HEALTH.md)) |
| 9.2 | Admin dashboard operativa        | Sección en /stats: CrmPushOutbox (PENDING/FAILED), cron status                     | Pendiente                                                        |
| 9.3 | Alertas Slack/Discord (opcional) | Webhook en smoke-prod fail; documentar en ESTABILIDAD_Y_RELEASE                    | Pendiente                                                        |

**Gates:** Admin puede diagnosticar fallas sin acceder a logs raw.

---

## Sprint 10 — Performance y deuda técnica (H5)

**Duración:** 2 semanas  
**Objetivo:** Base lista para mayor volumen; resolver warnings.

| #    | Tarea               | DoD                                                                                              | Estado                                                          |
| ---- | ------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| 10.1 | Punycode userland   | Sustituir `punycode` por `tr46` o similar; tests verdes                                          | Pendiente                                                       |
| 10.2 | Índices DB críticos | Índice `(status, createdAt, id)` en `Listing` para feed date_desc; ya existían status+lastSeenAt | Parcial — [OPERABILIDAD_HEALTH.md](./OPERABILIDAD_HEALTH.md) §4 |
| 10.3 | Lighthouse score    | Landing y /buscar/[zona]: Performance > 80, SEO > 90                                             | Pendiente                                                       |

**Gates:** Sin warnings punycode; feed con 500+ items fluido.

---

## Sprint 11 — Reverse-matching UX y monetización (H6)

**Duración:** 2 semanas  
**Objetivo:** Inmobiliarias ven valor de “interesados” y flujo de pago B2B claro.

| #    | Tarea                 | DoD                                                                                       | Estado    |
| ---- | --------------------- | ----------------------------------------------------------------------------------------- | --------- |
| 11.1 | Inbox matches (admin) | UI unificada: lista de MatchEvent con filtro por listing/source; link a “Ver interesados” | Pendiente |
| 11.2 | Wallet UI (admin/org) | Si org tiene wallet: mostrar balance, historial, CTA recarga                              | Pendiente |
| 11.3 | Lead PENDING → débito | Documentar flujo: activación lead descontando wallet B2B                                  | Pendiente |

**Gates:** Inmobiliaria con wallet puede activar lead y ver débito.

---

## Sprint 12 — Producto avanzado y cierre Q3 (H6)

**Duración:** 2 semanas  
**Objetivo:** Funcionalidades diferenciales; trimestre cerrado.

| #    | Tarea                        | DoD                                                                              | Estado    |
| ---- | ---------------------------- | -------------------------------------------------------------------------------- | --------- |
| 12.1 | Búsqueda por voz (asistente) | Botón micrófono ya existe; validar flujo E2E y documentar                        | Pendiente |
| 12.2 | Frecuencia alertas           | Opción en AlertSubscription: diaria / cada 6h (default)                          | Pendiente |
| 12.3 | Cierre Q3                    | ALINEACION_MASTERPLAN, FOCO_2026, PLAN_DE_TRABAJO actualizados; smoke prod verde | Pendiente |

**Gates:** Docs al día; features opcionales documentados.

---

## Resumen visual

```
Sprint 7 ─── Sprint 8 ─── Sprint 9 ─── Sprint 10 ─── Sprint 11 ─── Sprint 12
   │              │             │              │              │              │
   H4: Crecimiento   H5: Operación      H6: Producto avanzado
   - Onboarding     - Health extendido  - Inbox matches
   - Notificaciones - Admin operativa   - Wallet UI
   - Métricas       - Deuda técnica     - Frecuencia alertas
```

---

## Prioridad y reglas

1. **Si un sprint se desborda:** mover 1–2 tareas de menor impacto al siguiente.
2. **Deuda técnica:** DT-001 (imágenes) y DT-002 (Meilisearch) quedan para cuando se cumplan triggers (>50K props, búsqueda lenta).
3. **Deploy:** Mantener regla deploy automático al fin de cada sprint (ver [.cursor/rules/deploy-automatico.mdc](../.cursor/rules/deploy-automatico.mdc)).

---

## Referencias

- [PLAN_DE_TRABAJO.md](./PLAN_DE_TRABAJO.md) — Plan original (Sprints 1–6)
- [backlog.md](./backlog.md) — Epics E1–E8, deuda técnica
- [TAREAS_Y_MEJORAS.md](./TAREAS_Y_MEJORAS.md) — Cola operativa
- [FOCO_2026.md](./FOCO_2026.md) — Prioridades producto
