# Sprint: Feed Security, Cache y Optimización

## Archivos tocados

| Archivo                                               | Motivo                                                                        |
| ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| `apps/api/src/lib/prisma.ts`                          | Middleware queries lentas (>200ms), redacción de campos sensibles             |
| `apps/api/src/app.ts`                                 | Log requests: statusCode, responseTime, method, url (sin reply completo)      |
| `apps/api/src/lib/feed-total-cache.ts`                | Cache LRU 10.000, TTL 30s, factory para tests, normalización arrays + ''→null |
| `apps/api/src/lib/cursor.ts`                          | Límites anti-DoS: cursor 256 chars, id 50 chars                               |
| `apps/api/src/routes/feed.ts`                         | includeTotal, card liviana, total nullable, sin COUNT en scroll               |
| `apps/api/src/routes/preferences.ts`                  | Skip upsert si body == existente; norm ''/null                                |
| `apps/api/src/schemas/preference.ts`                  | locationText max 200 chars                                                    |
| `apps/api/src/plugins/auth.ts`                        | Fix tipo requireRole (FastifyRequest)                                         |
| `apps/api/src/routes/properties.ts`                   | Remover reply no usado                                                        |
| `apps/api/prisma/schema.prisma`                       | Índice @@index([createdAt, id]) en Property                                   |
| `apps/api/loadtest/bigdata.js`                        | Contadores por status/endpoint, 1% preferences, handleSummary                 |
| `packages/shared/src/types/index.ts`                  | FeedCard, FeedResponse (total nullable)                                       |
| `package.json` (root)                                 | Scripts typecheck, test                                                       |
| `apps/*/package.json`, `packages/shared/package.json` | typecheck, test scripts                                                       |

## Resumen de cambios

### Redacción logs Prisma

- No se loguean valores de campos sensibles (password, passwordHash, token, secret).
- Para `data`: solo keys. Para `where`/`select`: solo keys.
- Hint truncado a 150 chars.

### Request logging

- Solo: statusCode, responseTime, method, url.
- No se pasa el objeto reply completo.

### Cursor limits

- Cursor string: máx 256 caracteres.
- id en payload: máx 50 caracteres.

### locationText

- Schema preference: max 200 chars.
- Feed filtersToWhere: trim + slice(0, 200).

### Cache feed

- LRU con max 10.000 entradas.
- TTL 30s.
- Normalización: arrays ordenados, '' → null para keys consistentes.
- Factory `createFeedTotalCache({ maxEntries })` para tests.

### Contrato feed

- **Card liviana**: id, title, price, currency, lat, lng, mainImage, bedrooms, bathrooms, areaM2, operation, propertyType, locationText (sin description/media completo).
- **total** nullable cuando includeTotal=0 y sin cache.
- **includeTotal=1**: count solo en primera página (sin cursor), se cachea.
- **includeTotal=0** (default): no count; total viene de cache o null.

## Comandos para validar

```bash
pnpm -r run typecheck   # TypeScript en todo el monorepo
pnpm -r run test        # Tests unitarios (api: solo src/lib, sin DB)
pnpm lint               # ESLint en apps y packages
```

**Nota**: Los tests de integración (`api.test.ts`, `feed.int.test.ts`) requieren DB. Ejecutar con:

```bash
docker compose up -d
pnpm --filter api exec prisma migrate deploy
pnpm --filter api run test:all
```

Ver `docs/sprint-feed-integration-ci.md` para detalles del sprint de integración y CI.
