# Operabilidad: health, admin, alertas email e índices de feed

Alineado a **Plan Q3 2026** ([PLAN_DE_TRABAJO_2026_Q3.md](./PLAN_DE_TRABAJO_2026_Q3.md)): Sprints 8 (email alertas), 9 (health + admin ops), 10 (índice feed).

---

## 1. `GET /health`

Respuesta **siempre 200** (probes no caen por un fallo puntual). El cuerpo indica estado:

| Campo       | Significado                                                                             |
| ----------- | --------------------------------------------------------------------------------------- |
| `status`    | `ok` \| `degraded` (DB no responde)                                                     |
| `db`        | `ok` \| `error`                                                                         |
| `version`   | SHA de deploy o `local`                                                                 |
| `migration` | Última migración Prisma aplicada                                                        |
| `catalogActiveCount` | Si DB OK: cantidad de `Listing` con `status = ACTIVE` (feed vacío con 0 suele ser catálogo sin datos + `DEMO_MODE` off) |
| `ops`       | Solo si DB OK; métricas operativas (misma fuente que `getOperationalMetrics` en código) |

### Objeto `ops`

| Campo                 | Significado                                                       |
| --------------------- | ----------------------------------------------------------------- |
| `outboxIngestPending` | Eventos `INGEST_RUN_REQUESTED` sin `processedAt` (cola de ingest) |
| `cronIngestLastAt`    | ISO del último `CRON_INGEST_COMPLETED` en outbox                  |
| `crmPushPending`      | Filas `CrmPushOutbox` en `PENDING`                                |
| `crmPushFailed`       | Filas `CrmPushOutbox` en `FAILED`                                 |

Si alguna consulta falla, el campo correspondiente puede ser `null`.

**Implementación compartida:** [`apps/api/src/lib/operational-metrics.ts`](../apps/api/src/lib/operational-metrics.ts) — usada por `app.ts` y por **`GET /admin/stats/ops`**.

**Relacionado:** `GET /cron/status` (público) expone `lastRun`, totales por fuente. En la app web, **`/status`** muestra `health` + `ops`.

---

## 2. Admin: `GET /admin/stats/ops`

- **Auth:** cookie de sesión + rol **ADMIN** (igual que el resto de `/admin/stats/*`).
- **Respuesta:** todos los campos de `ops` más **`listingsActive`** (conteo `Listing` con `status = ACTIVE`).
- **UI:** en **Admin → Estadísticas** (`/stats`) hay una sección **Operación** con estos números y enlaces a documentación del repo (GitHub `main`).

**Runbooks:** [DEPLOY_TROUBLESHOOTING.md](./DEPLOY_TROUBLESHOOTING.md), [ESTABILIDAD_Y_RELEASE.md](./ESTABILIDAD_Y_RELEASE.md).

---

## 3. Email al crear `AlertDelivery`

Ver **[ALERTAS_EMAIL.md](./ALERTAS_EMAIL.md)** (SendGrid, tipos, tests).

---

## 4. Performance feed — índice `Listing`

El feed autenticado ordena por defecto por **`createdAt` desc** + `id` desc (y variantes con `lastSeenAt`). Ya existían índices `(status, lastSeenAt)` y `(status, lastSeenAt, id)`.

Migración **`20260402140000_listing_feed_created_at_index`:** índice **`(status, createdAt, id)`** en `Listing` para acelerar el camino principal con `WHERE status = 'ACTIVE'` y orden por fecha de creación.

Otros sorts (`price_*`, `area_desc`) pueden beneficiarse de índices adicionales si el volumen lo exige (revisar `EXPLAIN` en producción).

---

## 5. Ingest Properstar — touch sin `upsert`

Cuando `last_update` del JSON coincide con `updatedAtSource`, no se hace `upsert` completo; se actualizan **`lastSeenAt`** y **`lastSyncedAt`** en bloque. Ver [INGEST_PROPERSTAR.md](./INGEST_PROPERSTAR.md).

---

## Pendiente (opcional)

- Webhook en fallo de smoke-prod → [ESTABILIDAD_Y_RELEASE.md](./ESTABILIDAD_Y_RELEASE.md) § futuro.
- Más gráficos en admin si hace falta.
