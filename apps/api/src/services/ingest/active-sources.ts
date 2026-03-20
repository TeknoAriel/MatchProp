/**
 * Conexiones activas de ingest: lee IngestSourceConfig y devuelve las fuentes
 * que tienen URL configurada. En producción (DEMO_MODE=0) no se incluyen
 * fuentes de ejemplo (API_PARTNER_1, fixture).
 */
import { prisma } from '../../lib/prisma.js';
import type { ListingSource } from '@prisma/client';

const CONFIG_KEY_TO_SOURCE: Record<string, ListingSource> = {
  yumblin: 'KITEPROP_DIFUSION_YUMBLIN',
  icasas: 'KITEPROP_DIFUSION_ICASAS',
  zonaprop: 'KITEPROP_DIFUSION_ZONAPROP',
  externalsite: 'KITEPROP_EXTERNALSITE',
  toctoc: 'KITEPROP_DIFUSION_TOCTOC',
};

/** Fuentes que son solo para demo/fixture; no usar en producción. */
const DEMO_ONLY_SOURCES: ListingSource[] = ['API_PARTNER_1'];

export type ActiveSource = { source: ListingSource; key: string };

/**
 * Devuelve la lista de fuentes de ingest activas (con URL en IngestSourceConfig).
 * En producción (DEMO_MODE !== '1') excluye API_PARTNER_1 y cualquier fuente
 * que dependa de fixture.
 */
export async function getActiveIngestSources(): Promise<ActiveSource[]> {
  const demoMode = process.env.DEMO_MODE === '1';
  const row = await prisma.ingestSourceConfig.findUnique({
    where: { id: 'default' },
  });
  const json = (row?.sourcesJson as Record<string, { url?: string }[]>) ?? {};
  const out: ActiveSource[] = [];

  for (const [key, arr] of Object.entries(json)) {
    const source = CONFIG_KEY_TO_SOURCE[key];
    if (!source) continue;
    if (!demoMode && DEMO_ONLY_SOURCES.includes(source)) continue;
    if (!Array.isArray(arr) || !arr.some((e) => e?.url && String(e.url).trim())) continue;
    out.push({ source, key });
  }

  // Fuentes que pueden venir solo por env (sin entrada en sourcesJson)
  if (demoMode) return out;
  if (
    process.env.KITEPROP_DIFUSION_YUMBLIN_URL &&
    !out.some((a) => a.source === 'KITEPROP_DIFUSION_YUMBLIN')
  )
    out.push({ source: 'KITEPROP_DIFUSION_YUMBLIN', key: 'yumblin' });
  if (
    process.env.KITEPROP_DIFUSION_ICASAS_URL &&
    !out.some((a) => a.source === 'KITEPROP_DIFUSION_ICASAS')
  )
    out.push({ source: 'KITEPROP_DIFUSION_ICASAS', key: 'icasas' });

  return out;
}
