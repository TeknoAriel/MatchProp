# Escalabilidad — MatchProp

Objetivo: **100.000 usuarios concurrentes** sobre **200.000 propiedades**.

---

## Resumen

| Componente             | Estado              | Recomendación                      |
| ---------------------- | ------------------- | ---------------------------------- |
| Feed (cursor paginado) | ✓ Índices óptimos   | Mantener `limit` ≤ 50              |
| Caché total feed       | ✓ 100k entradas LRU | Ajustar `FEED_CACHE_MAX_ENTRIES`   |
| Connection pool        | Configurable        | `connection_limit` en DATABASE_URL |
| Under-pressure         | ✓ 1GB heap en dev   | 512MB en prod, monitorear          |

---

## 1. Base de datos (PostgreSQL)

### Índices existentes (Listing)

- `(status, lastSeenAt)` — feed ordenado
- `(status, lastSeenAt, id)` — cursor paginado
- `(source, status, lastSeenAt)` — filtro por source
- `(publisherRef)`, `(publisherId)`

### Connection pool

En `DATABASE_URL`:

```
?connection_limit=50&pool_timeout=20
```

- **Desarrollo:** 10–20
- **Producción 100k usuarios:** 50–100 (según instancias de API)
- **Pool timeout:** 20s evita colas largas

### Búsqueda por ubicación (locationText)

El filtro `locationText` usa `ILIKE '%texto%'`. Para 200k+ filas:

1. **Índice trigram (opcional):** requiere extensión `pg_trgm`:
   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   CREATE INDEX idx_listing_location_trgm ON "Listing" USING gin ("locationText" gin_trgm_ops);
   ```
2. Sin índice: aceptable hasta ~100k listings; después evaluar Redis/search engine.

---

## 2. API (Fastify)

### Caché feed total

- **Memoria:** `apps/api/src/lib/feed-total-cache.ts` — TTL 30s, LRU 100k entradas (`FEED_CACHE_MAX_ENTRIES`).
- **Redis (opcional):** `REDIS_URL` → `feed-total-cache-provider.ts` + `feed-total-cache-redis.ts` (misma TTL, claves compartidas entre réplicas).

Sin `REDIS_URL`, cada proceso tiene su propio LRU (no compartido entre instancias).

### Under-pressure

- **Dev/demo:** 1GB heap, 2s event loop
- **Prod:** 512MB heap, 1s event loop
- Responde 503 cuando se superan umbrales (evita crash)

### Rate limit

- Global: 100 req/min
- Auth: 10 req/min

---

## 3. Prisma

### Slow query logging

Queries > 200ms se loguean con `[Prisma SLOW]`.

### Recomendaciones

- Evitar `include` masivos; usar `select` explícito
- Cursor paginado (no offset) en feed
- Índices cubren `orderBy` y `where` del feed

---

## 4. Load testing (k6)

```bash
# 50 usuarios → 200 VUs, 5 min sostenido
USERS_COUNT=50 USER_PREFIX=loaduser PASSWORD=demo BASE_URL=https://api.matchprop.com \
  k6 run --stage 30s:50 --stage 2m:200 --stage 5m:200 --stage 30s:0 apps/api/loadtest/bigdata.js
```

Ver `README.md` sección "Load tests" para más detalle.

---

## 5. Checklist escala

- [ ] `DATABASE_URL` con `connection_limit` y `pool_timeout`
- [ ] `FEED_CACHE_MAX_ENTRIES` si superas 100k usuarios activos
- [ ] PostgreSQL con recursos adecuados (CPU, RAM, conexiones max)
- [ ] Múltiples instancias de API detrás de load balancer
- [ ] Monitoreo: p95 latencia, error rate, DB pool usage

---

## 6. Motor de búsqueda (20k–200k+ propiedades)

Con **decenas o cientos de miles** de listings, PostgreSQL + Prisma sigue siendo válido para **feed por cursor** si los índices cubren `where` + `orderBy`. Donde empieza a doler:

- Texto libre (`title`, `description`, varias keywords) con `ILIKE` / `contains`
- Facetas agregadas (histogramas de precio, conteos por zona) en tiempo real
- Geo complejo (polígonos, “cerca de”) más allá de un bounding box simple

### 6.1 Elasticsearch u OpenSearch (recomendado)

- **Rol:** motor de búsqueda y filtrado sobre un **índice denormalizado** de listings.
- **Postgres:** sigue siendo la fuente de verdad; transacciones, leads, swipes, media ligada.
- **Sincronización:**
  - **En ingest:** tras upsert de `Listing`, encolar evento `listing_index_upsert` (cola + worker) o bulk nocturno.
  - **Reindex completo:** script batch leyendo `Listing` por cursor y `bulk` a ES.
- **Consulta en API (patrón híbrido):**
  1. ES devuelve **solo** `id` (y campos necesarios para sort) con `search_after` / `pit` para paginación estable.
  2. Prisma hace `findMany({ where: { id: { in: [...] } } })` y se **reordena** en memoria según el orden de ES (o `ORDER BY array_position` en SQL raw).
  3. Cards pesadas (media) se pueden enriquecer en un segundo paso o almacenar un subconjunto en el documento ES (trade-off tamaño vs. frescura).

**Referencia en código:** `apps/api/src/lib/search/listings-index-spec.ts` (nombre de índice, mapping orientativo, env `SEARCH_BACKEND`).

**Variables de entorno (fases futuras):**

| Variable                       | Uso                                     |
| ------------------------------ | --------------------------------------- |
| `SEARCH_BACKEND`               | `postgres` (default) \| `elasticsearch` |
| `ELASTICSEARCH_URL`            | URL base del cluster                    |
| `ELASTICSEARCH_API_KEY`        | Auth (o usuario/clave según despliegue) |
| `ELASTICSEARCH_INDEX_LISTINGS` | Override del nombre de índice           |

### 6.2 Alternativas más simples

- **Meilisearch / Typesense:** menos ops, muy buenos para texto y facetas; menos ecosistema que ES.
- **Solo Postgres:** ampliar con **pg_trgm** en `locationText` / títulos y **materialized views** para agregados refrescados por cron (hasta ~100k–200k según hardware y patrones de query).

---

## 7. Caché en capas (servidor)

Orden típico de lectura:

1. **CDN / edge (Vercel):** HTML y estáticos; headers ya orientados a `must-revalidate` en rutas dinámicas de la web.
2. **Caché de totales del feed (implementado):**
   - Sin `REDIS_URL`: LRU en proceso (`feed-total-cache.ts`), TTL 30s.
   - Con **`REDIS_URL`:** Redis vía `ioredis` (`feed-total-cache-redis.ts`), misma semántica, **compartida entre instancias** (clave `mp:feed:total:…`).
3. **Caché de páginas de resultados (futuro):** Redis con clave `userId + hash(filtros) + cursor` y TTL corto; invalidar por webhook de ingest o por versión de catálogo (`catalog_generation` en key).
4. **Lectura de documentos ES:** nodos ES tienen su propia caché de segmentos; ajustar `refresh_interval` para equilibrio visibilidad / carga.

**Operación:** en serverless (funciones muy cortas), Redis TCP puede sumar latencia de conexión; opciones: **Upstash** (TLS), **connection pooling** en capa intermedia, o API en contenedor long-running.

---

## 8. Roadmap sugerido

| Fase | Objetivo                                              |
| ---- | ----------------------------------------------------- |
| A    | `REDIS_URL` en staging/prod para totales de feed      |
| B    | Índice ES + pipeline desde ingest (eventos o bulk)    |
| C    | `executeFeed` dual: ES para ids + Prisma para cards   |
| D    | Facetas / agregados y mapa pesado desde ES            |
| E    | Observabilidad: latencia ES vs PG, ratio de cache hit |
