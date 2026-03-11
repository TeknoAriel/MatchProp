# Alignment Checklist — Masterplan v3.0 ↔ Repo

**Mapeo requisitos Masterplan vs implementación actual**

| ID     | Requisito Masterplan                                        | Estado       | Evidencia en repo                                                        | Riesgo si no está | Próximo paso recomendado              |
| ------ | ----------------------------------------------------------- | ------------ | ------------------------------------------------------------------------ | ----------------- | ------------------------------------- |
| **1**  | UX Tinder: swipe LIKE/NOPE                                  | DONE         | `apps/api/src/routes/swipes.ts`, `feed.ts` exclude NOPE/LIKE             | Bajo              | —                                     |
| **2**  | UX Tinder: undo último swipe                                | DONE         | Web: undo en feed                                                        | Bajo              | —                                     |
| **3**  | UX Tinder: list view                                        | DONE         | GET `/feed/list`, cursor-based                                           | Bajo              | —                                     |
| **4**  | UX Tinder: performance hints                                | PARTIAL      | Cursor, feed-total-cache; sin virtualización explícita                   | Medio             | Revisar virtualización en lista larga |
| **5**  | Funnel anti-cierre: Lead PENDING/ACTIVE/CLOSED              | DONE         | `prisma/schema.prisma` Lead.status, migración sprint8_lead_funnel        | Alto              | —                                     |
| **6**  | Funnel anti-cierre: PII gating (no enviar PII hasta ACTIVE) | DONE         | KitepropIntegration.payloadTemplatePending/Active, delivery por etapa    | Bajo              | —                                     |
| **7**  | Chat controlado (solo ACTIVE) + filtro anti-PII             | DONE         | Modelo Message, POST/GET /leads/:id/messages, trackEvent message_blocked | Bajo              | —                                     |
| **8**  | Agenda de visitas (solo ACTIVE)                             | DONE         | Modelo Visit, POST/GET /leads/:id/visits, GET /me/visits                 | Bajo              | —                                     |
| **9**  | Búsquedas activas + alertas NEW/PRICE_DROP/BACK_ON_MARKET   | DONE         | `alerts.ts`, `alerts-runner`, AlertSubscription, AlertDelivery, dedupe   | Bajo              | —                                     |
| **10** | Asistente texto → SearchFilters                             | DONE         | `assistant/search-parser`, POST /assistant/search, /assistant/render     | Bajo              | —                                     |
| **11** | Asistente audio                                             | OUT OF SCOPE | —                                                                        | —                 | Pendiente decisión producto           |
| **12** | Monetización B2B/B2C (wallet, premium, Stripe)              | NOT STARTED  | User.premiumUntil existe; no wallet ni Stripe                            | Medio             | Definir scope monetización            |
| **13** | Adapter Kiteprop: config, spec, template, test, encryption  | DONE         | `integrations.ts`, `payload-template`, `crypto.ts`, lastTestOk           | Bajo              | —                                     |
| **14** | Adapter otros CRMs / scrapers behind flags                  | PARTIAL      | API_PARTNER_1, KITEPROP_EXTERNALSITE; flags implícitos en env            | Medio             | Formalizar feature flags              |
| **15** | Analytics (events + dashboards)                             | DONE         | trackEvent, modelo AnalyticsEvent, eventos en leads/demo                 | Bajo              | —                                     |
| **16** | Portal SEO                                                  | NOT STARTED  | —                                                                        | Bajo              | Definir scope                         |
| **17** | Observabilidad: logs sin PII, healthcheck                   | DONE         | `app.ts` onResponse, requestId, /health                                  | Bajo              | —                                     |
| **18** | Observabilidad: retries / idempotencia                      | DONE         | LeadDeliveryAttempt, AlertDelivery dedupe                                | Bajo              | —                                     |
| **19** | Operación: start/start:check, smoke e2e, demo data          | DONE         | `package.json`, dev-up.sh, smoke-ux.sh, demo:data                        | Bajo              | —                                     |
