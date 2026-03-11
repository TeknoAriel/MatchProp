import { z } from 'zod';

export const createSwipeSchema = z.object({
  propertyId: z.string(),
  direction: z.enum(['LIKE', 'DISLIKE']),
});

export const listSwipesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
