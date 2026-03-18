# Integración Meilisearch - MatchProp

## ¿Por qué Meilisearch?

| Característica | Meilisearch | Elasticsearch |
|----------------|-------------|---------------|
| Complejidad | Baja | Alta |
| Setup | 5 minutos | 30+ minutos |
| RAM mínima | 256 MB | 2 GB |
| Tier gratuito (Cloud) | ✅ 10K docs | ❌ |
| Typo-tolerance | ✅ Nativo | Config manual |
| Facets/Filtros | ✅ | ✅ |
| Latencia típica | < 50ms | < 100ms |

**Recomendación:** Meilisearch para MatchProp por simplicidad y costo.

---

## Arquitectura

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Ingest    │────▶│  PostgreSQL  │────▶│ Meilisearch │
│  (Kiteprop) │     │   (source)   │     │   (search)  │
└─────────────┘     └──────────────┘     └─────────────┘
                           │                    │
                           │                    │
                    ┌──────▼──────┐      ┌──────▼──────┐
                    │  API CRUD   │      │ API Search  │
                    │  (Prisma)   │      │(Meilisearch)│
                    └─────────────┘      └─────────────┘
```

---

## Opciones de Hosting

### 1. Meilisearch Cloud (Recomendado para empezar)
- **Gratis:** 10,000 documentos, 100K búsquedas/mes
- **Build:** $25/mes - 100K docs, 500K búsquedas
- **Pro:** $300/mes - 1M docs, ilimitado
- URL: https://cloud.meilisearch.com

### 2. Self-hosted en Railway/Render
- Railway: $5/mes (256 MB RAM)
- Render: $7/mes (512 MB RAM)
- Docker image oficial: `getmeili/meilisearch`

### 3. Self-hosted en VPS
- DigitalOcean Droplet: $4/mes (512 MB)
- Hetzner: €3.29/mes

---

## Implementación

### 1. Instalar dependencia

```bash
pnpm --filter api add meilisearch
```

### 2. Crear cliente Meilisearch

```typescript
// apps/api/src/lib/meilisearch.ts
import { MeiliSearch } from 'meilisearch';

const MEILISEARCH_HOST = process.env.MEILISEARCH_HOST || 'http://localhost:7700';
const MEILISEARCH_API_KEY = process.env.MEILISEARCH_API_KEY || '';

export const meili = new MeiliSearch({
  host: MEILISEARCH_HOST,
  apiKey: MEILISEARCH_API_KEY,
});

export const listingsIndex = meili.index('listings');

// Configurar índice
export async function setupListingsIndex() {
  await listingsIndex.updateSettings({
    searchableAttributes: [
      'title',
      'description',
      'locationText',
      'addressText',
    ],
    filterableAttributes: [
      'operationType',
      'propertyType',
      'price',
      'currency',
      'bedrooms',
      'bathrooms',
      'areaTotal',
      'status',
      'source',
    ],
    sortableAttributes: [
      'price',
      'areaTotal',
      'lastSeenAt',
    ],
    typoTolerance: {
      enabled: true,
      minWordSizeForTypos: {
        oneTypo: 4,
        twoTypos: 8,
      },
    },
  });
}
```

### 3. Sincronizar datos

```typescript
// apps/api/src/services/search/sync-meilisearch.ts
import { prisma } from '../../lib/prisma.js';
import { listingsIndex } from '../../lib/meilisearch.js';

interface MeiliListing {
  id: string;
  title: string | null;
  description: string | null;
  operationType: string | null;
  propertyType: string | null;
  price: number | null;
  currency: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  areaTotal: number | null;
  locationText: string | null;
  addressText: string | null;
  heroImageUrl: string | null;
  status: string;
  source: string;
  lastSeenAt: number; // timestamp para ordenar
}

export async function syncListingsToMeilisearch(batchSize = 1000) {
  let cursor: string | undefined;
  let totalSynced = 0;

  while (true) {
    const listings = await prisma.listing.findMany({
      take: batchSize,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        title: true,
        description: true,
        operationType: true,
        propertyType: true,
        price: true,
        currency: true,
        bedrooms: true,
        bathrooms: true,
        areaTotal: true,
        locationText: true,
        addressText: true,
        heroImageUrl: true,
        status: true,
        source: true,
        lastSeenAt: true,
      },
    });

    if (listings.length === 0) break;

    const docs: MeiliListing[] = listings.map(l => ({
      id: l.id,
      title: l.title,
      description: l.description,
      operationType: l.operationType,
      propertyType: l.propertyType,
      price: l.price,
      currency: l.currency,
      bedrooms: l.bedrooms,
      bathrooms: l.bathrooms,
      areaTotal: l.areaTotal,
      locationText: l.locationText,
      addressText: l.addressText,
      heroImageUrl: l.heroImageUrl,
      status: l.status,
      source: l.source,
      lastSeenAt: l.lastSeenAt.getTime(),
    }));

    await listingsIndex.addDocuments(docs, { primaryKey: 'id' });
    totalSynced += docs.length;
    cursor = listings[listings.length - 1].id;

    console.log(`Synced ${totalSynced} listings...`);
  }

  return totalSynced;
}
```

### 4. Endpoint de búsqueda

```typescript
// apps/api/src/routes/search-v2.ts
import { FastifyInstance } from 'fastify';
import { listingsIndex } from '../lib/meilisearch.js';

export async function searchV2Routes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  // Búsqueda full-text con filtros
  fastify.get('/search/v2', async (request) => {
    const q = request.query as {
      q?: string;
      operationType?: string;
      propertyType?: string;
      priceMin?: string;
      priceMax?: string;
      bedrooms?: string;
      limit?: string;
      offset?: string;
    };

    const filters: string[] = [];
    
    if (q.operationType) {
      filters.push(`operationType = "${q.operationType}"`);
    }
    if (q.propertyType) {
      filters.push(`propertyType = "${q.propertyType}"`);
    }
    if (q.priceMin) {
      filters.push(`price >= ${q.priceMin}`);
    }
    if (q.priceMax) {
      filters.push(`price <= ${q.priceMax}`);
    }
    if (q.bedrooms) {
      filters.push(`bedrooms >= ${q.bedrooms}`);
    }

    const result = await listingsIndex.search(q.q || '', {
      filter: filters.length ? filters.join(' AND ') : undefined,
      limit: parseInt(q.limit || '20'),
      offset: parseInt(q.offset || '0'),
      sort: ['lastSeenAt:desc'],
    });

    return {
      hits: result.hits,
      total: result.estimatedTotalHits,
      processingTimeMs: result.processingTimeMs,
    };
  });

  // Autocompletado
  fastify.get('/search/v2/autocomplete', async (request) => {
    const { q } = request.query as { q?: string };
    
    if (!q || q.length < 2) {
      return { suggestions: [] };
    }

    const result = await listingsIndex.search(q, {
      limit: 5,
      attributesToRetrieve: ['id', 'title', 'locationText', 'price'],
    });

    return {
      suggestions: result.hits.map(h => ({
        id: h.id,
        title: h.title,
        locationText: h.locationText,
        price: h.price,
      })),
    };
  });
}
```

### 5. Hook post-ingest

```typescript
// En upsert.ts, después de crear/actualizar listing
import { listingsIndex } from '../../lib/meilisearch.js';

// Al final de upsertListing()
if (process.env.MEILISEARCH_HOST) {
  await listingsIndex.addDocuments([{
    id: listing.id,
    title: norm.title,
    description: norm.description,
    // ... resto de campos
  }]).catch(err => {
    console.warn('[meilisearch] sync error:', err.message);
  });
}
```

---

## Variables de Entorno

```env
# Meilisearch Cloud o self-hosted
MEILISEARCH_HOST=https://ms-xxxx.meilisearch.com
MEILISEARCH_API_KEY=your_master_key_here
```

---

## Script de Setup Inicial

```typescript
// apps/api/src/scripts/setup-meilisearch.ts
import { setupListingsIndex } from '../lib/meilisearch.js';
import { syncListingsToMeilisearch } from '../services/search/sync-meilisearch.js';

async function main() {
  console.log('Setting up Meilisearch index...');
  await setupListingsIndex();
  
  console.log('Syncing listings...');
  const count = await syncListingsToMeilisearch();
  
  console.log(`Done! Synced ${count} listings to Meilisearch.`);
}

main().catch(console.error);
```

---

## Migración Gradual

### Fase 1: Setup (sin cambios en prod)
1. Crear cuenta Meilisearch Cloud (gratis)
2. Agregar variables de entorno
3. Ejecutar sync inicial

### Fase 2: Endpoint paralelo
1. Agregar `/search/v2` con Meilisearch
2. Mantener `/search` original con PostgreSQL
3. Comparar resultados

### Fase 3: Migración completa
1. Redirigir `/assistant/search` a usar Meilisearch
2. Actualizar frontend
3. Deprecar búsqueda PostgreSQL

---

## Métricas a Monitorear

- **Latencia p95:** < 100ms
- **Relevancia:** Comparar clicks/conversiones vs búsqueda actual
- **Sync lag:** Tiempo entre ingest y disponibilidad en search

---

## Comparativa de Costos

| Escenario | PostgreSQL LIKE | Meilisearch Cloud |
|-----------|-----------------|-------------------|
| 15K props | $0 (incluido) | $0 (gratis) |
| 50K props | $0 (lento) | $0 (gratis) |
| 100K props | $0 (muy lento) | $25/mes |
| 500K props | No viable | $300/mes |

**Recomendación:** Empezar con tier gratuito de Meilisearch Cloud.
