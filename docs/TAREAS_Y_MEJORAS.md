# Tareas y mejoras — MatchProp

Documento vivo: próximas tareas priorizadas y mejoras técnicas. Alineado a [masterplan.md](./masterplan.md) y [ALINEACION_MASTERPLAN.md](./ALINEACION_MASTERPLAN.md).

---

## Estado de referencia

- **Epics E1–E8:** Implementados (feed, leads, chat, visitas, búsquedas/alertas, asistente conversacional, Stripe opcional, Kiteprop + Yumblin/iCasas).
- **Deploy:** Vercel (Web + API) + Neon (PostgreSQL). Ver [SETUP_DEPLOY_SIMPLE.md](./SETUP_DEPLOY_SIMPLE.md) y [PROD.md](./PROD.md).

---

## Próximas tareas (priorizadas)

### Alta prioridad

| Tarea | Descripción | DoD |
|-------|-------------|-----|
| **Smoke E2E en CI** | Ejecutar `pnpm smoke:ux` en pipeline (o job manual post-deploy) para validar flujos críticos. | Job configurado; falla del smoke bloquea o alerta. |
| **Migraciones en deploy** | Asegurar que migraciones se ejecuten contra DB de prod en cada deploy (script o Vercel build step). | Documentado en PROD; ejecución automatizada o checklist. |
| **Mercado Pago (LATAM)** | Payment adapter: Mercado Pago como provider (planificación en E7). | Spec + feature flag; integración opcional. |

### Media prioridad

| Tarea | Descripción | DoD |
|-------|-------------|-----|
| **Analytics trackEvent** | Modelo/helper `trackEvent` sin PII; eventos mínimos (vistas, guardados, activaciones). | Endpoint o servicio; sin exponer PII en logs. |
| **Virtualización lista** | Lista larga en feed/list con virtualización para mejor performance. | Scroll fluido con muchos ítems. |
| **Portal SEO** | Páginas públicas indexables (landing, búsquedas por zona). | Meta tags, sitemap. |
| **Dashboard analytics** | Vistas básicas para admin (leads, alertas, matches). | Solo lectura; datos agregados. |

### Mejoras técnicas

| Mejora | Descripción |
|--------|-------------|
| **Deprecación Vite CJS** | Resolver warning "CJS build of Vite's Node API is deprecated" en tests API (Vitest). |
| **Fastify json schema** | Reemplazar shorthand schema en ruta `/listings/share` (FSTDEP021) por objeto completo para Fastify v5. |
| **Punycode** | Sustituir uso de `punycode` por alternativa userland si Node lo depreca. |
| **Admin ESLint** | Mantener reglas react-hooks (ej. dependencias de useEffect) sin warnings en build. |

---

## Validación continua

- **Local:** `pnpm run pre-deploy:verify` (build + typecheck + test:all).
- **E2E:** `pnpm smoke:ux` (requiere API + Web levantados; script los inicia).
- **Producción:** `pnpm smoke:prod` (curl a URLs de prod); verificar `/health` y login.

---

## Referencias

- [DEPLOY_CHECKLIST.md](./DEPLOY_CHECKLIST.md) — Pre-deploy, deploy, post-deploy.
- [FEATURE_FLAGS.md](./FEATURE_FLAGS.md) — Flags por entorno.
- [backlog.md](./backlog.md) — Backlog maestro por Epic (algunos estados históricos).

---

*Última actualización: alineado a estado actual post-deploy y ALINEACION_MASTERPLAN.*
