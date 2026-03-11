# MatchProp Sprint 1 — Ingest + Canonical Listings + Swipe Feed

## Alcance

**Qué sí:**

- Canonical Listings multi-fuente (Kiteprop externalsite, Kiteprop API v1 skeleton, API Partner 1)
- Ingesta idempotente desde fixtures (sin internet en CI)
- Feed Tinder con cursor, exclusión NOPE/LIKE, ranking
- Engagement: swipes (LIKE/NOPE), saved (FAVORITE/LATER)
- Leads stub local listo para Sprint 2 (push a Kiteprop)
- Web mínima: feed modo Tinder (1 card a la vez), listing detail, saved
- Observabilidad: logs con requestId, userId, route, status, responseTime (sin PII)

**Qué no:**

- MLS/portal B2B complejo
- Monetización avanzada
- Credenciales reales Kiteprop API v1 (doc no disponible; Sprint 2)

## Modelos Prisma

- `ListingSource`: KITEPROP_API | KITEPROP_EXTERNALSITE | API_PARTNER_1
- `ListingStatus`: ACTIVE, INACTIVE
- `Listing`: canonical, UNIQUE(source, externalId)
- `ListingMedia`: fotos por listing
- `SwipeDecision`: LIKE | NOPE por userId+listingId
- `SavedItem`: FAVORITE | LATER por userId+listingId+listType
- `Lead`: channel (WHATSAPP/FORM/TOUR_REQUEST), status NEW/SENT/FAILED
- `SyncWatermark`: cursor por fuente
- `OutboxEvent`: INGEST_RUN_REQUESTED

## Ingest

### Fixture (sin internet, para CI/tests)

```bash
# En tests: KITEPROP_EXTERNALSITE_MODE=fixture (ya configurado en vitest.setup.ts)
pnpm --filter api ingest:run -- --source=KITEPROP_EXTERNALSITE --limit=200
```

### Real (HTTP al JSON externalsite)

```bash
# Sin KITEPROP_EXTERNALSITE_MODE o con URL en .env
pnpm --filter api ingest:run -- --source=KITEPROP_EXTERNALSITE --limit=200
```

### Refrescar fixture local

```bash
pnpm --filter api ingest:fixture:refresh
```

Descarga el JSON externalsite y guarda un subset en `kiteprop-sample.min.json`.

### Fuentes

| Fuente                | Modo     | Env vars                                |
| --------------------- | -------- | --------------------------------------- |
| KITEPROP_EXTERNALSITE | fixture  | KITEPROP_EXTERNALSITE_MODE=fixture      |
| KITEPROP_EXTERNALSITE | HTTP     | KITEPROP_EXTERNALSITE_URL (opcional)    |
| KITEPROP_API          | skeleton | KITEPROP_API_BASE_URL, KITEPROP_API_KEY |
| API_PARTNER_1         | fixture  | partner1-sample.json                    |

## Endpoints

| Método | Ruta          | Descripción                                 |
| ------ | ------------- | ------------------------------------------- |
| GET    | /feed         | Feed con cursor, filters, exclude NOPE/LIKE |
| POST   | /swipes       | { listingId, decision: LIKE \| NOPE }       |
| POST   | /saved        | { listingId, listType: FAVORITE \| LATER }  |
| GET    | /me/saved     | Lista guardados (query listType opcional)   |
| POST   | /leads        | { listingId, channel, message? }            |
| GET    | /listings/:id | Detalle listing (auth)                      |

## Contrato ListingCard / FeedResponseV1

```ts
interface ListingCard {
  id: string;
  source: string;
  title: string | null;
  price: number | null;
  currency: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  areaTotal: number | null;
  locationText: string | null;
  heroImageUrl: string | null;
  publisherRef: string | null;
  operationType?: string | null;
}

interface FeedResponseV1 {
  items: ListingCard[];
  nextCursor: string | null;
  total: number | null;
  limit: number;
}
```

## Smoke UX checklist

1. `pnpm dev:web` (o `pnpm --filter web dev`)
2. Login
3. Correr `pnpm --filter api ingest:run -- --source=KITEPROP_EXTERNALSITE --limit=200` (con fixture mode en .env o sin red)
4. Abrir /feed
5. 20 swipes, 3 favoritos, 1 lead
6. Verificar Undo (deshacer último)
7. Verificar empty state cuando no hay más

## Kiteprop API v1

La documentación en https://www.kiteprop.com/docs/api/v1 no carga correctamente (solo "Loading..."). No se pudo obtener base URL, método de auth ni endpoints. El conector queda como skeleton "activable" con envs KITEPROP_API_BASE_URL y KITEPROP_API_KEY. Sprint 2: implementar cuando la doc esté disponible.
