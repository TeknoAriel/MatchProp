import { z } from 'zod';

/**
 * Snapshot completo desde el cliente. El servidor fusiona con el guardado usando el máximo por campo.
 */
export const patchEngagementStatsSchema = z.object({
  swipes: z.number().int().min(0),
  searches: z.number().int().min(0),
  listingOpens: z.number().int().min(0),
  saves: z.number().int().min(0),
});
