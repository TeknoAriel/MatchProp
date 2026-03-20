# Plan de completamiento 100% — MatchProp

**Objetivo:** Dejar el proyecto 100% listo y funcional según Masterplan v3.0, Sprint 14 y documentación del repo.

**Fuentes:** masterplan.md, alignment-checklist.md, backlog.md, gap-check.md, estado-app-y-pendientes.md, agent-guide.md, revision-responsive-sprint-siguiente.md.

---

## 1. Estado actual: realizado vs pendiente

### 1.1 Epics (Masterplan E1–E8)

| Epic   | Requisito                          | Estado         | Evidencia / Pendiente                                                          |
| ------ | ---------------------------------- | -------------- | ------------------------------------------------------------------------------ |
| **E1** | Feed Tinder + lista, swipe, undo   | ✅ DONE        | swipes.ts, feed.ts, /feed, /feed/list                                          |
| **E1** | Performance (virtualización lista) | ⚠️ PARTIAL     | Cursor, cache; sin virtualización explícita                                    |
| **E2** | Leads PENDING/ACTIVE/CLOSED        | ✅ DONE        | Lead.status, POST /leads/:id/activate                                          |
| **E2** | PII gating (Kiteprop por etapas)   | ✅ DONE        | payloadTemplatePending/Active                                                  |
| **E3** | Chat controlado + filtro anti-PII  | ✅ DONE        | Message, POST/GET /leads/:id/messages; **UI completa** (burbujas, tema)        |
| **E4** | Agenda de visitas                  | ✅ DONE        | Visit, POST/GET /leads/:id/visits; **UI completa** (tema, enlaces Chat/Agenda) |
| **E5** | SavedSearch + alertas              | ✅ DONE        | AlertSubscription, AlertDelivery, /searches, /alerts                           |
| **E6** | Asistente texto → SearchFilters    | ✅ DONE        | POST /assistant/search, search-parser                                          |
| **E6** | Asistente por voz                  | ✅ DONE        | Web Speech API, botón micrófono en /assistant                                  |
| **E6** | 50 ejemplos + PUT /preferences     | ⚠️ PARTIAL     | 3 ejemplos; PUT /preferences ya se llama al buscar                             |
| **E7** | Monetización B2B/B2C               | ❌ NOT STARTED | User.premiumUntil existe; sin wallet ni Stripe                                 |
| **E8** | Kiteprop + Analytics               | ✅ DONE        | integrations, trackEvent                                                       |
| **E8** | Portal SEO                         | ❌ NOT STARTED | Scope a definir                                                                |

### 1.2 UX contract (Masterplan)

| Ítem                                                     | Estado  |
| -------------------------------------------------------- | ------- |
| Barra búsqueda activa global (ActiveSearchBar)           | ✅ DONE |
| Guardar búsqueda + Activar alertas visibles en assistant | ✅ DONE |
| Feed/List filtrado por búsqueda activa                   | ✅ DONE |
| Alertas en /searches/:id y /alerts                       | ✅ DONE |

### 1.3 Sprint 14 (Ficha PRO, Search, Asistente, Demo)

| Ítem                                              | Estado       | Pendiente                                                                           |
| ------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------- |
| Ficha PRO (ListingDTO, galería, amenities)        | ✅ DONE      | Mapa iframe OSM cuando lat/lng                                                      |
| Search PRO (filtros, GET /feed, guardar, alertas) | ✅ DONE      | —                                                                                   |
| Asistente PRO (50 ejemplos)                       | ✅ DONE      | 50 ejemplos en EXAMPLES (assistant/page.tsx)                                        |
| Asistente PRO (PUT /preferences)                  | ✅ DONE      | Ya se llama al detectar filtros                                                     |
| Asistente por voz                                 | ✅ DONE      | —                                                                                   |
| Demo PRO (50 fotos SVG)                           | ✅ DONE      | /demo/photos/photo-01..50.svg existen; demo-reset-and-seed y demo-data usan 50 SVGs |
| Docs (kiteprop-listing-example, ListingDTO)       | ⚠️ VERIFICAR | Revisar si existen                                                                  |

### 1.4 Observabilidad y operación

| Ítem                                        | Estado  |
| ------------------------------------------- | ------- |
| Logs requestId, rate limits, GET /health    | ✅ DONE |
| GET /admin/debug/crm-push, resend           | ✅ DONE |
| Smoke e2e (flujo completo, runtime errors)  | ✅ DONE |
| demo:up, demo:reset-and-seed, demo:validate | ✅ DONE |

### 1.5 Reverse-matching y CRM

| Ítem                                 | Estado  |
| ------------------------------------ | ------- |
| ListingMatchCandidate, CrmPushOutbox | ✅ DONE |
| MatchEvent, backfill matches en demo | ✅ DONE |
| Script crm:push:run, reintentos      | ✅ DONE |

### 1.6 Búsqueda por mapa, zonas, regiones o barrios

| Ítem                                            | Estado       | Notas                                                                                                           |
| ----------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------- |
| Búsqueda por zona/región/barrio (texto)         | ✅ PARCIAL   | /search: "Ciudad o zona" + "Dirección"; SearchFilters.locationText, addressText; asistente parsea zona en texto |
| Sección o flujo dedicado "Buscar por mapa"      | ❌ PENDIENTE | Vista mapa con selección de zona/región o pins; filtrar resultados por área/bounds                              |
| Integración mapa en búsqueda (bounds → filtros) | ❌ PENDIENTE | Si existe vista mapa: enviar bounds o polígono al feed/search                                                   |
| Listado por barrios/regiones en UI              | ⚠️ OPCIONAL  | Facetas o chips por barrio/región (depende de datos)                                                            |

**Consideración:** El proyecto debe mantener y reforzar la búsqueda por mapa, zonas, regiones y barrios como parte del plan de completamiento (ver Fase 1 y Fase 5).

### 1.7 Otros pendientes (gap-check, revision-responsive)

| Ítem                                          | Estado       |
| --------------------------------------------- | ------------ | ---------------------- |
| Feature flags formalizados (demo off en prod) | ⚠️ PARCIAL   | PROD.md; flags por env |
| UI Chat (página /leads o detalle lead)        | ❌ PENDIENTE |
| UI Agenda/visitas                             | ❌ PENDIENTE |
| Virtualización lista larga                    | ❌ OPCIONAL  |
| PROD.md checklist pre-prod, demo off          | ⚠️ PENDIENTE |
| Dashboard redirect con active search          | ⚠️ BAJA      |

---

## 2. Plan de trabajo por fases

### Fase 1 — Cerrar Sprint 14 (producto core listo)

**Objetivo:** Ficha PRO, Asistente PRO y Demo PRO al 100%.

| #   | Tarea                                                                                                                                                               | Esfuerzo | Criterio de done                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------- |
| 1.1 | Ampliar ejemplos de búsqueda de 3 a 50 en /assistant                                                                                                                | S        | Array EXAMPLES con 50 strings variados (operación, tipo, zona, precio, dormitorios, etc.) |
| 1.2 | Mapa en ficha de listing cuando hay lat/lng                                                                                                                         | M        | Componente mapa (iframe o lib ligera); mostrar en /listing/[id] si lat && lng             |
| 1.3 | 50 fotos SVG demo: script o assets en /demo/photos/                                                                                                                 | M        | photo-01.svg .. photo-50.svg; seed que asigne heroImageUrl/media a listings               |
| 1.4 | Seed demo: description, details (amenities, aptoCredito) alineados con fotos                                                                                        | S        | Revisar demo-reset-and-seed; campos opcionales en Listing                                 |
| 1.5 | Documentar ListingDTO / kiteprop-listing-fields si falta                                                                                                            | S        | kiteprop-listing-example.json o sección en docs                                           |
| 1.6 | **Búsqueda por mapa/zonas/regiones/barrios:** asegurar que /search y asistente soporten zona/barrio/región; planificar vista "Buscar por mapa" (opcional en Fase 1) | M        | locationText y ejemplos con barrios/zonas; doc o tarea para vista mapa con bounds         |

**Entregable Fase 1:** Sprint 14 completo según masterplan; demo con 50 listings con fotos y datos coherentes; búsqueda por zona/barrio/región considerada.

---

### Fase 2 — UI Chat y Agenda (E3/E4)

**Objetivo:** Que el usuario pueda chatear y agendar visitas desde la app (APIs ya existen).

| #   | Tarea                                                                | Esfuerzo | Criterio de done                                                                             |
| --- | -------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------- |
| 2.1 | Página o sección Chat para un lead ACTIVE                            | M        | GET/POST /leads/:id/messages; lista de mensajes; input; filtro anti-PII en backend ya existe |
| 2.2 | Página o sección Agenda/Visitas para un lead ACTIVE                  | M        | GET/POST /leads/:id/visits; listar slots; crear visita (scheduledAt); solo si lead ACTIVE    |
| 2.3 | Enlace a Chat y Visitas desde lista de leads (/leads) o detalle lead | S        | Links “Ver chat” / “Agendar visita” cuando status === ACTIVE                                 |

**Entregable Fase 2:** Usuario con lead ACTIVE puede enviar mensajes y agendar visitas desde la web.

---

### Fase 3 — Estabilidad y pre-producción

**Objetivo:** Checklist pre-prod, smoke sólido, feature flags claros.

| #   | Tarea                                                                          | Esfuerzo | Criterio de done                                   |
| --- | ------------------------------------------------------------------------------ | -------- | -------------------------------------------------- |
| 3.1 | PROD.md: sección “Checklist pre-producción” y “Demo sources OFF en prod”       | S        | Documentado qué envs y flags revisar antes de prod |
| 3.2 | Feature flags: documentar o centralizar (API_PARTNER_1, KITEPROP_EXTERNALSITE) | S        | PROD.md o config; cómo desactivar en prod          |
| 3.3 | Smoke: validar flujo dashboard → feed con búsqueda activa (si aplica)          | S        | Playwright; paso que cubra active search en feed   |
| 3.4 | Ajustes responsive mínimos (header feed, ActiveSearchBar en móvil)             | S        | Revisión en viewport 320–375px; sin regresiones    |

**Entregable Fase 3:** Repo documentado para deploy seguro; smoke estable.

---

### Fase 4 — Monetización (E7) — opcional para “100% funcional” core

**Objetivo:** Si el cierre 100% incluye pagos: wallet B2B y/o premium B2C.

| #   | Tarea                                                     | Esfuerzo | Criterio de done                                        |
| --- | --------------------------------------------------------- | -------- | ------------------------------------------------------- |
| 4.1 | Wallet B2B (inmobiliarias): modelo, API básica            | L        | Definir scope con producto                              |
| 4.2 | Premium B2C (Stripe): suscripción, premiumUntil, webhooks | L        | Stripe Checkout o similar; actualizar User.premiumUntil |
| 4.3 | Mercado Pago provider (LATAM) — planificación             | M        | Documentar limitación Apple/Google Pay en AR            |

**Nota:** El masterplan marca monetización como “out of scope Sprint 8” y Sprint 9. Para un 100% _funcional_ del core (búsqueda, leads, chat, agenda, demo), la Fase 4 puede ser posterior.

---

### Fase 5 — Mejoras opcionales

| #   | Tarea                                               | Prioridad |
| --- | --------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------- |
| 5.0 | **Búsqueda por mapa**                               | ✅ DONE   | GET /feed/map, /search/map con iframe OSM + lista de propiedades con ubicación; enlaces en /search y /assistant |
| 5.1 | Virtualización lista larga (react-window o similar) | Baja      |
| 5.2 | Portal SEO (scope a definir)                        | Baja      |
| 5.3 | Dashboards de analytics (trackEvent ya existe)      | Baja      |
| 5.4 | Healthcheck con chequeo DB                          | Baja      |

---

## 3. Resumen ejecutivo

- **Hecho (~95% del core):** E1, E2, E5, E6 (texto + voz), E8 (Kiteprop, analytics), Sprint 14 (50 ejemplos, mapa ficha, 50 fotos demo), Fase 2 (Chat + Agenda + breadcrumbs + 403), Fase 3 (PROD Demo OFF, feature flags doc, smoke feed/list, responsive checklist).
- **Responsive:** Test automatizado en `e2e/responsive.spec.ts` (320/375px, sin overflow). Revisión manual opcional con responsive-checklist.md.
- **Pendiente opcional:** Fase 4 monetización (Stripe/Wallet ya documentados en fase-4-monetizacion.md), virtualización lista, Portal SEO.
- **Búsqueda por mapa/zonas/regiones/barrios:** ya existe filtro "Ciudad o zona" en /search y en SearchFilters; vista dedicada "Buscar por mapa" en Fase 5 (opcional).
- **Opcional:** Monetización (Fase 4), vista mapa (Fase 5.0), virtualización, Portal SEO (Fase 5).

**Orden sugerido:** Fase 1 → Fase 2 → Fase 3. Con eso el producto queda 100% funcional para el flujo comprador (búsqueda, favoritos, listas, leads, chat, visitas, alertas, demo). La Fase 4 se puede planificar como siguiente hito de negocio.

---

## 4. Referencia rápida de documentos

| Documento                                                                            | Uso                                                      |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| [masterplan.md](../masterplan.md)                                                    | Epics, UX contract, Sprint 14, non-negotiables           |
| [alignment-checklist.md](../alignment-checklist.md)                                  | Estado DONE/PARTIAL por requisito                        |
| [backlog.md](../backlog.md)                                                          | Sprints 8, 8.3, 9; definición de done por epic           |
| [gap-check.md](../gap-check.md)                                                      | Gaps funcionales y técnicos                              |
| [estado-app-y-pendientes.md](./estado-app-y-pendientes.md)                           | Resumen realizado vs pendiente (antes de este plan)      |
| [agent-guide.md](../agent-guide.md)                                                  | Cómo validar demo, smoke, CRM push                       |
| [revision-responsive-sprint-siguiente.md](./revision-responsive-sprint-siguiente.md) | Responsive y recomendación sprint                        |
| [sprint-fase-2-y-3.md](./sprint-fase-2-y-3.md)                                       | **Sprint concreto Fase 2 + Fase 3** (tareas y checklist) |

---

_Última actualización: a partir de masterplan v3.0, alignment-checklist y docs del repo. Búsqueda por voz y estado actual del assistant ya considerados. Sprint Fase 2 y 3: docs/sprint-fase-2-y-3.md._
