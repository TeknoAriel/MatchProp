# Operabilidad: health extendido + ingest (Sprint 10 / H5)

## `GET /health`

Respuesta **siempre 200** (probes no caen por un fallo puntual). El cuerpo indica estado:

| Campo | Significado |
| ----- | ----------- |
| `status` | `ok` \| `degraded` (DB no responde) |
| `db` | `ok` \| `error` |
| `version` | SHA de deploy o `local` |
| `migration` | Última migración Prisma aplicada |
| `ops` | Solo si DB OK; métricas operativas (ver abajo) |

### Objeto `ops`

| Campo | Significado |
| ----- | ----------- |
| `outboxIngestPending` | Eventos `INGEST_RUN_REQUESTED` sin `processedAt` (cola de ingest) |
| `cronIngestLastAt` | ISO del último `CRON_INGEST_COMPLETED` en outbox |
| `crmPushPending` | Filas `CrmPushOutbox` en `PENDING` |
| `crmPushFailed` | Filas `CrmPushOutbox` en `FAILED` |

Si alguna consulta falla, el campo correspondiente puede ser `null`.

**Relacionado:** `GET /cron/status` (público) sigue exponiendo `lastRun`, totales por fuente. En la web, `/status` muestra un resumen de `health` incluyendo `ops` cuando la API responde.

## Ingest Properstar: filas sin cambio de contenido

Cuando `last_update` del JSON coincide con `updatedAtSource` en DB, no se ejecuta `upsert` completo; en su lugar se actualizan **`lastSeenAt`** y **`lastSyncedAt`** en bloque para mantener frescura en ordenamientos del feed. Ver [INGEST_PROPERSTAR.md](./INGEST_PROPERSTAR.md).

## Próximos pasos (backlog)

- Admin `/stats`: gráficos o tablas con los mismos números que `ops`.
- Webhook en fallo de smoke-prod (opcional).
