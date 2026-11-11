import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { countryConfig } from '../src/countries.ts';
import { importCities } from '../src/pipeline/run.ts';
import type { WikidataCity } from '../src/wikidata/entity.ts';
import { importWikidata } from '../src/wikidata/run.ts';
import { saveWikidataCities } from '../src/wikidata/store.ts';
import { connectTestDatabase } from './database.ts';
import { baseFeatures, baseRelations, node, writeFixture } from './fixture.ts';

const sql = connectTestDatabase();
const country = countryConfig('DE');

afterAll(async () => {
  await sql.end();
});

beforeEach(async () => {
  await sql`TRUNCATE wikidata_entities, city_tile_shapes, city_names, cities, municipalities, regions, countries, import_runs RESTART IDENTITY CASCADE`;
});

/** The base fixture, with Wikidata IDs added to the village, the town and the hamlet. */
function features() {
  const wikidataIds: Record<string, string> = { n12: 'Q12', n13: 'Q13', n14: 'Q14' };
  return baseFeatures().map((f) => {
    const wikidata = wikidataIds[f.id];
    const [x, y] = f.geometry.type === 'Point' ? f.geometry.coordinates : [0, 0];
    return wikidata ? node(Number(f.id.slice(1)), x, y, { ...f.tags, wikidata }) : f;
  });
}

async function runOsmImport() {
  const files = await writeFixture(features(), baseRelations());
  return importCities(sql, { country, ...files, sourceTimestamp: null });
}

function wikidataCity(id: string, fields: Partial<WikidataCity> = {}): WikidataCity {
  return {
    id,
    labelEn: null,
    aliases: {},
    population: null,
    populationYear: null,
    areaKm2: null,
    elevationM: null,
    website: null,
    founded: null,
    wikipediaUrls: {},
    ...fields,
  };
}

async function city(name: string) {
  const [row] = await sql`
    SELECT name_en, population, population_year, population_source, wikipedia_url, area_km2,
           elevation_m, website, founded
    FROM cities WHERE name_local = ${name}
  `;
  return row;
}

describe('Wikidata enrichment (FR-CITY-002)', () => {
  it('fills area, elevation, website and founding year', async () => {
    await saveWikidataCities(sql, [
      wikidataCity('Q10', {
        areaKm2: 405.2,
        elevationM: 53,
        website: 'https://example.org/',
        founded: 1180,
      }),
    ]);

    await runOsmImport();

    expect(await city('Großstadt')).toMatchObject({
      area_km2: expect.closeTo(405.2, 3),
      elevation_m: 53,
      website: 'https://example.org/',
      founded: 1180,
    });
  });

  describe('population', () => {
    it('keeps the OSM figure when it is newer than the one in Wikidata', async () => {
      await saveWikidataCities(sql, [
        wikidataCity('Q10', { population: 480000, populationYear: 2021 }),
      ]);

      await runOsmImport();

      expect(await city('Großstadt')).toMatchObject({
        population: 500000,
        population_year: 2023,
        population_source: 'openstreetmap',
      });
    });

    it('takes a dated Wikidata figure over an undated OSM one', async () => {
      await saveWikidataCities(sql, [
        wikidataCity('Q12', { population: 4700, populationYear: 2022 }),
      ]);

      await runOsmImport();

      expect(await city('Dorf')).toMatchObject({
        population: 4700,
        population_year: 2022,
        population_source: 'wikidata',
      });
    });

    it('does not replace an OSM figure with an undated Wikidata one', async () => {
      await saveWikidataCities(sql, [wikidataCity('Q12', { population: 4700 })]);

      await runOsmImport();

      expect(await city('Dorf')).toMatchObject({
        population: 4662,
        population_source: 'openstreetmap',
      });
    });

    it('takes the Wikidata figure when OSM has none', async () => {
      await saveWikidataCities(sql, [wikidataCity('Q13', { population: 9000 })]);

      await runOsmImport();

      expect(await city('Kleinstadt')).toMatchObject({
        population: 9000,
        population_year: null,
        population_source: 'wikidata',
      });
    });
  });

  describe('English name', () => {
    it('keeps the English name from OSM', async () => {
      await saveWikidataCities(sql, [wikidataCity('Q10', { labelEn: 'Big City' })]);

      await runOsmImport();

      expect(await city('Großstadt')).toMatchObject({ name_en: 'Bigcity' });
    });

    it('uses the Wikidata label when OSM has no English name', async () => {
      await saveWikidataCities(sql, [wikidataCity('Q14', { labelEn: 'Hamlet' })]);

      await runOsmImport();

      expect(await city('Weiler')).toMatchObject({ name_en: 'Hamlet' });
    });
  });

  describe('Wikipedia link', () => {
    it('prefers the English article over the link from OSM', async () => {
      await saveWikidataCities(sql, [
        wikidataCity('Q10', {
          wikipediaUrls: {
            enwiki: 'https://en.wikipedia.org/wiki/Bigcity',
            dewiki: 'https://de.wikipedia.org/wiki/X',
          },
        }),
      ]);

      await runOsmImport();

      expect(await city('Großstadt')).toMatchObject({
        wikipedia_url: 'https://en.wikipedia.org/wiki/Bigcity',
      });
    });

    it('falls back to an article in the local language', async () => {
      await saveWikidataCities(sql, [
        wikidataCity('Q14', { wikipediaUrls: { dewiki: 'https://de.wikipedia.org/wiki/Weiler' } }),
      ]);

      await runOsmImport();

      expect(await city('Weiler')).toMatchObject({
        wikipedia_url: 'https://de.wikipedia.org/wiki/Weiler',
      });
    });
  });

  it('adds the Wikidata label and aliases to the names used by search (FR-SRCH-001)', async () => {
    await saveWikidataCities(sql, [
      wikidataCity('Q14', {
        labelEn: 'Hamlet',
        aliases: { en: ['Old Hamlet'], de: ['Weiler am See'] },
      }),
    ]);

    await runOsmImport();

    const names = await sql`
      SELECT n.name, n.lang, n.kind FROM city_names n JOIN cities c ON c.id = n.city_id
      WHERE c.name_local = 'Weiler' AND n.kind LIKE 'wikidata%' ORDER BY n.name COLLATE "C"
    `;
    expect(names.map((n) => ({ ...n }))).toEqual([
      { name: 'Hamlet', lang: 'en', kind: 'wikidata_label' },
      { name: 'Old Hamlet', lang: 'en', kind: 'wikidata_alias' },
      { name: 'Weiler am See', lang: 'de', kind: 'wikidata_alias' },
    ]);
  });
});

describe('importWikidata', () => {
  /** A fake Wikidata API that knows every requested item except Q13. */
  function fakeWikidata(requested: string[][]) {
    return (async (url: URL) => {
      const ids = url.searchParams.get('ids')?.split('|') ?? [];
      requested.push(ids);
      const entities = Object.fromEntries(
        ids.map((id) => [
          id,
          id === 'Q13'
            ? { id, missing: '' }
            : { id, labels: { en: { value: `Label ${id}` } }, claims: {} },
        ]),
      );
      return new Response(JSON.stringify({ entities }));
    }) as typeof fetch;
  }

  it('fetches the items of all cities, stores them and enriches the cities', async () => {
    await runOsmImport();
    const requested: string[][] = [];

    const stats = await importWikidata(sql, {
      country,
      refreshAfterDays: 30,
      client: { userAgent: 'FlanrTest/0.0', fetch: fakeWikidata(requested) },
    });

    expect(requested).toEqual([['Q10', 'Q12', 'Q13', 'Q14']]);
    expect(stats).toEqual({ requested: 4, fetched: 3, missing: 1 });
    expect(await city('Weiler')).toMatchObject({ name_en: 'Label Q14' });
    const [run] = await sql`SELECT source_id, status FROM import_runs ORDER BY id DESC LIMIT 1`;
    expect(run).toMatchObject({ source_id: 'wikidata', status: 'succeeded' });
  });

  it('does not fetch items again that were fetched recently', async () => {
    await runOsmImport();
    await saveWikidataCities(sql, [wikidataCity('Q10'), wikidataCity('Q12')]);
    const requested: string[][] = [];

    await importWikidata(sql, {
      country,
      refreshAfterDays: 30,
      client: { userAgent: 'FlanrTest/0.0', fetch: fakeWikidata(requested) },
    });

    expect(requested).toEqual([['Q13', 'Q14']]);
  });

  it('keeps the enrichment when the OSM import runs again', async () => {
    await runOsmImport();
    await importWikidata(sql, {
      country,
      refreshAfterDays: 30,
      client: { userAgent: 'FlanrTest/0.0', fetch: fakeWikidata([]) },
    });

    await runOsmImport();

    expect(await city('Weiler')).toMatchObject({ name_en: 'Label Q14' });
  });
});
