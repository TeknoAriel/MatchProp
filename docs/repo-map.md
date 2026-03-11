# Mapa del Repo — MatchProp

**Qué hay y dónde**

---

## A) Scripts principales (root)

| Script             | Descripción                                                    | Qué genera                                   |
| ------------------ | -------------------------------------------------------------- | -------------------------------------------- |
| `pnpm start`       | Alias de `dev:up`                                              | —                                            |
| `pnpm start:check` | dev:up + typecheck + test:all + smoke:ux                       | Gates verdes                                 |
| `pnpm dev:up`      | Docker reset + migrate + seed + ingest + demo:data + API + Web | `.logs/api.log`, `.logs/web.log`, DB poblada |
| `pnpm dev:down`    | Apaga servicios                                                | —                                            |
| `pnpm smoke:ux`    | Playwright E2E                                                 | Tests E2E en firefox/chromium                |

**`dev-up.sh`**:

- Mata procesos en 3000/3001
- Docker compose down -v / up -d
- Prisma generate + migrate deploy
- Seed con `SEED_PROPERTIES=0`
- Ingest fixture (KITEPROP_EXTERNALSITE_MODE=fixture) + API_PARTNER_1
- Demo data (DEMO_LISTINGS_COUNT=500)
- Levanta API (3001) y Web (3000)

---

## B) Servicios y puertos

| Puerto | Servicio      |
| ------ | ------------- |
| 3000   | Web (Next.js) |
| 3001   | API (Fastify) |
| 5432   | PostgreSQL    |

---

## C) DB/Prisma

**Modelos clave**:

- Auth: User, UserIdentity, Session, MagicLinkToken, PasskeyCredential, AuthAuditLog, OAuthAttempt, WebAuthnChallenge
- Listing: Listing, ListingMedia, ListingEvent
- Search: SavedSearch
- Alerts: AlertSubscription, AlertDelivery
- Lead: Lead, LeadEvent, LeadDeliveryAttempt
- Integrations: KitepropIntegration, KitepropOpenApiSpec
- Publisher: Publisher, PublisherEndpoint

**Migraciones (propósito alto nivel)**:

| Migración                                     | Propósito                                                                  |
| --------------------------------------------- | -------------------------------------------------------------------------- |
| init                                          | Modelo base                                                                |
| core_models                                   | Modelos core                                                               |
| add_buyer_enum                                | Rol BUYER                                                                  |
| auth_v2_models                                | Auth v2 (Session, MagicLink, etc.)                                         |
| oauth_webauthn_attempts                       | OAuth + WebAuthn                                                           |
| sprint1_canonical_listings                    | Listings canónicos, SwipeDecision, SavedItem, Lead                         |
| listing*source*\*                             | Fuentes KITEPROP_EXTERNALSITE, API_PARTNER_1                               |
| add_saved_search                              | SavedSearch                                                                |
| sprint3_alerts                                | AlertSubscription, AlertDelivery                                           |
| sprint4_listing_events                        | ListingEvent                                                               |
| add_demo_source                               | Demo source                                                                |
| sprint5_publisher_lead_delivery_notifications | Publisher, LeadDeliveryAttempt, Notification                               |
| sprint6_kiteprop_integration                  | KitepropIntegration, KitepropOpenApiSpec                                   |
| sprint61*kiteprop_spec*\*                     | Spec y payload                                                             |
| sprint7_kiteprop_last_test                    | lastTestOk, lastTestHttpStatus, lastTestAt                                 |
| sprint8_lead_funnel                           | Lead PENDING/ACTIVE/CLOSED, ActivationReason, LeadEvent, User.premiumUntil |

---

## D) Endpoints (por módulo)

### Auth

- POST `/auth/login`, `/auth/logout`, `/auth/refresh`
- POST `/auth/magic/request`, `/auth/magic/verify`
- OAuth (Google, Apple, Facebook)
- Webauthn (register, authenticate, verify)
- GET `/me`, `/auth/me`
- **Auth requerido**: sí en /me, /refresh, OAuth callbacks

### Feed / Listings

- GET `/feed` — cursor, filters, exclude NOPE/LIKE
- GET `/feed/list` — lista paginada
- GET `/listings/:id`
- **Auth requerido**: sí

### Assistant

- POST `/assistant/search` — texto → filters
- POST `/assistant/render`
- **Auth requerido**: no explícito (rate limit)

### Searches

- POST `/searches`, GET `/searches`, GET `/searches/:id`, GET `/searches/:id/results`
- **Auth requerido**: sí

### Alerts

- POST `/alerts/subscriptions`, GET, PATCH, DELETE
- POST `/alerts/run`
- **Auth requerido**: sí

### Leads

- POST `/leads` — crea PENDING
- GET `/me/leads`
- POST `/leads/:id/activate`
- **Auth requerido**: sí

### Integrations Kiteprop

- GET/PUT `/integrations/kiteprop`
- POST `/integrations/kiteprop/test`, `/render-preview`
- GET `/integrations/kiteprop/attempts`, POST retry, retry-last-failed
- Spec: fetch, save, suggest, suggest-template
- **Auth requerido**: sí

### Swipes / Saved

- POST `/swipes`, POST `/saved`, GET `/me/saved`
- **Auth requerido**: sí

### Notifications

- GET `/me/notifications`
- **Auth requerido**: sí

### Admin / Orgs

- POST/GET/PATCH/DELETE orgs, properties, preferences
- **Auth requerido**: sí

---

## E) Tests

| Comando                      | Qué cubre                                                                                                                                                                                    |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter api test:all` | 117 tests: auth-magic, auth, feed, searches, alerts, leads, integrations, ingest, lib (cursor, session, feed-total-cache, listing-matches-filters, search-parser, payload-template, openapi) |
| `pnpm smoke:ux`              | Playwright E2E: login magic link → assistant → guardar búsqueda → searches → alerts → feed/list → "Quiero que me contacten" → leads → Kiteprop                                               |

**Browser selection**: firefox en Mac (Darwin), chromium en Linux (por smoke-ux.sh).
