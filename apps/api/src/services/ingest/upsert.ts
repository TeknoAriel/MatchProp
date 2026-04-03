import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { NormalizedListing, ListingDetailsFromIngest } from './types.js';
import { pickHeroUrlFromMedia, resolveMediaType } from '../../lib/media-url-kind.js';
import { normalizeIngestPropertyType } from './property-type-normalize.js';
import { onListingCreated } from '../crm-push/on-listing-created.js';

const LOCATION_TEXT_MAX = 200;

/**
 * Extrae details del raw y fusiona encima `norm.details` (p. ej. adTypeCode desde el conector)
 * sin perder amenities del JSON.
 */
function extractDetailsFromRaw(
  raw: Record<string, unknown> | null | undefined,
  norm: NormalizedListing
): ListingDetailsFromIngest | null {
  if (!raw || typeof raw !== 'object') {
    if (norm.details != null && typeof norm.details === 'object') {
      const d = norm.details as ListingDetailsFromIngest;
      return Object.keys(d).length > 0 ? d : null;
    }
    return null;
  }

  const details: ListingDetailsFromIngest = {};
  const toBool = (v: unknown) => v === true || v === 'true' || v === 'si' || v === 'Si' || v === 1;
  const toArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x) => typeof x === 'string').map(String) : [];

  if (raw.amenities != null) details.amenities = toArr(raw.amenities);
  if (raw.apto_credito != null) details.aptoCredito = toBool(raw.apto_credito);
  if (raw.aptoCredito != null) details.aptoCredito = toBool(raw.aptoCredito);
  if (raw.pileta != null) details.pileta = toBool(raw.pileta);
  if (raw.piscina != null) details.pileta = details.pileta ?? toBool(raw.piscina);
  if (raw.cochera != null || raw.cocheras != null)
    details.cochera = toBool(raw.cochera ?? raw.cocheras);
  if (raw.garage != null) details.cochera = details.cochera ?? toBool(raw.garage);
  if (raw.jardin != null || raw.jardín != null) details.jardin = toBool(raw.jardin ?? raw.jardín);
  if (raw.parrilla != null) details.parrilla = toBool(raw.parrilla);
  if (raw.gimnasio != null) details.gimnasio = toBool(raw.gimnasio);

  const amenityKeys = [
    'pileta',
    'piscina',
    'cochera',
    'cocheras',
    'garage',
    'jardin',
    'parrilla',
    'quincho',
    'gimnasio',
    'aire_acondicionado',
    'calefaccion',
    'chimenea',
    'ascensor',
    'hidromasaje',
    'solarium',
    'sauna',
    'vigilancia',
  ];
  const foundAmenities = new Set<string>();
  for (const key of amenityKeys) {
    const v = raw[key];
    if (toBool(v)) foundAmenities.add(key.replace(/_/g, ' '));
  }
  if (foundAmenities.size > 0) {
    details.amenities = [...(details.amenities ?? []), ...foundAmenities];
  }

  const merged: ListingDetailsFromIngest =
    norm.details != null && typeof norm.details === 'object'
      ? { ...details, ...(norm.details as ListingDetailsFromIngest) }
      : details;

  return Object.keys(merged).length > 0 ? merged : null;
}

function truncateLocation(s: string | null | undefined): string | null {
  if (!s || typeof s !== 'string') return null;
  return s.trim().slice(0, LOCATION_TEXT_MAX) || null;
}

export async function upsertListing(
  norm: NormalizedListing,
  rawJson?: Record<string, unknown> | null
): Promise<string> {
  const now = new Date();
  const locationText = truncateLocation(norm.locationText ?? norm.addressText);
  const details = extractDetailsFromRaw(rawJson ?? null, norm);

  const propertyTypeCanon = normalizeIngestPropertyType(norm.propertyType);

  const existing = await prisma.listing.findUnique({
    where: {
      source_externalId: { source: norm.source, externalId: norm.externalId },
    },
    select: { id: true, price: true, currency: true, status: true },
  });

  const listing = await prisma.listing.upsert({
    where: {
      source_externalId: {
        source: norm.source,
        externalId: norm.externalId,
      },
    },
    create: {
      source: norm.source,
      externalId: norm.externalId,
      publisherRef: norm.publisherRef ?? null,
      status: norm.status,
      title: norm.title ?? null,
      description: norm.description ?? null,
      operationType: norm.operationType ?? null,
      propertyType: propertyTypeCanon,
      currency: norm.currency ?? null,
      price: norm.price ?? null,
      bedrooms: norm.bedrooms ?? null,
      bathrooms: norm.bathrooms ?? null,
      areaTotal: norm.areaTotal ?? null,
      areaCovered: norm.areaCovered ?? null,
      lat: norm.lat ?? null,
      lng: norm.lng ?? null,
      addressText: norm.addressText ?? null,
      locationText,
      heroImageUrl: norm.mediaUrls?.length ? pickHeroUrlFromMedia(norm.mediaUrls) : null,
      photosCount: norm.mediaUrls?.length ?? 0,
      updatedAtSource: norm.updatedAtSource ?? null,
      lastSyncedAt: now,
      lastSeenAt: now,
      rawJson: (rawJson as Prisma.InputJsonValue) ?? undefined,
      details: (details as Prisma.InputJsonValue) ?? undefined,
    },
    update: {
      publisherRef: norm.publisherRef ?? undefined,
      status: norm.status,
      title: norm.title ?? undefined,
      description: norm.description ?? undefined,
      operationType: norm.operationType ?? undefined,
      propertyType: propertyTypeCanon ?? undefined,
      currency: norm.currency ?? undefined,
      price: norm.price ?? undefined,
      bedrooms: norm.bedrooms ?? undefined,
      bathrooms: norm.bathrooms ?? undefined,
      areaTotal: norm.areaTotal ?? undefined,
      areaCovered: norm.areaCovered ?? undefined,
      lat: norm.lat ?? undefined,
      lng: norm.lng ?? undefined,
      addressText: norm.addressText ?? undefined,
      locationText: locationText ?? undefined,
      heroImageUrl: norm.mediaUrls?.length ? pickHeroUrlFromMedia(norm.mediaUrls) : undefined,
      photosCount: norm.mediaUrls?.length ?? 0,
      updatedAtSource: norm.updatedAtSource ?? undefined,
      lastSyncedAt: now,
      lastSeenAt: now,
      rawJson: (rawJson as Prisma.InputJsonValue) ?? undefined,
      details: (details as Prisma.InputJsonValue) ?? undefined,
    },
  });

  await prisma.listingMedia.deleteMany({ where: { listingId: listing.id } });
  if (norm.mediaUrls && norm.mediaUrls.length > 0) {
    await prisma.listingMedia.createMany({
      data: norm.mediaUrls.map((m, i) => ({
        listingId: listing.id,
        url: m.url,
        type: resolveMediaType(m.url, m.type),
        sortOrder: m.sortOrder ?? i,
      })),
    });
  }

  if (existing) {
    const oldPrice = existing.price;
    const newPrice = norm.price ?? null;
    const oldCurrency = existing.currency ?? null;
    const newCurrency = norm.currency ?? null;
    const oldStatus = existing.status;
    const newStatus = norm.status;

    const priceChanged =
      typeof oldPrice === 'number' &&
      typeof newPrice === 'number' &&
      (oldPrice !== newPrice || oldCurrency !== newCurrency);
    if (priceChanged) {
      await prisma.listingEvent.create({
        data: {
          listingId: listing.id,
          type: 'PRICE_CHANGED',
          payload: {
            oldPrice,
            newPrice,
            oldCurrency,
            newCurrency: newCurrency ?? oldCurrency,
          },
        },
      });
    }

    if (oldStatus !== newStatus) {
      await prisma.listingEvent.create({
        data: {
          listingId: listing.id,
          type: 'STATUS_CHANGED',
          payload: { oldStatus, newStatus },
        },
      });
    }
  } else {
    // Listing nuevo: reverse-matching universal (Sprint 11). Enqueue CRM solo si source CRM_WEBHOOK.
    if (listing.status === 'ACTIVE') {
      await onListingCreated(listing.id, listing.source, listing.status).catch((err) => {
        console.warn('[crm-push] onListingCreated failed:', err);
      });
    }
  }

  return listing.id;
}
