import { problemContentType, type Problem } from '@flanr/shared';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/** Error response in RFC 9457 Problem Details format. */
export function problem(
  c: Context,
  status: ContentfulStatusCode,
  title: string,
  detail?: string,
  errors?: Problem['errors'],
) {
  const body: Problem = {
    type: 'about:blank',
    title,
    status,
    ...(detail ? { detail } : {}),
    ...(errors ? { errors } : {}),
  };
  return c.json(body, status, { 'Content-Type': problemContentType });
}
