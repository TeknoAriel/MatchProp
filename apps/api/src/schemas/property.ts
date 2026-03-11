import { z } from 'zod';

export const createPropertySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  price: z.number().int().positive(),
  currency: z.enum(['USD', 'ARS']).optional(),
  locationText: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  bedrooms: z.number().int().min(0).optional(),
  bathrooms: z.number().int().min(0).optional(),
  areaM2: z.number().int().min(0).optional(),
  operation: z.enum(['SALE', 'RENT']).optional(),
  propertyType: z.enum(['HOUSE', 'APARTMENT', 'LAND', 'OFFICE', 'OTHER']).optional(),
  photos: z.array(z.string()).optional(),
});

export const updatePropertySchema = createPropertySchema.partial();

export const listPropertiesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
  operation: z.enum(['SALE', 'RENT']).optional(),
  propertyType: z.enum(['HOUSE', 'APARTMENT', 'LAND', 'OFFICE', 'OTHER']).optional(),
  minPrice: z.coerce.number().int().optional(),
  maxPrice: z.coerce.number().int().optional(),
});
