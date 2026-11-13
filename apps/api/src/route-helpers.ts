import { z } from '@hono/zod-openapi';
import { problemContentType, problemSchema } from '@flanr/shared';
import type { Context } from 'hono';
import { problem } from './problem.ts';

/** Marks a route as one that needs a signed-in user in the OpenAPI document. */
export const bearerSecurity = [{ bearerAuth: [] }];

export const json = <Schema extends z.ZodType>(schema: Schema) => ({
  content: { 'application/json': { schema } },
});

export const problemResponse = (description: string) => ({
  description,
  content: { [problemContentType]: { schema: problemSchema } },
});

/** Responses that every route for signed-in users can give. */
export const commonErrors = {
  400: problemResponse('Invalid request'),
  401: problemResponse('No valid session token'),
};

/** An ID in the path or the query string. */
export const idParam = z.coerce.number().int().positive();

export const cityParams = z.object({ cityId: idParam });

/**
 * The ID that a page cursor stands for: undefined without a cursor, null if the text is not a
 * cursor these endpoints return.
 */
export function idFromCursor(cursor: string | undefined): number | undefined | null {
  if (cursor === undefined) return undefined;
  const id = Number(cursor);
  return Number.isSafeInteger(id) ? id : null;
}

/**
 * For requests that remove a visit or a lived-in mark. If the city would stop being visited
 * and the user has rated it, the rating is deleted too, and the request is only carried out
 * with this confirmation (BR-005).
 */
export const ratingDeletionQuery = z.object({
  confirmRatingDeletion: z.enum(['true', 'false']).default('false'),
});

export const ratingNeedsConfirmationResponse = problemResponse(
  'The rating of the city would be deleted too, which needs a confirmation (BR-005)',
);

export const ratingNeedsConfirmation = (c: Context) =>
  problem(
    c,
    409,
    'Rating would be deleted',
    'The city would no longer be visited, so your rating of it would be deleted too. Repeat the request with the confirmation to go on.',
  );

export const invalidCursor = (c: Context) =>
  problem(c, 400, 'Invalid request', undefined, [
    { path: 'cursor', message: 'Not a cursor returned by this endpoint' },
  ]);
