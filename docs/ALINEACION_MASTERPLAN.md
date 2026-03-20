# Alineación al Masterplan — Estado actual

Documento de referencia: **[masterplan.md](./masterplan.md)** (Frozen v3.0).

---

## Resumen ejecutivo

- **Epics E1–E8:** Implementados según spec (feed, leads PENDING/ACTIVE, chat anti-PII, visitas, búsquedas/alertas, asistente, monetización Stripe opcional, Kiteprop + importadores).
- **UX:** Layout con sidebar fija y scroll en contenido; Asistente con título "Buscar", CTAs "Ver listado", "Guardar" (alineados a tests E2E).
- **Settings:** API Universal, Pasarela de pago (Stripe), Asistente IA (usuario/contraseña, API key, token), Asistente de voz (misma config).
- **Importadores:** Kiteprop (Yumblin, iCasas) listos para producción; en prod no usar `fixture` (ver PROD.md).
- **Tests:** `pnpm --filter api test:all` (131 tests) y smoke E2E (`pnpm smoke:ux`) alineados a la UI actual.

---

## Epics vs implementación

| Epic                                    | Estado       | Notas                                                                                                                             |
| --------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| **E1** UX Tinder (Feed + Swipe + Lista) | ✅           | Feed, lista, swipe LIKE/NOPE, undo, empty state                                                                                   |
| **E2** Funnel anti-cierre (Leads)       | ✅           | PENDING → ACTIVE/CLOSED, premiumUntil, LeadEvent                                                                                  |
| **E3** Chat controlado + anti-PII       | ✅           | Chat solo lead ACTIVE, filtro bloqueo PII                                                                                         |
| **E4** Agenda de visitas                | ✅           | Visit, POST/GET /leads/:id/visits                                                                                                 |
| **E5** Búsquedas activas + Alertas      | ✅           | SavedSearch, AlertSubscription, AlertDelivery, runner                                                                             |
| **E6** Asistente de búsqueda            | ✅           | Parser texto→SearchFilters; **+ Asistente conversacional** por API key/token (OpenAI/Anthropic); UI: Buscar, Ver listado, Guardar |
| **E7** Monetización B2B/B2C             | ✅ (parcial) | Stripe opcional (Premium B2C); wallet B2B (débito leads)                                                                          |
| **E8** Adapter + Analytics              | ✅ (parcial) | Kiteprop config/spec/cifrado; importadores Yumblin, iCasas; analytics mínimos                                                     |

---

## UX contract (MVP) — etiquetas actuales en UI

- **Barra de búsqueda activa:** En /feed, /feed/list, /assistant, /searches, /alerts: "Sin búsqueda activa" + "Crear búsqueda" o resumen + Cambiar / Alertas / Limpiar.
- **Asistente (/assistant):** Título **"Buscar"**. Con filtros detectados: **"Ver listado"**, **"Guardar"**, Activar alertas. (En masterplan se nombran conceptualmente "Ver resultados ahora" y "Guardar búsqueda"; en UI actual son "Ver listado" y "Guardar".)
- **Feed/List:** Filtrado por búsqueda activa; sin activa, CTA crear/guardar búsqueda.
- **Alertas:** En /searches/:id sección Alertas; /alerts lista suscripciones con enlace a búsqueda.
- **Layout:** Sidebar fija, contenido con scroll (`overflow-y-auto`) para evitar menús que se salgan de pantalla.

---

## Settings e integraciones

| Sección          | Ruta                                   | Descripción                                          |
| ---------------- | -------------------------------------- | ---------------------------------------------------- |
| API Universal    | /settings/integrations/api-universal   | Estado y documentación de la API pública             |
| Pasarela de pago | /settings/integrations/payments        | Estado Stripe (checkout, webhook)                    |
| Asistente IA     | /settings/integrations/assistant       | Usuario, contraseña, API key, token (cifrados en DB) |
| Asistente de voz | /settings/integrations/assistant-voice | Misma configuración que Asistente IA, página propia  |

API del asistente: `POST /assistant/chat` usa credenciales de `AssistantConfig` (API key o token según provider).

---

## Importadores (Kiteprop) y cron

- **Yumblin / iCasas:** Conectores en `IngestSourceConfig.sourcesJson` (o env). En **producción** no usar modo `fixture`; dejar que consuman URL real desde config o variables de entorno. Ver **PROD.md** → "Demo sources OFF en prod".
- **Conexiones activas:** `getActiveIngestSources()` lee IngestSourceConfig y devuelve solo fuentes con URL; en prod se excluyen ejemplos (API_PARTNER_1, fixture).
- **Cron horario:** `pnpm --filter api ingest:cron` recorre las conexiones activas con cursor (SyncWatermark) para nuevas propiedades y actualización de precios/estado. Ver [INGEST_CRON_Y_ACTUALIZACIONES.md](./INGEST_CRON_Y_ACTUALIZACIONES.md).

---

## Producción y deploy

- **Checklist pre-deploy:** [PROD.md](./PROD.md) (DEMO_MODE=0, COOKIE_SECURE, CORS, migraciones, demo sources OFF).
- **Comandos:** `pnpm run deploy:pre` (migraciones), `pnpm run pre-deploy:verify` (build + typecheck + test:all), luego `git push origin main` para disparar deploy en Vercel.
- **URLs:** Web y API según [SETUP_DEPLOY_SIMPLE.md](./SETUP_DEPLOY_SIMPLE.md) (Vercel + Neon).

---

## Validación

- **Tests API (múltiples usuarios):** `pnpm --filter api test:all`
- **Smoke E2E (flujos completos):** `pnpm smoke:ux` (levanta API + Web, ejecuta Playwright con usuario smoke-ux@matchprop.com)
- **Producción:** `pnpm smoke:prod` (curl a Web + API/health en prod)

---

## Próximas tareas y mejoras

Ver **[TAREAS_Y_MEJORAS.md](./TAREAS_Y_MEJORAS.md)** — prioridad (smoke en CI, migraciones en deploy, Mercado Pago), mejoras técnicas (deprecaciones, ESLint) y referencias.

---

_Última actualización: alineado a masterplan v3.0 y estado post–Sprint 14 / integraciones._
