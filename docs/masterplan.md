# MATCHPROP – MASTERPLAN v3.0 (Frozen)

**Source of truth para alineación producto ↔ implementación**

---

## Visión

MatchProp es una plataforma de búsqueda inmobiliaria que conecta compradores con propiedades, con flujo de leads hacia inmobiliarias vía Kiteprop y adaptadores externos. El producto prioriza funnel anti-cierre (PENDING→ACTIVE) para proteger contacto entre partes hasta activación explícita.

---

## Epics (E1–E8)

### E1 — UX Tinder (Feed + Swipe + Lista)

- Feed modo Tinder (1 card) y lista (cards paginadas)
- Swipe LIKE/NOPE con exclusión en siguiente request
- Undo último swipe (deshacer)
- List view con cursor y performance hints
- Empty state cuando no hay más resultados

### E2 — Funnel anti-cierre (Leads PENDING/ACTIVE/CLOSED)

- Lead inicia en PENDING (no se comparte PII externamente)
- Activación: PREMIUM_USER (premiumUntil vigente) o MANUAL_ADMIN
- Estados: PENDING, ACTIVE, CLOSED
- ActivationReason: PAID_BY_AGENCY, PREMIUM_USER, MANUAL_ADMIN
- User.premiumUntil para control de premium
- LeadEvent para trazabilidad

### E3 — Chat controlado + filtro anti-PII

- Chat interno solo cuando Lead está ACTIVE
- Bloqueo de emails, teléfonos, URLs en mensajes (filtro anti-PII)
- Mensajes almacenados sin PII expuesto en logs

### E4 — Agenda de visitas

- Slots de visita solo para leads ACTIVE
- Modelo Visit con scheduledAt futuro
- POST/GET /leads/:id/visits

### E5 — Búsquedas activas + Alertas

- SavedSearch con filtros
- AlertSubscription: NEW_LISTING, PRICE_DROP, BACK_ON_MARKET
- AlertDelivery con deduplicación
- Runner alerts con ListingEvent (PRICE_CHANGED, STATUS_CHANGED)

### E6 — Asistente de búsqueda

- Parser determinístico texto → SearchFilters
- POST /assistant/search, POST /assistant/render
- (Audio/LLM real: pendiente / out of scope por ahora)

### E7 — Monetización (B2B/B2C)

- B2B: wallet inmobiliarias, pagos por leads
- B2C: premium (Stripe opcional), premiumUntil
- **Payment Adapter Layer (planificación):**
  - **Mercado Pago (ML)** para métodos locales (LATAM).
  - **Stripe** para Apple Pay / Google Pay y tarjetas internacionales.
- **Constraint AR:** En Argentina Mercado Pago no se agrega a Apple Wallet / Google Pay; documentar como limitación conocida.
- (Implementación pendiente / out of scope Sprint 8)

### E8 — Adapter layer + Analytics + Portal SEO

- **Kiteprop**: config, spec, payload template, test, cifrado API key, attempts/retry
- Otros CRMs / scrapers detrás de feature flags
- Analytics: eventos mínimos (trackEvent), dashboards (pendiente)
- Portal SEO (pendiente)

---

## Feature: Reverse-matching al cargar una propiedad (cierra el ciclo oferta↔demanda)

- **Trigger:** cuando dueño/agente/inmobiliaria crea un listing (`listing.created`) sea manual o por import/API/CRM.
- **Acción:** matchear la propiedad contra perfiles de búsqueda ACTIVOS (mismo motor/scoring que feed).
- **Output inmediato en UI del cargador:** “X perfiles interesados” + resumen (zona, rango precio, tipo, score) + CTA “Ver interesados”.
- **Persistencia:** tabla/registro `ListingMatchCandidate` con dedupe (unique: listingId + searchProfileId), guardar score y timestamp.
- **Notificación:** inbox/notificación para el cargador y opcional para la inmobiliaria.
- **Push a CRM (webhook + retries):**
  - Env: `CRM_WEBHOOK_URL`, `CRM_WEBHOOK_SECRET` (opcional). Si `listing.source` es CRM/integración, se encola en `CrmPushOutbox`.
  - Payload: `{ event: "listing.matches_found", listingId, matchesCount, topSearchIds, createdAt }`. Header `Authorization: Bearer <secret>` si existe.
  - Reintentos: máx 5, backoff 1m, 5m, 15m, 1h, 6h. Script: `pnpm --filter api crm:push:run` (una pasada).
  - Si la carga viene desde CRM o hay integración activa, emitir evento `listing.matches_found` con los candidatos.
  - Integración decide el formato: “oportunidad/lead” o “notificación”, link interno a la propiedad y al perfil.
- **Performance/SLO:** feedback <10s; si tarda, mostrar “procesando matches…” y actualizar.
- **Privacidad:** respetar anti-cierre (identidad parcial hasta activación).

---

## UX contract (MVP)

- **Barra de búsqueda activa global:** en /feed, /feed/list, /assistant, /searches, /alerts se muestra una barra (sticky) con estado “Sin búsqueda activa” + “Crear búsqueda” o con la búsqueda activa (resumen, Cambiar, Alertas, Limpiar).
- **Guardar búsqueda siempre visible:** en /assistant, cuando hay filtros detectados, siempre se muestran los CTAs “Guardar búsqueda”, “Activar alertas” y “Ver resultados ahora”.
- **Feed/List filtrado por búsqueda activa:** /feed y /feed/list usan por defecto la búsqueda activa (searchId); si no hay activa, se muestra un CTA para crear y guardar una búsqueda (sin bloquear navegación).
- **Alertas accesibles:** en /searches/:id la sección Alertas (Activas/Pausadas) está siempre visible; en /alerts se listan las suscripciones con enlace a la búsqueda.

---

## Observabilidad y operación

- Logs con requestId, route, statusCode, responseTime (sin PII)
- Rate limits: global 100/min, auth 10/min
- Healthcheck GET /health
- Idempotencia en processor (LeadDeliveryAttempt, AlertDelivery)
- Migraciones con IF NOT EXISTS cuando aplica
- **Observabilidad CRM push (Sprint 11):** `GET /admin/debug/crm-push` (solo DEMO/dev): counts (PENDING/SENT/FAILED), top 5 FAILED con id, listingId, attempts, nextAttemptAt, lastError (slice), nextAttemptAt más próximo. Qué mirar: PENDING acumulados, FAILED con lastError para diagnóstico.
- **Operabilidad CRM push (Sprint 12):** Resend manual: `POST /admin/debug/crm-push/:id/resend` → set status=PENDING, attempts=0, nextAttemptAt=now, lastError=null. UI admin `/crm-push` con tabla y botón Resend para FAILED.
- **Cómo validar E2E:** `pnpm demo:up` (reset + seed + API + Web + smoke); opcional `GET /admin/debug/crm-push` para ver estado outbox.
- **Smoke detecta runtime errors (Sprint 12):** El test `flujo completo` registra `pageerror` y `console.error`; si hay alguno, el test falla mostrando el mensaje (evita que el overlay "1 Issue" de Next pase desapercibido).
- **Guideline UI (Kiteprop-ish, Sprint 12):** Topbar azul (gradiente), fondo gris suave (#f5f5f7), contenido en cards blancas con sombra leve y bordes redondeados; botones primary azul, secondary gris, success verde.
- **Ciclo completo visible en demo (Sprint 11):**
  - `demo:reset-and-seed` crea 500+ listings, 50+ búsquedas activas (SavedSearch) con filtros variados, y backfill de matches para ~50 listings.
  - **Dónde ver matches:** Admin `http://localhost:3002/listings/:id/matches` (o `/listings/[id]/matches` según puerto). API `GET /admin/debug/listings/:id/matches` → `{ matchesCount, topSearchIds }`.
  - **Match events (inbox):** `GET /admin/debug/match-events?limit=50` → lista de `{ id, listingId, matchesCount, source, createdAt }`. Admin `http://localhost:3002/match-events`. Al finalizar matcher con matchesCount>0 se crea `MatchEvent` (source: DEMO o CRM_WEBHOOK).

---

## Seguridad

- Anti-enumeración magic link (siempre 200)
- Cookies JWT, refresh token httpOnly
- Cifrado secrets (INTEGRATIONS_MASTER_KEY, AES-256-GCM)
- Feature flags para demo sources (off en prod)

---

---

## Sprint 14 — Ficha PRO + Búsqueda + Asistente + Demo

- **Ficha PRO:** GET /listings/:id retorna ListingDTO completo (operationType, propertyType, addressText, lat, lng, areaCovered, details con amenities/services). UI con galería, badges, características, amenities, mapa.
- **Search PRO:** Búsqueda manual en /search con filtros (operation, propertyType, priceMin/Max, currency, bedrooms, bathrooms, areaMin, locationText) vía GET /feed. Guardar búsqueda y activar alertas.
- **Asistente PRO:** 50 ejemplos de búsqueda. Al aplicar filtros (Ver resultados ahora) se persisten en PUT /preferences (UserPreferences).
- **Demo PRO:** 50 fotos SVG en /demo/photos/photo-01.svg .. photo-50.svg. Seed con description, details (amenities, services, aptoCredito) y heroImageUrl/media alineados.
- **Docs:** kiteprop-listing-example.json, kiteprop-listing-fields.md; ListingDTO contract.

---

## Versioning

| Campo      | Valor                                             |
| ---------- | ------------------------------------------------- |
| Fecha      | 2026-02-21                                        |
| Commit SHA | (ejecutar `git rev-parse HEAD` para valor actual) |
| Autor      | Frozen by Cursor Agent                            |

---

## UX contract (MVP)

- **Active search bar global:** En /feed, /feed/list, /assistant, /searches, /alerts una barra muestra “Sin búsqueda activa” + Crear búsqueda, o el resumen de la búsqueda activa + Cambiar / Alertas / Limpiar.
- **Guardar búsqueda siempre visible:** En /assistant, cuando hay filtros detectados, los CTAs “Guardar búsqueda”, “Activar alertas” y “Ver resultados ahora” están siempre visibles.
- **Feed/List filtrado por búsqueda activa:** /feed y /feed/list usan por defecto la búsqueda activa del usuario; si no hay activa, se muestra CTA para crear y guardar una.
- **Alertas accesibles:** Desde el detalle de una búsqueda (/searches/:id) el toggle Alertas (Activas/Pausadas) está siempre visible; /alerts lista las suscripciones con enlace a la búsqueda.

---

## Non-negotiables

1. **Funnel anti-cierre**: Lead PENDING hasta activación explícita (premium o admin).
2. **Sin PII en logs**: emails, teléfonos, nombres no deben aparecer en logs.
3. **Idempotencia**: LeadDeliveryAttempt y AlertDelivery no duplican.
4. **Anti-enumeración**: magic link request siempre 200.
5. **Demo sources off en prod**: KITEPROP_EXTERNALSITE_MODE=fixture y API_PARTNER_1 solo dev/demo.

---

## Definition of Done (Product Approved)

- Funcionalidad implementada según spec del epic
- Tests de integración o E2E cubriendo flujo principal
- Sin regresiones: `pnpm -r typecheck` y `pnpm --filter api test:all` verdes
- Documentación actualizada (AUDIT, alignment, backlog) si aplica
- Revisión de seguridad (PII, rate limit) si toca auth/leads
