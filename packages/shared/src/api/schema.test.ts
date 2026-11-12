import { readFile } from 'node:fs/promises';
import openapiTS, { astToString, COMMENT_HEADER } from 'openapi-typescript';
import { describe, expect, it } from 'vitest';

describe('API types (CON-009)', () => {
  it('are up to date with the OpenAPI document; run `pnpm api:contract` if not', async () => {
    const contract = new URL('../../openapi.json', import.meta.url);
    const generated = COMMENT_HEADER + astToString(await openapiTS(contract));

    expect(await readFile(new URL('./schema.ts', import.meta.url), 'utf8')).toBe(generated);
  });
});
