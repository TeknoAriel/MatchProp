import { z } from 'zod';

/** Schema Zod para validar contrato FeedCard (card liviana) - legacy Property */
export const feedCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  price: z.number(),
  currency: z.string(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  mainImage: z.string().nullable(),
  bedrooms: z.number().nullable(),
  bathrooms: z.number().nullable(),
  areaM2: z.number().nullable(),
  operation: z.string(),
  propertyType: z.string(),
  locationText: z.string().nullable(),
});

/** Schema Zod para ListingCard (Sprint 1) */
export const listingCardSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  price: z.number().nullable(),
  currency: z.string().nullable(),
  bedrooms: z.number().nullable(),
  bathrooms: z.number().nullable(),
  areaTotal: z.number().nullable(),
  locationText: z.string().nullable(),
  heroImageUrl: z.string().nullable(),
  publisherRef: z.string().nullable(),
  source: z.string(),
});

/** Schema Zod para validar contrato FeedResponse */
export const feedResponseSchema = z.object({
  items: z.array(feedCardSchema),
  total: z.number().nullable(),
  limit: z.number(),
  nextCursor: z.string().nullable(),
});

/** Schema Zod para FeedResponseV1 (Listing-based) */
export const feedResponseV1Schema = z.object({
  items: z.array(listingCardSchema),
  total: z.number().nullable(),
  limit: z.number(),
  nextCursor: z.string().nullable(),
  fallbackUsed: z.boolean().optional(),
  emptyCatalog: z.boolean().optional(),
  matchTier: z.enum(['exact', 'relaxed', 'catalog']).optional(),
  relaxAppliedStep: z.number().nullable().optional(),
});

export type FeedResponseValidated = z.infer<typeof feedResponseSchema>;
