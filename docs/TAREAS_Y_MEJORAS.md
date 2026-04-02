# Tareas y mejoras — MatchProp

Documento vivo: próximas tareas priorizadas y mejoras técnicas. Alineado a [masterplan.md](./masterplan.md) y [ALINEACION_MASTERPLAN.md](./ALINEACION_MASTERPLAN.md).

## Cómo se reparte con el backlog

| Documento                                      | Uso                                                                                                        |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Este archivo (`TAREAS_Y_MEJORAS.md`)**       | Cola **operativa** (próximas semanas): mejoras concretas, estado “hecho / parcial / pendiente”.            |
| **[backlog.md](./backlog.md)**                 | Vista por **Epic** (E1–E8), ideas Next/Later y **deuda técnica** (DT-xxx); puede incluir filas históricas. |
| **[FOCO_2026.md](./FOCO_2026.md)**             | Prioridades de producto del trimestre (north star, en foco / fuera de foco).                               |
| **[PLAN_DE_TRABAJO.md](./PLAN_DE_TRABAJO.md)** | Plan con hitos, sprints (1–6) y tareas por sprint — roadmap 3 meses.                                       |

Regla: **no duplicar** la misma tarea en detalle en ambos; en `backlog` va la épica/ticket; aquí el seguimiento cercano.

---

## Estado de referencia

- **Epics E1–E8:** Implementados (feed, leads, chat, visitas, búsquedas/alertas, asistente conversacional, Stripe opcional, Kiteprop + Properstar/iCasas).
- **Deploy:** Vercel (Web + API) + Neon (PostgreSQL). Ver [SETUP_DEPLOY_SIMPLE.md](./SETUP_DEPLOY_SIMPLE.md) y [PROD.md](./PROD.md).
- **Cron Jobs:** Sincronización automática cada 6 horas con detección de cambios de precio/estado.
- **Datos:** 331 propiedades de Kiteprop (solo datos reales, sin demo).

**Última ejecución de tareas:** Cron job sync propiedades (6h), mejora parser ubicaciones, limpieza datos demo.

---

## Próximas tareas (priorizadas)

### Alta prioridad

| Tarea                     | Descripción                                                                                         | DoD                                                      | Estado                                                                                                                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Cron sync propiedades** | Sincronización automática cada 6 horas desde Kiteprop.                                              | Cron configurado en Vercel; eventos de precio/estado.    | **Hecho:** `/cron/ingest` con CRON_SECRET, `/cron/status` público.                                                                                                                   |
| **Smoke E2E en CI**       | Ejecutar `pnpm smoke:ux` en pipeline (o job manual post-deploy) para validar flujos críticos.       | Job configurado; falla del smoke bloquea o alerta.       | **Parcial:** job `deploy-verify` en CI ejecuta `pre-deploy:verify` (build + typecheck + test:all) con Postgres; smoke:ux con Playwright sigue siendo opcional (manual o job aparte). |
| **Migraciones en deploy** | Asegurar que migraciones se ejecuten contra DB de prod en cada deploy (script o Vercel build step). | Documentado en PROD; ejecución automatizada o checklist. | **Hecho:** PROD.md actualizado (estrategia migraciones: ejecutar deploy:pre contra DB prod; Vercel no las corre; CI usa DB de prueba).                                               |
| **Mercado Pago (LATAM)**  | Payment adapter: Mercado Pago como provider (planificación en E7).                                  | Spec + feature flag; integración opcional.               | **Hecho:** Adapter MP, checkout, webhook IPN. Ver `docs/MERCADOPAGO_SETUP.md`.                                                                                                       |

### Media prioridad

| Tarea                    | Descripción                                                                            | DoD                                           |
| ------------------------ | -------------------------------------------------------------------------------------- | --------------------------------------------- |
| **Analytics trackEvent** | Modelo/helper `trackEvent` sin PII; eventos mínimos (vistas, guardados, activaciones). | Endpoint o servicio; sin exponer PII en logs. |
| **Virtualización lista** | Lista larga en feed/list con virtualización para mejor performance.                    | Scroll fluido con muchos ítems.               |
| **Portal SEO**           | Páginas públicas indexables (fichas, zonas, sitemap dinámico).                         | **Parcial:** ver § Sprint 4 siguiente.        |
| **Dashboard analytics**  | Vistas básicas para admin (leads, alertas, matches).                                   | Solo lectura; datos agregados.                |

### Mejoras técnicas

| Mejora                   | Descripción                                                                          | Estado                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| **Deprecación Vite CJS** | Resolver warning "CJS build of Vite's Node API is deprecated" en tests API (Vitest). | Pendiente.                                                                                                          |
| **Fastify json schema**  | Reemplazar shorthand schema (FSTDEP021) por objeto completo para Fastify v5.         | **Hecho:** `/listings/share`, `/universal/feed`, `/universal/listings`: querystring con type: 'object', properties. |
| **Punycode**             | Sustituir uso de `punycode` por alternativa userland si Node lo depreca.             | Pendiente.                                                                                                          |
| **Admin ESLint**         | Mantener reglas react-hooks (ej. dependencias de useEffect) sin warnings en build.   | Hecho (visits: useCallback).                                                                                        |

### Sprint 4 — siguiente cola (después de fichas públicas + sitemap)

1. **Landing pública (plan 4.2):** home con H1 claro, bloques de valor, CTAs a login/feed; meta `description` específica.
2. **Lighthouse SEO:** objetivo > 90 en `/` y `/listing/[id]` (títulos, contraste, alt en imágenes donde aplique).
3. **JSON-LD opcional:** `RealEstateListing` o `Product` en el layout de ficha (coherente con datos públicos ya expuestos).
4. **Ops:** en Vercel (proyecto Web) definir `API_SERVER_URL` apuntando a la API pública para que `generateMetadata` y `sitemap.ts` resuelvan bien en build/ISR (en local ya usa `http://127.0.0.1:3001`).
5. **Si hiciera falta:** rate limit dedicado en API para `/public/listings/*` frente a crawlers agresivos.

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

_Última actualización: 2026-03-27 — Sprint 4 fichas/sitemap; cola SEO arriba._
