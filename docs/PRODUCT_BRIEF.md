# MatchProp — Product Brief

## Qué es MatchProp

MatchProp es una plataforma de búsqueda inmobiliaria que conecta compradores con propiedades. El producto prioriza un flujo tipo “Tinder” (feed + swipe) y un funnel anti-cierre para leads (PENDING → ACTIVE) hasta activación explícita.

---

## Flujos principales

- **Feed / Lista:** Vista tipo Tinder (una card) y lista paginada de propiedades; swipe LIKE/NOPE; exclusión de ya vistos; búsqueda activa global.
- **Búsquedas y alertas:** Guardar búsquedas con filtros; suscripciones a alertas (nuevas publicaciones, bajas de precio, vuelta al mercado); deduplicación de entregas.
- **Reverse-matching al alta de propiedad:** Al crearse un listing (manual, import o API) con source CRM/integración, se matchea contra perfiles de búsqueda activos; se muestra “X perfiles interesados” y se encola notificación para push a CRM.
- **Push a CRM:** Outbox (`CrmPushOutbox`) con reintentos (máx 5, backoff 1m–6h); webhook configurable (`CRM_WEBHOOK_URL`); payload `listing.matches_found`; script `pnpm --filter api crm:push:run`.
- **Operabilidad:** Endpoint de status `GET /admin/debug/crm-push` (counts, top FAILED); resend manual `POST /admin/debug/crm-push/:id/resend`; UI admin en `/crm-push` con tabla y botón Resend.

---

## Modo demo y gates

- **Modo demo:** `DEMO_MODE=1` habilita dataset demo (500+ listings), endpoints de status/listings-count y rutas debug/admin en condiciones controladas.
- **Gates:** Lint, format:check, typecheck, tests API (`pnpm audit:verify`). Smoke/demo completo: `pnpm demo:up`.
