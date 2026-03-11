# Gap Check — Auditoría de brechas

**Brechas entre Masterplan v3.0 y estado actual del repo**

---

## 1) Gaps funcionales (ordenados por impacto)

| Impacto | Gap                        | Descripción                                                                                              |
| ------- | -------------------------- | -------------------------------------------------------------------------------------------------------- |
| Medio   | Monetización B2B/B2C       | premiumUntil existe; no hay wallet, pagos Stripe, ni flujo formal B2B.                                   |
| Medio   | Feature flags formalizados | Demo sources (KITEPROP_EXTERNALSITE, API_PARTNER_1) por env; documentar "off en prod" en PROD.md (DONE). |
| Bajo    | Listas con nombre          | Cerrado — SavedList + SavedListItem, API /me/lists, modal "Agregar a lista".                             |
| Bajo    | Portal SEO                 | No definido.                                                                                             |
| Bajo    | Asistente audio/LLM real   | Out of scope por ahora.                                                                                  |

**Cerrados en sprint completamiento:** Chat controlado + filtro anti-PII, Agenda de visitas, Kiteprop por etapas, Analytics mínimos.

---

## 2) Gaps técnicos (observabilidad, performance, seguridad)

| Categoría          | Gap                                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| **Observabilidad** | No hay métricas (Prometheus/StatsD); no hay dashboards; healthcheck básico sin chequeo DB                |
| **Performance**    | Sin virtualización explícita en lista larga; processor síncrono (sin cola real para leads)               |
| **Seguridad**      | Filtro anti-PII en chat implementado (message_blocked); contacto fuera de plataforma limitado por funnel |
| **Spec Kiteprop**  | No auto-descubierto; spec se guarda manualmente                                                          |
| **Node version**   | engines.node >=18; riesgo drift entre local/CI/prod                                                      |

---

## 3) Riesgos

| Riesgo                          | Categoría | Mitigación actual                                                   |
| ------------------------------- | --------- | ------------------------------------------------------------------- |
| Scraping / ToS fuentes externas | Legal     | KITEPROP_EXTERNALSITE, API_PARTNER_1; revisar ToS antes de prod     |
| PII en logs                     | Seguridad | Logs con requestId, route, responseTime; no emails; userId opcional |
| Contacto fuera de plataforma    | Producto  | Funnel PENDING→ACTIVE limita envío; chat controlado pendiente       |
| Anti-cierre incomplete          | Producto  | Resuelto — payloadTemplatePending vs Active implementado            |
| Processor falla sin retry       | Técnico   | LeadDeliveryAttempt guarda estado; retry manual en UI               |

---

## 4) Deuda controlada

| Item                      | Estado                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------------- |
| Demo sources              | KITEPROP_EXTERNALSITE_MODE=fixture, API_PARTNER_1; documentar "off en prod" en PROD.md |
| Migraciones IF NOT EXISTS | Varias migraciones idempotentes; consolidar con cuidado                                |
| Fixtures ingest           | kiteprop-sample.min.json, partner1-sample.json para CI                                 |
| smoke:ux retries          | Playwright retries en CI; firefox/chromium por SO                                      |
| Deprecation punycode      | Warning en tests; migrar a alternativa userland                                        |

---

## 5) Recomendación próximo sprint

**Principal: Sprint completamiento — Listas con nombre**

- SavedList + SavedListItem
- API: POST/GET /me/lists, POST /me/lists/:id/items
- UI: modal "Agregar a lista" → crear y agregar a lista con nombre

**Alternativas:**

- Feature flags formales en config
- Portal SEO (scope a definir)

---

## No se debe reescribir

| Decisión actual                   | Soporta escalabilidad             |
| --------------------------------- | --------------------------------- |
| Lead PENDING/ACTIVE/CLOSED        | Sí — base para funnel anti-cierre |
| Cursor-based feed                 | Sí — paginación eficiente         |
| AlertDelivery dedupe              | Sí — idempotencia en alertas      |
| LeadDeliveryAttempt               | Sí — trazabilidad y retry         |
| Kiteprop encryption (AES-256-GCM) | Sí — secrets seguros              |
| Rate limits (global + auth)       | Sí — protección básica            |
| Migraciones IF NOT EXISTS         | Sí — reaplicación segura          |
