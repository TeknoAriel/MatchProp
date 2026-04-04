# Propistar / Properstar — política operativa, cron y Kiteprop

**Alcance:** catálogo JSON publicado por Kiteprop (`properstar.json`, mismo pipeline que `yumblin.json`). En código y en Prisma la fuente es **`KITEPROP_DIFUSION_YUMBLIN`** (sin migrar enum). Detalle técnico del conector: **[INGEST_PROPERSTAR.md](./INGEST_PROPERSTAR.md)**.

Este documento fija **reglas de negocio y operación** acordadas: frecuencias de sync, push desde Kiteprop, tipo de aviso, actualización por `last_update`, bajas y efecto en feeds/cachés.

---

## 1. Fuentes de verdad

| Qué                   | Dónde vive                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| Catálogo masivo       | JSON estático (p. ej. `properstar.json` en `static.kiteprop.com`)                                    |
| Listings en MatchProp | Postgres: modelo `Listing` + `ListingMedia`, `source` + `externalId` únicos                          |
| Progreso del sync     | `SyncWatermark` (cursor, ETag, IDs acumulados del sync actual)                                       |
| URL del JSON          | `IngestSourceConfig.sourcesJson` (`properstar` / `yumblin`) o env `KITEPROP_DIFUSION_PROPERSTAR_URL` |

---

## 2. Periodicidad del ingest (cron)

| Entorno        | Objetivo operativo                                            | Implementación sugerida                                                                                                                                |
| -------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Producción** | Mantener catálogo alineado con Kiteprop con latencia baja     | Ejecutar ingest de la fuente **Propistar/Properstar** cada **30 minutos** (p. ej. cron `*/30 * * * *` UTC o scheduler equivalente que invoque el job). |
| **Prueba**     | Menos carga sobre CDN/DB; suficiente para validar integración | Como máximo **una pasada cada 48 horas**, **salvo** ejecución **bajo demanda** (ver §5).                                                               |

**Job a ejecutar (misma semántica que hoy):**

- **`pnpm --filter api ingest:cron`** — recorre fuentes activas; para Properstar avanza con `SyncWatermark` y lotes (p. ej. 200 ítems por evento según script actual).
- Carga completa puntual o “poner al día” tras incidente: **`pnpm --filter api ingest:run -- --source=KITEPROP_DIFUSION_YUMBLIN --limit=8000 --until-empty`** (ver [INGEST_PROPERSTAR.md](./INGEST_PROPERSTAR.md)).

**HTTP (Vercel / edge):** el endpoint existente **`POST /cron/ingest`** hoy dispara **`KITEPROP_EXTERNALSITE`**, no el JSON Propistar. Para producción, o bien:

- se **amplía** el cron HTTP o un segundo route para **`KITEPROP_DIFUSION_YUMBLIN`** con el mismo `CRON_SECRET`, o bien
- el scheduler invoca **`ingest:cron`** en un worker/VM con la `DATABASE_URL` de prod.

Registrar en runbook qué mecanismo quedó activo (Vercel Cron, GitHub Actions, etc.).

---

## 3. Publicación inmediata por push desde Kiteprop

**Requisito de producto:** MatchProp debe poder reflejar **en caliente** un alta (o cambio relevante) cuando Kiteprop lo publique, sin esperar al siguiente ciclo del JSON masivo.

**Estado en código:** el flujo masivo está implementado; el **push puntual** debe acordarse como contrato HTTP (webhook o API interna) desde Kiteprop hacia MatchProp.

**Dirección recomendada (a implementar cuando Kiteprop exponga el hook):**

1. **POST** autenticado (token compartido / firma) con payload mínimo: `externalId` (o `id` Kiteprop), opcionalmente snapshot de ficha o URL de re-fetch.
2. MatchProp encola **`INGEST_RUN_REQUESTED`** para esa fuente o un conector “single listing” que haga fetch y **`upsertListing`** con el mismo criterio de `updatedAtSource` e imágenes que el JSON masivo.
3. Idempotencia: mismo `source` + `externalId` que el catálogo masivo para no duplicar filas.

Hasta que exista el endpoint, la vía operativa es **ingest bajo demanda** (§5) o acortar temporalmente el cron en prueba.

---

## 4. Código de tipo de aviso (modelo de negocio)

Las propiedades pueden traer un **código de tipo de aviso** definido por Kiteprop (plan: simple, destacado, superdestacado, etc.).

**Persistencia en MatchProp (sin migración de schema obligatoria):**

- Campo lógico **`details.adTypeCode`** (string): valor **tal cual** viene del JSON o del push (código canónico de Kiteprop).
- Opcional **`details.adTypeLabelRaw`**: texto legible si la fuente lo envía.

**Mapeo a categorías comerciales en MatchProp** (destacado / super / simple, etc.):

- Se resuelve en **capa de producto** (config en DB o tabla de mapeo `adTypeCode` → `tier`), **no** hardcodeado en el conector de ingest.
- El feed y el ranking pueden ordenar o filtrar por `tier` una vez definido el diccionario.

**Claves JSON aceptadas en ingest (primer valor no vacío gana):**  
`ad_type`, `adType`, `tipo_aviso`, `listing_ad_type`, `publication_type`, `plan_code`, `aviso_tipo` (lista ampliable si Kiteprop fija un nombre definitivo).

---

## 5. Política de actualización incremental (`externalId` + `last_update`)

**Identificador estable:** `externalId` = id de la propiedad en Kiteprop (string). Junto con `source` es único en `Listing`.

**Huella de cambio en origen:** `last_update` del JSON → se guarda como **`updatedAtSource`** en `Listing`.

**Comportamiento implementado en el procesador de ingest** (fuente con `fullCatalogTombstone`):

1. Para cada ítem del batch, si ya existe el listing y **`updatedAtSource` en DB coincide con la del JSON** (misma precisión a segundos), **no** se hace `upsert` completo: solo **touch** de `lastSeenAt` / `lastSyncedAt` para mantener frescura del feed.
2. Si **`last_update` cambió** respecto al valor almacenado, se ejecuta **`upsertListing` completo**: reescribe ficha, **`rawJson`**, `details`, y **sustituye todas las filas de `ListingMedia`** (baja y recrea URLs), de modo que **cambios de galería** en Kiteprop se reflejan en MatchProp.

**ETag / 304:** si el archivo completo no cambió y el cursor está al inicio, se puede omitir todo el trabajo (ver [INGEST_PROPERSTAR.md](./INGEST_PROPERSTAR.md)).

---

## 6. Bajas: propiedades que ya no vienen en el JSON

Al **cerrar un sync completo** del catálogo (`nextCursor === null` y fuente con tombstone activo):

- Los listings **`ACTIVE`** de esa **`source`** cuyo `externalId` **no** figuró en el conjunto acumulado del JSON en ese sync pasan a **`INACTIVE`**.
- **No se borran** filas de `Listing` por defecto (historial, leads, eventos); **dejan de entrar en el feed** porque el feed trabaja sobre activos y reglas de calidad.
- Si el JSON viniera **vacío** en un sync completo, la política actual desactiva **todos** los de esa fuente (comportamiento documentado en [INGEST_PROPERSTAR.md](./INGEST_PROPERSTAR.md)); en operación se debe evitar publicar JSON vacío por error.

---

## 7. Feeds y cachés tras cambios / bajas

| Capa                             | Efecto de INACTIVE o datos nuevos                                                                                                   |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Feed SQL / Prisma**            | Listings `INACTIVE` quedan fuera de los `where` habituales del feed.                                                                |
| **Caché total feed (LRU/Redis)** | TTL corto (**30 s** en implementación actual); los totales convergen sin paso manual.                                               |
| **CDN / navegador (web)**        | Headers de no cache agresivo en rutas dinámicas; hard refresh si hace falta.                                                        |
| **Búsqueda futura (ES, etc.)**   | Tras indexar, debe aplicarse **delete/update de documento** al marcar INACTIVE o al upsert. Ver [SCALABILITY.md](./SCALABILITY.md). |

No hace falta “invalidar” manualmente el feed por listing salvo integraciones externas adicionales; la fuente de verdad es la DB tras cada ingest.

---

## 8. Ingest bajo demanda (pedido puntual)

Cuando se pida **actualización puntual** (agente, operador o pipeline CI):

1. **`pnpm --filter api ingest:run -- --source=KITEPROP_DIFUSION_YUMBLIN --limit=8000 --until-empty`** para recorrer desde el cursor actual hasta cerrar el archivo (o lotes menores si se prefiere).
2. O **`pnpm --filter api ingest:cron`** para una pasada por todas las fuentes activas.
3. Con API desplegada: ampliar cron HTTP o usar **Deploy Hook** + job; documentar el comando exacto en el runbook.

---

## 9. Documentos relacionados

- [INGEST_PROPERSTAR.md](./INGEST_PROPERSTAR.md) — URL, ETag, tombstone, carga 100 %
- [INGEST_CRON_Y_ACTUALIZACIONES.md](./INGEST_CRON_Y_ACTUALIZACIONES.md) — cursores, eventos de precio/estado
- [IMPORTADORES_Y_API_UNIVERSAL.md](./IMPORTADORES_Y_API_UNIVERSAL.md) — `sourcesJson` en Settings
- [ENV_REFERENCIA.md](./ENV_REFERENCIA.md) — variables de entorno
- [SCALABILITY.md](./SCALABILITY.md) — invalidación futura con índice de búsqueda

---

## 10. Resumen ejecutivo

| Tema                        | Decisión                                                               |
| --------------------------- | ---------------------------------------------------------------------- |
| Prod                        | Cron ingest Propistar **cada 30 min**                                  |
| Prueba                      | **Cada 48 h** o **bajo demanda**                                       |
| Push Kiteprop               | Webhook/API dedicada (especificación §3); hasta entonces ingest manual |
| Tipo de aviso               | `details.adTypeCode`; mapeo a tiers en producto/config                 |
| Cambio en `last_update`     | **Upsert completo** + **regenerar imágenes**                           |
| Sin cambio en `last_update` | Solo touch de `lastSeenAt` / `lastSyncedAt`                            |
| Ya no está en el JSON       | **`INACTIVE`**; no aparece en feeds; cachés con TTL / futuro ES        |
