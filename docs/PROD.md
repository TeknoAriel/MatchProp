# Producción — MatchProp

Guía operativa para entorno producción.

---

## Checklist pre-deploy

- [ ] **DEMO_MODE=0** en API (obligatorio en prod; feature flag principal)
- [ ] `COOKIE_SECURE=true` en API
- [ ] `CORS_ORIGINS` con dominios reales (separados por coma)
- [ ] `JWT_SECRET` y `AUTH_REFRESH_SECRET` generados (no valores dev)
- [ ] `DATABASE_URL` apuntando a PostgreSQL de prod
- [ ] Migraciones aplicadas: `pnpm run deploy:pre` o `scripts/deploy-pre.sh`
- [ ] Demo sources OFF: ver sección **Demo sources OFF en prod** abajo.

---

## Demo sources OFF en prod

Antes de ir a producción, asegurarse de que **no** haya fuentes ni datos de demo activos:

- **DEMO_MODE=0** (obligatorio). Con `DEMO_MODE=1` se permiten demo data y rutas de demo.
- **KITEPROP_EXTERNALSITE_MODE** — no usar valor `fixture`; en prod debe estar desactivado o apuntar a entorno real.
- **KITEPROP_DIFUSION_YUMBLIN_MODE** — no setear `fixture` en prod; sin setear usa URL de IngestSourceConfig o env para consumir propiedades reales.
- **KITEPROP_DIFUSION_ICASAS_MODE** — no setear `fixture` en prod; sin setear usa URL de IngestSourceConfig o env para consumir propiedades reales.
- **API_PARTNER_1** — fuente de listings demo; queda desactivada cuando `DEMO_MODE=0`.
- **DEMO_LISTINGS_COUNT** — no setear en prod (o `0`). Solo tiene efecto con `DEMO_MODE=1`.
- Scripts **demo:reset-and-seed** y **demo:data** — no ejecutar en prod; requieren `DEMO_MODE=1`.

Con **DEMO_MODE=0**, los feature flags `demoMode`, `kitepropExternalsite` y `apiPartner1` quedan en `false` (ver **Feature flags** más abajo).

---

## Comandos

| Comando                         | Descripción                                                                                                                                                       |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm run deploy:pre`           | Pre-deploy: prisma generate + migrate deploy                                                                                                                      |
| `pnpm run pre-deploy:verify`    | Verificación: build shared + typecheck + build api/web/admin + test:all (sin smoke)                                                                               |
| `pnpm build`                    | Build de todo el monorepo                                                                                                                                         |
| `pnpm --filter api start`       | Inicia API (tras build)                                                                                                                                           |
| `pnpm --filter web start`       | Inicia Web (tras build)                                                                                                                                           |
| `pnpm --filter api ingest:cron` | Cron horario: recorre conexiones activas (IngestSourceConfig), actualiza propiedades. Ver [INGEST_CRON_Y_ACTUALIZACIONES.md](./INGEST_CRON_Y_ACTUALIZACIONES.md). |

---

## Docker API

```bash
# Build desde raíz del repo
docker build -f apps/api/Dockerfile -t matchprop-api .

# Run (requiere DATABASE_URL, CORS_ORIGINS, etc.)
docker run -p 3001:3001 --env-file apps/api/.env matchprop-api
```

**Importante:** ejecutar migraciones antes del start (por ejemplo, como job de CI o en el entrypoint del deploy).

---

## Health check

`GET /health` devuelve:

- **200** si DB responde OK: `{ status: "ok", timestamp, db: "ok" }`
- **503** si DB falla: `{ status: "degraded", timestamp, db: "error" }`

Usar para healthcheck (Vercel, Kubernetes, etc.).

---

## Objetivos producción

- API y Web disponibles con alta disponibilidad
- Base de datos PostgreSQL respaldada
- Logs sin PII, métricas básicas
- Migraciones aplicadas de forma controlada
- Demo sources desactivados en prod

---

## Variables de entorno

### API

| Variable                | Requerido         | Descripción                                                                                      |
| ----------------------- | ----------------- | ------------------------------------------------------------------------------------------------ |
| PORT                    | No (default 3001) | Puerto API                                                                                       |
| DATABASE_URL            | Sí                | URL PostgreSQL                                                                                   |
| JWT_SECRET              | Sí                | Secret JWT (no usar valor dev)                                                                   |
| AUTH_REFRESH_SECRET     | Sí                | Secret refresh token                                                                             |
| APP_URL                 | Sí                | URL pública de la app                                                                            |
| API_PUBLIC_URL          | Sí                | URL pública de la API                                                                            |
| CORS_ORIGINS            | Sí                | Orígenes permitidos                                                                              |
| COOKIE_SECURE           | Sí                | true en prod (HTTPS)                                                                             |
| INTEGRATIONS_MASTER_KEY | Sí (Kiteprop)     | Clave para cifrar API keys                                                                       |
| STRIPE_SECRET_KEY       | No (Premium B2C)  | Stripe para checkout Premium                                                                     |
| STRIPE_WEBHOOK_SECRET   | No (Premium B2C)  | Webhook Stripe para premiumUntil                                                                 |
| LEAD_DEBIT_CENTS        | No (default 100)  | Débito por activar lead (centavos)                                                               |
| PREMIUM_FREE            | No (solo pruebas) | 1 = planes liberados (listas, activar leads). No usar en prod cuando apliquen reglas de negocio. |

**Integraciones (Settings):** Asistente IA (y Asistente de voz) y API Universal se configuran desde la UI en /settings/integrations (usuario, API key, token). Las credenciales se guardan cifradas en DB con `INTEGRATIONS_MASTER_KEY`. No hay variables de entorno adicionales obligatorias para el asistente conversacional.

### Auth / Rate limit

- AUTH_RATE_LIMIT_MAX (default 10)
- AUTH_RATE_LIMIT_WINDOW_MS (default 60000)

### Demo sources (OFF en prod)

- **DEMO_MODE=0** (obligatorio en prod). Solo con DEMO_MODE=1 se permiten demo sources y demo data.
- KITEPROP_EXTERNALSITE_MODE: no usar fixture
- API_PARTNER_1: desactivar
- DEMO_LISTINGS_COUNT: 0 o no setear

---

## Observabilidad recomendada

- Logs: requestId, route, statusCode, responseTime; sin PII
- Healthcheck: GET /health (incluye chequeo DB; 503 si DB falla)
- Métricas: latencia por ruta, errores 4xx/5xx
- Alertas: API down, error rate, DB pool

---

## Seguridad

- Cookies JWT con secure=true en prod
- Rate limit: global 100/min, auth 10/min
- Anti-enumeración magic link (siempre 200)
- INTEGRATIONS_MASTER_KEY para cifrado API keys
- Filtro anti-PII en chat (implementado — message_blocked)

---

## Estrategia migraciones

1. **Pre-deploy:** ejecutar `pnpm run deploy:pre` (o `DATABASE_URL="..." pnpm --filter api exec prisma migrate deploy`) contra la DB de producción **antes** o justo después de cada deploy. Vercel no ejecuta migraciones; hay que correrlas desde tu máquina, un job de CI con acceso a prod, o un script de release.
2. **CI:** el job `deploy-verify` en GitHub Actions corre migraciones contra una Postgres de CI y luego `pre-deploy:verify` (build + test:all); eso no actualiza la DB de prod.
3. **Rollback:** backups pre-migración.
4. **Idempotencia:** migraciones con IF NOT EXISTS cuando aplique.

---

## Feature flags (Sprint 9)

**Ver también:** [FEATURE_FLAGS.md](./FEATURE_FLAGS.md) — flags por env y uso en código.

**Dónde se leen:** `apps/api/src/config.ts`. El objeto `featureFlags` y `config` se construyen a partir de **variables de entorno** al arrancar la API. No hay archivo de config externo: para cambiar un flag en prod se ajusta el env (ej. `DEMO_MODE=0`) y se reinicia el proceso.

| Flag                 | Env / lógica                                                    | Prod                |
| -------------------- | --------------------------------------------------------------- | ------------------- |
| demoMode             | `DEMO_MODE === '1'`                                             | **0** (obligatorio) |
| stripePremium        | `STRIPE_SECRET_KEY` presente                                    | Opcional            |
| kitepropExternalsite | `KITEPROP_EXTERNALSITE_MODE === 'fixture' && DEMO_MODE === '1'` | **OFF**             |
| apiPartner1          | `DEMO_MODE === '1'`                                             | **OFF**             |

**Obligatorios en producción:**

- **DEMO_MODE=0** — Demo sources y demo data desactivados.
- **KITEPROP_EXTERNALSITE_MODE** — No usar `fixture`; el flag solo actúa si DEMO_MODE=1.
- **API_PARTNER_1** — Fuente de datos demo; desactivada si DEMO_MODE=0.

---

## Runbook mínimo

| Situación | Acción |
|-----------|--------|
| Smoke prod falla | Ver [ESTABILIDAD_Y_RELEASE.md](./ESTABILIDAD_Y_RELEASE.md) → Runbook Smoke prod falla |
| API 503 (health check) | Revisar DATABASE_URL, pool de conexiones; reiniciar API en Vercel |
| Rollback urgente | Revert commit en main vía PR; Vercel redeploya automáticamente |
| Migración fallida | Backups; crear migración de rollback; `prisma migrate deploy` contra prod |

---

## Monetización B2B/B2C — Validación pre-prod

- [ ] **Stripe Premium B2C:** STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET configurados.
- [ ] **Webhook Stripe:** URL pública registrada en Stripe Dashboard; verificación de firma OK.
- [ ] **Checkout session:** Flujo "Suscribirme" en /me/premium termina en Stripe Checkout.
- [ ] **premiumUntil:** Webhook `checkout.session.completed` actualiza User.premiumUntil.
- [ ] **Wallet B2B (inmobiliarias):** Si aplica, validar flujo de débito por leads.
