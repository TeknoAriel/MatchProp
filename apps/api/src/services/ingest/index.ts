import { prisma } from '../../lib/prisma.js';
import { createKitepropExternalsiteConnector } from './connectors/kiteprop-externalsite.js';
import { createKitepropApiV1Connector } from './connectors/kiteprop-api-v1.js';
import { createPartner1FixtureConnector } from './connectors/partner1-fixture.js';
import { createKitepropDifusionZonapropConnector } from './connectors/kiteprop-difusion-zonaprop.js';
import { createKitepropDifusionToctocConnector } from './connectors/kiteprop-difusion-toctoc.js';
import { createKitepropDifusionIcasasConnector } from './connectors/kiteprop-difusion-icasas.js';
import { processIngestEvent } from './processor.js';
import type { ListingSource } from '@prisma/client';
import type { SourceConnector } from './types.js';

const EVENT_TYPE = 'INGEST_RUN_REQUESTED';

function buildConnectors(): Record<string, SourceConnector> {
  const map: Record<string, SourceConnector> = {
    KITEPROP_EXTERNALSITE: createKitepropExternalsiteConnector(),
    API_PARTNER_1: createPartner1FixtureConnector(),
    KITEPROP_DIFUSION_ZONAPROP: createKitepropDifusionZonapropConnector(),
    KITEPROP_DIFUSION_TOCTOC: createKitepropDifusionToctocConnector(),
    KITEPROP_DIFUSION_ICASAS: createKitepropDifusionIcasasConnector(),
  };
  const api = createKitepropApiV1Connector();
  if (api) map.KITEPROP_API = api;
  return map;
}

const connectors = buildConnectors();

function getConnector(source: string): SourceConnector | null {
  return connectors[source] ?? null;
}

export async function runIngest(params: {
  source: ListingSource;
  limit?: number;
  cursor?: string | null;
}): Promise<{ inserted: number; nextCursor: string | null }> {
  const ev = await prisma.outboxEvent.create({
    data: {
      type: EVENT_TYPE,
      payload: {
        source: params.source,
        limit: params.limit ?? 200,
        cursor: params.cursor ?? null,
      },
    },
  });

  const result = await processIngestEvent(ev.id, getConnector);
  if (!result.processed) {
    throw new Error('Ingest event not processed');
  }

  const watermark = await prisma.syncWatermark.findUnique({
    where: { source: params.source },
  });

  const count = await prisma.listing.count({
    where: { source: params.source },
  });

  return {
    inserted: count,
    nextCursor: watermark?.cursor ?? null,
  };
}

export { createKitepropExternalsiteConnector, createPartner1FixtureConnector };
export type { SourceConnector, NormalizedListing, RawListing } from './types.js';
