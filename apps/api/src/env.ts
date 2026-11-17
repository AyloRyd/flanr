import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.url(),
  API_PORT: z.coerce.number().int().positive().default(8787),
  /** Write requests per minute and client (NFR-SEC-004). Raised for the end-to-end tests. */
  WRITE_RATE_LIMIT: z.coerce.number().int().positive().default(60),
  // Clerk keys are optional so that the API starts without them; no request can sign in then.
  CLERK_SECRET_KEY: z.string().min(1).optional(),
  CLERK_WEBHOOK_SIGNING_SECRET: z.string().min(1).optional(),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
