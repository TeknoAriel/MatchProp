# Auditoría Técnica — MatchProp

**Informe para Responsable IT**  
_Estado actual del repositorio — sin code review línea por línea_

---

## 1) Resumen ejecutivo

### Qué es MatchProp

MatchProp es una plataforma de búsqueda inmobiliaria que conecta compradores con propiedades, integrada con fuentes externas (Kiteprop, partners) y con un flujo de leads hacia inmobiliarias vía Kiteprop.

### Qué problemas resuelve

- **Búsqueda inmobiliaria estructurada** (asistente texto→filtros, feed tipo Tinder y lista)
- **Alertas** (NEW_LISTING, PRICE_DROP, BACK_ON_MARKET) con deduplicación
- **Leads** con funnel PENDING→ACTIVE, activación por premium o compra inmobiliaria
- **Integración Kiteprop** para envío de leads a APIs externas con template JSON editable

### Estado actual

- **MVP**: En progreso. Funcionalidades core operativas; faltan chat controlado, agenda de visitas, Kiteprop por etapas (pending vs active), analytics.
- **Validado por tests**: 117 tests (vitest) cubren auth, feed, assistant, searches, alerts, leads, integrations, ingest, lib. `smoke:ux` (Playwright) valida flujo login→assistant→guardar búsqueda→feed/list→leads→Kiteprop. No se requiere ejecutar `smoke:ux` para generar este informe.

---

## 2) Estructura del repo

| Workspace         | Rol                            |
| ----------------- | ------------------------------ |
| `apps/api`        | API Fastify + Prisma           |
| `apps/web`        | Web Next.js                    |
| `apps/admin`      | Panel admin                    |
| `apps/mobile`     | App móvil (scaffold)           |
| `packages/shared` | Tipos y utilidades compartidos |

**Toolchain**: pnpm 9, TypeScript 5.3, Node >=18, Next.js (web), Fastify 4 (api), Prisma 5, PostgreSQL.

**Scripts principales**:

| Script             | Descripción                                                                  |
| ------------------ | ---------------------------------------------------------------------------- |
| `pnpm start`       | Alias de `dev:up` — Docker + migrate + seed + ingest + demo:data + API + Web |
| `pnpm start:check` | dev:up + typecheck + test:all + smoke:ux                                     |
| `pnpm dev:up`      | Levanta entorno completo (Docker Postgres, API 3001, Web 3000)               |
| `pnpm dev:down`    | Apaga servicios (ver scripts/dev-down.sh)                                    |
| `pnpm smoke:ux`    | Playwright E2E — login, assistant, searches, feed, leads, Kiteprop           |

---

## 3) Entorno local / ejecución

### Requisitos

- Node >=18 (recomendado Node 20 LTS)
- Docker (PostgreSQL en `localhost:5432`)
- pnpm 9

### Levantar y validar

```bash
pnpm start        # Levanta todo
pnpm start:check  # Levanta + typecheck + test:all + smoke:ux
```

### Puertos

| Puerto | Servicio      |
| ------ | ------------- |
| 3000   | Web (Next.js) |
| 3001   | API (Fastify) |
| 5432   | PostgreSQL    |

### Logs

- `.logs/api.log` — API
- `.logs/web.log` — Web  
  Generados por `dev-up.sh` al iniciar servidores.

### Playwright (macOS vs Linux)

- **macOS**: Firefox por defecto (`process.platform === 'darwin'`).
- **Linux/CI**: Chromium.

En `scripts/smoke-ux.sh` se usa `PLAYWRIGHT_BROWSER=firefox` en Darwin y `chromium` en Linux; Playwright instala el browser correspondiente antes de ejecutar los tests. Reduce flakiness en CI con Chromium y permite usar Firefox localmente.

---

## 4) Base de datos y migraciones

### Modelos principales

| Dominio      | Modelos                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------- |
| Auth         | User, UserIdentity, Session, MagicLinkToken, PasskeyCredential, AuthAuditLog, OAuthAttempt, WebAuthnChallenge |
| Listing      | Listing, ListingMedia, ListingEvent                                                                           |
| Search       | SavedSearch                                                                                                   |
| Alerts       | AlertSubscription, AlertDelivery                                                                              |
| Lead         | Lead, LeadEvent, LeadDeliveryAttempt                                                                          |
| Integrations | KitepropIntegration, KitepropOpenApiSpec                                                                      |
| Publisher    | Publisher, PublisherEndpoint (ORG/OWNER, WEBHOOK/KITEPROP)                                                    |

### Migraciones (por carpeta, orden cronológico)

| Migración                                                      | Propósito principal                                                        |
| -------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `20260213045525_init`                                          | Modelo base                                                                |
| `20260220230000_core_models`                                   | Modelos core                                                               |
| `20260220234305_/`                                             | Ajustes                                                                    |
| `20260221034006_/`                                             | Ajustes                                                                    |
| `20260221051213_add_created_at_id_index`                       | Índices                                                                    |
| `20260221055504_add_buyer_enum`                                | Rol BUYER                                                                  |
| `20260221055505_auth_v2_models`                                | Auth v2 (Session, MagicLink, etc.)                                         |
| `20260221062949_oauth_webauthn_attempts`                       | OAuth + WebAuthn                                                           |
| `20260221065815_sprint1_canonical_listings`                    | Listings canónicos, SwipeDecision, SavedItem, Lead                         |
| `20260223122200_listing_source_kiteprop_externalsite_api`      | Fuentes listing                                                            |
| `20260223133500_restore_listing_unique`                        | Unique(source, externalId)                                                 |
| `20260223163937_add_saved_search`                              | SavedSearch                                                                |
| `20260224131047_sprint3_alerts`                                | AlertSubscription, AlertDelivery                                           |
| `20260224153549_sprint4_listing_events`                        | ListingEvent                                                               |
| `20260224163843_add_demo_source`                               | Demo source                                                                |
| `20260224193034_sprint5_publisher_lead_delivery_notifications` | Publisher, LeadDeliveryAttempt, Notification                               |
| `20260224201804_sprint6_kiteprop_integration`                  | KitepropIntegration, KitepropOpenApiSpec                                   |
| `20260225000000_sprint61_kiteprop_spec_payload`                | Spec y payload                                                             |
| `20260225034302_sprint61_kiteprop_spec_and_payload`            | Ajustes Kiteprop                                                           |
| `20260225120000_sprint7_kiteprop_last_test`                    | lastTestOk, lastTestHttpStatus, lastTestAt                                 |
| `20260225220000_sprint8_lead_funnel`                           | Lead PENDING/ACTIVE/CLOSED, ActivationReason, LeadEvent, User.premiumUntil |

### Idempotencia en migraciones

Varias migraciones usan `IF NOT EXISTS` y `ADD COLUMN IF NOT EXISTS` (p. ej. Sprint 7, Sprint 8) para evitar errores al reaplicar. Ver `docs/DEV.md`.

### Seed / fixtures / demo:data

| Script / fuente        | Qué crea                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------- |
| `prisma db seed`       | admin@, demo@, load@, loaduser+XXX@, smoke-ux@; load@ y smoke-ux@ con premiumUntil +30d |
| `ingest:run` (fixture) | Listings desde KITEPROP_EXTERNALSITE, API_PARTNER_1                                     |
| `demo:data`            | Listings demo, swipes, propiedades SeedProp (DEMO_LISTINGS_COUNT)                       |

---

## 5) Arquitectura funcional (módulos)

| Módulo             | Descripción                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Auth**           | Magic link, OAuth (Google/Apple/Facebook), passkeys, JWT en cookie, refresh token                                                          |
| **Listings/Feed**  | Feed cursor-based (GET /feed), modo Tinder y lista (/feed/list), exclusiones NOPE/LIKE                                                     |
| **Assistant**      | Parser determinístico texto→SearchFilters, fallback sin LLM                                                                                |
| **Saved searches** | POST/GET /searches, GET /searches/:id/results (motor feed)                                                                                 |
| **Alerts**         | NEW_LISTING, PRICE_DROP, BACK_ON_MARKET; runner con dedupe; AlertDelivery único por (subscriptionId, listingId, type)                      |
| **Leads**          | POST /leads → PENDING; POST /leads/:id/activate (PREMIUM_USER / MANUAL_ADMIN); processor síncrono; idempotencia por LeadDeliveryAttempt OK |
| **Integrations**   | Kiteprop: config, spec fetch/save, payload template, test, encrypt/decrypt API key                                                         |
| **Publisher**      | ORG/OWNER; endpoints WEBHOOK/KITEPROP; delivery adapters en processor                                                                      |

---

## 6) Endpoints (resumen)

### Auth (algunos requieren auth)

- POST `/auth/login`, `/auth/logout`, `/auth/refresh`
- POST `/auth/magic/request`, `/auth/magic/verify` — Magic link
- GET/POST OAuth (Google, Apple, Facebook)
- Webauthn (register, authenticate, verify)
- GET `/me`, `/auth/me` — Usuario actual (incluye premiumUntil)

### Feed / Listings

- GET `/feed` — Feed con cursor, filters, exclude NOPE/LIKE (auth)
- GET `/listings/:id` — Detalle listing (auth)

### Assistant

- POST `/assistant/search` — texto → filters
- POST `/assistant/render` — render preview

### Searches

- POST `/searches`, GET `/searches`, GET `/searches/:id`, GET `/searches/:id/results` — (auth)

### Alerts

- POST `/alerts/subscriptions`, GET `/alerts/subscriptions`, DELETE (auth)
- POST `/alerts/run` — Ejecuta runner (auth)

### Leads

- POST `/leads` — Crear lead PENDING (auth)
- GET `/me/leads` — Lista leads del usuario (auth)
- POST `/leads/:id/activate` — Activar lead (auth, premium o admin)

### Integrations Kiteprop

- GET/PUT `/integrations/kiteprop`
- POST `/integrations/kiteprop/test`, `/render-preview`
- GET `/integrations/kiteprop/attempts`, POST `/retry`, `/retry-last-failed`
- Spec: fetch, save, suggest, suggest-template

### Swipes / Saved

- POST `/swipes`, POST `/saved`, GET `/me/saved` (auth)

### Notifications

- GET `/me/notifications` (auth)

**Contratos relevantes**: FeedResponse (items, nextCursor), SearchFilters (operationType, priceMin/Max, etc.), Lead (id, status PENDING/ACTIVE/CLOSED, lastDelivery).

---

## 7) Seguridad y compliance

| Aspecto                     | Estado                                                                                       |
| --------------------------- | -------------------------------------------------------------------------------------------- |
| Cookies / JWT / session     | JWT en cookie `access_token`, refresh token en cookie/httpOnly                               |
| Anti-enumeración magic link | Magic request siempre responde 200 (validado en auth-magic.int.test)                         |
| Rate limits                 | Global 100 req/min; auth 10 req/min; assistant 20–30 req/min                                 |
| Redacción / logging sin PII | Logs con requestId, route, statusCode, responseTime; userId opcional; no emails en logs      |
| Cifrado secrets             | INTEGRATIONS_MASTER_KEY; AES-256-GCM (scrypt derive); apiKeyEncrypted en KitepropIntegration |
| Filtro anti-contacto        | Pendiente (chat anti-PII en Sprint 8)                                                        |

---

## 8) Observabilidad / Operación

### Logging actual

- `requestId` (x-request-id o generado)
- `route`, `statusCode`, `responseTime`
- `userId` cuando está autenticado

### Gaps

- No hay métricas (Prometheus/StatsD)
- No hay dashboards
- Healthcheck básico: GET `/health` → `{ status: 'ok', timestamp }`

### Recomendaciones

- Healthcheck con chequeo DB
- Métricas de latencia y errores por ruta
- Alertas en prod
- Tracing distribuido (opcional)

---

## 9) Calidad / Testing / CI

### Gates

| Comando                      | Esperado                                           |
| ---------------------------- | -------------------------------------------------- |
| `pnpm lint`                  | 0 errores ESLint                                   |
| `pnpm format:check`          | Prettier OK                                        |
| `pnpm -r typecheck`          | TypeScript OK en todos los workspaces              |
| `pnpm --filter api test:all` | 117 tests OK                                       |
| `pnpm smoke:ux`              | Playwright E2E OK (opcional para generar este doc) |

### Tipos de tests

- **Unit**: lib (cursor, feed-total-cache, session, listing-matches-filters, search-parser, payload-template, openapi)
- **Integration**: auth-magic, auth, feed, searches, alerts, leads, integrations, ingest, upsert-events
- **E2E**: smoke:ux (Playwright) — flujo login→assistant→searches→alerts→feed/list→leads→Kiteprop

### smoke:ux

- Cubre: login magic link, assistant, guardar búsqueda, activar alertas, feed/list, “Quiero que me contacten”, leads, settings Kiteprop.
- Estabilización: firefox en Mac / chromium en Linux; retries en CI; timeouts generosos.
- No es requisito ejecutarlo para generar este informe.

---

## 10) Estado por sprints (timeline)

| Sprint      | Implementado (basado en docs y migraciones)                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1           | Canonical Listings, ingest multi-fuente, feed cursor, swipes, saved, leads stub                                                 |
| 2           | Assistant parser, SavedSearch, searches/:id/results                                                                             |
| 3           | Alerts (NEW_LISTING, etc.), AlertSubscription, AlertDelivery                                                                    |
| 4           | ListingEvent (PRICE_CHANGED, STATUS_CHANGED)                                                                                    |
| 5           | Publisher, LeadDeliveryAttempt, Notification, webhook/console delivery                                                          |
| 6           | Kiteprop integration (config, spec, payload template, encryption)                                                               |
| 7           | Kiteprop last test (lastTestOk, lastTestHttpStatus, lastTestAt), attempts, retry                                                |
| 8 (parcial) | Lead PENDING/ACTIVE/CLOSED, ActivationReason, LeadEvent, User.premiumUntil, POST /leads/:id/activate, “Quiero que me contacten” |

**Pendiente (masterplan)**: chat controlado (solo ACTIVE, filtro anti-PII), agenda de visitas, Kiteprop por etapas (pending vs active templates), analytics (trackEvent), smoke actualizado con activate.

---

## 11) Riesgos y gaps

| Categoría     | Riesgo / Gap                                                                              |
| ------------- | ----------------------------------------------------------------------------------------- |
| **Técnicos**  | Node version drift; spec Kiteprop no auto-descubierto; processor síncrono (sin cola real) |
| **Producto**  | Funnel anti-cierre (PENDING→ACTIVE) aún en evolución; chat y agenda pendientes            |
| **Legales**   | Scraping / ToS de fuentes externas (KITEPROP_EXTERNALSITE, API_PARTNER_1)                 |
| **Seguridad** | Contacto fuera de plataforma; filtro anti-PII en chat pendiente                           |

---

## 12) Próximos pasos recomendados (priorizados)

1. **Chat controlado (solo ACTIVE) + filtro anti-PII**
   - Objetivo: chat interno con bloqueo de emails/teléfonos/URLs.
   - Entregables: modelo Message, endpoints GET/POST /leads/:id/messages, filtro anti-PII, UI mínima.
   - Gates: test integración, pnpm start:check OK.

2. **Agenda de visitas (solo ACTIVE)**
   - Objetivo: slots básicos de visita.
   - Entregables: modelo Visit, POST/GET /leads/:id/visits, validar scheduledAt futuro, UI mínima.
   - Gates: tests integración, pnpm start:check OK.

3. **Kiteprop por etapas (payloadTemplatePending vs payloadTemplateActive)**
   - Objetivo: no enviar PII en PENDING.
   - Entregables: payloadTemplatePending / payloadTemplateActive, sendLeadPending / sendLeadActivated, tests con mocks.
   - Gates: pnpm start:check OK.

4. **Analytics (trackEvent)**
   - Objetivo: eventos mínimos (contact_requested, lead_activated, etc.).
   - Entregables: modelo AnalyticsEvent, helper trackEvent, instrumentación en rutas clave.
   - Gates: tests unitarios, sin PII en logs.

5. **Smoke UX actualizado + estabilización**
   - Objetivo: flujo PENDING→ACTIVATE→chat/agenda en smoke.
   - Entregables: smoke con activate (premium demo), bloqueo PII en chat, visita agendada.
   - Gates: smoke:ux PASS estable.

---

_Generado a partir del estado actual del repositorio. Para validación: `pnpm -r typecheck` y `pnpm --filter api test:all`._
