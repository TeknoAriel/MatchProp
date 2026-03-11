# Guía para el agente Cursor (MatchProp)

Documentación interna para tareas de implementación y validación.

---

## Reverse-matching al alta de propiedad

Feature planificado (ver **docs/masterplan.md**): al cargar una propiedad (listing.created), matchear contra perfiles de búsqueda activos y mostrar “X perfiles interesados” + push a CRM (`listing.matches_found`). Persistencia en `ListingMatchCandidate` (listingId + searchProfileId), SLO &lt;10s, respetar anti-cierre.

---

## Cómo validar manualmente (demo)

1. Levantar entorno: `pnpm demo:up` (reset+seed+validate, API+Web, smoke incluido) o `pnpm dev:up` (solo levanta, sin smoke).
2. Login: `/login` → email `smoke-ux@matchprop.com` (dev) → “Abrir link de acceso (dev)”.
3. Ver estado: `/status` (listings count numérico con DEMO_MODE=1).
4. Feed: `/feed`, `/feed/list` (cards o empty state con CTA).
5. Alertas: `/alerts`, `/searches` (crear búsqueda, activar “Nuevas publicaciones”).
6. Ver **docs/demo.md** para flujo completo de 5 pasos.

---

## Endpoints y scripts en demo

- **API:** `http://localhost:3001` (Web hace proxy `/api/*` → 3001).
- **Health:** `GET /health`.
- **Listings count (solo DEMO_MODE=1):** `GET /status/listings-count` → `{ total, bySource }`.
- **Feed:** `GET /feed?limit=20&cursor=...` (auth).
- **Active search:** `GET /me/active-search`, `POST /me/active-search` (auth).
- **Scripts:** `pnpm demo:up` (demo + smoke en 1 comando), `pnpm --filter api demo:reset-and-seed`, `pnpm --filter api demo:validate`, `pnpm smoke:ux`, `pnpm --filter api crm:push:run` (Sprint 10: una pasada push a CRM).

---

## Sprint 10: Push a CRM

- **Env vars:** `CRM_WEBHOOK_URL` (obligatorio para enviar), `CRM_WEBHOOK_SECRET` (opcional, Bearer en header).
- **Cómo probar (manual):**
  1. Crear listing con `source: CRM_WEBHOOK` (por seed, import o API) o usar un listing existente.
  2. Encolar push: desde código o script que llame `enqueueCrmPush(listingId, matchesCount, topSearchIds)` (o crear registro en `CrmPushOutbox`).
  3. Correr una pasada: `pnpm --filter api crm:push:run`. Ver log `processed/sent/failed`.
- **Endpoints:** `GET /listings/:id/match-summary` (auth) → `{ matchesCount, topSearchIds }`. `GET /admin/debug/listings/:id/matches` (solo DEMO/dev) mismo payload.

---

## Sprint 11 – Demo con búsquedas y ciclo visible

- **Demo dataset:** `pnpm --filter api demo:reset-and-seed` (DEMO_MODE=1) crea 500+ listings, 50+ SavedSearch, backfill matches para ~50 listings, MatchEvent por cada match.
- **Validación:** `pnpm --filter api demo:validate` → totalSearches >= 50, al menos 10 de 20 listings muestreados con >= 1 match (CrmPushOutbox).
- **Endpoints:** `GET /admin/debug/match-events?limit=50`, `GET /admin/debug/listings/:id/matches`.
- **URLs para ver en demo:** Admin `http://localhost:3002/match-events`, `http://localhost:3002/listings/[id]/matches`, `http://localhost:3002/crm-push`.

## Cómo validar E2E (Sprint 11)

1. **Tests:** `pnpm --filter api test:all` (incluye tests CRM: crear listing CRM_WEBHOOK => outbox PENDING, status endpoint, resend).
2. **Demo + smoke:** `pnpm demo:up` → valida que demo:reset-and-seed crea searches + backfill y demo:validate pasa.
3. **Manual:** Levantar `pnpm dev:up` o `pnpm demo:up`, abrir `http://localhost:3002/match-events` (debe haber eventos), `http://localhost:3002/listings/[id]/matches` para un listing con matches, `GET http://localhost:3001/admin/debug/crm-push`.

---

## Sprint 12 – Fix Next overlay + UI polish

- **Fix "1 Issue":** Captura de `pageerror` y `console.error` en smoke; si aparece runtime error, el test falla con el stack.
- **Fixes típicos:** Hidratación con fechas (suppressHydrationWarning + locale explícito), `baseUrl` en status (useState+useEffect para evitar mismatch server/client).
- **UI:** Topbar azul, fondo gris suave, cards blancas con sombra; mantener textos/labels usados por Playwright ("Guardar búsqueda", "Alertas", etc.).
- **Validar:**
  - `pnpm -r typecheck`
  - `pnpm smoke:ux` (o `pnpm --filter web smoke:ux -- --project=chromium -g "flujo completo"` si servidores ya levantados).

## Cómo reintentar un FAILED (Sprint 12)

- **API:** `POST /admin/debug/crm-push/:id/resend` (solo DEMO/dev). Deja el registro en PENDING con attempts=0 y nextAttemptAt=now; la próxima pasada de `pnpm --filter api crm:push:run` lo enviará.
- **UI:** Admin `http://localhost:3002/crm-push` → tabla outbox → botón “Resend” en filas FAILED (o PENDING).

---

## Auditoría: empaquetar / validar / correr demo

- **Gates:** `pnpm audit:verify` (lint, format:check, typecheck, test:all).
- **ZIP auditable:** `pnpm audit:pack` → `artifacts/matchprop-audit-YYYYMMDD-<sha>.zip` (sin node_modules, builds, .env).
- **Demo completo:** `pnpm demo:up` (reset, seed, API, Web, smoke).
- **Mock CRM local:** `pnpm mock:crm` (webhook en 9999); luego `CRM_WEBHOOK_URL=http://localhost:9999/webhook pnpm --filter api crm:push:run`.

---

---

## Sprint 14 — Ficha PRO, Search, Asistente, Demo

- **Ficha PRO:** GET /listings/:id devuelve ListingDTO completo (details con amenities, services, aptoCredito). UI `/listing/[id]` con galería, badges, descripción, amenities, mapa si lat/lng.
- **Asistente PRO:** 50 ejemplos; al hacer clic en "Ver resultados ahora" se llama PUT /preferences con los filtros detectados (persistencia UserPreferences).
- **Demo PRO:** `node apps/web/scripts/generate-demo-photos.js` genera 50 SVGs en public/demo/photos. Seed usa /demo/photos/photo-NN.svg, description y details. `DEMO_MODE=1 pnpm --filter api demo:reset-and-seed`.
- **Search:** /search usa GET /feed con query params; filtros: operation, propertyType, priceMin/Max, currency, bedrooms, bathrooms, areaMin, locationText.

---

## Smoke E2E (Playwright)

- **Recomendado (todo en uno):** `pnpm smoke:ux` (script que instala browsers, levanta API+Web, corre tests) o `pnpm demo:up` (demo + smoke).
- **Solo tests (servidores ya levantados):** `pnpm --filter web smoke:ux` o Firefox: `pnpm --filter web smoke:ux -- --project=firefox -g "flujo completo"`. Si falla con “Executable doesn't exist”, instalar antes: `pnpm --filter web exec playwright install firefox` (ver docs/DEV.md).
- **Selector “Alertas”:** en strict mode se usa `getByRole('link', { name: 'Alertas', exact: true })` (no `getByText`) para evitar 2 elementos (link + texto).
