# Sprint: Fases 1, 2, 3 y 4

**Objetivo:** Completar documentación (Fase 1), calidad (Fase 2), mapa bounds (Fase 3) y monetización (Fase 4).

**Referencia:** plan-completamiento-100.md, masterplan v3.0, fase-4-monetizacion.md.

---

## Fase 1 — Documentación

| ID  | Tarea                                           | Estado | Criterio de done                                                                     |
| --- | ----------------------------------------------- | ------ | ------------------------------------------------------------------------------------ |
| 1.1 | Documentar ListingDTO / kiteprop-listing-fields | [x]    | kiteprop-listing-fields.md con contrato GET /listings/:id y mapeo Kiteprop → Listing |
| 1.2 | PROD.md: "Demo sources OFF en prod"             | [x]    | Ya existe sección explícita                                                          |
| 1.3 | PROD.md: dónde se leen feature flags            | [x]    | Ya indica apps/api/src/config.ts                                                     |

---

## Fase 2 — Calidad

| ID  | Tarea                                   | Estado | Criterio de done                                           |
| --- | --------------------------------------- | ------ | ---------------------------------------------------------- |
| 2.1 | Smoke: test chat+visits con lead ACTIVE | [x]    | smoke-ux.spec.ts ya cubre chat + visits tras demo 1-click  |
| 2.2 | Virtualización lista larga              | [x]    | react-window FixedSizeList en /feed/list cuando items > 50 |
| 2.3 | Healthcheck con chequeo DB              | [x]    | GET /health ya verifica prisma.$queryRaw SELECT 1          |

---

## Fase 3 — Mapa bounds → feed

| ID  | Tarea                                            | Estado | Criterio de done                                        |
| --- | ------------------------------------------------ | ------ | ------------------------------------------------------- |
| 3.1 | API feed: aceptar minLat, maxLat, minLng, maxLng | [x]    | Filtrar listings por bounds en GET /feed y /feed/map    |
| 3.2 | UI mapa: enviar bounds al feed                   | [x]    | /search/map pasa bounds en moveend (debounce) y refetch |

---

## Fase 4 — Monetización

| ID  | Tarea                                      | Estado | Criterio de done                                                  |
| --- | ------------------------------------------ | ------ | ----------------------------------------------------------------- |
| 4.1 | Stripe B2C                                 | [x]    | POST /me/checkout-session, webhook, premiumUntil ya implementados |
| 4.2 | API GET /orgs/:orgId/wallet                | [ ]    | Ver balance; solo miembros org                                    |
| 4.3 | API POST /orgs/:orgId/wallet/top-up        | [ ]    | Recarga vía Stripe; WalletTransaction TOP_UP                      |
| 4.4 | Débito al activar lead → WalletTransaction | [ ]    | Crear DEBIT y restar balance                                      |
| 4.5 | UI Wallet / Recargar                       | [ ]    | Pantalla balance + historial + botón Recargar                     |
| 4.6 | Mercado Pago: planificación                | [ ]    | Doc con limitaciones LATAM (Apple/Google Pay)                     |

---

## Orden de ejecución

1. Fase 1.1: kiteprop-listing-fields.md
2. Fase 2.1: smoke chat+visits
3. Fase 2.2: virtualización lista
4. Fase 3.1–3.2: mapa bounds → feed
5. Fase 4.2–4.6: Wallet B2B + doc Mercado Pago

---

_Sprint creado para completar Fases 1–4. Actualizar al ejecutar cada tarea._
