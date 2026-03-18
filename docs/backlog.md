# Backlog Maestro — MatchProp

**Priorizado según Masterplan v3.0**

---

## Epics (E1–E8)

### E1 — UX Tinder (Feed + Swipe + Lista)

| Objetivo                         | Tickets                          | Definition of Done                                       |
| -------------------------------- | -------------------------------- | -------------------------------------------------------- |
| Feed Tinder + lista, swipe, undo | MVP: DONE                        | Feed cursor, swipe NOPE/LIKE, undo, list view operativos |
|                                  | Next: virtualización lista larga | —                                                        |
|                                  | Later: ranking avanzado          | —                                                        |

### E2 — Funnel anti-cierre (Leads PENDING/ACTIVE/CLOSED)

| Objetivo                      | Tickets                   | Definition of Done                                                            |
| ----------------------------- | ------------------------- | ----------------------------------------------------------------------------- |
| Lead PENDING hasta activación | MVP: DONE                 | Lead.status PENDING/ACTIVE/CLOSED, POST /leads/:id/activate, ActivationReason |
|                               | Next: Kiteprop por etapas | payloadTemplatePending vs payloadTemplateActive                               |
|                               | Later: —                  | —                                                                             |

### E3 — Chat controlado + filtro anti-PII

| Objetivo                      | Tickets                              | Definition of Done                                                               |
| ----------------------------- | ------------------------------------ | -------------------------------------------------------------------------------- |
| Chat solo ACTIVE, bloqueo PII | MVP: NOT STARTED                     | Modelo Message, GET/POST /leads/:id/messages, filtro anti-PII, tests integración |
|                               | Next: UI chat                        | —                                                                                |
|                               | Later: notificaciones en tiempo real | —                                                                                |

### E4 — Agenda de visitas

| Objetivo                 | Tickets                    | Definition of Done                                                  |
| ------------------------ | -------------------------- | ------------------------------------------------------------------- |
| Slots visita solo ACTIVE | MVP: NOT STARTED           | Modelo Visit, POST/GET /leads/:id/visits, scheduledAt futuro, tests |
|                          | Next: UI agenda            | —                                                                   |
|                          | Later: calendario avanzado | —                                                                   |

### E5 — Búsquedas activas + Alertas

| Objetivo                             | Tickets                          | Definition of Done                                     |
| ------------------------------------ | -------------------------------- | ------------------------------------------------------ |
| SavedSearch + alertas NEW/PRICE/BACK | MVP: DONE                        | AlertSubscription, AlertDelivery, dedupe, ListingEvent |
|                                      | Next: —                          | —                                                      |
|                                      | Later: frecuencia personalizable | —                                                      |

### E6 — Asistente de búsqueda

| Objetivo                     | Tickets                   | Definition of Done                                       |
| ---------------------------- | ------------------------- | -------------------------------------------------------- |
| Parser texto → SearchFilters | MVP: DONE                 | POST /assistant/search, /assistant/render, search-parser |
|                              | Next: LLM real (opcional) | —                                                        |
|                              | Later: audio              | Out of scope por ahora                                   |

### E7 — Monetización (B2B/B2C)

| Objetivo                             | Tickets                     | Definition of Done                                                                              |
| ------------------------------------ | --------------------------- | ----------------------------------------------------------------------------------------------- |
| premiumUntil, wallet B2B, Stripe B2C | MVP: PARTIAL                | User.premiumUntil existe                                                                        |
|                                      | Next: Sprint 9 — wallet B2B | Wallet B2B + Premium B2C (Stripe) + webhooks                                                    |
|                                      | Later: Stripe premium B2C   | —                                                                                               |
| **Epic Payments (planificación)**    | Sprint 9                    | Mercado Pago provider LATAM; Stripe provider wallets (Apple Pay/Google Pay). Fuera de Sprint 8. |

### E8 — Adapter layer + Analytics + Portal SEO

| Objetivo            | Tickets                       | Definition of Done                                             |
| ------------------- | ----------------------------- | -------------------------------------------------------------- |
| Kiteprop completo   | MVP: DONE                     | config, spec, template, test, encryption, attempts, retry      |
| Difusiones Kiteprop | Sprint 8.2: DONE              | Zonaprop (XML), Toctoc (JSON), iCasas (JSON); fixtures + tests |
|                     | Next: trackEvent              | Modelo AnalyticsEvent, helper trackEvent, sin PII              |
|                     | Later: dashboards, portal SEO | —                                                              |

---

## Prioridad próximos sprints

### Sprint 8 — Anti-cierre completo (recomendado)

1. Chat controlado (solo ACTIVE) + filtro anti-PII
2. Agenda de visitas (slots básicos)
3. Kiteprop por etapas (payloadTemplatePending vs payloadTemplateActive)
4. Analytics mínimos (trackEvent)
5. Smoke UX actualizado con activate

**Gates**: pnpm -r typecheck, pnpm --filter api test:all, smoke:ux PASS.

### Sprint 8.3 — Stabilization UX Contract (DONE)

1. Barra de búsqueda activa global (GET/POST /me/active-search, ActiveSearchBar).
2. Guardar búsqueda siempre visible en assistant; al guardar se setea búsqueda activa.
3. Alertas siempre visibles en /searches/:id y /alerts; dedupe suscripciones.
4. Feed/List filtrado por búsqueda activa; banner CTA si no hay activa.
5. Smoke e2e cubre contrato UX (barra, guardar, alertas, feed filtrado).

### Sprint 9 — Monetización (Payments plan)

1. **Wallet B2B** (inmobiliarias)
2. **Premium B2C** (Stripe) + webhooks
3. **Payment Adapter Layer:** Mercado Pago como provider LATAM; Stripe como provider para Apple Pay/Google Pay y tarjetas internacionales
4. Feature flags formalizados (demo off en prod)
5. _Nota: no implementar en Sprint 8_

**Alternativas**:

- Sprint 8a: Solo chat + filtro anti-PII (reducido)
- Sprint 8b: Kiteprop por etapas + smoke (sin chat/agenda)

---

## Deuda Técnica

### DT-001 — Infraestructura de imágenes escalable

| Prioridad | Baja (mientras < 50K propiedades) |
|-----------|-----------------------------------|
| **Estado** | Pendiente |
| **Trigger** | Escalar a > 50,000 propiedades o problemas de hot-linking |

**Situación actual:**
- URLs directas a `static.kiteprop.com` (CDN de Kiteprop)
- Costo: $0
- ~245,000 fotos en `ListingMedia`
- Funciona para 15,613 propiedades actuales

**Problema potencial:**
- Dependencia de CDN de terceros
- Posible bloqueo de hot-linking por portales
- Sin control sobre optimización/transformaciones
- No escalable a 150K+ propiedades con 1.5M imágenes

**Solución propuesta:**
1. **Etapa 1 (50K-150K props):** Cloudflare R2 + Workers (~$30/mes)
   - Almacenamiento propio
   - Egress gratis
   - Transformaciones on-the-fly

2. **Etapa 2 (150K+ props):** Cloudflare Images o imgix (~$150/mes)
   - Transformaciones automáticas (WebP, resize)
   - CDN global optimizado
   - Blurhash para placeholders

**Documentación:** `docs/ARQUITECTURA_IMAGENES.md`

---

### DT-002 — Motor de búsqueda avanzado (Meilisearch/Elasticsearch)

| Prioridad | Baja |
|-----------|------|
| **Estado** | Pendiente - implementar cuando sea necesario |
| **Trigger** | Búsqueda PostgreSQL se vuelve lenta o necesidad de full-text |

**Situación actual:**
- Búsqueda con `LIKE` en PostgreSQL
- Funciona bien para 15K-50K propiedades

**Opciones cuando sea necesario:**
- Meilisearch (más simple, hosting ~$30/mes)
- Elasticsearch (más potente, hosting ~$50/mes)
- Algolia (SaaS, ~$50/mes para 50K docs)

**Beneficios futuros:**
- Búsqueda full-text con typo-tolerance
- Autocompletado instantáneo
- Filtros combinados eficientes
