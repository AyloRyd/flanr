import { z } from 'zod';

/** Error response in RFC 9457 Problem Details format (SRS 6.2). */
export const problemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  /** Present on validation errors: one entry per invalid field. */
  errors: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});

export type Problem = z.infer<typeof problemSchema>;

export const problemContentType = 'application/problem+json';
