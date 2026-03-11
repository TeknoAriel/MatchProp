import { z } from 'zod';

export const upsertPreferenceSchema = z.object({
  minPrice: z.number().int().min(0).optional(),
  maxPrice: z.number().int().min(0).optional(),
  currency: z.string().optional(),
  operation: z.enum(['SALE', 'RENT']).optional(),
  propertyTypes: z.array(z.enum(['HOUSE', 'APARTMENT', 'LAND', 'OFFICE', 'OTHER'])).optional(),
  bedroomsMin: z.number().int().min(0).optional(),
  bathroomsMin: z.number().int().min(0).optional(),
  areaMin: z.number().int().min(0).optional(),
  locationText: z.string().max(200).optional(),
});
