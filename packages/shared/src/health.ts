import { z } from 'zod';

export const healthStatusSchema = z.enum(['ok', 'unavailable']);

export const healthResponseSchema = z.object({
  status: healthStatusSchema,
  database: healthStatusSchema,
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
