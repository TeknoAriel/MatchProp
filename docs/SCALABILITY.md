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

- **Archivo:** `apps/api/src/lib/feed-total-cache.ts`
- **TTL:** 30s
- **LRU:** 100.000 entradas (default)
- **Env:** `FEED_CACHE_MAX_ENTRIES=100000`

En múltiples instancias, cada proceso tiene su caché (no compartida). Para caché distribuida: Redis (futuro).

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
