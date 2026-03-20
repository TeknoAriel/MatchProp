# Auditoría Fullstack — MatchProp

**Revisión de alineación con Plan Maestro, documentación, módulos desarrollados y pendientes**

---

## 1. Alineación con Plan Maestro (masterplan.md v3.0)

| Epic                         | Estado     | Notas                                                                            |
| ---------------------------- | ---------- | -------------------------------------------------------------------------------- |
| **E1 — UX Tinder**           | ✅ DONE    | Feed, lista, swipe LIKE/NOPE, undo, empty state                                  |
| **E2 — Funnel anti-cierre**  | ✅ DONE    | PENDING/ACTIVE/CLOSED, ActivationReason, premiumUntil                            |
| **E3 — Chat controlado**     | ✅ API     | API lista; UI básica en /leads/[id]/chat                                         |
| **E4 — Agenda visitas**      | ✅ DONE    | POST/GET /leads/:id/visits, UI en /me/visits y /leads/[id]/visits                |
| **E5 — Búsquedas + Alertas** | ✅ DONE    | SavedSearch, AlertSubscription, AlertDelivery                                    |
| **E6 — Asistente búsqueda**  | ✅ DONE    | Parser determinístico, POST /assistant/search, búsqueda por voz (Web Speech API) |
| **E7 — Monetización**        | ⏳ PARCIAL | Stripe B2C (checkout-session, webhooks); Wallet B2B y Mercado Pago pendientes    |
| **E8 — Adapter + Analytics** | ✅ PARCIAL | Kiteprop completo; CRM webhook; trackEvent; Portal SEO pendiente                 |

**Reverse-matching:** ✅ Implementado (ListingMatchCandidate, CrmPushOutbox, MatchEvent).

---

## 2. Documentación existente

| Documento                         | Propósito                    |
| --------------------------------- | ---------------------------- |
| `README.md`                       | Inicio, estructura, comandos |
| `INSTRUCCIONES.md`                | Probar app (modo demo)       |
| `docs/masterplan.md`              | Plan maestro E1–E8           |
| `docs/ARCHITECTURE_OVERVIEW.md`   | Arquitectura                 |
| `docs/PRODUCT_BRIEF.md`           | Resumen producto             |
| `docs/AUDIT_MATCHPROP.md`         | Auditoría técnica            |
| `docs/agent-guide.md`             | Guía para agentes Cursor     |
| `docs/backlog.md`                 | Epics, sprints               |
| `docs/repo-map.md`                | Scripts, endpoints           |
| `docs/plan-completamiento-100.md` | Plan de completamiento       |
| `docs/estado-app-y-pendientes.md` | Estado y pendientes          |
| `docs/kiteprop-listing-fields.md` | Campos Kiteprop              |

**Nuevos:** `docs/FEATURE_FLAGS.md` — flags vía env y plan de formalización.

**No existen:** `AGENTS.md`, `RULE.md`, `CONTRIBUTING.md`.

---

## 3. Módulos desarrollados no visibles / configurables

### 3.1 Integración Kiteprop

- **Ruta:** `/settings/integrations/kiteprop`
- **Acceso:** Link en /leads cuando hay error de envío a Kiteprop; no en menú principal
- **Funcionalidad:** baseUrl, leadCreatePath, auth, API key cifrada, spec OpenAPI, payload template, test, attempts, retry

### 3.2 Cargas JSON (Ingest)

- **Scripts:** `ingest:run`, `ingest:fixture-refresh`, `ingest-bundle`
- **Fuentes:** KITEPROP_EXTERNALSITE, KITEPROP_DIFUSION_ZONAPROP/TOCTOC/ICASAS, API_PARTNER_1 (demo)
- **Config:** Env vars `KITEPROP_*`, `INGEST_DEFAULT_LIMIT`
- **UI:** No hay interfaz; se ejecuta por CLI

### 3.3 CRM / Portales

- **Webhook CRM:** `CRM_WEBHOOK_URL`, `CRM_WEBHOOK_SECRET`; push `listing.matches_found`
- **CrmPushOutbox:** Reintentos, backoff; Admin `/crm-push` para resend
- **API Partner:** `API_PARTNER_1` (fixture, solo DEMO_MODE)
- **UI Admin:** Puerto 3002 — `/match-events`, `/crm-push`, `/listings/[id]/matches`, `/visits`

### 3.4 API Universal / Integraciones

- **Endpoints públicos documentados:** `/feed`, `/assistant/search`, `/searches`, `/leads`, etc.
- **Admin debug:** `GET /admin/debug/crm-push`, `GET /admin/debug/listings/:id/matches`
- **Documentación API:** No hay Swagger/OpenAPI público; ver repo-map.md

### 3.5 Pasarela de pago

- **Stripe:** `POST /me/checkout-session`, `POST /webhooks/stripe`
- **Env:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*`
- **UI:** /me/premium (planes); HacersePremiumButton
- **Config:** Precios por rol; no hay UI de administración de precios

### 3.6 Asistente AI de búsqueda

- **Parser:** `POST /assistant/search`, `POST /assistant/render` — texto → SearchFilters
- **Datos:** 50 ejemplos planificados; actualmente ~3
- **UI:** /assistant con chips editables, "Ver resultados ahora"
- **Config:** Sin UI para gestionar ejemplos/frases

### 3.7 Asistencia por voz

- **Web Speech API:** `useSpeechRecognition.ts`
- **UI:** Botón micrófono en /assistant
- **Config:** Depende del navegador; sin ajustes en app

---

## 4. Pendientes (priorizados)

### Alta prioridad

- [x] UI de chat completa en /leads/[id]/chat — **DONE** (burbujas, tema, enlace a agenda)
- [x] UI de agenda/visitas más rica — **DONE** (tema, enlace a chat, “Ver agenda” en leads)
- [x] Hub de Configuraciones en /me/settings — **DONE**

### Media prioridad

- [x] 50 ejemplos de búsqueda para asistente — **DONE** (EXAMPLES en assistant/page.tsx)
- [x] Mapa en ficha listing cuando hay lat/lng — **DONE** (iframe OSM en listing/[id])
- [ ] Wallet B2B (pendiente); Stripe B2C ya operativo con STRIPE_SECRET_KEY
- [ ] Mercado Pago provider (E7)
- [ ] Kiteprop API v1 (stub, falta doc)

### Baja prioridad

- [x] Virtualización lista larga — **DONE** (react-window en feed/list cuando >50 items)
- [ ] Portal SEO (meta tags básicos añadidos; scope amplio pendiente)
- [ ] Feature flags formales
- [ ] Métricas / dashboards (Prometheus)

---

## 5. Propuesta: Hub de Configuraciones

**Ruta:** `/me/settings`

**Secciones:**

| Sección                  | Descripción                                      | Acción                                 |
| ------------------------ | ------------------------------------------------ | -------------------------------------- |
| **Integración Kiteprop** | API key, spec, payload, test                     | Link a /settings/integrations/kiteprop |
| **Cargas JSON**          | Ingest desde portales (Zonaprop, Toctoc, iCasas) | Info + link a docs / admin             |
| **CRM y portales**       | Webhook CRM, API Partner                         | Info + link a admin / env              |
| **API universal**        | Endpoints para integradores                      | Info + link a repo-map / docs          |
| **Pasarela de pago**     | Stripe, planes premium                           | Link a /me/premium                     |
| **Asistente AI**         | Parser de búsqueda, ejemplos                     | Link a /assistant + info               |
| **Asistencia por voz**   | Web Speech API                                   | Link a /assistant + info               |

---

---

## 6. Sprint siguiente (100% operativo y deploy)

Plan por etapas para dejar la app lista para revisión final y deploy:

- **Documento:** [SPRINT_SIGUIENTE_100_OPERATIVO.md](./SPRINT_SIGUIENTE_100_OPERATIVO.md)
- **Plan de cierre (estado y pasos):** [PLAN_DE_TRABAJO_CIERRE_VERSION.md](./PLAN_DE_TRABAJO_CIERRE_VERSION.md) — qué está hecho y qué ejecutar hasta el final de esta versión.
- **Etapas:** 1 Cierre funcional/UX → 2 Estabilidad/calidad → 3 Monetización Stripe B2C → 4 Pre-producción y revisión final.
- **Revisión final:** [REVISION_FINAL_PRE_DEPLOY.md](./REVISION_FINAL_PRE_DEPLOY.md) (checklist a completar antes de cada deploy).
- **Script:** `scripts/pre-deploy-verify.sh` (build + typecheck + test:all).

---

**Última actualización:** Feb 2025
