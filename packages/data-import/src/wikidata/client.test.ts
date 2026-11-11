import { describe, expect, it } from 'vitest';
import { fetchWikidataCities, type WikidataBatch } from './client.ts';

const userAgent = 'FlanrTest/0.0';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { status: 200, ...init });
}

async function collect(batches: AsyncGenerator<WikidataBatch>) {
  const all: WikidataBatch[] = [];
  for await (const batch of batches) all.push(batch);
  return all;
}

describe('fetchWikidataCities', () => {
  it('requests items in batches of 50 with the languages and a User-Agent', async () => {
    const requests: { url: URL; userAgent: string | undefined }[] = [];
    const fakeFetch = (async (url: URL, init?: RequestInit) => {
      requests.push({ url, userAgent: (init?.headers as Record<string, string>)['User-Agent'] });
      const ids = url.searchParams.get('ids')?.split('|') ?? [];
      return jsonResponse({ entities: Object.fromEntries(ids.map((id) => [id, { id }])) });
    }) as typeof fetch;
    const ids = Array.from({ length: 120 }, (_, i) => `Q${i + 1}`);

    const batches = await collect(
      fetchWikidataCities(ids, { languages: ['de'], userAgent, fetch: fakeFetch }),
    );

    expect(batches.map((b) => b.cities.length)).toEqual([50, 50, 20]);
    expect(requests).toHaveLength(3);
    expect(requests[0]?.userAgent).toBe(userAgent);
    expect(requests[0]?.url.searchParams.get('languages')).toBe('en|de');
    expect(requests[0]?.url.searchParams.get('sitefilter')).toBe('enwiki|dewiki');
    expect(requests[0]?.url.searchParams.get('maxlag')).toBe('5');
  });

  it('reports items that do not exist', async () => {
    const fakeFetch = (async () =>
      jsonResponse({
        entities: { Q1: { id: 'Q1' }, Q2: { id: 'Q2', missing: '' } },
      })) as typeof fetch;

    const [batch] = await collect(
      fetchWikidataCities(['Q1', 'Q2'], { languages: [], userAgent, fetch: fakeFetch }),
    );

    expect(batch?.cities.map((c) => c.id)).toEqual(['Q1']);
    expect(batch?.missing).toEqual(['Q2']);
  });

  it('stores a merged item under the ID that was asked for', async () => {
    const fakeFetch = (async () =>
      jsonResponse({
        entities: {
          Q9: { id: 'Q9', labels: { en: { value: 'New' } }, redirects: { from: 'Q1', to: 'Q9' } },
        },
      })) as typeof fetch;

    const [batch] = await collect(
      fetchWikidataCities(['Q1'], { languages: [], userAgent, fetch: fakeFetch }),
    );

    expect(batch?.cities).toMatchObject([{ id: 'Q1', labelEn: 'New' }]);
  });

  it('waits and retries when the API reports replication lag', async () => {
    const waits: number[] = [];
    let calls = 0;
    const fakeFetch = (async () => {
      calls++;
      return calls === 1
        ? jsonResponse(
            { error: { code: 'maxlag', info: 'Waiting for a database server' } },
            { headers: { 'Retry-After': '7' } },
          )
        : jsonResponse({ entities: { Q1: { id: 'Q1' } } });
    }) as typeof fetch;

    const [batch] = await collect(
      fetchWikidataCities(['Q1'], {
        languages: [],
        userAgent,
        fetch: fakeFetch,
        sleep: async (ms) => void waits.push(ms),
      }),
    );

    expect(batch?.cities).toHaveLength(1);
    expect(waits).toEqual([7000]);
  });

  it('fails on an error that is not worth retrying', async () => {
    const fakeFetch = (async () =>
      jsonResponse({ error: { code: 'no-such-entity', info: 'Bad ID' } })) as typeof fetch;

    await expect(
      collect(fetchWikidataCities(['x'], { languages: [], userAgent, fetch: fakeFetch })),
    ).rejects.toThrow(/Bad ID/);
  });
});
