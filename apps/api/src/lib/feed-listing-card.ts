import { extractFromRawJson } from './rawjson-fallback.js';
import { pickHeroUrlFromMedia } from './media-url-kind.js';

export type FeedListingCardInput = {
  id: string;
  title: string | null;
  heroImageUrl: string | null;
  media?: { url: string; sortOrder: number; type?: string | null }[];
  rawJson?: unknown;
  price?: number | null;
  currency?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  areaTotal?: number | null;
  locationText?: string | null;
  publisherRef?: string | null;
  source?: string;
  operationType?: string | null;
  lastSeenAt?: Date;
  propertyType?: string | null;
};

/** Aplica rawJson fallback cuando heroImageUrl o title faltan en el listing. */
export function feedItemWithRawJsonFallback(l: FeedListingCardInput) {
  let heroImageUrl = l.heroImageUrl ?? (l.media?.length ? pickHeroUrlFromMedia(l.media) : null);
  let title = l.title;
  let media = l.media;
  if ((!heroImageUrl || !title?.trim()) && l.rawJson) {
    const fb = extractFromRawJson(l.rawJson);
    if (!heroImageUrl) heroImageUrl = fb.heroImageUrl;
    if (!title?.trim()) title = fb.title;
    if (!media?.length && fb.mediaUrls.length) {
      media = fb.mediaUrls.map((m) => ({
        url: m.url,
        sortOrder: m.sortOrder,
        type: m.type,
      }));
    }
  }
  return {
    id: l.id,
    title,
    price: l.price ? Math.round(l.price) : null,
    currency: l.currency,
    bedrooms: l.bedrooms,
    bathrooms: l.bathrooms,
    areaTotal: l.areaTotal ? Math.round(l.areaTotal) : null,
    locationText: l.locationText,
    heroImageUrl,
    media: Array.isArray(media)
      ? media.map((m) => ({
          url: m.url,
          sortOrder: m.sortOrder,
          ...(m.type ? { type: m.type } : {}),
        }))
      : undefined,
    publisherRef: l.publisherRef,
    source: l.source,
    operationType: l.operationType,
    ...(typeof l.propertyType !== 'undefined' ? { propertyType: l.propertyType } : {}),
  };
}
