import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { NormalizedListing } from './types.js';
import { onListingCreated } from '../crm-push/on-listing-created.js';

const LOCATION_TEXT_MAX = 200;

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
      propertyType: norm.propertyType ?? null,
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
      heroImageUrl: norm.mediaUrls?.[0]?.url ?? null,
      photosCount: norm.mediaUrls?.length ?? 0,
      updatedAtSource: norm.updatedAtSource ?? null,
      lastSyncedAt: now,
      lastSeenAt: now,
      rawJson: (rawJson as Prisma.InputJsonValue) ?? undefined,
    },
    update: {
      publisherRef: norm.publisherRef ?? undefined,
      status: norm.status,
      title: norm.title ?? undefined,
      description: norm.description ?? undefined,
      operationType: norm.operationType ?? undefined,
      propertyType: norm.propertyType ?? undefined,
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
      heroImageUrl: norm.mediaUrls?.[0]?.url ?? undefined,
      photosCount: norm.mediaUrls?.length ?? 0,
      updatedAtSource: norm.updatedAtSource ?? undefined,
      lastSyncedAt: now,
      lastSeenAt: now,
      rawJson: (rawJson as Prisma.InputJsonValue) ?? undefined,
    },
  });

  await prisma.listingMedia.deleteMany({ where: { listingId: listing.id } });
  if (norm.mediaUrls && norm.mediaUrls.length > 0) {
    await prisma.listingMedia.createMany({
      data: norm.mediaUrls.map((m, i) => ({
        listingId: listing.id,
        url: m.url,
        type: 'PHOTO',
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
