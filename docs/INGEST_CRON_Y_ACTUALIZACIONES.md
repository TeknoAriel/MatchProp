# Ingest cron y actualización de propiedades

El **buscador** usa el catálogo de propiedades en la base de datos. Ese catálogo se alimenta con **conexiones de ingest** (Properstar JSON, iCasas, Zonaprop, Externalsite, etc.) y se actualiza con un **cron horario** que recorre las conexiones activas.

---

## Conexiones activas (sin ejemplos en producción)

- Las **conexiones activas** se leen de **IngestSourceConfig** (tabla `IngestSourceConfig`, campo `sourcesJson`): cada clave con URL (ej. `properstar`, `icasas`, `externalsite`; `yumblin` es alias de properstar) se considera activa.
- En **producción** (`DEMO_MODE=0`) no se usan fuentes de ejemplo: no se incluye `API_PARTNER_1` ni modo `fixture`. Solo se usan fuentes con URL real en config o en variables de entorno (`KITEPROP_DIFUSION_YUMBLIN_URL`, `KITEPROP_DIFUSION_ICASAS_URL`, etc.).
- Servicio: `getActiveIngestSources()` en `apps/api/src/services/ingest/active-sources.ts`.

---

## Cron horario

- **Script:** `pnpm --filter api ingest:cron`
- **Qué hace:** Para cada conexión activa, ejecuta ingest con **cursor** (SyncWatermark): trae el siguiente bloque de propiedades y actualiza el cursor para continuar en la próxima ejecución.
- **Programación:** Ejecutar cada hora (cron `0 * * * *`) o desde Vercel Cron / otro scheduler. En cada pasada se procesa un batch por fuente (límite 200 por defecto); en ejecuciones sucesivas se continúa desde el último cursor.
- **Comparador / último id:** Cada fuente tiene un **SyncWatermark** (cursor por fuente). El conector devuelve `nextCursor` (ej. offset numérico para Properstar/iCasas); ese valor se guarda y se envía en la siguiente ejecución para no repetir datos y avanzar.

---

## Actualización de precios y estado (ACTIVE/INACTIVE)

- **Mismo listing ya en la DB:** Cuando el ingest trae un listing con el mismo `source` + `externalId`, se hace **upsert** (update). En `upsertListing`:
  - Si cambia el **precio** (o la moneda), se crea un **ListingEvent** de tipo `PRICE_CHANGED` (payload: oldPrice, newPrice, oldCurrency, newCurrency).
  - Si cambia el **status** (ACTIVE ↔ INACTIVE), se crea un **ListingEvent** de tipo `STATUS_CHANGED` (payload: oldStatus, newStatus).
- Así, cada vez que el cron recorre una conexión y la fuente devuelve listados ya conocidos con datos actualizados, se actualizan precios y estado en la DB y quedan registrados en ListingEvent para alertas (PRICE_DROP, BACK_ON_MARKET).
- **Listados que desaparecen de la fuente:** Si una fuente deja de devolver un listing (vendido, dado de baja), en el modelo actual ese listing no se marca automáticamente como INACTIVE. Opciones futuras: full sync por fuente marcando como INACTIVE los no vistos en la última pasada, o que la propia fuente envíe `status: inactive` (Properstar/Yumblin ya soporta `raw.status === 'inactive'`).

---

## Resumen

| Tema                             | Cómo se resuelve                                                                        |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| Catálogo desde conexiones reales | IngestSourceConfig con URLs; en prod no usar fixture ni API_PARTNER_1.                  |
| Cron cada hora                   | `pnpm --filter api ingest:cron`; programar con cron o Vercel Cron.                      |
| Continuar desde último id        | SyncWatermark por fuente; cada conector usa cursor (ej. offset) y devuelve nextCursor.  |
| Cambio de precios                | Upsert + ListingEvent PRICE_CHANGED.                                                    |
| Propiedad pasa a inactiva        | Upsert con status INACTIVE + ListingEvent STATUS_CHANGED; fuentes pueden enviar status. |

---

Ver también: [PROD.md](./PROD.md) (demo sources OFF), [TAREAS_Y_MEJORAS.md](./TAREAS_Y_MEJORAS.md).
