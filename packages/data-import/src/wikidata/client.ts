import { parseWikidataCity, type WikidataCity, type WikidataEntityJson } from './entity.ts';

const endpoint = 'https://www.wikidata.org/w/api.php';
// The API returns at most 50 items per request.
const batchSize = 50;
const maxAttempts = 5;
const defaultRetrySeconds = 5;

export interface WikidataClientOptions {
  /** Languages of labels and aliases to fetch, and of the Wikipedia links besides English. */
  languages: string[];
  /** Identifies the client to Wikimedia, as their User-Agent policy requires. */
  userAgent: string;
  fetch?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
}

export interface WikidataBatch {
  cities: WikidataCity[];
  /** Requested IDs that do not exist in Wikidata. */
  missing: string[];
}

/**
 * Fetches items from the Wikidata API in batches, one request at a time. It asks the API to
 * refuse work when its replicas lag (maxlag) and waits when told to, as Wikimedia asks of bots.
 */
export async function* fetchWikidataCities(
  ids: string[],
  options: WikidataClientOptions,
): AsyncGenerator<WikidataBatch> {
  for (let start = 0; start < ids.length; start += batchSize) {
    const batch = ids.slice(start, start + batchSize);
    const entities = await requestEntities(batch, options);
    const cities: WikidataCity[] = [];
    const missing: string[] = [];
    for (const id of batch) {
      const entity = entities[id];
      if (!entity || entity.missing !== undefined) {
        missing.push(id);
      } else {
        // A redirected item comes back under its new ID; it is stored under the ID that cities use.
        cities.push({ ...parseWikidataCity(entity), id });
      }
    }
    yield { cities, missing };
  }
}

async function requestEntities(
  ids: string[],
  options: WikidataClientOptions,
): Promise<Record<string, WikidataEntityJson>> {
  const doFetch = options.fetch ?? fetch;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const languages = [...new Set(['en', ...options.languages])];
  const url = new URL(endpoint);
  url.search = new URLSearchParams({
    action: 'wbgetentities',
    ids: ids.join('|'),
    props: 'labels|aliases|claims|sitelinks',
    languages: languages.join('|'),
    sitefilter: languages.map((language) => `${language}wiki`).join('|'),
    redirects: 'yes',
    format: 'json',
    maxlag: '5',
  }).toString();

  for (let attempt = 1; ; attempt++) {
    const response = await doFetch(url, { headers: { 'User-Agent': options.userAgent } });
    const body = response.ok ? ((await response.json()) as WikidataResponse) : null;
    if (body?.entities) {
      return redirectsResolved(ids, body.entities);
    }

    const retryable =
      body?.error?.code === 'maxlag' || response.status === 429 || response.status >= 500;
    if (!retryable || attempt >= maxAttempts) {
      throw new Error(
        `Wikidata request failed: ${body?.error?.info ?? `HTTP ${response.status}`} (IDs ${ids[0]}…)`,
      );
    }
    const retrySeconds = Number(response.headers.get('Retry-After')) || defaultRetrySeconds;
    await sleep(retrySeconds * 1000 * attempt);
  }
}

interface WikidataResponse {
  entities?: Record<string, WikidataEntityJson & { redirects?: { from: string } }>;
  error?: { code: string; info: string };
}

/** Keys the response by the requested IDs, also for items that were merged into another one. */
function redirectsResolved(
  ids: string[],
  entities: NonNullable<WikidataResponse['entities']>,
): Record<string, WikidataEntityJson> {
  const byRequestedId: Record<string, WikidataEntityJson> = {};
  for (const [id, entity] of Object.entries(entities)) {
    byRequestedId[entity.redirects?.from ?? id] = entity;
  }
  return Object.fromEntries(
    ids.flatMap((id) => (byRequestedId[id] ? [[id, byRequestedId[id]]] : [])),
  );
}
