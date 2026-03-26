import { z } from 'zod';

const LOCATION_MAX = 200;

export const searchFiltersSchema = z.object({
  operationType: z.enum(['SALE', 'RENT']).optional(),
  propertyType: z.array(z.string()).optional(),
  priceMin: z.number().optional(),
  priceMax: z.number().optional(),
  bedroomsMin: z.number().int().min(0).optional(),
  bedroomsMax: z.number().int().min(0).optional(),
  bathroomsMin: z.number().int().min(0).optional(),
  bathroomsMax: z.number().int().min(0).optional(),
  areaMin: z.number().int().min(0).optional(),
  areaMax: z.number().int().min(0).optional(),
  areaCoveredMin: z.number().int().min(0).optional(),
  locationText: z
    .string()
    .transform((s) => (s ? s.trim().slice(0, LOCATION_MAX) : undefined))
    .optional(),
  addressText: z.string().max(200).optional(),
  titleContains: z.string().max(100).optional(),
  descriptionContains: z.string().max(200).optional(),
  currency: z.string().optional(),
  sortBy: z.enum(['date_desc', 'price_asc', 'price_desc', 'area_desc']).optional(),
  source: z.string().max(50).optional(),
  aptoCredito: z.boolean().optional(),
  amenities: z.array(z.string()).optional(),
  photosCountMin: z.number().int().min(0).optional(),
  listingAgeDays: z.number().int().min(1).max(365).optional(),
  keywords: z.array(z.string()).optional(),
  minLat: z.number().optional(),
  maxLat: z.number().optional(),
  minLng: z.number().optional(),
  maxLng: z.number().optional(),
});

export type SearchFiltersValidated = z.infer<typeof searchFiltersSchema>;

export function normalizeFilters(raw: unknown): SearchFiltersValidated {
  const parsed = searchFiltersSchema.safeParse(raw);
  if (!parsed.success) return {};
  const f = parsed.data;
  return {
    ...f,
    propertyType: f.propertyType?.length ? [...f.propertyType].sort() : undefined,
    locationText: f.locationText?.trim().slice(0, LOCATION_MAX) || undefined,
  };
}

export const assistantSearchRequestSchema = z.object({
  text: z.string().min(3, 'Mínimo 3 caracteres').max(500, 'Máximo 500 caracteres'),
});

export const createSavedSearchRequestSchema = z.object({
  name: z.string().max(100).optional(),
  text: z.string().max(500).optional(),
  filters: searchFiltersSchema,
});

export const assistantSearchResponseSchema = z.object({
  filters: searchFiltersSchema,
  explanation: z.string(),
  warnings: z.array(z.string()).optional(),
});
